# ThreatWatch v2 — Setup & Cloud Deployment Guide

---

## What was fixed in v2

| Issue | Fix |
|-------|-----|
| Same AI response for all alerts | AI now analyzes each alert uniquely using description + severity + agent |
| Escalate/Investigate/Resolve did nothing | Now calls POST /alerts/{id}/action — updates status live |
| Had to refresh browser for new alerts | SSE stream is ON by default — new alerts appear automatically |
| Generic "Other — MITRE ATT&CK: Other" classification | Specific rule-based fallback per attack type (credential, lateral, powershell, etc.) |
| Flat response text | Response now renders in 3 color-coded sections: Immediate Actions / Investigation / Patch |

---

## Local Setup (Your Current Lab)

### Backend (Ubuntu machine)

```bash
cd backend

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
nano .env   # paste your OPENAI_API_KEY
```

**Run:**
```bash
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend (any machine with Node.js)

Edit `vite.config.js` — change the BACKEND line to your Ubuntu IP:
```js
const BACKEND = 'http://192.168.1.100:8000'  // ← your Ubuntu IP
```

```bash
cd frontend
npm install
npm run dev
```

Open: `http://localhost:3000`

-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## Cloud Deployment (Step by Step)

Nothing in your code changes. You're just moving it to servers on the internet.

---

### Step 1 — Deploy Backend to Railway (Free)

Railway hosts your FastAPI server for free.

1. Go to https://railway.app and sign up (use GitHub)

2. In Railway dashboard → **New Project** → **Deploy from GitHub repo**

3. Push your backend folder to GitHub first:
```bash
# On your Ubuntu machine
cd backend
git init
git add main.py requirements.txt Dockerfile
git commit -m "ThreatWatch backend"
# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/threatwatch-backend.git
git push -u origin main
```

4. In Railway → select your repo → it auto-detects the Dockerfile

5. Add environment variables in Railway dashboard:
   - `OPENAI_API_KEY` = your key
   - `ALERTS_FILE` = `/var/ossec/logs/alerts/alerts.json`
   
   **Note:** In cloud mode, the alerts file won't exist on Railway's server.
   The backend automatically falls back to mock data, OR you switch to
   a database (see Step 3 below for the database approach).

6. Railway gives you a URL like: `https://threatwatch-backend.up.railway.app`

---

### Step 2 — Deploy Frontend to Vercel (Free)

1. Go to https://vercel.com and sign up (use GitHub)

2. Push your frontend to GitHub:
```bash
cd frontend
git init
git add .
git commit -m "ThreatWatch frontend"
git remote add origin https://github.com/YOUR_USERNAME/threatwatch-frontend.git
git push -u origin main
```

3. In Vercel → **New Project** → import your frontend repo

4. Vercel auto-detects Vite. Before deploying, set the backend URL.
   
   In `vite.config.js`, change the BACKEND line:
   ```js
   const BACKEND = 'https://threatwatch-backend.up.railway.app'
   ```
   
   Then push that change to GitHub — Vercel redeploys automatically.

5. Vercel gives you: `https://threatwatch.vercel.app`

---

### Step 3 — Connect Real Wazuh Alerts to Cloud (Optional)

The challenge: Wazuh runs on your Ubuntu machine, Railway runs in the cloud.
The alerts.json file is on your machine, not Railway's server.

**Option A — Ship alerts to Railway via HTTP (Simplest)**

Add a small script to your Ubuntu machine that reads new alerts and POSTs them to Railway:

```python
# forwarder.py — run this on Ubuntu alongside Wazuh
import json, time, requests, os

RAILWAY_URL = "https://your-app.up.railway.app/ingest"
ALERTS_FILE = "/var/ossec/logs/alerts/alerts.json"

seen = set()
while True:
    with open(ALERTS_FILE) as f:
        for line in f:
            try:
                alert = json.loads(line)
                key = str(alert)
                if key not in seen:
                    seen.add(key)
                    requests.post(RAILWAY_URL, json=alert, timeout=5)
            except:
                pass
    time.sleep(5)
```

Then add a `/ingest` endpoint to `main.py` on Railway:
```python
@app.post("/ingest")
def ingest_alert(alert: dict):
    # store in memory or database
    ingested_alerts.append(alert)
    return {"ok": True}
```

**Option B — Use a Cloud Database (Production-grade)**

1. Create a free PostgreSQL on https://supabase.com or https://neon.tech
2. Your Ubuntu forwarder writes alerts to the DB
3. Railway backend reads from the DB instead of alerts.json
4. Change one function in main.py: `load_raw_alerts()` queries DB instead of file

This is the proper production architecture.

---

## Summary: What Changes vs What Stays the Same

| Component | Local | Cloud |
|-----------|-------|-------|
| FastAPI scoring logic | runs on Ubuntu | runs on Railway (same code) |
| React dashboard | localhost:3000 | Vercel URL (same code) |
| Wazuh alerts source | reads alerts.json | forwarded via HTTP or DB |
| OpenAI API calls | same | same |
| Your formula scoring | unchanged | unchanged |
| AI agents | unchanged | unchanged |

**Your research logic (the hard part) never changes.**
Cloud is just infrastructure around it.

---

## Quick Reference: All API Endpoints

| Method | Endpoint | What it does |
|--------|----------|-------------|
| GET | `/alerts` | All alerts sorted by score |
| GET | `/alerts?severity=Critical` | Filter by priority |
| GET | `/alerts?search=mimikatz` | Search |
| GET | `/alerts/summary` | Stats dashboard |
| GET | `/alerts/{id}` | Single alert |
| POST | `/alerts/{id}/action` | Set status: Escalated/Investigating/Resolved/Open |
| POST | `/refresh` | Clear AI cache, reload |
| GET | `/alerts/stream/live` | SSE live stream |

---

## Formula (unchanged from your original)

```
Score = (Technique × Asset × Privilege × Confidence) / Noise
```

Priority: Critical ≥ 400 · High ≥ 250 · Medium ≥ 100 · Low < 100
