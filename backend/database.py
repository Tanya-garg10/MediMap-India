"""SQLite database setup and data loader — reads dataset from ../data/ folder."""
import sqlite3
import os
import json
import pandas as pd

DB_PATH = os.path.join(os.path.dirname(__file__), "hospitals.db")
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create tables and load dataset from ../data/ folder."""
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS hospitals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            location TEXT,
            state TEXT,
            district TEXT,
            pin TEXT,
            lat REAL,
            lng REAL,
            hospital_type TEXT,
            ownership TEXT,
            beds INTEGER DEFAULT 0,
            specialties TEXT,
            equipment TEXT,
            staff TEXT,
            facilities TEXT,
            contact TEXT,
            notes TEXT,
            raw_record TEXT,
            trust_score TEXT DEFAULT 'Medium',
            trust_reasoning TEXT,
            trust_details TEXT,
            fraud_score REAL DEFAULT 0.0
        )
    """)
    conn.commit()

    # Check if already loaded
    count = cur.execute("SELECT COUNT(*) FROM hospitals").fetchone()[0]
    if count > 0:
        print(f"Database already has {count} records. Skipping load.")
        conn.close()
        return

    # Find dataset file
    df = _load_dataset()
    if df is None:
        print("No dataset found in data/ folder. Using built-in sample data.")
        _load_sample_data(conn)
        conn.close()
        return

    print(f"Loading {len(df)} records from dataset...")
    _import_dataframe(conn, df)
    conn.close()
    print("Database initialized successfully.")


def _load_dataset():
    """Try to load Excel or CSV from data/ folder."""
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR, exist_ok=True)
        return None

    for f in os.listdir(DATA_DIR):
        fp = os.path.join(DATA_DIR, f)
        try:
            if f.endswith((".xlsx", ".xls")):
                return pd.read_excel(fp)
            elif f.endswith(".csv"):
                return pd.read_csv(fp)
        except Exception as e:
            print(f"Error reading {f}: {e}")
    return None


def _parse_json_list(val):
    """Parse a JSON-like list string, e.g. '["a","b"]' -> 'a, b'."""
    if pd.isna(val) or not val:
        return ""
    s = str(val).strip()
    if s.startswith("["):
        try:
            items = json.loads(s.replace("'", '"'))
            return ", ".join(str(i) for i in items if i)
        except Exception:
            pass
    return s


