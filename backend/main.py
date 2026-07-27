from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from bson import ObjectId

from database import customer_collection

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
        "sprint": "Sprint 2 - MongoDB Connected"
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


# ---------- Phase 3: Query Parameters ----------

@app.get("/customers/search")
def search_customers(name: str = None, min_spend: float = None):
    return {
        "search_name": name,
        "min_spend": min_spend,
        "message": "Searching customers with the given filters"
    }


# ---------- Full CRUD APIs — now using REAL MongoDB Atlas ----------

@app.post("/customers", response_model=CustomerResponse)
async def create_customer(customer: Customer):
    new_customer = customer.dict()
    result = await customer_collection.insert_one(new_customer)
    return CustomerResponse(
        name=customer.name,
        plan=customer.plan,
        is_active=customer.is_active,
        welcome_message=f"Welcome aboard, {customer.name}! Your ID is {result.inserted_id}."
    )


@app.get("/customers/all")
async def get_all_customers():
    customers = []
    async for doc in customer_collection.find():
        customers.append(customer_helper(doc))
    return customers


@app.get("/customers/{customer_id}")
async def get_one_customer(customer_id: str):
    if not ObjectId.is_valid(customer_id):
        raise HTTPException(status_code=400, detail="Invalid customer ID format")

    doc = await customer_collection.find_one({"_id": ObjectId(customer_id)})
    if doc is None:
        raise HTTPException(status_code=404, detail=f"No customer found with ID {customer_id}")
    return customer_helper(doc)


@app.put("/customers/{customer_id}")
async def update_customer(customer_id: str, customer: Customer):
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
async def delete_customer(customer_id: str):
    if not ObjectId.is_valid(customer_id):
        raise HTTPException(status_code=400, detail="Invalid customer ID format")

    doc = await customer_collection.find_one({"_id": ObjectId(customer_id)})
    if doc is None:
        raise HTTPException(status_code=404, detail=f"No customer found with ID {customer_id}")

    await customer_collection.delete_one({"_id": ObjectId(customer_id)})
    return {
        "message": f"Customer {customer_id} deleted successfully",
        "deleted_customer": customer_helper(doc)
    }