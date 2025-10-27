# MaxVideoAI Technical Audit

_Date: 2024-05-26_

## 1. Environment variables

### Current definitions
- `.env.local.example` documents the core client/server keys (Supabase, Stripe, FAL, Slack, database, etc.). 【F:frontend/.env.local.example†L1-L37】
- Runtime access is centralized in `frontend/src/lib/env.ts`, which exposes a typed accessor with required/optional helpers and memoizes common keys. 【F:frontend/src/lib/env.ts†L1-L36】
- Fal polling now requires a dedicated bearer: set `FAL_POLL_TOKEN` across environments so the scheduled job can authenticate. Cron hits `/api/cron/fal-poll`, which proxies to `/api/fal/poll`, injects the header server-side, and validates the Vercel deployment headers before forwarding. 【F:frontend/.env.local.example†L38-L44】【F:vercel.json†L14-L19】【F:frontend/app/api/cron/fal-poll/route.ts†L1-L50】

### Gaps & risks
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is required by the `/api/health/env` endpoint but is missing from `.env.local.example`, risking false alarms in health checks or misconfiguration in Vercel. 【F:frontend/app/api/health/env/route.ts†L4-L19】【F:frontend/.env.local.example†L1-L37】
- Client-side result-provider overrides (`NEXT_PUBLIC_RESULT_PROVIDER`, `NEXT_PUBLIC_DEFAULT_RESULT_PROVIDER`) are consumed in `frontend/lib/result-provider-mode.ts` but are absent from the sample env file. 【F:frontend/lib/result-provider-mode.ts†L1-L24】
- `FAL` proxy route is evaluated at module load and throws if neither `FAL_KEY` nor `FAL_API_KEY` is defined, which will crash the build/edge runtime instead of returning a healthful error. Consider guarding the export instead of throwing. 【F:frontend/app/api/fal/proxy/route.ts†L1-L12】
- Stripe price IDs (`STRIPE_PRICE_PLUS`, `STRIPE_PRICE_PRO`) and `SUPABASE_SERVICE_ROLE_KEY` are exposed in env helpers but not validated anywhere; adding checks (health endpoints or startup assertions) would catch drift. 【F:frontend/src/lib/env.ts†L18-L35】

### Recommendations
1. Update `.env.local.example` (and deployment docs) to include the missing Stripe publishable key and optional result-provider overrides.
2. Replace the top-level throw in `/api/fal/proxy` with a runtime guard that responds `501` when keys are absent.
3. Extend `/api/health/env` (or the new health script) to assert presence of `STRIPE_PRICE_*` IDs and Supabase service key if those features are required.
4. Mirror these requirements in Vercel environment settings and CI secrets; add documentation to `docs/deployment`.

## 2. Database connectivity (Neon / Supabase)
- `frontend/src/lib/db.ts` encapsulates the Postgres pool and exposes `isDatabaseConfigured()` so API routes can degrade gracefully when `DATABASE_URL` is unset. 【F:frontend/src/lib/db.ts†L1-L28】
- Critical routes (`/api/generate`, `/api/audio`, `/api/upscale`, `/api/wallet`, `/api/jobs/[jobId]`) check `isDatabaseConfigured()` or `process.env.DATABASE_URL` and fall back to mock storage/logging on failure. 【F:frontend/app/api/generate/route.ts†L23-L208】【F:frontend/app/api/wallet/route.ts†L12-L111】【F:frontend/app/api/audio/route.ts†L6-L20】【F:frontend/app/api/upscale/route.ts†L6-L20】【F:frontend/app/api/jobs/[jobId]/route.ts†L97-L198】
- Schema migrations are applied lazily via `ensureBillingSchema()` with defensive `try/catch` logging; errors default to mock wallet/receipt paths. 【F:frontend/src/lib/schema.ts†L1-L86】【F:frontend/app/api/wallet/route.ts†L17-L48】
- Supabase authentication is strongly typed, and the helper enforces env presence before instantiating the client. Local fallbacks only activate in non-production environments. 【F:frontend/src/lib/supabase.ts†L1-L38】【F:frontend/src/lib/user.ts†L1-L11】

