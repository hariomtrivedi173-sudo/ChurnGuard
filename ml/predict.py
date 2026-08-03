import os
import joblib
import pandas as pd

MODEL_PATH = os.path.join(os.path.dirname(__file__), "saved_models", "voting_ensemble.pkl")
model = joblib.load(MODEL_PATH)

# These must exactly match the column order used during training
FEATURE_COLUMNS = [
    'gender', 'SeniorCitizen', 'Partner', 'Dependents', 'tenure',
    'PhoneService', 'MultipleLines', 'OnlineSecurity', 'OnlineBackup',
    'DeviceProtection', 'TechSupport', 'StreamingTV', 'StreamingMovies',
    'PaperlessBilling', 'MonthlyCharges', 'TotalCharges',
    'InternetService_Fiber optic', 'InternetService_No',
    'Contract_One year', 'Contract_Two year',
    'PaymentMethod_Credit card (automatic)',
    'PaymentMethod_Electronic check', 'PaymentMethod_Mailed check'
]


def encode_customer(customer: dict) -> pd.DataFrame:
    row = {}

    row["gender"] = 1 if customer["gender"] == "Male" else 0
    row["SeniorCitizen"] = 1 if customer["SeniorCitizen"] == "Yes" else 0
    row["Partner"] = 1 if customer["Partner"] == "Yes" else 0
    row["Dependents"] = 1 if customer["Dependents"] == "Yes" else 0
    row["tenure"] = customer["tenure"]
    row["PhoneService"] = 1 if customer["PhoneService"] == "Yes" else 0
    row["PaperlessBilling"] = 1 if customer["PaperlessBilling"] == "Yes" else 0
    row["MonthlyCharges"] = customer["MonthlyCharges"]
    row["TotalCharges"] = customer["TotalCharges"]

    three_way = ["MultipleLines", "OnlineSecurity", "OnlineBackup",
                 "DeviceProtection", "TechSupport", "StreamingTV", "StreamingMovies"]
    for col in three_way:
        row[col] = 1 if customer[col] == "Yes" else 0

    row["InternetService_Fiber optic"] = 1 if customer["InternetService"] == "Fiber optic" else 0
    row["InternetService_No"] = 1 if customer["InternetService"] == "No" else 0

    row["Contract_One year"] = 1 if customer["Contract"] == "One year" else 0
    row["Contract_Two year"] = 1 if customer["Contract"] == "Two year" else 0

    row["PaymentMethod_Credit card (automatic)"] = 1 if customer["PaymentMethod"] == "Credit card (automatic)" else 0
    row["PaymentMethod_Electronic check"] = 1 if customer["PaymentMethod"] == "Electronic check" else 0
    row["PaymentMethod_Mailed check"] = 1 if customer["PaymentMethod"] == "Mailed check" else 0

    df_row = pd.DataFrame([row])
    df_row = df_row[FEATURE_COLUMNS]
    return df_row


def predict_churn(customer: dict) -> dict:
    X = encode_customer(customer)
    probability = model.predict_proba(X)[0][1]

    CHURN_THRESHOLD = 0.35
    prediction = 1 if probability >= CHURN_THRESHOLD else 0

    return {
        "churn_prediction": "Yes" if prediction == 1 else "No",
        "churn_probability": round(float(probability) * 100, 2),
        "risk_level": (
            "High" if probability >= 0.6 else
            "Medium" if probability >= 0.35 else
            "Low"
        )
    }