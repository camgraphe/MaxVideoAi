# MaxVideoAI MCP Reference Media Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Codex, Claude, and other MCP hosts list private MaxVideoAI images, upload a local reference through a secure browser handoff, ingest a safe HTTPS image, generate reference images, and reuse stable `assetId` values in image/video quotes.

**Architecture:** User-owned `media_assets` are the only stable reference boundary. Local files use short-lived single-user upload sessions because attachment forwarding differs by host. Remote HTTPS images pass a hardened fetch/decoding pipeline and are copied to MaxVideoAI storage before quote creation. MCP tool handlers call media/reference facade services and never fetch or store media directly.

**Tech Stack:** Next.js 15, TypeScript, Neon/Postgres, existing S3/storage and media-library services, Sharp, MCP resources/content, Zod, Node test runner.

## Global Constraints

- Complete foundation and paid-generation plans first.
- Enable media listing and upload handoff independently with `FEATURES.mcp.referenceUploads`.
- Initial reference inputs are images only. Reject source video, audio, documents, archives, SVG, and executable formats.
- Never make base64 the primary MCP input. Local bytes travel browser → MaxVideoAI upload endpoint, not through model context.
- Every `assetId`, job output, upload session, and quote is user-owned and checked server-side.
- Remote URLs must be HTTPS, must survive DNS/IP/redirect checks, and must be copied before the quote is returned so content cannot change between quote and confirmation.
- Private/reference media must not enter public sitemaps, analytics payloads, logs, or unauthenticated MCP resources.
- Tool/resource results use signed or controlled URLs with bounded lifetimes; never expose storage credentials.

---

## Task 1: Define private media and reference DTOs

**Files:**

- Create: `frontend/src/server/agent-api/media-types.ts`
- Create: `frontend/src/server/agent-api/reference-types.ts`
- Create: `tests/mcp-media-contract.test.ts`

- [ ] Write failing source/type contracts for:

```ts
export type AgentMediaItem = {
  assetId: string;
  kind: 'image';
  label: string | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  previewUrl: string | null;
  source: 'upload' | 'generated' | 'imported';
  createdAt: string;
};

export type ResolvedReference = {
  assetId: string;
  role: 'source' | 'reference' | 'first_frame' | 'last_frame';
  storageUrl: string;
  width: number | null;
  height: number | null;
  mimeType: string;
};
```

- [ ] Keep `storageUrl` internal. The public DTO exposes only `assetId` and controlled preview/resource URLs.

- [ ] Define stable errors `REFERENCE_REQUIRED`, `REFERENCE_INVALID`, `REFERENCE_NOT_FOUND`, `REFERENCE_FORBIDDEN`, `UPLOAD_EXPIRED`, and `UPLOAD_ALREADY_USED`.

- [ ] Run and commit the contract test.

## Task 2: Implement user-owned media listing and asset resolution

**Files:**

- Create: `frontend/src/server/agent-api/media-library.ts`
- Create: `frontend/src/server/agent-api/reference-assets.ts`
- Create: `frontend/src/server/mcp/tools/list-media.ts`
- Modify: `frontend/src/server/mcp/server.ts`
- Create: `tests/mcp-list-media.test.ts`
- Create: `tests/mcp-reference-ownership.test.ts`

- [ ] Write failing tests for image-only listing, pagination, deleted assets, another user's asset ID, audio/video filtering, output provenance, and private preview URLs.

- [ ] Build `listAgentMedia()` on `listLibraryAssetPage({ userId, kind: 'image' })`. Normalize sources to the three public labels and never return origin URLs or metadata wholesale.

- [ ] Implement `resolveOwnedReferenceAsset(principal, assetId)` with a direct `media_assets` ownership query. Require active status, image kind, supported MIME, non-deleted row, and valid storage URL.

- [ ] Register `list_media` as read-only, non-destructive, and closed-world. Limit pages to 50 items and require cursors from the existing media pagination contract.

- [ ] Run existing `tests/media-library-contract.test.ts` with the new suites; commit.

## Task 3: Extract and harden the existing image upload service

**Files:**

- Create: `frontend/src/server/uploads/store-image-upload.ts`
- Modify: `frontend/app/api/uploads/image/route.ts`
- Create: `tests/image-upload-service.test.ts`
- Create: `tests/image-upload-route-auth-order.test.ts`

- [ ] Capture current deduplication, normalization, thumbnail, user-assets, and `media_assets` behavior in failing service tests.

- [ ] Move file decoding/storage into:

```ts
export async function storeImageUpload(params: {
  userId: string;
  fileName: string;
  declaredMime: string | null;
  bytes: Buffer;
}): Promise<{ assetId: string; width: number; height: number; mimeType: string; sizeBytes: number; previewUrl: string | null }>;
```

- [ ] Authenticate before parsing `formData()` or decoding with Sharp. Reject over-limit `Content-Length` early, then enforce the actual byte cap after reading.

