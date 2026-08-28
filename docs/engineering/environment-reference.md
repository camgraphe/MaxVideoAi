# Environment reference

This reference records the environment variables and operational ownership previously embedded in the root README. The checked-in [`frontend/.env.local.example`](../../frontend/.env.local.example) remains the authoritative current template for additional provider and feature flags. Scope every value to the intended local, Preview, or Production environment. Never commit real credentials or copy server-only values into `NEXT_PUBLIC_*` variables.

## Provider, identity, database, and billing variables

| Variable | Scope | Purpose |
| --- | --- | --- |
| `FAL_KEY` / `FAL_API_KEY` | Server | Fal.ai API key used by server-side provider access. Prefer `FAL_KEY` on Vercel. |
| `GOOGLE_VERTEX_PROJECT_ID` / `GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON` | Server | Google Vertex AI project and service account for direct Google providers such as Veo and Lyria 3. |
| `GOOGLE_VERTEX_LYRIA_ENABLED` | Server, optional | Enables Google Vertex Lyria 3 as the primary `generate audio` music provider when credentials are configured. Set `0` to force Fal music providers. |
| `GOOGLE_VERTEX_LYRIA_LOCATION` | Server, optional | Vertex location for Lyria 3 interactions. Defaults to `global`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase Auth project URL used by the browser. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase Auth anonymous key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server, optional | Supabase service-role key for privileged Auth operations. |
| `DATABASE_URL` | Server | Neon Postgres connection string for application tables and API routes. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Public | Stripe publishable key used by the browser. |
| `STRIPE_SECRET_KEY` | Server | Stripe secret key for server-side payment operations. |
| `STRIPE_WEBHOOK_SECRET` | Server, optional | Stripe webhook signing secret. |

## Legal, consent, and marketing variables

| Variable | Scope | Purpose |
| --- | --- | --- |
| `LEGAL_MIN_AGE` | Server | Minimum age required during signup consent. Defaults to 15 when unset. |
| `NEXT_PUBLIC_LEGAL_MIN_AGE` | Public | Mirrors `LEGAL_MIN_AGE` so the interface can display the current requirement. |
| `LEGAL_RECONSENT_MODE` | Server | `soft` by default or `hard`; controls re-consent enforcement. |
| `LEGAL_RECONSENT_GRACE_DAYS` | Server | Grace period in days when `LEGAL_RECONSENT_MODE=soft`. |
| `CONSENT_MODE` | Server | Consent-interface mode, `cmp` or `basic`. |
| `GOOGLE_CONSENT_MODE` | Server | `true`, `false`, or `auto`; controls Google Consent Mode v2 signals. |
| `NEXT_PUBLIC_GOOGLE_CONSENT_MODE` | Public | Mirrors the Google consent-mode choice for client-side signals. |
| `MARKETING_DOUBLE_OPT_IN` | Server | Enables the double-opt-in marketing email flow when `true`. |

## Analytics and notifications

| Variable | Scope | Purpose |
| --- | --- | --- |
| `GA4_MEASUREMENT_ID` | Server, optional | GA4 Measurement ID for server-side Measurement Protocol events. |
| `GA4_API_SECRET` | Server, optional | GA4 Measurement Protocol secret for top-up completion tracking. |
| `NEXT_PUBLIC_ENABLE_CLARITY` | Public, optional | Enables the production-only Microsoft Clarity integration when consent is granted. |
| `NEXT_PUBLIC_CLARITY_ID` | Public, optional | Microsoft Clarity project identifier. |
| `NEXT_PUBLIC_CLARITY_ALLOWED_HOSTS` | Public, optional | Host allowlist for Clarity execution. |
| `NEXT_PUBLIC_CLARITY_DEBUG` | Public, optional | Enables local Clarity diagnostics when `true`. |
| `SLACK_BOT_TOKEN` / `SLACK_SIGNING_SECRET` / `SLACK_WEBHOOK_URL` | Server, optional | Slack bot, signature, and webhook credentials for enabled integrations and alerts. |

