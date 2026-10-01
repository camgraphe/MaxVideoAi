# MaxVideoAI MCP onboarding investigation — 2026-10-01

## Customer failure and measured scope

The reported ChatGPT journey initially found the correct production MCP URL,
then encountered an existing account-owned entry named **MaxVideoAI Staging**.
The conversation continued with that entry and opened login on
`maxvideoai-mcp-staging.vercel.app`. The customer had a confirmed production
account with a password, but no staging account. The two Auth projects have
separate users. Correct website credentials therefore could not authenticate
in staging. The staging name identified a test entry; it was not evidence of a
public MaxVideoAI directory listing. No causal influence from ChatGPT memory
or the machine's previous MCP work was established.

Read-only staging Auth log aggregation covered 30 daily windows from
2026-09-01 12:27 UTC to 2026-10-01 12:27 UTC:

| Observation | Count and interpretation |
| --- | --- |
| Invalid password attempts | 5, all in the reported journey on October 1 |
| Other identical password failures | 0 observed in these returned windows |
| Confirmed blocked customers | 1; attempts are not five customers |
| Successful password logins | 3 on September 2 |
| OAuth authorization requests | 21 requests, not a distinct-person count |
| Missing refresh tokens | 5,824 from September 14 onward; separate stale-client issue |
| Server errors | 1 Auth HTTP 500; not assigned to this login failure |

The observations establish one blocked customer and do not support a revenue
loss or broader conversion-loss estimate. Edge and Auth log coverage differ;
their counts must not be combined. The failed authorization expired after ten
minutes. Resume installation from the client rather than reusing an old
authorization URL. No Auth users, secrets, credits or deployments were changed
during the investigation. Authorization IDs and raw credential-bearing URLs
are deliberately omitted from this record.

## Actual production onboarding checkpoint

Chrome private mode, ChatGPT web, existing owner ChatGPT account; no public
build number exposed. This was an isolated browser session, not a new ChatGPT
account.

1. Public directory search for MaxVideoAI returned no result, both anonymous
   and signed in.
2. A custom MCP app named **MaxVideoAI** was created with
   `https://api.maxvideoai.com/mcp` and OAuth. Automatic discovery selected the
   production authorization server without manual advanced-field edits.
3. The connection opened production MaxVideoAI login. The current deployed
   page incorrectly defaulted to account creation; switching to Sign in
   allowed the owner to enter credentials and approve consent directly.
4. ChatGPT returned with MaxVideoAI installed and connected. **Try in chat**
   opened a new conversation with MaxVideoAI selected.
5. A request limited to account status and three video models produced an
   account/model response. The visible activity reported checking the account
   and listing models. Raw tool arguments were not exposed, so no exact tool
   count or server-side trace claim is made. No quote, generation or payment
   was requested.

Fresh account creation, denial, paid generation, references, media rendering,
refresh, revocation and reconnect were not exercised. The existing full-host
registry status is therefore retained; this is onboarding evidence, not a
full-lifecycle promotion or a public listing.

## Implemented correction

- Consent redirects explicitly select sign-in. Legacy consent links also select
  sign-in when no valid explicit mode is provided. General login retains its
  existing account-creation default; explicit signup/reset remain available.
- The first render explains connecting the existing MaxVideoAI account,
  reviewing access and returning to the assistant, in EN/FR/ES.
- Failed OAuth sign-in retains sign-in. Invalid credentials offer password
  recovery or the original Google sign-in method; other provider errors retain
  their specific message. The flow does not infer that an account is absent.
- The known staging host displays a separate-account warning and a production
  setup link. It never forwards a staging authorization ID to production.
- Installation requests name the production endpoint and the correct host
  setup mechanism, reject a Staging entry, keep credentials in the browser,
  and start with read-only account/model verification.

The consent authorization, scopes, approval, redirect validation, payments and
generation confirmation boundaries are preserved. Shared authorization-ID
validation lives in the browser-safe `src/lib/mcp-oauth-continuation.ts`; the
server consent module retains its public validation export.

## Client-specific installation boundaries

