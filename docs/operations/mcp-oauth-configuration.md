# MaxVideoAI MCP OAuth configuration

This runbook records dashboard settings only. Never copy project secrets, access tokens, refresh tokens, authorization codes, or user data into this document.

## Supabase Auth

- Enable **Authentication → OAuth Server → OAuth 2.1 Server** in the non-production project first.
- Set the Site URL to the tested MaxVideoAI origin.
- Set the Authorization Path to `/oauth/consent`.
- Enable authorization-code flow with PKCE.
- Enable dynamic client registration only in the controlled environment until Codex and Claude-compatible redirect URI behavior has been reviewed.
- Require user consent and verify that the consent screen displays the registered client name, redirect URI, and requested scopes.
- Supabase currently advertises `openid`, `email`, `profile`, and `phone` as standard authorization-server scopes. Codex CLI 0.144.1 requested all four during local testing even though the MCP protected resource advertises only the first three. Keep production discovery disabled until the extra `phone` scope is accepted as policy or removed from the host flow.
- Use an asymmetric JWT signing key before requesting `openid`; publish and verify the project JWKS endpoint.
- Keep access-token lifetime short enough for account revocation requirements and verify refresh-token rotation.

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
MCP_FUNNEL_TRIAL_TO_WALLET_WINDOW_SECONDS=2592000
```

For local development, the host and resource values are required explicitly and must use a loopback host.
The acquisition signing value is server-only, must contain at least 32 random bytes, and must not reuse a Supabase,
OAuth-client, Stripe, or provider credential. Rotate it independently if exposure is suspected; rotation deliberately
invalidates the short-lived acquisition cookies already issued.
The optional funnel window is a UTC query-time cohort setting, defaults to 30 days, and does not
mutate raw events. Keep it a positive whole number no larger than 365 days.

## Verification

1. Fetch Supabase authorization-server discovery and MaxVideoAI protected-resource metadata.
2. Register a disposable client with a reviewed redirect URI.
3. Start authorization with PKCE and confirm login returns to the same `authorization_id`.
4. Deny once and verify the registered redirect receives the OAuth error.
5. Approve once and verify token exchange succeeds with HTTP 200.
6. Refresh the token, revoke the grant, and confirm subsequent access is rejected according to token lifetime and session policy.
7. Confirm logs and audit events contain no token, authorization code, prompt, or private media URL.

Supabase OAuth 2.1 Server is beta. Re-check the official changelog and OAuth Server documentation before enabling production discovery.
