# AWS Deployment Notes

This project is ready for a container-based AWS beta deployment after you provide
real production environment variables and a managed PostgreSQL database.

## Recommended First Architecture

- One FastAPI container serving both the API and the built React frontend
- One managed PostgreSQL database
- One HTTPS domain
- OpenAI key stored as an environment secret, never in the frontend
- Account mode enabled with email/password registration

## Required Environment Variables

Start from `.env.production.example`.

```text
APP_ENV=production
MOCK_AI=false
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4-mini
DATABASE_URL=postgresql://user:password@host:5432/study_assistant
REQUIRE_USER_ACCOUNTS=true
AUTH_TOKEN_SECRET=at_least_32_random_characters
AUTH_TOKEN_TTL_DAYS=14
MAX_SOURCE_CHARS=100000
MAX_UPLOAD_MB=10
PER_USER_DAILY_AI_LIMIT=20
GLOBAL_DAILY_AI_LIMIT=100
```

If the frontend and API are served from the same domain, `CORS_ORIGINS` can stay
empty. If the frontend is served from a separate domain later, set
`CORS_ORIGINS=https://yourdomain.com`.

## Optional Google Login

Google login is supported, but it is disabled until these environment variables
are configured:

```text
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google/callback
```

Create an OAuth Client in Google Cloud Console and add the same callback URL as
an authorized redirect URI. For local testing, use:

```text
http://127.0.0.1:8000/api/auth/google/callback
```

Do not commit Google OAuth secrets to GitHub. Put production values in Elastic
Beanstalk environment properties.

## Local Container Test

```powershell
docker build -t ai-study-assistant .
docker run --env-file .env.production.local -p 8000:8000 ai-study-assistant
```

Then check:

```text
http://127.0.0.1:8000/api/health
```

## AWS Steps

1. Create a managed PostgreSQL database.
2. Put the database URL and secrets into the AWS service environment settings.
3. Build and push the Docker image.
4. Deploy the image with container port `8000`.
5. Configure health check path `/api/health`.
6. Add HTTPS and a custom domain.
7. Test signup, upload, AI notes, cheat sheet, quiz, mistakes, flashcards, and Ask AI Tutor.

## Elastic Beanstalk Bundle

The Elastic Beanstalk deployment bundle is built from:

```text
deploy/elasticbeanstalk/Dockerrun.aws.json
```

Create the bundle:

```powershell
.\scripts\eb_package.ps1
```

The generated zip is written to:

```text
deploy-artifacts/ai-study-assistant-eb.zip
```

This bundle references the ECR image and does not contain API keys, database
passwords, or other runtime secrets. Configure those as Elastic Beanstalk
environment variables.

## Push Image to ECR

After AWS CLI is configured and the local Docker image is built, push it to ECR:

```powershell
.\scripts\aws_push_image.ps1 `
  -AwsAccountId "123456789012" `
  -Region "us-west-2" `
  -RepositoryName "ai-study-assistant"
```

The script creates the ECR repository if it does not exist, logs Docker in to
ECR, tags `ai-study-assistant:local`, and pushes it as `latest`.

## GitHub Actions Deployment

The repository includes a GitHub Actions workflow at:

```text
.github/workflows/deploy-aws.yml
```

It deploys automatically when code is pushed to the `main` branch. It can also be
run manually from the GitHub Actions tab.

Before using it, add these GitHub repository secrets:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

These are only for deploying to AWS. Do not put `OPENAI_API_KEY`,
`DATABASE_URL`, database passwords, or `AUTH_TOKEN_SECRET` into the repository.
Those runtime secrets should stay in Elastic Beanstalk environment properties.

The workflow performs these steps:

1. Build the Docker image from the latest GitHub commit.
2. Push the image to Amazon ECR.
3. Create an Elastic Beanstalk deployment bundle.
4. Create a new Elastic Beanstalk application version.
5. Update the `ai-study-assistant-env` environment.
6. Run a smoke test against `/api/health`.

Current workflow defaults:

```text
AWS_REGION=us-east-1
ECR_REPOSITORY=ai-study-assistant
EB_APPLICATION_NAME=ai-study-assistant
EB_ENVIRONMENT_NAME=ai-study-assistant-env
```

If the AWS app, environment, repository, or region changes later, update those
values in `.github/workflows/deploy-aws.yml`.

## Production Safety Checks

When `APP_ENV=production`, the backend refuses to start if:

- `MOCK_AI=true`
- `OPENAI_API_KEY` is missing
- `DATABASE_URL` is not PostgreSQL
- no login protection is enabled
- `AUTH_TOKEN_SECRET` is missing, weak, or still a placeholder

These checks are intentional. They prevent accidentally publishing a public app
with local-dev settings.
