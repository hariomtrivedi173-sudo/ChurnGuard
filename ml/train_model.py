import asyncio
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from prepare_data import load_data, prepare_features, split_data, balance_data
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, classification_report


def train_logistic_regression(X_train, y_train):
    model = LogisticRegression(max_iter=1000, random_state=42)
    model.fit(X_train, y_train)
    return model


def evaluate_model(model, X_test, y_test, model_name="Model"):
    y_pred = model.predict(X_test)

    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred)
    recall = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    cm = confusion_matrix(y_test, y_pred)

    print(f"\n--- {model_name} Results ---")
    print(f"Accuracy:  {accuracy:.4f}")
    print(f"Precision: {precision:.4f}")
    print(f"Recall:    {recall:.4f}")
    print(f"F1 Score:  {f1:.4f}")
    print("\nConfusion Matrix:")
    print(cm)
    print("\nFull Report:")
    print(classification_report(y_test, y_pred, target_names=["Stayed", "Churned"]))

    return {"accuracy": accuracy, "precision": precision, "recall": recall, "f1": f1}


async def main():
    df = await load_data()
    df_prepared = prepare_features(df)
    X_train, X_test, y_train, y_test = split_data(df_prepared)
    X_train_balanced, y_train_balanced = balance_data(X_train, y_train)

    print("Training Logistic Regression...")
    model = train_logistic_regression(X_train_balanced, y_train_balanced)
    print("Training complete.")

    evaluate_model(model, X_test, y_test, model_name="Logistic Regression")


if __name__ == "__main__":
    asyncio.run(main())