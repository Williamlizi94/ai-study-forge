# AI Study Forge

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:256f61,100:8fb9aa&height=180&section=header&text=AI%20Study%20Forge&fontSize=44&fontColor=ffffff&animation=fadeIn&fontAlignY=36&desc=Turn%20course%20materials%20into%20exam-ready%20review%20packs&descAlignY=58&descSize=16" alt="AI Study Forge banner" />
</p>

<p align="center">
  <a href="https://aistudyforge.com"><img src="https://img.shields.io/badge/Live-aistudyforge.com-256f61?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Live site" /></a>
  <img src="https://img.shields.io/badge/Users-50%2B%20students-8fb9aa?style=for-the-badge" alt="50+ users" />
  <img src="https://img.shields.io/badge/Status-Beta-1f7a6b?style=for-the-badge" alt="Beta status" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white" alt="OpenAI" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/AWS-232F3E?style=flat-square&logo=amazonaws&logoColor=white" alt="AWS" />
</p>

## ✨ What It Does

**AI Study Forge** is a full-stack AI exam-prep SaaS product that helps students turn messy course materials into structured, exam-ready study tools.

Upload PDFs, slides, notes, homework solutions, or paste raw text. AI Study Forge processes the material and generates:

- 📝 **AI Notes** for condensed explanations
- 📌 **Cheat Sheets** for formulas, concepts, and key processes
- 🧠 **Practice Quizzes** with explanations
- 🃏 **Flashcards** for active recall
- ❌ **Mistake Notebook** for missed quiz questions
- 💬 **AI Tutor** answers grounded in uploaded course content

> Built as a real SaaS MVP, not a generic ChatGPT wrapper. The core workflow is designed around exam preparation: **Add Study Material → Process Material → Generate Exam Review Pack → Practice → Review Mistakes**.

## 🚀 Live Product

