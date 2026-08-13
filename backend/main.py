import os
import sys
import math
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
# pyrefly: ignore [missing-import]
from bson import ObjectId
import pandas as pd
import io
from datetime import datetime, timezone

from database import customer_collection, user_collection, telco_collection, database
from auth import hash_password, verify_password, create_access_token, get_current_user, get_current_user_doc, get_company_id_for_name

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from ml.predict import predict_churn
from ml.explain import explain_prediction
from ml.recommend import generate_recommendations
from typing import Literal, Optional
from fastapi.middleware.cors import CORSMiddleware
from ml.batch_predict import predict_batch
from ml.metrics import compute_metrics
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

@app.on_event("startup")
async def startup_event():
    """Ensure compound unique index on (company_id, customerID) in telco_collection."""
    try:
        await telco_collection.create_index(
            [("company_id", 1), ("customerID", 1)],
            unique=True,
            name="company_customer_id_unique",
            sparse=True
        )
        print("MongoDB compound unique index ensured: company_id + customerID")
    except Exception as e:
        print("MongoDB index creation notice:", e)

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
    phone: str = ""
    role: str = "Analyst"
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


# ---------- Helper: convert MongoDB's document into clean JSON ----------

def customer_helper(doc) -> dict:
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name"),
        "email": doc.get("email"),
        "phone": doc.get("phone"),
        "age": doc.get("age"),
        "gender": doc.get("gender"),
        "location": doc.get("location"),
        "subscription_type": doc.get("subscription_type"),
        "monthly_charges": doc.get("monthly_charges"),
        "total_charges": doc.get("total_charges"),
        "tenure": doc.get("tenure"),
        "contract_type": doc.get("contract_type"),
        "payment_method": doc.get("payment_method"),
        "internet_service": doc.get("internet_service"),
        "tech_support": doc.get("tech_support"),
        "online_security": doc.get("online_security"),
        "streaming_services": doc.get("streaming_services"),
        "is_active": doc.get("is_active"),
        "churn_status": doc.get("churn_status"),
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
        "author": "Hariom",
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
        "ml_model": "not loaded yet"
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
    new_customer = customer.dict()
    new_customer["company_id"] = user_doc["company_id"]
    new_customer["uploaded_by"] = user_doc["email"]
    result = await customer_collection.insert_one(new_customer)
    return CustomerResponse(
        name=customer.name,
        email=customer.email,
        subscription_type=customer.subscription_type,
        is_active=customer.is_active,
        welcome_message=f"Welcome aboard, {customer.name}! Your ID is {result.inserted_id}."
    )


@app.get("/customers/all")
async def get_all_customers(user_doc: dict = Depends(get_current_user_doc)):
    customers = []
    async for doc in customer_collection.find({"company_id": user_doc["company_id"]}):
        customers.append(customer_helper(doc))
    return customers


@app.get("/customers/{customer_id}")
async def get_one_customer(customer_id: str, user_doc: dict = Depends(get_current_user_doc)):
    if not ObjectId.is_valid(customer_id):
        raise HTTPException(status_code=400, detail="Invalid customer ID format")

    doc = await customer_collection.find_one({"_id": ObjectId(customer_id), "company_id": user_doc["company_id"]})
    if doc is None:
        raise HTTPException(status_code=404, detail=f"No customer found with ID {customer_id}")
    return customer_helper(doc)


@app.put("/customers/{customer_id}")
async def update_customer(customer_id: str, customer: Customer, user_doc: dict = Depends(get_current_user_doc)):
    if not ObjectId.is_valid(customer_id):
        raise HTTPException(status_code=400, detail="Invalid customer ID format")

    result = await customer_collection.update_one(
        {"_id": ObjectId(customer_id), "company_id": user_doc["company_id"]},
        {"$set": customer.dict()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"No customer found with ID {customer_id}")

    updated_doc = await customer_collection.find_one({"_id": ObjectId(customer_id), "company_id": user_doc["company_id"]})
    return {
        "message": f"Customer {customer_id} updated successfully",
        "customer": customer_helper(updated_doc)
    }


@app.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, user_doc: dict = Depends(get_current_user_doc)):
    if not ObjectId.is_valid(customer_id):
        raise HTTPException(status_code=400, detail="Invalid customer ID format")

    doc = await customer_collection.find_one({"_id": ObjectId(customer_id), "company_id": user_doc["company_id"]})
    if doc is None:
        raise HTTPException(status_code=404, detail=f"No customer found with ID {customer_id}")

    await customer_collection.delete_one({"_id": ObjectId(customer_id), "company_id": user_doc["company_id"]})
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
    phone: Optional[str] = None
    country: Optional[str] = None


