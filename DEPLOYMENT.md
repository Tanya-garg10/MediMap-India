# 🚀 MediMap-India — Deployment Guide

---

## 📋 Prerequisites

- Python 3.10+
- Node.js 18+
- npm

---

## ⚡ Quick Start (Local)

### 1. Clone & Enter Project

```bash
git clone <your-repo-url>
cd medimap-india
```

### 2. Add Dataset

Place your Excel/CSV file in the `data/` folder:

```
data/VF_Hackathon_Dataset_India_Large.xlsx
```

### 3. Start Backend

```bash
pip install fastapi uvicorn pandas openpyxl scikit-learn numpy
python backend/main.py
```

- Runs on `http://localhost:8000`
- First run loads 10,000 records into SQLite (~20 sec)
- Subsequent runs skip loading (instant start)

### 4. Start Frontend

```bash
npm install
npx vite
```

- Runs on `http://localhost:5173` (or next available port)

### 5. Open Browser

Go to `http://localhost:5173` — done!

---

## 📁 Project Structure

```
medimap-india/
├── backend/
│   ├── main.py              # FastAPI server (entry point)
│   ├── database.py           # SQLite setup + dataset loader
│   ├── query_engine.py       # NLP query parser + search
│   ├── trust_scorer.py       # AI trust scoring + fraud detection
│   ├── requirements.txt      # Python dependencies
│   └── hospitals.db          # Auto-generated SQLite DB
├── src/
│   ├── App.jsx               # React frontend (map + search + cards)
│   └── main.jsx              # React entry point
├── data/
│   └── VF_Hackathon_Dataset_India_Large.xlsx
├── index.html
├── package.json
├── vite.config.js
├── DEMO_SCRIPT.md
└── DEPLOYMENT.md
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/query?q=...` | Natural language hospital search |
| GET | `/hospitals/map` | All hospitals with coordinates for map |
| GET | `/stats` | Aggregate statistics |
| GET | `/health` | Health check |
| GET | `/docs` | Swagger UI (auto-generated) |

### Example API Calls

```bash
# Search hospitals
curl "http://localhost:8000/query?q=eye+hospital+in+delhi"

# Get map data
curl "http://localhost:8000/hospitals/map"

# Get stats
curl "http://localhost:8000/stats"
```

---

## 🌐 Deploy to Cloud (Production)

### Option A: Railway (Easiest — Free Tier)

1. Push code to GitHub
2. Go to [railway.app](https://railway.app)
3. Create 2 services:

**Backend Service:**
- Root directory: `/backend`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Add env: `PORT=8000`

**Frontend Service:**
- Root directory: `/`
- Build command: `npm install && npm run build`
- Start command: `npx serve dist`

4. Update `API_BASE` in `src/App.jsx` to your backend URL

---

### Option B: Render (Free Tier)

**Backend:**
- New Web Service → connect GitHub repo
- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

**Frontend:**
- New Static Site → connect same repo
- Build command: `npm install && npm run build`
- Publish directory: `dist`

---

### Option C: Docker (Self-hosted / Any Cloud)

Create `Dockerfile` at project root:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install Node.js
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Backend deps
COPY backend/requirements.txt backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Frontend deps & build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Copy dataset
COPY data/ data/

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
docker build -t medimap-india .
docker run -p 8000:8000 medimap-india
```

---

## ⚠️ Notes

- `hospitals.db` is auto-generated on first run — don't commit it to git
- Add to `.gitignore`:
  ```
  node_modules/
  backend/hospitals.db
  backend/__pycache__/
  dist/
  ```
- Frontend falls back to mock data if backend is unreachable (demo mode)
- Backend auto-reloads on code changes (dev mode)
