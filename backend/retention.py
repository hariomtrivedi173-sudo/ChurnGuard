"""
ChurnGuard — Rule-Based Customer Retention Engine
Provides deterministic, explainable, and prioritized retention recommendations.
Strictly rule-based: no hallucinations, no fake AI claims.
"""

from typing import List, Dict, Any, Optional

# =====================================================================
# RETENTION RULES CONFIGURATION
# Editable rule definitions, thresholds, channels, and priorities
# =====================================================================
RETENTION_RULES = {
    # Thresholds
    "HIGH_RISK_PROBABILITY": 60.0,
    "MEDIUM_RISK_PROBABILITY": 35.0,
    "VIP_MONTHLY_CHARGES": 75.0,
    "EARLY_TENURE_MONTHS": 6,
    
    # Priority definitions
    "PRIORITY_HIGH": "High",
    "PRIORITY_MEDIUM": "Medium",
    "PRIORITY_LOW": "Low",
    
    # Channel types
    "CHANNEL_CALL": "Call",
    "CHANNEL_EMAIL": "Email",
    "CHANNEL_OFFER": "Offer",
}


def _safe_float(val, default: float = 0.0) -> float:
    if val is None or val == "":
        return default
    try:
        f = float(val)
        return default if (f != f) else f  # check NaN
    except (ValueError, TypeError):
        return default


def _safe_int(val, default: int = 0) -> int:
    f = _safe_float(val, float(default))
    return int(f)


