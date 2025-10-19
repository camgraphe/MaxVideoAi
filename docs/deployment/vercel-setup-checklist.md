# Vercel Setup Checklist

## Project: maxvideoai-app

- [ ] Repository: `github.com/maxvideoai/maxvideoai`
- [ ] Framework: Next.js (mixed static/SSR)
- [ ] Build command: `npm install && npm run vercel-build`
- [ ] Environment variables:
  - **Shared**
    - `FAL_KEY` / `FAL_API_KEY`
    - `SUPABASE_URL` / `SUPABASE_ANON_KEY`
    - `DATABASE_URL`
    - `RESULT_PROVIDER`
    - `NEXT_PUBLIC_API_BASE`
    - Analytics / feature flag keys
  - **Production**
    - `STRIPE_SECRET_KEY`
    - `POSTMARK_SERVER_TOKEN`
    - `RESEND_API_KEY`
    - `EMAIL_FROM`
    - `EMAIL_FROM_NAME`
    - `SUPABASE_SITE_URL` = `https://maxvideoai.com`
    - `NEXT_PUBLIC_SITE_URL` = `https://maxvideoai.com`
  - **Preview / Development**
    - `STRIPE_SECRET_KEY` (test mode)
    - `RESEND_API_KEY` (Resend test key or sandbox)
    - `MAILTRAP_HOST`
    - `MAILTRAP_PORT`
    - `MAILTRAP_USER`
    - `MAILTRAP_PASS`
    - `EMAIL_FROM` = `no-reply@staging.maxvideoai.com` (or Mailtrap alias)
    - `EMAIL_FROM_NAME`
    - `SUPABASE_SITE_URL` = preview domain
    - `NEXT_PUBLIC_SITE_URL` = preview domain
- [ ] Ensure secrets are scoped to the project (never committed)
- [ ] Preview deployments: restrict to trusted branches and enable password protection when sharing externally
- [ ] Custom domains: `app.maxvideo.ai` (adjust for your environment)
- [ ] Logging/Analytics routed to private sinks (Datadog, Logflare, etc.)
- [ ] Post-deploy checks: run smoke tests against staging API before promoting to production

## Operational Steps

- [ ] Configure deployment hooks for CI pipelines
- [ ] Rotate deploy hooks and API tokens on a regular schedule
- [ ] Document rollback procedure and store it alongside incident playbooks
- [ ] Review build logs after each deployment for warnings about secrets or failed API calls
