# MaxVideoAI Hosted MCP Staging and Claude Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy an isolated HTTPS MaxVideoAI MCP staging environment, authenticate it with a separate Supabase OAuth 2.1 project, and validate the complete connector lifecycle in Claude Desktop and Codex without touching production data or enabling production MCP flags.

**Architecture:** A dedicated Vercel project named `maxvideoai-mcp-staging` owns the stable HTTPS application/MCP origin. A separate Supabase project owns staging-only users, OAuth clients, grants, and tokens. A short-lived Neon branch supplies only the schema needed by account status and privacy-safe MCP audit events; it contains no production data. Static production flags remain false, while a fail-closed staging override requires an exact non-production host.

**Tech Stack:** Next.js 15 App Router, TypeScript, Vercel, Supabase Auth OAuth 2.1/PKCE, Neon Postgres branches, MCP Streamable HTTP, Claude Desktop custom connectors, Codex CLI.

## Global Constraints

- Keep `FEATURES.mcp.transport`, `FEATURES.mcp.oauth`, `FEATURES.mcp.discovery`, `paidGeneration`, `trial`, and `referenceUploads` false.
- Never enable OAuth Server or dynamic registration on the existing production Supabase project during this plan.
- Never copy production Supabase users, sessions, OAuth grants, Storage objects, or Neon rows into staging.
- Use `maxvideoai-mcp-staging.vercel.app` as the stable staging origin; if Vercel reports that the name is unavailable, stop before creating another project name because every OAuth and environment value depends on the final host.
- The staging runtime gate must reject `maxvideoai.com`, `www.maxvideoai.com`, and `api.maxvideoai.com` even if staging environment variables are accidentally set there.
- The staging Vercel deployment must be public for Claude Desktop through the staging project's Deployment Protection setting, but send `X-Robots-Tag: noindex, nofollow, noarchive` and must not install any production cron schedule. Do not change Deployment Protection on the production project.
- Treat the final Supabase project creation, Vercel project creation, custom Claude connector creation, OAuth approval, and any paid-plan choice as external state changes requiring action-time confirmation.
- Prefer the second Free Supabase project slot. Stop if the dashboard proposes a paid upgrade instead of a `$0` Free project.
- Do not print, commit, paste into documentation, or expose Supabase secret keys, database passwords, Neon connection strings, OAuth codes, access tokens, or refresh tokens.
- Staging completion does not authorize production rollout, directory submission, public marketing, trial credit, provider calls, or wallet mutation.

---

## Task 1: Add a fail-closed hosted staging runtime gate

**Files:**

- Modify: `frontend/src/lib/env.ts`
- Modify: `frontend/src/server/mcp/feature-access.ts`
- Modify: `frontend/src/server/mcp/config.ts`
- Create: `tests/mcp-staging-enablement.test.ts`
- Modify: `tests/mcp-config.test.ts`

**Interfaces:**

- Consumes: `resolveMcpConfig(env)` and the existing static/local MCP rollout checks.
- Produces: `MCP_STAGING_ENABLED`, `MCP_STAGING_HOST`, and staging-aware `McpConfig.accountUrl` behavior.

- [ ] **Step 1: Write failing staging-gate tests**

