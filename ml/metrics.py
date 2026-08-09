import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

import numpy as np
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, roc_curve, auc
)

from prepare_data import load_data, prepare_features, split_data
from ml.predict import model, FEATURE_COLUMNS

CHURN_THRESHOLD = 0.35


async def compute_metrics():
    df = await load_data()
    df_prepared = prepare_features(df)
    X_train, X_test, y_train, y_test = split_data(df_prepared)

    probabilities = model.predict_proba(X_test)[:, 1]
    predictions = (probabilities >= CHURN_THRESHOLD).astype(int)

    accuracy = accuracy_score(y_test, predictions)
    precision = precision_score(y_test, predictions)
    recall = recall_score(y_test, predictions)
    f1 = f1_score(y_test, predictions)

    cm = confusion_matrix(y_test, predictions)
    tn, fp, fn, tp = cm.ravel()

    fpr, tpr, _ = roc_curve(y_test, probabilities)
    roc_auc = auc(fpr, tpr)

    # Sample ~25 points along the curve so the chart isn't overloaded with data
    sample_idx = np.linspace(0, len(fpr) - 1, min(25, len(fpr))).astype(int)
    roc_points = [
        {"fpr": round(float(fpr[i]), 4), "tpr": round(float(tpr[i]), 4)}
        for i in sample_idx
    ]

    rf_model = model.named_estimators_["rf"]
    importances = rf_model.feature_importances_
    feature_importance = sorted(
        [{"feature": f, "importance": round(float(i), 4)} for f, i in zip(FEATURE_COLUMNS, importances)],
        key=lambda x: x["importance"],
        reverse=True
    )[:10]

    return {
        "accuracy": round(float(accuracy), 4),
        "precision": round(float(precision), 4),
        "recall": round(float(recall), 4),
        "f1_score": round(float(f1), 4),
        "auc": round(float(roc_auc), 4),
        "confusion_matrix": {
            "true_negative": int(tn),
            "false_positive": int(fp),
            "false_negative": int(fn),
            "true_positive": int(tp),
        },
        "roc_curve": roc_points,
        "feature_importance": feature_importance,
    }