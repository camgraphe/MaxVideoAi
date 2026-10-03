# Studio + MCP distribution rollout

Checked 4 October 2026, Europe/Madrid. Preparation only: no push, merge,
deployment, registry write, package publication or external submission performed.
This checklist extends the [candidate handoff](studio-release-candidate-2026-10-04.md).

## Reconcile the published baseline first

The Studio candidate still carries plugin/server metadata version `0.3.5`.
Fresh GitHub API reads confirm canonical plugin **0.3.6**, published
2026-09-21 at 23:02:39 UTC, with one installable ZIP and its SHA-256 file.
The main repository pointer release was published at 23:06:15 UTC.
The official Registry API also returns **0.3.6**, `active`, `isLatest=true`.

Before release, compare and reconcile the reviewed Studio branch with the
accepted source behind 0.3.6 and the current target branch. Preserve fixes,
reference-import behavior and publication gates already shipped. The local
candidate's green tests do not certify a future merged release. Choose a new
unused version after that reconciliation; do not publish or reinstall 0.3.5,
overwrite 0.3.6, or assume the next patch number is still available.

Sources: [canonical release](https://github.com/camgraphe/maxvideoai-plugin/releases/tag/v0.3.6),
[source pointer](https://github.com/camgraphe/MaxVideoAi/releases/tag/maxvideoai-plugin-v0.3.6),
[official latest record](https://registry.modelcontextprotocol.io/v0.1/servers/com.maxvideoai%2Fmaxvideoai/versions/latest).

## Surface-by-surface evidence and action

| Surface | Evidence available on this check | Action for the authorized release |
| --- | --- | --- |
| Source GitHub repository | Main release points to plugin 0.3.6. Studio remains a local feature branch. | Review/merge the reconciled source, retain its exact commit, prepare release notes and a new immutable source tag. Keep the source release a pointer to the canonical installation artifact. |
| Public plugin GitHub repository | Canonical 0.3.6 ZIP and checksum are published. | Use the existing protected publication workflow to expose the complete public diff, then publish the reviewed deterministic package. Verify downloaded bytes, tag, version and checksum. |
| Remote MCP server | Published metadata targets `https://api.maxvideoai.com/mcp`; no authenticated live-server check performed this turn. | Deploy reviewed server changes separately. Verify actual served instructions, tools and gates, OAuth and recovery; keep the endpoint stable. A package release does not deploy this server. |
| Official MCP Registry | 0.3.6 is active/latest in the API. | Publish matching reviewed `server.json` only once the deployed scope and public package agree. Re-read the exact record. Keep `com.maxvideoai/maxvideoai` identity unchanged. |
| [ClawHub](https://clawhub.ai/camgraphe/skills/maxvideoai) | Public package is visible at 1.0.0, with its own version series and MIT-0 license. | Compare the two-file ClawHub skill with changed guidance. Publish an independent new version only if its payload changes; verify clean install/update and MCP connection. Do not copy the whole differently licensed plugin bundle. |
| [n8n](https://n8n.io/workflows/19591-turn-creative-briefs-into-approved-maxvideoai-generations-with-human-review/) | Workflow 19591 and its creator profile are now public. This supersedes the September 17 note saying no public listing existed. Its description retains exact quote, human approval and bounded recovery. | Inspect the published workflow payload against the reviewed JSON before registry promotion or an update. Update this existing listing only if schema, instructions or workflow behavior require it. The two other candidates are not presumed submitted. No new runtime/Cloud certification follows from a listing. |
| [Glama](https://glama.ai/mcp/connectors/com.maxvideoai/maxvideoai) | Retrieved public page says ownership verified, Healthy, 15 tools, last tested October 2. This is a dated third-party observation. | Verify re-indexed tool descriptions and first-party links after deployment; test authenticated discovery with the existing isolated test account through the approved procedure. Do not infer refresh or full host compatibility from the badge. |
| [MCPBeat](https://mcpbeat.com/mcp-servers/maxvideoai/maxvideoai/) | Retrieved page is a two-week-old indexed snapshot showing 0.3.5 and conflicting aggregate/endpoint health labels. It is not a current uptime measurement. | Recheck the actual live owner/version/authentication/health presentation and correct stale owned copy through its edit process if necessary. Do not treat anonymous authentication failures as proof of an outage or weaken OAuth for a badge. |
| [mcpdirectory.dev](https://mcpdirectory.dev/s/maxvideoai/) | Historical listing recorded; current page could not be retrieved in this check. | Recheck existing listing, ingestion state, repository and website links after publication. Retrieval failure is not evidence of delisting. |
| GitHub MCP registry | Fresh public API search for `maxvideoai` returned zero results. | Keep separate from GitHub repository releases and the official MCP Registry; do not claim a Copilot directory listing. |
| Codex, Claude, ChatGPT and other hosts | Package installation, direct remote connection and curated store approval remain separate. | Refresh installed guidance through each host's supported mechanism, reconnect/discover tools and test a fresh chat. Recheck any store's current eligibility before a separate submission; this plan does not assert changed eligibility. |

The [n8n creator page](https://n8n.io/creators/maxvideoai/) also exposes the
first-party integration link. Public listing observation is not yet byte parity
with the locally reviewed workflow. Existing authored registry statuses are not
silently promoted by this read-only check. Detailed historical evidence remains
in [distribution records](../marketing/mcp-directory-submissions.md).

## Execution order and acceptance record

1. Reconcile with the accepted 0.3.6 source and target branch; freeze the reviewed
   candidate commit, enabled capabilities, commercial policy and unused version.
2. Run the release candidate's checks: `pnpm mcp:client:check`, registry and
   release-bundle contracts, relevant business suites, production build and host
   checks. Complete the handoff's live-provider and staging prerequisites.
3. After production approval, deploy the server/site, verify the served contract,
   then publish the matching plugin through `publish-maxvideoai-plugin.yml` and
   update official Registry metadata. Never advertise a tool before its gate opens.
4. Update ClawHub or n8n payloads where needed and verify downstream directory
   refresh. Each surface needs an observed result; source push alone is insufficient.
5. Align EN/FR/ES first-party MCP, setup and Studio pages, screenshots, README,
   changelog and external summaries with actual availability. Studio assistant
   token charges must not be described as a new MCP access subscription. Keep
   model facts and generation prices with their live catalog/quote owners.
6. Record source revision, deployed revision, package version/checksum, Registry
   version, listing URL, observed time, exact host/version, refresh/install result
   and remaining limitation for each surface. Update the evidence matrix and
   authored integration registry only to the level each observation establishes.

Release completion means the deployed service, downloadable package and public
claims agree. Existing clients may retain installed skills or discovered metadata;
verify their supported refresh flow rather than promising automatic propagation.
Rollback preserves released tags and financial evidence: roll back the service
through its normal mechanism and ship a corrected package under a new version.
