import os
import sys
import math
import time
import re
import secrets
import hashlib
import logging
from collections import Counter
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Query, Request
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator, Field
from dotenv import load_dotenv
from pymongo.errors import ServerSelectionTimeoutError, ConnectionFailure

# Load .env from backend directory or fallback to current directory
_backend_dir = os.path.dirname(os.path.abspath(__file__))
_env_path = os.path.join(_backend_dir, ".env")
if os.path.exists(_env_path):
    load_dotenv(dotenv_path=_env_path, override=True)
else:
    load_dotenv(override=True)

logger = logging.getLogger(__name__)
# pyrefly: ignore [missing-import]
from bson import ObjectId
import pandas as pd
import io
from datetime import datetime, timezone, timedelta

from database import (
    customer_collection,
    user_collection,
    telco_collection,
    notification_collection,
    otp_collection,
    upload_collection,
    password_reset_collection,
    blacklisted_token_collection,
    database,
    check_db_connection,
)
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    get_current_user,
    get_current_user_doc,
    get_company_id_for_name,
    security_scheme,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from mailer import send_otp_email, send_registration_otp_email_with_code, send_password_reset_link_email, mask_email, is_dev_mode

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from ml.predict import predict_churn
from ml.explain import explain_prediction
from ml.recommend import generate_recommendations
try:
    from retention import get_retention_suggestions
except ImportError:
    from backend.retention import get_retention_suggestions
from typing import Literal, Optional, List, Dict, Any, Union
from fastapi.middleware.cors import CORSMiddleware
from ml.batch_predict import predict_batch, build_aggregates
from ml.metrics import compute_metrics, invalidate_metrics_cache
from ml.segment_customers import get_segment_profiles

app = FastAPI(
    title="ChurnGuard API",
    description="AI-powered customer churn prediction and retention system",
    version="1.0.0"
)

# CORS configuration: allow local development origins and configurable production origins
_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
_configured_origins = [orig.strip() for orig in _raw_origins.split(",") if orig.strip()] if _raw_origins else []
DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:4173",
    "https://churnguard-frontend.onrender.com",
]
allowed_origins = list(dict.fromkeys(DEFAULT_ORIGINS + _configured_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """
    Defensive security headers middleware:
    - Injects X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and CSP.
    - Preserves Swagger UI (/docs, /redoc) functionality.
    - Strips Server fingerprint header.
    """
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # Suppress server fingerprint header
    if "server" in response.headers:
        del response.headers["server"]

    # Content-Security-Policy (allows Swagger UI CDNs for /docs and /redoc)
    path = request.url.path
    if path.startswith(("/docs", "/redoc", "/openapi.json")):
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "img-src 'self' data: https://fastapi.tiangolo.com https://cdn.jsdelivr.net;"
        )
    else:
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "img-src 'self' data: blob: http: https:; "
            "font-src 'self' https: data:; "
            "style-src 'self' 'unsafe-inline' https:; "
            "script-src 'self' 'unsafe-inline'; "
            "connect-src 'self' http: https: ws: wss:;"
        )
    return response

@app.exception_handler(ServerSelectionTimeoutError)
async def mongo_timeout_handler(request: Request, exc: ServerSelectionTimeoutError):
    logger.error(f"MongoDB Atlas timeout on {request.url.path}: {exc}")
    return JSONResponse(
        status_code=503,
        content={"detail": "Database connection timed out. MongoDB Atlas is currently unreachable. Please check network connectivity."}
    )

@app.exception_handler(ConnectionFailure)
async def mongo_connection_failure_handler(request: Request, exc: ConnectionFailure):
    logger.error(f"MongoDB connection failure on {request.url.path}: {exc}")
    return JSONResponse(
        status_code=503,
        content={"detail": "Database connection failure. Unable to communicate with MongoDB Atlas."}
    )

