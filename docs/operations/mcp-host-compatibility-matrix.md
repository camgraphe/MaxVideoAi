# MaxVideoAI MCP host compatibility matrix

Last hosted checkpoint: 2026-08-27

Marketing pages project their integration identity, host labels, checkpoint dates,
and status facts from `frontend/config/mcp-integrations.json`. This matrix remains
the owner of detailed tested-host evidence, exact versions, exercised behavior,
limitations, and explicit non-claims.

## Production checkpoint

- Origin: `https://api.maxvideoai.com/mcp`
- Vercel deployment: `dpl_Gf2b6Q5KHFvpRcuqYfHsHdt6YjNQ`
- Git revision: `65522be9`
- Publication: transport, OAuth, discovery, paid generation, reference uploads,
  public marketing, and indexing enabled; introductory trial disabled
- Operational profile: 14 tools, including the app-only fresh-download helper

Codex CLI `0.150.0-alpha.8` registered the production endpoint under a disposable
client name, discovered OAuth, opened browser authorization automatically, and
completed account, catalogue, model-detail, recommendation, comparable-budget,
exact-quote, recent-generation, status-recovery, and result-presentation calls.
The disposable local MCP entry was removed after the installation check without
changing the existing MaxVideoAI connections.

One explicitly approved Luma Ray 3.2 image-to-video quote charged `$0.62`, was
accepted after approximately 51 seconds without a gateway timeout, completed,
and was saved to the connected production library. The MCP Apps v4 resource
advertised native video, image, download, library, and workspace behavior; the
returned output, preview, and thumbnail origins all accepted byte-range requests.
The final production wallet was `$14.31` with no pending amount. Direct ChatGPT
web custom-app and Claude Code production checks remain unrecorded and are not implied
by this Codex evidence.

This matrix separates verified staging behavior from production and directory
claims. The controlled environment is public on the internet but isolated from
production, noindexed, and restricted to its disposable staging account.

## Reviewed staging revision

- Stable origin: `https://maxvideoai-mcp-staging.vercel.app`
- Deployment: `dpl_3i6XgnZ6KVCZmQPhhKBrHDVrm1TD`
- Git revision: `621881dae621e9aec1d68a2a86f5065c6325cdb8`
- Transport: MCP Streamable HTTP with stateless JSON responses
- Authentication: OAuth 2.1 authorization code with PKCE through the isolated
  MaxVideoAI Staging Supabase Auth project
- Operational profile: 13 authenticated tools
- Provider boundary: Seedance 2.5 uses ModelArk for `t2v`, `i2v`, `ref2v`, and
  `extend`; LAS and direct `v2v` remain disabled

The 13-tool profile contains `get_account_status`, `list_models`,
`get_model_details`, `recommend_models`, `calculate_project_budget`,
`list_media`, `create_reference_upload_link`, `prepare_generation`,
`confirm_generation`, `get_generation_status`, `list_recent_generations`,
`present_generation`, and `create_topup_link`. It covers live model discovery, factual model details,
model recommendations, named project estimates, exact generation preparation,
confirmation, generation status and recovery, private media, private
reference-upload handoff, and a signed MaxVideoAI top-up handoff. Spending still
requires a separate explicit confirmation of a fresh quote.

The `present_generation` descriptor and its versioned MCP Apps resource are covered by local contracts. Claude Desktop 1.37937.1 rendered the completed-video card and native controls. A manual Play action changed the control to Pause during the controlled test; that interaction is recorded in the QA evidence but is not demonstrated by the published still image alone. Resource links and the MaxVideoAI library remain the universal fallback. ChatGPT inline rendering remains a separate, unrecorded host check.

## Compatibility matrix