Create `tests/mcp-staging-enablement.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { isMcpFoundationFeatureEnabled } from '../frontend/src/server/mcp/feature-access';

const stagingEnv = {
  NODE_ENV: 'production',
  MCP_STAGING_ENABLED: 'true',
  MCP_STAGING_HOST: 'maxvideoai-mcp-staging.vercel.app',
  MCP_API_HOST: 'maxvideoai-mcp-staging.vercel.app',
  MCP_RESOURCE_URL: 'https://maxvideoai-mcp-staging.vercel.app/mcp',
};

test('hosted staging enables only foundation features on the exact staging host', () => {
  assert.equal(isMcpFoundationFeatureEnabled('transport', stagingEnv), true);
  assert.equal(isMcpFoundationFeatureEnabled('oauth', stagingEnv), true);
  assert.equal(isMcpFoundationFeatureEnabled('discovery', stagingEnv), true);
});

test('hosted staging fails closed for missing, mismatched, insecure, and production hosts', () => {
  assert.equal(isMcpFoundationFeatureEnabled('transport', { ...stagingEnv, MCP_STAGING_ENABLED: 'false' }), false);
  assert.equal(isMcpFoundationFeatureEnabled('transport', { ...stagingEnv, MCP_API_HOST: 'other.vercel.app' }), false);
  assert.equal(isMcpFoundationFeatureEnabled('transport', { ...stagingEnv, MCP_RESOURCE_URL: 'http://maxvideoai-mcp-staging.vercel.app/mcp' }), false);

  for (const host of ['maxvideoai.com', 'www.maxvideoai.com', 'api.maxvideoai.com']) {
    assert.equal(
      isMcpFoundationFeatureEnabled('transport', {
        ...stagingEnv,
        MCP_STAGING_HOST: host,
        MCP_API_HOST: host,
        MCP_RESOURCE_URL: `https://${host}/mcp`,
      }),
      false
    );
  }
});
```

- [ ] **Step 2: Add a failing staging account URL assertion**

Append to `tests/mcp-config.test.ts`:

```ts
test('hosted non-production MCP config keeps account handoff on its own origin', () => {
  const config = resolveMcpConfig({
    NODE_ENV: 'production',
    MCP_API_HOST: 'maxvideoai-mcp-staging.vercel.app',
    MCP_RESOURCE_URL: 'https://maxvideoai-mcp-staging.vercel.app/mcp',
  });
  assert.equal(
    config.accountUrl,
    'https://maxvideoai-mcp-staging.vercel.app/account/connections'
  );
});
```

- [ ] **Step 3: Run the focused tests and confirm the red state**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-staging-enablement.test.ts \
  tests/mcp-config.test.ts
```

Expected: FAIL because production mode currently ignores `MCP_STAGING_ENABLED` and always returns the production account URL.

- [ ] **Step 4: Add the server-only environment names**

Add to `ENV` in `frontend/src/lib/env.ts`:

```ts
MCP_STAGING_ENABLED: getOptionalEnv('MCP_STAGING_ENABLED', 'false'),
MCP_STAGING_HOST: getOptionalEnv('MCP_STAGING_HOST'),
```

- [ ] **Step 5: Implement the exact-host staging override**

Update `frontend/src/server/mcp/feature-access.ts` with this helper and call it after the static-flag check but before the local-development check:

```ts
const PRODUCTION_HOSTS = new Set([
  'maxvideoai.com',
  'www.maxvideoai.com',
  'api.maxvideoai.com',
]);

function isHostedStagingEnabled(env: FeatureEnv): boolean {
  if (env.NODE_ENV !== 'production' || env.MCP_STAGING_ENABLED !== 'true') return false;
  const allowedHost = env.MCP_STAGING_HOST?.trim().toLowerCase();
  if (!allowedHost || PRODUCTION_HOSTS.has(allowedHost)) return false;

  try {
    const config = resolveMcpConfig(env);
    const resource = new URL(config.resourceUrl);
    return (
      resource.protocol === 'https:' &&
      resource.host.toLowerCase() === allowedHost &&
      config.apiHost.toLowerCase() === allowedHost
    );
  } catch {
    return false;
  }
}
```

The exported function becomes:

```ts
export function isMcpFoundationFeatureEnabled(
  feature: McpFoundationFeature,
  env: FeatureEnv = process.env
): boolean {
  if (FEATURES.mcp[feature]) return true;
  if (isHostedStagingEnabled(env)) return true;
  if (env.NODE_ENV === 'production' || env.MCP_LOCAL_ENABLED !== 'true') return false;

  try {
    resolveMcpConfig(env);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 6: Make account handoff origin-aware**

Replace the `accountUrl` assignment in `frontend/src/server/mcp/config.ts` with:

```ts
const accountUrl =
  parsed.origin === 'https://api.maxvideoai.com'
    ? PRODUCTION_ACCOUNT_URL
    : `${parsed.origin}/account/connections`;
```

- [ ] **Step 7: Run the focused and complete MCP suites**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-staging-enablement.test.ts \
  tests/mcp-config.test.ts \
  tests/mcp*.test.ts
```

Expected: all tests pass; the static paid/trial/upload flags remain false.

- [ ] **Step 8: Commit the staging gate**

```bash
git add \
  frontend/src/lib/env.ts \
  frontend/src/server/mcp/feature-access.ts \
  frontend/src/server/mcp/config.ts \
  tests/mcp-staging-enablement.test.ts \
  tests/mcp-config.test.ts
git commit -m "feat: add fail-closed MCP staging gate"
```

## Task 2: Add a staging-only Vercel deployment contract

