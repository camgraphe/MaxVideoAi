# GitHub & Vercel Deployment Strategy

## Repository Layout

| Repo | Visibility | Contents | CI / Deployment |
|------|------------|----------|-----------------|
| `maxvideoai-public` | Public (BUSL) | Marketing site, UI shell, mock data | GitHub Actions → Vercel (marketing project) |
| `maxvideoai-internal` | Private | Backend services, pricing engine, Fal.ai adapters, production config | GitHub Actions → private build targets (Vercel serverless / containers / workers) |

## GitHub Configuration

1. **Branch protection**: require review from a maintainer aware of the exposure checklist before merging to `main`.  
2. **Secrets separation**: only the private repo stores Fal.ai keys, pricing multipliers, Stripe secrets. Use GitHub Encrypted Secrets scoped to specific workflows.  
3. **Workflows**:
   - `public-ci.yml`: lint + build static marketing bundle; no deployment of backend.
   - `internal-ci.yml`: tests, backend builds, container publish.
4. **Mirroring**: if using a monorepo, set up a sync script (e.g. `git sparse checkout`) that pushes only whitelisted directories to the public repo.
5. **Security scanning**: Dependabot & secret scanning enabled on the private repo; public repo limited to dependency updates that do not reveal stack details.

## Vercel Projects

| Project | Source | Purpose | Notes |
|---------|--------|---------|-------|
| `maxvideoai-marketing` | GitHub `maxvideoai-public` | Landing pages, docs, pricing teaser | Environment variables limited to public analytics (e.g. Plausible) |
| `maxvideoai-app` | GitHub `maxvideoai-internal` (or direct import) | Authenticated app, renders, dashboards | Store secrets (Fal.ai, Stripe, Supabase) in Vercel environment settings; restrict deploy hooks |

### Deployment Flow

1. Push PR → preview deploy triggered on respective repo (marketing or internal).
2. On merge to `main`, production deploy runs.  
3. Marketing project uses static generation / edge functions only.  
4. App project calls private APIs; no pricing logic or vendor credentials bundled client-side.

## Checklists Before Publishing

- [ ] Verify `frontend/app/api/**` and backend libs are absent from the public repo (see `docs/public-vs-private.md`).  
- [ ] Confirm Vercel project settings: preview deploy tokens scoped appropriately; disable automatic PR builds for forks.  
- [ ] Ensure `NOTICE` and licence link visible in footer or `/legal/licensing`.  
- [ ] Review analytics/logging integrations to avoid leaking user or pricing data.

## Incident Response

1. If a violating fork appears on GitHub, use the BUSL terms + GitHub DMCA to request removal.  
2. For Vercel misuse (e.g. someone deploys commercial fork), submit abuse report citing BUSL restrictions.  
3. Rotate any keys exposed accidentally and invalidate old deploy hooks.
