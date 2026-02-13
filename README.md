# MaxVideoAI — Generate Page Mock & Frontend

## 🌐 Live App
👉 https://maxvideoai.com

MaxVideoAI is a fully deployed multi-engine AI video generator running on Next.js + Vercel + Fal.ai.  

This repo contains:

- Product & UX spec (`max_video_ai_generate_page_spec_v_1.md`).
- Mock API (`mock-server.js`) that serves deterministic responses for `/api/engines` and `/api/preflight` using `fixtures/`.
- Docker support so the mock can run in isolation.
- A Next.js frontend scaffold in `frontend/` that consumes the mock API and demonstrates the capability-driven UI skeleton.

## 1. Prerequisites

- Node.js 20+
- Docker (optional but recommended for the mock API)

## 2. Mock API

### Local (Node)

```bash
npm install
npm start
```

The server runs on `http://127.0.0.1:3333` by default.

### Docker

```bash
docker build -t maxvideoai-mock .
docker run --rm -p 3333:3333 -e CORS_ORIGIN="*" maxvideoai-mock
```

Or with Compose:

```bash
docker compose up --build
```

Health checks:

```bash
curl -s http://127.0.0.1:3333/api/engines | jq
curl -s http://127.0.0.1:3333/api/preflight \
  -H "Content-Type: application/json" \
  -d '{"engine":"veo3","mode":"t2v","durationSec":8,"resolution":"1080p","aspectRatio":"16:9","fps":24,"addons":{"upscale4k":false,"audio":true},"user":{"memberTier":"Plus"}}' | jq
```

## 3. Frontend (Next.js)

