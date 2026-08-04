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
            })
        except Exception:
            # Skip any row that doesn't encode cleanly, rather than failing the whole batch
            continue

    return results