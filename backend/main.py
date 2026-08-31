import os
import sys
import math
import time
import re
import secrets
from collections import Counter
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
# pyrefly: ignore [missing-import]
from bson import ObjectId
import pandas as pd
import io
from datetime import datetime, timezone, timedelta

from database import customer_collection, user_collection, telco_collection, notification_collection, otp_collection, database
from auth import hash_password, verify_password, create_access_token, get_current_user, get_current_user_doc, get_company_id_for_name
from mailer import send_otp_email, mask_email

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from ml.predict import predict_churn
from ml.explain import explain_prediction
from ml.recommend import generate_recommendations
from typing import Literal, Optional
from fastapi.middleware.cors import CORSMiddleware
from ml.batch_predict import predict_batch, build_aggregates
from ml.metrics import compute_metrics, invalidate_metrics_cache
from ml.segment_customers import get_segment_profiles

app = FastAPI(
    title="ChurnGuard API",
    description="AI-powered customer churn prediction and retention system",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file mount for user profile avatars
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
AVATAR_DIR = os.path.join(UPLOAD_DIR, "avatars")
os.makedirs(AVATAR_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.on_event("startup")
async def startup_event():
    """Create all necessary MongoDB indexes at startup."""
    index_tasks = [
        # Telco customers — primary dedup index (already existed)
        telco_collection.create_index(
            [("company_id", 1), ("customerID", 1)],
            unique=True,
            name="company_customer_id_unique",
            sparse=True
        ),
        # Telco customers — tenant-only queries (count, find all)
        telco_collection.create_index(
            [("company_id", 1)],
            name="telco_company_id"
        ),
        # Telco customers — text search fields under company scope
        telco_collection.create_index(
            [("company_id", 1), ("Contract", 1)],
            name="telco_company_contract"
        ),
        telco_collection.create_index(
            [("company_id", 1), ("InternetService", 1)],
            name="telco_company_internet"
        ),
        telco_collection.create_index(
            [("company_id", 1), ("created_at", -1)],
            name="telco_company_created"
        ),
        # Upload history — list by company, sorted by time
        database["dataset_uploads"].create_index(
            [("company_id", 1), ("uploaded_at", -1)],
            name="uploads_company_time"
        ),
        # Dashboard cache — unique per company
        database["dashboard_cache"].create_index(
            [("company_id", 1)],
            unique=True,
            name="cache_company_unique"
        ),
        # Customer collection (CRUD) — tenant filter
        customer_collection.create_index(
            [("company_id", 1)],
            name="customers_company_id"
        ),
        customer_collection.create_index(
            [("company_id", 1), ("email", 1)],
            name="customers_company_email"
        ),
        # Users — login lookup
        user_collection.create_index(
            [("email", 1)],
            unique=True,
            name="users_email_unique"
        ),
        # Notifications — user & company lookup sorted by created_at desc
        notification_collection.create_index(
            [("user_id", 1), ("company_id", 1), ("created_at", -1)],
            name="notif_user_company_created"
        ),
        # OTP verification codes — user lookup and TTL index
        otp_collection.create_index(
            [("user_id", 1), ("purpose", 1)],
            name="otp_user_purpose"
        ),
        otp_collection.create_index(
            [("company_id", 1), ("user_id", 1)],
            name="otp_company_user"
        ),
        otp_collection.create_index(
            [("expires_at", 1)],
            expireAfterSeconds=0,
            name="otp_expires_ttl"
        ),
    ]

    for task in index_tasks:
        try:
            await task
        except Exception as e:
            # Index already exists or compatible — non-fatal
            print("MongoDB index notice:", e)

    print("MongoDB indexes ensured at startup.")


# ---------- Helper: build dashboard summary from batch results + raw records ----------

def _build_dashboard_summary(company_id: str, batch_results: list, clean_customers: list) -> dict:
    """Pure-Python aggregation — no extra DB round trip needed."""
    high   = sum(1 for r in batch_results if r["risk_level"] == "High")
    medium = sum(1 for r in batch_results if r["risk_level"] == "Medium")
    low    = sum(1 for r in batch_results if r["risk_level"] == "Low")

    total_mrr = sum(
        float(c.get("MonthlyCharges", 0))
        for c in clean_customers
        if str(c.get("MonthlyCharges", "")).replace('.', '', 1).isdigit()
    )
    avg_churn = round((high / len(batch_results) * 100), 1) if batch_results else 0.0

    contract_counts = Counter(c.get("Contract", "Unknown") for c in clean_customers)
    color_map = {
        "Month-to-month": "#e11d48",
        "One year":       "#d97706",
        "Two year":       "#22c55e"
    }
    plan_distribution = [
        {
            "name":  plan,
            "value": count,
            "pct":   round(count / len(clean_customers) * 100, 1) if clean_customers else 0,
            "color": color_map.get(plan, "#7c3aed")
        }
        for plan, count in contract_counts.items()
    ]

    return {
        "company_id":       company_id,
        "available":        True,
        "total_analyzed":   len(batch_results),
        "high_risk_count":  high,
        "medium_risk_count": medium,
        "low_risk_count":   low,
        "total_mrr":        round(total_mrr, 2),
        "avg_churn_rate":   avg_churn,
        "plan_distribution": plan_distribution,
        "results":          sorted(batch_results, key=lambda r: r["churn_probability"], reverse=True)[:10],
    }


# ---------- Pydantic Models ----------

class Customer(BaseModel):
    name: str
    email: str
    phone: str
    age: int
    gender: Literal["Male", "Female"]
    location: str
    subscription_type: str
    monthly_charges: float
    total_charges: float
    tenure: int
    contract_type: Literal["Month-to-month", "One year", "Two year"]
    payment_method: str
    internet_service: Literal["DSL", "Fiber optic", "No"]
    tech_support: Literal["Yes", "No"]
    online_security: Literal["Yes", "No"]
    streaming_services: Literal["Yes", "No"]
    is_active: bool = True
    churn_status: Literal["Yes", "No"] = "No"


class CustomerResponse(BaseModel):
    name: str
    email: str
    subscription_type: str
    is_active: bool
    welcome_message: str


class User(BaseModel):
    email: str
    password: str

class RegisterUser(BaseModel):
    email: str
    password: str
    first_name: str = ""
    last_name: str = ""
    company: str = ""
    company_type: Optional[str] = "Private Limited Company"
    industry: Optional[str] = "Information Technology"
    phone: str = ""
    role: str = "Analyst"
    department: Optional[str] = "Analytics"
    company_size: Optional[str] = "11–50 employees"
    country: str = "India"

class CustomerPredictionInput(BaseModel):
    gender: Literal["Male", "Female"]
    SeniorCitizen: Literal["Yes", "No"]
    Partner: Literal["Yes", "No"]
    Dependents: Literal["Yes", "No"]
    tenure: int
    PhoneService: Literal["Yes", "No"]
    MultipleLines: Literal["Yes", "No", "No phone service"]
    InternetService: Literal["DSL", "Fiber optic", "No"]
    OnlineSecurity: Literal["Yes", "No", "No internet service"]
    OnlineBackup: Literal["Yes", "No", "No internet service"]
    DeviceProtection: Literal["Yes", "No", "No internet service"]
    TechSupport: Literal["Yes", "No", "No internet service"]
    StreamingTV: Literal["Yes", "No", "No internet service"]
    StreamingMovies: Literal["Yes", "No", "No internet service"]
    Contract: Literal["Month-to-month", "One year", "Two year"]
    PaperlessBilling: Literal["Yes", "No"]
    PaymentMethod: Literal[
        "Electronic check", "Mailed check",
        "Bank transfer (automatic)", "Credit card (automatic)"
    ]
    MonthlyCharges: float
    TotalCharges: float


class TelcoCustomerCreate(BaseModel):
    customerID: Optional[str] = None
    gender: Optional[str] = "Male"
    SeniorCitizen: Optional[str] = "No"
    Partner: Optional[str] = "No"
    Dependents: Optional[str] = "No"
    tenure: Optional[int] = 1
    PhoneService: Optional[str] = "Yes"
    MultipleLines: Optional[str] = "No"
    InternetService: Optional[str] = "DSL"
    OnlineSecurity: Optional[str] = "No"
    OnlineBackup: Optional[str] = "No"
    DeviceProtection: Optional[str] = "No"
    TechSupport: Optional[str] = "No"
    StreamingTV: Optional[str] = "No"
    StreamingMovies: Optional[str] = "No"
    Contract: Optional[str] = "Month-to-month"
    PaperlessBilling: Optional[str] = "Yes"
    PaymentMethod: Optional[str] = "Electronic check"
    MonthlyCharges: Optional[float] = 50.0
    TotalCharges: Optional[float] = 50.0
    Churn: Optional[str] = "No"


class TelcoCustomerUpdate(BaseModel):
    gender: Optional[str] = None
    SeniorCitizen: Optional[str] = None
    Partner: Optional[str] = None
    Dependents: Optional[str] = None
    tenure: Optional[int] = None
    PhoneService: Optional[str] = None
    MultipleLines: Optional[str] = None
    InternetService: Optional[str] = None
    OnlineSecurity: Optional[str] = None
    OnlineBackup: Optional[str] = None
    DeviceProtection: Optional[str] = None
    TechSupport: Optional[str] = None
    StreamingTV: Optional[str] = None
    StreamingMovies: Optional[str] = None
    Contract: Optional[str] = None
    PaperlessBilling: Optional[str] = None
    PaymentMethod: Optional[str] = None
    MonthlyCharges: Optional[float] = None
    TotalCharges: Optional[float] = None
    Churn: Optional[str] = None


# ---------- Helper: convert MongoDB's document into clean JSON ----------

def customer_helper(doc) -> dict:
    return {
        "id":                 str(doc["_id"]),
        "name":               doc.get("name"),
        "email":              doc.get("email"),
        "phone":              doc.get("phone"),
        "age":                doc.get("age"),
        "gender":             doc.get("gender"),
        "location":           doc.get("location"),
        "subscription_type":  doc.get("subscription_type"),
        "monthly_charges":    doc.get("monthly_charges"),
        "total_charges":      doc.get("total_charges"),
        "tenure":             doc.get("tenure"),
        "contract_type":      doc.get("contract_type"),
        "payment_method":     doc.get("payment_method"),
        "internet_service":   doc.get("internet_service"),
        "tech_support":       doc.get("tech_support"),
        "online_security":    doc.get("online_security"),
        "streaming_services": doc.get("streaming_services"),
        "is_active":          doc.get("is_active"),
        "churn_status":       doc.get("churn_status"),
    }


@app.get("/")
def home():
    return {"message": "Welcome to ChurnGuard"}


# ---------- Phase 1: Basic APIs ----------

@app.get("/about")
def about():
    return {
        "project": "ChurnGuard",
        "description": "AI-powered customer churn prediction and retention system",
        "author": "ChurnGuard AI Engineering Team",
        "tech_stack": {
            "backend": "FastAPI",
            "frontend": "React",
            "database": "MongoDB",
            "ml": "Scikit-learn, XGBoost, LightGBM"
        }
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "ChurnGuard Backend",
        "message": "API is up and running"
    }


@app.get("/version")
def version():
    return {
        "api_version": "1.0.0",
        "sprint": "Sprint 3 - Authentication (Complete)"
    }


@app.get("/status")
async def status():
    try:
        await customer_collection.find_one()
        db_status = "connected"
    except Exception:
        db_status = "error"
    return {
        "backend": "online",
        "database": db_status,
        "ml_model": "loaded"
    }


@app.get("/db-health")
async def db_health():
    try:
        await customer_collection.find_one()
        return {"database": "connected", "message": "MongoDB Atlas is reachable"}
    except Exception as e:
        return {"database": "error", "details": str(e)}


# ---------- Phase 2: Path Parameters ----------

@app.get("/customer/{customer_id}")
def get_customer(customer_id: int):
    return {
        "customer_id": customer_id,
        "message": f"Fetched details for customer #{customer_id}"
    }


@app.get("/customer/{customer_id}/status")
def get_customer_status(customer_id: int):
    return {
        "customer_id": customer_id,
        "churn_risk": "unknown",
        "note": "This will be replaced with a real prediction in Sprint 5"
    }


@app.get("/plan/{plan_name}/customer/{customer_id}")
def get_plan_customer(plan_name: str, customer_id: int):
    return {
        "plan": plan_name,
        "customer_id": customer_id,
        "message": f"Customer {customer_id} is on the {plan_name} plan"
    }


# ---------- Phase 3: Query Parameters ----------

@app.get("/customers/search")
def search_customers(name: str = None, min_spend: float = None):
    return {
        "search_name": name,
        "min_spend": min_spend,
        "message": "Searching customers with the given filters"
    }


# ---------- Full CRUD APIs — using real MongoDB Atlas — ALL PROTECTED ----------

@app.post("/customers", response_model=CustomerResponse)
async def create_customer(customer: Customer, user_doc: dict = Depends(get_current_user_doc)):
    t0 = time.perf_counter()
    new_customer = customer.dict()
    new_customer["company_id"]   = user_doc["company_id"]
    new_customer["uploaded_by"]  = user_doc["email"]
    new_customer["created_at"]   = datetime.now(timezone.utc).isoformat()
    result = await customer_collection.insert_one(new_customer)
    print(f"[create_customer] insert_one: {(time.perf_counter()-t0)*1000:.1f}ms | id={result.inserted_id}")
    return CustomerResponse(
        name=customer.name,
        email=customer.email,
        subscription_type=customer.subscription_type,
        is_active=customer.is_active,
        welcome_message=f"Welcome aboard, {customer.name}! Your ID is {result.inserted_id}."
    )


@app.get("/customers/all")
async def get_all_customers(user_doc: dict = Depends(get_current_user_doc)):
    t0 = time.perf_counter()
    customers = []
    async for doc in customer_collection.find({"company_id": user_doc["company_id"]}):
        customers.append(customer_helper(doc))
    print(f"[get_all_customers] {len(customers)} docs in {(time.perf_counter()-t0)*1000:.1f}ms")
    return customers


@app.get("/customers/{customer_id}")
async def get_one_customer(customer_id: str, user_doc: dict = Depends(get_current_user_doc)):
    if not ObjectId.is_valid(customer_id):
        raise HTTPException(status_code=400, detail="Invalid customer ID format")

    doc = await customer_collection.find_one({
        "_id": ObjectId(customer_id),
        "company_id": user_doc["company_id"]
    })
    if doc is None:
        raise HTTPException(status_code=404, detail=f"No customer found with ID {customer_id}")
    return customer_helper(doc)


@app.put("/customers/{customer_id}")
async def update_customer(
    customer_id: str,
    customer: Customer,
    user_doc: dict = Depends(get_current_user_doc)
):
    if not ObjectId.is_valid(customer_id):
        raise HTTPException(status_code=400, detail="Invalid customer ID format")

    result = await customer_collection.update_one(
        {"_id": ObjectId(customer_id), "company_id": user_doc["company_id"]},
        {"$set": customer.dict()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"No customer found with ID {customer_id}")

    updated_doc = await customer_collection.find_one({
        "_id": ObjectId(customer_id),
        "company_id": user_doc["company_id"]
    })
    return {
        "message": f"Customer {customer_id} updated successfully",
        "customer": customer_helper(updated_doc)
    }


@app.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, user_doc: dict = Depends(get_current_user_doc)):
    if not ObjectId.is_valid(customer_id):
        raise HTTPException(status_code=400, detail="Invalid customer ID format")

    doc = await customer_collection.find_one({
        "_id": ObjectId(customer_id),
        "company_id": user_doc["company_id"]
    })
    if doc is None:
        raise HTTPException(status_code=404, detail=f"No customer found with ID {customer_id}")

    await customer_collection.delete_one({
        "_id": ObjectId(customer_id),
        "company_id": user_doc["company_id"]
    })
    return {
        "message": f"Customer {customer_id} deleted successfully",
        "deleted_customer": customer_helper(doc),
        "deleted_by": user_doc["email"]
    }


class UserProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    company: Optional[str] = None
    company_type: Optional[str] = None
    industry: Optional[str] = None
    department: Optional[str] = None
    company_size: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    language: Optional[str] = None

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class PasswordOtpRequest(BaseModel):
    current_password: Optional[str] = None
    currentPassword: Optional[str] = None
    new_password: Optional[str] = None
    newPassword: Optional[str] = None
    confirm_password: Optional[str] = None
    confirmPassword: Optional[str] = None

    def get_current_password(self) -> str:
        return (self.current_password if self.current_password is not None else (self.currentPassword or "")).strip()

    def get_new_password(self) -> str:
        return (self.new_password if self.new_password is not None else (self.newPassword or "")).strip()

    def get_confirm_password(self) -> str:
        return (self.confirm_password if self.confirm_password is not None else (self.confirmPassword or "")).strip()

class PasswordOtpVerify(BaseModel):
    otp: str
    new_password: Optional[str] = None
    newPassword: Optional[str] = None
    current_password: Optional[str] = None
    currentPassword: Optional[str] = None

    def get_otp(self) -> str:
        return (self.otp or "").strip()

    def get_new_password(self) -> str:
        return (self.new_password if self.new_password is not None else (self.newPassword or "")).strip()

    def get_current_password(self) -> str:
        return (self.current_password if self.current_password is not None else (self.currentPassword or "")).strip()


# ---------- Phase 1: Authentication & Profile ----------

@app.post("/register")
async def register_user(user: RegisterUser):
    norm_email = user.email.strip().lower()
    existing = await user_collection.find_one({"email": norm_email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    company_name = user.company.strip()
    company_id   = get_company_id_for_name(company_name, norm_email)
    hashed_pw    = hash_password(user.password)

    await user_collection.insert_one({
        "email":        norm_email,
        "password":     hashed_pw,
        "first_name":   user.first_name.strip(),
        "last_name":    user.last_name.strip(),
        "company":      company_name,
        "company_type": (user.company_type or "Private Limited").strip(),
        "industry":     (user.industry or "Information Technology").strip(),
        "department":   (user.department or "Analytics").strip(),
        "company_size": (user.company_size or "11–50").strip(),
        "company_id":   company_id,
        "role":         user.role.strip() or "Analyst",
        "phone":        user.phone.strip(),
        "country":      user.country.strip() or "India",
        "language":     "en",
        "photo_url":    None,
        "created_at":   datetime.now(timezone.utc).isoformat()
    })
    return {"message": f"User {norm_email} registered successfully", "company_id": company_id}


@app.post("/login")
async def login_user(user: User):
    norm_email = user.email.strip().lower()
    existing = await user_collection.find_one({"email": norm_email})
    if not existing:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(user.password, existing["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    company_id = existing.get("company_id")
    if not company_id:
        company_id = get_company_id_for_name(existing.get("company", ""), existing.get("email", ""))
        await user_collection.update_one({"_id": existing["_id"]}, {"$set": {"company_id": company_id}})

    token = create_access_token({"sub": norm_email, "company_id": company_id})
    return {"access_token": token, "token_type": "bearer", "company_id": company_id}


@app.get("/profile/me")
async def get_user_profile(user_doc: dict = Depends(get_current_user_doc)):
    # Explicitly query scoped by _id and company_id, omitting password
    doc = await user_collection.find_one(
        {"_id": user_doc["_id"], "company_id": user_doc["company_id"]},
        {"password": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="User profile not found")

    return {
        "first_name":   doc.get("first_name", ""),
        "last_name":    doc.get("last_name",  ""),
        "email":        doc.get("email",       ""),
        "role":         doc.get("role",        "Analyst"),
        "company":      doc.get("company",     ""),
        "company_type": doc.get("company_type", "Private Limited"),
        "industry":     doc.get("industry",     "Information Technology"),
        "department":   doc.get("department",   "Analytics"),
        "company_size": doc.get("company_size", "11–50"),
        "company_id":   doc.get("company_id",  ""),
        "phone":        doc.get("phone",       ""),
        "country":      doc.get("country",     "India"),
        "language":     doc.get("language",    "en"),
        "photo_url":    doc.get("photo_url",   None)
    }


@app.put("/profile/me")
async def update_user_profile(
    profile_data: UserProfileUpdate,
    user_doc: dict = Depends(get_current_user_doc)
):
    update_fields = {k: v for k, v in profile_data.dict(exclude_unset=True).items() if v is not None}

    # Server-side validation
    if "first_name" in update_fields:
        fn = update_fields["first_name"].strip()
        if not re.match(r"^[a-zA-Z\s'-]{2,50}$", fn):
            raise HTTPException(status_code=400, detail="First name can contain letters only (2–50 characters)")
        update_fields["first_name"] = fn

    if "last_name" in update_fields:
        ln = update_fields["last_name"].strip()
        if ln and not re.match(r"^[a-zA-Z\s'-]{1,50}$", ln):
            raise HTTPException(status_code=400, detail="Last name can contain letters only")
        update_fields["last_name"] = ln

    if "phone" in update_fields:
        ph = re.sub(r"\D", "", update_fields["phone"].strip())
        if ph and not re.match(r"^[6-9][0-9]{9}$", ph):
            raise HTTPException(status_code=400, detail="Phone number must be exactly 10 digits starting with 6, 7, 8, or 9")
        update_fields["phone"] = ph

    if "company" in update_fields and update_fields["company"].strip():
        new_company = update_fields["company"].strip()
        update_fields["company"] = new_company

    if update_fields:
        await user_collection.update_one(
            {"_id": user_doc["_id"], "company_id": user_doc["company_id"]},
            {"$set": update_fields}
        )

    updated_doc = await user_collection.find_one(
        {"_id": user_doc["_id"], "company_id": user_doc["company_id"]},
        {"password": 0}
    )
    return {
        "message": "Profile updated successfully",
        "profile": {
            "first_name":   updated_doc.get("first_name", ""),
            "last_name":    updated_doc.get("last_name",  ""),
            "email":        updated_doc.get("email",       ""),
            "role":         updated_doc.get("role",        "Analyst"),
            "company":      updated_doc.get("company",     ""),
            "company_type": updated_doc.get("company_type", "Private Limited"),
            "industry":     updated_doc.get("industry",     "Information Technology"),
            "department":   updated_doc.get("department",   "Analytics"),
            "company_size": updated_doc.get("company_size", "11–50"),
            "company_id":   updated_doc.get("company_id",  ""),
            "phone":        updated_doc.get("phone",       ""),
            "country":      updated_doc.get("country",     "India"),
            "language":     updated_doc.get("language",    "en"),
            "photo_url":    updated_doc.get("photo_url",   None)
        }
    }


@app.post("/profile/photo")
async def upload_profile_photo(
    file: UploadFile = File(...),
    user_doc: dict = Depends(get_current_user_doc)
):
    allowed_mimes = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_mimes:
        raise HTTPException(
            status_code=400,
            detail="Please upload a JPG, PNG, or WEBP image under 5 MB."
        )

    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="Please upload a JPG, PNG, or WEBP image under 5 MB."
        )

    ext_map = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
    ext = ext_map.get(file.content_type, ".jpg")
    filename = f"avatar_{str(user_doc['_id'])}_{int(time.time())}{ext}"
    filepath = os.path.join(AVATAR_DIR, filename)

    # Remove old avatar file if present
    current_doc = await user_collection.find_one({"_id": user_doc["_id"]})
    old_url = current_doc.get("photo_url") if current_doc else None
    if old_url and old_url.startswith("/uploads/avatars/"):
        old_filename = os.path.basename(old_url)
        old_path = os.path.join(AVATAR_DIR, old_filename)
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except Exception:
                pass

    with open(filepath, "wb") as f:
        f.write(contents)

    photo_url = f"/uploads/avatars/{filename}"
    await user_collection.update_one(
        {"_id": user_doc["_id"], "company_id": user_doc["company_id"]},
        {"$set": {"photo_url": photo_url}}
    )

    return {
        "message": "Profile photo updated successfully",
        "photo_url": photo_url
    }


@app.delete("/profile/photo")
async def delete_profile_photo(user_doc: dict = Depends(get_current_user_doc)):
    current_doc = await user_collection.find_one({
        "_id": user_doc["_id"],
        "company_id": user_doc["company_id"]
    })
    if current_doc and current_doc.get("photo_url"):
        old_url = current_doc["photo_url"]
        if old_url.startswith("/uploads/avatars/"):
            old_filename = os.path.basename(old_url)
            old_path = os.path.join(AVATAR_DIR, old_filename)
            if os.path.exists(old_path):
                try:
                    os.remove(old_path)
                except Exception:
                    pass

    await user_collection.update_one(
        {"_id": user_doc["_id"], "company_id": user_doc["company_id"]},
        {"$unset": {"photo_url": ""}}
    )
    return {"message": "Profile photo removed successfully"}


# ---------- Password & Security OTP Flow (Multi-Tenant & JWT Scoped) ----------

async def _handle_request_password_otp(req: PasswordOtpRequest, user_doc: dict):
    curr_pw = req.get_current_password()
    new_pw = req.get_new_password()
    conf_pw = req.get_confirm_password()

    if not curr_pw:
        raise HTTPException(status_code=400, detail="Current password is required.")

    # 1. Verify current password matches user record
    current_user = await user_collection.find_one({
        "_id": user_doc["_id"],
        "company_id": user_doc["company_id"]
    })
    if not current_user or not verify_password(curr_pw, current_user.get("password", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    # 2. Check new password complexity
    if not new_pw:
        raise HTTPException(status_code=400, detail="New password is required.")

    if len(new_pw) < 8 or len(new_pw) > 72 or not re.search(r"[A-Z]", new_pw) or not re.search(r"[a-z]", new_pw) or not re.search(r"[0-9]", new_pw):
        raise HTTPException(status_code=400, detail="New password does not meet complexity requirements.")

    if conf_pw and conf_pw != new_pw:
        raise HTTPException(status_code=400, detail="New passwords do not match.")

    # 3. Rate limiting: 1 request per 60 seconds per user
    now = datetime.now(timezone.utc)
    latest_otp = await otp_collection.find_one(
        {"user_id": user_doc["_id"], "purpose": "password_change"},
        sort=[("created_at", -1)]
    )
    if latest_otp and latest_otp.get("created_at"):
        created_at = latest_otp["created_at"]
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        elapsed = (now - created_at).total_seconds()
        if elapsed < 60:
            remaining = max(1, int(math.ceil(60 - elapsed)))
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {remaining} seconds before requesting a new verification code."
            )

    # 4. Generate 6-digit secure numeric OTP & compute bcrypt hash
    otp_code = f"{secrets.randbelow(900000) + 100000}"
    hashed_otp = hash_password(otp_code)
    expires_at = now + timedelta(minutes=10)

    # Invalidate previous OTPs for this user and purpose
    await otp_collection.delete_many({
        "user_id": user_doc["_id"],
        "purpose": "password_change"
    })

    # Store OTP in MongoDB
    await otp_collection.insert_one({
        "user_id": user_doc["_id"],
        "company_id": user_doc["company_id"],
        "email": user_doc["email"],
        "otp_hash": hashed_otp,
        "purpose": "password_change",
        "expires_at": expires_at,
        "created_at": now,
        "attempts": 0,
        "max_attempts": 5
    })

    # 5. Dispatch OTP email
    send_otp_email(
        to_email=user_doc["email"],
        otp_code=otp_code,
        first_name=user_doc.get("first_name")
    )

    return {
        "success": True,
        "message": "Verification code sent to your email.",
        "masked_email": mask_email(user_doc["email"])
    }


async def _handle_verify_password_otp(req: PasswordOtpVerify, user_doc: dict):
    clean_otp = req.get_otp()
    new_pw = req.get_new_password()
    curr_pw = req.get_current_password()

    if not clean_otp or not re.match(r"^\d{6}$", clean_otp):
        raise HTTPException(status_code=400, detail="Please enter a valid 6-digit verification code.")

    if not new_pw:
        raise HTTPException(status_code=400, detail="New password is required.")

    if len(new_pw) < 8 or len(new_pw) > 72 or not re.search(r"[A-Z]", new_pw) or not re.search(r"[a-z]", new_pw) or not re.search(r"[0-9]", new_pw):
        raise HTTPException(status_code=400, detail="New password does not meet complexity requirements.")

    # 1. Fetch OTP document scoped strictly by user_id and company_id
    otp_doc = await otp_collection.find_one({
        "user_id": user_doc["_id"],
        "company_id": user_doc["company_id"],
        "purpose": "password_change"
    })
    if not otp_doc:
        raise HTTPException(status_code=400, detail="No pending verification code found. Please request a new code.")

    now = datetime.now(timezone.utc)
    expires_at = otp_doc.get("expires_at")
    if expires_at:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < now:
            await otp_collection.delete_one({"_id": otp_doc["_id"]})
            raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new code.")

    current_attempts = otp_doc.get("attempts", 0)
    max_attempts = otp_doc.get("max_attempts", 5)

    if current_attempts >= max_attempts:
        await otp_collection.delete_one({"_id": otp_doc["_id"]})
        raise HTTPException(status_code=400, detail="Maximum verification attempts exceeded. Please request a new code.")

    # 2. Check OTP hash
    if not verify_password(clean_otp, otp_doc.get("otp_hash", "")):
        new_attempts = current_attempts + 1
        if new_attempts >= max_attempts:
            await otp_collection.delete_one({"_id": otp_doc["_id"]})
            raise HTTPException(
                status_code=400,
                detail="Invalid verification code. Maximum attempts reached. Please request a new code."
            )
        else:
            remaining = max_attempts - new_attempts
            await otp_collection.update_one(
                {"_id": otp_doc["_id"]},
                {"$set": {"attempts": new_attempts}}
            )
            raise HTTPException(
                status_code=400,
                detail=f"Invalid verification code. {remaining} attempt(s) remaining."
            )

    # 3. Current password re-check if provided
    if curr_pw:
        current_user = await user_collection.find_one({
            "_id": user_doc["_id"],
            "company_id": user_doc["company_id"]
        })
        if not current_user or not verify_password(curr_pw, current_user.get("password", "")):
            raise HTTPException(status_code=400, detail="Current password is incorrect.")

    # 4. Hash new password and update user record scoped strictly by _id and company_id
    hashed_new_pw = hash_password(new_pw)
    await user_collection.update_one(
        {"_id": user_doc["_id"], "company_id": user_doc["company_id"]},
        {"$set": {"password": hashed_new_pw, "updated_at": now.isoformat()}}
    )

    # 5. Purge the used OTP code
    await otp_collection.delete_one({"_id": otp_doc["_id"]})

    return {
        "success": True,
        "message": "Password updated successfully."
    }


@app.post("/api/settings/password/request-otp")
@app.post("/settings/password/request-otp")
@app.post("/api/auth/password/request-otp")
@app.post("/profile/password/request-otp")
async def request_password_otp_endpoint(
    req: PasswordOtpRequest,
    user_doc: dict = Depends(get_current_user_doc)
):
    return await _handle_request_password_otp(req, user_doc)


@app.post("/api/settings/password/verify-otp")
@app.post("/settings/password/verify-otp")
@app.post("/api/auth/password/verify-otp")
@app.post("/profile/password/verify-otp")
async def verify_password_otp_endpoint(
    req: PasswordOtpVerify,
    user_doc: dict = Depends(get_current_user_doc)
):
    return await _handle_verify_password_otp(req, user_doc)


@app.put("/profile/password")
async def change_password(
    req: PasswordChangeRequest,
    user_doc: dict = Depends(get_current_user_doc)
):
    current_user = await user_collection.find_one({
        "_id": user_doc["_id"],
        "company_id": user_doc["company_id"]
    })
    if not current_user or not verify_password(req.current_password, current_user.get("password", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    new_pw = req.new_password
    if len(new_pw) < 8 or len(new_pw) > 72 or not re.search(r"[A-Z]", new_pw) or not re.search(r"[a-z]", new_pw) or not re.search(r"[0-9]", new_pw):
        raise HTTPException(status_code=400, detail="New password does not meet complexity requirements")

    hashed = hash_password(new_pw)
    await user_collection.update_one(
        {"_id": user_doc["_id"], "company_id": user_doc["company_id"]},
        {"$set": {"password": hashed}}
    )
    return {"message": "Password updated successfully"}



# ---------- Notifications Engine (Multi-Tenant) ----------

async def _ensure_user_notifications(user_id_str: str, company_id: str):
    count = await notification_collection.count_documents({
        "user_id": user_id_str,
        "company_id": company_id
    })
    if count == 0:
        sample_notifs = [
            {
                "user_id": user_id_str,
                "company_id": company_id,
                "title": "Welcome to ChurnGuard",
                "message": "Your enterprise tenant workspace has been initialized with AI telemetry scoring.",
                "type": "success",
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "user_id": user_id_str,
                "company_id": company_id,
                "title": "⚡ Batch Prediction Engine Active",
                "message": "High-risk customer segment detection model is ready for real-time inference.",
                "type": "info",
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "user_id": user_id_str,
                "company_id": company_id,
                "title": "🚨 High Risk Churn Alert: Enterprise",
                "message": "Customer churn probability threshold exceeded (84% probability detected).",
                "type": "alert",
                "read": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        ]
        await notification_collection.insert_many(sample_notifs)


@app.get("/notifications")
async def get_notifications(user_doc: dict = Depends(get_current_user_doc)):
    uid_str = str(user_doc["_id"])
    cid = user_doc["company_id"]
    await _ensure_user_notifications(uid_str, cid)

    cursor = notification_collection.find(
        {"user_id": uid_str, "company_id": cid}
    ).sort("created_at", -1)
    raw_notifs = await cursor.to_list(length=100)

    unread_count = sum(1 for n in raw_notifs if not n.get("read", False))
    formatted = [
        {
            "id": str(n["_id"]),
            "title": n.get("title", ""),
            "message": n.get("message", ""),
            "type": n.get("type", "info"),
            "read": bool(n.get("read", False)),
            "created_at": n.get("created_at", "")
        }
        for n in raw_notifs
    ]
    return {"notifications": formatted, "unread_count": unread_count}


@app.patch("/notifications/mark-read")
async def mark_all_notifications_read(user_doc: dict = Depends(get_current_user_doc)):
    uid_str = str(user_doc["_id"])
    cid = user_doc["company_id"]
    await notification_collection.update_many(
        {"user_id": uid_str, "company_id": cid, "read": False},
        {"$set": {"read": True}}
    )
    return {"message": "All notifications marked as read"}


@app.patch("/notifications/{notification_id}/read")
async def mark_single_notification_read(
    notification_id: str,
    user_doc: dict = Depends(get_current_user_doc)
):
    uid_str = str(user_doc["_id"])
    cid = user_doc["company_id"]
    try:
        obj_id = ObjectId(notification_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid notification ID format")

    res = await notification_collection.update_one(
        {"_id": obj_id, "user_id": uid_str, "company_id": cid},
        {"$set": {"read": True}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification marked as read"}


@app.delete("/notifications")
async def clear_all_notifications(user_doc: dict = Depends(get_current_user_doc)):
    uid_str = str(user_doc["_id"])
    cid = user_doc["company_id"]
    await notification_collection.delete_many({
        "user_id": uid_str,
        "company_id": cid
    })
    return {"message": "All notifications cleared"}


# ---------- Sprint 4: Dataset Upload ----------

@app.post("/dataset/upload")
async def upload_dataset(file: UploadFile = File(...), user_doc: dict = Depends(get_current_user_doc)):
    contents = await file.read()
    df = pd.read_csv(io.BytesIO(contents))

    return {
        "filename":     file.filename,
        "rows":         len(df),
        "columns":      len(df.columns),
        "column_names": list(df.columns),
        "preview":      df.head(3).to_dict(orient="records")
    }

@app.post("/dataset/inspect")
async def inspect_dataset(file: UploadFile = File(...), user_doc: dict = Depends(get_current_user_doc)):
    contents = await file.read()
    df = pd.read_csv(io.BytesIO(contents))

    dtypes         = {col: str(dtype) for col, dtype in df.dtypes.items()}
    missing_values = df.isnull().sum().to_dict()
    numeric_summary = df.describe(include="number").to_dict()

    return {
        "filename":                 file.filename,
        "total_rows":               len(df),
        "total_columns":            len(df.columns),
        "data_types":               dtypes,
        "missing_values_per_column": missing_values,
        "numeric_column_summary":   numeric_summary
    }

REQUIRED_COLUMNS = [
    "customerID", "gender", "SeniorCitizen", "tenure",
    "MonthlyCharges", "TotalCharges", "Churn"
]


@app.post("/dataset/validate")
async def validate_dataset(file: UploadFile = File(...), user_doc: dict = Depends(get_current_user_doc)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are allowed")

    contents = await file.read()
    df = pd.read_csv(io.BytesIO(contents))

    if len(df) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty")

    missing_columns = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing_columns:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns: {missing_columns}"
        )

    return {
        "filename": file.filename,
        "valid":    True,
        "message":  "File passed all validation checks",
        "rows":     len(df),
        "columns":  len(df.columns)
    }

@app.post("/dataset/clean")
async def clean_dataset(file: UploadFile = File(...), user_doc: dict = Depends(get_current_user_doc)):
    contents = await file.read()
    df = pd.read_csv(io.BytesIO(contents))

    blank_mask  = df["TotalCharges"].str.strip() == ""
    blank_count = int(blank_mask.sum())

    df["TotalCharges"]  = pd.to_numeric(df["TotalCharges"], errors="coerce").fillna(0)
    df["SeniorCitizen"] = df["SeniorCitizen"].map({0: "No", 1: "Yes"})

    duplicates_removed = int(df.duplicated().sum())
    df = df.drop_duplicates()

    return {
        "filename":                              file.filename,
        "rows_after_cleaning":                   len(df),
        "blank_total_charges_found_and_fixed":   blank_count,
        "duplicate_rows_removed":                duplicates_removed,
        "total_charges_dtype_after_cleaning":    str(df["TotalCharges"].dtype),
        "senior_citizen_sample":                 df["SeniorCitizen"].head(5).tolist(),
        "preview":                               df.head(3).to_dict(orient="records")
    }

@app.post("/dataset/store")
async def store_dataset(file: UploadFile = File(...), user_doc: dict = Depends(get_current_user_doc)):
    t_total = time.perf_counter()
    company_id   = user_doc["company_id"]
    user_id      = str(user_doc.get("_id", ""))
    current_user = user_doc.get("email", "")

    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV file: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail="Uploaded CSV file contains no records.")

    total_rows = len(df)

    # ── Clean / normalise ──
    if "TotalCharges" in df.columns:
        df["TotalCharges"] = pd.to_numeric(df["TotalCharges"], errors="coerce").fillna(0)

    if "SeniorCitizen" in df.columns:
        df["SeniorCitizen"] = df["SeniorCitizen"].replace({
            0: "No", 1: "Yes", "0": "No", "1": "Yes", 0.0: "No", 1.0: "Yes"
        })

    df = df.drop_duplicates()
    df = df.fillna("")

    records = df.to_dict(orient="records")
    if not records:
        raise HTTPException(status_code=400, detail="No valid records found in CSV file after cleaning.")

    # ── Fetch existing customerIDs for THIS company only ──
    t_ids = time.perf_counter()
    existing_ids: set[str] = set()
    async for doc in telco_collection.find(
        {"company_id": company_id},
        {"customerID": 1, "_id": 0}
    ):
        cid = doc.get("customerID")
        if cid:
            existing_ids.add(str(cid).strip())
    print(f"[store_dataset] existing ID fetch: {(time.perf_counter()-t_ids)*1000:.1f}ms ({len(existing_ids)} ids)")

    # ── Separate new vs duplicate records ──
    inserted_count  = 0
    duplicate_count = 0
    new_records     = []
    now_iso         = datetime.now(timezone.utc).isoformat()

    if "customerID" in df.columns:
        for rec in records:
            cid = str(rec.get("customerID", "")).strip()
            if cid and cid in existing_ids:
                duplicate_count += 1
            else:
                rec["company_id"]   = company_id
                rec["created_at"]   = now_iso
                rec["uploaded_by"]  = current_user
                new_records.append(rec)
                if cid:
                    existing_ids.add(cid)
    else:
        for idx, rec in enumerate(records):
            rec["company_id"]  = company_id
            rec["customerID"]  = f"CUS-{idx + 1}"
            rec["created_at"]  = now_iso
            rec["uploaded_by"] = current_user
            new_records.append(rec)

    # ── Bulk insert (insert_many is already correct) ──
    if new_records:
        t_insert = time.perf_counter()
        try:
            insert_result = await telco_collection.insert_many(new_records, ordered=False)
            inserted_count = len(insert_result.inserted_ids)
        except Exception as e:
            print("MongoDB insert exception:", e)
            if hasattr(e, "details") and isinstance(e.details, dict):
                inserted_count = e.details.get("nInserted", 0)
            else:
                raise HTTPException(
                    status_code=500,
                    detail="Dataset upload failed. No successful upload was recorded."
                )
        print(f"[store_dataset] insert_many {inserted_count} records: {(time.perf_counter()-t_insert)*1000:.1f}ms")

    # ── Count from DB (single count_documents — no full fetch needed) ──
    total_in_db = await telco_collection.count_documents({"company_id": company_id})

    # ── Record upload history ──
    await database["dataset_uploads"].insert_one({
        "company_id":        company_id,
        "user_id":           user_id,
        "filename":          file.filename,
        "uploaded_by":       current_user,
        "total_rows":        total_rows,
        "new_records":       inserted_count,
        "inserted_rows":     inserted_count,
        "duplicate_rows":    duplicate_count,
        "duplicates_skipped": duplicate_count,
        "total_in_db":       total_in_db,
        "final_total":       total_in_db,
        "created_at":        now_iso,
        "uploaded_at":       now_iso,
        "status":            "success"
    })

    # ── Auto-update dashboard cache using the NEW records already in memory ──
    # We use new_records (freshly added) + already know the full customer set via DB.
    # To avoid loading the entire collection again, run batch predict on new_records
    # and merge into existing cache if present; otherwise compute from the DB.
    try:
        t_cache = time.perf_counter()

        # Only re-run full batch if inserted anything
        if inserted_count > 0:
            # Load full set for correct aggregation (needed for plan_distribution etc.)
            # Use a projection to only fetch the fields needed for batch_predict
            projection = {
                "customerID": 1, "company_id": 1,
                "gender": 1, "SeniorCitizen": 1, "Partner": 1, "Dependents": 1,
                "tenure": 1, "PhoneService": 1, "MultipleLines": 1, "InternetService": 1,
                "OnlineSecurity": 1, "OnlineBackup": 1, "DeviceProtection": 1,
                "TechSupport": 1, "StreamingTV": 1, "StreamingMovies": 1,
                "Contract": 1, "PaperlessBilling": 1, "PaymentMethod": 1,
                "MonthlyCharges": 1, "TotalCharges": 1, "_id": 0
            }
            cursor = telco_collection.find({"company_id": company_id}, projection)
            all_docs = await cursor.to_list(length=None)
            clean_customers = [{k: v for k, v in c.items() if k != "company_id"} for c in all_docs]
            batch_results   = predict_batch(clean_customers)
            summary         = _build_dashboard_summary(company_id, batch_results, clean_customers)

            await database["dashboard_cache"].replace_one(
                {"company_id": company_id},
                summary,
                upsert=True
            )
            # Bust metrics cache so next /ml/metrics call is fresh
            invalidate_metrics_cache(company_id)

        print(f"[store_dataset] cache update: {(time.perf_counter()-t_cache)*1000:.1f}ms")
    except Exception as e:
        print("Error auto-updating dashboard cache:", e)

    print(f"[store_dataset] TOTAL: {(time.perf_counter()-t_total)*1000:.1f}ms | {total_rows} rows | {inserted_count} inserted")

    return {
        "success":              True,
        "filename":             file.filename,
        "message":              "Dataset stored successfully in MongoDB Atlas",
        "total_rows":           total_rows,
        "new_records":          inserted_count,
        "inserted":             inserted_count,
        "duplicates_skipped":   duplicate_count,
        "duplicate_rows":       duplicate_count,
        "total_in_db":          total_in_db,
        "final_customer_count": total_in_db,
        "rows_stored":          inserted_count
    }


@app.get("/dataset/info")
async def dataset_info(user_doc: dict = Depends(get_current_user_doc)):
    company_id = user_doc["company_id"]
    count = await telco_collection.count_documents({"company_id": company_id})
    if count == 0:
        return {"stored": False, "message": "No dataset currently stored"}

    sample = await telco_collection.find_one({"company_id": company_id})
    if sample:
        sample["_id"] = str(sample["_id"])

    return {
        "stored":        True,
        "total_records": count,
        "sample_record": sample
    }


@app.delete("/dataset/clear")
async def clear_dataset(user_doc: dict = Depends(get_current_user_doc)):
    company_id = user_doc["company_id"]
    result = await telco_collection.delete_many({"company_id": company_id})
    await database["dashboard_cache"].delete_many({"company_id": company_id})
    await database["dataset_uploads"].delete_many({"company_id": company_id})
    invalidate_metrics_cache(company_id)
    return {
        "message":          "Dataset cleared successfully",
        "records_deleted":  result.deleted_count
    }

@app.post("/predict/churn")
async def predict_customer_churn(
    customer: CustomerPredictionInput,
    user_doc: dict = Depends(get_current_user_doc)
):
    result = predict_churn(customer.dict())
    return result

@app.post("/predict/explain")
async def predict_with_explanation(
    customer: CustomerPredictionInput,
    user_doc: dict = Depends(get_current_user_doc)
):
    prediction_result   = predict_churn(customer.dict())
    explanation_result  = explain_prediction(customer.dict())
    return {**prediction_result, **explanation_result}

@app.post("/predict/full")
async def predict_full_analysis(
    customer: CustomerPredictionInput,
    user_doc: dict = Depends(get_current_user_doc)
):
    t0 = time.perf_counter()
    customer_dict = customer.dict()

    prediction_result    = predict_churn(customer_dict)
    explanation_result   = explain_prediction(customer_dict)
    recommendation_result = generate_recommendations(
        customer_dict,
        explanation_result["top_factors"],
        prediction_result["risk_level"]
    )
    print(f"[predict/full] {(time.perf_counter()-t0)*1000:.1f}ms | risk={prediction_result['risk_level']}")

    return {**prediction_result, **explanation_result, **recommendation_result}

@app.post("/predict/batch-all")
async def predict_all_customers(user_doc: dict = Depends(get_current_user_doc)):
    t0 = time.perf_counter()
    company_id = user_doc["company_id"]

    # ── Fetch with projection — only fields needed for prediction ──
    projection = {
        "customerID": 1, "company_id": 1,
        "gender": 1, "SeniorCitizen": 1, "Partner": 1, "Dependents": 1,
        "tenure": 1, "PhoneService": 1, "MultipleLines": 1, "InternetService": 1,
        "OnlineSecurity": 1, "OnlineBackup": 1, "DeviceProtection": 1,
        "TechSupport": 1, "StreamingTV": 1, "StreamingMovies": 1,
        "Contract": 1, "PaperlessBilling": 1, "PaymentMethod": 1,
        "MonthlyCharges": 1, "TotalCharges": 1, "_id": 0
    }

    t_db = time.perf_counter()
    cursor = telco_collection.find({"company_id": company_id}, projection)
    raw_customers = await cursor.to_list(length=None)
    print(f"[batch-all] DB fetch {len(raw_customers)} records: {(time.perf_counter()-t_db)*1000:.1f}ms")

    customers = [{k: v for k, v in c.items() if k != "company_id"} for c in raw_customers]

    if not customers:
        return {
            "available":        True,
            "total_analyzed":   0,
            "high_risk_count":  0,
            "medium_risk_count": 0,
            "low_risk_count":   0,
            "results":          [],
            "risk_by_contract": [],
            "risk_by_tenure":   [],
        }

    # ── Vectorized batch predict ──
    results    = predict_batch(customers)
    aggregates = build_aggregates(results)

    summary = _build_dashboard_summary(company_id, results, customers)
    summary["risk_by_contract"] = aggregates["risk_by_contract"]
    summary["risk_by_tenure"]   = aggregates["risk_by_tenure"]

    await database["dashboard_cache"].replace_one(
        {"company_id": company_id},
        summary,
        upsert=True
    )
    # Bust metrics cache so next /ml/metrics gets fresh data
    invalidate_metrics_cache(company_id)

    print(f"[batch-all] TOTAL: {(time.perf_counter()-t0)*1000:.1f}ms | {len(results)} results")
    return summary


@app.get("/dashboard/stats")
async def get_dashboard_stats(user_doc: dict = Depends(get_current_user_doc)):
    t0 = time.perf_counter()
    company_id = user_doc["company_id"]

    # ── Serve from cache when available ──
    cached = await database["dashboard_cache"].find_one({"company_id": company_id})
    if cached:
        clean = {k: v for k, v in cached.items() if k != "_id"}
        print(f"[dashboard/stats] cache HIT: {(time.perf_counter()-t0)*1000:.1f}ms")
        return {"available": True, **clean}

    count = await telco_collection.count_documents({"company_id": company_id})
    if count == 0:
        return {
            "available":         True,
            "total_analyzed":    0,
            "high_risk_count":   0,
            "medium_risk_count": 0,
            "low_risk_count":    0,
            "total_mrr":         0.0,
            "avg_churn_rate":    0.0,
            "plan_distribution": [],
            "results":           []
        }

    # ── Cold path: fetch with projection and run batch predict ──
    projection = {
        "customerID": 1, "company_id": 1,
        "gender": 1, "SeniorCitizen": 1, "Partner": 1, "Dependents": 1,
        "tenure": 1, "PhoneService": 1, "MultipleLines": 1, "InternetService": 1,
        "OnlineSecurity": 1, "OnlineBackup": 1, "DeviceProtection": 1,
        "TechSupport": 1, "StreamingTV": 1, "StreamingMovies": 1,
        "Contract": 1, "PaperlessBilling": 1, "PaymentMethod": 1,
        "MonthlyCharges": 1, "TotalCharges": 1, "_id": 0
    }
    cursor = telco_collection.find({"company_id": company_id}, projection)
    raw_customers = await cursor.to_list(length=None)
    clean_customers = [{k: v for k, v in c.items() if k != "company_id"} for c in raw_customers]

    batch_results = predict_batch(clean_customers)
    summary       = _build_dashboard_summary(company_id, batch_results, clean_customers)

    await database["dashboard_cache"].replace_one(
        {"company_id": company_id},
        summary,
        upsert=True
    )
    print(f"[dashboard/stats] cold compute: {(time.perf_counter()-t0)*1000:.1f}ms")
    return summary


@app.get("/uploads/history")
async def get_upload_history(limit: int = 10, user_doc: dict = Depends(get_current_user_doc)):
    company_id = user_doc["company_id"]
    cursor = (
        database["dataset_uploads"]
        .find({"company_id": company_id})
        .sort("uploaded_at", -1)
        .limit(limit)
    )
    history = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if "uploaded_at" in doc and hasattr(doc["uploaded_at"], "isoformat"):
            doc["uploaded_at"] = doc["uploaded_at"].isoformat()
        history.append(doc)
    return history


@app.get("/ml/metrics")
async def get_ml_metrics(user_doc: dict = Depends(get_current_user_doc)):
    t0 = time.perf_counter()
    company_id = user_doc["company_id"]
    count = await telco_collection.count_documents({"company_id": company_id})
    if count == 0:
        return {
            "accuracy": 0.0, "precision": 0.0, "recall": 0.0,
            "f1_score": 0.0, "auc": 0.0,
            "confusion_matrix": {
                "true_negative": 0, "false_positive": 0,
                "false_negative": 0, "true_positive": 0
            },
            "roc_curve":          [],
            "feature_importance": []
        }
    result = await compute_metrics(company_id=company_id)
    print(f"[ml/metrics] {(time.perf_counter()-t0)*1000:.1f}ms")
    return result


@app.get("/ml/segments")
async def get_ml_segments(user_doc: dict = Depends(get_current_user_doc)):
    company_id = user_doc["company_id"]
    count = await telco_collection.count_documents({"company_id": company_id})
    if count == 0:
        return []
    return await get_segment_profiles()


@app.get("/reports/export/csv")
async def export_reports_csv(
    risk_level: Optional[str] = "All",
    user_doc: dict = Depends(get_current_user_doc)
):
    t0 = time.perf_counter()
    company_id = user_doc["company_id"]

    # Use projection — only fetch prediction-relevant fields
    projection = {
        "customerID": 1, "company_id": 1,
        "gender": 1, "SeniorCitizen": 1, "Partner": 1, "Dependents": 1,
        "tenure": 1, "PhoneService": 1, "MultipleLines": 1, "InternetService": 1,
        "OnlineSecurity": 1, "OnlineBackup": 1, "DeviceProtection": 1,
        "TechSupport": 1, "StreamingTV": 1, "StreamingMovies": 1,
        "Contract": 1, "PaperlessBilling": 1, "PaymentMethod": 1,
        "MonthlyCharges": 1, "TotalCharges": 1, "_id": 0
    }
    cursor = telco_collection.find({"company_id": company_id}, projection)
    customers = await cursor.to_list(length=None)

    if not customers:
        raise HTTPException(
            status_code=404,
            detail="No customers found for your company. Upload a dataset first."
        )

    # Strip company_id before prediction
    clean = [{k: v for k, v in c.items() if k != "company_id"} for c in customers]
    results = predict_batch(clean)

    if risk_level != "All":
        results = [r for r in results if r["risk_level"] == risk_level]

    if not results:
        raise HTTPException(
            status_code=404,
            detail=f"No customers found matching risk level: {risk_level}"
        )

    df = pd.DataFrame(results)
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    print(f"[reports/csv] {len(results)} rows ({risk_level}): {(time.perf_counter()-t0)*1000:.1f}ms")

    response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=churndata_{risk_level.lower()}.csv"
    return response


# ---------- Telco Customers (CSV-uploaded dataset) — Paginated ----------

@app.get("/telco/customers")
async def get_telco_customers(
    page:   int = Query(default=1,  ge=1),
    limit:  int = Query(default=50, ge=1, le=200),
    search: str = Query(default=""),
    user_doc: dict = Depends(get_current_user_doc)
):
    t0 = time.perf_counter()
    company_id = user_doc["company_id"]
    query = {"company_id": company_id}
    if search:
        query["$or"] = [
            {"customerID":     {"$regex": search, "$options": "i"}},
            {"Contract":       {"$regex": search, "$options": "i"}},
            {"InternetService": {"$regex": search, "$options": "i"}},
        ]

    total  = await telco_collection.count_documents(query)
    skip   = (page - 1) * limit
    cursor = telco_collection.find(query).skip(skip).limit(limit)
    records = await cursor.to_list(length=limit)

    for r in records:
        r["_id"] = str(r["_id"])

    print(f"[telco/customers] page={page} limit={limit} search={search!r} total={total} fetched={len(records)} time={( time.perf_counter()-t0)*1000:.1f}ms")

    return {
        "total":       total,
        "page":        page,
        "limit":       limit,
        "total_pages": math.ceil(total / limit) if total > 0 else 1,
        "records":     records
    }


@app.post("/telco/customers")
async def create_telco_customer(
    customer: TelcoCustomerCreate,
    user_doc: dict = Depends(get_current_user_doc)
):
    t0 = time.perf_counter()
    company_id = user_doc["company_id"]
    customer_dict = customer.dict()

    # Generate clean customerID if not provided
    cid = (customer_dict.get("customerID") or "").strip()
    if not cid:
        count = await telco_collection.count_documents({"company_id": company_id})
        cid = f"CUS-{count + 1:04d}"
    customer_dict["customerID"] = cid
    customer_dict["company_id"] = company_id
    customer_dict["uploaded_by"] = user_doc.get("email", "")
    customer_dict["created_at"] = datetime.now(timezone.utc).isoformat()

    # Check if duplicate customerID for this tenant
    existing = await telco_collection.find_one({"company_id": company_id, "customerID": cid})
    if existing:
        raise HTTPException(status_code=400, detail=f"Customer with ID '{cid}' already exists.")

    result = await telco_collection.insert_one(customer_dict)
    customer_dict["_id"] = str(result.inserted_id)

    # Invalidate caches so dashboard and metrics stay fresh
    await database["dashboard_cache"].delete_many({"company_id": company_id})
    invalidate_metrics_cache(company_id)

    elapsed = (time.perf_counter() - t0) * 1000
    print(f"[add_telco_customer] insert_one: {elapsed:.1f}ms | customerID={cid}")

    return {
        "message": f"Customer '{cid}' created successfully",
        "customer": customer_dict
    }


@app.get("/telco/customers/{customer_id}")
async def get_single_telco_customer(customer_id: str, user_doc: dict = Depends(get_current_user_doc)):
    t0 = time.perf_counter()
    company_id = user_doc["company_id"]

    query = {"company_id": company_id, "customerID": customer_id}
    doc = await telco_collection.find_one(query)
    if not doc and ObjectId.is_valid(customer_id):
        doc = await telco_collection.find_one({"company_id": company_id, "_id": ObjectId(customer_id)})

    if not doc:
        raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found")

    doc["_id"] = str(doc["_id"])
    elapsed = (time.perf_counter() - t0) * 1000
    print(f"[get_telco_customer] find_one: {elapsed:.1f}ms | customerID={customer_id}")
    return doc


@app.put("/telco/customers/{customer_id}")
async def update_telco_customer(
    customer_id: str,
    customer_data: TelcoCustomerUpdate,
    user_doc: dict = Depends(get_current_user_doc)
):
    t0 = time.perf_counter()
    company_id = user_doc["company_id"]

    update_fields = {k: v for k, v in customer_data.dict(exclude_unset=True).items() if v is not None}
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    filter_query = {"company_id": company_id, "customerID": customer_id}
    result = await telco_collection.update_one(filter_query, {"$set": update_fields})

    if result.matched_count == 0 and ObjectId.is_valid(customer_id):
        filter_query = {"company_id": company_id, "_id": ObjectId(customer_id)}
        result = await telco_collection.update_one(filter_query, {"$set": update_fields})

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found")

    updated_doc = await telco_collection.find_one(filter_query)
    if updated_doc:
        updated_doc["_id"] = str(updated_doc["_id"])

    # Invalidate dashboard cache
    await database["dashboard_cache"].delete_many({"company_id": company_id})
    invalidate_metrics_cache(company_id)

    elapsed = (time.perf_counter() - t0) * 1000
    print(f"[update_telco_customer] update_one: {elapsed:.1f}ms | customerID={customer_id}")

    return {
        "message": f"Customer '{customer_id}' updated successfully",
        "customer": updated_doc
    }


@app.delete("/telco/customers/{customer_id}")
async def delete_telco_customer(customer_id: str, user_doc: dict = Depends(get_current_user_doc)):
    t0 = time.perf_counter()
    company_id = user_doc["company_id"]
    result = await telco_collection.delete_one({"company_id": company_id, "customerID": customer_id})

    if result.deleted_count == 0:
        if ObjectId.is_valid(customer_id):
            result = await telco_collection.delete_one({
                "company_id": company_id,
                "_id": ObjectId(customer_id)
            })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found")

    # Invalidate dashboard cache — counts are now stale
    await database["dashboard_cache"].delete_many({"company_id": company_id})
    invalidate_metrics_cache(company_id)

    print(f"[delete_telco] customer_id={customer_id!r}: {(time.perf_counter()-t0)*1000:.1f}ms")
    return {"message": f"Customer '{customer_id}' deleted successfully"}