| Host or surface | Hosted evidence | Status |
| --- | --- | --- |
| MCP TypeScript SDK 1.29.0 | Automated contracts cover initialization, tool discovery, schemas, annotations, authorization boundaries, and sanitized errors. | Contract pass. |
| Claude Desktop 1.37937.1 on macOS | Loaded the custom staging connector through OAuth; read account/catalog/model data; compared 60-second budgets; prepared an exact Seedance 2.5 quote; listed private media; recovered a completed generation; rendered and played that result inline; opened the first-party continuation CTA; created a private reference-upload handoff; and created a signed top-up handoff with an exact ISO expiry. | Controlled staging pass including inline playback. Refresh, revocation, reconnect, fresh uploaded bytes, and a newly successful paid generation remain to be recorded. |
| Codex CLI 0.149.0-alpha.4.3 on macOS | Loaded the installed MaxVideoAI plugin with an ephemeral staging URL override; completed OAuth-backed account, catalog, model-detail, budgeting, exact-quote, and top-up-handoff calls. The final wallet remained unchanged. | Historical controlled staging pass. Production was verified later with Codex CLI 0.150.0-alpha.8 as recorded above. A non-blocking MCP-client shutdown warning followed the staging turns. |
| Codex desktop / ChatGPT app surface | The bundled Codex CLI path and plugin package were exercised, but no fresh graphical Codex task or ChatGPT app-directory installation was recorded. | Partial; do not claim ChatGPT app-directory availability. |
| ChatGPT web custom app / full MCP | OpenAI currently documents full MCP for eligible Business and Enterprise/Edu workspaces on ChatGPT web; Pro access is limited to read/fetch. No MaxVideoAI submission, install, OAuth, action, or tool-rendering evidence has been recorded on this path. | Not run; do not claim host validation. |
| Claude Code | Shared Claude adapter and skill contracts exist, but this exact host was not exercised. | Not run. |
| Other MCP hosts | The wire contract is host-neutral, but each host still needs its own installation, OAuth, rendering, confirmation, and recovery evidence. | Unverified. |

## Ecosystem expansion source review

Checked: **2026-09-14**. The entries below pair current primary documentation
with any sanitized MaxVideoAI execution checkpoint. Untested paths remain
`not-run`; partial checkpoints are explicitly marked `tested-with-limits`.