def _import_dataframe(conn, df):
    """Import the VF_Hackathon dataset into the hospitals table."""
    from trust_scorer import compute_trust_score

    cur = conn.cursor()
    imported = 0

    for _, row in df.iterrows():
        raw_record = json.dumps({k: str(v) for k, v in row.to_dict().items() if pd.notna(v)}, ensure_ascii=False)

        name = str(row.get("name", "Unknown Facility"))

        # Build location from address fields
        city = str(row.get("address_city", "")) if pd.notna(row.get("address_city")) else ""
        addr1 = str(row.get("address_line1", "")) if pd.notna(row.get("address_line1")) else ""
        addr2 = str(row.get("address_line2", "")) if pd.notna(row.get("address_line2")) else ""
        location = ", ".join(filter(None, [addr1, addr2, city]))

        state = str(row.get("address_stateOrRegion", "")) if pd.notna(row.get("address_stateOrRegion")) else ""
        district = city  # use city as district proxy
        pin = str(row.get("address_zipOrPostcode", "")) if pd.notna(row.get("address_zipOrPostcode")) else ""
        # Clean pin — remove .0 from float conversion
        if pin.endswith(".0"):
            pin = pin[:-2]

        lat = _safe_float(row.get("latitude"))
        lng = _safe_float(row.get("longitude"))

        hospital_type = str(row.get("facilityTypeId", "")) if pd.notna(row.get("facilityTypeId")) else ""
        ownership = str(row.get("operatorTypeId", "")) if pd.notna(row.get("operatorTypeId")) else ""

        beds = _safe_int(row.get("capacity"))
        num_doctors = _safe_int(row.get("numberDoctors"))

        # Parse JSON list fields
        specialties = _parse_json_list(row.get("specialties"))
        equipment = _parse_json_list(row.get("equipment"))
        procedures = _parse_json_list(row.get("procedure"))
        capability = _parse_json_list(row.get("capability"))
        phone = _parse_json_list(row.get("phone_numbers"))

        # Combine capability + procedures as facilities info
        facilities = ", ".join(filter(None, [procedures, capability]))
        # Use description as notes
        notes = str(row.get("description", "")) if pd.notna(row.get("description")) else ""

        # Build staff string from numberDoctors + capability
        staff_parts = []
        if num_doctors > 0:
            staff_parts.append(f"{num_doctors} doctors")
        # Extract staff mentions from capability
        cap_lower = capability.lower()
        if "surgeon" in cap_lower:
            staff_parts.append("Surgeon")
        if "anesthesiologist" in cap_lower or "anaesthesiologist" in cap_lower:
            staff_parts.append("Anesthesiologist")
        if "ophthalmologist" in cap_lower:
            staff_parts.append("Ophthalmologist")
        if "cardiologist" in cap_lower:
            staff_parts.append("Cardiologist")
        staff = ", ".join(staff_parts)

        contact = phone or (str(int(row.get("officialPhone"))) if pd.notna(row.get("officialPhone")) and row.get("officialPhone") else "")

        # Compute trust score
        trust = compute_trust_score(
            name=name, specialties=specialties, equipment=equipment,
            staff=staff, beds=beds, notes=notes, facilities=facilities,
            ownership=ownership
        )

        cur.execute("""
            INSERT INTO hospitals (name, location, state, district, pin, lat, lng,
                hospital_type, ownership, beds, specialties, equipment, staff,
                facilities, contact, notes, raw_record,
                trust_score, trust_reasoning, trust_details, fraud_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            name, location, state, district, pin, lat, lng,
            hospital_type, ownership, beds, specialties, equipment, staff,
            facilities, contact, notes, raw_record,
            trust["score"], trust["reasoning"], json.dumps(trust["details"]),
            trust["fraud_score"]
        ))
        imported += 1
        if imported % 1000 == 0:
            print(f"  Imported {imported} records...")

    conn.commit()
    print(f"  Total imported: {imported}")


def _safe_float(val):
    try:
        v = float(val)
        return v if not pd.isna(v) else None
    except (ValueError, TypeError):
        return None


def _safe_int(val):
    try:
        v = int(float(val))
        return v if v >= 0 else 0
    except (ValueError, TypeError):
        return 0


def _load_sample_data(conn):
    """Load built-in sample data when no dataset file is available."""
    from trust_scorer import compute_trust_score

    samples = [
        {"name": "AIIMS Patna", "location": "Phulwari Sharif, Bihar", "state": "Bihar", "district": "Patna",
         "pin": "801505", "lat": 25.5471, "lng": 85.0637, "hospital_type": "Government", "ownership": "Central Govt",
         "beds": 960, "specialties": "Trauma,Surgery,Cardiology,Neurology,Nephrology,Oncology",
         "equipment": "ICU,OT x12,Blood Bank,Ventilators,CT Scan,MRI",
         "staff": "Anesthesiologist 24hr,Surgeons,Cardiologists,Neurologists",
         "facilities": "Trauma Center,ICU 120 beds,Blood Bank,NABH Accredited,12 OTs,Telemedicine",
         "contact": "1800-180-2222", "notes": "Top-tier facility. Central government operated. All surgical specialties 24/7. Dedicated trauma center. Verified telemedicine. Last audit: Feb 2024."},
        {"name": "Patna Medical College & Hospital", "location": "Patna, Bihar", "state": "Bihar", "district": "Patna",
         "pin": "800004", "lat": 25.6093, "lng": 85.1376, "hospital_type": "Government", "ownership": "State Govt",
         "beds": 850, "specialties": "Surgery,Emergency,Medicine,Pediatrics,Orthopedics",
         "equipment": "ICU,OT x4,Blood Bank,Ventilators,X-Ray",
         "staff": "Anesthesiologist 24hr,Surgeons,Emergency Physicians",
         "facilities": "ICU 48 beds,Blood Bank,24/7 Emergency,NABH Accredited,4 OTs",
         "contact": "+91-612-2300001", "notes": "Fully equipped for emergency surgery. Dedicated ICU, on-call anesthesiologist 24/7. Emergency response within 15 minutes. Blood bank fully stocked. Last verified: Mar 2024."},
        {"name": "Sadar Government Hospital", "location": "Chapra, Bihar", "state": "Bihar", "district": "Saran",
         "pin": "841301", "lat": 25.7742, "lng": 84.7388, "hospital_type": "Government", "ownership": "State Govt",
         "beds": 200, "specialties": "General Surgery,Medicine",
         "equipment": "OT x2,X-Ray",
         "staff": "Anesthesiologist Part-time",
         "facilities": "OT (2),Day Emergency Only,General Ward,Pharmacy",
         "contact": "+91-6152-232451", "notes": "Has surgical capability but limited anesthesia staff. Emergency surgery possible during day hours only. No dedicated ICU. Drug shortages reported. Last verified: Jan 2024."},
        {"name": "Rural Health Center Sonepur", "location": "Sonepur, Bihar", "state": "Bihar", "district": "Saran",
         "pin": "841101", "lat": 25.6892, "lng": 85.1832, "hospital_type": "PHC", "ownership": "State Govt",
         "beds": 30, "specialties": "General",
         "equipment": "Basic OPD",
         "staff": "MBBS Doctor",
         "facilities": "Basic OPD,Limited Emergency",
         "contact": "+91-6181-222101", "notes": "Claims to perform surgeries but no registered anesthesiologist. Equipment logs show OT non-functional 8+ months. Multiple unresolved patient complaints. Last verified: Dec 2023."},
        {"name": "New Life Super Specialty Clinic", "location": "Hajipur, Bihar", "state": "Bihar", "district": "Vaishali",
         "pin": "844101", "lat": 25.6878, "lng": 85.2093, "hospital_type": "Private", "ownership": "Private",
         "beds": 0, "specialties": "Claimed: Cardiac Surgery,Neurosurgery",
         "equipment": "Claimed: ICU",
         "staff": "1 MBBS doctor",
         "facilities": "Claimed: ICU,Claimed: Cardiac,Claimed: Neuro",
         "contact": "Not Verified", "notes": "FLAGGED: Claims Advanced Cardiac Surgery and Neurosurgery but has only 1 registered MBBS doctor. No valid NABH/NMC license. Address verification failed. Similarity to known fraudulent listings: 0.87."},
        {"name": "Indira Gandhi Institute of Medical Sciences", "location": "Sheikhpura, Patna, Bihar", "state": "Bihar", "district": "Patna",
         "pin": "800014", "lat": 25.6244, "lng": 85.0868, "hospital_type": "Government", "ownership": "State Govt",
         "beds": 700, "specialties": "Cardiology,Nephrology,Neurology,Surgery,Oncology,Dialysis",
         "equipment": "ICU,OT x8,Blood Bank,Dialysis Unit,CT Scan,MRI,Ventilators",
         "staff": "Anesthesiologist 24hr,Nephrologists,Cardiologists,Surgeons",
         "facilities": "ICU 80 beds,Dialysis Unit,Blood Bank,8 OTs,Cancer Center",
         "contact": "+91-612-2297631", "notes": "Major state-run hospital. Strong nephrology and dialysis department. 24/7 emergency services. NABH accredited. Last verified: Mar 2024."},
        {"name": "Nalanda Medical College", "location": "Patna, Bihar", "state": "Bihar", "district": "Patna",
         "pin": "800004", "lat": 25.6115, "lng": 85.1445, "hospital_type": "Government", "ownership": "State Govt",
         "beds": 600, "specialties": "Surgery,Medicine,Pediatrics,Gynecology,Orthopedics",
         "equipment": "ICU,OT x5,Blood Bank,X-Ray,Ultrasound",
         "staff": "Anesthesiologist 24hr,Surgeons,Pediatricians",
         "facilities": "ICU 40 beds,Blood Bank,Emergency,5 OTs",
         "contact": "+91-612-2650011", "notes": "Well-established medical college hospital. Good surgical capabilities. Moderate infrastructure. Last verified: Feb 2024."},
        {"name": "Darbhanga Medical College", "location": "Darbhanga, Bihar", "state": "Bihar", "district": "Darbhanga",
         "pin": "846003", "lat": 26.1542, "lng": 85.8918, "hospital_type": "Government", "ownership": "State Govt",
         "beds": 500, "specialties": "Surgery,Medicine,Pediatrics,ENT,Ophthalmology",
         "equipment": "ICU,OT x4,Blood Bank,X-Ray",
         "staff": "Anesthesiologist,Surgeons",
         "facilities": "ICU 30 beds,Blood Bank,Emergency,4 OTs",
         "contact": "+91-6272-222333", "notes": "Regional medical college. Serves North Bihar. Adequate for most emergencies. Some equipment aging. Last verified: Jan 2024."},
        {"name": "Sri Krishna Medical College", "location": "Muzaffarpur, Bihar", "state": "Bihar", "district": "Muzaffarpur",
         "pin": "842004", "lat": 26.1209, "lng": 85.3647, "hospital_type": "Government", "ownership": "State Govt",
         "beds": 450, "specialties": "Surgery,Medicine,Pediatrics,Orthopedics",
         "equipment": "ICU,OT x3,Blood Bank,X-Ray",
         "staff": "Anesthesiologist,Surgeons,Pediatricians",
         "facilities": "ICU 25 beds,Blood Bank,Emergency,3 OTs",
         "contact": "+91-621-2240055", "notes": "Key hospital for Muzaffarpur region. Handles encephalitis outbreaks. Good pediatric department. Last verified: Feb 2024."},
        {"name": "Sadar Hospital Gaya", "location": "Gaya, Bihar", "state": "Bihar", "district": "Gaya",
         "pin": "823001", "lat": 24.7955, "lng": 84.9994, "hospital_type": "Government", "ownership": "State Govt",
         "beds": 300, "specialties": "Surgery,Medicine,Emergency",
         "equipment": "OT x2,X-Ray,Ultrasound",
         "staff": "Anesthesiologist Part-time,Surgeons",
         "facilities": "OT (2),Emergency,General Ward",
         "contact": "+91-631-2220011", "notes": "District hospital. Basic surgical capabilities. Limited specialist availability on weekends. Last verified: Dec 2023."},
    ]

    cur = conn.cursor()
    for s in samples:
        trust = compute_trust_score(
            name=s["name"], specialties=s["specialties"], equipment=s["equipment"],
            staff=s["staff"], beds=s["beds"], notes=s["notes"],
            facilities=s["facilities"], ownership=s["ownership"]
        )
        raw_record = json.dumps(s, ensure_ascii=False)
        cur.execute("""
            INSERT INTO hospitals (name, location, state, district, pin, lat, lng,
                hospital_type, ownership, beds, specialties, equipment, staff,
                facilities, contact, notes, raw_record,
                trust_score, trust_reasoning, trust_details, fraud_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            s["name"], s["location"], s["state"], s["district"], s["pin"],
            s["lat"], s["lng"], s["hospital_type"], s["ownership"], s["beds"],
            s["specialties"], s["equipment"], s["staff"], s["facilities"],
            s["contact"], s["notes"], raw_record,
            trust["score"], trust["reasoning"], json.dumps(trust["details"]),
            trust["fraud_score"]
        ))
    conn.commit()
    print(f"Loaded {len(samples)} sample records.")