**Files:**

- Create: `frontend/vercel.mcp-staging.json`
- Create: `tests/mcp-staging-vercel-config.test.ts`

**Interfaces:**

- Consumes: Vercel CLI `--local-config`.
- Produces: a deployment file that guarantees only a global `X-Robots-Tag: noindex, nofollow, noarchive` header and the absence of scheduled production jobs.
- Does not configure public or anonymous access. Deployment Protection is a project-level responsibility handled only for `maxvideoai-mcp-staging` in Task 5 and proven by the anonymous `curl` in Task 6.

- [ ] **Step 1: Write the failing configuration test**

Create `tests/mcp-staging-vercel-config.test.ts`:

```ts
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

test('MCP staging Vercel config has no crons and blocks indexing', () => {
  const path = join(process.cwd(), 'frontend/vercel.mcp-staging.json');
  assert.equal(existsSync(path), true);
  const config = JSON.parse(readFileSync(path, 'utf8')) as {
    crons?: unknown[];
    headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
  };
  assert.equal(config.crons, undefined);
  assert.deepEqual(config.headers, [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
      ],
    },
  ]);
});
```

- [ ] **Step 2: Run the test and confirm it fails because the file is absent**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-staging-vercel-config.test.ts
```

- [ ] **Step 3: Create the staging-only Vercel config**

Create `frontend/vercel.mcp-staging.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Robots-Tag",
          "value": "noindex, nofollow, noarchive"
        }
      ]
    }
  ]
}
```

- [ ] **Step 4: Run the test and exposure checks**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-staging-vercel-config.test.ts
npm run lint:exposure
git diff --check
```

Expected: all commands exit `0`; no `crons` property exists in the staging config.

Task 2 is complete when the file and test prove the noindex/no-cron contract. It does not establish anonymous access; do not add a `public` property to this file as a substitute for the project-level Deployment Protection change in Task 5.

- [ ] **Step 5: Commit the deployment contract**

```bash
git add frontend/vercel.mcp-staging.json tests/mcp-staging-vercel-config.test.ts
git commit -m "build: isolate MCP staging deployment"
```

## Task 3: Create the isolated Free Supabase staging project

**Files:**

- Modify after successful setup: `docs/operations/mcp-staging-deployment.md`

**Interfaces:**

- Consumes: the stable staging origin `https://maxvideoai-mcp-staging.vercel.app`.
- Produces: a staging Supabase project URL, publishable key, OAuth discovery endpoint, and disposable verified user.

- [ ] **Step 1: Verify the zero-cost slot before creation**

Run the read-only project inventory:

```bash
supabase projects list --output json
```

Confirm the account owns fewer than two active Free projects. In the Supabase dashboard, confirm that creating `MaxVideoAI Staging` shows `$0` and does not request a Pro upgrade. Stop if the UI proposes a charge.

- [ ] **Step 2: Request action-time confirmation and create the project**

After confirmation, create a separate Free organization/project named `MaxVideoAI Staging` in the same broad region as the application. Generate a unique database password, store it only in the user's password manager or Supabase setup flow, and do not print it in terminal output.

- [ ] **Step 3: Configure staging Auth URLs**

In **Authentication → URL Configuration**, set:

```text
Site URL: https://maxvideoai-mcp-staging.vercel.app
Additional redirect URL: https://maxvideoai-mcp-staging.vercel.app/**
```

Do not add production URLs to this project.

- [ ] **Step 4: Enable the OAuth server only on staging**

In **Authentication → OAuth Server**, set:

```text
OAuth 2.1 Server: enabled
Authorization Path: /oauth/consent
Dynamic Client Registration: enabled
```

Verify that the production project still returns `404` for its OAuth authorization-server metadata.

- [ ] **Step 5: Verify asymmetric signing and OAuth discovery**

Set `SUPABASE_STAGING_URL` from the new project's API URL without echoing any key, then run:

```bash
curl --fail "$SUPABASE_STAGING_URL/.well-known/oauth-authorization-server/auth/v1"
curl --fail "$SUPABASE_STAGING_URL/auth/v1/.well-known/jwks.json"
```

Expected: both return JSON with HTTP `200`; the OAuth metadata contains authorization, token, registration, JWKS, and user-info endpoints. Confirm the JWKS exposes an asymmetric public key suitable for `openid` ID tokens.

- [ ] **Step 6: Create one disposable verified user**

