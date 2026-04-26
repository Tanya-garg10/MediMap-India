"""
Query Engine — Parses natural language queries and searches the hospital database.
Handles location, specialty, equipment, and distance-based queries.
Strictly filters by detected city/state — no mixing.
"""
import re
import math
import sqlite3
from database import get_db


# Common medical terms mapping
SPECIALTY_KEYWORDS = {
    "appendectomy": ["surgery", "surgical", "general surgery"],
    "dialysis": ["dialysis", "nephrology", "renal"],
    "cardiac": ["cardiology", "cardiac surgery", "heart"],
    "heart": ["cardiology", "cardiac surgery", "heart"],
    "neuro": ["neurology", "neurosurgery", "brain"],
    "brain": ["neurology", "neurosurgery"],
    "cancer": ["oncology", "cancer"],
    "ortho": ["orthopedics", "orthopedic", "bone", "fracture"],
    "fracture": ["orthopedics", "orthopedic", "fracture"],
    "pediatric": ["pediatrics", "pediatric", "child"],
    "child": ["pediatrics", "pediatric"],
    "eye": ["ophthalmology", "eye"],
    "ent": ["ent", "ear nose throat"],
    "trauma": ["trauma", "accident", "emergency"],
    "accident": ["trauma", "accident", "emergency"],
    "emergency": ["emergency", "trauma"],
    "maternity": ["gynecology", "obstetrics", "maternity"],
    "pregnancy": ["gynecology", "obstetrics"],
    "delivery": ["gynecology", "obstetrics"],
    "surgery": ["surgery", "surgical"],
    "icu": ["icu", "intensive care"],
    "ventilator": ["ventilator", "icu"],
    "blood bank": ["blood bank"],
    "dental": ["dentistry", "dental"],
    "skin": ["dermatology", "skin"],
    "derma": ["dermatology", "skin"],
}

# Stop words to ignore when extracting location from free text
STOP_WORDS = {
    "find", "nearest", "hospital", "hospitals", "clinic", "clinics", "center",
    "centre", "best", "good", "top", "near", "nearby", "close", "closest",
    "for", "in", "at", "with", "and", "the", "a", "an", "of", "to", "from",
    "emergency", "urgent", "accident", "trauma", "critical", "rural", "urban",
    "within", "km", "miles", "blood", "bank", "icu", "nabh", "accredited",
    "24", "7", "24/7", "round", "clock", "night", "surgery", "surgical",
    "doctor", "doctors", "specialist", "specialists", "bed", "beds",
    "appendectomy", "dialysis", "cardiac", "heart", "neuro", "brain",
    "cancer", "ortho", "fracture", "pediatric", "child", "eye", "ent",
    "maternity", "pregnancy", "delivery", "ventilator", "dental", "skin",
    "derma", "treatment", "care", "medical", "health", "healthcare",
    "super", "specialty", "multispecialty", "multi", "general",
}


def search_hospitals(query_text, limit=20):
    """
    Parse a natural language query and return matching hospitals ranked by relevance.
    Returns list of hospital dicts with trust scores and reasoning.
    """
    q = query_text.lower().strip()
    chain_of_thought = []

    # Step 1: Extract location — try DB lookup for any word in query
    location = _extract_location(q)
    chain_of_thought.append(f"Location detected: {location['value'] if location else 'any (showing all)'}")

    # Step 2: Extract specialties/needs
    needs = _extract_needs(q)
    chain_of_thought.append(f"Medical needs: {', '.join(needs) if needs else 'general'}")

    # Step 3: Extract distance preference
    max_distance = _extract_distance(q)
    chain_of_thought.append(f"Distance filter: {max_distance}km" if max_distance else "Distance filter: none")

    # Step 4: Check for urgency
    is_emergency = any(w in q for w in ["emergency", "urgent", "accident", "trauma", "critical"])
    chain_of_thought.append(f"Emergency: {'yes' if is_emergency else 'no'}")

    # Step 5: Check for specific requirements
    needs_24hr = "24" in q or "round the clock" in q or "night" in q
    needs_blood_bank = "blood" in q
    needs_nabh = "nabh" in q or "accredited" in q

    # Step 6: Query database with strict location filter
    conn = get_db()
    hospitals = _query_db(conn, location, needs, is_emergency)
    chain_of_thought.append(f"Database matches: {len(hospitals)} facilities found in {location['value'] if location else 'all India'}")

    # Step 7: Score and rank
    scored = []
    for h in hospitals:
        relevance = _compute_relevance(h, needs, location, is_emergency, needs_24hr, needs_blood_bank, needs_nabh)
        scored.append((h, relevance))

    scored.sort(key=lambda x: x[1], reverse=True)
    chain_of_thought.append(f"Ranked {len(scored)} results by relevance + trust score")

    # Step 8: Format results
    results = []
    for h, rel_score in scored[:limit]:
        facilities_list = [f.strip() for f in str(h["facilities"]).split(",") if f.strip() and f.strip() != "nan"]
        results.append({
            "id": h["id"],
            "name": h["name"],
            "location": f"{h['location']}, {h['state']}" if h["state"] else h["location"],
            "pin": h["pin"],
            "lat": h["lat"],
            "lng": h["lng"],
            "trust_score": h["trust_score"],
            "distance": _format_distance(h.get("_distance")),
            "reasoning": h["trust_reasoning"],
            "details": h["trust_details"] or "",
            "facilities": facilities_list,
            "beds": h["beds"] or 0,
            "contact": h["contact"] or "",
            "specialties": h["specialties"] or "",
            "chain_of_thought": chain_of_thought,
        })

    conn.close()
    return results


