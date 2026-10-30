import asyncio
import sys
import os
import time
import pandas as pd
from sklearn.model_selection import train_test_split
from imblearn.over_sampling import SMOTE

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from database import telco_collection
from ml.predict import FEATURE_COLUMNS


async def load_data(company_id: str = None):
    if not company_id:
        return pd.DataFrame()

    t0 = time.perf_counter()
    cursor = telco_collection.find({"company_id": company_id})
    records = await cursor.to_list(length=None)

    if not records:
        return pd.DataFrame()

    df = pd.DataFrame(records)
    meta_cols = ["_id", "company_id", "created_at", "uploaded_by", "uploaded_at", "upload_id", "upload_ids"]
    df = df.drop(columns=[c for c in meta_cols if c in df.columns], errors="ignore")

    elapsed = (time.perf_counter() - t0) * 1000
    print(f"[load_data] {len(records)} records loaded in {elapsed:.1f}ms (company_id={company_id!r})")
    return df


def prepare_features(df: pd.DataFrame):
    meta_cols = ["customerID", "created_at", "uploaded_by", "uploaded_at", "_id", "company_id", "upload_id", "upload_ids"]
    df = df.drop(columns=[c for c in meta_cols if c in df.columns], errors="ignore")

    # Map Churn (target) if present
    if "Churn" in df.columns:
        df["Churn"] = df["Churn"].apply(lambda v: 1 if str(v).strip().lower() in ("yes", "1", "true") else 0)

    # Simple 2-value Yes/No columns
    simple_yes_no = [
        "Partner", "Dependents", "PhoneService",
        "PaperlessBilling"
    ]
    for col in simple_yes_no:
        if col in df.columns:
            df[col] = df[col].apply(lambda v: 1 if str(v).strip().lower() in ("yes", "1", "true") else 0)
        else:
            df[col] = 0

    if "SeniorCitizen" in df.columns:
        df["SeniorCitizen"] = df["SeniorCitizen"].apply(lambda v: 1 if str(v).strip().lower() in ("yes", "1", "true") else 0)
    else:
        df["SeniorCitizen"] = 0

    if "gender" in df.columns:
        df["gender"] = df["gender"].apply(lambda v: 1 if str(v).strip().lower() in ("male", "1", "m") else 0)
    else:
        df["gender"] = 0

    # Numeric columns
    for num_col in ["tenure", "MonthlyCharges", "TotalCharges"]:
        if num_col in df.columns:
            df[num_col] = pd.to_numeric(df[num_col], errors="coerce").fillna(0.0)
        else:
            df[num_col] = 0.0

    # Three-way columns (Yes -> 1, all others -> 0)
    three_way_columns = [
        "MultipleLines", "OnlineSecurity", "OnlineBackup",
        "DeviceProtection", "TechSupport", "StreamingTV", "StreamingMovies"
    ]
    for col in three_way_columns:
        if col in df.columns:
            df[col] = df[col].apply(lambda v: 1 if str(v).strip().lower() in ("yes", "1", "true") else 0)
        else:
            df[col] = 0

    # Categorical dummy columns
    multi_option_columns = ["InternetService", "Contract", "PaymentMethod"]
    existing_multi = [c for c in multi_option_columns if c in df.columns]
    if existing_multi:
        df = pd.get_dummies(df, columns=existing_multi, drop_first=True)

    bool_columns = df.select_dtypes(include="bool").columns
    df[bool_columns] = df[bool_columns].astype(int)

    # CRITICAL: Ensure ALL FEATURE_COLUMNS exist in df, defaulting missing ones to 0
    for col in FEATURE_COLUMNS:
        if col not in df.columns:
            df[col] = 0

    return df


def split_data(df: pd.DataFrame):
    y = df["Churn"]
    # Guarantee X contains strictly the model's FEATURE_COLUMNS in exact order
    X = df[FEATURE_COLUMNS]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    return X_train, X_test, y_train, y_test


def balance_data(X_train, y_train):
    smote = SMOTE(random_state=42)
    X_train_balanced, y_train_balanced = smote.fit_resample(X_train, y_train)
    return X_train_balanced, y_train_balanced


async def main():
    df = await load_data()
    print("Raw shape:", df.shape)

    df_prepared = prepare_features(df)
    print("Prepared shape:", df_prepared.shape)
    print("Any missing values left?", df_prepared.isnull().sum().sum())

    X_train, X_test, y_train, y_test = split_data(df_prepared)

    print("\n--- Train/Test Split ---")
    print("X_train shape:", X_train.shape)
    print("X_test shape:", X_test.shape)
    print("y_train shape:", y_train.shape)
    print("y_test shape:", y_test.shape)


if __name__ == "__main__":
    asyncio.run(main())
