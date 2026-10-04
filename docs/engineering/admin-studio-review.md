# Studio interaction review

`/admin/studio` exposes retained Studio interaction evidence to existing administrators. It does not change generation, assistance pricing, source-content retention, or MCP collection.

## Owners

- Server route pages own `requireAdmin`, parameter validation and metadata fetch orchestration.
- `frontend/server/admin-studio-review/read-model.ts` owns bounded SQL reads and transactional access auditing. It never initializes schema.
- `contracts.ts` bounds identifiers and paging; `projection.ts` explicitly selects reviewable fields and removes URLs and credential-shaped text.
- `http.ts` applies the admin gate, same-origin POST check, streamed 2 KiB JSON limit and private/no-store response headers.
- Route-local `_components` render metadata, the explicit reveal control and whitelisted evidence. React escapes all displayed text. No response is rendered as HTML.
- Migration `55_admin_studio_review_access.sql` creates a metadata-only access log and a recent-turn index. It must be applied explicitly after migration 50. Missing audit storage blocks content access before the content SELECT. No migration runs from a page or read request.

## Access flow

The list returns at most 50 metadata rows and permits pages 0–100, with optional account, project and state filters. It does not return submitted messages, replies, project names or JSON payloads. List and detail links do not prefetch sensitive content. The detail route first reads only metadata for the exact `(user_id, project_id, request_id)` tuple and requires a non-deleted project owned by that account.

**Reveal recorded content** makes a separate authenticated same-origin POST. Before selecting submitted text or the saved final reply, its database transaction inserts the reviewer ID, target tuple, projection version and timestamp. A failed audit insert fails closed. A successful response is returned only after commit. The source project/turn is locked against concurrent deletion for the duration of that bounded transaction. **Hide content** clears the displayed client state; it does not erase the access audit.

Only selected nested SQL fields are fetched. Provider `response_json.output`, encrypted reasoning, raw tool arguments/results, context, project memory, attachment URLs and pricing snapshots are excluded. Submitted text and `draft_json.reply` are bounded to their source limits (4,000 and 2,400 characters) and scrubbed for URLs and credential patterns. This display safeguard does not establish complete anonymization of arbitrary user prose. Treat visible messages as untrusted customer content.

There are no bulk exports, review copies, feedback mutation, transcript upload, replay or external-model review actions. Existing source deletion and retention remain authoritative; this feature neither extends source retention nor promises a 30-day content-copy lifecycle. The metadata-only access log has no prompt/reply columns. Its operator retention policy should follow the existing admin audit policy before production activation; no cleanup job is silently enabled here.

## Evidence and gaps

| Example evidence | What this viewer shows | Explicit gap |
| --- | --- | --- |
| A ready `studio_image_turns` row | Submitted brief, saved visible reply, state, attempts and timestamp | No reconstruction of every model input; no capture before a source turn exists |
| `studio_conversation_steps` | Action name, state, success/failure, observed revision, safe model ID and error code | No raw action arguments/results or signed media |
| `studio_conversation_responses` | Returned model, input/cache/output/reasoning-token counts and latency | No hidden reasoning content or raw output; missing counts stay unknown |
| `studio_image_model_usage` | Historical image-director usage, separately labelled | Historical records may predate richer conversation instrumentation |
| Migration 54 assistance calls | Policy/rate/tariff versions, provider cost estimate range, reserves and settled customer charge | Reserved exposure is not revenue; unknown calls are not zero-cost; no claim of captured instruction or context versions |
| `/admin/mcp` | Link to existing server-observed operational metrics | External host transcripts and unrelated host messages are unavailable |

All detail views are labelled **partial**. Each source is limited to 20 rows with an explicit truncation marker. Missing tables, incompatible optional schemas and query failures show **unavailable**, while an available source with no rows is described as having no retained records. Each optional source uses a savepoint, so an old schema does not undo a valid access audit or turn a different readable source into a false empty result. Missing base turn/project storage is unavailable, not successful emptiness.

Provider money is stored in USD nanounits and displayed with nine decimal places (divide by 1,000,000,000). Provider min/max values preserve recorded estimation uncertainty. Customer amounts are cents in USD; `charged_cents` is shown only for settled calls. Zero settled customer charge can therefore coexist with nonzero provider cost. This read projection never recalculates pricing or modifies financial records.

## Verification

Focused checks:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/admin-studio-review*.test.ts
```

The disposable PostgreSQL test covers metadata pagination, account/project/request isolation, deleted projects, source availability, access audit requirements, excluded raw payloads, numeric usage, assistance cost ranges versus unsettled charges, and the real admin gate using its existing local-only test bypass. No production database is needed. Contract tests preserve page/POST ownership; request tests exercise unauthorized and cross-origin rejection and body/identifier bounds.

Production activation still requires applying migration 55, using the existing admin role controls, and verifying the applicable customer-content-use and access-audit retention policy. Full historical context manifests, instruction/tool-schema version capture, user feedback, MCP conversation grouping and external-host transcript ingestion are separate work.
