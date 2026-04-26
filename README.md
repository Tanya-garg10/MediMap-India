# 🏥 MediMap-India

**AI-powered healthcare discovery platform for India — turning 10,000 static hospital records into a living intelligence network.**

Search any city, state, or specialty in natural language. Every result comes with a Trust Score, AI reasoning chain, contradiction detection, and fraud flagging.

---

## ✨ Features

- 🔍 **Natural Language Search** — "emergency dialysis hospital in Bihar" just works
- 🛡️ **AI Trust Scoring** — Every facility scored as High / Medium / Low / Flagged
- 🧠 **Chain of Thought** — See exactly how the AI reasoned about each result
- 🚨 **Contradiction Detection** — Claims surgery but no anesthesiologist? Auto-flagged
- 🕵️ **Fraud Detection** — Fake clinics identified with fraud score
- 🗺️ **India Map** — 10,000 facilities plotted, color-coded by trust score
- 🏜️ **Medical Desert Alerts** — Areas with no high-trust facility highlighted
- 📱 **Mobile Friendly** — Responsive dark-themed UI

---

## 🖼️ Screenshots

| Landing Page | Search Results |
|:---:|:---:|
| Map with 10k facilities | Trust-scored hospital cards |

| AI Reasoning | Map View |
|:---:|:---:|
| Chain of thought + raw data | Search results on map |

---

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React + Leaflet.js |
| Backend | Python FastAPI |
| Database | SQLite |
| AI | Rule-based Trust Scorer + NLP Query Engine |
| Dataset | 10,000 Indian healthcare facilities |

---

## ⚡ Quick Start

### 1. Clone

```bash
git clone https://github.com/Tanya-garg10/MediMap-India.git
cd MediMap-India
```

### 2. Start Backend

```bash
pip install fastapi uvicorn pandas openpyxl scikit-learn numpy
python backend/main.py
```
→ Runs on `http://localhost:8000` — loads 10k records on first run

### 3. Start Frontend

```bash
npm install
npx vite
```
→ Runs on `http://localhost:5173`

### 4. Open Browser

Go to `http://localhost:5173` — search away!

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/query?q=...` | Natural language hospital search |
| GET | `/hospitals/map` | All hospitals with coordinates |
| GET | `/stats` | Aggregate statistics |
| GET | `/health` | Health check |
| GET | `/docs` | Swagger UI |

---

## 🧠 How Trust Scoring Works

The AI analyzes each hospital record for:

| Signal | Example | Effect |
|--------|---------|--------|
| ✅ NABH accredited | Verified accreditation | +20 points |
| ✅ Government operated | Central/State govt | +15 points |
| ✅ 24hr anesthesiologist | Round-the-clock staff | +15 points |
| ⚠️ Claims surgery, no anesthesiologist | Contradiction | -25 points |
| ⚠️ Claims ICU, zero beds | Mismatch | -20 points |
| 🚨 Multiple unverified claims | "Claimed: Cardiac, Neuro" | -30 points |
| 🚨 License not found | NMC registry miss | -35 points |

**Final Score:**
- 🟢 **High Trust** (30+ points) — Safe for referral
- 🟡 **Medium Trust** (0-29 points) — Call ahead
- 🔴 **Low Trust** (below 0) — Do not rely
- ⚫ **Flagged** (fraud detected) — DO NOT refer

---

## 📁 Project Structure

```
MediMap-India/
├── backend/
│   ├── main.py              # FastAPI server
│   ├── database.py          # SQLite + dataset loader
│   ├── query_engine.py      # NLP search engine
│   ├── trust_scorer.py      # Trust scoring + fraud detection
│   └── requirements.txt
├── src/
│   ├── App.jsx              # React UI (map + search + cards)
│   └── main.jsx
├── data/
│   └── VF_Hackathon_Dataset_India_Large.xlsx
├── index.html
├── package.json
├── vite.config.js
├── DEMO_SCRIPT.md
└── DEPLOYMENT.md
```

---

## 🎯 Sample Queries

| Query | What it does |
|-------|-------------|
| `emergency dialysis hospital in Bihar` | Location + specialty + urgency |
| `eye hospital in Delhi` | City-level filtering |
| `hospital in Telangana` | State-level filtering |
| `NABH accredited hospital in Hyderabad` | Specific requirement |
| `cardiac surgery in Mumbai` | Specialty search |

---

## 👥 Team

Built for the Veersa Foundation Hackathon — Challenge 3: Serving A Nation

---

## 📄 License

MIT