- [ ] Allow decoded JPEG, PNG, WebP, GIF first frame, and AVIF. Normalize HEIC/TIFF/BMP to a web-safe raster. Reject SVG and enforce a maximum pixel count to prevent decompression bombs.

- [ ] Keep the existing upload route as a cookie/bearer HTTP adapter and preserve its response shape. Run upload, asset, and media contracts; commit.

## Task 4: Add short-lived upload-session persistence

**Files:**

- Create: `neon/migrations/30_mcp_reference_uploads.sql`
- Modify: `frontend/src/lib/schema/mcp-schema.ts`
- Create: `frontend/src/server/agent-api/reference-upload-sessions.ts`
- Create: `tests/mcp-reference-upload-migration.test.ts`
- Create: `tests/mcp-reference-upload-sessions.test.ts`

- [ ] Write migration contracts for:

```text
mcp_reference_upload_sessions
  session_id UUID PRIMARY KEY
  token_hash TEXT UNIQUE NOT NULL
  user_id TEXT NOT NULL
  oauth_client_id TEXT
  state TEXT CHECK ('created','uploaded','expired','revoked')
  asset_id TEXT
  expires_at, uploaded_at, created_at, updated_at
```

- [ ] Store only a SHA-256/HMAC hash of the browser token; return the random token once. Default expiry to fifteen minutes and enforce single use.

- [ ] Implement `createUploadSession`, `getOwnedUploadSession`, `claimUploadSessionForUpload`, `completeUploadSession`, and `expireUploadSessions` with `QueryExecutor` injection and row locking.

- [ ] Bind the session to the OAuth user and client for attribution, but let the same authenticated MaxVideoAI user finish the browser upload after login.

- [ ] Test token theft by another user, replay, expiry, revocation, and concurrent claims against a disposable database. Apply migration and commit.

## Task 5: Build the browser upload handoff

**Files:**

- Create: `frontend/src/server/agent-api/create-reference-upload-link.ts`
- Create: `frontend/src/server/mcp/tools/create-reference-upload-link.ts`
- Create: `frontend/app/(core)/mcp/reference-upload/[token]/page.tsx`
- Create: `frontend/app/(core)/mcp/reference-upload/[token]/_components/ReferenceUploadClient.tsx`
- Create: `frontend/app/api/mcp/reference-upload/[token]/route.ts`
- Modify: `frontend/src/server/mcp/server.ts`
- Create: `tests/mcp-reference-upload-handoff.test.ts`

- [ ] Write failing tests for tool output, login return, one-file selection, another user, expired token, MIME/size errors, successful asset ID, replay, and noindex/private caching.

- [ ] Return from the tool:

```ts
{
  uploadUrl: 'https://maxvideoai.com/mcp/reference-upload/<opaque-token>',
  expiresAt: '<ISO timestamp>',
  accepted: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  maxBytes: 26214400,
  nextAction: 'Open the URL, upload one image, then call list_media.',
}
```

- [ ] Register the exact public tool name `create_reference_upload_link`; do not introduce a client-specific attachment tool alias.

- [ ] If the browser is unauthenticated, redirect through `/login?next=...`. On return, compare the authenticated user with the upload session before showing the form.

- [ ] Post the file to the token route, atomically claim the session, call `storeImageUpload`, bind `asset_id`, and show a success page with the stable asset ID. If storage fails, release only a safely retryable claim; never allow two simultaneous uploads.

- [ ] Set `X-Robots-Tag: noindex, nofollow`, `Cache-Control: private, no-store`, and a restrictive CSP. Register the tool as additive/non-destructive/open-world.

- [ ] Run and commit.

## Task 6: Harden all server-side remote image fetching

**Files:**

- Create: `frontend/src/server/media/safe-remote-image.ts`
- Modify: `frontend/server/media-library/asset-media.ts`
- Modify: any generation attachment helper that fetches arbitrary remote images
- Create: `tests/safe-remote-image.test.ts`

- [ ] Write failing tests for HTTP, embedded credentials, localhost, loopback, RFC1918, link-local, multicast, IPv6 local ranges, cloud metadata hosts, DNS rebinding, redirects to private addresses, excessive redirects, missing/false MIME, oversized body, decompression bomb, timeout, and valid public images.

- [ ] Implement per-hop validation:

```text
parse HTTPS URL → reject credentials/non-443 port → DNS resolve all addresses
→ reject every non-public address → fetch with redirect: manual
→ repeat validation for max 3 redirects → stream with byte cap
→ decode with Sharp pixel cap → normalize to safe image
```

- [ ] Do not trust `Content-Type` alone. Verify decoded raster format and dimensions. Bound connect/read timeout and close streams when the cap is exceeded.

- [ ] Replace the unbounded `fetch(...).arrayBuffer()` in `copyRemoteMedia()` for image copying. Keep video copying behavior out of MCP scope but do not weaken existing uses.

