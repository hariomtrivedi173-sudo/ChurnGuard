import asyncio
import sys
import os
import joblib
import pandas as pd

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from prepare_data import load_data, prepare_features, split_data
from sklearn.metrics import precision_score, recall_score, f1_score, confusion_matrix


async def main():
    df = await load_data()
    df_prepared = prepare_features(df)
    X_train, X_test, y_train, y_test = split_data(df_prepared)

    model_path = os.path.join(os.path.dirname(__file__), "saved_models", "voting_ensemble.pkl")
    model = joblib.load(model_path)

    # Get probability of churn (not just yes/no) for every test customer
    probabilities = model.predict_proba(X_test)[:, 1]

    thresholds = [0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50]

    print(f"{'Threshold':<12}{'Precision':<12}{'Recall':<12}{'F1':<10}{'Missed Churners (FN)':<22}{'False Alarms (FP)'}")
    print("-" * 90)

    for t in thresholds:
        predictions = (probabilities >= t).astype(int)
        precision = precision_score(y_test, predictions)
        recall = recall_score(y_test, predictions)
        f1 = f1_score(y_test, predictions)
        cm = confusion_matrix(y_test, predictions)
        fn = cm[1][0]
        fp = cm[0][1]

        print(f"{t:<12}{precision:<12.4f}{recall:<12.4f}{f1:<10.4f}{fn:<22}{fp}")


if __name__ == "__main__":
    asyncio.run(main())