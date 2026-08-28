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
