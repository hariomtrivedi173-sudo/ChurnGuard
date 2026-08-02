from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from bson import ObjectId

from database import customer_collection, user_collection
from auth import hash_password, verify_password, create_access_token, get_current_user

from fastapi import UploadFile, File
import pandas as pd
import io

from database import customer_collection, user_collection, telco_collection

app = FastAPI(
    title="ChurnGuard API",
    description="AI-powered customer churn prediction and retention system",
    version="1.0.0"
)

# ---------- Pydantic Models ----------

class Customer(BaseModel):
    name: str
    age: int
    plan: str
    monthly_charges: float
    is_active: bool = True


class CustomerResponse(BaseModel):
    name: str
    plan: str
    is_active: bool
    welcome_message: str


class User(BaseModel):
    email: str
    password: str


# ---------- Helper: convert MongoDB's document into clean JSON ----------

def customer_helper(doc) -> dict:
    return {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "age": doc["age"],
        "plan": doc["plan"],
        "monthly_charges": doc["monthly_charges"],
        "is_active": doc["is_active"],
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
async def create_customer(customer: Customer, current_user: str = Depends(get_current_user)):
    new_customer = customer.dict()
    result = await customer_collection.insert_one(new_customer)
    return CustomerResponse(
        name=customer.name,
        plan=customer.plan,
        is_active=customer.is_active,
        welcome_message=f"Welcome aboard, {customer.name}! Your ID is {result.inserted_id}."
    )


@app.get("/customers/all")
async def get_all_customers(current_user: str = Depends(get_current_user)):
    customers = []
    async for doc in customer_collection.find():
        customers.append(customer_helper(doc))
    return customers


@app.get("/customers/{customer_id}")
async def get_one_customer(customer_id: str, current_user: str = Depends(get_current_user)):
    if not ObjectId.is_valid(customer_id):
        raise HTTPException(status_code=400, detail="Invalid customer ID format")

    doc = await customer_collection.find_one({"_id": ObjectId(customer_id)})
    if doc is None:
        raise HTTPException(status_code=404, detail=f"No customer found with ID {customer_id}")
    return customer_helper(doc)


@app.put("/customers/{customer_id}")
async def update_customer(customer_id: str, customer: Customer, current_user: str = Depends(get_current_user)):
    if not ObjectId.is_valid(customer_id):
        raise HTTPException(status_code=400, detail="Invalid customer ID format")

    result = await customer_collection.update_one(
        {"_id": ObjectId(customer_id)},
        {"$set": customer.dict()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"No customer found with ID {customer_id}")

    updated_doc = await customer_collection.find_one({"_id": ObjectId(customer_id)})
    return {
        "message": f"Customer {customer_id} updated successfully",
        "customer": customer_helper(updated_doc)
    }


@app.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, current_user: str = Depends(get_current_user)):
    if not ObjectId.is_valid(customer_id):
        raise HTTPException(status_code=400, detail="Invalid customer ID format")

    doc = await customer_collection.find_one({"_id": ObjectId(customer_id)})
    if doc is None:
        raise HTTPException(status_code=404, detail=f"No customer found with ID {customer_id}")

    await customer_collection.delete_one({"_id": ObjectId(customer_id)})
    return {
        "message": f"Customer {customer_id} deleted successfully",
        "deleted_customer": customer_helper(doc),
        "deleted_by": current_user
    }


# ---------- Sprint 3: Authentication — stays OPEN (no login required) ----------

@app.post("/register")
async def register_user(user: User):
    existing = await user_collection.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pw = hash_password(user.password)
    await user_collection.insert_one({
        "email": user.email,
        "password": hashed_pw
    })
    return {"message": f"User {user.email} registered successfully"}


@app.post("/login")
async def login_user(user: User):
    existing = await user_collection.find_one({"email": user.email})
    if not existing:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(user.password, existing["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}

# ---------- Sprint 4: Dataset Upload ----------

@app.post("/dataset/upload")
async def upload_dataset(file: UploadFile = File(...), current_user: str = Depends(get_current_user)):
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
async def inspect_dataset(file: UploadFile = File(...), current_user: str = Depends(get_current_user)):
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
async def validate_dataset(file: UploadFile = File(...), current_user: str = Depends(get_current_user)):
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
async def clean_dataset(file: UploadFile = File(...), current_user: str = Depends(get_current_user)):
    contents = await file.read()
    df = pd.read_csv(io.BytesIO(contents))

    # Step 1: Find rows where TotalCharges is blank/whitespace, not a real number
    blank_mask = df["TotalCharges"].str.strip() == ""
    blank_count = int(blank_mask.sum())

    # Step 2: Convert TotalCharges to real numbers; anything that fails becomes NaN (missing)
    df["TotalCharges"] = pd.to_numeric(df["TotalCharges"], errors="coerce")

    # Step 3: Fill those missing values with 0 (makes sense: tenure=0 customers haven't been charged yet)
    df["TotalCharges"] = df["TotalCharges"].fillna(0)

    # Step 4: Convert SeniorCitizen from 0/1 into Yes/No, matching your other columns
    df["SeniorCitizen"] = df["SeniorCitizen"].map({0: "No", 1: "Yes"})

    # Step 5: Remove any exact duplicate rows, if they exist
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
async def store_dataset(file: UploadFile = File(...), current_user: str = Depends(get_current_user)):
    contents = await file.read()
    df = pd.read_csv(io.BytesIO(contents))

    # Clean it (same steps as Phase 4)
    df["TotalCharges"] = pd.to_numeric(df["TotalCharges"], errors="coerce")
    df["TotalCharges"] = df["TotalCharges"].fillna(0)
    df["SeniorCitizen"] = df["SeniorCitizen"].map({0: "No", 1: "Yes"})
    df = df.drop_duplicates()

    # Clear out any previous upload, so we don't keep piling up duplicates
    await telco_collection.delete_many({})

    # Convert the cleaned table into a list of dictionaries, then insert all at once
    records = df.to_dict(orient="records")
    result = await telco_collection.insert_many(records)

    return {
        "filename": file.filename,
        "message": "Dataset cleaned and stored successfully",
        "rows_stored": len(result.inserted_ids)
    }
@app.get("/dataset/info")
async def dataset_info(current_user: str = Depends(get_current_user)):
    count = await telco_collection.count_documents({})
    if count == 0:
        return {"stored": False, "message": "No dataset currently stored"}

    sample = await telco_collection.find_one()
    sample["_id"] = str(sample["_id"])

    return {
        "stored": True,
        "total_records": count,
        "sample_record": sample
    }


@app.delete("/dataset/clear")
async def clear_dataset(current_user: str = Depends(get_current_user)):
    result = await telco_collection.delete_many({})
    return {
        "message": "Dataset cleared successfully",
        "records_deleted": result.deleted_count
    }