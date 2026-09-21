# Automatic publication after explicit human approval

## Scope

Finish the existing file-based EN/FR/ES blog pipeline; retain the controlled reader,
existing metadata builders, runtime locale sitemaps, existing S3 and application DB.
The one-month trial runs on the Mac; n8n remains the sole cadence owner. No model
calls are needed for delivery, checks or publication. Existing editorial approvals
are not publication authorizations.

## Implementation

1. Durable exact-version publication request in the existing DB. Extend the existing
   admin approval action with explicit publish intent. Refuse missing checks, stale
   content and corrections. Idempotent requests; edits cancel queued requests and
   cannot race a publication already being committed.
2. A local server worker reads private media, validates hashes, and checks the real
   Next blog routes in an isolated checkout at phone/tablet/desktop sizes, including
   actual JSON-LD, canonical/hreflang and locale sitemaps. Persist genuine reports.
   Model output cannot author a report. Bounded retries with useful errors.
3. Only after publication intent, copy immutable media to the existing public
   prefix, commit the six locale files together on a dedicated Git branch, open
   a content-only PR, await existing CI, merge normally, then verify deployed pages
   and sitemaps before recording published. Inspect remote state after uncertain
   writes; never force-push or create a duplicate publication.
4. n8n's existing tick runs this worker and site delivery. Stable authenticated
   admin link in WhatsApp; completion notification includes public URLs. Pause and
   Mac shutdown retain queue state. Credentials stay in the local server worker,
   never in n8n JSON, model prompts, content files or browser bundles.
5. Regression tests on disposable DB and simulated Git failures, real pilot QA,
   full suite/build, fresh review, code deployment and connection verification.
   Do not publish the real pilot using its old content-only approval.

## Architectural ruling

Blog locale mapping is derived from the MDX canonicalSlug fields by existing
readers. No separate locale-map write is needed; all three locale pairs must be
committed atomically. Never edit generated sitemap XML; build/runtime owners
already discover the new content. Publication confirmation verifies their output.

## Operations

Apply migration 51 before deploying these admin readers. Enable
`EDITORIAL_PUBLICATION_ENABLED=1` on the site only after the local server worker
and its n8n wakeup are connected. The ingestion token still cannot publish.

The local bridge reads `.local/publication-worker.json` (private, not committed):
`enabled`, `siteRoot` (dedicated clean runtime checkout), `envPath` (private
server environment), `ingestEnvPath`, `syncMain`. The worker loads server DB/S3
configuration only in its own process. Git uses the existing local GitHub CLI
account; no Git token is copied into the website, model or workflow JSON.
This is a local trial, so the worker's effective privileges are those of that
existing account. A cloud migration must replace them with a scoped GitHub App.

`publication-worker.ts` processes at most one publication or candidate per wakeup.
Database advisory locking prevents concurrent workers. A publication stays queued
while the Mac is off; pauses are re-read before public media writes and each Git
mutation. Git ref/PR/merge responses are reconciled against the saved exact commit.
There is no forced update or repository-wide automatic-merge configuration change.
CI waits are bounded to 36 service passes; merge conflicts are actionable holds.
A blocked job can be resumed in admin without deleting its remote receipt.

Review/completion/error notifications remain pending in the existing DB until the
local sender has a confirmed WhatsApp receipt and acknowledges it. Unknown delivery
results are held locally for inspection to avoid duplicate messages. QA uses three
attempts, then exposes the reason and a technical retry action; it never rewrites
or regenerates the article. All daily generation remains under existing trial limits.

External cited sources returning 401/403/429 remain visibly unverified in admin;
internal links/CTAs and confirmed missing sources block publication. Public
confirmation requires the same full rendering assertions as preflight, plus exact
content identity in initial HTML and reciprocal localized sitemap entries.

A successful DB/content-only approval from the previous release is not migrated
into publication intent. The administrator must use the new explicit action.
