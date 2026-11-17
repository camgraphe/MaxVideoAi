# MCP OAuth identity and consent verification

Candidate prepared on 17 November 2026. **Not applied or deployed by this diagnostic.**

## Provider compatibility

Supabase Auth [restricted delegated OAuth tokens](https://github.com/supabase/auth/pull/2898)
from account-management routes. Its [temporary GET /user exception](https://github.com/supabase/auth/pull/2926)
does not reopen `/user/oauth/grants`. A successful OAuth consent or refresh can
therefore be followed by a failed MaxVideoAI initialization when the resource
server uses that route to validate consent.

Production gateway logs observed `/auth/v1/user/oauth/grants` returning 200 at
2026-11-16 20:57:57.239 UTC, then 403 at 21:02:02.756 UTC. These are observed
requests bracketing the change, not a provider deployment timestamp. On 17 November,
the Codex client refreshed successfully (200), and the resource server received
200 from `/user` but 403 from `/user/oauth/grants`. This establishes a server-side
compatibility failure independently of any Codex account switch. The native app
connector's own credentials remain a separate diagnostic surface.

## Owners and invariants

- `oauth-adapter.ts` verifies JWT claims before any identity or consent lookup.
  OAuth tokens require a nonempty `client_id` and `session_id`. The directory's
  existing issuer, audience, validity and required-scope policy is preserved.
- `oauth-session-validation.ts` uses `/auth/v1/oauth/userinfo` for delegated
  identity. Its subject must match the signed subject. Only the provider's
  top-level boolean `email_verified` is accepted for that response. When omitted,
  the resource server reads the same user's authoritative confirmation state
  using its service credential and the Auth admin API, so openid-only consent
  retains existing verification behavior. Subject mismatches and unavailable
  lookups fail closed; user metadata and token email claims are never a fallback.
  First-party application tokens retain the SDK `getUser` path.
- `supabase/auth/mcp_oauth_grant_is_active.sql` checks the exact signed user,
  session and client against existing `auth.sessions`, `auth.oauth_consents`
  and `auth.oauth_clients`. It rejects absent/deleted/expired sessions, revoked
  consent, deleted clients and missing required scopes in either consent or
  session. Reapproving consent cannot reactivate a deleted old session.
- The RPC returns only a boolean. It has an empty search path, fully qualified
  table references, and EXECUTE permission only for `service_role` and its
  administrative owner. Anonymous and authenticated users cannot invoke it.
  Its narrowly bounded SECURITY DEFINER query avoids granting service_role
  direct reads of private Auth tables. No application tables belong here.
- The resource server uses its existing `SUPABASE_SERVICE_ROLE_KEY` only for
  this RPC. It never forwards it to a client or logs it. The delegated token is
  sent only to the configured provider's UserInfo endpoint. Both lookups prohibit
  redirects, bypass caches, have bounded waits and fail closed on errors.

## Release dependency and verification

The checked-in function must be reviewed and explicitly applied to the correct
Supabase Auth project **before** releasing the application change. This diagnostic
does not authorize that write, a production merge or a deployment. Do not remove
consent checks, make discovery public, or reconnect users repeatedly as a workaround.

1. Review the SQL, matching Auth columns and privileges. Apply the exact file to
   Supabase Auth using an authorized administrative session; never run it on Neon.
2. With the server's existing service credential, verify a nonexistent identifier
   tuple returns false. Verify anon/authenticated EXECUTE remains denied. Keep
   credentials and real user identifiers out of evidence.
3. Follow the normal GitHub PR, Quality CI and Git deployment process. Missing
   function/configuration deliberately leaves authentication denied.
4. Read `list_models`, then the live details of Seedream 5.5 and Seedance 2.5 Flash
   through the production MCP using existing consent. Record the exact host and
   client version. Do not quote or generate to test authentication.
5. In a dedicated fixture/account, prove revocation denies the old session and
   reapproval permits only the new one. Do not revoke the user's active grants.

`tests/mcp-oauth-session-validation.test.ts` covers HTTP routing and fail-closed
parsing. `tests/mcp-oauth-grant-postgres.test.ts` runs the real SQL on disposable
PostgreSQL 17, including role permissions, ownership, time limits and scopes.
The installed-SDK fixture covers signed-token revocation/reapproval while the
delegated grants-list route returns 403. These local checks do not establish live
production recovery.

The old application can be restored independently while investigating a release
failure, although the old grants-list compatibility failure will remain. Remove
the function only after all new callers have been rolled back; it changes no
sessions or consent records and need not be removed to roll back application code.
