# Launch Checklist

Use this checklist before sharing AI Study Forge with real users. The goal is
to avoid three common launch failures: leaked secrets, broken account flows, and
uncontrolled AI/cloud cost.

## 1. Security Cleanup

- Rotate the OpenAI API key before public launch.
- Rotate AWS access keys used for GitHub Actions if they were ever copied into a
  local document, screenshot, chat, or temporary file.
- Delete old AWS access keys after confirming the new deployment path works.
- Confirm `.env`, `.env.*`, key files, logs, `data/`, `.venv/`, and build output
  are not tracked by Git.
- Run the local readiness check:

```powershell
.\scripts\production_readiness.ps1
```

- Check the deployed health endpoint:

```powershell
.\scripts\production_readiness.ps1 -SkipBuild -BaseUrl "https://aistudyforge.com"
```

## 2. Production Environment

Elastic Beanstalk must have these runtime settings configured as environment
properties. Do not put these values into GitHub source files.

```text
APP_ENV=production
MOCK_AI=false
REQUIRE_USER_ACCOUNTS=true
OPENAI_API_KEY=<production OpenAI project key>
OPENAI_MODEL=gpt-5.4-mini
DATABASE_URL=<RDS PostgreSQL connection string>
AUTH_TOKEN_SECRET=<random 32+ character secret>
AUTH_TOKEN_TTL_DAYS=14
PER_USER_DAILY_AI_LIMIT=20
GLOBAL_DAILY_AI_LIMIT=100
MAX_SOURCE_CHARS=100000
MAX_UPLOAD_MB=10
```

For Google login, add these after Google OAuth is configured:

```text
GOOGLE_CLIENT_ID=<Google OAuth client id>
GOOGLE_CLIENT_SECRET=<Google OAuth client secret>
GOOGLE_REDIRECT_URI=https://aistudyforge.com/api/auth/google/callback
```

## 3. Domain and HTTPS

- Buy or connect a domain.
- Point the domain to the Elastic Beanstalk environment.
- Add an AWS Certificate Manager certificate.
- Route production traffic through HTTPS.
- Update Google OAuth redirect URLs to use the final HTTPS domain.
- Test the app only from the final domain before inviting beta users.

## 4. User Account Flows

Before launch, test these flows on production:

- Sign up with email and password.
- Log in with email and password.
- Sign out.
- Reopen the browser and confirm saved sessions persist.
- Google sign-in, after OAuth is configured.
- Account menu: Account settings, Upgrade plan, Help & feedback, Sign out.

## 5. Product Smoke Test

Run through a real student workflow:

- Upload a PDF, DOCX, or PPTX.
- Paste text manually.
- Generate AI Notes.
- Generate Cheat Sheet.
- Generate Practice Quiz.
- Answer at least one quiz question incorrectly and confirm it appears in
  Mistakes.
- Generate Flashcards.
- Ask AI Tutor a question grounded in the material.

## 6. Cost Controls

- Keep low beta limits at first:
  - `PER_USER_DAILY_AI_LIMIT=20`
  - `GLOBAL_DAILY_AI_LIMIT=100`
- Set AWS Budgets alerts.
- Set OpenAI billing alerts or project budget limits.
- Review RDS, Elastic Beanstalk, ECR, and CloudWatch costs after each test day.
- Do not run paid ads until usage limits and billing are tested.

## 7. Billing and Legal Pages

Before charging users:

- Connect Stripe Checkout.
- Add a Stripe webhook to update user plans.
- Add Pricing, Privacy Policy, Terms of Service, Contact, and Refund policy
  pages.
- Add a visible AI accuracy disclaimer for generated study content.

## 8. Beta Launch Criteria

Launch to a small beta only when all of these are true:

- The deployed app is reachable at the HTTPS domain.
- Email/password login works.
- Google login works or is intentionally hidden.
- AI generation works with real OpenAI responses.
- Sessions persist after logout/login.
- Mistakes are saved from incorrect quiz answers.
- Feedback submissions are saved.
- Cloud and OpenAI budgets are configured.
- No secrets are tracked in Git.
