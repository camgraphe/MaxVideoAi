# Vercel Setup Checklist

## Project: maxvideoai-app

- [ ] Repository: `github.com/maxvideoai/maxvideoai`
- [ ] Framework: Next.js (mixed static/SSR)
- [ ] Build command: `npm install && npm run vercel-build`
- [ ] Environment variables (Production and Preview):
  - `FAL_KEY` / `FAL_API_KEY`
  - `STRIPE_SECRET_KEY`
  - `SUPABASE_URL` / `SUPABASE_ANON_KEY`
  - `DATABASE_URL`
  - `RESULT_PROVIDER`
  - Any feature flags or analytics keys
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