Create `mcp-staging@maxvideoai.test` in **Authentication → Users** with a unique generated password and mark the email confirmed. Store the password outside the repository. Do not import any production user.

- [ ] **Step 7: Start the staging runbook without secrets**

Create `docs/operations/mcp-staging-deployment.md` with project name, region, stable public URLs, enabled/disabled feature states, and cleanup commands. Record neither the project secret key nor any credential.

## Task 4: Create an expiring Neon schema-only staging branch

**Files:**

- No repository file changes; existing migrations under `neon/migrations/` are applied to the isolated branch.

**Interfaces:**

- Consumes: `scripts/neon-branch-guard.mjs` and `scripts/apply-neon-migrations.sh`.
- Produces: a staging-only `DATABASE_URL` with empty application tables.

- [ ] **Step 1: Verify branch capacity**

```bash
npm run neon:branches:check
```

Expected: the branch count is within the configured limit. Stop if the guard fails.

- [ ] **Step 2: Create an automatically expiring schema-only branch**

Set the expiry to seven days from execution time and run:

```bash
NEON_EXPIRY=$(date -u -v+7d '+%Y-%m-%dT%H:%M:%SZ')
npx neonctl branches create \
  --project-id shy-flower-71253790 \
  --name preview/mcp-staging \
  --schema-only \
  --suspend-timeout 300 \
  --expires-at "$NEON_EXPIRY" \
  --output json
```

Expected: one non-primary branch named `preview/mcp-staging`; do not print its connection string.

- [ ] **Step 3: Retrieve the connection string into a shell variable**

```bash
DATABASE_URL=$(npx neonctl connection-string preview/mcp-staging \
  --project-id shy-flower-71253790 \
  --pooled \
  --ssl require)
export DATABASE_URL
```

Do not echo `DATABASE_URL`.

- [ ] **Step 4: Apply the existing application schema**

```bash
npm run db:migrate:neon
```

Expected: every repository migration, including `27_mcp_audit_events.sql`, applies only to `preview/mcp-staging`.

- [ ] **Step 5: Verify only the required empty tables**

```bash
psql "$DATABASE_URL" -Atc "select to_regclass('public.app_receipts'), to_regclass('public.mcp_audit_events');"
psql "$DATABASE_URL" -Atc "select count(*) from app_receipts;"
```

Expected: both table names are present and `app_receipts` contains `0` rows.

## Task 5: Create and configure the dedicated Vercel staging project

**Files:**

- No committed secret files; `.vercel/` remains ignored.

**Interfaces:**

- Consumes: Supabase staging URL/publishable key, Neon branch URL, and `frontend/vercel.mcp-staging.json`.
- Produces: `https://maxvideoai-mcp-staging.vercel.app`, with Deployment Protection disabled only on that dedicated staging project.

- [ ] **Step 1: Request action-time confirmation, capture the production baseline, and reserve the exact Vercel project name**

After confirmation, first use the Vercel Dashboard to locate the existing project that owns `maxvideoai.com`, copy its exact project name, then run `read -r PRODUCTION_VERCEL_PROJECT` and paste that name without quotes. Capture its read-only CLI baseline and record its current **Settings → Deployment Protection** value in temporary execution notes without saving any change:

```bash
read -r PRODUCTION_VERCEL_PROJECT
printf '%s\n' "$PRODUCTION_VERCEL_PROJECT" > /tmp/maxvideoai-production-project.name
vercel project inspect "$PRODUCTION_VERCEL_PROJECT" --no-color | tee /tmp/maxvideoai-production-project.before.txt
```

Then create and link only the dedicated staging project:

```bash
vercel project add maxvideoai-mcp-staging
vercel link --cwd frontend --yes --project maxvideoai-mcp-staging
```

Expected: Vercel assigns the production domain `maxvideoai-mcp-staging.vercel.app`. Stop if it assigns a different permanent domain.

- [ ] **Step 2: Disable Deployment Protection only on the dedicated staging project**

The action-time confirmation obtained in Step 1 also covers this immediate, staging-only project setting change. In the Vercel Dashboard, select the exact `maxvideoai-mcp-staging` project, open **Settings → Deployment Protection**, set Deployment Protection to **Off/None**, and save. Confirm Vercel Authentication and any other protection method are disabled for this project. Do not change the team default and do not open or modify Deployment Protection for the project serving `maxvideoai.com`.