| Client | Setup and what the assistant can do |
| --- | --- |
| ChatGPT web | Custom MCP app in Plugins; Developer mode and workspace permission may be required. Chat can guide setup. A plain chat request does not itself register a custom connection. The user signs in and authorizes it, then selects MaxVideoAI in a new chat. |
| Claude remote connector | Customize → Connectors → Add custom connector, then Connect. Team/Enterprise owners add the organization connector before members authorize their own accounts. Enable it per conversation. This differs from local Desktop MCP configuration. |
| Claude Code | `claude mcp add --transport http maxvideoai https://api.maxvideoai.com/mcp`, then `/mcp` for browser authorization. A terminal-enabled agent can configure it with permission. No new live Claude Code checkpoint was run. |
| Codex | Tagged plugin marketplace and plugin commands; the agent may run them with terminal access. Browser account authorization and a new task remain separate. Installed CLI 0.156.0 help confirms the command syntax; no plugin reinstall or release occurred. |
| OpenClaw | Remote Streamable HTTP server with OAuth, then `openclaw mcp login maxvideoai`. Shared versus per-requester identity must match the deployment. The existing tested-with-limits scope remains unchanged. |
| n8n | Manually configure the workflow and OAuth2 credential on the deterministic MCP Client nodes. A copied chat instruction is not a one-click workflow install. Existing evidence is limited to self-hosted 2.38.7; MCP Client Tool/AI Agent and Cloud are separate unverified paths. |

Primary references checked on October 1:
[ChatGPT custom MCP setup](https://developers.openai.com/plugins/deploy/connect-chatgpt),
[ChatGPT workspace availability](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt),
[Claude remote connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp),
[Claude Code MCP](https://code.claude.com/docs/en/mcp),
[OpenClaw OAuth](https://docs.openclaw.ai/cli/mcp/transports),
[n8n MCP Client](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-langchain.mcpclient/).

## Distribution review

The installation fixes do not create a store entry or force another assistant
to offer an installation card. Directory distribution follows each platform's
review rules. The existing-account exception in OpenAI's current policy needs
an explicit review against prepaid-credit generation and `create_topup_link`.
Anthropic's current policy still excludes standalone AI media generation.
The dated policy review and concrete production listing target are recorded in
[`mcp-directory-submissions.md`](../marketing/mcp-directory-submissions.md).

## Isolation and validation

Implementation is isolated from the busy checkout in managed worktree
`mcp-onboarding-production`, branch
`codex/mcp-onboarding-production-20261001`, based on commit
`20b8b28ef908c989f193b28719f8b59059ffca8e`. No unrelated uncommitted work was
copied. Tests and local builds use existing dependency directories read-only;
build output belongs to this worktree. Browser validation uses synthetic local
OAuth IDs and a dummy loopback Auth endpoint, not production credentials.

The three new mode/return/context regressions failed before the correction.
The initial isolated baseline passed 29 tests. Final focused Auth and MCP
marketing validation passed **155 tests**, including first-render, legacy-link,
unsafe-return, staging-warning, registry, acquisition and SEO contracts.
Frontend lint, TypeScript, exposure checks, message parity and `git diff --check`
passed. A production build, its prebuild guards and sitemap generation passed
with the dummy loopback Auth configuration.

Chrome verified the corrected French first render, a synthetic
`invalid_credentials` response, retained sign-in, password-recovery navigation
and return, the staging warning, and the expanded ChatGPT installation request.
At 390 × 844, the login and warning had no horizontal overflow. The Auth stub
and staging-header proxy were bound to loopback; no real credentials were sent
and no password-reset email or production Auth attempt was created. Console
inspection showed extension-origin errors and the expected missing local cookie
policy warning; no new auth-render or hydration error was observed.

HTTP checks passed on **16 public owners** with canonical, reciprocal
hreflang, robots, JSON-LD, single-main and installation-action checks. The five
Spanish `/es/integraciones/*` routes returned a self-redirect in this local
production server, as did the unrelated existing `/es/precios` route. Direct
middleware evaluation returns the correct rewrite with HTTP 200, and the
unchanged deployed Spanish ChatGPT page is readable; the local server cause
has not been established. Routing files were not changed. EN/FR/ES component
contracts and Auth HTTP first-render/staging checks pass, but **the complete
localized HTTP smoke remains incomplete**. Resolve or reproduce this harness
issue in the deployment preview before merging under the integration guide.

Local proof captures: `/tmp/maxvideoai-mcp-signin-recovery-20261001.png`,
`/tmp/maxvideoai-mcp-signin-mobile-20261001.png`,
`/tmp/maxvideoai-mcp-staging-warning-20261001.png`, and
`/tmp/maxvideoai-mcp-chatgpt-guide-20261001.png`. The HTTP result file is
`/tmp/maxvideoai-onboarding-http-smoke.json`. No merge, deployment, catalog
submission, release tag or plugin reinstall was performed.
