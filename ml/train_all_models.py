import asyncio
import sys
import os
import joblib
import pandas as pd

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from prepare_data import load_data, prepare_features, split_data, balance_data
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score


def get_models():
    return {
        "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
        "Decision Tree": DecisionTreeClassifier(random_state=42, max_depth=8),
        "Random Forest": RandomForestClassifier(random_state=42, n_estimators=200),
        "XGBoost": XGBClassifier(random_state=42, eval_metric="logloss"),
        "LightGBM": LGBMClassifier(random_state=42, verbose=-1),
    }


def evaluate(model, X_test, y_test):
    y_pred = model.predict(X_test)
    return {
        "accuracy": accuracy_score(y_test, y_pred),
        "precision": precision_score(y_test, y_pred),
        "recall": recall_score(y_test, y_pred),
        "f1": f1_score(y_test, y_pred),
    }


def save_model(model, filename):
    folder = os.path.join(os.path.dirname(__file__), "saved_models")
    os.makedirs(folder, exist_ok=True)
    joblib.dump(model, os.path.join(folder, filename))


async def main():
    df = await load_data()
    df_prepared = prepare_features(df)
    X_train, X_test, y_train, y_test = split_data(df_prepared)
    X_train_bal, y_train_bal = balance_data(X_train, y_train)

    models = get_models()
    results = {}
    trained_models = {}

    for name, model in models.items():
        print(f"Training {name}...")
        model.fit(X_train_bal, y_train_bal)
        results[name] = evaluate(model, X_test, y_test)
        trained_models[name] = model

        safe_name = name.lower().replace(" ", "_")
        save_model(model, f"{safe_name}.pkl")

    # ---- Voting Ensemble: combines all 5 models' opinions ----
    print("Training Voting Ensemble...")
    voting_model = VotingClassifier(
        estimators=[
            ("lr", trained_models["Logistic Regression"]),
            ("dt", trained_models["Decision Tree"]),
            ("rf", trained_models["Random Forest"]),
            ("xgb", trained_models["XGBoost"]),
            ("lgbm", trained_models["LightGBM"]),
        ],
        voting="soft"
    )
    voting_model.fit(X_train_bal, y_train_bal)
    results["Voting Ensemble"] = evaluate(voting_model, X_test, y_test)
    save_model(voting_model, "voting_ensemble.pkl")

    # ---- Comparison table ----
    print("\n" + "=" * 70)
    print("MODEL COMPARISON")
    print("=" * 70)
    comparison_df = pd.DataFrame(results).T
    comparison_df = comparison_df.round(4)
    print(comparison_df)

    best_model_name = comparison_df["f1"].idxmax()
    print(f"\nBest model by F1 Score: {best_model_name}")


if __name__ == "__main__":
    asyncio.run(main())