Inside `frontend/`:

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_BASE` in `.env.local` to match the mock base URL.

Key behaviours implemented:

- Engine selection updates capability-driven controls instantly.
- Composer sits below the preview, with dropzones that appear only for `i2v` modes supported by the engine.
- PRICE-BEFORE pill fed by `POST /preflight`, refreshes (<200 ms debounce) when core settings change.
- Overlays for Upscale 4K & Audio respect engine capabilities.
- Basic badges (PAY-AS-YOU-GO / PRICE-BEFORE) and membership hints inline with the spec.

## Licensing & Repository Layout

- **Licence**: Business Source License 1.1 (BUSL 1.1). See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).  
- **Change Date**: 10 October 2028 → Apache 2.0.  
- **Usage**: Non-commercial evaluation of the software. Commercial deployments require a licence.

This repository hosts the full MaxVideoAI application. Review [`docs/public-vs-private.md`](docs/public-vs-private.md) before publishing to ensure no secrets or contractual data ship with the codebase.

Before syncing the public mirror, run:

```bash
npm run lint:exposure
```

The script (`scripts/check-public-exposure.mjs`) fails if sensitive folders or `.env*` files are still present.

### Commercial Licence Track

MaxVideoAI offers a separate commercial licence for partners that need production rights, backend access, or support. The operating model and contract checklist are described in [`docs/licensing/dual-license.md`](docs/licensing/dual-license.md).  
Contact `licensing@maxvideo.ai` to initiate the commercial process.

## 4. Switching to Real Backend

- Keep the same interface: `/api/engines`, `/api/preflight`.
- Adjust `NEXT_PUBLIC_API_BASE` to the live endpoint.
- Preserve the mock by running it on a different port (e.g. 3334) and toggling via env.

## 5. Environment Variables & Health Checks

The application expects the following environment variables (scoped per Vercel environment unless noted):

| Variable | Scope | Purpose |
| --- | --- | --- |
| `FAL_KEY` / `FAL_API_KEY` | Server | Fal.ai API key injected into the edge proxy. Prefer `FAL_KEY` on Vercel. |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL used by the browser. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anon key (RLS must stay enabled). |
| `SUPABASE_SERVICE_ROLE_KEY` | Server (optional) | Service role key for backend operations. |
| `DATABASE_URL` | Server | Neon Postgres connection string for API routes. |
| `LEGAL_MIN_AGE` | Server | Minimum age (integer) required during signup consent. Defaults to 15 if unset. |
| `NEXT_PUBLIC_LEGAL_MIN_AGE` | Public | Mirrors `LEGAL_MIN_AGE` so the UI can display the current requirement. |
| `LEGAL_RECONSENT_MODE` | Server | `soft` (default) or `hard`, controls re-consent enforcement. |
| `LEGAL_RECONSENT_GRACE_DAYS` | Server | Grace period in days when `LEGAL_RECONSENT_MODE=soft`. |
| `CONSENT_MODE` | Server | Consent UI mode (`cmp`/`basic`) to toggle CMP experience. |
| `GOOGLE_CONSENT_MODE` | Server | `true`/`false`/`auto` toggle for emitting Google Consent Mode v2 signals. |
| `NEXT_PUBLIC_GOOGLE_CONSENT_MODE` | Public | Mirrors `GOOGLE_CONSENT_MODE` so the CMP can emit signals client-side. |
| `MARKETING_DOUBLE_OPT_IN` | Server | Enables double opt-in flow for marketing emails when set to `true`. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Public | Stripe publishable key. |
| `STRIPE_SECRET_KEY` | Server | Stripe secret key for server-side operations. |
| `STRIPE_WEBHOOK_SECRET` | Server (optional) | Stripe webhook signing secret. |
| `GA4_MEASUREMENT_ID` | Server (optional) | GA4 Measurement ID used for server-side Measurement Protocol events. |
| `GA4_API_SECRET` | Server (optional) | GA4 Measurement Protocol API secret for top-up completion tracking. |
| `SLACK_BOT_TOKEN` / `SLACK_SIGNING_SECRET` / `SLACK_WEBHOOK_URL` | Server (optional) | Slack integration secrets if hooks/bots are enabled. |

### Health Endpoints

Additional read-only endpoints help verify deployment wiring (Preview/Production):

- `GET /api/health/env` — Edge runtime. Returns a JSON map of required env vars → boolean.
- `GET /api/health/fal` — Edge runtime. Performs an `OPTIONS` call through the Fal proxy.
- `GET /api/health/db` — Node runtime. Executes `SELECT 1` against the Neon database.
- `GET /api/health/legal` — Node runtime. Verifies Neon connectivity and confirms legal document versions are seeded.
- `GET /api/health/stripe` — Node runtime. Calls `stripe.prices.list(limit: 1)` to ensure the secret key is valid.

All endpoints respond with `{ ok: true }` on success (or include an `error` string on failure). Share Preview/Production URLs during verification.

### Neon Migrations

Neon (the primary application database) is managed via simple SQL migrations stored in [`neon/migrations`](neon/migrations).  
Run them in order against the pooled connection string (`DATABASE_URL`, includes `-pooler` and `sslmode=require`), for example:

```bash
for file in neon/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$file"
done
```

The scripts are idempotent and will seed the current legal document versions required by the consent system.

### Fal Fixtures Utility

Run `npx tsx scripts/dump-fal-models.ts` (server running) to regenerate:

- `frontend/fixtures/fal-models.json`
- `fixtures/fal-models.json`

The script calls the Fal proxy, so no direct DNS access to `api.fal.ai` is required.

## 6. Scheduled Jobs

- Cron definitions live in `vercel.json`. Vercel reads this file on deploy, so any change requires a redeploy to propagate. 【vercel.json†L14-L19】
- `/api/cron/fal-poll` is the scheduled entry-point. It proxies the call to `/api/fal/poll`, injects `X-Fal-Poll-Token` from `FAL_POLL_TOKEN`, et accepte uniquement les requêtes provenant du runtime Cron Vercel (en vérifiant `x-vercel-cron` ou le user-agent Vercel, plus l’ID de déploiement quand disponible).
- `/api/cron/indexnow` soumet automatiquement les URLs marketing clés et les sitemaps à IndexNow toutes les 6 heures. La route accepte aussi un déclenchement manuel protégé via `Authorization: Bearer $INDEXNOW_CRON_TOKEN` (ou `X-IndexNow-Cron-Token`) quand `INDEXNOW_CRON_TOKEN` est défini.
- Pour vérifier manuellement :
  ```bash
  curl -H "X-Fal-Poll-Token: $FAL_POLL_TOKEN" https://<ton-domaine>/api/fal/poll
  ```
  Sans l’en-tête ou avec une valeur invalide, la route renvoie `401`. Avec le jeton correct, la réponse contient `{ ok: true, ... }`.

## 7. Known Limitations

- The mock API runs in-memory; persistence/job streaming left to the real backend.
- No automated tests yet (awaiting backend contract confirmation).
- Preview/gallery content is placeholder; real media wiring is pending asset APIs.

## 8. Analytics & Session Replay

- Microsoft Clarity loads through `frontend/components/analytics/Clarity.tsx`, which is mounted from the root layout once analytics consent (`mv-consent` cookie) is granted. The loader enforces production-only execution, honours `NEXT_PUBLIC_CLARITY_ALLOWED_HOSTS`, and registers SPA route changes via `clarity('set','page', ...)`.
- Consent is persisted by the client CMP banner (`frontend/components/legal/CookieBanner.tsx`) and broadcast with a `consent:updated` custom event so analytics scripts remain gated behind `ConsentScriptGate`.
- Wallet top-ups emit funnel events from `frontend/app/(core)/billing/page.tsx` (`topup_started`, `topup_checkout_opened`, `topup_failed`, `topup_cancelled`) and server events from `frontend/app/api/stripe/webhook/route.ts` (`topup_completed`, `purchase`, `topup_refunded`) via GA4 Measurement Protocol when analytics consent is granted and `GA4_MEASUREMENT_ID` + `GA4_API_SECRET` are configured.
- For GA4 production setup (conversions, custom dimensions, unwanted Stripe referrals), follow [`docs/analytics/ga4-topups.md`](docs/analytics/ga4-topups.md).
- A first-party visitor cookie (`mv-clarity-id`) keeps sessions stitched across SPA navigation. Authenticated sessions tag additional context from `frontend/src/hooks/useRequireAuth.ts` (Supabase UUID, plan/role/currency flags) while internal staff accounts (`@maxvideoai.com` / `@maxvideoai.ai`) are labelled for exclusion.
- Enable/disable Clarity via `NEXT_PUBLIC_ENABLE_CLARITY`, `NEXT_PUBLIC_CLARITY_ID`, and `NEXT_PUBLIC_CLARITY_ALLOWED_HOSTS`. Optional dev logging is available with `NEXT_PUBLIC_CLARITY_DEBUG=true` (shows `_clck`/`_clsk` in the console).

## Deployment Overview

- **Application** → this repository → Vercel project `maxvideoai-app` (or alternative infrastructure).  
- Deployment guidelines and checklists live in [`docs/deployment/github-vercel.md`](docs/deployment/github-vercel.md).
