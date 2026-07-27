from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def home():
    return {"message": "Welcome to ChurnGuard"}


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

@app.get("/customers")
def list_customers(active: bool = True, page: int = 1, limit: int = 10):
    return {
        "active_only": active,
        "page": page,
        "limit": limit,
        "message": f"Showing page {page} of customers (active={active}, limit={limit} per page)"
    }


@app.get("/customers/search")
def search_customers(name: str = None, min_spend: float = None):
    return {
        "search_name": name,
        "min_spend": min_spend,
        "message": "Searching customers with the given filters"
    }