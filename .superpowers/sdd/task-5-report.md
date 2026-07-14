# Task 5 report: Conversion-safe MCP connect CTAs and attribution foundation

## Status

DONE, with authoritative connection binding deliberately deferred to Task 7's durable funnel ledger.

## Implementation summary

- Added equal Claude and Codex connect cards to the localized MCP landing hero while preserving the existing official-mark component and localized setup-guide destinations.
- Added an explicit client-action configuration. Both deep-link flags remain false and both URLs remain null because no checked-in compatibility evidence proves a safe client deep link. The localized setup guides and a visible copyable `https://api.maxvideoai.com/mcp` fallback always render.
- Added separate endpoint-copy controls for Claude and Codex with localized success/failure status text and an accessible polite live region. A copy action is never described or emitted as a connection success.
- Added consent-aware browser analytics through the existing `dispatchGaEvent()` transport. Connect clicks emit `mcp_landing_cta_clicked`; copies emit the distinct `mcp_endpoint_copy_clicked`. Payloads contain only action, client, coarse destination, and locale.
- Added a same-origin JSON acquisition endpoint. It accepts only an exact closed allowlist for action, source, medium, campaign, and client; rejects unknown/sensitive keys; caps body size; requires `application/json`; and reuses the established Origin/CSRF check.
- Added a dedicated server-only HMAC-SHA-256 signing secret. The endpoint issues an opaque random acquisition ID in a ten-minute, versioned, signed cookie with `HttpOnly`, `SameSite=Lax`, consent-flow-only path scoping, and production `Secure` behavior. The response is empty and never exposes the ID to client JavaScript.
- Added strict verification that fails closed for oversized cookies, malformed segments, bad signatures, unsupported versions, non-exact payload keys, invalid IDs, invalid/coarse values, inconsistent lifetimes, expiry, or excessive clock skew. Signature comparison is constant-time.
- Added an authenticated MCP connection seam that resolves the existing Supabase principal first and only then supplies the evidence-backed `direct_mcp` fallback. It preserves the existing bearer-token, `getClaims()`, fresh `getUser()`, and exact subject-equality checks and does not trust `user_metadata`.
- Documented `MCP_ACQUISITION_SIGNING_SECRET` as a dedicated server-only secret with a minimum of 32 random bytes, independent rotation, and explicit non-reuse of Supabase, OAuth-client, Stripe, or provider credentials.
- Did not change the MCP publication flags, deep-link flags, database schema, production data, or external systems.

## TDD RED/GREEN evidence

The focused acquisition contract was written before the production owners existed:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-acquisition-attribution.test.ts
```

Initial RED result: exit 1; 10 tests, 1 passed and 9 failed. The failures were the intended missing owners and behaviors: exact acquisition allowlists, signed/expiring private cookies, secret configuration, the protected endpoint, OAuth classification, distinct analytics, and flagged client actions.

A subsequent deployment-secret documentation contract was also observed RED before the environment example and operations runbook were updated.

Final focused GREEN result, including the existing visual boundary contract:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-acquisition-attribution.test.ts \
  tests/mcp-marketing-visual-contract.test.ts
```

Result: exit 0; 17 passed, 0 failed.

## Privacy and security contract

### Browser-to-consent handoff

- The request accepts exactly `action: connect | copy_endpoint`, `source: mcp_landing`, `medium: owned`, `campaign: mcp_connect`, and `client: claude | codex`.
- Extra keys are rejected, including identity, email, prompt, `authorization_id`, tokens, arbitrary source/campaign values, or arbitrary clients.
- The cookie stores only version, opaque acquisition ID, the four coarse acquisition dimensions, and issue/expiry timestamps. The click action is validated server-side but intentionally omitted from the cookie.
- The cookie is inaccessible to client JavaScript, scoped to `/oauth/consent`, short-lived for 600 seconds, and cryptographically authenticated. A forged or stale value is unusable.
- The endpoint returns `204` with `private, no-store`; it never returns the acquisition ID or another bearer-like artifact.
- Navigation is guarded so a primary click results in one destination change after acquisition recording settles or a bounded 750 ms fallback. Modified clicks retain native browser behavior.

### OAuth identity boundary

- No user identity is read or stored when the landing action occurs.
- The OAuth adapter continues to verify the bearer JWT through Supabase `getClaims()`, then fetches a fresh user through `getUser(accessToken)`, and requires the user ID to equal the verified token subject.
- `user_metadata`, JWT profile claims, landing input, and cookie content cannot establish identity, email verification, authorization, role, or ownership.
- The current direct-host fallback is assigned only after authentication succeeds and contains no acquisition ID.

### Threat cases covered

- Cross-site POST: rejected by the existing same-origin Origin check.
- Oversized or wrong-media-type request: rejected before parsing.
- Arbitrary client/source/campaign or sensitive extra fields: rejected by exact-key and exact-value validation.
- Cookie tamper, version substitution, expiry extension, future timestamp, malformed signature, or oversized input: verification returns null.
- Secret absent or weaker than 32 bytes: issuance fails closed with a generic unavailable response.
- Open redirect: no destination is accepted by the server endpoint or from a browser/request parameter. Current deep links are disabled; only checked-in localized guide URLs are used.
- Fake conversion: CTA and copy telemetry are separate and neither emits `mcp_connection_completed` or another success name.
- Forged OAuth acquisition in `user_metadata`: ignored; the fresh authenticated principal remains authoritative.
- Unsupported persistence: the existing MCP audit allowlist rejects the attempted acquisition completion payload before executing a query.

