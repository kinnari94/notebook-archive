# Bapaji Life Archive — Setup Guide

## One-time setup (do this once, in a terminal)

### 1. Install Python dependencies
```bash
pip install -r requirements.txt
```

### 2. Install browser for NotebookLM
```bash
playwright install chromium
```

### 3. Authenticate with NotebookLM (your Google account)
```bash
notebooklm login
```
This opens a browser. Sign in with the Google account that has your NotebookLM notebooks.

---

## Run the app
```bash
streamlit run app.py
```
Opens at http://localhost:8501

---

## First steps in the app

1. Go to **⚙️ Settings** → paste your MongoDB Atlas URI → click Test Connection
2. Go to **⚗️ Extract** → click "Load My Notebooks" → select notebooks → select categories → Run
3. Go to **📜 Browse** or **🕐 Timeline** to explore extracted incidents

---

## MongoDB Atlas (free tier is enough)

1. Go to https://cloud.mongodb.com → create a free cluster
2. Create a database user (Settings → Database Access)
3. Allow your IP (Network Access → Add IP)
4. Get the connection string: Connect → Drivers → copy URI
5. Replace `<password>` in the URI with your database user password

---

## File structure

```
bapaji-archive/
├── app.py                      ← Main app entry point
├── requirements.txt
├── pages/
│   ├── dashboard.py            ← Home overview
│   ├── extract.py              ← Run extractions
│   ├── browse.py               ← Browse by category/filter
│   ├── search.py               ← Full-text search
│   ├── timeline.py             ← Chronological view
│   └── settings.py             ← Configuration
├── utils/
│   ├── db.py                   ← MongoDB operations
│   ├── parser.py               ← Response → JSON parser
│   └── notebooklm_client.py    ← NotebookLM API wrapper
└── prompts/
    └── extraction_prompts.py   ← All 13 extraction prompts
```

---

## Notes

- NotebookLM sessions expire periodically — re-run `notebooklm login` if extraction fails
- MongoDB URI is stored in session only (not on disk) — re-enter after restarting the app
  (or add to `.streamlit/secrets.toml` as `MONGODB_URI = "..."` for persistence)
- The app handles Tier 1/2/3 classification — Tier 3 content is stored but only shown when filter allows
