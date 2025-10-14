# GitHub & Vercel Deployment Strategy

## Repository Layout

| Repo | Visibility | Contents | CI / Deployment |
|------|------------|----------|-----------------|
| `maxvideoai` | Public (BUSL) | Full application (marketing + workspace + APIs) | GitHub Actions → Vercel `maxvideoai-app` |

## GitHub Configuration

1. **Branch protection**: require review from a maintainer aware of the exposure checklist before merging to `main`.  
2. **Secrets**: store Fal.ai keys, pricing multipliers, Stripe secrets in GitHub Encrypted Secrets; never commit them to the repo.  
3. **Workflows**:
   - `ci.yml`: lint, type-check, and run targeted tests.
   - `deploy.yml` (optional): trigger Vercel deploy via deploy hook after successful checks.
4. **Security scanning**: enable Dependabot, secret scanning, and any SAST tools appropriate for Next.js/Node.js projects.

## Vercel Projects

| Project | Source | Purpose | Notes |
|---------|--------|---------|-------|
| `maxvideoai-app` | GitHub `maxvideoai` | Landing pages, authenticated workspace, job processing APIs | Store secrets (Fal.ai, Stripe, Supabase) in Vercel environment settings; restrict deploy hooks |

### Deployment Flow

1. Push PR → preview deploy triggered for the branch.  
2. On merge to `main`, production deploy runs.  
3. Ensure server-side routes keep credentials on the server; client bundles should only receive signed URLs and public assets.

## Checklists Before Publishing

- [ ] Review `docs/public-vs-private.md` to confirm no secrets or contractual data ship with the release.  
- [ ] Confirm Vercel project settings: preview deploy tokens scoped appropriately; disable automatic PR builds for forks.  
- [ ] Ensure `NOTICE` and licence link visible in footer or `/legal/licensing`.  
- [ ] Review analytics/logging integrations to avoid leaking user or pricing data.

## Incident Response

1. If a violating fork appears on GitHub, use the BUSL terms + GitHub DMCA to request removal.  
2. For Vercel misuse (e.g. someone deploys commercial fork), submit abuse report citing BUSL restrictions.  
3. Rotate any keys exposed accidentally and invalidate old deploy hooks.
