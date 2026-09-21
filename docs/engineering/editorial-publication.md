# Editorial draft to publication

Approved scope: preserve the file-based blog and existing Neon/S3/Auth services.
This release deploys the draft receiver first. Article import follows storage setup;
publication requires a separate exact-version approval and publication implementation.
n8n remains the only cadence owner; no site scheduler or automatic publication is added.

## Plan

- [x] Share the controlled article renderer between private and public readers.
  Public images use responsive Next Image, an uncropped eager cover, lazy body
  images and intrinsic dimensions. The private reader retains authenticated media.
- [x] Prepare approved content as localized MDX frontmatter plus a sibling JSON
  article artifact. Markdown loading validates the artifact before rendering it;
  no model-authored JSX or executable code is accepted. Strip private research,
  generation prompts, approval actor and internal notes from the public projection.
- [x] Reuse `/api/uploads/image` with the explicit `editorial-draft` upload purpose,
  the existing S3 bucket/helpers and content hashes. Draft imports stay disabled until the draft prefix is verified private.
  Keep the n8n credential incapable of approving or publishing. No new media route,
  bucket, CMS or application database.
- [x] Store check reports against the exact imported version in the existing
  application database (migration 50). `/api/editorial/drafts` accepts the
  `record-checks` action using the existing ingestion credential. Approval reads
  this report instead of trusting booleans in a generated draft.
- [ ] Connect the deployed-site browser check job. The local Next.js visual test
  is implementation evidence, not a live S3 or production approval report.
- [ ] Add the admin-only publication action and a durable publication receipt.
  Recheck latest version, digest, pending corrections, completed checks and human
  approval under the same article lock used by edits. A correction or new version
  cannot race publication. Remote publication remains disabled without explicit
  server configuration.
- [ ] Commit the complete approved locale bundle to the configured GitHub branch
  in one non-forced reference update. Existing unrelated content must be preserved;
  path collisions and an uncertain write must not cause a blind second commit.
  A Git commit is reported as awaiting deployment, not as a live page.
- [ ] Verify locally with disposable PostgreSQL, the actual pilot article, phone
  and desktop render checks, localized metadata, and simulated remote failures.
  Keep the current trial database and production content untouched.

## Tests required

An unapproved, stale, corrected or unchecked version cannot publish; replay cannot
duplicate a publication; a lost remote response is inspected before retry; the
three locales are committed together; no path traversal/markup injection or private
draft fields enter the public artifact; a phone visitor sees complete illustrations,
one title, working source links and collapsed prompts. Legacy MDX articles keep
their rendering, metadata and route behavior.

## Runtime boundary

n8n prepares and deposits. The site owns authorization and public projection.
The stable review link is `/admin/editorial/ARTICLE?version=N`, protected by the
existing administrator login. The public article uses the existing localized blog
routes and metadata helpers. Activating production requires deployment, the existing
database migration, private storage configuration and scoped server credentials.
No article is published merely by importing or running a scheduled task.

## Local implementation evidence — 21 September 2026

- `/api/uploads/image` keeps ordinary user uploads and their auth contract;
  `x-upload-purpose: editorial-draft` selects a separate draft credential check
  before reading bytes. It returns an immutable manifest, never a public draft URL.
- Storage delegates to `frontend/server/storage.ts`: same bucket configuration,
  conditional creation, existing private `editorial/drafts/` prefix. No production
  upload was performed. The private bucket/CDN policy must be verified at setup.
- Automation connector: `scripts/deliver-site-draft.mjs` dynamically exports the
  current approved-for-reading EN/FR/es-419 bundle, uploads the exact media bytes,
  then calls the existing draft import. It is opt-in, not selected by the local
  n8n trial. Interrupted import can replay the unchanged run key without creating
  a second version. This credential has no approval/publication permission.
- Shared reader matches the approved illustrated pilot: system typography,
  uncropped cover/body images, unboxed discreet captions, real diagram, prompt
  heading outside its collapsed drawer. New articles use the existing public blog
  routes. Article/Breadcrumb JSON-LD uses the site's server-rendered JsonLd helper.
- Actual Next.js routes exercised with temporary loopback-only fixtures in three
  locales at 360, 768 and 1440 px: 4 images, 2 closed prompts, 1 H1, no detected
  text or viewport overflow; canonical/hreflang and Article/Breadcrumb present.
  Browser requests substituted local image bytes: remote S3/CDN delivery was not
  measured. The unrelated cookie-version endpoint lacked a database in this test.
  Temporary public-content fixtures were removed afterwards.
- TypeScript, frontend ESLint and 49 focused tests passed. The PostgreSQL test
  also passed separately against a disposable local database; migration 50 was
  then applied only to the existing local pilot database. Three automation
  connector tests verify media integrity, rejection, unchanged replay and routes.

Still to implement before production publication: the deployment-side check job,
the explicit publication action and its receipt, the atomic content/locale-map
commit, and the stable authenticated WhatsApp handoff. There is no deployed
publication automation and no extra public route in this change.

## Receiver release — 21 September 2026

The release branch starts at current `origin/main` (`63c5105a4`), preserving Sora
retirement, existing server-rendered JSON-LD and the persistent Markdown cache fix.
The cache fingerprint includes sibling article JSON bytes. Old pilot content and
unrelated MCP changes are excluded.

Anonymous browser navigation to an editorial review redirects to the existing
sign-in page with the exact review path preserved. APIs keep their authorization
checks. Import requires the immutable hash-derived media manifest returned by
the existing upload endpoint.

Deployment order:

1. Deploy the receiver with ingestion disabled (no ingestion token or private flag).
2. Apply migrations 49 and 50 to the existing application database.
3. Restrict only `editorial/drafts/` in the existing storage policy. Verify signed
   server reads and anonymous denials through both S3 and the media hostname.
4. Configure the server-only scoped ingestion token and privacy confirmation,
   redeploy, and import the prepared bundle privately.
5. Connect version-bound browser checks and the stable authenticated review link.

Never enable `EDITORIAL_DRAFT_MEDIA_PRIVATE_CONFIRMED=1` based only on the
application flag or a CDN denial. Existing public media must keep working.
Receiver deployment contains no public article files and does not publish content.
