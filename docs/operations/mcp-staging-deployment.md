# MCP staging deployment

This runbook describes the disposable, public staging environment used to
validate the MaxVideoAI MCP integration with Claude Desktop and other remote
MCP clients. It is deliberately isolated from production.

## Supabase Auth project

| Setting | Staging value |
| --- | --- |
| Project | `MaxVideoAI Staging` |
| Project reference | `gecrywjztpbwbrlnomti` |
| Region | `us-east-1` |
| Plan | Free (`$0`) |
| Application origin | `https://maxvideoai-mcp-staging.vercel.app` |
| Supabase API origin | `https://gecrywjztpbwbrlnomti.supabase.co` |
| Site URL | `https://maxvideoai-mcp-staging.vercel.app` |
| Additional redirect URL | `https://maxvideoai-mcp-staging.vercel.app/**` |

Supabase is used for staging authentication only. Do not apply application
schema migrations, import production users, or add a production URL to this
project. The application database is hosted separately in an expiring Neon
branch.

The public publishable key is retrieved at deployment time and stored in the
dedicated Vercel staging project's environment. Do not commit a literal key.
Never expose or copy a Supabase secret key or legacy `service_role` key into a
client environment.

## OAuth 2.1 state

The staging project has the following Auth features enabled:

- OAuth 2.1 authorization code flow with PKCE
- authorization path `/oauth/consent`
- dynamic client registration for MCP-compatible clients
- ES256 (P-256) JWT signing, so `openid` ID tokens and public JWKS validation
  work without sharing a signing secret

The following endpoints must return HTTP `200`:

```text
https://gecrywjztpbwbrlnomti.supabase.co/.well-known/oauth-authorization-server/auth/v1
https://gecrywjztpbwbrlnomti.supabase.co/auth/v1/.well-known/jwks.json
```

Discovery must advertise authorization, token, registration, JWKS, and
UserInfo endpoints. The JWKS must expose an asymmetric `ES256` key. The known
production Supabase project's OAuth discovery endpoint must continue returning
HTTP `404` until a separately reviewed production rollout.

## Disposable user

The only manually provisioned staging user is
`mcp-staging@maxvideoai.test`. Its email is confirmed. The unique password is
stored outside this repository in the local macOS Keychain under the service
`MaxVideoAI Staging Supabase User`.

Do not import or reuse a production account. Rotate or recreate the disposable
user before a shared testing session if its credential may have been exposed.

## Free-plan operating constraint

Supabase may pause a Free project after roughly seven days of low activity.
Before an MCP validation session, confirm that the project is
`ACTIVE_HEALTHY` and resume it from the Supabase dashboard if necessary. A
paused Free project is restorable for up to 90 days. No paid upgrade is
authorized for this staging environment.

## Vercel staging project

The hosted application is isolated in the Vercel project
`maxvideoai-mcp-staging`. Its project root is `frontend`, it uses Node.js
22.x, and its stable public origin is:

```text
https://maxvideoai-mcp-staging.vercel.app
```

Vercel Authentication is disabled only for this dedicated project so MCP
clients can reach the application-level OAuth challenge anonymously. Git fork
protection and the normal skew-protection setting remain enabled. The project
serving `maxvideoai.com` is a different project and must stay read-only during
staging operations.

Only these application variables belong in the staging project's Production
target:

```text
DATABASE_URL
MCP_API_HOST
MCP_RESOURCE_URL
MCP_STAGING_ENABLED
MCP_STAGING_HOST
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SITE_URL
```

`DATABASE_URL` must identify the pooled endpoint for the exact Neon branch
`preview/mcp-staging`. The Supabase variables must identify the project
documented above. Vercel does not accept empty environment-variable values, so
`COOKIE_DOMAIN` and `NEXT_PUBLIC_COOKIE_DOMAIN` are intentionally absent; the
application treats absence as an unset, host-only cookie domain.

Do not add provider keys, Stripe secrets, a Supabase secret or legacy
`service_role` key, SMTP credentials, `CRON_SECRET`, or any production
database URL to this project.

### Deployment packaging guard

The application depends on the repository-local package
`packages/pricing`, so a CLI deployment must upload the repository root while
Vercel builds the `frontend` project root. Uploading only `frontend` produces
an incomplete build.

Vercel also resolves deployment configuration from the effective project-root
`frontend/vercel.json`. With this monorepo layout, passing
`--local-config frontend/vercel.mcp-staging.json` from the repository root was
not sufficient: Vercel used the production config, including its cron list.
The current staging deployment was therefore produced with
`frontend/vercel.mcp-staging.json` as the effective project-root config and was
verified after stable-alias assignment to contain zero cron registrations.

Do not run a generic `vercel deploy --prod` against this linked staging
project. Before any later staging deployment, use a reviewed packaging step in
an isolated checkout that makes `frontend/vercel.mcp-staging.json` the
effective `frontend/vercel.json`, then verify the resulting deployment through
the Vercel API before accepting its stable alias. The acceptance conditions
are all mandatory:

- the deployment belongs to `maxvideoai-mcp-staging`;
- its cron list is empty;
- every response includes `X-Robots-Tag: noindex, nofollow, noarchive`;
- the stable alias resolves directly without Vercel Authentication;
- the production `maxvideoai` project and protection settings are unchanged.

## Verification

Run these checks without printing any API key:

```bash
SUPABASE_STAGING_URL='https://gecrywjztpbwbrlnomti.supabase.co'

curl --fail --silent --show-error \
  "$SUPABASE_STAGING_URL/.well-known/oauth-authorization-server/auth/v1" \
  | jq '{authorization_endpoint, token_endpoint, registration_endpoint, jwks_uri, userinfo_endpoint}'

curl --fail --silent --show-error \
  "$SUPABASE_STAGING_URL/auth/v1/.well-known/jwks.json" \
  | jq '{keys: [.keys[] | {kty, alg, use, kid, crv}]}'

supabase projects list --output json \
  | jq '.[] | select(.id == "gecrywjztpbwbrlnomti") | {name, region, status}'
```

Expected results:

- the project is named `MaxVideoAI Staging`, is in `us-east-1`, and is healthy;
- discovery exposes the five required endpoints;
- JWKS exposes a public EC key with `alg` equal to `ES256`;
- no production project setting or user has changed.

## Cleanup

When the hosted MCP test environment is no longer required:

1. Remove the dedicated Vercel project and its staging-only environment
   variables.
2. Delete the expiring Neon staging branch if it has not already expired.
3. Delete the Supabase project after confirming its reference is exactly
   `gecrywjztpbwbrlnomti`:

   ```bash
   supabase projects delete gecrywjztpbwbrlnomti
   ```

4. Remove the staging organization from the Supabase dashboard once it is
   empty.
5. Remove the two local Keychain entries:

   ```bash
   security delete-generic-password \
     -s 'Supabase Database Password' \
     -a 'MaxVideoAI Staging'

   security delete-generic-password \
     -s 'MaxVideoAI Staging Supabase User' \
     -a 'mcp-staging@maxvideoai.test'
   ```

All cleanup operations are destructive. Reconfirm the staging project,
organization, and branch identifiers immediately before running them.
