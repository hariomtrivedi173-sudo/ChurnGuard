import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from ml.predict import model, FEATURE_COLUMNS, encode_customer

CHURN_THRESHOLD = 0.35


def predict_batch(customers: list[dict]) -> list[dict]:
    results = []

    for customer in customers:
        try:
            X = encode_customer(customer)
            probability = model.predict_proba(X)[0][1]
            prediction = 1 if probability >= CHURN_THRESHOLD else 0

            risk_level = (
                "High" if probability >= 0.6 else
                "Medium" if probability >= 0.35 else
                "Low"
            )

            results.append({
                "customerID": customer.get("customerID"),
                "churn_prediction": "Yes" if prediction == 1 else "No",
                "churn_probability": round(float(probability) * 100, 2),
                "risk_level": risk_level,
                "Contract": customer.get("Contract"),
                "tenure": customer.get("tenure"),
            })
        except Exception:
            continue

    return results


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
    by_tenure = {}

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
        "risk_by_tenure": by_tenure_list,
    }