**Risks & follow-ups**
- `query()` lacks centralized error logging/metrics beyond caller-level try/catch; introducing instrumentation (e.g., Sentry) would help triage production DB issues.
- The wallet fallback persists mock balances in-memory. Add monitoring to detect when Neon connectivity fails and the system silently switches to the mock ledger.
- Consider validating `DATABASE_URL` format at startup (e.g., using `pg-connection-string`).

## 3. Stripe integration
- Secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) gate API functionality; missing keys return `501` rather than throwing. 【F:frontend/app/api/wallet/route.ts†L63-L112】【F:frontend/app/api/stripe/webhook/route.ts†L1-L44】
- `/api/wallet` uses scoped metadata, validates amounts, and wraps Stripe calls in `try/catch` with explicit logging. Mock fallbacks protect against external failures. 【F:frontend/app/api/wallet/route.ts†L83-L155】
- Webhook handler verifies signatures, normalizes inputs, deduplicates receipts, and replays into the mock wallet when persistence fails—covering Neon outages. 【F:frontend/app/api/stripe/webhook/route.ts†L1-L139】
- Legacy Next.js API route (`pages/api/stripe-webhook.ts`) still exists; ensure only one webhook endpoint is deployed to avoid duplicate writes. 【F:frontend/pages/api/stripe-webhook.ts†L1-L167】
- Health check route `/api/health/stripe` exercises `stripe.prices.list` to ensure API connectivity. 【F:frontend/app/api/health/stripe/route.ts†L1-L19】

**Risks & follow-ups**
- Confirm that Stripe dashboard is configured to send events to the new App Router webhook only; otherwise both handlers will run.
- Add monitoring/alerting for webhook handler failures (currently only logs to console).
- Document required Stripe price IDs and ensure they exist in each environment.

## 4. Critical API routes & resiliency
- `/api/generate` reserves wallet charges, charges Stripe, and records jobs with comprehensive error handling; failure paths refund mock balances and skip DB writes when unavailable. 【F:frontend/app/api/generate/route.ts†L23-L344】【F:frontend/app/api/generate/route.ts†L344-L523】
- `/api/audio` and `/api/upscale` short-circuit if the DB is offline to prevent user-facing errors. 【F:frontend/app/api/audio/route.ts†L6-L20】【F:frontend/app/api/upscale/route.ts†L6-L20】
- `/api/jobs/[jobId]` gracefully falls back to mock data or fixture manifests when Neon/FAL is down, ensuring UX continuity. 【F:frontend/app/api/jobs/[jobId]/route.ts†L38-L198】
- FAL provider integration defaults to local manifest assets when API keys are missing or responses fail, avoiding hard crashes. 【F:frontend/src/lib/fal.ts†L232-L303】

**Recommendations**
- Add rate limiting and authentication to critical POST endpoints (wallet, generate) to mitigate abuse.
- Extend logging to structured logs (JSON) for easier aggregation.
- Consider feature flags to disable premium features when dependent integrations are degraded.

## 5. Bonus: Healthcheck script
A new script (`scripts/healthcheck.ts`) provides a CLI summary of env keys, database reachability, Stripe API access, and optional Next.js health endpoints. Run it with `pnpm ts-node scripts/healthcheck.ts`. 【F:scripts/healthcheck.ts†L1-L225】

## 6. Suggested test plan
1. **Environment validation** – Unit test `getEnv` / `getOptionalEnv` to ensure required keys throw when missing and fallback logic works.
2. **Database resilience** – Mock `pg` pool to confirm `isDatabaseConfigured()` gating, schema migrations, and fallback wallet behaviors.
3. **Stripe flows** – Use Stripe-mock to test `/api/wallet` charge, refund, and webhook flows end-to-end.
4. **FAL provider fallback** – Unit test `generateVideo` to ensure manifest fallback triggers when API errors or missing keys occur.
5. **API regression** – Integration tests hitting `/api/generate`, `/api/wallet`, `/api/jobs/[jobId]` with and without `DATABASE_URL` set to validate mock pathways.
6. **Health endpoints** – Test `/api/health/*` routes to guarantee they surface missing configuration with accurate HTTP statuses.

---

_This audit focuses on code-level guarantees within the repository. For production readiness, pair these findings with infrastructure monitoring (Vercel logs, Supabase status, Stripe alerts) and secret rotation policies._