| Host or surface | Current documented path | MaxVideoAI evidence and limitation |
| --- | --- | --- |
| OpenClaw Gateway | [OpenClaw MCP transports and OAuth](https://docs.openclaw.ai/cli/mcp/transports) documents saved remote Streamable HTTP servers, `auth: "oauth"`, login/logout, shared operator credentials, and optional per-requester identity. | **Tested-with-limits checkpoint (OpenClaw 2026.9.4, commit `3a9d69d`, on macOS 26.6.2; Streamable HTTP; 2026-09-13 Europe/Madrid).** Candidate `distribution/clawhub/maxvideoai/SKILL.md` SHA-256: `3b98acb659a339b944784256ec4c594531767d90b0dbc16a5caa7dc88eb7c0ca`. The digest was captured after the initial lifecycle: it identifies the retained candidate for the remaining checks but does not prove the bytes used during that lifecycle. A disposable profile connected to the branch-local endpoint through OAuth. Denial left protected tools unavailable with no job or wallet mutation. In the clean denial profile, the user also interrupted a login before browser approval; a later probe still reported authorization required, protected tools stayed unavailable, the token store count remained zero, and the process exited nonzero without an authenticated tool or paid call. After approval, the host discovered the filtered tools, read account and model data, requested recommendations, compared budgets, and prepared an exact quote without creating a job. One explicitly approved `$0.07` Seedance 1.5 Pro quote was confirmed exactly once and completed. A separate cold/lost-context session recovered the same accepted job through `list_recent_generations`, `get_generation_status`, and `present_generation` without a second `confirm_generation` or other paid call; the host exposed the MaxVideoAI library fallback but no inline media URL. With explicit approval, the newest OpenClaw grant was disconnected. The active disposable profile then reported authorization required, kept protected tools unavailable, and exited nonzero. Fresh browser OAuth restored protected-tool discovery with exit 0, and the account connection list returned to five OpenClaw entries. No paid call or generation occurred during this revoke/access-loss/reconnect check. Separately, an older disabled production server entry with expired access and an existing refresh credential was temporarily enabled. Its read-only capability probe exposed protected tools, updated the token store, and advanced expiry, demonstrating automatic refresh; the entry was restored to disabled without a tool invocation, paid call, or generation. Separately, a deterministic local fault-injection on the exact installed OpenClaw build exercised the real MaxVideoAI HTTP handler with disposable PostgreSQL and a fake provider. MaxVideoAI accepted and fully buffered the `confirm_generation` response before the test adapter destroyed the downstream socket. OpenClaw observed the transport failure, issued exactly one confirmation request, then recovered through `list_recent_generations`, `get_generation_status`, and `present_generation`; persistence showed one provider call, one job, one charge, and zero refunds. This is local fault-injection evidence, not a live-provider or production-network interruption. A later clean profile installed `@camgraphe/maxvideoai` version `1.0.0` from ClawHub. OpenClaw recorded archive SHA-256 `5b47ee7a585136dd7d02a2bc50e85d5552b8b6be6de0fe22ab983eb0e0303564`, the reviewed Skill SHA-256, and a valid linked origin; the Skill Card was eligible, model-visible, and linked to `@camgraphe`. Browser OAuth completed and an authenticated OAuth probe exposed all 15 protected MaxVideoAI capabilities with no diagnostic. The server was then narrowed to `get_account_status` and `list_models`. `agent exec` did not reuse the same MCP OAuth state, so agent tool invocation remains unverified and no protected tool or paid action ran in that sub-check. OAuth credentials were cleared, the protected probe returned authorization required, the Skill and MCP entry were removed, and the isolated profile residue was moved to the Trash. A bounded private-reference import and cleanup and channel attachments remain unverified. The preview stays noindex and acquisition remains disabled. |
| n8n MCP Client | [n8n MCP Client](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-langchain.mcpclient) documents external MCP tools as deterministic workflow steps, including MCP OAuth2 credentials and a bounded tool-call timeout. | **Tested-with-limits checkpoint (self-hosted n8n 2.38.7 on macOS 26.6.2 arm64; 2026-09-14 Europe/Madrid).** The official image `n8nio/n8n@sha256:a8c95f75c6fdf65f5f2b7a7b354744eaa1c62bb911b5c00af6499c3f38e4cd32` ran in a loopback-only disposable container with a dedicated volume. All three credential-free candidates imported before a dynamically registered, project-scoped MCP OAuth2 credential was bound. Deterministic MCP Client nodes discovered the account and current model catalogue, calculated a budget, prepared an exact quote, and paused before payment. After explicit owner approval, one `$0.12` Seedance 1.5 Pro quote was confirmed exactly once and completed. A separate recovery workflow found the same job through `get_generation_status`, `list_recent_generations`, and `present_generation` without another confirmation; the completion candidate routed it only to `Notify Completion`. A separate rejected approval resumed through the false branch with zero `confirm_generation` runs. Fresh bound exports matched the repository graphs, node IDs, parameters, connections, settings, and tags after removing expected local credential references and generated webhook IDs; no OAuth token or client secret marker appeared. The MaxVideoAI n8n grant was revoked, the unchanged credential then failed with `Authentication required`, the credential was deleted, and the disposable container and volume were removed. n8n Cloud, token refresh, post-revocation reconnect, and a live failed/refunded notification remain unverified. The page stays `preview_noindex`; acquisition and template-library submission remain disabled. |
| n8n MCP Client Tool | [n8n MCP Client Tool](https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.toolmcp) documents selected external MCP tools for an AI Agent. | **Tested-with-limits checkpoint (MCP Client Tool 1.4 in self-hosted n8n 2.38.7; 2026-09-14 Europe/Madrid).** A disposable AI Agent graph imported and exported with five selected read-only or planning tools: `get_account_status`, `list_models`, `get_model_details`, `recommend_models`, and `calculate_project_budget`; `prepare_generation` and `confirm_generation` were excluded, so the agent graph had no paid path. A Chat Model credential was not configured, and execution stopped at the AI Agent before an MCP tool call. Agent-mediated tool invocation remains unverified; no protected or paid action is claimed for this sub-check. This evidence does not inherit the deterministic MCP Client result. |
| Cursor | [Cursor MCP documentation](https://docs.cursor.com/context/model-context-protocol) documents remote SSE and Streamable HTTP servers, OAuth, custom `mcp.json`, and an Add to Cursor surface. | **Tested-with-limits checkpoint (Cursor 3.20.17, build `0c32194e3fb5ffaced9fb36430b860ec301e1fc0`, on macOS 26.6.2 arm64; 2026-09-14 Europe/Madrid).** The notarized official ARM64 application was installed from Cursor's current download endpoint; its DMG SHA-256 was `a3cf86050ea4c322b8a63fa840f35a54318c46da9b33281c2b223a17e473c738`. A dedicated user-data directory, extensions directory, and project kept the checkpoint separate from the normal Cursor profile. The CLI `--add-mcp` path wrote the production URL into isolated user settings but did not surface the server in Cursor 3.20's new MCP panel. The documented project `.cursor/mcp.json` path independently created the server, initially disabled, and enabling it reached `Needs Authentication`. Browser OAuth through the documented desktop localhost callback connected successfully and exposed 15 tools plus 6 resources. A project-scoped Cursor agent using Cursor Grok 4.6 Medium called `get_account_status`, `list_models`, `get_model_details`, `recommend_models`, `calculate_project_budget`, and `prepare_generation`. The comparable one-attempt budget and exact quote were both `$0.34` for Seedance 2.0 Mini, 4 seconds, 480p, 16:9; the agent stopped before `confirm_generation`, so no job, charge, or generation was created. Explicit logout returned the server to `Needs Authentication`; fresh browser OAuth restored `Connected` and the same tool inventory without a paid call. Separately, the current `cursor://anysphere.cursor-deeplink/mcp/install` URL with Base64 configuration opened a review dialog prefilled as Remote HTTPS with the exact production endpoint. The install was cancelled, and no duplicate server was retained. OAuth denial, automatic token refresh, a paid confirmation, accepted-job recovery, library-result rendering, private-reference import/cleanup, and a completed clean-host deep-link install remain unverified. Cursor therefore moves only to `tested_with_limits`; its marketing integration remains hidden, indexation and acquisition remain disabled, and no Add to Cursor action or catalogue submission is enabled. |
| GitHub Copilot in IDEs | [GitHub Copilot MCP setup](https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp-in-your-ide/extend-copilot-chat-with-mcp) documents manual remote OAuth and registry discovery across supported IDE surfaces. | **Controlled checkpoint, not promoted (Visual Studio Code 1.137.0, build `645f29cc3176500b4b5762ba887cf2a7f0ffdf2c`, on macOS 26.6.2 arm64; 2026-09-14 Europe/Madrid).** The official application archive SHA-256 was `16ee5cddb1ea19234e1f2516da07d57e07d7cab6ab45a5515dab077656cbc65e`. Its bundled GitHub Copilot Chat 0.65.0 and completions core 1.378.1799 ran in isolated user-data, extensions, and project directories. A project `.vscode/mcp.json` containing only the production remote URL completed browser OAuth and exposed 15 MaxVideoAI tools. A Copilot agent using `MAI-Code-1.1-Flash` called `get_account_status`, `list_models`, `get_model_details`, `recommend_models`, `calculate_project_budget`, and `prepare_generation`. It prepared an exact `$0.37` Happy Horse 1.1 quote for 4 seconds, 480p, 16:9 and stopped before `confirm_generation`; no job, charge, or generation was created. Paid confirmation, accepted-job recovery, result presentation, refresh, revocation, and reconnect remain unverified. Because the sibling CLI checkpoint exposed a server-side stale-access-token revocation defect, this IDE surface remains registry `not-run`, hidden, non-indexable, and acquisition-disabled until the branch fix is deployed and the full lifecycle is repeated. Each additional IDE/version still requires separate evidence. |
| GitHub Copilot CLI | [Copilot CLI MCP setup](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers) documents remote HTTP/SSE servers, OAuth reauthentication, and experimental registry search. | **Controlled checkpoint blocked by revocation (GitHub Copilot CLI 1.0.83 on macOS 26.6.2 arm64; 2026-09-14 Europe/Madrid).** The official archive SHA-256 was `80a5ded6f1db484b4661af676ea914605ecfbcaf49f6b4bed81e6df16cbd56bd`. An isolated profile added the production Streamable HTTP server through the documented `mcpServers` configuration. OAuth denial left protected tools unavailable with no job or charge; later approval exposed 15 tools. The CLI called `get_account_status`, `list_models`, `get_model_details`, `recommend_models`, `calculate_project_budget`, and `prepare_generation`. After separate owner approval of the exact `$0.34` Seedance 2.0 Mini quote for 4 seconds, 480p, 16:9, `confirm_generation` ran exactly once and the job completed. A separate cold session recovered the same result through `list_recent_generations`, `get_generation_status`, and `present_generation` without a second paid call. The MaxVideoAI account surface then disconnected the CLI grant, but the unchanged already-issued access token still completed a protected `get_account_status` call. Testing stopped immediately under the revoked-connection incident procedure; reconnect and refresh were not attempted, and no later paid call or generation occurred. A branch-local fail-closed active-grant check now has focused tests and independent review, but it is not deployed or hosted-verified. The CLI therefore remains registry `not-run`; marketing, indexation, acquisition, install actions, and registry submission remain disabled. |
| GitHub Copilot cloud agent | [Repository MCP configuration](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/configure-mcp-servers) states that the cloud agent and code review do not currently support remote MCP servers that use OAuth. | **Not run and currently incompatible with the MaxVideoAI OAuth path.** Desktop/IDE/CLI support must not be projected onto this surface. |
| Gemini CLI | The [versioned Gemini CLI 0.59.0 MCP documentation](https://github.com/google-gemini/gemini-cli/blob/v0.59.0/docs/tools/mcp-server.md) documents `httpUrl` for Streamable HTTP, remote OAuth discovery, dynamic client registration, localhost callbacks, token refresh, and `/mcp auth`; the [0.59.0 callback implementation](https://github.com/google-gemini/gemini-cli/blob/v0.59.0/packages/core/src/utils/oauth-flow.ts) is the release-specific authority for callback checks. | **Stable preflight only; not run against MaxVideoAI (Gemini CLI 0.59.0; 2026-09-14 Europe/Madrid).** The pinned npm tarball ran from a disposable extraction and reported version 0.59.0; its locally calculated SHA-256 was `59dc2cdb098b3000d36e34a185fc873932df4fd9d00900e817f2b19cd349d98b`, while its registry SHA-1 and SHA-512 integrity matched the published package metadata. The stable callback is `http://localhost:<OS-assigned port>/oauth/callback` by default and implements PKCE S256 plus random `state` validation, but it does not validate the RFC 9207 `iss` authorization-response parameter. That protection was added by [pull request 29117](https://github.com/google-gemini/gemini-cli/pull/29117) and first appears in [0.60.0-preview.0](https://github.com/google-gemini/gemini-cli/releases/tag/v0.60.0-preview.0), not the current stable checkpoint. No OAuth connection, protected tool, quote, job, charge, generation, extension, or gallery action was attempted. Live validation waits for a stable release containing the issuer check and for hosted verification of MaxVideoAI's active-grant revocation fix. The host therefore remains registry `not-run`, hidden, non-indexable, and acquisition-disabled. |
| Microsoft Copilot Studio | [Copilot Studio existing-server setup](https://learn.microsoft.com/en-us/microsoft-copilot-studio/mcp-add-existing-server-to-agent) documents Streamable transport and OAuth through the onboarding wizard or a Power Platform connector. | **Not run.** Tenant, callback, connector, data-policy, tool, approval, and recovery behavior remain an enterprise validation track. |
| Microsoft Agents 365 | [Microsoft 365 Agent Tools](https://learn.microsoft.com/en-us/microsoft-365/admin/manage/manage-tools-for-agent) documents tenant registration and governance for bring-your-own remote MCP servers. | **Not run.** Registration, admin approval, governance, observability, and Copilot Studio reuse are unverified. The integration remains hidden. |

### Controlled-host promotion protocol

For each new host, record a clean install, OAuth denial and approval, token
refresh, revoke, observed authentication loss, explicit reconnect, account and
catalog discovery, recommendation, project budget, fresh exact quote, and
accepted-job recovery. A paid confirmation requires separate owner approval and
must replay only the exact approved `quoteId`; MaxVideoAI provides server-side
idempotency for that quote and accepts no client idempotency key. Record canonical result/library behavior,
host-specific rendering and attachment limits, the exact host and MaxVideoAI
versions, and sanitized evidence. Partial host evidence may move `not-run` to
`tested_with_limits` when its omissions are explicit. `verified` requires the
full applicable lifecycle above; inapplicable steps must be identified rather
than silently omitted.

## Verified customer-continuity behavior

- `get_account_status` returned the staging wallet balance without exposing the
  account email.
- Billing, connection, workspace, image-workspace, library, and support
  destinations stayed on the first-party staging origin.
- `list_recent_generations` recovered an existing completed video in the same
  MaxVideoAI account library.
- `list_media` exposed the account's private video inventory without
  exposing provider credentials or raw storage internals.
- The upload tool produced a private, temporary handoff; no file bytes were
  uploaded during this checkpoint.
- An insufficient-balance plan produced a signed MaxVideoAI billing handoff for
  exactly the missing amount. It did not collect payment in the host, reveal a
  payment secret, or change the wallet.
- Top-up handoffs now include both a Unix expiry and `expiresAtIso`, preventing
  host-side timezone or unit ambiguity.

## What this evidence supports

It is accurate to say that MaxVideoAI's controlled staging MCP worked with the
tested Claude Desktop and Codex CLI versions for conversational model choice,
live pricing, project budgeting, exact quote preparation, account/library
continuity, reference-upload preparation, and billing handoff. The host can
remain creative while the server supplies current capabilities, constraints,
prices, safe destinations, and confirmation boundaries.

This evidence does **not** establish that MaxVideoAI is listed or approved in a
ChatGPT, Codex, or Claude directory; that every host version is compatible; that
OAuth refresh/revocation is proven; or that LAS
video-to-video works. It also does not replace the final controlled tests for a
fresh private upload, a newly paid render, provider failure/refund, and
disconnect/reconnect.

## Remaining post-launch evidence

1. Record OAuth denial, refresh, revocation, authentication loss, and reconnect
   on the exact public-launch host versions.
2. Upload one tiny disposable private reference, use it in an allowed
   generation path, verify library ownership, then run and record cleanup.
3. With a separately approved minimal spend, confirm one fresh exact quote and
   reconcile quote, charge, job, output, library entry, and wallet cents.
4. Record known provider rejection/refund and ambiguous-timeout behavior without
   leaking prompt, media, payment, or credential data.
5. Test the final public install instructions on the precise ChatGPT/Codex and
   Claude surfaces that will be named in marketing.
6. Continue support, legal, observability, SEO/GEO, directory, and rollback
   review against the active production publication.

The production publication enables public marketing, indexing, transport,
OAuth, discovery, paid generation, and reference uploads. The introductory
trial remains disabled, and directory submission remains a separate process.
