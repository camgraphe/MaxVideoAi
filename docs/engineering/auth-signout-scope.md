# Website signout and independent OAuth sessions

Reviewed: 2026-09-22.

Ordinary website signout must call `supabase.auth.signOut({ scope: 'local' })`
in both the browser and `/api/auth/signout`. Supabase JavaScript defaults to
`global`, which deletes all sessions for the user, including OAuth client
sessions. The `local` scope is server-enforced: it terminates the current session,
not just browser storage. Other independently authorized sessions remain active.

This policy also applies when replaying logout intent on the marketing site and
when cleaning up an incomplete password signup. The existing invalid-session
cleanup in `supabase-ssr.ts` and `supabase-auth-cleanup.ts` already uses local scope.
The API must report a returned SDK error rather than claiming signout succeeded.

Connector revocation remains an explicit action on `/account/connections`, using
`supabase.auth.oauth.revokeGrant({ clientId })`. Keep the MCP server's token and
active-grant checks. Do not extend access-token lifetimes or bypass revocation to
make directory health checks succeed. A deliberate sign-out-everywhere feature
would require a separate, clearly labelled action and corresponding tests.

## Evidence and limits

The Glama incident reported an expired access token. Read-only Auth audit evidence
showed refresh events followed by `logout` at 2026-09-21 16:58:37 UTC for the isolated
test account, with no sessions remaining at the subsequent inspection. The code's
unscoped signout can produce this outcome; the available audit event does not
identify which UI or caller initiated that particular logout.

The successful Glama reauthorization at 2026-09-22 09:26 UTC belonged to the main
account, not the isolated test account. It must not be recorded as proof that the
isolated profile or its automatic refresh was restored. Store no credentials,
account addresses, session IDs, or authorization codes in this document.

## Verification

`tests/auth-signout-scope.test.ts` executes the route with an Auth stub and checks
the requested scope, error responses, and all ordinary Auth signout call sites.
`tests/mcp-connections-contract.test.ts` and `tests/mcp-oauth-principal.test.ts`
cover explicit connector revocation and rejection of invalid/revoked access.
These are offline checks, not proof of live Glama refresh.

After deployment, use the isolated test account to authorize Glama. Verify the
account before consent, run Test Connection, then sign out of the website using
the corrected path. Confirm that the browser session ends while the separate
Glama session survives. After an actual access-token expiry, run Test Connection
without reauthenticating and correlate the refresh/session timestamps. Record
the outcome before calling the incident closed. Do not log out or revoke other
users' sessions to perform this check.

References:
- https://supabase.com/docs/guides/auth/signout
- https://github.com/supabase/auth/blob/master/internal/api/logout.go
- https://github.com/supabase/auth/blob/master/internal/models/sessions.go