This is a project-level Vercel setting, not a `vercel.json` responsibility. Do not add a `public` property to `frontend/vercel.mcp-staging.json` to represent anonymous MCP access.

- [ ] **Step 3: Add non-secret staging runtime variables to the Vercel production target**

Add each named value through `vercel env add NAME production` without placing it in a tracked file:

```text
MCP_STAGING_ENABLED=true
MCP_STAGING_HOST=maxvideoai-mcp-staging.vercel.app
MCP_API_HOST=maxvideoai-mcp-staging.vercel.app
MCP_RESOURCE_URL=https://maxvideoai-mcp-staging.vercel.app/mcp
NEXT_PUBLIC_SITE_URL=https://maxvideoai-mcp-staging.vercel.app
SUPABASE_SITE_URL=https://maxvideoai-mcp-staging.vercel.app
NEXT_PUBLIC_COOKIE_DOMAIN=
COOKIE_DOMAIN=
```

- [ ] **Step 4: Add secret or project-specific values without printing them**

Add the staging-only values to Vercel's production target with three interactive commands:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production --cwd frontend
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production --cwd frontend
vercel env add DATABASE_URL production --cwd frontend
```

At each prompt, paste respectively the value held in `SUPABASE_STAGING_URL`, the staging publishable/anonymous key, and the `preview/mcp-staging` pooled connection string. Never include the values in the shell command, logs, documentation, or Git.

- [ ] **Step 5: Confirm dangerous production credentials are absent**

Review only the variable names:

```bash
vercel env ls production --cwd frontend
```

Confirm the staging project has no Stripe live secret, provider generation key, production Supabase secret/service-role key, production Neon URL, SMTP credential, or cron secret.

- [ ] **Step 6: Run the complete local gate**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp*.test.ts
pnpm --prefix frontend exec tsc --noEmit -p tsconfig.json
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
pnpm --prefix frontend run build
```

Expected: tests and build pass; lint has zero errors. Existing unrelated warnings must be listed rather than changed in this branch.

- [ ] **Step 7: Verify the isolated staging package without contacting Vercel**

Commit the exact revision to deploy and require a clean worktree. From the
repository root run:

```bash
bash scripts/deploy-mcp-staging-vercel.sh --dry-run
```

Before it can print `SAFE_PACKAGE_OK`, the wrapper rejects staged, tracked, or
untracked worktree changes. It then exports tracked `HEAD` to a temporary repo-root tree so
`packages/pricing` is present. It makes
`frontend/vercel.mcp-staging.json` the effective temporary
`frontend/vercel.json`, then asserts that the config has no cron list and has
the exact global `X-Robots-Tag: noindex, nofollow, noarchive` header. It never
modifies the real tracked `frontend/vercel.json`.

Expected: one sanitized `SAFE_PACKAGE_OK` line naming only the exact staging
project, scope, and short commit. Do not continue if the worktree revision is
not the revision approved for staging.

- [ ] **Step 8: Deploy and verify an unaliased production-target candidate**

Use only the reviewed wrapper; do not invoke Vercel deployment directly:

```bash
bash scripts/deploy-mcp-staging-vercel.sh
```

The wrapper performs these operations in order:

1. captures sanitized settings, domains, and Deployment Protection baselines
   for the read-only `maxvideoai` production project;
2. asserts exact scope `camgraphes-projects`, exact project
   `maxvideoai-mcp-staging`, and distinct project IDs;
3. links only the isolated temporary tree to the staging project;
4. creates a production-target candidate with `--prod --skip-domain`, leaving
   the existing stable alias untouched, and sets sanitized deployment metadata
   `mcpApprovedGitSha` to the exact full commit SHA plus
   `mcpTrackedArchiveSha256` to the SHA-256 digest of `git archive HEAD`;
5. waits for `READY` and verifies through the deployment API that the candidate
   belongs to the staging project, has an empty cron list, and has both exact
   provenance values matching the current clean approved `HEAD`;
6. verifies the direct candidate URL is anonymous and carries the exact global
   noindex header.

Any failure before promotion exits with the existing stable alias unchanged.
Do not bypass a failed candidate check and do not redeploy by hand.

If a READY unaliased candidate must be resumed, run
`bash scripts/deploy-mcp-staging-vercel.sh --candidate dpl_ID` only from the
same clean approved revision. The resume path must fetch the candidate API
metadata and fail before promotion when `mcpApprovedGitSha` or
`mcpTrackedArchiveSha256` is missing or differs; project, readiness, cron, and
header checks alone are insufficient provenance.

