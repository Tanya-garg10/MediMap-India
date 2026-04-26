# 🏥 MediMap-India — Demo Script (2 min presentation)

---

## 🎬 Opening (15 sec)

> "India mein 10,000+ healthcare facilities hain — lekin kaise pata chalega ki kaunsa hospital sach mein capable hai aur kaunsa sirf claim kar raha hai? Meet **MediMap-India** — an AI-powered healthcare discovery platform that turns 10,000 static hospital records into a living intelligence network."

---

## 🧑‍💻 Live Demo Flow (90 sec)

### Step 1: Show the Landing Page (10 sec)

- Open `http://localhost:5176`
- Point out:
  - "10,000+ Verified Facilities" badge
  - India map with all facilities color-coded by trust score
  - 🟢 Green = High Trust, 🟡 Yellow = Medium, 🔴 Red = Low, ⚫ Grey = Flagged
  - Natural language search bar

> "Yeh hai humara dashboard — poore India ke 10,000 hospitals ek map pe, trust score ke hisaab se color-coded."

---

### Step 2: The Priya Story — Search Query (20 sec)

> "Meet Priya, an NGO worker in rural Bihar. Uske paas ek patient hai jisko emergency dialysis chahiye."

- Type in search bar: **"emergency dialysis hospital in Bihar"**
- Hit Enter
- Show the loading animation (AI agent processing)

> "Humara AI agent natural language samajhta hai — location detect karta hai, medical need extract karta hai, aur 10,000 records mein se filter karta hai."

---

### Step 3: Show AI Chain of Thought (15 sec)

- Point to the **🧠 AI Chain of Thought** panel that appears above results:
  - Location detected: Bihar
  - Medical needs: dialysis, nephrology, renal
  - Emergency: yes
  - Database matches: X facilities found in Bihar
  - Ranked by relevance + trust score

> "Yeh transparency hai — AI ne kya socha, kaise filter kiya, sab dikhta hai. Judges ke liye — yeh directly addresses the 10% UX transparency criteria."

---

### Step 4: Show Trust Score Cards (20 sec)

- Point to the result cards:
  - 🟢 **HIGH TRUST** hospital at top — "Safe for referral"
  - 🟡 **MEDIUM TRUST** — "Partial match, call ahead"
  - 🔴 **LOW TRUST** — "Critical gaps, do not rely"
  - ⚫ **FLAGGED** — "Fraud indicators detected, DO NOT refer"

- Click **"View AI reasoning & raw data"** on a flagged hospital:
  - Show the contradiction: "Claims Advanced Surgery but no Anesthesiologist"
  - Show raw facility record
  - Show fraud score

> "AI sirf rank nahi karta — woh batata hai KYU ek hospital flagged hai. Yahan dekho — yeh clinic cardiac surgery claim karta hai lekin staff mein sirf 1 MBBS doctor hai. Fraud score: 0.87."

---

### Step 5: Map View (15 sec)

- Click the **🗺️ Map** tab
- Show search results highlighted on the India map
- Show the **🏜️ Medical Desert** warning if it appears

> "Map pe dekho — search results highlighted hain. Aur yeh Medical Desert warning — iska matlab is area mein high-trust facilities ki kami hai. Yeh NGOs aur policymakers ke liye critical insight hai."

---

### Step 6: Try Another City (10 sec)

- Click "← New Search"
- Type: **"eye hospital in Delhi"**
- Show results — only Delhi hospitals appear

> "Koi bhi city, koi bhi state, koi bhi specialty — AI sab handle karta hai. Sirf usi location ke results aate hain, koi mixing nahi."

---

## 🏗️ Tech Architecture (15 sec)

> "Quick tech overview:"

- **Frontend**: React + Leaflet.js map — dark theme, mobile-friendly
- **Backend**: Python FastAPI — serves 10,000 records from SQLite
- **AI Trust Scorer**: Rule-based contradiction detector — flags hospitals that claim capabilities they can't back up
  - Claims surgery but no anesthesiologist? → Flagged
  - Claims ICU but zero beds? → Fraud indicator
  - NABH accredited + government + 24hr staff? → High Trust
- **Query Engine**: NLP-based — extracts location, specialty, urgency from natural language
- **Dataset**: 10,000 real Indian healthcare facilities with specialties, equipment, staff, coordinates

---

## 💡 Closing (15 sec)

> "MediMap-India turns 10,000 static records into actionable intelligence. Har hospital ke liye — trust score, AI reasoning, contradiction detection, aur fraud flagging. Priya jaise NGO workers ko ab pata chalega ki kahan refer karna safe hai — aur kahan nahi."

> "Thank you! 🙏"

---

## 🎯 Key Points to Emphasize for Judges

1. **AI Transparency** — Chain of thought visible for every query (10% UX criteria)
2. **Contradiction Detection** — Claims surgery but no anesthesiologist? Flagged automatically
3. **Fraud Detection** — Fake clinics identified with fraud score
4. **Medical Deserts** — Areas with no high-trust facility highlighted
5. **10,000 Real Records** — Not mock data, actual Indian healthcare dataset
6. **Natural Language** — "emergency dialysis in rural Bihar" just works
7. **Map Visualization** — All facilities color-coded by trust on India map

---

## 🔧 How to Run (for judges if they ask)

```bash
# Backend
pip install fastapi uvicorn pandas openpyxl scikit-learn numpy
python backend/main.py
# → Runs on http://localhost:8000

# Frontend
npm install
npx vite
# → Runs on http://localhost:5176
```

---

## 📝 Sample Queries to Demo

| Query | What it shows |
|-------|--------------|
| `emergency dialysis hospital in Bihar` | Location + specialty + urgency filter |
| `eye hospital in Delhi` | City-level strict filtering |
| `hospital in Telangana` | State-level filtering, 20 results |
| `NABH accredited hospital in Hyderabad` | Specific requirement filter |
| `cardiac surgery in Mumbai` | Specialty search |
| `nearest hospital for emergency appendectomy` | Emergency + surgery combo |
