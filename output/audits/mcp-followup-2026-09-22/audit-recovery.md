# Targeted generation/reference recovery audit — 2026-09-22

Scope: read-only review of the MCP confirmation/status/reference recovery implementation and focused tests. No account calls, provider calls, network operations, or edits to the repository were made. The attempted offline test command (`pnpm exec tsx --test ...`) could not load the repository `@/` aliases from the root invocation, so its result is recorded as an environment/test-run limitation rather than a product failure.

## Confirmed defects

### 1. Paid image success envelopes can bypass the refund marker

- Location: `frontend/src/server/agent-api/paid-generation-execution.ts:454-467`, especially line 464.
- Trigger: the image continuation dependency returns `{ ok: true, paymentStatus: 'refunded_wallet' }` (or another refund marker recognized by the local `refunded()` helper at lines 383-387). This is a success-shaped response carrying a refund state.
- Consequence: the function returns `{ kind: 'completed' }` without checking `refunded(result)`. `confirmGeneration` then marks the quote accepted at `frontend/src/server/agent-api/confirm-generation.ts:565-568`, even though the job is refunded/failed. A repeat confirmation follows the accepted/claimed recovery path and can expose a contradictory terminal state rather than classifying the paid attempt as rejected/refunded.
- Proof / missing test: the same function explicitly checks `hasRefundMarker` before accepting a video response at lines 434-441, while the image branch returns completed on any `result.ok` at line 464. `tests/mcp-confirm-generation.test.ts:1122-1145` covers the success-shaped refunded *video* response only; there is no image analogue. A focused unit case with an image `executeImage` result `{ ok: true, paymentStatus: 'refunded_wallet' }` would reproduce the classification mismatch.
- Confidence: high. This is a direct branch asymmetry in the shared continuation contract, independent of whether today’s provider normally emits that envelope.

### 2. Browser reference upload becomes unrecoverable after storage succeeds but session completion fails

- Location: `frontend/src/server/uploads/create-reference-upload-post-handler.ts:193-241`, especially lines 222-240; the session state machine rejects a still-claimed session at `frontend/src/server/agent-api/reference-upload-sessions.ts:324-365` and `257-283`.
- Trigger: `storeImageUpload`/`storeVideoUpload`/`storeAudioUpload` returns an asset, then `completeUploadSession` fails (transient database error, timeout, or the session expires before completion). The handler sets `storedAssetId` at line 222, then catches the completion error. Because the catch releases the claim only when `storedAssetId === null` (line 238), it deliberately leaves the session claimed.
- Consequence: the browser receives a 500-style failure and no asset ID. The token now has `claim_id != null` while still in `created`; a retry hits `UPLOAD_ALREADY_USED` at `reference-upload-sessions.ts:281-283`. The stored asset may remain in the private library without a returned reference, and there is no recovery path in this handler to complete the exact claim or safely return the already-stored asset.
- Proof / missing test: the existing handoff tests cover success, validation/storage failure with claim release, and replay (`tests/mcp-reference-upload-handoff.test.ts:210-268`, `347-378`, `785-847`), but do not inject a failure from `completeUploadSession` after `storedAssetId` is assigned. The completion API only permits an already-uploaded idempotent return or a `created` row with the exact claim (`reference-upload-sessions.ts:334-364`), so the claimed-created state cannot be retried through the normal endpoint.
- Confidence: high. This is an observable state transition and retry behavior in the current code; the newer direct-upload attempt machinery does not add recovery to this browser POST handler.

## Coverage gap / lower-confidence behavior

### 3. MCP App multi-file retry and mixed-media behavior are not exercised

- Location: `frontend/src/server/mcp/reference-upload-app.ts:215-255`, especially lines 223-228 and 247-253; static-only assertions in `tests/mcp-reference-upload-app.test.ts:66-122`.
- Trigger: select multiple files, let one fail, then select only that failed file to retry; or select files of different media kinds in one batch. The app keeps the last handoff in `handoff`, reuses it for index 0 on retry, and requests subsequent handoffs using `current.mediaKind`. Each handoff is single-use and kind-specific.
- Consequence: a retry can reuse a consumed/stale capability and fail with `UPLOAD_ALREADY_USED`/expiry, and mixed-kind selection is routed through one kind-specific session rather than the per-file direct import behavior. The UI tells users to select failed files to retry (line 252), but there is no executable test proving that flow.
- Proof / missing test: the test only checks that the HTML contains `multiple`, `/start`, `/part`, `/complete`, failure collection, and the retry copy; it never executes the embedded loop with a consumed handoff, a released claim, or mixed media. This is a coverage gap unless the product intentionally restricts the MCP App to one media kind per batch; that restriction is not stated in the UI copy or enforced before selection.
- Confidence: medium. The control flow is clear, but the exact host/runtime behavior for tool-result refresh and whether a failed attempt always releases its session varies by failure point.

## Protections already observed

- `confirmGeneration` locks the owned quote and rejects expired/stale catalog, request-hash, membership, price, currency, and pricing-snapshot changes before reservation/provider submission (`frontend/src/server/agent-api/confirm-generation.ts:317-465`); focused tests cover these cases at `tests/mcp-confirm-generation.test.ts:888-942`.
- Claimed/accepted/failed repeat confirmations return the linked job without revalidation, charging, or provider submission (`confirm-generation.ts:327-330, 526-530`; `tests/mcp-confirm-generation.test.ts:848-867`). Ambiguous paid outcomes stay claimed and are not automatically retried (`confirm-generation.ts:559-570`; test `1008-1027`).
- Status reads are scoped to the authenticated user and bound retry guidance to accepted/running states only (`frontend/src/server/agent-api/generation-status.ts:329-349, 232-249`; `tests/mcp-generation-recovery-tools.test.ts:99-122, 212-234`).
- Reference direct imports preserve successful IDs on partial batch failure and the downloader pins DNS, blocks private ranges, bounds bytes, and revalidates redirects (`frontend/src/server/agent-api/reference-file-import.ts:103-151`; `frontend/src/server/agent-api/reference-file-download.ts:172-207`; `tests/mcp-reference-file-import.test.ts:268-319, 321-553`).
