import sys
import os
import time

# Add the ml/ folder itself so prepare_data and predict can be imported directly
_ml_dir = os.path.dirname(__file__)
_backend_dir = os.path.join(_ml_dir, '..', 'backend')

if _ml_dir not in sys.path:
    sys.path.insert(0, _ml_dir)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

import numpy as np
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, roc_curve, auc
)

from ml.prepare_data import load_data, prepare_features, split_data
from ml.predict import model, FEATURE_COLUMNS

CHURN_THRESHOLD = 0.35

# ── Simple per-company TTL cache (60 seconds) ──────────────────────────────
# Avoids re-fetching all records + re-running sklearn on every /ml/metrics call.
_metrics_cache: dict[str, tuple[float, dict]] = {}
_CACHE_TTL_SECONDS = 60.0


def _get_cached(company_id: str):
    """Return cached metrics if still fresh, else None."""
    entry = _metrics_cache.get(company_id)
    if entry is None:
        return None
    cached_at, data = entry
    if time.monotonic() - cached_at < _CACHE_TTL_SECONDS:
        return data
    return None


def _set_cached(company_id: str, data: dict):
    _metrics_cache[company_id] = (time.monotonic(), data)


def invalidate_metrics_cache(company_id: str):
    """Call after upload or batch-analysis to force a fresh computation."""
    _metrics_cache.pop(company_id, None)


async def compute_metrics(company_id: str = None) -> dict:
    # ── 1. Check cache ──
    cache_key = company_id or "__global__"
    cached = _get_cached(cache_key)
    if cached is not None:
        print(f"[metrics] Cache HIT for company_id={company_id!r}")
        return cached

    t0 = time.perf_counter()

    # ── 2. Load only this company's data (fixes cross-tenant bug) ──
    df = await load_data(company_id=company_id)

    if df.empty or "Churn" not in df.columns:
        result = {
            "accuracy": 0.0,
            "precision": 0.0,
            "recall": 0.0,
            "f1_score": 0.0,
            "auc": 0.0,
            "confusion_matrix": {
                "true_negative": 0, "false_positive": 0,
                "false_negative": 0, "true_positive": 0
            },
            "roc_curve": [],
            "feature_importance": [],
        }
        _set_cached(cache_key, result)
        return result

    df_prepared = prepare_features(df)
    X_train, X_test, y_train, y_test = split_data(df_prepared)

    # ── 3. Vectorized inference on test set ──
    probabilities = model.predict_proba(X_test)[:, 1]
    predictions   = (probabilities >= CHURN_THRESHOLD).astype(int)

    accuracy  = accuracy_score(y_test, predictions)
    precision = precision_score(y_test, predictions, zero_division=0)
    recall    = recall_score(y_test, predictions, zero_division=0)
    f1        = f1_score(y_test, predictions, zero_division=0)

    cm = confusion_matrix(y_test, predictions)
    tn, fp, fn, tp = cm.ravel()

    fpr, tpr, _ = roc_curve(y_test, probabilities)
    roc_auc     = auc(fpr, tpr)

    # Sample ~25 points along the ROC curve so the chart isn't overloaded
    sample_idx  = np.linspace(0, len(fpr) - 1, min(25, len(fpr))).astype(int)
    roc_points  = [
        {"fpr": round(float(fpr[i]), 4), "tpr": round(float(tpr[i]), 4)}
        for i in sample_idx
    ]

    rf_model     = model.named_estimators_["rf"]
    importances  = rf_model.feature_importances_
    feature_importance = sorted(
        [{"feature": f, "importance": round(float(i), 4)}
         for f, i in zip(FEATURE_COLUMNS, importances)],
        key=lambda x: x["importance"],
        reverse=True
    )[:10]

    elapsed = (time.perf_counter() - t0) * 1000
    print(f"[metrics] Computed in {elapsed:.1f}ms for company_id={company_id!r}")

    result = {
        "accuracy":          round(float(accuracy),  4),
        "precision":         round(float(precision), 4),
        "recall":            round(float(recall),    4),
        "f1_score":          round(float(f1),        4),
        "auc":               round(float(roc_auc),   4),
        "confusion_matrix":  {
            "true_negative":  int(tn),
            "false_positive": int(fp),
            "false_negative": int(fn),
            "true_positive":  int(tp),
        },
        "roc_curve":         roc_points,
        "feature_importance": feature_importance,
    }
    _set_cached(cache_key, result)
    return result