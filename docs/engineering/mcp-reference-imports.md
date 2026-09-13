# MCP private reference imports

This guide owns the architecture for moving a user-authorized image, video, or
audio file from an AI host into the connected private MaxVideoAI library.

## Supported paths

| Path | Use it when | Result |
| --- | --- | --- |
| `import_reference_files` | The host exposes user-authorized attachments or generated results as temporary HTTPS file handles | Up to eight canonical private `assetId` values, in input order |
| `create_reference_upload_link` MCP App | ChatGPT or Claude can render the returned UI resource but cannot expose a native file handle | An in-chat picker uploads up to eight files and reports their `assetId` values to model context |
| Browser handoff | The host cannot render the MCP App | One private upload followed by `list_media` |
| Packaged local helper | Codex or Claude Code can read a local file but the remote MCP server cannot | One link per file; the helper uploads bytes and returns `assetId` values |

The MCP server never accepts a raw local filesystem path. The local helper is
the only component that reads local paths, and it sends only file bytes, the
base filename, hashes, and bounded upload metadata. Private media must not be
published at a public URL, and none of these paths depends on Computer Use.

## Ownership

- `frontend/src/server/mcp/tools/import-reference-files.ts` owns the native host
  file parameter contract.
- `frontend/src/server/agent-api/reference-file-download.ts` owns bounded HTTPS
  retrieval, DNS resolution, address pinning, redirect revalidation, and SSRF
  rejection.
- `frontend/src/server/agent-api/reference-file-import.ts` owns canonical private
  persistence and ordered partial-success results.
- `frontend/src/server/mcp/reference-upload-app.ts` owns the portable in-chat
  multi-file UI resource.
- `frontend/src/server/uploads/create-reference-direct-upload-handlers.ts` owns
  capability authorization, chunk relaying, completion, abort, and CORS.
- `plugins/maxvideoai/scripts/import-reference-files.mjs` owns local filesystem
  reading for Codex and Claude Code.
- `plugins/maxvideoai/skills/generate/` owns host selection and conversation
  behavior.

Do not move download validation into the MCP tool callback or file persistence
into the UI resource. Keep the browser and local helper on the same chunked,
single-use upload protocol.

Every MCP import explicitly stores the final object and any generated thumbnail
without a public object ACL and with `Cache-Control: private, no-store`. This is
an import-specific override: ordinary product uploads keep their existing
storage defaults. Do not replace this explicit visibility intent with the
deployment-wide `S3_UPLOAD_ACL` setting.

Operational staging additionally prefixes both content-addressed originals and
thumbnails with the exact `mcp-reference-staging/` namespace. Durable cleanup
rows, object fences, and URL parsing preserve that namespace end to end; they
must never collapse a staging key onto the production `user-assets/` or
`user-asset-thumbs/` keyspace. Thumbnail failures log only stable event codes,
not filenames, object keys, user identifiers, or raw storage errors.

## Library deletion and storage cleanup

Deleting a canonical library asset remains an authenticated library operation; it
does not add a destructive MCP tool. The request transaction locks and soft-deletes
the exact owned `media_assets` row, removes same-owner `user_assets` projections
whose URL exactly matches the canonical URL (while preserving a projection whose
`asset_id` belongs to another live canonical row at that URL), and changes retained
final/thumbnail cleanup records to `released` only for the completed direct-upload
attempt whose `staged_asset_id` is that canonical public ID. Migration 43 installs
the same transactional soft-delete trigger for rolling deployments. Tombstones that
predate the migration are reconciled by one bounded worker CTE per cleanup run; the
migration performs no unbounded projection, ledger, or fence backfill.

The request does not call storage. The reference-upload cleanup worker groups
released records by object key, rejects live exact final or thumbnail references and
pending/retained upload owners, then claims the shared durable object fence and a
bounded deletion lease. The fence covers both `user-assets/by-content/` final keys
and `user-asset-thumbs/` thumbnail keys, so persistence and competing workers cannot
win while deletion is in flight. Historical thumbnail rows acquire a missing fence
lazily immediately before the claim and exact reference recheck. A successful storage
effect marks every released ledger owner for that key deleted; failure restores the
fence and leaves the records released for retry.

