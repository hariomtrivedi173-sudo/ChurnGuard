def generate_recommendations(customer: dict, top_factors: list, risk_level: str) -> dict:
    if risk_level == "Low":
        return {
            "priority": "No action needed",
            "recommended_actions": [{
                "action": "Monitor — no immediate action required",
                "reason": "Overall churn risk is low; individual factors are not significant enough to warrant outreach."
            }]
        }

    recommendations = []
    factor_names = [f["feature"] for f in top_factors if f["direction"] == "increases churn risk"]

    if customer.get("Contract") == "Month-to-month":
        recommendations.append({
            "action": "Offer a discounted 1-year contract upgrade",
            "reason": "Customer is on a flexible month-to-month plan, which carries the highest churn risk of all contract types."
        })

    if "tenure" in factor_names and customer.get("tenure", 999) <= 6:
        recommendations.append({
            "action": "Enroll in a new-customer onboarding / check-in call within the first 90 days",
            "reason": "Customers within their first few months are statistically the most likely to leave."
        })

    if "InternetService_Fiber optic" in factor_names:
        recommendations.append({
            "action": "Proactively review Fiber optic service quality with the customer",
            "reason": "Fiber optic customers show a notably higher churn rate, often linked to price or service complaints."
        })

    if "MonthlyCharges" in factor_names:
        recommendations.append({
            "action": "Offer a loyalty discount or bundle to reduce effective monthly cost",
            "reason": "High monthly charges are a significant contributor to this customer's churn risk."
        })

    if customer.get("PaymentMethod") == "Electronic check":
        recommendations.append({
            "action": "Encourage switching to automatic credit card or bank payment",
            "reason": "Electronic check users show higher churn rates than customers on automatic payment methods."
        })

    if customer.get("TechSupport") == "No" and customer.get("InternetService") != "No":
        recommendations.append({
            "action": "Offer a free trial of Tech Support add-on",
            "reason": "Customers without tech support tend to churn more, likely due to unresolved service issues."
        })

    if not recommendations:
        recommendations.append({
            "action": "Monitor — no immediate action required",
            "reason": "No strong risk-driving factors were identified for this customer."
        })

    return {
        "priority": "Immediate outreach recommended" if risk_level == "High" else
                    "Monitor and consider proactive outreach" if risk_level == "Medium" else
                    "No action needed",
        "recommended_actions": recommendations
    }