def get_retention_suggestions(
    customer: Dict[str, Any],
    churn_probability: float,
    top_reasons: Optional[List[Dict[str, Any]]] = None
) -> List[Dict[str, Any]]:
    """
    Evaluates customer telemetry against configured retention rules.
    Returns 1 to 3 prioritized retention actions.
    
    Parameters:
        customer: Customer document or dictionary (handles missing fields safely).
        churn_probability: Calibrated churn probability as a percentage (0.0 to 100.0).
        top_reasons: Optional list of SHAP attribution dicts [{"feature": str, "impact": float, ...}].
        
    Returns:
        List of 1 to 3 dicts:
        [
            {
                "title": str,
                "reason": str,
                "priority": "High" | "Medium" | "Low",
                "channel": "Call" | "Email" | "Offer"
            },
            ...
        ]
    """
    if not isinstance(customer, dict):
        customer = {}

    prob = _safe_float(churn_probability, 0.0)
    monthly_charges = _safe_float(customer.get("MonthlyCharges"), 0.0)
    tenure = _safe_int(customer.get("tenure"), 0)
    contract = str(customer.get("Contract") or "").strip()
    payment_method = str(customer.get("PaymentMethod") or "").strip()
    internet_service = str(customer.get("InternetService") or "").strip()
    tech_support = str(customer.get("TechSupport") or "").strip()
    online_sec = str(customer.get("OnlineSecurity") or "").strip()

    is_high_risk = prob >= RETENTION_RULES["HIGH_RISK_PROBABILITY"]
    is_med_risk = prob >= RETENTION_RULES["MEDIUM_RISK_PROBABILITY"] and not is_high_risk
    is_low_risk = not (is_high_risk or is_med_risk)

    # Low-risk customers receive a gentle touch / low priority check-in only
    if is_low_risk:
        return [
            {
                "title": "Loyalty Milestone & Periodic Check-in",
                "reason": f"Customer is low risk ({prob:.1f}% churn probability). Maintain loyalty through routine milestone perks and NPS surveys without discounting.",
                "priority": RETENTION_RULES["PRIORITY_LOW"],
                "channel": RETENTION_RULES["CHANNEL_EMAIL"]
            }
        ]

    suggestions: List[Dict[str, Any]] = []

    # Rule 1: Very high risk + High value customer -> Executive Account Manager Call
    if is_high_risk and monthly_charges >= RETENTION_RULES["VIP_MONTHLY_CHARGES"]:
        suggestions.append({
            "title": "Executive Account Manager VIP Outreach",
            "reason": f"High-value account (${monthly_charges:.2f}/mo) exhibiting critical churn risk ({prob:.1f}%). Immediate phone intervention prevents revenue loss.",
            "priority": RETENTION_RULES["PRIORITY_HIGH"],
            "channel": RETENTION_RULES["CHANNEL_CALL"]
        })

    # Rule 2: Month-to-month contract + High or Medium Risk -> 1-Year Discount Upgrade
    if contract == "Month-to-month":
        suggestions.append({
            "title": "Annual Contract Lock-in with 15% Incentive",
            "reason": "Month-to-month contract represents the highest structural attrition driver. Offer a 15% rate reduction in exchange for a 12-month commitment.",
            "priority": RETENTION_RULES["PRIORITY_HIGH"] if is_high_risk else RETENTION_RULES["PRIORITY_MEDIUM"],
            "channel": RETENTION_RULES["CHANNEL_OFFER"]
        })

    # Rule 3: High monthly charges + elevated risk -> Plan Optimization / Loyalty Discount
    if monthly_charges >= RETENTION_RULES["VIP_MONTHLY_CHARGES"] and len(suggestions) < 3:
        # Avoid duplicate if already covered under VIP call
        if not any("Rate" in s["title"] or "Lock-in" in s["title"] for s in suggestions):
            suggestions.append({
                "title": "Tailored Plan Optimization & Value Audit",
                "reason": f"Monthly charges of ${monthly_charges:.2f} are a key friction factor. Proactively suggest a bundle restructuring or loyalty credit.",
                "priority": RETENTION_RULES["PRIORITY_MEDIUM"],
                "channel": RETENTION_RULES["CHANNEL_OFFER"]
            })

    # Rule 4: Early tenure (< 6 months) -> Onboarding Success Call
    if tenure < RETENTION_RULES["EARLY_TENURE_MONTHS"] and len(suggestions) < 3:
        suggestions.append({
            "title": "New Customer 90-Day Success Review",
            "reason": f"Account is in early lifecycle ({tenure} months tenure). Schedule an onboarding concierge call to resolve early product friction.",
            "priority": RETENTION_RULES["PRIORITY_HIGH"] if is_high_risk else RETENTION_RULES["PRIORITY_MEDIUM"],
            "channel": RETENTION_RULES["CHANNEL_CALL"]
        })

    # Rule 5: Missing TechSupport or OnlineSecurity add-ons
    if (tech_support in ("No", "no", False) or online_sec in ("No", "no", False)) and internet_service != "No" and len(suggestions) < 3:
        suggestions.append({
            "title": "Free 60-Day Tech Support & Security Bundle",
            "reason": "Absence of support/security add-ons correlates with unresolved service friction. Offer a 60-day complimentary trial to increase stickiness.",
            "priority": RETENTION_RULES["PRIORITY_MEDIUM"],
            "channel": RETENTION_RULES["CHANNEL_OFFER"]
        })

    # Rule 6: Electronic Check payment method
    if payment_method == "Electronic check" and len(suggestions) < 3:
        suggestions.append({
            "title": "Switch to Automated Billing with $5 Statement Credit",
            "reason": "Electronic check carries elevated friction and churn correlation. Incentivize migrating to automated card or bank draft billing.",
            "priority": RETENTION_RULES["PRIORITY_LOW"] if not is_high_risk else RETENTION_RULES["PRIORITY_MEDIUM"],
            "channel": RETENTION_RULES["CHANNEL_EMAIL"]
        })

    # Rule 7: Fiber Optic service quality check
    if internet_service == "Fiber optic" and len(suggestions) < 3:
        suggestions.append({
            "title": "Fiber Optic Line Quality & Satisfaction Check",
            "reason": "Fiber optic accounts show heightened price sensitivity and churn on service interruptions. Run a line audit and confirm satisfaction.",
            "priority": RETENTION_RULES["PRIORITY_MEDIUM"],
            "channel": RETENTION_RULES["CHANNEL_CALL"]
        })

    # Fallback if no specific condition matched
    if not suggestions:
        suggestions.append({
            "title": "Proactive Account Review & Customer Survey",
            "reason": f"Customer churn probability is {prob:.1f}%. Initiate a proactive outreach to evaluate customer sentiment and resolve concerns.",
            "priority": RETENTION_RULES["PRIORITY_MEDIUM"] if is_high_risk else RETENTION_RULES["PRIORITY_LOW"],
            "channel": RETENTION_RULES["CHANNEL_EMAIL"]
        })

    # Return top 1 to 3 suggestions
    return suggestions[:3]