The claim may recover a stale `referenced` fence left by concurrent deletion of the
last two owners, but only inside the same atomic `NOT EXISTS` reference check and only
when no producer lease is active. The tombstone reconciliation scan uses the partial
`(deleted_at, id)` index and keeps `public_id IS NOT NULL` aligned between its predicate
and query.

Reference checks parse the complete storage URL path rather than searching for a key
substring. Both final and thumbnail keys are recognized in `user_assets.url` and
`media_assets.url`; thumbnail projections in `media_assets.thumb_url` and
`user_assets.metadata.thumbUrl` use the same strict parser. A key appearing only in
a query string or fragment is not an owner. URL schemes are parsed case-insensitively,
and an unrelated authority is not an owner even when its path mimics an owned key.
The namespace may follow a configured base pathname such as `/public`; matching is
still confined to complete pathname segments and never reads query or fragment data.
The HTTPS scheme and authority are compared case-insensitively, while the owned
namespace segments remain exact lowercase strings. Plain HTTP and uppercase namespace
lookalikes are never recognized owners; a shaped HTTP URL may only enter quarantine.
Because PostgreSQL cannot see runtime `S3_PUBLIC_BASE_URL` or
`ASSET_HOST_ALLOWLIST`, only exact first-party authorities are recognized owners;
generic multi-tenant cloud authorities are not trusted as a class. An unrecognized
authority with an owned-key-shaped pathname is a conservative per-key quarantine at
deletion claim time. Its persistence and removal still acquire/release the same fence,
so it cannot race an in-flight deletion, but it is not promoted to `retained` ownership.
Supporting cleanup for a new custom storage authority therefore requires an explicit
shared database authority contract; until then the object is retained rather than
risking a false-negative owner check.

This lifecycle applies only to the direct MCP upload handoff backed by
`mcp_reference_upload_attempts`. Native `import_reference_files` imports do not yet
have that durable upload ledger and are not claimed as storage-cleanup participants.

## Trust boundaries

Native host handles are untrusted URLs even when the user authorized the file.
Only HTTPS on the default TLS port is accepted. Every hostname and redirect is
resolved again; private, loopback, link-local, documentation, multicast, and
reserved addresses are rejected before a connection is opened. The selected
public address is pinned for the TLS request. MIME type, declared length, actual
stream length, and the existing per-kind upload policy are all enforced before
persistence.

NAT64, IPv4-mapped, translation, site-local, and other special-use IPv6 ranges
are denied. Each HTTPS hop has an absolute transfer deadline in addition to its
idle timeout, and response bodies are destroyed on redirects or validation
failures.

Browser/app/helper handoffs use a random, hashed, 15-minute, one-use capability.
The path token may authorize cross-origin upload calls without a MaxVideoAI
cookie. Responses are no-store and noindex, CORS never allows credentials, and
the capability cannot bypass ownership checks on the underlying session.

## Agent behavior

1. Use `list_media` only when the user wants an existing library asset.
2. Prefer `import_reference_files` when the host provides an authorized file
   handle. Reuse successful IDs directly; do not re-list.
3. Otherwise call `create_reference_upload_link`. Let a compatible host render
   its MCP App. Use the exact browser destination only as the manual fallback.
4. In a local coding agent, create one link per file and run the packaged helper.
5. Preserve file order. On a partial batch failure, retain successful IDs and
   retry only failed files. The MCP App reports successful IDs even when another
   selected file fails.
6. Never expose capability URLs, raw local paths, or internal IDs in normal chat.

## Verification

Focused contracts live in:

- `tests/mcp-reference-file-import.test.ts`
- `tests/mcp-reference-upload-app.test.ts`
- `tests/mcp-reference-local-helper.test.ts`
- `tests/mcp-reference-direct-upload.test.ts`
- `tests/mcp-instructions.test.ts`
- `tests/mcp-plugin-contract.test.ts`

Run these before the broader MCP contracts, frontend lint, TypeScript check,
public exposure check, and release-bundle test.