## Infrastructure cost reporting and alerts

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEON_API_KEY` / `NEON_API_TOKEN` | Server, optional | Enables Neon usage estimates and branch guard alerts in `/admin/infra-costs`. |
| `NEON_USAGE_ORG_ID` / `NEON_USAGE_PROJECT_IDS` | Server, optional | Neon organization and comma-separated project IDs for the infrastructure cost report. Production project IDs are used when unset. |
| `VERCEL_TOKEN` / `VERCEL_API_TOKEN` | Server, optional | Enables Vercel billing charge reporting. |
| `VERCEL_TEAM_ID` / `VERCEL_TEAM_SLUG` | Server, optional | Scopes Vercel billing reporting to a team. |
| `AWS_COST_EXPLORER_ACCESS_KEY_ID` / `AWS_COST_EXPLORER_SECRET_ACCESS_KEY` | Server, optional | AWS Cost Explorer credentials for S3 cost reporting. Falls back to `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`; the principal needs `ce:GetCostAndUsage`. |
| `AWS_COST_EXPLORER_SESSION_TOKEN` | Server, optional | Session token for temporary STS billing credentials. |
| `AWS_S3_COST_LINKED_ACCOUNT_IDS` | Server, optional | Comma-separated linked AWS account IDs included in S3 Cost Explorer reporting. Defaults to all accessible accounts. |
| `AWS_S3_COST_TAG_KEY` / `AWS_S3_COST_TAG_VALUES` | Server, optional | Cost Explorer tag filter for S3 charges when allocation tags are enabled. |
| `INFRA_COST_MONTHLY_WARNING_USD` / `INFRA_COST_MONTHLY_CRITICAL_USD` | Server, optional | Global projected month-end spend thresholds for the daily infrastructure alert. |
| `S3_USAGE_MONTHLY_WARNING_USD` / `S3_USAGE_MONTHLY_CRITICAL_USD` | Server, optional | Projected month-end S3 thresholds for infrastructure alerts. |
| `INFRA_COST_ALERT_EMAIL_TO` | Server, optional | Email recipient for infrastructure alerts when SMTP is configured. Slack alerts use `SLACK_WEBHOOK_URL`. |

## Runtime health and local contract variables

| Variable | Scope | Purpose |
| --- | --- | --- |
| `HEALTHCHECK_TOKEN` | Server, recommended | Shared bearer token for protected health endpoints in Preview and Production. |
| `NEXT_PUBLIC_API_BASE` | Public, local contract use | Overrides the API base used by compatible local mock-contract flows. |
| `CRON_SECRET` | Server, recommended | Shared bearer secret accepted by Vercel Cron routes when configured. |
| `FAL_POLL_TOKEN` | Server | Route-specific token accepted by Fal polling endpoints and local or manual cron authorization. |

The environment and Fal health routes below run the shared healthcheck authorization first. In Preview and Production, if `HEALTHCHECK_TOKEN` is not configured, the route returns `503`. Once configured, an absent or incorrect request token returns `401`; send the matching value through `Authorization: Bearer ...` or `x-healthcheck-token`. Local development can remain open when the environment token is unset.

## Health endpoints

- GET `/api/health/env` — Node.js runtime; after authorization, returns a JSON boolean presence map for `FAL_KEY`, `FAL_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and `STRIPE_SECRET_KEY`. It reports configuration presence, not provider connectivity.
- GET `/api/health/fal` — Node.js runtime; after authorization, resolves the normalized `FAL_KEY` / `FAL_API_KEY` alias. It returns `503` with `fal_credentials_missing` when credentials are absent and `{ ok: true }` when present; it does not call Fal or perform a remote readiness probe.
- GET `/api/health/db` — Node runtime; executes `SELECT 1` against Neon.
- GET `/api/health/legal` — Node runtime; checks Neon and current legal-document seeding.
- GET `/api/health/stripe` — Node runtime; requests one Stripe price to verify the server credential.

These routes are read-only checks, but they still expose operational state. Keep them protected outside local development.

## Data ownership

Supabase is Auth only. Keep authentication templates and configuration under `supabase/`; do not use `supabase db push` for application tables.

Neon is the application Postgres database. Jobs, outputs, media metadata, user assets, billing, admin, and workspace data live there, with migrations under `neon/migrations`.

Amazon S3 stores media bytes: uploads, generated images, video, audio, thumbnails, previews, keyframes, and exports. See [`docs/data-platform.md`](../data-platform.md) for the detailed ownership contract.
