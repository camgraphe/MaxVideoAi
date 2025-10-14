# MaxVideoAI Code Exposure Checklist

This checklist helps keep the open-source distribution free of sensitive data while shipping the full product from a single repository.

## Areas Requiring Extra Review

| Path | What to double-check |
|------|----------------------|
| `frontend/app/api/**` | Make sure responses don’t include secrets, private keys, or partner-only metadata. |
| `frontend/app/(workspace)/**` | Confirm mocks or guards are in place before exposing internal workflows in demos. |
| `frontend/src/lib/env.ts` | Do not hard-code credentials or pricing constants; rely on environment variables. |
| `frontend/src/lib/fal*.ts` | Verify Fal keys and routing hints remain server-side only. |
| `scripts/` | Remove one-off scripts that reference production infrastructure before sharing. |
| `docs/` | Review for contractual terms, partner names, or unpublished pricing. |

## Release Checklist

1. Run `npm run lint:exposure` to catch obvious leaks (.env files, forbidden paths, etc.).  
2. Grep for sensitive keywords (API keys, partner names, pricing figures) before tagging a release.  
3. Strip example configs of real credentials—use placeholders in `.env.*` files.  
4. Review generated bundles (`next build`) to ensure server-only secrets are not inlined into client assets.  
5. Confirm GitHub/Vercel secrets are rotated and not duplicated in the repo.

## Ongoing Guardrails

- Schedule periodic scans (custom scripts, `rg`, TruffleHog) to watch for accidental secrets.  
- Enforce branch protection so at least one maintainer signs off on exposure-sensitive changes.  
- Document any new sensitive surface area in this checklist to keep future reviews aligned.