# ---------- Phase 1: Authentication & Profile ----------

@app.post("/register")
async def register_user(user: RegisterUser):
    existing = await user_collection.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    company_name = user.company.strip()
    company_id = get_company_id_for_name(company_name, user.email)
    hashed_pw = hash_password(user.password)

    await user_collection.insert_one({
        "email": user.email,
        "password": hashed_pw,
        "first_name": user.first_name.strip(),
        "last_name": user.last_name.strip(),
        "company": company_name,
        "company_id": company_id,
        "role": user.role.strip() or "Analyst",
        "phone": user.phone.strip(),
        "country": user.country.strip() or "India",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"message": f"User {user.email} registered successfully", "company_id": company_id}


@app.post("/login")
async def login_user(user: User):
    existing = await user_collection.find_one({"email": user.email})
    if not existing:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(user.password, existing["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    company_id = existing.get("company_id")
    if not company_id:
        company_id = get_company_id_for_name(existing.get("company", ""), existing.get("email", ""))
        await user_collection.update_one({"_id": existing["_id"]}, {"$set": {"company_id": company_id}})

    token = create_access_token({"sub": user.email, "company_id": company_id})
    return {"access_token": token, "token_type": "bearer", "company_id": company_id}


@app.get("/profile/me")
async def get_user_profile(user_doc: dict = Depends(get_current_user_doc)):
    return {
        "first_name": user_doc.get("first_name", ""),
        "last_name": user_doc.get("last_name", ""),
        "email": user_doc.get("email", ""),
        "role": user_doc.get("role", "Analyst"),
        "company": user_doc.get("company", ""),
        "company_id": user_doc.get("company_id", ""),
        "phone": user_doc.get("phone", ""),
        "country": user_doc.get("country", "India")
    }


@app.put("/profile/me")
async def update_user_profile(profile_data: UserProfileUpdate, user_doc: dict = Depends(get_current_user_doc)):
    update_fields = {k: v for k, v in profile_data.dict(exclude_unset=True).items() if v is not None}

    if "company" in update_fields and update_fields["company"].strip():
        new_company = update_fields["company"].strip()
        update_fields["company_id"] = get_company_id_for_name(new_company, user_doc.get("email", ""))

    if update_fields:
        await user_collection.update_one(
            {"_id": user_doc["_id"]},
            {"$set": update_fields}
        )

    updated_doc = await user_collection.find_one({"_id": user_doc["_id"]})
    return {
        "message": "Profile updated successfully",
        "profile": {
            "first_name": updated_doc.get("first_name", ""),
            "last_name": updated_doc.get("last_name", ""),
            "email": updated_doc.get("email", ""),
            "role": updated_doc.get("role", "Analyst"),
            "company": updated_doc.get("company", ""),
            "company_id": updated_doc.get("company_id", ""),
            "phone": updated_doc.get("phone", ""),
            "country": updated_doc.get("country", "India")
        }
    }


# ---------- Sprint 4: Dataset Upload ----------

@app.post("/dataset/upload")
async def upload_dataset(file: UploadFile = File(...), user_doc: dict = Depends(get_current_user_doc)):
    contents = await file.read()
    df = pd.read_csv(io.BytesIO(contents))

    return {
        "filename": file.filename,
        "rows": len(df),
        "columns": len(df.columns),
        "column_names": list(df.columns),
        "preview": df.head(3).to_dict(orient="records")
    }

@app.post("/dataset/inspect")
async def inspect_dataset(file: UploadFile = File(...), user_doc: dict = Depends(get_current_user_doc)):
    contents = await file.read()
    df = pd.read_csv(io.BytesIO(contents))

    dtypes = {col: str(dtype) for col, dtype in df.dtypes.items()}
    missing_values = df.isnull().sum().to_dict()

    numeric_summary = df.describe(include="number").to_dict()

    return {
        "filename": file.filename,
        "total_rows": len(df),
        "total_columns": len(df.columns),
        "data_types": dtypes,
        "missing_values_per_column": missing_values,
        "numeric_column_summary": numeric_summary
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
        "valid": True,
        "message": "File passed all validation checks",
        "rows": len(df),
        "columns": len(df.columns)
    }

@app.post("/dataset/clean")
async def clean_dataset(file: UploadFile = File(...), user_doc: dict = Depends(get_current_user_doc)):
    contents = await file.read()
    df = pd.read_csv(io.BytesIO(contents))

    blank_mask = df["TotalCharges"].str.strip() == ""
    blank_count = int(blank_mask.sum())

    df["TotalCharges"] = pd.to_numeric(df["TotalCharges"], errors="coerce").fillna(0)
    df["SeniorCitizen"] = df["SeniorCitizen"].map({0: "No", 1: "Yes"})

    duplicates_removed = int(df.duplicated().sum())
    df = df.drop_duplicates()

    return {
        "filename": file.filename,
        "rows_after_cleaning": len(df),
        "blank_total_charges_found_and_fixed": blank_count,
        "duplicate_rows_removed": duplicates_removed,
        "total_charges_dtype_after_cleaning": str(df["TotalCharges"].dtype),
        "senior_citizen_sample": df["SeniorCitizen"].head(5).tolist(),
        "preview": df.head(3).to_dict(orient="records")
    }

@app.post("/dataset/store")
async def store_dataset(file: UploadFile = File(...), user_doc: dict = Depends(get_current_user_doc)):
    company_id = user_doc["company_id"]
    user_id = str(user_doc.get("_id", ""))
    current_user = user_doc.get("email", "")

    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV file: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail="Uploaded CSV file contains no records.")

    total_rows = len(df)

    if "TotalCharges" in df.columns:
        df["TotalCharges"] = pd.to_numeric(df["TotalCharges"], errors="coerce").fillna(0)

    if "SeniorCitizen" in df.columns:
        df["SeniorCitizen"] = df["SeniorCitizen"].replace({
            0: "No", 1: "Yes",
            "0": "No", "1": "Yes",
            0.0: "No", 1.0: "Yes"
        })

    df = df.drop_duplicates()
    df = df.fillna("")

    records = df.to_dict(orient="records")
    if not records:
        raise HTTPException(status_code=400, detail="No valid records found in CSV file after cleaning.")

    # ── Fetch existing customerIDs for THIS company ONLY from MongoDB Atlas ──
    existing_ids = set()
    async for doc in telco_collection.find(
        {"company_id": company_id},
        {"customerID": 1, "_id": 0}
    ):
        cid = doc.get("customerID")
        if cid:
            existing_ids.add(str(cid).strip())

    inserted_count = 0
    duplicate_count = 0
    new_records = []
    now_iso = datetime.now(timezone.utc).isoformat()

    if "customerID" in df.columns:
        for rec in records:
            cid = str(rec.get("customerID", "")).strip()
            if cid and cid in existing_ids:
                duplicate_count += 1
            else:
                rec["company_id"] = company_id
                rec["created_at"] = now_iso
                rec["uploaded_by"] = current_user
                new_records.append(rec)
                if cid:
                    existing_ids.add(cid)
    else:
        for idx, rec in enumerate(records):
            rec["company_id"] = company_id
            rec["customerID"] = f"CUS-{idx + 1}"
            rec["created_at"] = now_iso
            rec["uploaded_by"] = current_user
            new_records.append(rec)

    if new_records:
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

    # ── VERIFY DATABASE COUNT DIRECTLY FROM MONGODB ATLAS FOR THIS COMPANY ──
    total_in_db = await telco_collection.count_documents({"company_id": company_id})

    # ── STORE UPLOAD HISTORY FOR THIS COMPANY ONLY ──
    await database["dataset_uploads"].insert_one({
        "company_id": company_id,
        "user_id": user_id,
        "filename": file.filename,
        "uploaded_by": current_user,
        "total_rows": total_rows,
        "new_records": inserted_count,
        "inserted_rows": inserted_count,
        "duplicate_rows": duplicate_count,
        "duplicates_skipped": duplicate_count,
        "total_in_db": total_in_db,
        "final_total": total_in_db,
        "created_at": now_iso,
        "uploaded_at": now_iso,
        "status": "success"
    })

    # ── Auto-update dashboard cache for THIS company ONLY ──
    try:
        cursor = telco_collection.find({"company_id": company_id})
        all_docs = await cursor.to_list(length=None)
        clean_customers = [{k: v for k, v in c.items() if k != "_id"} for c in all_docs]
        batch_results = predict_batch(clean_customers)

        high = sum(1 for r in batch_results if r["risk_level"] == "High")
        medium = sum(1 for r in batch_results if r["risk_level"] == "Medium")
        low = sum(1 for r in batch_results if r["risk_level"] == "Low")

        total_mrr = sum(
            float(c.get("MonthlyCharges", 0))
            for c in clean_customers
            if str(c.get("MonthlyCharges", "")).replace('.', '', 1).isdigit()
        )
        avg_churn = round((high / len(batch_results) * 100), 1) if batch_results else 0.0

        from collections import Counter
        contract_counts = Counter(c.get("Contract", "Unknown") for c in clean_customers)
        plan_distribution = []
        color_map = {"Month-to-month": "#e11d48", "One year": "#d97706", "Two year": "#22c55e"}
        for plan, count in contract_counts.items():
            plan_distribution.append({
                "name": plan,
                "value": count,
                "pct": round(count / len(clean_customers) * 100, 1) if clean_customers else 0,
                "color": color_map.get(plan, "#7c3aed")
            })

        summary = {
            "company_id": company_id,
            "available": True,
            "total_analyzed": len(batch_results),
            "high_risk_count": high,
            "medium_risk_count": medium,
            "low_risk_count": low,
            "total_mrr": round(total_mrr, 2),
            "avg_churn_rate": avg_churn,
            "plan_distribution": plan_distribution,
            "results": sorted(batch_results, key=lambda r: r["churn_probability"], reverse=True)[:10],
        }

        await database["dashboard_cache"].replace_one(
            {"company_id": company_id},
            summary,
            upsert=True
        )
    except Exception as e:
        print("Error auto-updating dashboard cache:", e)

    return {
        "success": True,
        "filename": file.filename,
        "message": "Dataset stored successfully in MongoDB Atlas",
        "total_rows": total_rows,
        "new_records": inserted_count,
        "inserted": inserted_count,
        "duplicates_skipped": duplicate_count,
        "duplicate_rows": duplicate_count,
        "total_in_db": total_in_db,
        "final_customer_count": total_in_db,
        "rows_stored": inserted_count
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
        "stored": True,
        "total_records": count,
        "sample_record": sample
    }


@app.delete("/dataset/clear")
async def clear_dataset(user_doc: dict = Depends(get_current_user_doc)):
    company_id = user_doc["company_id"]
    result = await telco_collection.delete_many({"company_id": company_id})
    await database["dashboard_cache"].delete_many({"company_id": company_id})
    await database["dataset_uploads"].delete_many({"company_id": company_id})
    return {
        "message": "Dataset cleared successfully",
        "records_deleted": result.deleted_count
    }

@app.post("/predict/churn")
async def predict_customer_churn(customer: CustomerPredictionInput, user_doc: dict = Depends(get_current_user_doc)):
    result = predict_churn(customer.dict())
    return result

@app.post("/predict/explain")
async def predict_with_explanation(customer: CustomerPredictionInput, user_doc: dict = Depends(get_current_user_doc)):
    prediction_result = predict_churn(customer.dict())
    explanation_result = explain_prediction(customer.dict())

    return {
        **prediction_result,
        **explanation_result
    }

@app.post("/predict/full")
async def predict_full_analysis(customer: CustomerPredictionInput, user_doc: dict = Depends(get_current_user_doc)):
    customer_dict = customer.dict()

    prediction_result = predict_churn(customer_dict)
    explanation_result = explain_prediction(customer_dict)
    recommendation_result = generate_recommendations(
        customer_dict,
        explanation_result["top_factors"],
        prediction_result["risk_level"]
    )

    return {
        **prediction_result,
        **explanation_result,
        **recommendation_result
    }

@app.post("/predict/batch-all")
async def predict_all_customers(user_doc: dict = Depends(get_current_user_doc)):
    from ml.batch_predict import build_aggregates
    company_id = user_doc["company_id"]

    cursor = telco_collection.find({"company_id": company_id})
    raw_customers = await cursor.to_list(length=None)

    customers = []
    for c in raw_customers:
        clean = {k: v for k, v in c.items() if k != "_id"}
        customers.append(clean)

    results = predict_batch(customers)

    high = sum(1 for r in results if r["risk_level"] == "High")
    medium = sum(1 for r in results if r["risk_level"] == "Medium")
    low = sum(1 for r in results if r["risk_level"] == "Low")

    aggregates = build_aggregates(results)

    summary = {
        "company_id": company_id,
        "available": True,
        "total_analyzed": len(results),
        "high_risk_count": high,
        "medium_risk_count": medium,
        "low_risk_count": low,
        "results": sorted(results, key=lambda r: r["churn_probability"], reverse=True)[:10],
        "risk_by_contract": aggregates["risk_by_contract"],
        "risk_by_tenure": aggregates["risk_by_tenure"],
    }

    await database["dashboard_cache"].replace_one({"company_id": company_id}, summary, upsert=True)

    return summary


@app.get("/dashboard/stats")
async def get_dashboard_stats(user_doc: dict = Depends(get_current_user_doc)):
    company_id = user_doc["company_id"]
    cached = await database["dashboard_cache"].find_one({"company_id": company_id})
    if cached:
        clean = {k: v for k, v in cached.items() if k != "_id"}
        return {"available": True, **clean}

    count = await telco_collection.count_documents({"company_id": company_id})
    if count == 0:
        return {
            "available": True,
            "total_analyzed": 0,
            "high_risk_count": 0,
            "medium_risk_count": 0,
            "low_risk_count": 0,
            "total_mrr": 0.0,
            "avg_churn_rate": 0.0,
            "plan_distribution": [],
            "results": []
        }

    cursor = telco_collection.find({"company_id": company_id})
    raw_customers = await cursor.to_list(length=None)
    clean_customers = [{k: v for k, v in c.items() if k != "_id"} for c in raw_customers]

    batch_results = predict_batch(clean_customers)
    high = sum(1 for r in batch_results if r["risk_level"] == "High")
    medium = sum(1 for r in batch_results if r["risk_level"] == "Medium")
    low = sum(1 for r in batch_results if r["risk_level"] == "Low")
    total_mrr = sum(float(c.get("MonthlyCharges", 0)) for c in clean_customers if str(c.get("MonthlyCharges", "")).replace('.', '', 1).isdigit())
    avg_churn = round((high / len(batch_results) * 100), 1) if batch_results else 0.0

    from collections import Counter
    contract_counts = Counter(c.get("Contract", "Unknown") for c in clean_customers)
    color_map = {"Month-to-month": "#e11d48", "One year": "#d97706", "Two year": "#22c55e"}
    plan_distribution = [
        {
            "name": plan,
            "value": cnt,
            "pct": round(cnt / len(clean_customers) * 100, 1) if clean_customers else 0,
            "color": color_map.get(plan, "#7c3aed")
        }
        for plan, cnt in contract_counts.items()
    ]

    summary = {
        "company_id": company_id,
        "available": True,
        "total_analyzed": len(batch_results),
        "high_risk_count": high,
        "medium_risk_count": medium,
        "low_risk_count": low,
        "total_mrr": round(total_mrr, 2),
        "avg_churn_rate": avg_churn,
        "plan_distribution": plan_distribution,
        "results": sorted(batch_results, key=lambda r: r["churn_probability"], reverse=True)[:10],
    }

    await database["dashboard_cache"].replace_one({"company_id": company_id}, summary, upsert=True)
    return summary


@app.get("/uploads/history")
async def get_upload_history(limit: int = 10, user_doc: dict = Depends(get_current_user_doc)):
    company_id = user_doc["company_id"]
    cursor = database["dataset_uploads"].find({"company_id": company_id}).sort("uploaded_at", -1).limit(limit)
    history = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        if "uploaded_at" in doc and hasattr(doc["uploaded_at"], "isoformat"):
            doc["uploaded_at"] = doc["uploaded_at"].isoformat()
        history.append(doc)
    return history


@app.get("/ml/metrics")
async def get_ml_metrics(user_doc: dict = Depends(get_current_user_doc)):
    company_id = user_doc["company_id"]
    count = await telco_collection.count_documents({"company_id": company_id})
    if count == 0:
        return {
            "accuracy": 0.0,
            "precision": 0.0,
            "recall": 0.0,
            "f1_score": 0.0,
            "auc": 0.0,
            "confusion_matrix": {"true_negative": 0, "false_positive": 0, "false_negative": 0, "true_positive": 0},
            "roc_curve": [],
            "feature_importance": []
        }
    return await compute_metrics()


@app.get("/ml/segments")
async def get_ml_segments(user_doc: dict = Depends(get_current_user_doc)):
    company_id = user_doc["company_id"]
    count = await telco_collection.count_documents({"company_id": company_id})
    if count == 0:
        return []
    return await get_segment_profiles()


@app.get("/reports/export/csv")
async def export_reports_csv(risk_level: Optional[str] = "All", user_doc: dict = Depends(get_current_user_doc)):
    company_id = user_doc["company_id"]
    cursor = telco_collection.find({"company_id": company_id})
    customers = await cursor.to_list(length=None)
    
    if not customers:
        raise HTTPException(status_code=404, detail="No customers found for your company. Upload a dataset first.")
        
    for c in customers:
        c["_id"] = str(c["_id"])
        
    results = predict_batch(customers)
    
    if risk_level != "All":
        results = [r for r in results if r["risk_level"] == risk_level]
        
    if not results:
        raise HTTPException(status_code=404, detail=f"No customers found matching risk level: {risk_level}")
        
    df = pd.DataFrame(results)
    
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    
    response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=churndata_{risk_level.lower()}.csv"
    return response


# ---------- Telco Customers (CSV-uploaded dataset) — Paginated ----------

@app.get("/telco/customers")
async def get_telco_customers(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    search: str = Query(default=""),
    user_doc: dict = Depends(get_current_user_doc)
):
    company_id = user_doc["company_id"]
    query = {"company_id": company_id}
    if search:
        query["$or"] = [
            {"customerID": {"$regex": search, "$options": "i"}},
            {"Contract": {"$regex": search, "$options": "i"}},
            {"InternetService": {"$regex": search, "$options": "i"}},
        ]

    total = await telco_collection.count_documents(query)
    skip = (page - 1) * limit

    cursor = telco_collection.find(query).skip(skip).limit(limit)
    records = await cursor.to_list(length=limit)

    for r in records:
        r["_id"] = str(r["_id"])

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": math.ceil(total / limit) if total > 0 else 1,
        "records": records
    }


@app.delete("/telco/customers/{customer_id}")
async def delete_telco_customer(customer_id: str, user_doc: dict = Depends(get_current_user_doc)):
    company_id = user_doc["company_id"]
    result = await telco_collection.delete_one({"company_id": company_id, "customerID": customer_id})

    if result.deleted_count == 0:
        if ObjectId.is_valid(customer_id):
            result = await telco_collection.delete_one({"company_id": company_id, "_id": ObjectId(customer_id)})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found")

    await database["dashboard_cache"].delete_many({"company_id": company_id})

    return {"message": f"Customer '{customer_id}' deleted successfully"}