- [ ] **Step 9: Promote only the accepted candidate and prove isolation**

The same wrapper calls `vercel promote` only after every Step 8 gate passes.
It then verifies that:

- `https://maxvideoai-mcp-staging.vercel.app` resolves to the exact accepted
  candidate;
- the stable response is anonymous and has the exact global noindex header;
- protected-resource metadata identifies the stable staging MCP resource and
  staging Supabase authorization server;
- anonymous MCP initialization returns application HTTP `401`, private
  no-store caching, and the RFC 9728 metadata challenge;
- the production project's normalized settings, domains, and Deployment
  Protection are unchanged from the pre-deploy baseline.

Expected: a final sanitized `SAFE_DEPLOY_OK` line. The wrapper's trap removes
the temporary checkout, local Vercel link, downloaded OIDC material, and
verification artifacts. No environment-variable value is printed or copied.

## Task 6: Verify hosted OAuth and MCP without an LLM host

**Files:**

- Modify: `docs/operations/mcp-staging-deployment.md`

**Interfaces:**

- Consumes: deployed Vercel and Supabase staging origins.
- Produces: protocol evidence before any persistent Claude connector is created.

- [ ] **Step 1: Verify protected-resource discovery**

```bash
curl --fail https://maxvideoai-mcp-staging.vercel.app/.well-known/oauth-protected-resource/mcp
```

Expected resource and authorization server:

```json
{
  "resource": "https://maxvideoai-mcp-staging.vercel.app/mcp",
  "authorization_servers": ["$SUPABASE_STAGING_URL/auth/v1"]
}
```

- [ ] **Step 2: Verify the unauthenticated MCP challenge as the public-access proof**

```bash
curl -i -X POST https://maxvideoai-mcp-staging.vercel.app/mcp \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"staging-smoke","version":"1.0"}}}'
```

This request sends no Vercel authentication cookie, share link, or protection-bypass credential. Expected: a direct application HTTP `401`, private no-store caching, and a `WWW-Authenticate` resource-metadata link on the staging host. A redirect to Vercel login or a Vercel Deployment Protection response fails the public-access requirement.

- [ ] **Step 3: Verify production remains disabled**

```bash
curl -o /dev/null -sS -w '%{http_code}\n' https://api.maxvideoai.com/mcp
curl -o /dev/null -sS -w '%{http_code}\n' https://api.maxvideoai.com/.well-known/oauth-protected-resource/mcp
```

Expected: production MCP/discovery remain unavailable according to the existing rollout state; do not change production variables or flags to alter the result.

- [ ] **Step 4: Record sanitized evidence**

Add HTTP status, cache policy, resource URL, authorization-server host, and test date to `docs/operations/mcp-staging-deployment.md`. Do not paste full response headers if they contain request IDs or cookies.

## Task 7: Validate Claude Desktop and Codex against HTTPS staging

**Files:**

- Modify: `docs/operations/mcp-host-compatibility-matrix.md`
- Modify: `docs/operations/mcp-staging-deployment.md`

**Interfaces:**

- Consumes: public HTTPS staging MCP and disposable staging user.
- Produces: host compatibility, scope, tool-call, revocation, and reconnect evidence.

- [ ] **Step 1: Request action-time confirmation before creating the persistent Claude connector**

In Claude Desktop, navigate to **Settings → Connectors → Add connector → Add custom connector** and prepare:

```text
Name: MaxVideoAI Staging
Remote MCP server URL: https://maxvideoai-mcp-staging.vercel.app/mcp
OAuth Client ID: empty
OAuth Client Secret: empty
```

After confirmation, click **Add**.

- [ ] **Step 2: Authenticate with the disposable staging user**

Expected flow:

```text
Claude Desktop
→ Supabase staging authorization endpoint
→ MaxVideoAI staging login
→ /oauth/consent
→ explicit openid/email/profile approval
→ Claude Desktop callback
```

Reject the flow if it reaches production MaxVideoAI, production Supabase, requests an unreviewed scope, or does not display the redirect URI.

- [ ] **Step 3: Call all read-only tools from Claude Desktop**

Use one conversation with these exact requests:

```text
Use MaxVideoAI Staging to list the public video and image models. Return only the total and the first three IDs.
Use MaxVideoAI Staging to recommend up to three text-to-video models for a 16:9 cinematic clip with audio.
Use MaxVideoAI Staging to show my account status. Do not reveal my email address.
```