def _extract_location(q):
    """
    Extract location from query. Strategy:
    1. Check for 6-digit PIN code
    2. Check every non-stop word against the DB (state, district, city in location)
    This way ANY city/state the user types gets picked up, not just a hardcoded list.
    """
    # Check for PIN code first
    pin_match = re.search(r'\b\d{6}\b', q)
    if pin_match:
        return {"type": "pin", "value": pin_match.group()}

    # Extract candidate location words (non-stop, non-number, len >= 3)
    words = re.findall(r'[a-z]+', q)
    candidates = [w for w in words if w not in STOP_WORDS and len(w) >= 3]

    # Also try multi-word combos (e.g. "uttar pradesh", "tamil nadu", "west bengal")
    bigrams = []
    word_list = q.split()
    for i in range(len(word_list) - 1):
        bg = f"{word_list[i]} {word_list[i+1]}".lower()
        bg_clean = re.sub(r'[^a-z ]', '', bg).strip()
        if bg_clean and len(bg_clean) >= 5:
            bigrams.append(bg_clean)

    # Check bigrams first (more specific — "uttar pradesh" before "pradesh")
    conn = get_db()
    cur = conn.cursor()

    for bg in bigrams:
        # Check state match
        row = cur.execute(
            "SELECT COUNT(*) as cnt FROM hospitals WHERE LOWER(state) LIKE ?",
            (f"%{bg}%",)
        ).fetchone()
        if row["cnt"] > 0:
            conn.close()
            return {"type": "state", "value": bg}

    # Check single words
    for word in candidates:
        # Check state
        row = cur.execute(
            "SELECT COUNT(*) as cnt FROM hospitals WHERE LOWER(state) LIKE ?",
            (f"%{word}%",)
        ).fetchone()
        if row["cnt"] > 0:
            conn.close()
            return {"type": "state", "value": word}

        # Check city/district
        row = cur.execute(
            "SELECT COUNT(*) as cnt FROM hospitals WHERE LOWER(district) LIKE ? OR LOWER(location) LIKE ?",
            (f"%{word}%", f"%{word}%")
        ).fetchone()
        if row["cnt"] > 0:
            conn.close()
            return {"type": "city", "value": word}

    conn.close()
    return None


def _extract_needs(q):
    """Extract medical needs from query."""
    found = set()
    for keyword, specialties in SPECIALTY_KEYWORDS.items():
        if keyword in q:
            found.update(specialties)
    return list(found)


def _extract_distance(q):
    """Extract distance preference from query (in km)."""
    match = re.search(r'(\d+)\s*km', q)
    if match:
        return int(match.group(1))
    if "nearby" in q or "nearest" in q or "close" in q:
        return 50
    return None


