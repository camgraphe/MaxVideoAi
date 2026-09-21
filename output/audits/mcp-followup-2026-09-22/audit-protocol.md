# Targeted MCP protocol audit (2026-09-21)

Scope: bounded review of the MCP HTTP handler, OAuth adapter, server capability gates, result serialization, and focused transport/OAuth tests, followed by the requested bounded-read fix in the two MCP files only.

## Findings

### 1. The MCP body limit was not a memory bound when `Content-Length` was absent or understated

### 2. The 128 KiB body limit is not a memory bound when `Content-Length` is absent or understated

- **Location:** `frontend/src/server/mcp/http-handler.ts:72-87`, especially lines 73-80.
- **Trigger:** An authenticated POST uses chunked transfer (no `Content-Length`) or supplies a smaller value, with a body over 128 KiB.
- **Consequence before this follow-up:** `request.text()` fully buffered the body before the byte count was measured; the handler eventually returned 413, but peak memory was proportional to the attacker-controlled body rather than capped at 128 KiB. This was a local bounded-read gap, not evidence of a production exploit or a bypass of any platform-level request cap.
- **Evidence before this follow-up:** The only early rejection was `content-length > MAX_BODY_BYTES` (lines 73-76), followed unconditionally by `await request.text()` (line 78). Existing transport coverage tested only an overstated `Content-Length` (`tests/mcp-transport-contract.test.ts:611-643`). The neighboring direct-upload reader uses streaming chunk accounting (`frontend/src/server/uploads/create-reference-direct-upload-handlers.ts:95-105`), but no analogous upstream owner or route-level cap was present for `/api/mcp` (`frontend/app/api/mcp/route.ts:1-16`). Confidence: **confirmed code-level gap**, medium-high operational severity.
- **Follow-up status:** Fixed in `frontend/src/server/mcp/http-handler.ts` by reading `request.body` incrementally, cancelling as soon as actual bytes exceed 128 KiB, releasing the reader in `finally`, and preserving UTF-8/JSON/error behavior. Read failures still return the existing 500 transport error. Tests now cover missing and understated `Content-Length`, split UTF-8 inside a multibyte sequence, cancellation and non-draining behavior, plus a read-error/reader-release case.

### Negotiation correction (not a defect)

The earlier draft treated JSON-only `Accept` as a compatibility defect. That conclusion was withdrawn: MCP 2025-11-25 and 2026-07-28 require both `application/json` and `text/event-stream` in the POST `Accept` header, and the installed SDK enforces this at `webStandardStreamableHttp.js:376-382`. The added transport test intentionally asserts that JSON-only POST remains HTTP 406; no negotiation relaxation was made.

## Existing protections confirmed

- OAuth principal resolution requires a bearer, verifies `sub` against a fresh Auth user, and for MCP requires a nonempty OAuth `client_id` plus an active grant checked with the same bearer (`frontend/src/server/mcp/oauth-adapter.ts:124-175`); `tests/mcp-oauth-principal.test.ts` covers these cases.
- The handler resolves the principal per request and passes it into every registered tool closure (`frontend/src/server/mcp/http-handler.ts:293-317`; `frontend/src/server/mcp/server.ts:329-360`), while account/media/recovery services scope reads by `principal.userId`. No account-isolation defect was confirmed in this bounded review.
- Structured results retain a complete compact JSON text fallback and `structuredContent`, with resource links appended separately (`frontend/src/server/mcp/tool-result.ts:14-37`); `tests/mcp-result-serialization.test.ts` covers value preservation and errors.
- Capability gates are applied at registration time (`frontend/src/server/mcp/server.ts:306-360`) and runtime capability resolution fails closed for staging (`frontend/src/server/mcp/operational-access.ts:22-39`); focused tests passed.

## Verification

`pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-transport-contract.test.ts` — **21 passed, 0 failed** after the bounded-read implementation and conformance tests. The oversized test requires two chunks to cross the limit and asserts that a third tail chunk is never pulled; it passes for both missing and understated `Content-Length`. An isolated simulation of the former `request.text()` implementation pulled all three chunks and requested the tail (`oldRequestTextPulls: 3`, `oldRequestTextTailRequested: true`), demonstrating the regression. `pnpm --prefix frontend exec eslint src/server/mcp/http-handler.ts` and `git diff --check` passed. The repository-root test file is outside the frontend ESLint config, so linting it directly reports no configuration rather than a code diagnostic. The earlier combined audit run passed 31/31 before this follow-up.