Expected: `list_models` returns the public catalog, `recommend_models` returns deterministic factual trade-offs, and `get_account_status` returns a zero-dollar staging wallet with no email address.

- [ ] **Step 4: Verify prompt/reference assistance remains host-owned**

Ask Claude:

```text
Draft a strong text-to-video prompt and propose a reference-image plan before choosing a MaxVideoAI model. Do not generate or submit media.
```

Expected: Claude drafts the creative material itself, may query model capabilities, and cannot call generation, upload, quote, wallet, or trial tools.

- [ ] **Step 5: Verify revocation and reconnect**

Open:

```text
https://maxvideoai-mcp-staging.vercel.app/account/connections
```

Disconnect `Claude Desktop`, verify the connector loses authentication, then reconnect and confirm a new explicit approval is required.

- [ ] **Step 6: Register and test Codex against the same HTTPS endpoint**

```bash
npx --yes @openai/codex@latest mcp add \
  --url https://maxvideoai-mcp-staging.vercel.app/mcp \
  maxvideoai-staging
npx --yes @openai/codex@latest mcp login maxvideoai-staging
```

Run one constrained `list_models` call and record its returned count. Verify the consent page displays every requested scope; keep the known Codex/Supabase `phone` scope mismatch marked as a production blocker if it recurs.

- [ ] **Step 7: Update the compatibility matrix and commit evidence**

Record exact Claude Desktop and Codex versions, scopes, OAuth result, tool calls, revocation result, and known limitations. Then commit only sanitized documentation:

```bash
git add \
  docs/operations/mcp-host-compatibility-matrix.md \
  docs/operations/mcp-staging-deployment.md
git commit -m "docs: record hosted MCP staging compatibility"
```

## Task 8: Close the staging gate without enabling production

**Files:**

- Modify if needed: `docs/operations/mcp-staging-deployment.md`

**Interfaces:**

- Consumes: all hosted smoke evidence.
- Produces: an explicit keep-or-destroy decision and a clean branch.

- [ ] **Step 1: Run the final repository verification**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp*.test.ts
pnpm --prefix frontend exec tsc --noEmit -p tsconfig.json
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
pnpm --prefix frontend run build
git status --short
```

Expected: all MCP tests and the build pass, lint has zero errors, and only intentional documentation changes remain before the final evidence commit.

- [ ] **Step 2: Confirm production isolation**

Verify:

```text
Production Supabase OAuth Server: disabled
Production dynamic registration: disabled
Static MCP transport/oauth/discovery flags: false
Paid generation/trial/reference upload flags: false
Production Vercel project variables: unchanged
Production Neon primary branch: unchanged
```

- [ ] **Step 3: Present the cost/state decision**

Offer exactly these choices:

```text
Keep staging: retain the second Free Supabase project, dedicated Vercel project, and expiring Neon branch for continued host QA.
Destroy staging: remove Claude/Codex staging connections, delete the Vercel project, delete the Supabase staging project, and allow the Neon branch to expire or delete it explicitly.
```

Do not delete cloud resources without action-time confirmation.

- [ ] **Step 4: Keep production launch as a separate plan**

Even if every staging check passes, leave production disabled. Production rollout requires a separate reviewed plan covering the Codex `phone` scope policy, public `/mcp` acquisition page, SEO/GEO schema and content, trial abuse controls, paid generation confirmation, observability, support, and rollback.

## Completion Criteria

- Task 2's file contract supplies noindex headers and no staging crons only; Task 5 disables Deployment Protection only on `maxvideoai-mcp-staging`, and Task 6's credential-free `curl` proves `https://maxvideoai-mcp-staging.vercel.app/mcp` is publicly reachable as an HTTPS Streamable HTTP MCP endpoint.
- Supabase staging—not production—owns all test users, OAuth clients, grants, access tokens, refresh tokens, and dynamic registration.
- Claude Desktop completes discovery, login, consent, all three read-only calls, revocation, and reconnect.
- Codex completes hosted discovery, consent, and at least one authenticated read-only call, with its requested scopes recorded.
- The staging Neon branch contains schema only, returns a zero wallet for the disposable user, and expires automatically.
- No generation, reference upload, quote, trial credit, provider call, wallet debit, payment, or production flag is reachable.
- Production Supabase, Vercel, Neon, and MCP rollout state are unchanged.
