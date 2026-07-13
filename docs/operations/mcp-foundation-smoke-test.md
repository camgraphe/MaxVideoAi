# MaxVideoAI MCP foundation smoke test

Use this runbook on a non-production deployment first. The foundation is read-only: a successful test must not submit media, upload a reference, create a quote, debit a wallet, or issue trial credit.

## 1. Verify the deployment target

1. Confirm the Git branch and Vercel preview URL.
2. Run `npm run neon:branches:check` and stop unless it identifies the intended non-production Neon branch.
3. Apply `neon/migrations/29_mcp_audit_events.sql` with the repository migration command only after the guard succeeds.
4. Configure `MCP_API_HOST` and `MCP_RESOURCE_URL` for the tested API host.
5. Confirm TLS, DNS, and the API-host rewrite while checking that the main-domain `/mcp` remains the marketing page.

## 2. Configure OAuth

Follow [mcp-oauth-configuration.md](./mcp-oauth-configuration.md). Enable the Supabase OAuth 2.1 server only in the target project, set `/oauth/consent` as the authorization path, require PKCE, and review dynamic registration before enabling it.

Keep `FEATURES.mcp.paidGeneration`, `trial`, and `referenceUploads` false. Enable transport, OAuth, and discovery only in the controlled deployment being tested.

## 3. Check unauthenticated discovery

```bash
curl -i https://api.maxvideoai.com/.well-known/oauth-protected-resource/mcp
curl -i -X POST https://api.maxvideoai.com/mcp \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"1.0"}}}'
```

Expected:

- metadata identifies exactly `https://api.maxvideoai.com/mcp`;
- unauthenticated MCP returns `401`;
- `WWW-Authenticate` points to the protected-resource metadata;
- authenticated responses later use `Cache-Control: private, no-store`;
- browser `Accept: text/html` receives `406`;
- the disabled endpoint receives `404`.

## 4. Exercise each host

Use the commands in [mcp-host-compatibility-matrix.md](./mcp-host-compatibility-matrix.md).

For Codex and Claude separately:

1. Add the remote URL without manually supplying a bearer credential.
2. Start OAuth and confirm MaxVideoAI login opens.
3. Verify the browser returns to the same authorization request after login.
4. Deny once and confirm the host reports denial safely.
5. Approve once and confirm only `openid`, `email`, and `profile` are requested.
6. List the three tools and inspect their read-only annotations.
7. Call account status, model listing, and model recommendations.
8. Ask the host to help formulate a text-to-video prompt and propose a reference image. Confirm the host performs that reasoning while MaxVideoAI only reports model capabilities.
9. Refresh/restart the host and confirm its authorization refreshes.
10. Disconnect the host at `/account/connections`; confirm the connection disappears and reconnect requires approval.

## 5. Validate safety and data minimization

- Account status contains integer cents, currency, verification state, client ID, and account URL, but no e-mail address.
- Catalog and recommendations contain only public image/video models and supported modes.
- Hidden, Labs, disabled, maintenance, admin-only, and unsupported models never appear even when queried by ID.
- Recommendations contain factual reasons and trade-offs, never an exact price or provider guarantee.
- Audit rows contain only coarse allowlisted fields. Search sanitized logs for accidental credential, prompt, private-reference, and payment data before approval.
- No provider job, quote, receipt, upload, or trial record is created.

## 6. Record and decide

Update the compatibility matrix with sanitized evidence. Keep production discovery disabled for any failure in OAuth discovery, refresh, revocation, host rendering, cache privacy, or model exposure. A protocol-only local pass is not sufficient to enable production.
