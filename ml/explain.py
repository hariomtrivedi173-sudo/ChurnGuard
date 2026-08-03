import shap
import numpy as np
from ml.predict import model, FEATURE_COLUMNS, encode_customer


def explain_prediction(customer: dict, top_n: int = 5) -> dict:
    X = encode_customer(customer)

    rf_model = model.named_estimators_["rf"]
    explainer = shap.TreeExplainer(rf_model)
    raw_shap = explainer.shap_values(X)

    if isinstance(raw_shap, list):
        # Older SHAP: list of 2 arrays (one per class), each (n_samples, n_features)
        contributions = np.array(raw_shap[1])[0]
    else:
        arr = np.array(raw_shap)
        if arr.ndim == 3:
            # New SHAP: shape (n_samples, n_features, n_classes) -> take class 1 (Churn=Yes)
            contributions = arr[0, :, 1]
        else:
            # Shape (n_samples, n_features) -> already single-output
            contributions = arr[0]

    if len(contributions) != len(FEATURE_COLUMNS):
        raise ValueError(
            f"SHAP returned {len(contributions)} values but there are "
            f"{len(FEATURE_COLUMNS)} features — shape mismatch, check SHAP version output."
        )

    feature_impact = list(zip(FEATURE_COLUMNS, contributions))
    feature_impact.sort(key=lambda pair: abs(float(pair[1])), reverse=True)

    top_factors = []
    for feature, impact in feature_impact[:top_n]:
        impact_value = float(impact)
        top_factors.append({
            "feature": feature,
            "impact": round(impact_value, 4),
            "direction": "increases churn risk" if impact_value > 0 else "decreases churn risk"
        })

    return {"top_factors": top_factors}