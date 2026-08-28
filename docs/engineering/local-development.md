# Local development

This guide keeps contributor setup and repository operations out of the product README. MaxVideoAI is a production Next.js application in `frontend/`; the root also retains a deterministic mock contract server for isolated API work.

## Prerequisites

- Node.js 22.x, matching the root and frontend `package.json` engine declarations.
- pnpm 10.18.2 through Corepack or an equivalent local installation.
- Docker only when you want to run the mock contract server in isolation.
- `jq` for the optional mock API checks below.

## Run the Next.js application

From the repository root:

```bash
pnpm install
cp frontend/.env.local.example frontend/.env.local
pnpm dev
```

The root `dev` script delegates to the frontend Next.js development server. Fill only the values needed for the flow you are testing; see [environment-reference.md](environment-reference.md) for scope, secrets, and health checks.

The main product implementation lives under `frontend/`. Engine selection drives capability-aware controls, reference fields appear only for supported workflows, and the composer obtains current pricing from the application before a generation request.

## Run the mock contract server

`mock-server.js` is retained for deterministic `/api/engines` and `/api/preflight` responses backed by `fixtures/`. It is useful for contract work; it is not the production backend.

```bash
pnpm install
pnpm start
```

The server runs on `http://127.0.0.1:3333` by default.

### Run the mock with Docker

```bash
docker build -t maxvideoai-mock .
docker run --rm -p 3333:3333 -e CORS_ORIGIN="*" maxvideoai-mock
```

Or use Compose:

```bash
docker compose up --build
```

Check the deterministic endpoints:

```bash
curl -s http://127.0.0.1:3333/api/engines | jq
curl -s http://127.0.0.1:3333/api/preflight \
  -H "Content-Type: application/json" \
  -d '{"engine":"veo3","mode":"t2v","durationSec":8,"resolution":"1080p","aspectRatio":"16:9","fps":24,"addons":{"upscale4k":false,"audio":true},"user":{"memberTier":"Plus"}}' | jq
```

To point a compatible local client at this contract, set `NEXT_PUBLIC_API_BASE` in `frontend/.env.local` to the mock base URL. Keep `/api/engines` and `/api/preflight` stable when switching between the mock and another backend. Run the mock on a different port, such as 3334, when both need to stay available.

## Add or update a model

Model identity and publication policy belong only in `frontend/config/model-registry.json`. Read [model-registry.md](model-registry.md) before changing a model.

Use the onboarding flow to scaffold the provider/execution definition, registry entry, localized content, and launch checklist:

```bash
pnpm model:setup -- --from kling-3-pro --slug your-new-model --name "Your New Model" --family kling
```

The scaffold is a starting point. Complete and review each model addition in this order:

1. Add the provider/execution definition with the canonical model ID; keep provider-specific identifiers in the adapter or mode definition.
2. Complete one `frontend/config/model-registry.json` entry with its canonical slug, family, category, aliases, and every publication field explicit.
3. Review `content/models/{en,fr,es}/{slug}.json`, including all three localized `decision` blocks, hrefs, and canonical `decision.modelSlug` values.
4. Regenerate every projection and run the focused model and page tests.

These generated projections reflect the authored registry and must not be edited directly:

- `frontend/config/model-runtime.json`;
- `frontend/config/engine-catalog.json`;
- `frontend/config/model-roster.json`;
- `docs/model-roster.json`; and
- `docs/model-roster.csv`.

Regenerate and validate before committing the authored registry change together with its projections:

```bash
pnpm model:registry:generate
pnpm engine:catalog
pnpm model:generate:write
pnpm model:registry:check
```

## Database migrations and provider fixtures

Neon is the application database. SQL migrations live in `neon/migrations` and run in order against the pooled `DATABASE_URL` connection:

```bash
pnpm db:migrate:neon
```

The migration runner is idempotent and seeds current legal-document versions. Do not put application database migrations in `supabase/migrations`; Supabase is Auth-only in this project.

To refresh the Fal catalogue fixtures, run:

