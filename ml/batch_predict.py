import sys
import os
import time
import pandas as pd

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from ml.predict import model, encode_customer, FEATURE_COLUMNS

CHURN_THRESHOLD = 0.35


def encode_customer_dict(customer: dict) -> dict:
    """Fast in-memory dictionary encoder avoiding per-row DataFrame allocations."""
    return {
        "gender": 1 if customer.get("gender") == "Male" else 0,
        "SeniorCitizen": 1 if customer.get("SeniorCitizen") in ("Yes", 1, "1", 1.0) else 0,
        "Partner": 1 if customer.get("Partner") == "Yes" else 0,
        "Dependents": 1 if customer.get("Dependents") == "Yes" else 0,
        "tenure": float(customer.get("tenure") or 0),
        "PhoneService": 1 if customer.get("PhoneService") == "Yes" else 0,
        "PaperlessBilling": 1 if customer.get("PaperlessBilling") == "Yes" else 0,
        "MonthlyCharges": float(customer.get("MonthlyCharges") or 0),
        "TotalCharges": float(customer.get("TotalCharges") or 0),
        "MultipleLines": 1 if customer.get("MultipleLines") == "Yes" else 0,
        "OnlineSecurity": 1 if customer.get("OnlineSecurity") == "Yes" else 0,
        "OnlineBackup": 1 if customer.get("OnlineBackup") == "Yes" else 0,
        "DeviceProtection": 1 if customer.get("DeviceProtection") == "Yes" else 0,
        "TechSupport": 1 if customer.get("TechSupport") == "Yes" else 0,
        "StreamingTV": 1 if customer.get("StreamingTV") == "Yes" else 0,
        "StreamingMovies": 1 if customer.get("StreamingMovies") == "Yes" else 0,
        "InternetService_Fiber optic": 1 if customer.get("InternetService") == "Fiber optic" else 0,
        "InternetService_No": 1 if customer.get("InternetService") == "No" else 0,
        "Contract_One year": 1 if customer.get("Contract") == "One year" else 0,
        "Contract_Two year": 1 if customer.get("Contract") == "Two year" else 0,
        "PaymentMethod_Credit card (automatic)": 1 if customer.get("PaymentMethod") == "Credit card (automatic)" else 0,
        "PaymentMethod_Electronic check": 1 if customer.get("PaymentMethod") == "Electronic check" else 0,
        "PaymentMethod_Mailed check": 1 if customer.get("PaymentMethod") == "Mailed check" else 0,
    }


def predict_batch(customers: list[dict]) -> list[dict]:
    """
    High-performance vectorized batch prediction — all customers are encoded
    into a flat list of dictionaries, converted in one shot into a single DataFrame,
    and evaluated via model.predict_proba() in a single vectorized matrix call.
    """
    if not customers:
        return []

    t0 = time.perf_counter()

    # ── Phase 1: fast dictionary encoding ──
    row_dicts = []
    row_indices = []          # track which original index each row maps to
    failed_indices = set()

    for i, customer in enumerate(customers):
        try:
            row_dict = encode_customer_dict(customer)
            row_dicts.append(row_dict)
            row_indices.append(i)
        except Exception:
            failed_indices.add(i)

    results = [None] * len(customers)

    if row_dicts:
        # ── Phase 2: single vectorized model call ──
        X_all = pd.DataFrame(row_dicts)[FEATURE_COLUMNS]
        probabilities = model.predict_proba(X_all)[:, 1]

        for j, i in enumerate(row_indices):
            probability = float(probabilities[j])
            prediction  = 1 if probability >= CHURN_THRESHOLD else 0
            risk_level  = (
                "High"   if probability >= 0.6  else
                "Medium" if probability >= 0.35 else
                "Low"
            )
            customer = customers[i]
            results[i] = {
                "customerID":        customer.get("customerID"),
                "churn_prediction":  "Yes" if prediction == 1 else "No",
                "churn_probability": round(probability * 100, 2),
                "risk_level":        risk_level,
                "Contract":          customer.get("Contract"),
                "tenure":            customer.get("tenure"),
            }

    # ── Phase 3: filter out None slots (failed encodings) ──
    valid_results = [r for r in results if r is not None]

    elapsed = time.perf_counter() - t0
    print(
        f"[batch_predict] {len(customers)} customers -> "
        f"{len(valid_results)} results | "
        f"vectorized={len(row_dicts)} failed={len(failed_indices)} | "
        f"{elapsed * 1000:.1f}ms"
    )

    return valid_results


def tenure_bucket(tenure):
    if tenure is None:
        return "Unknown"
    if tenure <= 12:
        return "0-12 months"
    if tenure <= 24:
        return "13-24 months"
    if tenure <= 48:
        return "25-48 months"
    return "49+ months"


def build_aggregates(results: list[dict]) -> dict:
    by_contract = {}
    by_tenure   = {}

    for r in results:
        contract = r.get("Contract") or "Unknown"
        by_contract.setdefault(contract, {"High": 0, "Medium": 0, "Low": 0})
        by_contract[contract][r["risk_level"]] += 1

        bucket = tenure_bucket(r.get("tenure"))
        by_tenure.setdefault(bucket, {"High": 0, "Medium": 0, "Low": 0})
        by_tenure[bucket][r["risk_level"]] += 1

    bucket_order = ["0-12 months", "13-24 months", "25-48 months", "49+ months"]
    by_tenure_list = [
        {"bucket": b, **by_tenure.get(b, {"High": 0, "Medium": 0, "Low": 0})}
        for b in bucket_order if b in by_tenure
    ]

    by_contract_list = [
        {"contract": c, **counts} for c, counts in by_contract.items()
    ]

    return {
        "risk_by_contract": by_contract_list,
        "risk_by_tenure":   by_tenure_list,
    }