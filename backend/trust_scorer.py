"""
Trust Scorer — Analyzes hospital records for contradictions, verifies claims,
and assigns trust scores with detailed reasoning chain.
"""
import re


def compute_trust_score(name, specialties, equipment, staff, beds, notes, facilities, ownership):
    """
    Compute trust score for a hospital based on multiple signals.
    Returns: { score: High|Medium|Low|Flagged, reasoning: str, details: dict, fraud_score: float }
    """
    flags = []
    positives = []
    fraud_indicators = []
    score_points = 0  # Start at 0, add/subtract

    s_lower = str(specialties).lower()
    e_lower = str(equipment).lower()
    st_lower = str(staff).lower()
    n_lower = str(notes).lower()
    f_lower = str(facilities).lower()
    o_lower = str(ownership).lower()

    # ── 1. Contradiction Detection ──
    # Claims surgery but no anesthesiologist
    has_surgery = any(w in s_lower for w in ["surgery", "surgical", "appendectomy", "cardiac surgery", "neurosurgery"])
    has_anesthesiologist = "anesthesiologist" in st_lower or "anaesthesiologist" in st_lower
    if has_surgery and not has_anesthesiologist:
        flags.append("Claims surgical capability but no anesthesiologist on record")
        score_points -= 25

    # Claims ICU but no ventilators or ICU beds
    has_icu_claim = "icu" in e_lower or "icu" in f_lower
    has_ventilator = "ventilator" in e_lower
    if has_icu_claim and not has_ventilator and beds < 50:
        flags.append("Claims ICU but no ventilators listed and low bed count")
        score_points -= 15

    # Claims advanced specialties with minimal staff
    advanced = ["cardiac surgery", "neurosurgery", "oncology", "organ transplant"]
    claimed_advanced = [a for a in advanced if a in s_lower]
    staff_count = _estimate_staff_count(st_lower)
    if claimed_advanced and staff_count < 3:
        flags.append(f"Claims {', '.join(claimed_advanced)} with only ~{staff_count} staff listed")
        score_points -= 30
        fraud_indicators.append("advanced_claims_minimal_staff")

    # ── 2. Fraud Detection ──
    # "Claimed" keyword pattern
    claimed_count = s_lower.count("claimed") + e_lower.count("claimed") + f_lower.count("claimed")
    if claimed_count >= 2:
        fraud_indicators.append("multiple_unverified_claims")
        score_points -= 30

    # Notes mention fraud/flagged
    if any(w in n_lower for w in ["fraud", "flagged", "fake", "not found", "failed", "mismatch"]):
        fraud_indicators.append("fraud_keywords_in_notes")
        score_points -= 40

    # Address/license verification failed
    if "verification failed" in n_lower or "not found in" in n_lower:
        fraud_indicators.append("verification_failed")
        score_points -= 35

    # ── 3. Positive Signals ──
    if "nabh" in f_lower or "nabh" in n_lower:
        positives.append("NABH accredited")
        score_points += 20

    if "government" in o_lower or "govt" in o_lower or "central" in o_lower:
        positives.append("Government operated")
        score_points += 15

    if has_anesthesiologist and "24" in st_lower:
        positives.append("24hr anesthesiologist available")
        score_points += 15

    if "blood bank" in f_lower or "blood bank" in e_lower:
        positives.append("Blood bank available")
        score_points += 10

    if "trauma" in f_lower or "trauma" in s_lower:
        positives.append("Trauma center")
        score_points += 10

    if beds >= 500:
        positives.append(f"Large facility ({beds} beds)")
        score_points += 15
    elif beds >= 100:
        positives.append(f"Medium facility ({beds} beds)")
        score_points += 5

    if "telemedicine" in f_lower or "telemedicine" in n_lower:
        positives.append("Telemedicine enabled")
        score_points += 5

    if "verified" in n_lower or "audit" in n_lower:
        positives.append("Recently verified/audited")
        score_points += 10

    # ── 4. Negative Signals ──
    if "shortage" in n_lower or "non-functional" in n_lower:
        flags.append("Equipment shortages or non-functional systems reported")
        score_points -= 15

    if "complaint" in n_lower:
        flags.append("Patient complaints on record")
        score_points -= 10

    if "part-time" in st_lower:
        flags.append("Key staff only part-time")
        score_points -= 10

    if beds == 0 and has_surgery:
        flags.append("Zero beds but claims surgical capability")
        score_points -= 20
        fraud_indicators.append("zero_beds_surgery_claim")

    # ── 5. Compute Final Score ──
    fraud_score = min(len(fraud_indicators) * 0.3, 1.0)

    if fraud_score >= 0.6 or score_points <= -50:
        trust_level = "Flagged"
    elif score_points >= 30:
        trust_level = "High"
    elif score_points >= 0:
        trust_level = "Medium"
    else:
        trust_level = "Low"

    # Build reasoning chain
    reasoning_parts = []
    if positives:
        reasoning_parts.append("Strengths: " + "; ".join(positives) + ".")
    if flags:
        reasoning_parts.append("Concerns: " + "; ".join(flags) + ".")
    if fraud_indicators:
        reasoning_parts.append("Fraud signals: " + "; ".join(fraud_indicators).replace("_", " ") + ".")

    if not reasoning_parts:
        reasoning_parts.append("Limited data available for comprehensive assessment.")

    reasoning = " ".join(reasoning_parts)

    details = {
        "positives": positives,
        "flags": flags,
        "fraud_indicators": fraud_indicators,
        "score_points": score_points,
        "beds": beds,
        "has_surgery": has_surgery,
        "has_anesthesiologist": has_anesthesiologist,
    }

    return {
        "score": trust_level,
        "reasoning": reasoning,
        "details": details,
        "fraud_score": round(fraud_score, 2),
    }


def _estimate_staff_count(staff_str):
    """Rough estimate of staff count from text."""
    if not staff_str or staff_str == "nan":
        return 0
    # Count comma-separated items
    parts = [p.strip() for p in staff_str.split(",") if p.strip()]
    return len(parts)
