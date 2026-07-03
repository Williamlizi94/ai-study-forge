# AI Study Assistant

A local-first MVP for turning study material into exam notes, cheat sheets, flashcards, quizzes, and note-grounded tutoring.

## Features

- Paste study material and save it as a study session
- Upload `.txt`, text-based `.pdf`, `.docx`, `.pptx`, and best-effort `.doc` / `.ppt` files
- Generate AI notes
- Generate an exam-ready cheat sheet
- Generate flashcards
- Generate interactive practice quiz questions
- Save missed quiz questions into the mistake notebook automatically
- Review quiz answers with explanations for missed concepts
- Ask questions grounded in the saved notes
- Persist sessions in local SQLite

## Stack

- Frontend: React + Vite
- Backend: Python FastAPI
- Database: SQLite for local development, PostgreSQL-ready via `DATABASE_URL`
- AI: OpenAI API from the backend only

## Local Setup

1. Create and activate a virtual environment.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Install dependencies.

```powershell
pip install -r requirements.txt
```

3. Create a `.env` file from `.env.example` and set `OPENAI_API_KEY`.

```powershell
Copy-Item .env.example .env
```

For developer testing without OpenAI cost, enable mock AI responses:

```text
MOCK_AI=true
```

With `MOCK_AI=true`, every AI endpoint returns deterministic local test content,
does not call OpenAI, and does not count against daily AI limits. Set it back to
`false` and restart the API when you want real AI output.

For a private beta or public deployment, also set:

```text
ACCESS_PASSWORD=your_beta_password
AUTH_TOKEN_SECRET=a_long_random_secret
PER_USER_DAILY_AI_LIMIT=20
GLOBAL_DAILY_AI_LIMIT=100
```

If `ACCESS_PASSWORD` is empty, the app runs unlocked for local development.

For real user accounts, enable account mode:

```text
REQUIRE_USER_ACCOUNTS=true
AUTH_TOKEN_SECRET=a_long_random_secret
```

In account mode, users register and log in with email/password. Passwords are
stored as salted PBKDF2-SHA256 hashes, and sessions are scoped to the user id.

For production PostgreSQL, set `DATABASE_URL` and leave `DATABASE_PATH` as the local fallback:

```text
DATABASE_URL=postgresql://user:password@host:5432/database
```

The backend keeps local SQLite as the default. When `DATABASE_URL` starts with
`postgres://` or `postgresql://`, it uses PostgreSQL.

For an AWS or other production deployment, set:

```text
APP_ENV=production
REQUIRE_USER_ACCOUNTS=true
AUTH_TOKEN_SECRET=a_random_secret_with_at_least_32_characters
DATABASE_URL=postgresql://user:password@host:5432/database
MOCK_AI=false
OPENAI_API_KEY=your_openai_api_key
```

With `APP_ENV=production`, the app refuses to start if the critical production
settings are unsafe.

4. Start the app.

```powershell
.\scripts\run_dev.ps1
```

This installs backend dependencies, builds the React frontend, and starts FastAPI.

For frontend-only development, run FastAPI in one terminal and Vite in another:

```powershell
.\scripts\run_frontend.ps1
```

5. Open:

```text
http://127.0.0.1:8000
```

## API Overview

- `GET /api/health`
- `GET /api/auth/status`
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/study/sessions`
- `POST /api/study/sessions`
- `POST /api/study/sessions/upload`
- `GET /api/study/sessions/{session_id}`
- `POST /api/study/sessions/{session_id}/summary`
- `POST /api/study/sessions/{session_id}/cheat-sheet`
- `POST /api/study/sessions/{session_id}/flashcards`
- `POST /api/study/sessions/{session_id}/quiz`
- `POST /api/study/sessions/{session_id}/quiz/mistakes`
- `POST /api/study/sessions/{session_id}/quiz/review`
- `POST /api/study/sessions/{session_id}/chat`

When `ACCESS_PASSWORD` is configured, every `/api/study/*` request requires
`Authorization: Bearer <token>` from `/api/auth/login`.

## Smoke Tests

Run a no-cost health check against local development, Docker, or a deployed URL:

```powershell
.\scripts\smoke_test.ps1
```

Run a deeper no-cost API check that creates, fetches, lists, and deletes a test
study session without calling OpenAI:

```powershell
.\scripts\smoke_test.ps1 -RunStudyApi
```

For a deployed app:

```powershell
.\scripts\smoke_test.ps1 -BaseUrl "https://yourdomain.com"
```

If account or beta auth is enabled, log in first and pass the returned token:

```powershell
.\scripts\smoke_test.ps1 -BaseUrl "https://yourdomain.com" -AuthToken "token" -RunStudyApi
```

## Beta Safety Controls

- Access password gate for private beta testing
- Optional email/password account mode for SaaS beta testing
- Browser-scoped access tokens signed by the backend
- Session ownership is stored server-side for multi-user account migration
- Per-visitor daily AI generation limit
- Site-wide daily AI generation limit
- OpenAI API key stays server-side only

## Docker Production Build

The repo includes a multi-stage `Dockerfile`:

- Stage 1 builds the React frontend with Vite.
- Stage 2 installs Python dependencies and serves FastAPI plus the built frontend.
- Runtime command binds to `0.0.0.0:${PORT:-8000}` for cloud containers.
- Health check uses `GET /api/health`.

Build locally:

```powershell
docker build -t ai-study-assistant .
```

Create a local production env file from `.env.production.example`, then run:

```powershell
docker run --env-file .env.production.local -p 8000:8000 ai-study-assistant
```

Open:

```text
http://127.0.0.1:8000/api/health
```

## AWS Deployment Checklist

Use one container service plus a managed PostgreSQL database. For a first paid
beta, keep the setup simple: one app container, one PostgreSQL database, one
domain, HTTPS, and conservative AI usage limits.

1. Create a PostgreSQL database and copy its connection string into `DATABASE_URL`.
2. Set production environment variables from `.env.production.example`.
3. Build the Docker image and test it locally.
4. Push the image to AWS ECR or upload it through your chosen AWS container service.
5. Deploy with port `8000` exposed and health check path `/api/health`.
6. Add a domain and HTTPS before inviting real users.
7. Keep `PER_USER_DAILY_AI_LIMIT` and `GLOBAL_DAILY_AI_LIMIT` low during beta.
8. Monitor OpenAI billing, AWS compute cost, and database storage.

## Upload Notes

- PDF support is for PDFs with selectable text.
- Scanned PDFs need OCR before upload.
- Legacy `.doc` support is best-effort text extraction. For reliable results, save old Word documents as `.docx`.
- Legacy `.ppt` support is best-effort text extraction. For reliable results, save old PowerPoint files as `.pptx`.