# Static file mount directories for user profile avatars
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
AVATAR_DIR = os.path.join(UPLOAD_DIR, "avatars")
os.makedirs(AVATAR_DIR, exist_ok=True)
# Note: app.mount("/uploads", ...) is mounted at the bottom of this file so /uploads/history API route takes precedence.



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
        telco_collection.create_index(
            [("company_id", 1), ("upload_ids", 1)],
            name="telco_company_upload_ids"
        ),
        telco_collection.create_index(
            [("company_id", 1), ("upload_id", 1)],
            name="telco_company_upload_id"
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
        # Password reset tokens — lookup and TTL index
        password_reset_collection.create_index(
            [("token_hash", 1)],
            unique=True,
            name="pwd_reset_token_hash"
        ),
        password_reset_collection.create_index(
            [("email", 1), ("created_at", -1)],
            name="pwd_reset_email_created"
        ),
        password_reset_collection.create_index(
            [("expires_at", 1)],
            expireAfterSeconds=0,
            name="pwd_reset_expires_ttl"
        ),
        # Blacklisted tokens — token lookup and automatic TTL expiration
        blacklisted_token_collection.create_index(
            [("token", 1)],
            unique=True,
            name="blacklisted_token_unique"
        ),
        blacklisted_token_collection.create_index(
            [("expires_at", 1)],
            expireAfterSeconds=0,
            name="blacklisted_token_ttl"
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

    # Real aggregations by contract and tenure
    aggs = build_aggregates(batch_results) if batch_results else {}

    # Real high-risk archetype profile calculated from actual high risk customer records
    risk_map = {r["customerID"]: r["risk_level"] for r in batch_results}
    high_custs = [c for c in clean_customers if risk_map.get(c.get("customerID")) == "High"]
    num_high = len(high_custs)
    if num_high > 0:
        m2m_pct = round(sum(1 for c in high_custs if c.get("Contract") == "Month-to-month") / num_high * 100)
        early_pct = round(sum(1 for c in high_custs if int(c.get("tenure") or 0) < 12) / num_high * 100)
        fiber_pct = round(sum(1 for c in high_custs if c.get("InternetService") == "Fiber optic") / num_high * 100)
        nosup_pct = round(sum(1 for c in high_custs if c.get("TechSupport") == "No") / num_high * 100)
        echeck_pct = round(sum(1 for c in high_custs if c.get("PaymentMethod") == "Electronic check") / num_high * 100)
        high_risk_profile = [
            {"label": "Month-to-Month Contract", "pct": m2m_pct, "desc": "High flexibility with zero lock-in barriers"},
            {"label": "Early Tenure (< 12 Months)", "pct": early_pct, "desc": "Undergoing initial product onboarding phase"},
            {"label": "Fiber Optic Service Tier", "pct": fiber_pct, "desc": "High monthly bill sensitivity and expectations"},
            {"label": "No Tech Support Plan", "pct": nosup_pct, "desc": "Unresolved technical friction accelerates churn"},
            {"label": "Electronic Check Payment", "pct": echeck_pct, "desc": "Manual payment friction and billing disputes"},
        ]
    else:
        high_risk_profile = []

    return {
        "company_id":        company_id,
        "available":         True,
        "total_analyzed":    len(clean_customers),
        "high_risk_count":   high,
        "medium_risk_count": medium,
        "low_risk_count":    low,
        "total_mrr":         round(total_mrr, 2),
        "avg_churn_rate":    avg_churn,
        "plan_distribution": plan_distribution,
        "risk_by_contract":  aggs.get("risk_by_contract", []),
        "risk_by_tenure":    aggs.get("risk_by_tenure", []),
        "high_risk_profile": high_risk_profile,
        "results":           sorted(batch_results, key=lambda r: r["churn_probability"], reverse=True)[:10],
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
    confirm_password: Optional[str] = None
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
    gender: Optional[str] = "Male"
    SeniorCitizen: Optional[Any] = "No"
    Partner: Optional[str] = "No"
    Dependents: Optional[str] = "No"
    tenure: int = Field(..., ge=0, le=120, description="Customer tenure in months (0 to 120)")
    PhoneService: Optional[str] = "Yes"
    MultipleLines: Optional[str] = "No"
    InternetService: Optional[str] = "Fiber optic"
    OnlineSecurity: Optional[str] = "No"
    OnlineBackup: Optional[str] = "No"
    DeviceProtection: Optional[str] = "No"
    TechSupport: Optional[str] = "No"
    StreamingTV: Optional[str] = "No"
    StreamingMovies: Optional[str] = "No"
    Contract: Optional[str] = "Month-to-month"
    PaperlessBilling: Optional[str] = "Yes"
    PaymentMethod: Optional[str] = "Electronic check"
    MonthlyCharges: float = Field(..., ge=0.0, le=50000.0, description="Monthly charges (>= 0)")
    TotalCharges: float = Field(..., ge=0.0, le=1000000.0, description="Total charges (>= 0)")

    @field_validator("SeniorCitizen", mode="before")
    @classmethod
    def normalize_senior_citizen(cls, v):
        if v in (1, "1", "Yes", "yes", True):
            return "Yes"
        return "No"

    @field_validator("MultipleLines", mode="before")
    @classmethod
    def normalize_multiple_lines(cls, v):
        if not v or v in ("", "null", None):
            return "No"
        return v


class PredictSelectedRequest(BaseModel):
    customer_ids: Optional[List[str]] = None
    select_all_matching: Optional[bool] = False
    deselected_ids: Optional[List[str]] = None
    search: Optional[str] = ""
    upload_id: Optional[str] = None
    risk_level: Optional[str] = "all"


class ClearAllDatasetRequest(BaseModel):
    confirm_phrase: Optional[str] = ""


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
async def health_check():
    try:
        db_status = await check_db_connection()
        return {
            "status": "healthy",
            "service": "ChurnGuard Backend",
            "message": "API is up and running",
            "database": {
                "status": "connected",
                "target": "MongoDB Atlas",
                "database_name": db_status["database"],
                "collections_count": len(db_status["collections"]),
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as exc:
        logger.error(f"Health check failed to connect to MongoDB Atlas: {exc}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "degraded",
                "service": "ChurnGuard Backend",
                "message": "API is online but database is unavailable",
                "database": {
                    "status": "disconnected",
                    "target": "MongoDB Atlas",
                    "error": type(exc).__name__,
                    "detail": str(exc),
                },
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )


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
    company_id = user_doc.get("company_id")
    if not company_id:
        return []
    t0 = time.perf_counter()
    customers = []
    async for doc in customer_collection.find({"company_id": company_id}):
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


@app.get("/customers/{customer_id}/suggestions")
@app.get("/telco/customers/{customer_id}/suggestions")
async def get_customer_suggestions_endpoint(
    customer_id: str,
    user_doc: dict = Depends(get_current_user_doc)
):
    company_id = user_doc["company_id"]
    query = {"company_id": company_id, "customerID": customer_id}
    doc = await telco_collection.find_one(query)
    if not doc and ObjectId.is_valid(customer_id):
        doc = await telco_collection.find_one({"company_id": company_id, "_id": ObjectId(customer_id)})
    if not doc and ObjectId.is_valid(customer_id):
        doc = await customer_collection.find_one({"company_id": company_id, "_id": ObjectId(customer_id)})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found")

    cid = doc.get("customerID") or str(doc.get("_id"))
    clean_cust = {k: v for k, v in doc.items() if k not in ("_id", "company_id")}
    pred = predict_churn(clean_cust)
    prob = pred["churn_probability"]
    suggestions = get_retention_suggestions(clean_cust, prob)

    return {
        "customerID": cid,
        "churn_prediction": pred.get("churn_prediction"),
        "churn_probability": prob,
        "risk_level": pred.get("risk_level"),
        "suggestions": suggestions
    }


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
    company_id = user_doc["company_id"]

    # 1. Try deleting from telco_collection first (customerID or ObjectId)
    telco_del = await telco_collection.delete_one({"company_id": company_id, "customerID": customer_id})
    if telco_del.deleted_count == 0 and ObjectId.is_valid(customer_id):
        telco_del = await telco_collection.delete_one({"company_id": company_id, "_id": ObjectId(customer_id)})

    if telco_del.deleted_count > 0:
        await database["dashboard_cache"].delete_many({"company_id": company_id})
        invalidate_metrics_cache(company_id)
        remaining = await telco_collection.count_documents({"company_id": company_id})
        return {
            "message": f"Customer '{customer_id}' deleted successfully",
            "total": remaining,
            "total_in_db": remaining
        }

    # 2. Fallback to customer_collection
    if ObjectId.is_valid(customer_id):
        doc = await customer_collection.find_one({
            "_id": ObjectId(customer_id),
            "company_id": company_id
        })
        if doc is not None:
            await customer_collection.delete_one({
                "_id": ObjectId(customer_id),
                "company_id": company_id
            })
            return {
                "message": f"Customer {customer_id} deleted successfully",
                "deleted_customer": customer_helper(doc),
            }

    raise HTTPException(status_code=404, detail=f"No customer found with ID {customer_id}")


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

# ── Registration field validators ─────────────────────────────────────────────
_EMAIL_RE = re.compile(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')
_NAME_RE  = re.compile(r'^[a-zA-Z\s\'-]{2,50}$')
_PHONE_RE = re.compile(r'^[6-9][0-9]{9}$')


def _validate_registration_fields(user: 'RegisterUser') -> None:
    """Raises HTTPException 422 for any invalid registration field."""
    norm_email = user.email.strip().lower()

    # First name — required, letters only
    fn = user.first_name.strip()
    if not fn:
        raise HTTPException(status_code=422, detail="First name is required.")
    if not _NAME_RE.match(fn):
        raise HTTPException(
            status_code=422,
            detail="First name must contain letters only (2–50 characters)."
        )

    # Last name — required, letters only
    ln = user.last_name.strip()
    if not ln:
        raise HTTPException(status_code=422, detail="Last name is required.")
    if not re.match(r'^[a-zA-Z\s\'-]{1,50}$', ln):
        raise HTTPException(status_code=422, detail="Last name can contain letters only.")

    # Company — required
    comp = user.company.strip()
    if not comp:
        raise HTTPException(status_code=422, detail="Company name is required.")

    # Confirm password — if provided, must match password
    if user.confirm_password is not None and user.confirm_password != user.password:
        raise HTTPException(status_code=422, detail="Passwords do not match.")

    # Email — required, valid format
    if not norm_email:
        raise HTTPException(status_code=422, detail="Email address is required.")
    if not _EMAIL_RE.match(norm_email):
        raise HTTPException(status_code=422, detail="Please enter a valid email address.")

    # Phone — required, 10-digit Indian format
    ph = re.sub(r'\D', '', user.phone.strip())
    if not ph:
        raise HTTPException(status_code=422, detail="Phone number is required.")
    if not _PHONE_RE.match(ph):
        raise HTTPException(
            status_code=422,
            detail="Phone must be a 10-digit number starting with 6, 7, 8, or 9."
        )

    # Password — min 8, max 72, must contain upper + lower + digit
    pw = user.password
    if not pw:
        raise HTTPException(status_code=422, detail="Password is required.")
    if len(pw) < 8 or len(pw) > 72:
        raise HTTPException(status_code=422, detail="Password must be 8–72 characters.")
    if not re.search(r'[A-Z]', pw):
        raise HTTPException(status_code=422, detail="Password must contain at least one uppercase letter.")
    if not re.search(r'[a-z]', pw):
        raise HTTPException(status_code=422, detail="Password must contain at least one lowercase letter.")
    if not re.search(r'[0-9]', pw):
        raise HTTPException(status_code=422, detail="Password must contain at least one digit.")


@app.post("/register")
async def register_user(user: RegisterUser):
    """
    Step 1 of registration: validate fields, create a *pending* (unverified) user,
    generate a 6-digit OTP, hash it, store it in otp_codes, and send it by email.

    The account is NOT usable until /auth/verify-registration is called successfully.
    """
    # 1. Server-side field validation
    _validate_registration_fields(user)

    norm_email   = user.email.strip().lower()
    company_name = user.company.strip()
    company_id   = get_company_id_for_name(company_name, norm_email)
    hashed_pw    = hash_password(user.password)
    now          = datetime.now(timezone.utc)

    # 2. Duplicate check — block only verified accounts
    existing = await user_collection.find_one({"email": norm_email})
    if existing:
        if existing.get("email_verified", True):  # verified accounts block duplicates
            raise HTTPException(status_code=400, detail="An account with this email already exists.")
        # Unverified pending account — replace it so the user can retry registration
        await user_collection.delete_one({"_id": existing["_id"]})
        await otp_collection.delete_many({"email": norm_email, "purpose": "email_verification"})

    # 3. OTP rate-limit check — prevent spamming even before account exists
    latest_otp = await otp_collection.find_one(
        {"email": norm_email, "purpose": "email_verification"},
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

    # 4. Create pending user (email_verified=False)
    ph_clean = re.sub(r'\D', '', user.phone.strip())
    result = await user_collection.insert_one({
        "email":          norm_email,
        "password":       hashed_pw,
        "first_name":     user.first_name.strip(),
        "last_name":      user.last_name.strip(),
        "company":        company_name,
        "company_type":   (user.company_type or "Private Limited").strip(),
        "industry":       (user.industry or "Information Technology").strip(),
        "department":     (user.department or "Analytics").strip(),
        "company_size":   (user.company_size or "11–50").strip(),
        "company_id":     company_id,
        "role":           user.role.strip() or "Analyst",
        "phone":          ph_clean,
        "country":        user.country.strip() or "India",
        "language":       "en",
        "photo_url":      None,
        "email_verified": False,
        "created_at":     now,
    })
    user_id = result.inserted_id
    print(f"[Register] Pending user created for {mask_email(norm_email)}")

    # 5. Generate 6-digit secure OTP and hash it
    otp_code   = f"{secrets.randbelow(900000) + 100000}"
    hashed_otp = hash_password(otp_code)
    expires_at = now + timedelta(minutes=10)
    print(f"[Register] OTP generated for {mask_email(norm_email)} — dispatching verification email", flush=True)

    # 6. Invalidate any previous OTP for this email, then store new one
    await otp_collection.delete_many({"email": norm_email, "purpose": "email_verification"})
    await otp_collection.insert_one({
        "user_id":      user_id,
        "email":        norm_email,
        "otp_hash":     hashed_otp,
        "purpose":      "email_verification",
        "expires_at":   expires_at,
        "created_at":   now,
        "attempts":     0,
        "max_attempts": 5,
    })

    # 7. Send OTP email — propagate failure to frontend (do NOT silently succeed)
    try:
        sent = send_registration_otp_email_with_code(
            to_email=norm_email,
            otp_code=otp_code,
            first_name=user.first_name.strip()
        )
        if not sent:
            raise RuntimeError("Email dispatch returned False")
    except Exception as exc:
        # SMTP not configured or send failed — clean up and log actionable error
        logger.exception("OTP email sending failed: %s", exc)
        await user_collection.delete_one({"_id": user_id})
        await otp_collection.delete_many({"email": norm_email, "purpose": "email_verification"})
        raise HTTPException(
            status_code=503,
            detail=(
                f"Registration failed: could not send verification email ({type(exc).__name__}: {exc}). "
                "Please ensure SMTP is configured in the server environment, then try again."
            )
        )

    print(f"[Register] Verification email sent to {mask_email(norm_email)}")
    return {
        "message": "Verification code sent to your email. Please check your inbox and spam folder.",
        "masked_email": mask_email(norm_email),
        "step": "verify_otp"
    }


class RegistrationOtpVerify(BaseModel):
    email: str
    otp: str


class RegistrationResendOtp(BaseModel):
    email: str


@app.post("/auth/verify-registration")
async def verify_registration(req: RegistrationOtpVerify):
    """
    Step 2 of registration: verify the 6-digit OTP and activate the account.
    """
    norm_email = req.email.strip().lower()
    clean_otp  = req.otp.strip()

    if not clean_otp or not re.match(r'^\d{6}$', clean_otp):
        raise HTTPException(status_code=400, detail="Please enter a valid 6-digit verification code.")

    # 1. Find OTP record
    otp_doc = await otp_collection.find_one({
        "email":   norm_email,
        "purpose": "email_verification"
    })
    if not otp_doc:
        raise HTTPException(
            status_code=400,
            detail="No pending verification code found. Please register again."
        )

    now = datetime.now(timezone.utc)

    # 2. Check expiry
    expires_at = otp_doc.get("expires_at")
    if expires_at:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < now:
            await otp_collection.delete_one({"_id": otp_doc["_id"]})
            raise HTTPException(
                status_code=400,
                detail="Verification code has expired. Please register again to get a new code."
            )

    # 3. Check attempt limit
    current_attempts = otp_doc.get("attempts", 0)
    max_attempts     = otp_doc.get("max_attempts", 5)
    if current_attempts >= max_attempts:
        await otp_collection.delete_one({"_id": otp_doc["_id"]})
        raise HTTPException(
            status_code=400,
            detail="Maximum verification attempts exceeded. Please register again."
        )

    # 4. Verify OTP hash
    if not verify_password(clean_otp, otp_doc.get("otp_hash", "")):
        new_attempts = current_attempts + 1
        if new_attempts >= max_attempts:
            await otp_collection.delete_one({"_id": otp_doc["_id"]})
            raise HTTPException(
                status_code=400,
                detail="Invalid verification code. Maximum attempts reached. Please register again."
            )
        remaining = max_attempts - new_attempts
        await otp_collection.update_one(
            {"_id": otp_doc["_id"]},
            {"$set": {"attempts": new_attempts}}
        )
        raise HTTPException(
            status_code=400,
            detail=f"Invalid or expired OTP. {remaining} attempt(s) remaining."
        )

    # 5. Activate the user account
    await user_collection.update_one(
        {"email": norm_email},
        {"$set": {"email_verified": True, "verified_at": now}}
    )

    # 6. Delete used OTP
    await otp_collection.delete_one({"_id": otp_doc["_id"]})

    print(f"[Register] Email verified for {mask_email(norm_email)}")
    return {
        "success": True,
        "message": "Email verified successfully. You can now log in."
    }


@app.post("/auth/resend-registration-otp")
async def resend_registration_otp(req: RegistrationResendOtp):
    """
    Resend the registration verification OTP.
    Rate-limited to one request per 60 seconds.
    """
    norm_email = req.email.strip().lower()
    now = datetime.now(timezone.utc)

    # 1. Check the user exists and is still pending
    user_doc = await user_collection.find_one({"email": norm_email})
    if not user_doc:
        # Generic message — do not reveal whether email exists
        raise HTTPException(
            status_code=400,
            detail="No pending registration found for this email."
        )
    if user_doc.get("email_verified"):
        raise HTTPException(
            status_code=400,
            detail="This email is already verified. Please log in."
        )

    # 2. Rate-limit check
    latest_otp = await otp_collection.find_one(
        {"email": norm_email, "purpose": "email_verification"},
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
                detail=f"Please wait {remaining} seconds before requesting a new code."
            )

    # 3. Generate new OTP
    otp_code   = f"{secrets.randbelow(900000) + 100000}"
    hashed_otp = hash_password(otp_code)
    expires_at = now + timedelta(minutes=10)
    print(f"[Resend] New OTP generated for {mask_email(norm_email)} — dispatching", flush=True)

    # 4. Invalidate old OTPs, store new one
    await otp_collection.delete_many({"email": norm_email, "purpose": "email_verification"})
    await otp_collection.insert_one({
        "user_id":      user_doc["_id"],
        "email":        norm_email,
        "otp_hash":     hashed_otp,
        "purpose":      "email_verification",
        "expires_at":   expires_at,
        "created_at":   now,
        "attempts":     0,
        "max_attempts": 5,
    })

    # 5. Send email
    try:
        sent = send_registration_otp_email_with_code(
            to_email=norm_email,
            otp_code=otp_code,
            first_name=user_doc.get("first_name", "")
        )
        if not sent:
            raise RuntimeError("Email dispatch returned False")
    except Exception as exc:
        logger.exception("OTP email sending failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail=f"Could not send verification email ({type(exc).__name__}: {exc}). Please check SMTP configuration."
        )

    print(f"[Resend] Verification email resent to {mask_email(norm_email)}")
    return {
        "message": "A new verification code has been sent to your email.",
        "masked_email": mask_email(norm_email)
    }


@app.post("/login")
@app.post("/auth/login")
@app.post("/api/auth/login")
async def login_user(user: User):
    norm_email = user.email.strip().lower()
    existing = await user_collection.find_one({
        "$or": [
            {"email": norm_email},
            {"email": {"$regex": f"^\\s*{re.escape(norm_email)}\\s*$", "$options": "i"}}
        ]
    })
    if not existing:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(user.password, existing["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Block unverified accounts — give a clear, actionable message
    if not existing.get("email_verified", False):
        raise HTTPException(
            status_code=403,
            detail="Please verify your email before logging in. Check your inbox for the verification code."
        )

    company_id = existing.get("company_id")
    if not company_id:
        company_id = get_company_id_for_name(existing.get("company", ""), existing.get("email", ""))
        await user_collection.update_one({"_id": existing["_id"]}, {"$set": {"company_id": company_id}})

    token = create_access_token({"sub": existing.get("email", norm_email), "company_id": company_id})
    return {"access_token": token, "token_type": "bearer", "company_id": company_id}


@app.post("/auth/logout")
@app.post("/api/auth/logout")
async def logout_user(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)):
    """
    Revoke the current authentication session.
    Blacklists the incoming JWT token in MongoDB with a TTL index matching its expiration.
    """
    token = credentials.credentials
    payload = decode_access_token(token)
    exp = payload.get("exp") if payload else None
    if exp:
        expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
    else:
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    await blacklisted_token_collection.update_one(
        {"token": token},
        {
            "$set": {
                "token": token,
                "email": payload.get("sub") if payload else "unknown",
                "revoked_at": datetime.now(timezone.utc),
                "expires_at": expires_at
            }
        },
        upsert=True
    )
    return {"success": True, "message": "Successfully logged out. Session token has been revoked."}


# ── Password Recovery (Forgot Password & Reset Link) ──────────────────────────

# Rate limiting stores for /auth/forgot-password
# In-process rolling window: max 5 requests per hour per IP and per email,
# plus a 60-second resend cooldown per email.
import threading as _threading
_fp_ip_store: dict = {}
_fp_email_store: dict = {}
_fp_store_lock = _threading.Lock()
_FP_MAX_REQUESTS_PER_HOUR = 5
_FP_WINDOW_SECONDS = 3600  # 1 hour
_FP_RESEND_COOLDOWN_SECONDS = 60  # 60 seconds

def _enforce_forgot_password_rate_limits(ip: str, email: str, now: datetime) -> None:
    """
    Enforce per-IP and per-email rate limiting and resend cooldown on forgot-password.
    Raises HTTP 429 with Retry-After header on violation.
    """
    now_ts = now.timestamp()
    cutoff_hour = now_ts - _FP_WINDOW_SECONDS
    cutoff_cooldown = now_ts - _FP_RESEND_COOLDOWN_SECONDS

    with _fp_store_lock:
        # 1. IP rate limit check (max 5 per hour)
        ip_times = [t for t in _fp_ip_store.get(ip, []) if t > cutoff_hour]
        if len(ip_times) >= _FP_MAX_REQUESTS_PER_HOUR:
            retry_after = max(1, int(math.ceil(ip_times[0] + _FP_WINDOW_SECONDS - now_ts)))
            raise HTTPException(
                status_code=429,
                detail=f"Too many password reset requests from this network ({_FP_MAX_REQUESTS_PER_HOUR} per hour). Please try again later.",
                headers={"Retry-After": str(retry_after)}
            )

        # 2. Email rate limit & cooldown check
        email_times = [t for t in _fp_email_store.get(email, []) if t > cutoff_hour]
        if email_times:
            # 60-second resend cooldown
            last_req = email_times[-1]
            if last_req > cutoff_cooldown:
                remaining = max(1, int(math.ceil(last_req + _FP_RESEND_COOLDOWN_SECONDS - now_ts)))
                raise HTTPException(
                    status_code=429,
                    detail=f"Please wait {remaining} seconds before requesting another password reset link.",
                    headers={"Retry-After": str(remaining)}
                )
            # Max 5 per hour per email
            if len(email_times) >= _FP_MAX_REQUESTS_PER_HOUR:
                retry_after = max(1, int(math.ceil(email_times[0] + _FP_WINDOW_SECONDS - now_ts)))
                raise HTTPException(
                    status_code=429,
                    detail=f"Too many password reset requests for this email ({_FP_MAX_REQUESTS_PER_HOUR} per hour). Please try again later.",
                    headers={"Retry-After": str(retry_after)}
                )

        # Record this request
        ip_times.append(now_ts)
        _fp_ip_store[ip] = ip_times

        email_times.append(now_ts)
        _fp_email_store[email] = email_times


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
    confirm_password: Optional[str] = None


EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@app.post("/auth/forgot-password")
@app.post("/api/auth/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, request: Request):
    """
    Initiate password recovery by emailing a cryptographically secure, single-use reset link.

    Rate limits (enforced server-side):
      • Per email address : 60-second cooldown + max 5 requests per hour.
      • Per IP address    : max 5 requests per hour.
    """
    raw_email = req.email.strip()
    if not raw_email or not EMAIL_REGEX.match(raw_email):
        raise HTTPException(status_code=422, detail="Please enter a valid email address.")

    norm_email = raw_email.lower()
    now = datetime.now(timezone.utc)

    # Resolve client IP
    client_ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or (request.client.host if request.client else "unknown")
        or "unknown"
    )

    # 1. Enforce in-memory rate limiting (IP and email)
    _enforce_forgot_password_rate_limits(client_ip, norm_email, now)

    # DB-backed check: enforce 60s cooldown if previous reset exists in DB
    latest = await password_reset_collection.find_one(
        {"email": norm_email},
        sort=[("created_at", -1)]
    )
    if latest and latest.get("created_at"):
        created_at = latest["created_at"]
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        elapsed = (now - created_at).total_seconds()
        if elapsed < 60:
            remaining = max(1, int(math.ceil(60 - elapsed)))
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {remaining} seconds before requesting another password reset link.",
                headers={"Retry-After": str(remaining)}
            )

    generic_success_response = {
        "success": True,
        "message": "If an account exists for this email, we have sent a password reset link. Please check your inbox and spam folder.",
        "masked_email": mask_email(norm_email)
    }

    # 2. Check if user exists in MongoDB (case-insensitive & trimmed)
    user_doc = await user_collection.find_one({
        "$or": [
            {"email": norm_email},
            {"email": {"$regex": f"^\\s*{re.escape(norm_email)}\\s*$", "$options": "i"}}
        ]
    })
    if not user_doc:
        logger.warning(
            "[ForgotPassword] Email '%s' not found in database. Returning anti-enumeration response without sending email.",
            mask_email(norm_email)
        )
        # Prevent user enumeration: return identical generic response even if email doesn't exist
        return generic_success_response

    # 3. Cryptographically secure random token — expires in 30 minutes
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = now + timedelta(minutes=30)

    # Invalidate previous unused reset tokens for this user
    await password_reset_collection.update_many(
        {"email": norm_email, "used": False},
        {"$set": {"used": True, "invalidated_at": now}}
    )

    # 4. Insert new reset token record
    await password_reset_collection.insert_one({
        "user_id":    user_doc["_id"],
        "email":      norm_email,
        "token_hash": token_hash,
        "expires_at": expires_at,
        "created_at": now,
        "used":       False
    })

    # 5. Resolve frontend base URL
    origin = request.headers.get("origin") or request.headers.get("referer") or ""
    frontend_base = ""
    if origin:
        from urllib.parse import urlparse
        parsed = urlparse(origin)
        if parsed.scheme and parsed.netloc:
            frontend_base = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")

    if not frontend_base:
        env_frontend = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
        if env_frontend and not (is_dev_mode() and "onrender.com" in env_frontend):
            frontend_base = env_frontend
        else:
            frontend_base = "http://127.0.0.1:5173"

    reset_url = f"{frontend_base}/reset-password?token={raw_token}"

    # 6. Dispatch email
    try:
        send_password_reset_link_email(
            to_email=norm_email,
            reset_url=reset_url,
            first_name=user_doc.get("first_name")
        )
    except Exception as exc:
        # Email transmission failed — clean up unused token and report safe 503
        await password_reset_collection.delete_many({"token_hash": token_hash})
        logger.exception("Password reset email sending failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="We could not send the email right now. Please try again in a few minutes."
        )

    return generic_success_response


@app.get("/auth/verify-reset-token")
@app.get("/api/auth/verify-reset-token")
async def verify_reset_token(token: str = Query(...)):
    """
    Validate password reset token authenticity, expiration, and single-use status.
    """
    clean_token = token.strip()
    if not clean_token:
        raise HTTPException(status_code=400, detail="Missing password reset token.")

    token_hash = hashlib.sha256(clean_token.encode("utf-8")).hexdigest()
    doc = await password_reset_collection.find_one({"token_hash": token_hash})
    if not doc:
        raise HTTPException(status_code=400, detail="Invalid or unrecognized password reset token.")

    if doc.get("used", False):
        raise HTTPException(
            status_code=400,
            detail="This password reset link has already been used. Please request a new link."
        )

    now = datetime.now(timezone.utc)
    expires_at = doc.get("expires_at")
    if expires_at:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if now > expires_at:
            raise HTTPException(
                status_code=400,
                detail="This password reset link has expired (30-minute limit). Please request a new link."
            )

    return {
        "valid": True,
        "masked_email": mask_email(doc.get("email", ""))
    }


@app.post("/auth/reset-password")
@app.post("/api/auth/reset-password")
async def reset_password(req: ResetPasswordRequest):
    """
    Complete password reset with a valid single-use reset token.
    Updates password hash and marks token as used.
    """
    clean_token = req.token.strip()
    new_pw = req.new_password
    confirm_pw = req.confirm_password

    if not clean_token:
        raise HTTPException(status_code=400, detail="Missing reset token.")

    if confirm_pw is not None and new_pw != confirm_pw:
        raise HTTPException(status_code=400, detail="New passwords do not match.")

    if len(new_pw) < 8 or len(new_pw) > 72:
        raise HTTPException(status_code=400, detail="Password must be between 8 and 72 characters.")
    if not re.search(r"[A-Z]", new_pw):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", new_pw):
        raise HTTPException(status_code=400, detail="Password must contain at least one lowercase letter.")
    if not re.search(r"[0-9]", new_pw):
        raise HTTPException(status_code=400, detail="Password must contain at least one digit.")

    token_hash = hashlib.sha256(clean_token.encode("utf-8")).hexdigest()
    doc = await password_reset_collection.find_one({"token_hash": token_hash})
    if not doc:
        raise HTTPException(status_code=400, detail="Invalid or unrecognized password reset token.")

    if doc.get("used", False):
        raise HTTPException(
            status_code=400,
            detail="This password reset link has already been used. Please request a new link."
        )

    now = datetime.now(timezone.utc)
    expires_at = doc.get("expires_at")
    if expires_at:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if now > expires_at:
            raise HTTPException(
                status_code=400,
                detail="This password reset link has expired. Please request a new link."
            )

    # Hash new password
    hashed_new_pw = hash_password(new_pw)

    # Update user password in MongoDB
    res = await user_collection.update_one(
        {"_id": doc["user_id"]},
        {"$set": {"password": hashed_new_pw, "updated_at": now.isoformat()}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User account not found.")

    # Mark token used immediately to prevent reuse
    await password_reset_collection.update_one(
        {"_id": doc["_id"]},
        {"$set": {"used": True, "used_at": now}}
    )

    logger.info("Password reset successfully for %s", mask_email(doc.get("email", "")))

    # Dispatch security alert email (optional notice)
    try:
        from mailer import send_password_changed_notification_email
        user_record = await user_collection.find_one({"_id": doc["user_id"]})
        if user_record and user_record.get("email"):
            send_password_changed_notification_email(
                to_email=user_record["email"],
                first_name=user_record.get("first_name")
            )
    except Exception as email_err:
        logger.warning("Could not send password changed notification: %s", email_err)

    return {
        "success": True,
        "message": "Password updated successfully. You can now log in with your new password."
    }


@app.get("/profile/me")
@app.get("/auth/me")
@app.get("/auth/profile")
async def get_user_profile(user_doc: dict = Depends(get_current_user_doc)):
    # Explicitly query scoped by _id and company_id, omitting password
    doc = await user_collection.find_one(
        {"_id": user_doc["_id"], "company_id": user_doc["company_id"]},
        {"password": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="User profile not found")

    # Verify physical file existence on disk before returning photo_url
    raw_photo = doc.get("photo_url", None)
    valid_photo = raw_photo
    if raw_photo and raw_photo.startswith("/uploads/avatars/"):
        filename = os.path.basename(raw_photo)
        filepath = os.path.join(AVATAR_DIR, filename)
        if not os.path.exists(filepath):
            valid_photo = None
            # Proactively sanitize DB record so client doesn't retry missing asset
            await user_collection.update_one(
                {"_id": user_doc["_id"]},
                {"$unset": {"photo_url": ""}}
            )

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
        "photo_url":    valid_photo
    }


@app.put("/profile/me")
async def update_user_profile(
    profile_data: UserProfileUpdate,
    user_doc: dict = Depends(get_current_user_doc)
):
    update_fields = {k: v for k, v in profile_data.dict(exclude_unset=True).items() if v is not None}

    # Ensure email is immutable as the primary account key
    update_fields.pop("email", None)

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
        update_fields["company"] = update_fields["company"].strip()

    if "country" in update_fields and update_fields["country"].strip():
        update_fields["country"] = update_fields["country"].strip()

    if "language" in update_fields and update_fields["language"].strip():
        lang_raw = update_fields["language"].strip()
        lang_map = {
            "english": "en", "en": "en",
            "hindi": "hi", "hi": "hi",
            "gujarati": "gu", "gu": "gu"
        }
        update_fields["language"] = lang_map.get(lang_raw.lower(), lang_raw)


    if "role" in update_fields and update_fields["role"].strip():
        update_fields["role"] = update_fields["role"].strip()

    if update_fields:
        await user_collection.update_one(
            {"_id": user_doc["_id"]},
            {"$set": update_fields}
        )

    updated_doc = await user_collection.find_one(
        {"_id": user_doc["_id"]},
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
            "photo_url":    (
                updated_doc.get("photo_url")
                if updated_doc.get("photo_url") and os.path.exists(os.path.join(AVATAR_DIR, os.path.basename(updated_doc["photo_url"])))
                else None
            )
        }
    }


@app.post("/profile/photo")
async def upload_profile_photo(
    file: UploadFile = File(...),
    user_doc: dict = Depends(get_current_user_doc)
):
    filename_lower = (file.filename or "").lower()
    allowed_exts = (".jpg", ".jpeg", ".png", ".webp")
    if not any(filename_lower.endswith(ext) for ext in allowed_exts):
        raise HTTPException(
            status_code=400,
            detail="Invalid file extension. Please upload a JPG, PNG, or WEBP image."
        )

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
            detail="File size exceeds maximum allowed limit of 5 MB."
        )
    if len(contents) < 12:
        raise HTTPException(
            status_code=400,
            detail="Corrupted or invalid image file."
        )

    # Validate image magic bytes integrity
    is_jpeg = contents.startswith(b"\xff\xd8\xff")
    is_png = contents.startswith(b"\x89PNG\r\n\x1a\n")
    is_webp = contents.startswith(b"RIFF") and contents[8:12] == b"WEBP"
    if not (is_jpeg or is_png or is_webp):
        raise HTTPException(
            status_code=400,
            detail="Invalid image file format or corrupt image bytes."
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
        {"_id": user_doc["_id"]},
        {"$set": {"photo_url": photo_url}}
    )

    return {
        "message": "Profile photo updated successfully",
        "photo_url": photo_url
    }


@app.delete("/profile/photo")
async def delete_profile_photo(user_doc: dict = Depends(get_current_user_doc)):
    current_doc = await user_collection.find_one({"_id": user_doc["_id"]})
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
        {"_id": user_doc["_id"]},
        {"$unset": {"photo_url": ""}}
    )
    return {"message": "Profile photo removed successfully"}


# ---------- Password & Security OTP Flow (Multi-Tenant & JWT Scoped) ----------

_pw_otp_user_store: dict = {}
_pw_otp_store_lock = _threading.Lock()
_PW_OTP_MAX_PER_HOUR = 5
_PW_OTP_WINDOW_SECONDS = 3600
_PW_OTP_COOLDOWN_SECONDS = 60

def _enforce_password_otp_rate_limits(user_id_str: str, now: datetime) -> None:
    """Enforce per-user 60s cooldown and max 5 requests per hour for password OTP."""
    now_ts = now.timestamp()
    cutoff_hour = now_ts - _PW_OTP_WINDOW_SECONDS
    cutoff_cooldown = now_ts - _PW_OTP_COOLDOWN_SECONDS

    with _pw_otp_store_lock:
        user_times = [t for t in _pw_otp_user_store.get(user_id_str, []) if t > cutoff_hour]
        if user_times:
            last_req = user_times[-1]
            if last_req > cutoff_cooldown:
                remaining = max(1, int(math.ceil(last_req + _PW_OTP_COOLDOWN_SECONDS - now_ts)))
                raise HTTPException(
                    status_code=429,
                    detail=f"Please wait {remaining} seconds before requesting a new verification code.",
                    headers={"Retry-After": str(remaining)}
                )
            if len(user_times) >= _PW_OTP_MAX_PER_HOUR:
                retry_after = max(1, int(math.ceil(user_times[0] + _PW_OTP_WINDOW_SECONDS - now_ts)))
                raise HTTPException(
                    status_code=429,
                    detail=f"Too many verification requests ({_PW_OTP_MAX_PER_HOUR} per hour). Please try again later.",
                    headers={"Retry-After": str(retry_after)}
                )
        user_times.append(now_ts)
        _pw_otp_user_store[user_id_str] = user_times


async def _handle_request_password_otp(req: PasswordOtpRequest, user_doc: dict):
    curr_pw = req.get_current_password()
    new_pw = req.get_new_password()
    conf_pw = req.get_confirm_password()

    if not curr_pw:
        raise HTTPException(status_code=400, detail="Current password is required.")

    # 1. Verify current password matches user record first (send NO email if wrong)
    current_user = await user_collection.find_one({
        "_id": user_doc["_id"],
        "company_id": user_doc["company_id"]
    })
    if not current_user or not verify_password(curr_pw, current_user.get("password", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    # 2. Check new password complexity & distinctness from current password
    if not new_pw:
        raise HTTPException(status_code=400, detail="New password is required.")

    if new_pw == curr_pw:
        raise HTTPException(status_code=400, detail="New password must be different from current password.")

    if len(new_pw) < 8 or len(new_pw) > 72 or not re.search(r"[A-Z]", new_pw) or not re.search(r"[a-z]", new_pw) or not re.search(r"[0-9]", new_pw):
        raise HTTPException(status_code=400, detail="New password does not meet complexity requirements.")

    if conf_pw and conf_pw != new_pw:
        raise HTTPException(status_code=400, detail="New passwords do not match.")

    # 3. Rate limiting: 60-second cooldown + max 5 sends per hour per user
    now = datetime.now(timezone.utc)
    _enforce_password_otp_rate_limits(str(user_doc["_id"]), now)

    # 4. Generate 6-digit secure numeric OTP with secrets module & compute bcrypt hash
    otp_code = f"{secrets.randbelow(900000) + 100000}"
    hashed_otp = hash_password(otp_code)
    expires_at = now + timedelta(minutes=10)

    # Invalidate previous OTPs for this user and purpose
    await otp_collection.delete_many({
        "user_id": user_doc["_id"],
        "purpose": "password_change"
    })

    # Store hashed OTP in MongoDB (never plaintext)
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
    try:
        from mailer import send_password_otp_email
        send_password_otp_email(
            to_email=user_doc["email"],
            otp_code=otp_code,
            first_name=user_doc.get("first_name")
        )
    except Exception as exc:
        # On email dispatch failure: clean up / delete pending OTP immediately
        await otp_collection.delete_many({
            "user_id": user_doc["_id"],
            "purpose": "password_change"
        })
        logger.exception("Password reset OTP email sending failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="We could not send the verification code right now. Please try again shortly."
        )

    # Response strictly follows security specification (NO OTP, NO dev_otp, NO debug fields)
    return {
        "success": True,
        "message": "Verification code sent",
        "masked_email": mask_email(user_doc["email"]),
        "expires_in": 600,
        "resend_after": 60
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

    # 6. Dispatch security notification email
    try:
        from mailer import send_password_changed_notification_email
        send_password_changed_notification_email(
            to_email=user_doc["email"],
            first_name=user_doc.get("first_name")
        )
    except Exception as email_err:
        logger.warning("Could not send password changed notification email: %s", email_err)

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

async def _ensure_user_notifications(user_doc_or_id, company_id: str = None):
    if isinstance(user_doc_or_id, dict):
        user_doc = user_doc_or_id
        uid_str = str(user_doc["_id"])
        cid = user_doc.get("company_id", company_id or "default")
    else:
        uid_str = str(user_doc_or_id)
        cid = company_id or "default"
        try:
            user_doc = await user_collection.find_one({"_id": ObjectId(uid_str)})
        except Exception:
            user_doc = None

    if user_doc and user_doc.get("notifications_seeded", False):
        return

    count = await notification_collection.count_documents({
        "user_id": uid_str,
        "company_id": cid
    })
    if count == 0:
        now_utc = datetime.now(timezone.utc)
        sample_notifs = [
            {
                "user_id": uid_str,
                "company_id": cid,
                "title": "Welcome to ChurnGuard",
                "message": "Your enterprise tenant workspace has been initialized with AI telemetry scoring.",
                "type": "success",
                "read": False,
                "created_at": (now_utc - timedelta(minutes=15)).isoformat()
            },
            {
                "user_id": uid_str,
                "company_id": cid,
                "title": "⚡ Batch Prediction Engine Active",
                "message": "High-risk customer segment detection model is ready for real-time inference.",
                "type": "info",
                "read": False,
                "created_at": (now_utc - timedelta(minutes=5)).isoformat()
            },
            {
                "user_id": uid_str,
                "company_id": cid,
                "title": "🚨 High Risk Churn Alert: Enterprise",
                "message": "Customer churn probability threshold exceeded (84% probability detected).",
                "type": "alert",
                "read": True,
                "created_at": now_utc.isoformat()
            }
        ]
        await notification_collection.insert_many(sample_notifs)

    if user_doc and "_id" in user_doc:
        await user_collection.update_one(
            {"_id": user_doc["_id"]},
            {"$set": {"notifications_seeded": True}}
        )


@app.get("/notifications")
async def get_notifications(user_doc: dict = Depends(get_current_user_doc)):
    uid_str = str(user_doc["_id"])
    cid = user_doc["company_id"]
    await _ensure_user_notifications(user_doc, cid)

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
            "is_read": bool(n.get("read", False)),
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
    await user_collection.update_one(
        {"_id": user_doc["_id"]},
        {"$set": {"notifications_seeded": True}}
    )
    return {"message": "All notifications cleared"}


# ---------- Sprint 4: Dataset Upload & Persistence ----------

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

    if "TotalCharges" in df.columns:
        blank_mask = df["TotalCharges"].isna() | (df["TotalCharges"].astype(str).str.strip().isin(["", "nan", "NaN", "None"]))
        blank_count = int(blank_mask.sum())
        df["TotalCharges"] = pd.to_numeric(df["TotalCharges"], errors="coerce").fillna(0)
    else:
        blank_count = 0

    if "SeniorCitizen" in df.columns:
        df["SeniorCitizen"] = df["SeniorCitizen"].map({0: "No", 1: "Yes"}).fillna(df["SeniorCitizen"])

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

@app.post("/dataset/upload")
@app.post("/dataset/store")
async def store_dataset(file: UploadFile = File(...), user_doc: dict = Depends(get_current_user_doc)):
    t_total = time.perf_counter()
    company_id   = user_doc["company_id"]
    user_id      = str(user_doc.get("_id", ""))
    current_user = user_doc.get("email", "")

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are allowed.")

    try:
        contents = await file.read()
        if not contents or len(contents.strip()) == 0:
            raise HTTPException(status_code=400, detail="Uploaded CSV file is empty.")
        try:
            df = pd.read_csv(io.BytesIO(contents), encoding="utf-8-sig")
        except Exception:
            df = pd.read_csv(io.BytesIO(contents))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV file: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail="Uploaded CSV file contains no records.")

    # Strip column names whitespace and UTF-8 BOM
    df.columns = [str(c).strip().lstrip("\ufeff") for c in df.columns]

    # Resolve customerID column case-insensitively if needed
    cid_col = "customerID" if "customerID" in df.columns else next(
        (c for c in df.columns if c.strip().lower().replace(" ", "").replace("_", "") in ("customerid", "custid", "id")), None
    )
    if cid_col and cid_col != "customerID":
        df.rename(columns={cid_col: "customerID"}, inplace=True)

    if "customerID" not in df.columns:
        raise HTTPException(status_code=400, detail="Invalid CSV: Missing required 'customerID' column.")

    required_cols = ["gender", "SeniorCitizen", "tenure", "MonthlyCharges", "TotalCharges"]
    missing_cols = [c for c in required_cols if c not in df.columns]
    if missing_cols:
        raise HTTPException(status_code=400, detail=f"Invalid CSV: Missing required customer columns: {missing_cols}")

    total_rows = len(df)

    # ── Clean / normalise ──
    if "TotalCharges" in df.columns:
        df["TotalCharges"] = pd.to_numeric(df["TotalCharges"], errors="coerce").fillna(0)

    if "SeniorCitizen" in df.columns:
        df["SeniorCitizen"] = df["SeniorCitizen"].replace({
            0: "No", 1: "Yes", "0": "No", "1": "Yes", 0.0: "No", 1.0: "Yes"
        })

    df = df.fillna("")

    records = df.to_dict(orient="records")
    if not records:
        raise HTTPException(status_code=400, detail="No valid records found in CSV file after cleaning.")

    # ── Collect incoming customerIDs from CSV ──
    incoming_ids = set()
    for rec in records:
        raw_cid = rec.get("customerID")
        if raw_cid is not None and not (isinstance(raw_cid, float) and math.isnan(raw_cid)):
            cid = str(raw_cid).strip()
            if cid.endswith(".0") and str(raw_cid).replace(".0", "").isdigit():
                cid = cid[:-2]
            if cid:
                incoming_ids.add(cid)

    # ── Fast indexed bulk lookup using compound unique index (company_id, customerID) ──
    # Avoids slow row-by-row queries or streaming full collection across network
    t_ids = time.perf_counter()
    existing_ids = set()
    if incoming_ids:
        incoming_list = list(incoming_ids)
        batch_size = 5000
        for i in range(0, len(incoming_list), batch_size):
            chunk = incoming_list[i : i + batch_size]
            cursor = telco_collection.find(
                {"company_id": company_id, "customerID": {"$in": chunk}},
                {"customerID": 1, "_id": 0}
            )
            async for doc in cursor:
                c = doc.get("customerID")
                if c:
                    existing_ids.add(str(c).strip())
    print(f"[store_dataset] existing ID index scan: {(time.perf_counter()-t_ids)*1000:.1f}ms ({len(existing_ids)} matched out of {len(incoming_ids)} incoming)")

    # ── Separate new vs duplicate records ──
    upload_id       = str(ObjectId())
    inserted_count  = 0
    duplicate_count = 0
    new_records     = []
    seen_in_batch   = set()
    now_iso         = datetime.now(timezone.utc).isoformat()

    for rec in records:
        rec.pop("_id", None)
        raw_cid = rec.get("customerID")
        if raw_cid is None or (isinstance(raw_cid, float) and math.isnan(raw_cid)):
            cid = ""
        else:
            cid = str(raw_cid).strip()
            if cid.endswith(".0") and str(raw_cid).replace(".0", "").isdigit():
                cid = cid[:-2]

        if not cid:
            continue

        if cid in existing_ids or cid in seen_in_batch:
            duplicate_count += 1
        else:
            seen_in_batch.add(cid)
            rec["customerID"]   = cid
            rec["company_id"]   = company_id
            rec["upload_id"]    = upload_id
            rec["upload_ids"]   = [upload_id]
            rec["created_at"]   = now_iso
            rec["uploaded_by"]  = current_user
            new_records.append(rec)

    # ── Tag existing duplicates with this upload_id (for shared file references) ──
    duplicate_cids = [cid for cid in incoming_ids if cid in existing_ids]
    if duplicate_cids:
        await telco_collection.update_many(
            {"company_id": company_id, "customerID": {"$in": duplicate_cids}, "upload_ids": {"$exists": False}},
            {"$set": {"upload_ids": ["legacy_prior_upload"]}}
        )
        await telco_collection.update_many(
            {"company_id": company_id, "customerID": {"$in": duplicate_cids}},
            {"$addToSet": {"upload_ids": upload_id}}
        )

    # ── Bulk insert ──
    if new_records:
        t_insert = time.perf_counter()
        try:
            insert_result = await telco_collection.insert_many(new_records, ordered=False)
            inserted_count = len(insert_result.inserted_ids)
        except Exception as e:
            logger.exception("MongoDB insert exception")
            if hasattr(e, "details") and isinstance(e.details, dict):
                inserted_count = e.details.get("nInserted", 0)
                write_errors = e.details.get("writeErrors", [])
                dup_errors = sum(1 for we in write_errors if we.get("code") == 11000)
                duplicate_count += dup_errors
                other_errors = [we for we in write_errors if we.get("code") != 11000]
                if other_errors and inserted_count == 0:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Dataset upload failed: {other_errors[0].get('errmsg', 'Write error')}"
                    )
            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"Dataset upload failed. No successful upload was recorded: {str(e)}"
                )
        print(f"[store_dataset] insert_many {inserted_count} records: {(time.perf_counter()-t_insert)*1000:.1f}ms")

    # ── Count from DB (single count_documents — no full fetch needed) ──
    total_in_db = await telco_collection.count_documents({"company_id": company_id})

    # ── Record upload history ──
    await database["dataset_uploads"].insert_one({
        "_id":               ObjectId(upload_id),
        "upload_id":         upload_id,
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
        "upload_id":            upload_id,
        "message":              "Dataset stored successfully in MongoDB Atlas",
        "total_rows":           total_rows,
        "new_records":          inserted_count,
        "inserted":             inserted_count,
        "duplicates_skipped":   duplicate_count,
        "duplicate_rows":       duplicate_count,
        "total_in_db":          total_in_db,
        "final_customer_count": total_in_db,
        "rows_stored":          inserted_count,
        "failed_rows":          0,
        "failed_invalid_rows":  0
    }


@app.get("/dataset/info")
async def dataset_info(user_doc: dict = Depends(get_current_user_doc)):
    company_id = user_doc.get("company_id")
    if not company_id:
        return {"stored": False, "message": "No dataset currently stored"}
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


# ---------- Dataset Management & Bulk Deletion Endpoints ----------

@app.get("/dataset/management/overview")
@app.get("/dataset/list")
async def get_dataset_management_overview(user_doc: dict = Depends(get_current_user_doc)):
    t0 = time.perf_counter()
    company_id = user_doc["company_id"]
    if not company_id:
        return {
            "total_datasets": 0,
            "total_customers": 0,
            "legacy_records": 0,
            "tracked_records": 0,
            "datasets": []
        }

    total_customers = await telco_collection.count_documents({"company_id": company_id})

    legacy_records = await telco_collection.count_documents({
        "company_id": company_id,
        "$or": [
            {"upload_id": {"$exists": False}},
            {"upload_id": None},
            {"upload_id": ""}
        ]
    })
    tracked_records = max(0, total_customers - legacy_records)

    # Fast aggregation of active customer records per upload_id
    pipeline = [
        {"$match": {"company_id": company_id, "upload_ids": {"$exists": True, "$ne": None}}},
        {"$unwind": "$upload_ids"},
        {"$group": {"_id": "$upload_ids", "count": {"$sum": 1}}}
    ]
    cursor = telco_collection.aggregate(pipeline)
    active_map = {}
    async for item in cursor:
        active_map[str(item["_id"])] = item["count"]

    pipeline_primary = [
        {"$match": {"company_id": company_id, "upload_id": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": "$upload_id", "count": {"$sum": 1}}}
    ]
    cursor_prim = telco_collection.aggregate(pipeline_primary)
    async for item in cursor_prim:
        uid_str = str(item["_id"])
        if uid_str not in active_map:
            active_map[uid_str] = item["count"]

    uploads_cursor = database["dataset_uploads"].find({"company_id": company_id}).sort("uploaded_at", -1)
    datasets = []
    async for doc in uploads_cursor:
        doc_id = str(doc["_id"])
        upload_id = str(doc.get("upload_id") or doc_id)

        live_count = active_map.get(upload_id) or active_map.get(doc_id) or 0

        uploaded_at = doc.get("uploaded_at") or doc.get("created_at") or ""
        if hasattr(uploaded_at, "isoformat"):
            uploaded_at = uploaded_at.isoformat()

        new_recs = int(doc.get("new_records", doc.get("inserted_rows", 0)) or 0)
        total_rows = int(doc.get("total_rows", 0) or 0)

        is_legacy = (live_count == 0 and new_recs > 0)
        if live_count > 0:
            status = "Completed"
        elif is_legacy:
            status = "Legacy (Untracked)"
        elif doc.get("status") == "success":
            status = "Completed"
        else:
            status = doc.get("status") or "Completed"

        datasets.append({
            "_id": doc_id,
            "upload_id": upload_id,
            "filename": doc.get("filename") or "dataset.csv",
            "total_rows": total_rows,
            "new_records": new_recs,
            "inserted_rows": new_recs,
            "duplicate_rows": int(doc.get("duplicate_rows", doc.get("duplicates_skipped", 0)) or 0),
            "active_records": live_count,
            "uploaded_at": uploaded_at,
            "uploaded_by": doc.get("uploaded_by") or user_doc.get("email", ""),
            "status": status,
            "is_legacy": is_legacy,
            "can_delete_safely": (live_count > 0 or not is_legacy)
        })

    elapsed = (time.perf_counter() - t0) * 1000
    print(f"[dataset/management/overview] {len(datasets)} datasets, {total_customers} custs in {elapsed:.1f}ms")

    return {
        "total_datasets": len(datasets),
        "total_customers": total_customers,
        "legacy_records": legacy_records,
        "tracked_records": tracked_records,
        "datasets": datasets
    }


@app.get("/dataset/uploads/{upload_id}/records")
@app.get("/dataset/{upload_id}/customers")
async def get_dataset_upload_records(
    upload_id: str,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=500),
    search: str = Query(default=""),
    user_doc: dict = Depends(get_current_user_doc)
):
    t0 = time.perf_counter()
    company_id = user_doc["company_id"]

    upload_filter = {"company_id": company_id}
    if ObjectId.is_valid(upload_id):
        upload_filter["$or"] = [{"_id": ObjectId(upload_id)}, {"upload_id": upload_id}]
    else:
        upload_filter["upload_id"] = upload_id

    upload_doc = await database["dataset_uploads"].find_one(upload_filter)
    actual_upload_id = str(upload_doc.get("upload_id") or upload_doc["_id"]) if upload_doc else upload_id
    id_variants = list({actual_upload_id, upload_id})
    if upload_doc:
        id_variants.append(str(upload_doc["_id"]))

    conditions = [
        {"company_id": company_id},
        {"$or": [
            {"upload_id": {"$in": id_variants}},
            {"upload_ids": {"$in": id_variants}}
        ]}
    ]

    if search and search.strip():
        clean_search = search.strip()
        conditions.append({
            "$or": [
                {"customerID":      {"$regex": re.escape(clean_search), "$options": "i"}},
                {"Contract":        {"$regex": re.escape(clean_search), "$options": "i"}},
                {"InternetService": {"$regex": re.escape(clean_search), "$options": "i"}},
            ]
        })

    query = {"$and": conditions} if len(conditions) > 1 else conditions[0]

    total = await telco_collection.count_documents(query)
    total_pages = math.ceil(total / limit) if total > 0 else 1
    skip = (page - 1) * limit
    cursor = telco_collection.find(query).sort([("_id", 1)]).skip(skip).limit(limit)
    records = await cursor.to_list(length=limit)

    for r in records:
        r["_id"] = str(r["_id"])

    if records:
        try:
            clean_page = [{k: v for k, v in r.items() if k not in ("company_id", "_id")} for r in records]
            preds = predict_batch(clean_page)
            pred_map = {p["customerID"]: p for p in preds}
            for r in records:
                p = pred_map.get(r.get("customerID"))
                if p:
                    r["risk_level"] = p.get("risk_level", "Low")
                    r["churn_probability"] = p.get("churn_probability", 0.0)
                    r["churn_prediction"] = p.get("churn_prediction", "No")
        except Exception as e:
            logger.warning(f"Fast page inference exception: {e}")

    meta = None
    if upload_doc:
        uploaded_at_val = upload_doc.get("uploaded_at") or upload_doc.get("created_at")
        if hasattr(uploaded_at_val, "isoformat"):
            uploaded_at_val = uploaded_at_val.isoformat()
        meta = {
            "upload_id": actual_upload_id,
            "filename": upload_doc.get("filename") or "dataset.csv",
            "uploaded_at": uploaded_at_val,
            "uploaded_by": upload_doc.get("uploaded_by") or "",
            "total_rows": upload_doc.get("total_rows", 0),
            "inserted_rows": upload_doc.get("new_records", upload_doc.get("inserted_rows", 0)),
            "status": upload_doc.get("status", "success")
        }

    return {
        "upload_id": actual_upload_id,
        "metadata": meta,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "records": records
    }


@app.delete("/dataset/upload/{upload_id}")
@app.delete("/dataset/uploads/{upload_id}")
async def delete_dataset_upload(
    upload_id: str,
    force: bool = Query(default=False),
    user_doc: dict = Depends(get_current_user_doc)
):
    t0 = time.perf_counter()
    company_id = user_doc["company_id"]

    upload_filter = {"company_id": company_id}
    if ObjectId.is_valid(upload_id):
        upload_filter["$or"] = [{"_id": ObjectId(upload_id)}, {"upload_id": upload_id}]
    else:
        upload_filter["upload_id"] = upload_id

    upload_doc = await database["dataset_uploads"].find_one(upload_filter)
    if not upload_doc:
        raise HTTPException(
            status_code=404,
            detail=f"Uploaded dataset '{upload_id}' not found or already deleted."
        )

    actual_upload_id  = str(upload_doc.get("upload_id") or upload_doc["_id"])
    filename          = upload_doc.get("filename", "dataset.csv")
    new_records_count = int(upload_doc.get("new_records", upload_doc.get("inserted_rows", 0)) or 0)

    id_variants = list({actual_upload_id, str(upload_doc["_id"])})

    tracked_count = await telco_collection.count_documents({
        "company_id": company_id,
        "$or": [
            {"upload_ids": {"$in": id_variants}},
            {"upload_id": {"$in": id_variants}}
        ]
    })

    if new_records_count > 0 and tracked_count == 0 and not force:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete dataset '{filename}': This file was uploaded before dataset tracking was enabled, so its records cannot be isolated safely without risking other datasets."
        )

    deleted_count = 0
    if tracked_count > 0:
        exclusive_query = {
            "company_id": company_id,
            "$or": [
                {"upload_ids": {"$size": 1, "$in": id_variants}},
                {"upload_id": {"$in": id_variants}, "upload_ids": {"$exists": False}},
                {"upload_id": {"$in": id_variants}, "upload_ids": []}
            ]
        }

        del_res = await telco_collection.delete_many(exclusive_query)
        deleted_count = del_res.deleted_count

        await telco_collection.update_many(
            {"company_id": company_id, "upload_ids": {"$in": id_variants}},
            {"$pull": {"upload_ids": {"$in": id_variants}}}
        )

    await database["dataset_uploads"].delete_one({"_id": upload_doc["_id"]})

    await database["dashboard_cache"].delete_many({"company_id": company_id})
    invalidate_metrics_cache(company_id)

    remaining_count = await telco_collection.count_documents({"company_id": company_id})

    if remaining_count > 0:
        try:
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
        except Exception as e:
            logger.warning(f"Error pre-warming dashboard cache after dataset deletion: {e}")

    print(f"[delete_dataset_upload] Deleted {deleted_count} records for '{filename}' in {(time.perf_counter()-t0)*1000:.1f}ms | remaining={remaining_count}")

    return {
        "success": True,
        "message": f"Dataset '{filename}' ({deleted_count:,} records) deleted successfully.",
        "filename": filename,
        "deleted_records": deleted_count,
        "remaining_records": remaining_count,
        "upload_id": actual_upload_id
    }


@app.post("/dataset/clear-all")
@app.delete("/dataset/clear-all")
@app.delete("/dataset/clear")
async def clear_all_dataset_data(
    request: Optional[ClearAllDatasetRequest] = None,
    user_doc: dict = Depends(get_current_user_doc)
):
    t0 = time.perf_counter()
    company_id = user_doc["company_id"]
    company_name = user_doc.get("company", "Your Company")

    del_res = await telco_collection.delete_many({"company_id": company_id})
    records_deleted = del_res.deleted_count

    up_del = await database["dataset_uploads"].delete_many({"company_id": company_id})
    datasets_deleted = up_del.deleted_count

    await database["dashboard_cache"].delete_many({"company_id": company_id})
    invalidate_metrics_cache(company_id)

    remaining_customers = await telco_collection.count_documents({"company_id": company_id})

    elapsed = (time.perf_counter() - t0) * 1000
    print(f"[clear_all_dataset_data] Cleared {records_deleted} records and {datasets_deleted} upload records for '{company_id}' ({company_name}) in {elapsed:.1f}ms")

    return {
        "success": True,
        "message": f"Successfully cleared all customer data ({records_deleted:,} records, {datasets_deleted} datasets) for {company_name}.",
        "records_deleted": records_deleted,
        "datasets_deleted": datasets_deleted,
        "remaining_records": remaining_customers
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
    customer_dict       = customer.dict()
    prediction_result   = predict_churn(customer_dict)
    explanation_result  = explain_prediction(customer_dict)
    retention_suggestions = get_retention_suggestions(
        customer_dict,
        prediction_result["churn_probability"],
        explanation_result.get("top_factors")
    )
    return {
        **prediction_result,
        **explanation_result,
        "retention_suggestions": retention_suggestions
    }

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
    retention_suggestions = get_retention_suggestions(
        customer_dict,
        prediction_result["churn_probability"],
        explanation_result.get("top_factors")
    )
    print(f"[predict/full] {(time.perf_counter()-t0)*1000:.1f}ms | risk={prediction_result['risk_level']}")

    return {
        **prediction_result,
        **explanation_result,
        **recommendation_result,
        "retention_suggestions": retention_suggestions
    }


@app.post("/predict/selected")
async def predict_selected_customers(
    payload: PredictSelectedRequest,
    user_doc: dict = Depends(get_current_user_doc)
):
    t0 = time.perf_counter()
    company_id = user_doc["company_id"]

    conditions = [{"company_id": company_id}]

    if payload.select_all_matching:
        if payload.search and payload.search.strip():
            clean_search = payload.search.strip()
            conditions.append({
                "$or": [
                    {"customerID":      {"$regex": re.escape(clean_search), "$options": "i"}},
                    {"Contract":        {"$regex": re.escape(clean_search), "$options": "i"}},
                    {"InternetService": {"$regex": re.escape(clean_search), "$options": "i"}},
                ]
            })
        if payload.upload_id and payload.upload_id.strip() and payload.upload_id.strip().lower() != "all":
            uid = payload.upload_id.strip()
            conditions.append({
                "$or": [
                    {"upload_id": uid},
                    {"upload_ids": uid}
                ]
            })
        if payload.risk_level and payload.risk_level.strip() and payload.risk_level.strip().lower() != "all":
            r_low = payload.risk_level.strip().lower()
            if r_low == "high":
                conditions.append({
                    "Contract": "Month-to-month",
                    "$or": [
                        {"tenure": {"$lt": 12}},
                        {"$expr": {"$lt": [{"$toDouble": "$tenure"}, 12]}}
                    ]
                })
            elif r_low == "medium":
                conditions.append({
                    "Contract": "Month-to-month",
                    "$or": [
                        {"tenure": {"$gte": 12, "$lt": 24}},
                        {"$expr": {"$and": [{"$gte": [{"$toDouble": "$tenure"}, 12]}, {"$lt": [{"$toDouble": "$tenure"}, 24]}]}}
                    ]
                })
            elif r_low == "low":
                conditions.append({
                    "$or": [
                        {"Contract": {"$ne": "Month-to-month"}},
                        {"tenure": {"$gte": 24}},
                        {"$expr": {"$gte": [{"$toDouble": "$tenure"}, 24]}}
                    ]
                })
        if payload.deselected_ids:
            conditions.append({"customerID": {"$nin": payload.deselected_ids}})
    else:
        cids = payload.customer_ids or []
        if not cids:
            raise HTTPException(status_code=400, detail="No customers selected for analysis.")
        conditions.append({"customerID": {"$in": cids}})

    query = {"$and": conditions} if len(conditions) > 1 else conditions[0]

    projection = {
        "customerID": 1, "company_id": 1,
        "gender": 1, "SeniorCitizen": 1, "Partner": 1, "Dependents": 1,
        "tenure": 1, "PhoneService": 1, "MultipleLines": 1, "InternetService": 1,
        "OnlineSecurity": 1, "OnlineBackup": 1, "DeviceProtection": 1,
        "TechSupport": 1, "StreamingTV": 1, "StreamingMovies": 1,
        "Contract": 1, "PaperlessBilling": 1, "PaymentMethod": 1,
        "MonthlyCharges": 1, "TotalCharges": 1, "_id": 1
    }

    cursor = telco_collection.find(query, projection)
    matched_customers = await cursor.to_list(length=None)

    if not matched_customers:
        raise HTTPException(status_code=404, detail="No matching customer records found for the selection.")

    for c in matched_customers:
        c["_id"] = str(c["_id"])

    clean_customers = [{k: v for k, v in c.items() if k not in ("company_id", "_id")} for c in matched_customers]

    batch_results = predict_batch(clean_customers)

    for orig, res in zip(matched_customers, batch_results):
        res["MonthlyCharges"] = orig.get("MonthlyCharges")
        res["TotalCharges"] = orig.get("TotalCharges")
        res["InternetService"] = orig.get("InternetService")
        res["PaymentMethod"] = orig.get("PaymentMethod")

    high_count   = sum(1 for r in batch_results if r.get("risk_level") == "High")
    medium_count = sum(1 for r in batch_results if r.get("risk_level") == "Medium")
    low_count    = sum(1 for r in batch_results if r.get("risk_level") == "Low")
    total_analyzed = len(batch_results)

    sorted_by_risk = sorted(batch_results, key=lambda x: x.get("churn_probability", 0), reverse=True)
    primary_res = sorted_by_risk[0] if sorted_by_risk else None

    primary_explanation = None
    primary_recommendation = None
    primary_customer_id = None

    if primary_res:
        primary_customer_id = primary_res.get("customerID")
        raw_primary = next((c for c in clean_customers if c.get("customerID") == primary_customer_id), clean_customers[0])
        try:
            primary_explanation = explain_prediction(raw_primary)
            primary_recommendation = generate_recommendations(
                raw_primary,
                primary_explanation.get("top_factors", []),
                primary_res.get("risk_level", "Medium")
            )
        except Exception as e:
            logger.warning(f"Error computing SHAP for primary customer {primary_customer_id}: {e}")

    elapsed = (time.perf_counter() - t0) * 1000
    print(f"[predict/selected] {total_analyzed} analyzed in {elapsed:.1f}ms | high={high_count} med={medium_count} low={low_count}")

    return {
        "total_analyzed": total_analyzed,
        "high_risk_count": high_count,
        "medium_risk_count": medium_count,
        "low_risk_count": low_count,
        "results": batch_results,
        "primary_customer_id": primary_customer_id,
        "primary_explanation": primary_explanation,
        "primary_recommendation": primary_recommendation
    }


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
    company_id = user_doc.get("company_id")
    if not company_id:
        return {
            "available":         True,
            "total_analyzed":    0,
            "high_risk_count":   0,
            "medium_risk_count": 0,
            "low_risk_count":    0,
            "total_mrr":         0.0,
            "avg_churn_rate":    0.0,
            "plan_distribution": [],
            "risk_by_contract":  [],
            "risk_by_tenure":    [],
            "high_risk_profile": [],
            "results":           []
        }

    # 1. Always check real customer count in MongoDB for this company
    actual_count = await telco_collection.count_documents({"company_id": company_id})
    if actual_count == 0:
        await database["dashboard_cache"].delete_many({"company_id": company_id})
        return {
            "available":         True,
            "total_analyzed":    0,
            "high_risk_count":   0,
            "medium_risk_count": 0,
            "low_risk_count":    0,
            "total_mrr":         0.0,
            "avg_churn_rate":    0.0,
            "plan_distribution": [],
            "risk_by_contract":  [],
            "risk_by_tenure":    [],
            "high_risk_profile": [],
            "results":           []
        }

    # 2. Serve from cache only if total_analyzed in cache matches actual DB count
    cached = await database["dashboard_cache"].find_one({"company_id": company_id})
    if cached and cached.get("total_analyzed") == actual_count:
        clean = {k: v for k, v in cached.items() if k != "_id"}
        print(f"[dashboard/stats] cache HIT: {(time.perf_counter()-t0)*1000:.1f}ms | total={actual_count}")
        return {"available": True, **clean}

    # 3. Customer count changed or cold compute: recompute fresh summary from real DB records
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
    print(f"[dashboard/stats] freshly computed: {(time.perf_counter()-t0)*1000:.1f}ms | total={actual_count}")
    return summary


@app.get("/uploads/history")
async def get_upload_history(limit: int = 10, user_doc: dict = Depends(get_current_user_doc)):
    company_id = user_doc.get("company_id")
    if not company_id:
        return []
    cursor = (
        database["dataset_uploads"]
        .find({"company_id": company_id})
        .sort("uploaded_at", -1)
        .limit(limit)
    )
    history = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        doc["upload_id"] = str(doc.get("upload_id") or doc["_id"])
        if "uploaded_at" in doc and hasattr(doc["uploaded_at"], "isoformat"):
            doc["uploaded_at"] = doc["uploaded_at"].isoformat()
        history.append(doc)
    return history


@app.get("/ml/metrics")
async def get_ml_metrics(user_doc: dict = Depends(get_current_user_doc)):
    t0 = time.perf_counter()
    company_id = user_doc.get("company_id")
    if not company_id:
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
    company_id = user_doc.get("company_id")
    if not company_id:
        return []
    count = await telco_collection.count_documents({"company_id": company_id})
    if count == 0:
        return []
    return await get_segment_profiles(company_id=company_id)


@app.get("/analytics/revenue-at-risk")
async def get_revenue_at_risk(user_doc: dict = Depends(get_current_user_doc)):
    t0 = time.perf_counter()
    company_id = user_doc["company_id"]

    projection = {
        "customerID": 1, "company_id": 1,
        "gender": 1, "SeniorCitizen": 1, "Partner": 1, "Dependents": 1,
        "tenure": 1, "PhoneService": 1, "MultipleLines": 1, "InternetService": 1,
        "OnlineSecurity": 1, "OnlineBackup": 1, "DeviceProtection": 1,
        "TechSupport": 1, "StreamingTV": 1, "StreamingMovies": 1,
        "Contract": 1, "PaperlessBilling": 1, "PaymentMethod": 1,
        "MonthlyCharges": 1, "TotalCharges": 1, "_id": 1
    }

    cursor = telco_collection.find({"company_id": company_id}, projection)
    raw_customers = await cursor.to_list(length=None)

    empty_response = {
        "available": False,
        "message": "No customer records found. Please upload a dataset first.",
        "total_monthly_revenue": 0.0,
        "monthly_revenue_at_risk": 0.0,
        "expected_monthly_loss": 0.0,
        "annual_revenue_at_risk": 0.0,
        "high_risk_customer_count": 0,
        "percent_revenue_at_risk": 0.0,
        "top_10_at_risk_customers": []
    }

    if not raw_customers:
        return empty_response

    # Verify if dataset has a revenue column
    has_revenue = any(c.get("MonthlyCharges") is not None for c in raw_customers)
    if not has_revenue:
        empty_response["message"] = "Dataset has no revenue column (MonthlyCharges)."
        return empty_response

    clean_customers = [{k: v for k, v in c.items() if k != "company_id"} for c in raw_customers]
    predictions = predict_batch(clean_customers)

    total_monthly_revenue = 0.0
    monthly_revenue_at_risk = 0.0
    expected_monthly_loss = 0.0
    high_risk_count = 0
    at_risk_list = []

    for cust, pred in zip(clean_customers, predictions):
        try:
            raw_mc = cust.get("MonthlyCharges")
            mc = float(raw_mc) if raw_mc is not None and str(raw_mc).strip() != "" else 0.0
            if math.isnan(mc):
                mc = 0.0
        except (ValueError, TypeError):
            mc = 0.0

        total_monthly_revenue += mc
        prob_pct = float(pred.get("churn_probability") or 0.0)
        prob_dec = prob_pct / 100.0
        exp_loss = mc * prob_dec
        expected_monthly_loss += exp_loss

        risk_level = pred.get("risk_level", "Low")
        if risk_level == "High" or pred.get("churn_prediction") == "Yes":
            monthly_revenue_at_risk += mc
            high_risk_count += 1

        cid = cust.get("customerID") or str(cust.get("_id") or "")
        at_risk_list.append({
            "customerID": cid,
            "monthly_charges": round(mc, 2),
            "churn_probability": round(prob_pct, 2),
            "risk_level": risk_level,
            "contract": cust.get("Contract", "Unknown"),
            "tenure": cust.get("tenure", 0),
            "expected_monthly_loss": round(exp_loss, 2)
        })

    # Sort at-risk customers: prioritize high/medium risk and expected loss
    at_risk_list.sort(key=lambda x: (x["risk_level"] == "High", x["expected_monthly_loss"], x["monthly_charges"]), reverse=True)
    top_10 = at_risk_list[:10]

    annual_revenue_at_risk = round(monthly_revenue_at_risk * 12.0, 2)
    percent_revenue_at_risk = round((monthly_revenue_at_risk / total_monthly_revenue * 100.0), 2) if total_monthly_revenue > 0 else 0.0

    print(f"[revenue-at-risk] {len(clean_customers)} customers evaluated in {(time.perf_counter()-t0)*1000:.1f}ms")

    return {
        "available": True,
        "total_monthly_revenue": round(total_monthly_revenue, 2),
        "monthly_revenue_at_risk": round(monthly_revenue_at_risk, 2),
        "expected_monthly_loss": round(expected_monthly_loss, 2),
        "annual_revenue_at_risk": annual_revenue_at_risk,
        "high_risk_customer_count": high_risk_count,
        "percent_revenue_at_risk": percent_revenue_at_risk,
        "top_10_at_risk_customers": top_10
    }


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
    predictions = predict_batch(clean)

    # Merge customer records with ML prediction metrics
    results = []
    for orig, pred in zip(clean, predictions):
        rec = dict(orig)
        rec["churn_prediction"]  = pred.get("churn_prediction", "No")
        prob = pred.get("churn_probability", 0.0)
        rec["churn_probability"] = prob
        risk = pred.get("risk_level", "Low")
        rec["risk_level"]        = risk
        try:
            mc = float(orig.get("MonthlyCharges", 0.0) or 0.0)
        except (ValueError, TypeError):
            mc = 0.0
        rec["expected_monthly_loss"] = round(mc * (prob / 100.0), 2)
        rec["annual_revenue_at_risk"] = round(mc * 12.0, 2) if risk == "High" else 0.0
        results.append(rec)

    if risk_level != "All":
        results = [r for r in results if r["risk_level"] == risk_level]

    if not results:
        raise HTTPException(
            status_code=404,
            detail=f"No customers found matching risk level: {risk_level}"
        )

    df = pd.DataFrame(results)

    # Sanitize string fields against CSV formula injection (=, +, -, @)
    dangerous_starts = ("=", "@", "+", "-")
    for col in df.select_dtypes(include=["object"]).columns:
        df[col] = df[col].apply(
            lambda x: f"'{x}" if isinstance(x, str) and x.startswith(dangerous_starts) and not re.match(r"^[-+]?\d+(\.\d+)?$", x) else x
        )

    stream = io.StringIO()
    df.to_csv(stream, index=False)
    print(f"[reports/csv] {len(results)} rows ({risk_level}): {(time.perf_counter()-t0)*1000:.1f}ms")

    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    safe_risk = re.sub(r"[^a-zA-Z0-9_-]", "", risk_level.lower()) if risk_level else "all"
    filename = f"ChurnGuard_churndata_{safe_risk}_{date_str}.csv"

    response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


# ---------- Telco Customers (CSV-uploaded dataset) — Paginated ----------

@app.get("/telco/customers")
@app.get("/customers")
async def get_telco_customers(
    page:        int = Query(default=1,  ge=1),
    limit:       int = Query(default=50, ge=1, le=500),
    search:      str = Query(default=""),
    risk_level:  Optional[str] = Query(default=None),
    upload_id:   Optional[str] = Query(default=None),
    user_doc:    dict = Depends(get_current_user_doc)
):
    t0 = time.perf_counter()
    company_id = user_doc.get("company_id")
    if not company_id:
        return {
            "total":       0,
            "page":        page,
            "limit":       limit,
            "total_pages": 1,
            "records":     []
        }

    conditions = [{"company_id": company_id}]

    if search and search.strip():
        clean_search = search.strip()
        conditions.append({
            "$or": [
                {"customerID":      {"$regex": re.escape(clean_search), "$options": "i"}},
                {"Contract":        {"$regex": re.escape(clean_search), "$options": "i"}},
                {"InternetService": {"$regex": re.escape(clean_search), "$options": "i"}},
            ]
        })

    if upload_id and upload_id.strip() and upload_id.strip().lower() != "all":
        uid = upload_id.strip()
        conditions.append({
            "$or": [
                {"upload_id": uid},
                {"upload_ids": uid}
            ]
        })

    if risk_level and risk_level.strip() and risk_level.strip().lower() != "all":
        r_low = risk_level.strip().lower()
        if r_low == "high":
            conditions.append({
                "Contract": "Month-to-month",
                "$or": [
                    {"tenure": {"$lt": 12}},
                    {"$expr": {"$lt": [{"$toDouble": "$tenure"}, 12]}}
                ]
            })
        elif r_low == "medium":
            conditions.append({
                "Contract": "Month-to-month",
                "$or": [
                    {"tenure": {"$gte": 12, "$lt": 24}},
                    {"$expr": {"$and": [{"$gte": [{"$toDouble": "$tenure"}, 12]}, {"$lt": [{"$toDouble": "$tenure"}, 24]}]}}
                ]
            })
        elif r_low == "low":
            conditions.append({
                "$or": [
                    {"Contract": {"$ne": "Month-to-month"}},
                    {"tenure": {"$gte": 24}},
                    {"$expr": {"$gte": [{"$toDouble": "$tenure"}, 24]}}
                ]
            })

    query = {"$and": conditions} if len(conditions) > 1 else conditions[0]

    total       = await telco_collection.count_documents(query)
    total_pages = math.ceil(total / limit) if total > 0 else 1
    skip        = (page - 1) * limit
    cursor      = telco_collection.find(query).sort([("_id", 1)]).skip(skip).limit(limit)
    records     = await cursor.to_list(length=limit)

    for r in records:
        r["_id"] = str(r["_id"])

    # Vectorized fast inference on page records for real calibrated risk levels
    if records:
        try:
            clean_page = [{k: v for k, v in r.items() if k not in ("company_id", "_id")} for r in records]
            preds = predict_batch(clean_page)
            pred_map = {p["customerID"]: p for p in preds}
            for r in records:
                p = pred_map.get(r.get("customerID"))
                if p:
                    r["risk_level"] = p.get("risk_level", "Low")
                    r["churn_probability"] = p.get("churn_probability", 0.0)
                    r["churn_prediction"] = p.get("churn_prediction", "No")
        except Exception as e:
            logger.warning(f"Fast page inference exception: {e}")

    print(f"[telco/customers] page={page} limit={limit} search={search!r} total={total} fetched={len(records)} time={(time.perf_counter()-t0)*1000:.1f}ms")

    return {
        "data":        records,
        "records":     records,
        "page":        page,
        "limit":       limit,
        "total":       total,
        "total_pages": total_pages
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
    update_fields.pop("company_id", None)
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

    remaining_count = await telco_collection.count_documents({"company_id": company_id})

    print(f"[delete_telco] customer_id={customer_id!r}: {(time.perf_counter()-t0)*1000:.1f}ms | remaining={remaining_count}")
    return {
        "message": f"Customer '{customer_id}' deleted successfully",
        "total": remaining_count,
        "total_in_db": remaining_count
    }


# Static file mount for user profile avatars (mounted after all API routes so routes like /uploads/history take precedence)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")