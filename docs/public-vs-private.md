# MaxVideoAI Code Exposure Checklist

The goal is to keep the public repository limited to marketing/UI assets while all monetization, pricing, and provider-facing integrations live in private infrastructure.

## Directories Safe to Keep Public (BUSL 1.1)

| Path | Notes |
|------|-------|
| `content/` | Static markdown used for marketing pages and docs. |
| `frontend/app/(marketing)` | Public landing pages, changelog, docs, status, etc. |
| `frontend/components/` (UI-only) | Presentational components with no pricing or provider logic. |
| `frontend/public/` | Images, icons, and static assets. |
| `frontend/types/` | Shared TypeScript interfaces safe to disclose (scrub any pricing constants). |
| `frontend/config/*.json` | Model roster metadata intended for marketing; ensure pricing fields are redacted. |
| `docs/` | High-level documentation, licencing notes, public rollout guides. |

Keep these files under BUSL in the public repo to showcase the UI and satisfy transparency goals.

## Must Live in a Private Repo

| Path | Reason |
|------|--------|
| `frontend/app/api/**` | Server routes exposing business logic and provider credentials. |
| `frontend/app/(workspace)/**` | Authenticated product experience, queue management, wallet UI. |
| `frontend/src/lib/pricing.ts` and related utilities | Encodes pricing coefficients and vendor splits. |
| `frontend/src/lib/fal.ts`, `frontend/src/lib/fal-catalog.ts` | Direct Fal.ai integration and routing logic. |
| `frontend/src/lib/env.ts` | References to secrets and environment shape. |
| `packages/` (if any proprietary SDKs) | Typically shared bundles with sensitive logic. |
| `db/`, `scripts/`, `backend services` | Database schema, migration scripts, job processing. |

Remove these folders from the public repo or replace them with mocked stubs before mirroring.

## Migration Steps

1. **Create a private monorepo** (e.g. `maxvideoai-internal`) and move all backend/pricing/API code there. The `private/` directory in this repo is ignored and serves only as a staging area before pushing to the internal repo.  
2. **Replace imports** in the public Next.js app with thin API clients that call the private backend.  
3. **Scrub configs**: eliminate hard-coded pricing numbers, API keys, or Fal.ai identifiers from public JSON/TS.  
4. **Automate linting**: add a lint rule or CI script that fails if `frontend/app/api` or `frontend/src/lib/pricing` reappear in the public tree.  
5. **Document contribution rules**: add to CONTRIBUTING.md that sensitive logic must target the private repo.

## Ongoing Guardrails

- Run scheduled scans (`rg`, custom scripts) to ensure no `.env`, keys, or pricing constants are committed publicly.  
- Enable GitHub branch protection requiring approval from a maintainer aware of this checklist.  
- During release, validate the bundle output (e.g. `next build --analyze`) to ensure no hidden pricing constants are tree-shaken into the client bundle.