No general-purpose, repository-approved rate limiter exists for this cheap same-origin cookie-issuance route. The implementation therefore uses strict Origin, content type, byte-size, exact-schema, and coarse-value controls without importing checkout-specific database/rate-limit semantics. A shared edge limiter can be layered later without changing this contract.

## Supabase OAuth decisions checked against current official documentation

- Supabase OAuth 2.1 uses the authorization-code flow with mandatory PKCE, so the acquisition cookie is treated only as a first-party browser handoff and never as an OAuth credential: <https://supabase.com/docs/guides/auth/oauth-server/oauth-flows>.
- The consent UI receives an `authorization_id` and uses the server-side authorization details/approval flow; exact registered redirect URIs remain Supabase-owned. No acquisition field is inserted into a redirect URL: <https://supabase.com/docs/guides/auth/oauth-server/getting-started>.
- `getClaims()` verifies the JWT and `getUser(jwt)` performs a fresh Auth-server user validation. The adapter retains both checks and exact subject equality: <https://supabase.com/docs/reference/javascript/auth-getclaims> and <https://supabase.com/docs/reference/javascript/auth-getuser>.
- OAuth access tokens expose a `client_id` claim, but client identity is not inferred from the landing CTA: <https://supabase.com/docs/guides/auth/oauth-server/token-security>.
- Supabase's OAuth token endpoint changed from HTTP 201 to 200 effective June 1, 2026. Task 5 adds no token-exchange status assumption and no hard-coded 201 contract: <https://supabase.com/changelog/45468-breaking-change-oauth-token-endpoint-will-return-http-200-instead-of-201>.

## Durable binding boundary and Task 7 handoff

The signed cookie can safely reach the first-party `/oauth/consent` browser route, including the login return, because its path is scoped there. It cannot reach a Claude/Codex host's later bearer-authenticated request to `api.maxvideoai.com/mcp`: browsers do not transfer a first-party web cookie into an external MCP client's Authorization flow.

The current `mcp_audit_events` schema also has no `acquisition_id`, acquisition source, acquisition client classification, or idempotent connection key. Its strict event/input allowlist correctly rejects such unknown fields. Adding an in-memory pending map, hiding context in OAuth state/`authorization_id`, trusting `user_metadata`, or overloading unrelated columns would be unsafe and unreliable in serverless execution.

Therefore this task intentionally does not claim authoritative binding or emit `mcp_connection_completed`. Task 7 owns migration `33_mcp_acquisition_funnel.sql` and the durable funnel writer. That task must provide:

1. a server-owned pending handoff keyed by the opaque signed acquisition ID and an OAuth-safe durable correlation;
2. allowlisted acquisition/source/client columns without prompts, emails, tokens, raw URLs, provider bodies, or payment data;
3. an idempotent/unique once-only connection-completion key so retries cannot inflate conversion;
4. cookie verification at the consent boundary, durable correlation through approved OAuth state, and authenticated binding only after the existing `getClaims()` plus `getUser()` equality checks;
5. `direct_mcp` classification when no valid durable landing evidence exists.

Until that schema/flow lands, the adapter exposes only the honest authenticated `direct_mcp` fallback and the existing audit ledger fails closed. This is a deliberate security and data-integrity boundary, not an in-memory substitute.

## Final verification

1. Full MCP regression suite:

   ```bash
   ./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/mcp-*.test.ts
   ```

   Result: exit 0; 150 passed, 0 failed.

2. TypeScript, lint, exposure, localization, and diff checks:

   ```bash
   ./frontend/node_modules/.bin/tsc --project frontend/tsconfig.json --noEmit --pretty false
   npm --prefix frontend run lint
   npm run lint:exposure
   npm --prefix frontend run i18n:check
   git diff --check
   ```

   Result: all commands exited 0. French parity is 4,156 keys and Spanish parity is 4,150 keys.

3. Production build:

   ```bash
   npm --prefix frontend run build
   ```

   Result: exit 0. Model registry/catalog checks, Next.js compilation and type validation, generation of 728 static pages, and sitemap generation passed. `/api/mcp/acquisition` is present as a dynamic server route.

## Remaining operational requirements

- Set a dedicated `MCP_ACQUISITION_SIGNING_SECRET` in each deployment environment before exercising landing acquisition. The route intentionally returns 503 if it is missing or weak.
- Keep both deep-link flags disabled until a named client/version/destination has been compatibility-tested and the checked-in evidence is reviewed.
- Complete Task 7's durable, idempotent funnel binding before using landing-to-connection conversion as an authoritative KPI.
- Preserve generic 2xx acceptance in any later Supabase token-exchange test; do not reintroduce a 201-only assumption.

No push, pull request, merge, deployment, external message, database change, publication-flag change, deep-link enablement, or other external mutation was performed.