```bash
npx tsx scripts/dump-fal-models.ts
```

The command writes `frontend/fixtures/fal-models.json` and `fixtures/fal-models.json`. It calls the Fal Platform API with `FAL_KEY` or `FAL_API_KEY` and does not depend on the application proxy.

## Scheduled jobs

- Cron definitions live in `frontend/vercel.json`; redeploy after changing them.
- `/api/cron/fal-poll` is a Node.js route that accepts GET and POST, authorizes with the shared `authorizeCronRequest` policy, and calls `runFalPoll` directly.
- On Vercel, the route accepts a matching route-specific `FAL_POLL_TOKEN`, or a Bearer `CRON_SECRET` when configured. Without `CRON_SECRET`, the fallback requires both `x-vercel-cron` and the exact `vercel-cron/1.0` user agent. A deployment ID mismatch is rejected when both deployment IDs are present.
- Outside Vercel, a configured `CRON_SECRET` or `FAL_POLL_TOKEN` is required and may be sent through the supported authorization or route-specific header. When neither secret is configured, the shared helper deliberately permits local no-secret execution.
- IndexNow is change-based. `.github/workflows/indexnow.yml` runs on pushes to `main` when relevant SEO or marketing files change, then submits sitemap URLs to `/api/indexnow`.
- A qualifying push produces one IndexNow submission batch; there is no periodic six-hour IndexNow loop.

For an authorized manual Fal poll:

```bash
curl -H "X-Fal-Poll-Token: $FAL_POLL_TOKEN" https://<your-domain>/api/fal/poll
```

This command calls the separate `/api/fal/poll` route. When `FAL_POLL_TOKEN` is configured, an absent or invalid token returns `401`; when the token is unset, the route permits local no-token execution. A successful poll returns an `{ ok: true, ... }` response.

For a manual IndexNow catch-up:

```bash
pnpm --dir frontend run sitemap:ping -- --sitemaps
```

## Analytics in local and production environments

Microsoft Clarity is mounted from the root layout through `frontend/components/analytics/Clarity.tsx`. It runs only in production after analytics consent is present in the `mv-consent` cookie. The consent banner broadcasts `consent:updated`, allowing analytics scripts to remain behind `ConsentScriptGate`.

Wallet top-ups emit client funnel events from `frontend/app/(core)/billing/_hooks/useBillingTopupAnalytics.ts`; the Stripe webhook emits server completion, purchase, and refund events through GA4 Measurement Protocol when analytics consent and the GA4 server variables are present. Follow the [GA4 top-up guide](../analytics/ga4-topups.md) for conversions, custom dimensions, and Stripe referral handling.

The first-party `mv-clarity-id` cookie preserves session continuity across client navigation. Authenticated sessions can attach plan, role, currency, and user context; staff accounts under MaxVideoAI domains are labelled for analytics exclusion. Use the `NEXT_PUBLIC_ENABLE_CLARITY`, `NEXT_PUBLIC_CLARITY_ID`, `NEXT_PUBLIC_CLARITY_ALLOWED_HOSTS`, and optional `NEXT_PUBLIC_CLARITY_DEBUG` variables described in the environment reference.

## Verification and repository guardrails

Run focused checks first:

```bash
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

The public-exposure check fails when sensitive folders or `.env*` files would enter a public mirror. Review the [public/private boundary](../public-vs-private.md) before publication.

Repository automation currently includes:

- `.github/workflows/quality.yml` for typecheck, lint, and tests on pull requests and `main` pushes;
- `.github/workflows/lighthouse.yml` for Lighthouse checks on `main`; and
- `.github/workflows/indexnow.yml` for change-based IndexNow submission.

Repository settings should protect `main` with pull requests, at least one approval, the required Quality CI status, and disabled force-push and branch deletion. Dependabot security updates are managed through repository settings without bulk dependency-update waves.

Deployment guidance and checklists live in the [GitHub and Vercel deployment guide](../deployment/github-vercel.md). The default Vercel application project is `maxvideoai-app`, though another compatible infrastructure target can be used deliberately.
