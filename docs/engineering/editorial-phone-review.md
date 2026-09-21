# Editorial phone review (isolated local trial)

The controlled `EditorialArticle` component is shared by the admin preview and `scripts/editorial/review/server.ts`. Styles are scoped by `.ed-article`. Mobile storyboards split the three equal panels of the same immutable illustration; comparisons and steps never shrink into unreadable columns. Text is rendered through React, not model-authored HTML.

`schema.ts` supports three localized storyboard panels, optional media headings and conclusion CTA, source limitations and media SHA-256. Existing draft payloads remain readable. A generated illustration is never labeled a verified capture; unspecified image model provenance stays unspecified.

`corrections.ts` writes exact-version correction requests into existing `editorial_events` using `draft_rejected`. It locks the article, validates locale/block/digest, rejects stale targets, deduplicates request IDs and invalidates approval. A corrected article needs a new version/run key before approval. No publishing route is added. Admin corrections retain `requireAdmin` and same-origin checks.

For the one-month desktop trial, the review server uses the same repository against loopback PostgreSQL. Startup refuses a non-loopback database. This server exposes only reading, media and correction submission for one version-bound capability. It does not expose the Next.js admin or reuse its localhost bypass. The production public blog still reads MDX, not these drafts.

Local environment: `DATABASE_URL` (host exactly 127.0.0.1), `EDITORIAL_REVIEW_STATE_DIR`, `EDITORIAL_LOCAL_MEDIA_DIR`, optional `EDITORIAL_REVIEW_PORT` (default 5684). The state directory holds `runtime.json` (explicit public HTTPS origin), `grant.json` (articleId/version/digest/tokenHash/expiresAt/revoked), and a pending-correction outbox. The caller issues a random 256-bit token; only its hash is used for validation. A private fragment link exchanges the token for an HttpOnly Secure SameSite=Strict cookie, removes the fragment, and applies no-store/noindex/no-referrer/CSP. Mutation origins must exactly match configured origins. Asset bytes are checked against their hash before delivery.

`EDITORIAL_TEST_DATABASE_URL` must name a disposable database for repository tests: those tests truncate editorial tables. Never point them at the trial article database or production. The automation workspace owns the local service installer, exports, tunnel and owner-only WhatsApp receipts. The trial's correction outbox does not run arbitrary instructions; a supervised edit produces a new version.

Before production: use durable HTTPS and the existing admin authentication, private S3 media and least-privilege draft ingestion. The local phone reader is an evaluation adapter, not a replacement authentication system for MaxVideoAI. Publication remains a separate explicit approval/deployment step.
