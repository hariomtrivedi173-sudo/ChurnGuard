import asyncio
import sys
import os
import pandas as pd
from sklearn.model_selection import train_test_split
from imblearn.over_sampling import SMOTE

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from database import telco_collection


import time

async def load_data(company_id: str = None):
    if not company_id:
        return pd.DataFrame()

    t0 = time.perf_counter()
    cursor = telco_collection.find({"company_id": company_id})
    records = await cursor.to_list(length=None)

    if not records:
        return pd.DataFrame()

    df = pd.DataFrame(records)
    meta_cols = ["_id", "company_id", "created_at", "uploaded_by", "uploaded_at"]
    df = df.drop(columns=[c for c in meta_cols if c in df.columns])

    elapsed = (time.perf_counter() - t0) * 1000
    print(f"[load_data] {len(records)} records loaded in {elapsed:.1f}ms (company_id={company_id!r})")
    return df


def prepare_features(df: pd.DataFrame):
    meta_cols = ["customerID", "created_at", "uploaded_by", "uploaded_at", "_id", "company_id"]
    df = df.drop(columns=[c for c in meta_cols if c in df.columns])

    # Simple 2-value Yes/No columns
    simple_yes_no = [
        "Partner", "Dependents", "PhoneService",
        "PaperlessBilling", "Churn"
    ]
    for col in simple_yes_no:
        if col in df.columns:
            df[col] = df[col].map({"Yes": 1, "No": 0})

    if "SeniorCitizen" in df.columns:
        df["SeniorCitizen"] = df["SeniorCitizen"].map({"Yes": 1, "No": 0})
    if "gender" in df.columns:
        df["gender"] = df["gender"].map({"Male": 1, "Female": 0})

    # Columns with a 3rd "No internet/phone service" option -
    # collapse ALL "No..." variants to 0 in ONE mapping step
    three_way_columns = [
        "MultipleLines", "OnlineSecurity", "OnlineBackup",
        "DeviceProtection", "TechSupport", "StreamingTV", "StreamingMovies"
    ]
    for col in three_way_columns:
        if col in df.columns:
            df[col] = df[col].map({
                "Yes": 1,
                "No": 0,
                "No internet service": 0,
                "No phone service": 0
            })

    # Multi-option columns -> One-Hot Encoding
    multi_option_columns = ["InternetService", "Contract", "PaymentMethod"]
    df = pd.get_dummies(df, columns=multi_option_columns, drop_first=True)

    # get_dummies creates True/False columns - convert to clean 1/0
    bool_columns = df.select_dtypes(include="bool").columns
    df[bool_columns] = df[bool_columns].astype(int)

    return df


def split_data(df: pd.DataFrame):
    X = df.drop(columns=["Churn"])
    y = df["Churn"]

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

    print("\nChurn rate in training set:", round(y_train.mean() * 100, 2), "%")
    print("Churn rate in test set:", round(y_test.mean() * 100, 2), "%")

    X_train_balanced, y_train_balanced = balance_data(X_train, y_train)

    print("\n--- After SMOTE (Training Set Only) ---")
    print("X_train_balanced shape:", X_train_balanced.shape)
    print("Churn value counts before SMOTE:\n", y_train.value_counts())
    print("Churn value counts after SMOTE:\n", y_train_balanced.value_counts())


if __name__ == "__main__":
    asyncio.run(main())