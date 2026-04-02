<h1 align="center">OfferU</h1>

<p align="center">
  <em>Offer \+ U = OfferU — Your AI-powered job hunting companion</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=flat&logo=fastapi" />
  <img src="https://img.shields.io/badge/Frontend-Next.js%2014-000000?style=flat&logo=nextdotjs" />
  <img src="https://img.shields.io/badge/AI-OpenAI%20%7C%20DeepSeek%20%7C%20Ollama-412991?style=flat&logo=openai" />
  <img src="https://img.shields.io/badge/Deploy-Docker-2496ED?style=flat&logo=docker" />
  <img src="https://img.shields.io/badge/License-MIT-brightgreen?style=flat" />
</p>

<p align="center">
  <a href="./README.md">中文</a> ·
  <a href="#-quick-start">Quick Start</a> ·
  <a href="#-features">Features</a> ·
  <a href="#-disclaimer">Disclaimer</a>
</p>

---

## Acknowledgements

This project is forked from [chunxubioinfor/DailyJobMatch](https://github.com/chunxubioinfor/DailyJobMatch). Thanks to original author Chunxu Han for the outstanding contribution. OfferU has been restructured to remove n8n dependency and the scoring system, focusing on **smart resume editing + multi-platform job scraping + AI resume optimization**.

---

## ✨ Features

### 🎨 Smart Resume Editor
- Tiptap rich text editor with dark theme
- Real-time preview + one-click PDF export (WeasyPrint)
- Drag-and-drop sections, multi-template, undo/redo

### 🔍 Multi-Platform Job Scraping
- Pluggable scraper adapter architecture
- Supports: LinkedIn / BOSS Zhipin / Zhilian / Shixiseng / Corporate sites (ByteDance / Alibaba / Tencent)
- Flexible keyword + location + exclusion filter configuration

### 🤖 AI Resume Optimization (Core Feature)
- Select target JD → AI analyzes gaps → generates suggestions → one-click apply
- Multi-LLM support: OpenAI / DeepSeek / local Ollama
- AI-generated cover letters

### 📊 Data Visualization
- Dashboard with job collection trends
- Weekly report: source distribution, trending keywords, week-over-week comparison
- Responsive dark theme + Framer Motion animations

### 📬 Interview Management
- Gmail OAuth auto-sync interview emails
- AI parses interview time/location/company
- FullCalendar scheduling (month/week/day views)
- Application tracking (pending → interview → offer)

---

## 🚀 Quick Start

### Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop/) & Docker Compose
- OpenAI API Key (or compatible LLM key)

### 1. Clone & Configure

```bash
git clone https://github.com/Paker-kk/OfferU.git
cd OfferU
cp .env.example .env
```

Edit `.env` with your configuration:

| Variable | Description | Required |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI API Key | ✅ |
| `DATABASE_URL` | Database connection string | Default: SQLite |
| `SECRET_KEY` | Security key (change in production) | ✅ |
| `APIFY_API_KEY` | Apify Token (LinkedIn scraping) | Optional |
| `GMAIL_CLIENT_ID` | Gmail OAuth (email sync) | Optional |
| `CORS_ORIGINS` | Frontend CORS origin | Default: localhost:3000 |

### 2. Launch

```bash
docker compose up -d
```

| Service | URL | Description |
|---|---|---|
| Frontend | http://localhost:3000 | Web application |
| Backend API | http://localhost:8000 | FastAPI + auto docs |
| API Docs | http://localhost:8000/docs | Swagger interactive docs |

### 3. Verify

```bash
docker compose ps
curl http://localhost:8000/api/health
# Returns {"status": "healthy", "service": "OfferU"}
```

---

## 🛠️ Development Setup

### Backend (FastAPI)

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

---

## 📡 API Documentation

Full interactive docs at http://localhost:8000/docs

### Key Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/jobs/` | Job listing (paginated/filtered) |
| GET | `/api/jobs/stats` | Summary statistics |
| GET | `/api/jobs/{id}` | Job details |
| GET | `/api/jobs/trend` | Collection trend data |
| GET | `/api/jobs/weekly-report` | Weekly analytics |
| POST | `/api/jobs/ingest` | Batch job ingestion |
| GET/POST | `/api/resume/` | Resume CRUD |
| POST | `/api/resume/export` | Export PDF |
| POST | `/api/resume/optimize` | AI resume optimization |
| GET | `/api/calendar/events` | Calendar events |
| POST | `/api/email/sync` | Sync emails |
| GET/PUT | `/api/config/` | System configuration |
| GET/POST | `/api/applications/` | Application management |
| POST | `/api/applications/generate` | AI cover letter |

---

## ⚠️ Disclaimer

### API Key Security
- Your API keys (OpenAI / DeepSeek etc.) are managed by you — this project **does not** upload keys to any third-party server
- `.env` is excluded by `.gitignore` — **never** commit files containing real keys
- Rotate keys regularly and set Usage Limits in your AI provider dashboard

### Data & Privacy
- All data (resumes, job info, interview records) is stored in your local database
- Gmail OAuth is only used to read interview-related emails
- When calling AI APIs, resume/JD content is sent to the respective AI provider — review their privacy policies

### Web Scraping
- Scraper adapters are provided for educational and research purposes only
- Check target website's robots.txt and ToS before use
- Excessive scraping may result in IP bans — users bear responsibility
- **Do not** use scraped data for commercial purposes or to infringe on others' rights

### AI-Generated Content
- AI-optimized resumes and cover letters are suggestions only — review carefully before use
- AI output may contain factual errors — users should verify independently
- The final submitted resume is the user's own responsibility

### Cost Notice
- Commercial AI APIs (OpenAI / DeepSeek) incur usage fees — check provider pricing
- Start with smaller models (e.g., GPT-4o-mini) for testing
- Use local Ollama with open-source models for free (requires sufficient hardware)

---

## 🗺️ Roadmap

- [x] FastAPI backend API
- [x] Next.js frontend dashboard
- [x] Multi-platform scraper architecture
- [x] Resume editor + PDF export
- [x] Gmail OAuth email sync
- [x] FullCalendar scheduling
- [x] Application tracking + AI cover letter
- [x] Weekly analytics
- [ ] AI resume optimization (select JD → analyze gaps → one-click fix)
- [ ] Multi-LLM support (DeepSeek / Ollama)
- [ ] Tauri desktop app (double-click install, zero Docker)
- [ ] WeChat mini program
- [ ] Application automation (auto-fill & submit)

---

## 📬 Contact

- **GitHub**: [Paker-kk/OfferU](https://github.com/Paker-kk/OfferU)
- **Original Project**: [chunxubioinfor/DailyJobMatch](https://github.com/chunxubioinfor/DailyJobMatch)

Issues and PRs welcome!
