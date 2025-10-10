# Vercel Setup Checklist (Marketing vs App)

## Project: maxvideoai-marketing (public BUSL repo)

- [ ] Repository: `github.com/maxvideoai/maxvideoai-public`
- [ ] Framework: Next.js static/eSSG
- [ ] Environment variables: analytics only (e.g. `NEXT_PUBLIC_ANALYTICS_ID`)
- [ ] Build command: `npm install && npm run build --workspace frontend`
- [ ] Output directory: `.vercel/output` (default)
- [ ] Preview deploys: enabled for trusted branches only (disable for forks)
- [ ] Custom domains: `www.maxvideo.ai`
- [ ] Analytics / logging: ensure no pricing or user data exposed
- [ ] Footer/legal: link to BUSL licence + commercial contact

## Project: maxvideoai-app (private repo)

- [ ] Repository: `github.com/maxvideoai/maxvideoai-internal`
- [ ] Environment variables (Production and Preview):
  - `FAL_API_KEY`
  - `STRIPE_SECRET_KEY`
  - `SUPABASE_URL` / `SUPABASE_ANON_KEY`
  - `DATABASE_URL`
  - Any internal feature flags
- [ ] Build command aligned with private workspace (e.g. `npm install && npm run build`)
- [ ] Secrets scoped to Vercel project (no exposure in public repo)
- [ ] Git integration limited to core team; disable automatic PR builds for external collaborators
- [ ] Access control: require login for preview deployments (Vercel “Password Protection” or SSO)
- [ ] Logging/Analytics routed to private sinks (Datadog, Logflare, etc.)
- [ ] Post-deploy checks: run smoke tests against staging API before promoting to production

## Shared Steps

- [ ] Configure deployment hooks (marketing + app) for CI pipelines
- [ ] Rotate deploy hooks if public repo is forked
- [ ] Add “Busl-compliant” banner or legal note in both projects
- [ ] Document rollback procedure for each project