- [ ] Log only a URL hash, host category, coarse rejection code, and request correlation ID; do not log full private URLs.

- [ ] Run the safe-fetch and media-library suites; commit this security boundary separately.

## Task 7: Ingest HTTPS references into stable assets during preparation

**Files:**

- Create: `frontend/src/server/agent-api/ingest-reference-url.ts`
- Create: `frontend/src/server/agent-api/resolve-generation-references.ts`
- Modify: `frontend/src/server/agent-api/prepare-generation.ts`
- Modify: `frontend/src/server/agent-api/generation-normalization.ts`
- Modify: `frontend/src/server/mcp/tools/prepare-generation.ts`
- Create: `tests/mcp-reference-ingestion.test.ts`

- [ ] Write failing tests for owned asset references, valid HTTPS ingestion, duplicate URL content, role limits, model capability limits, wrong-user asset, stale asset, and URL content mutation after quote.

- [ ] For each HTTPS input, call `safeRemoteImage`, copy/normalize it to MaxVideoAI storage, call `ensureReusableAsset({ source: 'import' })`, then replace the canonical quote reference with its stable `assetId`.

- [ ] Deduplicate by content hash per user, not by raw URL. Store a hashed origin in private metadata if needed for support; never expose or audit the original URL.

- [ ] Validate resolved references against the selected engine's actual input schema and role/count limits before pricing and quote persistence.

- [ ] Update `prepare_generation` annotations when URL ingestion is enabled: `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true`. Its description must explain that HTTPS references are copied to the user's private library but no generation or charge occurs.

- [ ] Ensure confirmation resolves only stored `assetId` values and never re-fetches the original URL. Run quote immutability tests and commit.

## Task 8: Persist generated image outputs as reusable references

**Files:**

- Modify: `frontend/src/server/images/execute-image-generation.ts`
- Create: `frontend/src/server/images/persist-mcp-reference-assets.ts`
- Modify: `frontend/src/server/agent-api/generation-status.ts`
- Create: `tests/mcp-generated-reference-assets.test.ts`

- [ ] Write failing tests proving each successful MCP-origin image output gets a user-owned `media_assets` record and stable `assetId`, while ordinary web behavior remains unchanged.

- [ ] Mark MCP origin in server-owned job metadata at confirmation; reject a body-supplied origin marker.

- [ ] After stable image output storage, call `ensureReusableAsset` for each output with `source: 'saved_job_output'`, `sourceJobId`, and `sourceOutputId`. Return asset IDs in MCP status/result DTOs.

- [ ] A partial asset-persistence failure must not mark a successful generation failed. Record an operational error and allow reconciliation from `job_outputs`.

- [ ] Verify workflow: paid text-to-image → completed status with `assetId` → video quote with that `assetId`. Commit.

## Task 9: Add authenticated MCP resources for media results

**Files:**

- Create: `frontend/src/server/mcp/resources/media-resource.ts`
- Modify: `frontend/src/server/mcp/server.ts`
- Create: `tests/mcp-media-resources.test.ts`

- [ ] Define authenticated resources such as `maxvideoai://media/{assetId}` and `maxvideoai://generations/{jobId}` with ownership checks on every read.

- [ ] Inline only safely bounded image content. Return signed HTTPS links and metadata for videos or large images; never load large binaries into model context by default.

- [ ] Test expired signed links, wrong user, deleted asset, MIME correctness, content length, and private caching. Commit.

## Task 10: Host compatibility and end-to-end reference verification

**Files:**

- Create: `tests/integration/mcp-reference-workflow.test.ts`
- Modify: `docs/operations/mcp-host-compatibility-matrix.md`
- Create: `docs/operations/mcp-reference-runbook.md`

- [ ] In Codex and a Claude-compatible host, verify library listing, local upload handoff, HTTPS ingestion, image generation, returned asset ID, image-to-video/reference-to-video quote, confirmation, polling, and result resources.

- [ ] Verify the workflow when the host does not forward local attachments and when it cannot render binary MCP resources.

- [ ] Run the gate:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-*media*.test.ts \
  tests/mcp-*reference*.test.ts \
  tests/safe-remote-image.test.ts \
  tests/image-upload-*.test.ts \
  tests/media-library-contract.test.ts
pnpm --prefix frontend exec tsc --noEmit --pretty false
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
npm --prefix frontend run build
```

- [ ] Keep upload/URL reference flags disabled if either host requires undocumented attachment behavior or if SSRF/decompression tests have any failure.

## Completion Criteria

- Users can reference an existing library image, securely upload a local image, or ingest a valid public HTTPS image.
- Every accepted reference becomes a stable, private, user-owned asset before quote confirmation.
- MCP-generated images return reusable asset IDs for later video generation.
- SSRF, redirect, MIME, byte, pixel, ownership, replay, and privacy controls are enforced.
- Codex and Claude-compatible workflows succeed without relying on attachment forwarding or large base64 payloads.
