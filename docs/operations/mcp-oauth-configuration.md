# MaxVideoAI MCP OAuth configuration

This runbook records dashboard settings only. Never copy project secrets, access tokens, refresh tokens, authorization codes, or user data into this document.

## Production security checkpoint — 2026-09-17

The production OAuth server and dynamic client registration are enabled for the
published MCP connection flow. A researcher reported that an unauthenticated
party can register a public client with an arbitrary redirect URI; inspection
of the production OAuth Apps list confirmed the two reported test clients and
the first client's registered redirect URI. A read-only aggregate query found
zero persisted consent rows and zero authorization rows for either reported
client. This is not a global breach assessment, and the broader risk of a user
consenting to a deceptively named client remains worth evaluating.

Current authorization-server metadata advertises the Supabase authorization
endpoint and PKCE `S256`; the report's `api.maxvideoai.com/authorize` example
is not the advertised endpoint. The first-party consent form displays client
name, redirect URI, and requested scopes. Do not treat successful dynamic
registration alone as account takeover, but do not dismiss consent-phishing
risk. No OAuth setting, client, grant, or production flag was changed during
this triage. The active-grant revocation check is present in source revision
`a6a655f5e`, an ancestor of deployed main `21b339318`. A separate,
explicitly authorized hosted test later on 2026-09-17 verified the shared
server boundary: Vercel inspection confirmed `api.maxvideoai.com` targeted
Production deployment `dpl_FkuGKE2moiwuWibVwTjuLuL1axhQ` in `READY` state;
a fresh isolated OpenClaw 2026.9.4 OAuth client called only read-only
`get_account_status` (HTTP 200), its exact new grant was revoked through
Supabase Auth (HTTP 204), and the same unexpired access token immediately
received MCP HTTP 401 / JSON-RPC `-32001`, with no tool result. The test
client's local OAuth credentials were cleared and its isolated profile moved
to the Trash. No existing grant, generation, paid tool, OAuth setting,
or production flag was changed by this test. Refresh-token rejection and
host-specific reconnect lifecycles were not tested here; do not promote a host
on this shared-boundary result alone.

## Supabase Auth

- Enable **Authentication → OAuth Server → OAuth 2.1 Server** in the non-production project first.
- Set the Site URL to the tested MaxVideoAI origin.
- Set the Authorization Path to `/oauth/consent`.
- Enable authorization-code flow with PKCE.
- Review dynamic client registration in a controlled environment before changing production; production currently depends on it for tested client paths. A security decision to restrict it needs a separate compatibility and rollback review.
- Require user consent and verify that the consent screen displays the registered client name, redirect URI, and requested scopes.
- The MCP protected resource requests only `openid`, `email`, and `profile`. Production discovery is enabled; the dated host matrix records which Codex, Claude, OpenClaw, n8n, and other lifecycle steps were actually observed. Do not generalize one host's result to another.
- Use an asymmetric JWT signing key before requesting `openid`; publish and verify the project JWKS endpoint.
- Keep access-token lifetime short enough for account revocation requirements and verify refresh-token rotation.

For MCP resource requests, keep revocation enforcement on the two authoritative
Supabase boundaries: `getUser(accessToken)` must validate that the JWT's
`session_id` still exists, and `/user/oauth/grants` must contain an active grant
for the signed `client_id`. Supabase grant revocation deletes the client-bound
sessions as well as invalidating refresh tokens. Do not infer a consent or token
generation by comparing JWT `iat` with `granted_at`; those timestamps have
different precision and are not an identity binding.

Supabase authorization-server discovery is available at:

```text
https://<project-ref>.supabase.co/.well-known/oauth-authorization-server/auth/v1
```

The MaxVideoAI protected-resource document is available, only when the discovery flag is enabled, at:

```text
https://api.maxvideoai.com/.well-known/oauth-protected-resource/mcp
```

## Deployment variables

Configure these as server-side values. `NEXT_PUBLIC_SUPABASE_URL` and the existing publishable/anonymous browser key are the only browser-visible Supabase values; never expose a secret or service-role key.

```text
MCP_API_HOST=api.maxvideoai.com
MCP_RESOURCE_URL=https://api.maxvideoai.com/mcp
MCP_ACQUISITION_SIGNING_SECRET=<at-least-32-random-bytes>
MCP_TOPUP_HANDOFF_SECRET=<independent-at-least-32-random-ascii-characters>
MCP_FUNNEL_TRIAL_TO_WALLET_WINDOW_SECONDS=2592000
```

For local development, the host and resource values are required explicitly and must use a loopback host.
The acquisition signing value is server-only, must contain at least 32 random bytes, and must not reuse a Supabase,
OAuth-client, Stripe, or provider credential. Rotate it independently if exposure is suspected; rotation deliberately
invalidates the short-lived acquisition cookies already issued.
The top-up handoff signing value is also server-only and must be an independent secret with at least 32 random
printable ASCII characters. It signs short-lived `/billing` intents only; rotation invalidates outstanding handoffs.
The MCP never creates a Stripe session. Billing verifies the signed intent server-side and the existing wallet checkout
API remains responsible for validating and quoting any selected amount.
The optional funnel window is a UTC query-time cohort setting, defaults to 30 days, and does not
mutate raw events. Keep it a positive whole number no larger than 365 days.

## Verification

1. Fetch Supabase authorization-server discovery and MaxVideoAI protected-resource metadata.
2. Register a disposable client with a reviewed redirect URI.
3. Start authorization with PKCE and confirm login returns to the same `authorization_id`.
4. Deny once and verify the registered redirect receives the OAuth error.
5. Approve once and verify token exchange succeeds with HTTP 200.
6. Refresh the token, revoke the grant, and confirm both the prior access token and refresh token are rejected immediately.
7. Reauthorize the same client immediately and confirm the old access token remains rejected while the new session succeeds, including when both JWTs share the same whole-second `iat`.
8. Confirm logs and audit events contain no token, authorization code, prompt, or private media URL.

Supabase OAuth 2.1 Server is beta. Re-check the official changelog and OAuth Server documentation before enabling production discovery.