| Item | Details |
|---|---|
| 🌐 Live app | [https://aistudyforge.com](https://aistudyforge.com) |
| 👥 Usage | 50+ students have used the product |
| 🎯 Target user | Students preparing for exams from slides, notes, PDFs, and homework materials |
| 🧪 Stage | Public beta / MVP |
| 🔐 Auth | Email/password account mode + Google OAuth setup |
| ☁️ Deployment | AWS Elastic Beanstalk, RDS/PostgreSQL, CloudFront, Route 53, ACM HTTPS |

## 🧭 Product Flow

```mermaid
flowchart LR
    A["📚 Add Study Material"] --> B["⚙️ Process Material"]
    B --> C["🎯 Generate Exam Review Pack"]
    C --> D["📝 AI Notes"]
    C --> E["📌 Cheat Sheet"]
    C --> F["🃏 Flashcards"]
    C --> G["🧠 Practice Quiz"]
    G --> H["❌ Mistake Notebook"]
    D --> I["💬 Ask AI Tutor"]
    E --> I
    H --> C
```

## 🧩 Core Features

| Feature | What It Helps Students Do | Status |
|---|---|---|
| 📤 Document Upload | Upload `.txt`, text-based `.pdf`, `.docx`, `.pptx`, and best-effort `.doc` / `.ppt` files | ✅ Built |
| ✍️ Paste Text Input | Paste lecture notes, homework solutions, transcripts, or textbook excerpts | ✅ Built |
| 📝 AI Notes | Convert raw material into condensed study notes | ✅ Built |
| 📌 Cheat Sheet | Generate an exam-ready summary of formulas, definitions, and processes | ✅ Built |
| 🧠 Practice Quiz | Create quiz questions and answer explanations from course content | ✅ Built |
| ❌ Mistake Notebook | Automatically save missed quiz questions for review | ✅ Built |
| 🃏 Flashcards | Generate active-recall flashcards | ✅ Built |
| 💬 Ask AI Tutor | Ask questions grounded in uploaded notes | ✅ Built |
| 🕘 History | Save and reopen previous study sessions | ✅ Built |
| ⭐ Favorites | Mark important study records for quick access | ✅ Built |
| 👤 Accounts | Keep user histories isolated by account | ✅ Built |
| 🚀 CI/CD | Push to GitHub and deploy automatically to AWS | ✅ Built |

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | Python FastAPI |
| API Style | REST API |
| AI | OpenAI API, called from the backend only |
| Local Database | SQLite |
| Production Database | PostgreSQL via `DATABASE_URL` |
| Auth | Email/password auth, signed browser tokens, Google OAuth setup |
| Deployment | Docker, AWS Elastic Beanstalk, RDS, CloudFront, Route 53, ACM HTTPS |
| CI/CD | GitHub Actions |

## 🏗️ Architecture

```mermaid
flowchart TB
    User["👨‍🎓 Student"] --> Web["React + Vite Frontend"]
    Web --> API["FastAPI Backend"]
    API --> Parser["Document Parser"]
    API --> Auth["Auth + User Sessions"]
    API --> DB[("PostgreSQL / SQLite")]
    API --> AI["OpenAI API"]

    GitHub["GitHub Push"] --> Actions["GitHub Actions"]
    Actions --> ECR["AWS ECR"]
    ECR --> EB["Elastic Beanstalk Docker App"]
    EB --> RDS[("AWS RDS PostgreSQL")]
    Route53["Route 53 + ACM"] --> CloudFront["CloudFront HTTPS"]
    CloudFront --> EB
```

## 🔐 Safety Controls

| Control | Purpose |
|---|---|
| Server-side OpenAI key | API key never ships to the browser |
| Account-scoped sessions | Users only see their own history |
| Daily AI limits | Controls OpenAI cost during beta |
| Production config checks | App refuses unsafe production settings |
| Mock AI mode | Test flows without spending OpenAI credits |
| HTTPS + custom domain | Production traffic served through TLS |

## ⚡ Quick Start

<details>
<summary><strong>Run locally on Windows</strong></summary>

### 1. Create and activate a virtual environment

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 2. Install dependencies

```powershell
pip install -r requirements.txt
```

### 3. Create `.env`

```powershell
Copy-Item .env.example .env
```

Set your OpenAI key in `.env`:

```text
OPENAI_API_KEY=your_openai_api_key
```

For local testing without OpenAI cost:

```text
MOCK_AI=true
```

### 4. Start the app

```powershell
.\scripts\run_dev.ps1
```

Open:

```text
http://127.0.0.1:8000
```

</details>

<details>
<summary><strong>Production environment variables</strong></summary>

For AWS or another production deployment:

```text
APP_ENV=production
REQUIRE_USER_ACCOUNTS=true
AUTH_TOKEN_SECRET=a_random_secret_with_at_least_32_characters
DATABASE_URL=postgresql://user:password@host:5432/database
MOCK_AI=false
OPENAI_API_KEY=your_openai_api_key
PER_USER_DAILY_AI_LIMIT=20
GLOBAL_DAILY_AI_LIMIT=100
MAX_SOURCE_CHARS=100000
MAX_UPLOAD_MB=10
```

With `APP_ENV=production`, the app refuses to start if critical production settings are unsafe.

</details>

## 🧪 Testing

| Command | Purpose |
|---|---|
| `.\scripts\smoke_test.ps1` | No-cost health check |
| `.\scripts\smoke_test.ps1 -RunStudyApi` | Create, fetch, list, and delete a test study session |
| `.\scripts\production_readiness.ps1` | Production readiness check |
| `.\scripts\production_readiness.ps1 -SkipBuild -BaseUrl "https://aistudyforge.com"` | Check the deployed app |

## 📡 API Overview

<details>
<summary><strong>Core REST endpoints</strong></summary>

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/auth/status` | Auth state |
| `POST` | `/api/auth/login` | Login |
| `POST` | `/api/auth/register` | Register |
| `GET` | `/api/study/sessions` | List study sessions |
| `POST` | `/api/study/sessions` | Create a study session |
| `POST` | `/api/study/sessions/upload` | Upload and parse a document |
| `GET` | `/api/study/sessions/{session_id}` | Fetch one session |
| `POST` | `/api/study/sessions/{session_id}/summary` | Generate AI notes |
| `POST` | `/api/study/sessions/{session_id}/cheat-sheet` | Generate cheat sheet |
| `POST` | `/api/study/sessions/{session_id}/flashcards` | Generate flashcards |
| `POST` | `/api/study/sessions/{session_id}/quiz` | Generate quiz |
| `POST` | `/api/study/sessions/{session_id}/quiz/mistakes` | Save missed questions |
| `POST` | `/api/study/sessions/{session_id}/quiz/review` | Review quiz answers |
| `POST` | `/api/study/sessions/{session_id}/chat` | Ask AI Tutor |

</details>

## 🐳 Docker

```powershell
docker build -t ai-study-forge .
docker run --env-file .env.production.local -p 8000:8000 ai-study-forge
```

Health check:

```text
http://127.0.0.1:8000/api/health
```

## ☁️ Deployment

AI Study Forge is deployed with:

| AWS Service | Role |
|---|---|
| Elastic Beanstalk | Runs the Dockerized FastAPI + React app |
| RDS PostgreSQL | Stores users, sessions, generated study assets, and history |
| ECR | Stores Docker images for deployment |
| CloudFront | CDN and HTTPS frontend routing |
| Route 53 | DNS routing |
| ACM | TLS certificate |
| GitHub Actions | CI/CD pipeline from GitHub to AWS |

## 📚 Upload Notes

- PDF support works best for PDFs with selectable text.
- Scanned PDFs need OCR before upload.
- Legacy `.doc` support is best-effort. For reliable parsing, save old Word files as `.docx`.
- Legacy `.ppt` support is best-effort. For reliable parsing, save old PowerPoint files as `.pptx`.

## 🗺️ Roadmap

- [ ] Stripe subscription flow
- [ ] PDF export for exam review packs
- [ ] Better onboarding for first-time users
- [ ] Admin analytics dashboard
- [ ] More robust OCR support for scanned PDFs
- [ ] Public landing page with product demo video

## 👤 Builder

Built by **Yanbai Li** as a real AI SaaS MVP focused on helping students save time and study more effectively before exams.

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:8fb9aa,100:256f61&height=110&section=footer" alt="Footer wave" />
</p>