def _query_db(conn, location, needs, is_emergency):
    """Query the database with STRICT location filters."""
    conditions = []
    params = []

    if location:
        if location["type"] == "pin":
            conditions.append("pin = ?")
            params.append(location["value"])
        elif location["type"] == "city":
            val = location["value"]
            conditions.append(
                "(LOWER(district) LIKE ? OR LOWER(location) LIKE ? OR LOWER(name) LIKE ?)"
            )
            params.extend([f"%{val}%", f"%{val}%", f"%{val}%"])
        elif location["type"] == "state":
            conditions.append("LOWER(state) LIKE ?")
            params.append(f"%{location['value']}%")

    # Add specialty/need filters
    if needs:
        need_conditions = []
        for need in needs:
            need_conditions.append(
                "(LOWER(specialties) LIKE ? OR LOWER(equipment) LIKE ? OR LOWER(facilities) LIKE ? OR LOWER(notes) LIKE ?)"
            )
            params.extend([f"%{need}%"] * 4)
        if need_conditions:
            conditions.append("(" + " OR ".join(need_conditions) + ")")

    where = " AND ".join(conditions) if conditions else "1=1"
    query = f"SELECT * FROM hospitals WHERE {where} ORDER BY trust_score ASC LIMIT 50"

    cur = conn.cursor()
    rows = cur.execute(query, params).fetchall()
    return [dict(r) for r in rows]


def _compute_relevance(hospital, needs, location, is_emergency, needs_24hr, needs_blood_bank, needs_nabh):
    """Compute relevance score for ranking."""
    score = 0
    h_specs = str(hospital.get("specialties", "")).lower()
    h_equip = str(hospital.get("equipment", "")).lower()
    h_staff = str(hospital.get("staff", "")).lower()
    h_fac = str(hospital.get("facilities", "")).lower()
    h_notes = str(hospital.get("notes", "")).lower()

    # Trust score weight
    trust_weights = {"High": 40, "Medium": 20, "Low": -10, "Flagged": -50}
    score += trust_weights.get(hospital["trust_score"], 0)

    # Specialty match
    for need in needs:
        if need.lower() in h_specs or need.lower() in h_equip or need.lower() in h_fac:
            score += 15

    # Emergency readiness
    if is_emergency:
        if "emergency" in h_fac or "trauma" in h_fac:
            score += 20
        if "24" in h_staff:
            score += 15
        if hospital.get("beds", 0) >= 100:
            score += 10

    # Specific requirements
    if needs_24hr and "24" in h_staff:
        score += 10
    if needs_blood_bank and "blood bank" in h_fac:
        score += 10
    if needs_nabh and "nabh" in h_fac:
        score += 10

    # Bed count bonus
    beds = hospital.get("beds", 0) or 0
    if beds >= 500:
        score += 10
    elif beds >= 100:
        score += 5

    return score


def _format_distance(dist):
    """Format distance for display."""
    if dist is None:
        return ""
    if dist < 1:
        return f"{int(dist * 1000)} m"
    return f"{dist:.1f} km"


def get_all_hospitals_for_map():
    """Get all hospitals with coordinates for map display."""
    conn = get_db()
    cur = conn.cursor()
    rows = cur.execute("""
        SELECT id, name, location, state, district, pin, lat, lng,
               trust_score, beds, specialties, facilities
        FROM hospitals
        WHERE lat IS NOT NULL AND lng IS NOT NULL
    """).fetchall()
    conn.close()

    return [{
        "id": r["id"],
        "name": r["name"],
        "location": f"{r['location']}, {r['state']}" if r["state"] else r["location"],
        "pin": r["pin"],
        "lat": r["lat"],
        "lng": r["lng"],
        "trust_score": r["trust_score"],
        "beds": r["beds"] or 0,
        "specialties": r["specialties"] or "",
        "facilities": r["facilities"] or "",
    } for r in rows]


def get_stats():
    """Get aggregate statistics."""
    conn = get_db()
    cur = conn.cursor()

    total = cur.execute("SELECT COUNT(*) FROM hospitals").fetchone()[0]
    by_trust = {}
    for row in cur.execute("SELECT trust_score, COUNT(*) as cnt FROM hospitals GROUP BY trust_score"):
        by_trust[row["trust_score"]] = row["cnt"]

    by_state = {}
    for row in cur.execute("SELECT state, COUNT(*) as cnt FROM hospitals WHERE state != '' GROUP BY state ORDER BY cnt DESC LIMIT 10"):
        by_state[row["state"]] = row["cnt"]

    conn.close()
    return {"total": total, "by_trust": by_trust, "by_state": by_state}
