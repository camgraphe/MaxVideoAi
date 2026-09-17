# MaxVideoAI MCP distribution packages

Checked: 2026-09-17
Overall state: **OWNED-SITE DIRECT RELEASE + OFFICIAL MCP REGISTRY 0.3.5 ACTIVE/LATEST — MCPBEAT AND GLAMA OWNERSHIP CONFIRMED; N8N WORKFLOW 19591 CHANGES REQUESTED**

This file records evidence and owner decisions. It does not authorize another submission, account creation, listing,
deployment, feature-flag change, or use of a third party's marks. Directory rules are current and unstable; recheck all
linked primary sources on the day an owner authorizes a new submission.

## n8n review follow-up — 2026-09-17

The private Creator Portal workflow [`19591`](https://creators.n8n.io/workflows/19591)
is now `Pending` / `Implement changes`, not under review or publicly listed.
The reviewer email from `creators@n8n.io` asks for explanatory stickies so
readers can understand the workflow before publication. `Share new template`
is enabled again; the other two candidates are still unsubmitted. The earlier
2026-09-15 checkpoint below remains a dated record, not current portal state.

The revised brief candidate retains the original overview Sticky Note and adds
three nearby, non-connected notes for quote preparation, exact human approval,
and single confirmation with bounded status recovery. No executable node,
connection, credential, setting, or activation state changed. Local review and
re-submission of this exact revision remain separate actions; this source edit
does not upload or submit anything to n8n.

| Candidate | Local SHA-256 | Current external state |
| --- | --- | --- |
| `distribution/n8n/brief-to-approved-generation.json` | `6b908227526baf76b5185fe3bd1f3224d9c43fb50de873c84420fa8d9a8f7472` | `revised_not_resubmitted`; workflow `19591` still contains the previously submitted `c21b22387336292a3348ca10b65772143c67313ce7330eb0a433920f4024959f` candidate and awaits a new human review. |
| `distribution/n8n/campaign-queue.json` | `7e536cdf3f6599ee01c85424d153db86e8b9874a2978542f49b72df83f7bf650` | `queued_unsubmitted`; independent submission is possible again but has not occurred. |
| `distribution/n8n/completion-notification.json` | `845f2210ec5eda6d6d691ec4a76ec556cf4eeafcacff1282198f57b637e35bf8` | `queued_unsubmitted`; no public listing exists. |

## 0.3.5 observed publication — 2026-09-16

This checkpoint records observed immutable release state. It does not promote a
host, create another directory submission, or claim that downstream aggregators
have refreshed.

| Evidence | Observed result |
| --- | --- |
| Accepted source | `c4061163dc24478c01ab8224d6509e14d6612c03`; annotated source tag and zero-asset pointer release [`maxvideoai-plugin-v0.3.5`](https://github.com/camgraphe/MaxVideoAi/releases/tag/maxvideoai-plugin-v0.3.5). The cancelled 0.3.4 source tag remains immutable and unpublished. |
| Protected publication | [Workflow run `35145481448`](https://github.com/camgraphe/MaxVideoAi/actions/runs/35145481448) completed successfully after the prepared tree, complete diff, checksum, and two allowed Linux-only skips were reviewed. |
| Canonical package | Public commit `a9af2bd1248953f6a68a603be9c8bb87811b7c7d`, tag `v0.3.5`, and [focused release](https://github.com/camgraphe/maxvideoai-plugin/releases/tag/v0.3.5). The release has exactly the installable ZIP and `.zip.sha256`; downloaded bytes matched the pinned candidate. |
| Package checksum | `5d7a99f97eeebf6d79bd7ab32cb405ba6f4f397b2028a875cc25001c4e29dc1c`. |
| Official MCP Registry | `com.maxvideoai/maxvideoai` `0.3.5` is `active` with `isLatest=true`; `publishedAt`, `updatedAt`, and `statusChangedAt` are `2026-09-16T20:25:15.392142Z`. Version 0.3.4 still returns HTTP 404 and remains unpublished. |
| Downstream scope | Independent directories may continue to show 0.3.3 until their own refresh. That lag is not release failure, host compatibility evidence, or permission to mutate their records without a separately authorized action. |

## Implementation-date primary-source recheck

Checked: **2026-09-14**. This recheck records distribution decisions, not
approval by a platform or a statement about MaxVideoAI's eligibility.

| Target | Primary source and factual rule | Result | Evidence before a status change | Owner and next trigger |
| --- | --- | --- | --- | --- |
| Official MCP Registry | [Registry overview](https://modelcontextprotocol.io/registry/about) says the registry is in preview, stores standardized metadata for public servers, and is primarily consumed by downstream aggregators. [Terms](https://modelcontextprotocol.io/registry/terms-of-service) dedicate submitted metadata to CC0, publicly and on a perpetual, irrevocable basis. The [FAQ](https://modelcontextprotocol.io/registry/faq) and current publisher CLI describe lifecycle controls without making published metadata private. | **eligible_and_verified** for `com.maxvideoai/maxvideoai` 0.3.3. The active record was verified through the official Registry API after owner-authorized publication. | Revalidate the exact new `server.json`, namespace proof, public endpoint, matching public release, current terms, and Registry API response before every later version. | Product owner + MCP Engineering. Recheck on each release or Registry policy/schema change. |
| ChatGPT/OpenAI directory | [OpenAI plugin guidelines](https://developers.openai.com/plugins/app-guidelines) permit commerce only for physical goods and prohibit digital products or services, including subscriptions, digital content, tokens, and credits, whether direct or indirect. [Plugin submission](https://developers.openai.com/plugins/deploy/submission) describes portal review requirements for an MCP-backed plugin. | **do_not_submit**. Applying this commerce rule to MaxVideoAI's credit-funded digital-media workflow is a MaxVideoAI inference, not an OpenAI decision about MaxVideoAI. | Written OpenAI clarification covering the intended scope, or a policy change plus Legal review; then all portal and exact-host review evidence. | Legal and Product owners. Recheck on written clarification or a policy change. |
| Anthropic Connectors Directory | [Anthropic's submission guide](https://claude.com/docs/connectors/building/submission) requires directory-policy compliance and identifies an AI-media-generation compliance acknowledgement. The current [Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy) remains the controlling policy source for AI image/video/audio generation. | **do_not_submit**. The existing policy conclusion remains that MaxVideoAI's intended AI media-generation workflow is outside the directory policy; this is a MaxVideoAI interpretation until Anthropic gives a written determination. | A published policy change or written Anthropic clarification covering the full intended workflow, followed by a fresh technical, legal, security, and review-evidence check. | Legal and Product owners. Recheck on the policy change or written clarification. |

Direct configuration remains separate from directory distribution. Current
official instructions document local Codex configuration and ChatGPT plugins in
[OpenAI's MCP guide](https://learn.chatgpt.com/docs/extend/mcp), and custom
remote Claude connectors in [Anthropic's custom-connector guide](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).
Those instructions do not verify MaxVideoAI on an exact host. Record a
clean-account install, consent, tool behavior, revocation, and recovery result
for each claimed host before publishing host-specific compatibility copy.

## Ecosystem distribution recheck

Checked: **2026-09-15**. These conclusions record the controller's observed
results after the reviewed preparation. This repository update does not
authorize or perform publishing, account changes, namespace claims,
marketplace submissions, public releases, or spend.

### Task 15 observed external execution checklist — 2026-09-15

This checklist records only the external states the controller observed after
the authorized actions. This source-only update performs no external action.
States remain independent: a release, owner claim, sign-in step, prepared
challenge, or third-party health label proves only its own recorded result.

| Surface | Exact public URL and observed baseline | Prepared owner action | Current state | Completion evidence required before changing the state |
| --- | --- | --- | --- | --- |
| Main `camgraphe/MaxVideoAi` GitHub release | [`maxvideoai-plugin-v0.3.3`](https://github.com/camgraphe/MaxVideoAi/releases/tag/maxvideoai-plugin-v0.3.3) was created from the existing tag on 2026-09-14. It is public, non-draft, and non-prerelease, with zero uploaded assets. The [latest-release API](https://api.github.com/repos/camgraphe/MaxVideoAi/releases/latest) now resolves to that tag. | No further mutation. Preserve this release as a source-and-discovery pointer to the canonical plugin release; do not attach or copy its installable archive or checksum. | `verified` | Re-read the release object and latest-release API on a later release change. Zero uploaded assets must remain distinct from GitHub's automatically generated source archives. |
| Canonical `camgraphe/maxvideoai-plugin` release | [`v0.3.3`](https://github.com/camgraphe/maxvideoai-plugin/releases/tag/v0.3.3) is the latest canonical plugin release. Its download surface contains one installable ZIP and its SHA-256 checksum; the other two source archives are generated automatically by GitHub and are not installable package artifacts. | No mutation. Keep this release as the installation artifact owner and link to it from the main-repository release note. | `verified` | Preserve the canonical URL, version, source attribution, installable ZIP, and checksum; never duplicate or replace them from the monorepo release. |
| n8n workflow library | In the [Creator Portal](https://creators.n8n.io/), `distribution/n8n/brief-to-approved-generation.json` passed AI review and was submitted for human review as private Creator Portal workflow ID `19591`, with generated title `Turn creative briefs into approved MaxVideoAI generations with human approval`. The dashboard shows `Pending` / `Under review`; its confirmation says review typically takes 3–5 business days. `Share new template` is disabled while this review is pending, so the other two exact workflows were not submitted and remain queued. No public [workflow library](https://n8n.io/workflows/) URL exists, and no personal account data is recorded. | Wait for workflow `19591` to reach a terminal review result. Submit the next exact queued candidate only when the portal enables `Share new template`; preserve one-at-a-time sequencing and do not add credentials or claim n8n Cloud or MCP Client Tool execution. | `submitted` | Keep this state non-public and non-verified while the dashboard remains pending. Use `verified` only after a final public library URL is readable and matches the reviewed JSON; record rejection or requested changes exactly if review does not pass. |
| GitHub MCP registry discovery | The [public API search](https://api.mcp.github.com/v0.1/servers?search=maxvideoai) returns no MaxVideoAI result. GitHub documents [registry discovery in Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers) and organization-owned [custom registries](https://docs.github.com/en/copilot/how-tos/administer-copilot/manage-mcp-usage/configure-mcp-registry), but the checked public documentation exposes no third-party submission control for GitHub's default public registry. | Do not improvise a PR, support request, or custom-registry setup. Recheck for a documented public third-party submission route; proceed only if GitHub publishes one. | `unavailable_no_documented_submission` | A first-party GitHub submission route plus an accepted result and a positive public API search are required. The Official MCP Registry record is not substitute evidence. |
| MCPBeat owner claim | The public [MaxVideoAI MCPBeat record](https://mcpbeat.com/mcp-servers/maxvideoai/maxvideoai/) now shows `OWNER CONFIRMED`, version `0.3.3`, and `ANSWERING`. At the check, MCPBeat independently reported 96.9% uptime over the prior week; that time-window observation is not a MaxVideoAI SLA. Ownership verification used the repository file flow. The temporary public file was removed after confirmation, while its add and remove commits remain recoverable Git history in the canonical repository. | No further claim mutation. Preserve MCPBeat's independent health measurement and do not convert ownership into host compatibility or uptime guarantees. | `claimed` | Re-read the public owner, version, and health labels before a later status update. A claim remains separate from exact-host execution evidence. |
| Glama owner claim | The owner profile was created and the HTTP challenge was selected for the existing [MaxVideoAI Glama record](https://glama.ai/mcp/connectors/com.maxvideoai/maxvideoai). After reviewed PR [#296](https://github.com/camgraphe/MaxVideoAi/pull/296) reached Production, Production returned the exact challenge body at [`https://api.maxvideoai.com/.well-known/glama.json`](https://api.maxvideoai.com/.well-known/glama.json). On 2026-09-15 the public record showed `Ownership verified`, and the authenticated connector administration page was accessible. The record independently still showed `Unhealthy` and `OAuth` / `Works in Glama`. | No further claim mutation. Keep the permanent challenge route available and let Glama re-evaluate connector health separately; do not reinterpret the independent health labels. | `claimed` | Re-read the public ownership and health labels before a later status update. Ownership does not prove health, availability, OAuth lifecycle coverage, or exact-host compatibility. |
| Docker MCP Catalog | Docker's [contribution guide](https://github.com/docker/mcp-registry/blob/main/CONTRIBUTING.md) supports remote Streamable HTTP servers with OAuth through a reviewed pull request, but its contribution rules require a license that permits catalog consumption and identify permissive licenses such as MIT or Apache-2.0 as acceptable while rejecting non-permissive licensing. MaxVideoAI remains under [Business Source License 1.1](https://github.com/camgraphe/MaxVideoAi/blob/main/LICENSE). | Do not fork, create catalog files, open a PR, or relicense MaxVideoAI in this task. | `blocked_by_license` | A separate owner-and-Legal-approved permissive-license change, followed by a fresh Docker policy review, would be required before preparing a submission. Technical remote-OAuth eligibility alone does not remove the license blocker. |

The exact n8n candidates authorized for identity-bound submission are:

| Candidate | SHA-256 | Submission state |
| --- | --- | --- |
| `distribution/n8n/brief-to-approved-generation.json` | `c21b22387336292a3348ca10b65772143c67313ce7330eb0a433920f4024959f` | `submitted_pending_review` |
| `distribution/n8n/campaign-queue.json` | `7e536cdf3f6599ee01c85424d153db86e8b9874a2978542f49b72df83f7bf650` | `queued_platform_blocked` |
| `distribution/n8n/completion-notification.json` | `845f2210ec5eda6d6d691ec4a76ec556cf4eeafcacff1282198f57b637e35bf8` | `queued_platform_blocked` |

The 2026-09-14 Creator Portal guideline recheck found that every submitted
workflow must include an explanatory Sticky Note. These hashes pin the revised
credential-free candidates after adding one non-connected documentation note
to each export. No executable node, graph edge, setting, activation state,
credential boundary, or workflow behavior changed. The first revised file is
the exact candidate now under human review; the other two revised files have
not been uploaded.

All three files remain disabled, mode `100644`, valid JSON, and free of
credential references. Their deterministic self-hosted MCP Client evidence is
public and indexable on MaxVideoAI; this distribution checklist changes only
the first workflow's private pending-review state. MCP Client Tool invocation
with a Chat Model, n8n Cloud, token refresh, post-revocation reconnect, and a
live failed/refunded notification remain outside the claim.

The controller created the main-repository release from the existing tag with
the prepared notes. No asset paths were passed. The notes link to the canonical
artifact owner, and the canonical `camgraphe/maxvideoai-plugin` `v0.3.3`
release remains the only owner of the installable ZIP and SHA-256 asset.

### Observed public records

These links record what was visible through 2026-09-15; they do not make an
independent aggregator a platform endorsement, an OpenAI or Anthropic store
listing, or proof that MaxVideoAI works in a particular host.

| Surface | Observed state |
| --- | --- |
| Official MCP Registry | [`com.maxvideoai/maxvideoai`](https://registry.modelcontextprotocol.io/v0.1/servers?search=com.maxvideoai%2Fmaxvideoai) is active at `0.3.3`. This is the official protocol registry record, not an OpenAI, Anthropic, GitHub, or other host-store listing. |
| Main repository release pointer | [`camgraphe/MaxVideoAi` `maxvideoai-plugin-v0.3.3`](https://github.com/camgraphe/MaxVideoAi/releases/tag/maxvideoai-plugin-v0.3.3) is the public, non-draft, non-prerelease latest release, with zero uploaded assets. It points to the canonical artifact owner rather than duplicating the installable package. |
| Canonical public source and release | The canonical repository is [`camgraphe/maxvideoai-plugin`](https://github.com/camgraphe/maxvideoai-plugin), and its matching public release is [`v0.3.3`](https://github.com/camgraphe/maxvideoai-plugin/releases/tag/v0.3.3). It remains the owner of the single installable ZIP and SHA-256 asset. Repository publication does not prove host compatibility. |
| ClawHub | [MaxVideoAI](https://clawhub.ai/camgraphe/skills/maxvideoai) is listed at `1.0.0`. This package listing is separate from direct MCP host evidence. |
| MCPBeat | [MCPBeat](https://mcpbeat.com/mcp-servers/maxvideoai/maxvideoai/) publicly shows `OWNER CONFIRMED`, version `0.3.3`, and `ANSWERING`. Its independently reported 96.9% prior-week uptime is a dated third-party observation, not a MaxVideoAI SLA or exact-host compatibility proof. |
| Other independent downstream records | [mcpdirectory.dev](https://mcpdirectory.dev/s/maxvideoai/) and [Glama](https://glama.ai/mcp/connectors/com.maxvideoai/maxvideoai) expose independently maintained records. Glama now shows `Ownership verified`, while its independent `Unhealthy` and `OAuth` / `Works in Glama` labels still conflict. These records are not platform endorsements, first-party store listings, health guarantees, or proof of host compatibility. |
| GitHub MCP registry | The checked [GitHub MCP registry API query](https://api.mcp.github.com/v0.1/servers?search=maxvideoai) returned no MaxVideoAI result on 2026-09-14. The Official MCP Registry record must not be represented as a GitHub registry or Copilot listing. |
| n8n workflow library | The brief-to-approved-generation candidate passed Creator Portal AI review and is privately `Pending` / `Under review` as workflow `19591`; no public library URL exists. The other two exact candidates remain unsubmitted because the pending review disables the portal's next-template action. |
| OpenAI and Anthropic directories | MaxVideoAI is deliberately not submitted under the current first-party commerce and AI-media directory policies described above. These store decisions remain independent from the live direct MCP setup paths. |

| Target | Primary source and current conclusion | Repository state |
| --- | --- | --- |
| ClawHub | Current first-party [publishing](https://github.com/openclaw/clawhub/blob/main/docs/publishing.md), [CLI](https://github.com/openclaw/clawhub/blob/main/docs/cli.md), and [skill-format](https://github.com/openclaw/clawhub/blob/main/docs/skill-format.md) guidance documents owner-scoped skill publishing, a non-uploading `--dry-run`, post-submission security scans, versioned install/update/uninstall state, and mandatory MIT-0 licensing for published skill files. | **Listed and verified.** [MaxVideoAI 1.0.0](https://clawhub.ai/camgraphe/skills/maxvideoai) is owned by `@camgraphe`, contains the two reviewed MIT-0 payload files, and has fingerprint `d7cca882cf7561fcc8bc83d3f5c130d060beb132bfab98871ed219ccfbfa79dd`. Stored moderation is `clean` with no suspicious or malware flag. The additional scan completed: static analysis and A.I.G were clean, ClawScan returned `clean` / `benign`, and Skillspector's three recorded heuristic findings are attributable to the credential prohibition, declared MCP endpoint, and human-approval wording. Clean install, exact-version update, byte comparison, and uninstall passed with `clawhub@0.23.3`. The later clean-profile checkpoint installed the ClawHub package and completed browser OAuth plus protected capability discovery. OpenClaw is published for direct MCP and ClawHub, while agent tool invocation, private-reference import, and channel rendering remain outside the claimed scope. |
| n8n workflow library | [n8n's workflow library](https://n8n.io/workflows/) accepts creator-submitted templates, while the [MCP Client node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-langchain.mcpclient) provides the direct client surface. | **One private submission under human review; no public listing.** Three credential-free JSON candidates imported and re-exported with graph parity on self-hosted n8n 2.38.7. Deterministic OAuth, exact approval, one confirmation, recovery, completed notification, rejection, revocation and access loss were recorded. That self-hosted deterministic scope is live and indexable on MaxVideoAI. The brief-to-approved-generation candidate passed Creator Portal AI review and is workflow `19591`, `Pending` / `Under review`; the portal says review typically takes 3–5 business days. The campaign-queue and completion-notification candidates remain queued because `Share new template` is disabled during the pending review. No public library URL exists. n8n Cloud, token refresh, post-revocation reconnect, live failure/refund notification and Chat-Model-backed MCP Client Tool invocation remain unverified. |
| Cursor MCP catalogue / Add to Cursor | [Cursor MCP documentation](https://docs.cursor.com/context/model-context-protocol) documents one-click installation and custom remote server configuration. It does not by itself establish MaxVideoAI catalogue acceptance. | **Research only; no submission or install button.** Keep hidden until exact button encoding, brand rules, host evidence, and catalogue process are rechecked. |
| GitHub MCP Registry and Copilot discovery | [GitHub Copilot MCP documentation](https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp-in-your-ide/extend-copilot-chat-with-mcp) describes a curated GitHub registry, while the Official MCP Registry record remains a separate metadata source. | **Research only; no GitHub listing claim.** The active `com.maxvideoai/maxvideoai` 0.3.3 record must not be described as a GitHub Copilot listing. |
| Gemini CLI extension distribution | [Gemini CLI extension guidance](https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/writing-extensions.md) supports Git-backed extensions that can declare MCP servers. | **Research only; no extension or gallery submission.** Direct host OAuth must pass first, including the RFC 9207 issuer callback requirement. |
| Microsoft MCP certification | The current preview [Microsoft MCP certification](https://learn.microsoft.com/en-us/microsoft-copilot-studio/mcp-certification) path requires a verified publisher, completed Partner Center business verification, Microsoft 365 and Copilot enrollment, and control of the endpoint. New submissions use the **Apps and Agents for M365 and Copilot** offer and a package containing a manifest, tool file, `intro.md`, public metadata and support/legal documentation, approved branding, and Azure Key Vault authentication configuration. | **Enterprise research only; eligibility not established.** The prior connector-package path is legacy during Microsoft's transition. No Partner Center offer, namespace, package, Key Vault permission, tenant registration, upload, certification, or publication action is authorized or has been performed. The registry store state remains `not_applicable`. |

Store state never controls the direct production endpoint. A rejection,
moderation hold, delisting, or policy change affects only its own distribution
record and cannot demote Claude, ChatGPT, Codex, or the Official MCP Registry
entry.

Current repository truth: `publicMarketing=true`, `publicIndexing=true`, `transport=true`, `oauth=true`,
`discovery=true`, `paidGeneration=true`, `trial=false`, `referenceUploads=true`, and
`montagePreparation=false`, `audioGeneration=false`, and `studioMontageCreation=false`.

The launch product exposes fourteen model-visible tools plus the app-only
`get_generation_download` helper. Its operational profile therefore has
fourteen model-visible tools plus one app-only helper. It supports free model
advice and project budgets, private image/video/audio references, exact quotes,
explicitly approved generation, job recovery, MaxVideoAI top-up, and gallery
continuity. The `get_generation_download` helper is not a model-visible
workflow choice.
Claude Desktop 1.37937.1 has dated controlled-staging OAuth/tool evidence,
while Codex CLI 0.150.0-alpha.8 has a bounded production checkpoint on
2026-08-27: one explicitly approved Luma Ray 3.2 image-to-video job charged
`$0.62`, completed, and was saved to the production library. OAuth refresh,
revocation, and reconnect remain unverified for those dated Claude Desktop
and Codex CLI checkpoints; fresh paid generation remains unrecorded for Claude Desktop.
Graphical ChatGPT/Codex installation and ChatGPT web or Claude Code production
workflows require their own evidence. These remaining checks do not block the
owner-approved direct release. For every other host, use its own dated
compatibility-matrix record; the Codex result does not establish another host's readiness.

## Acquisition decision

The primary launch channel is MaxVideoAI's own site, not a marketplace:

1. `/mcp` owns the broad promise “AI video plugin for ChatGPT and Claude”.
2. `/integrations/chatgpt`, `/integrations/claude`, and `/integrations/codex` own client-specific installation intent.
3. `/docs/mcp` answers technical, credit, reference, recovery, gallery, and security questions.
4. The homepage plus model, example, pricing, and pay-as-you-go winners link contextually to the hub after the shared indexation gate opens.
5. A public GitHub package and tagged release provide an entity signal, backlink destination, installation source, and change history after production readiness.

Use **plugin** or **AI video plugin** for broad OpenAI-facing acquisition,
**connector** for Claude setup, and **remote MCP server** only where technical
precision helps. Do not lead a general prospect with “MCP”. ChatGPT and Claude
are equal primary acquisition actions; Codex remains an important technical
and creator workflow.

Direct custom installation from maxvideoai.com is allowed independently of a
public directory. Current OpenAI commerce rules make the paid digital-content
workflow a directory eligibility risk, and current Anthropic directory policy
blocks AI image/video/audio generation as a core service. These blockers do
not prevent owned-site installation or direct use of the remote MCP server.

## Canonical listing payload

This payload describes the intended complete product. Revalidate every field after a capability, permission,
legal document, URL, or publication flag changes.

| Field | Exact prepared value / state |
| --- | --- |
| Product name | **MaxVideoAI**. Do not add “official,” “for Claude,” “for Codex,” or a platform endorsement to the product name. |
| Canonical landing page | EN `https://maxvideoai.com/mcp`; FR `https://maxvideoai.com/fr/mcp`; ES `https://maxvideoai.com/es/mcp`. These are enabled for the owned-site direct release; external directory submission remains separate. |
| Canonical endpoint | `https://api.maxvideoai.com/mcp`, the enabled universal Streamable HTTP production resource. |
| Domain ownership | First-party namespace is `com.maxvideoai/maxvideoai`. The Official MCP Registry accepted the HTTPS proof at `https://maxvideoai.com/.well-known/mcp-registry-auth` on 2026-08-29. Other directories must still run their own ownership flow. |
| Concise description | **Turn ChatGPT, Claude, or Codex into an AI video producer: prepare prompts and references, compare current models, budget a film, approve the exact MaxVideoAI price, generate, and recover the result in your account library.** |
| Requested scopes | Intended least-privilege identity scopes: `openid`, `email`, `profile`. Never present the Codex default request for `phone` as approved. |
| Privacy URLs | EN `https://maxvideoai.com/legal/privacy`; FR `https://maxvideoai.com/fr/legal/privacy`; ES `https://maxvideoai.com/es/legal/privacy`. MCP-specific disclosure patch remains Legal-owner pending. |
| Terms URLs | EN `https://maxvideoai.com/legal/terms`; FR `https://maxvideoai.com/fr/legal/terms`; ES `https://maxvideoai.com/es/legal/terms`. Directory-specific acceptance remains an authorized-owner action. |
| Acceptable use URLs | EN `https://maxvideoai.com/legal/acceptable-use`; FR `https://maxvideoai.com/fr/legal/acceptable-use`; ES `https://maxvideoai.com/es/legal/acceptable-use`. The MCP-specific candidate patch remains Legal-owner pending. |
| Support URLs | EN `https://maxvideoai.com/contact`; FR `https://maxvideoai.com/fr/contact`; ES `https://maxvideoai.com/es/contact`; operational email `support@maxvideoai.com`. Do not add a response-time guarantee. |
| Current tools | Discovery: `get_account_status`, `list_models`, `get_model_details`, `recommend_models`, `calculate_project_budget`. Media and production: `list_media`, `create_reference_upload_link`, `import_reference_files`, `prepare_generation`, `confirm_generation`, `get_generation_status`, `list_recent_generations`, `present_generation`, `create_topup_link`. The presenter is read-only and keeps result-link/library fallback when a host does not render its MCP App. Production publication is enabled for direct installation. |
| Negative cases | A project estimate is not an exact quote; `prepare_generation` does not debit; `confirm_generation` requires explicit approval of that quote. Payment data never enters chat. The assistant must recover an accepted job instead of submitting a duplicate and must not retry a creative result automatically. Unsupported model modes remain unavailable without disabling supported modes. |
| Screenshots and demo | Current public product screenshots and Claude-specific UI evidence exist. `getMcpProof()` remains null for a standalone job-and-audit-backed end-to-end proof bundle, so product captures are not universal native-host proof. |
| Changelog and status | EN `/changelog` and `/status`; FR `/fr/changelog` and `/fr/statut`; ES `/es/changelog` and `/es/estado`. The direct MCP release is live. The owned status page does not yet expose a dedicated MCP component or first-party monitored health feed. |
| Owner checklist | Legal: approve disclosure/terms and directory terms. Security: threat model, OAuth, test account, incident intake. MCP engineering: public endpoint, exact tools/annotations, negative tests, compatibility. Growth: final copy/assets/countries. Support/Operations: runbook, monitoring, escalation. Billing/Risk: only after generation/trial tooling exists. |

### Prepared positive cases

1. “Is MaxVideoAI connected and is my account verified?” → `get_account_status`.
2. “Which public video models support reference images and audio?” → `list_models` with supported filters.
3. “What are the constraints and evidence for H3?” → `get_model_details`.
4. “Shortlist models for a product-video brief, but do not generate or quote it.” → `recommend_models`.
5. “Compare my named 60-second proposals, including explicit creative retries.” → `calculate_project_budget`.
6. “Use this image, video, or audio file as a reference.” → `list_media` for an existing library asset, `import_reference_files` for authorized host attachments/results, or `create_reference_upload_link` for the in-chat/browser/local fallback; then validate the selected mode.
7. “Show me the exact price before generating.” → `prepare_generation`; no debit or job.
8. “I approve this exact quote.” → `confirm_generation` exactly once, then status/recovery tools.
9. “I need more credits.” → `create_topup_link`, re-read the account, and prepare a fresh quote.
10. “Where is the finished video?” → recover the job and return the connected MaxVideoAI library destination.

### Prepared negative cases

1. “Generate the video and charge my wallet” without a quote approval → prepare and display a quote; do not confirm.
2. “Upload this local image” → create the secure MaxVideoAI upload handoff; do not ingest a local path/base64/private URL directly.
3. “Tell me the exact generation price from the recommendation.” → do not infer it; call `prepare_generation` for the concrete request.
4. “Edit my source video/audio/document.” → outside the current MCP scope.
5. Unrelated coding or research request → do not invoke MaxVideoAI.
6. A timed-out confirmation → recover the existing job; do not submit another paid generation.

## OpenAI: direct Codex configuration

Package state: **NOT SUBMITTED**. Direct MCP configuration is a user setup path, not a directory submission.

| Evidence field | Value |
| --- | --- |
| Source URL | [OpenAI MCP documentation for ChatGPT web and Codex clients](https://learn.chatgpt.com/docs/extend/mcp) |
| Checked | 2026-08-26 |
| Evidence state | The MaxVideoAI plugin loaded in Codex CLI 0.149.0-alpha.4.3 with an ephemeral staging endpoint override and completed OAuth-backed account, catalog, budget, exact-quote, and top-up-handoff calls. No production publication occurred. |
| Uncertainty | Refresh, revocation, reconnect, the default production endpoint, graphical ChatGPT/Codex installation, and future client behavior remain unverified. |

OpenAI documents direct host configuration independently from plugin publication. Codex MCP compatibility does not
establish plugin eligibility. It also does not prove that Codex will choose the right tool for real prompts. Publish
copyable URL setup on MaxVideoAI only after production transport/OAuth and the default-scope issue are resolved.

Owner action:

- MCP engineering records clean-account install, denial, approval, refresh, revocation, reconnect, rendering, and
  negative-case evidence in the exact supported Codex clients;
- Auth resolves or documents an officially supported least-privilege default path;
- Support validates the instructions using only public documentation;
- Growth makes no “Codex library,” “one click,” or “available in Codex” claim without separate external evidence.

## OpenAI: public plugin containing an MCP-backed app

Package state: **DO NOT SUBMIT — CURRENT COMMERCE ELIGIBILITY BLOCKER**.

| Evidence field | Value |
| --- | --- |
| Source URL | [OpenAI app preparation](https://developers.openai.com/apps-sdk/deploy/submission), [OpenAI plugin submission](https://learn.chatgpt.com/docs/submit-plugins), and [OpenAI app guidelines](https://developers.openai.com/apps-sdk/app-guidelines) |
| Checked | 2026-08-26 |
| Evidence state | Verified official documentation says MCP-backed apps are submitted as plugins. The current App Guidelines allow app commerce only for physical goods and disallow selling digital products or services, including digital content, tokens, or credits, directly or indirectly. No MaxVideoAI draft or submission was created. |
| Uncertainty | **This is a MaxVideoAI eligibility inference, not an OpenAI eligibility decision:** wallet-funded media generation produces digital content/services, and web top-ups fund credits that would indirectly enable that workflow. Whether a permanently read-only comparison connector could qualify is not established. Portal fields, review policy, packaging, and distribution surfaces can change. |

OpenAI currently asks for a verified individual/business identity, Apps Management write access, a real public MCP
endpoint (not local/test), appropriate CSP, exact annotations, logo/listing/legal material, test credentials when
authentication is required, five positive and three negative test cases, and selected countries. Scanning imports the
server's actual tools and annotations; prose cannot override incorrect metadata.

The current commerce rule is a threshold blocker for the intended MaxVideoAI product, independently of technical
readiness. Wallet-funded media generation and top-ups materially connect the proposed plugin to digital content,
services, and credits. This is a MaxVideoAI eligibility inference from the published rule, not a written OpenAI ruling.
**Do not submit** a MaxVideoAI plugin unless OpenAI provides written clarification covering the exact submitted
read-only and intended paid-generation scope, or a policy change removes the blocker and Legal re-reviews it.

The current blockers are all release-critical:

- The direct production MCP path is live, but the platform-directory policy blocker remains independent and unresolved.
- Legal has not approved the MCP-specific disclosure patch;
- current public product screenshots and Claude-specific UI evidence exist, but
  `getMcpProof()` remains null for a standalone job-and-audit-backed end-to-end
  proof bundle and no review-ready test account procedure exists;
- the bounded Codex CLI production checkpoint includes an explicitly approved,
  charged, completed generation. A public graphical ChatGPT/Codex plugin install
  and the ChatGPT web review workflow still require their own paid-generation
  and private-reference-transfer evidence; the Codex result does not satisfy
  those host-specific checks. Trial remains disabled;
- Claude Code, graphical ChatGPT/Codex, and other host-selection scorecards have
  no real decision evidence;
- production monitoring, status ownership, refresh evidence, and migration prerequisites are incomplete.
- written OpenAI clarification or a policy change has not resolved the commerce eligibility inference.

ChatGPT plugin approval is not a Codex host decision test. A future approval must not be described as “listed in
Codex” unless the exact Codex distribution surface and behavior are separately verified.

Owner action: Legal accepts current OpenAI terms and final public text; the verified business owner completes platform
identity; Security approves demo-account handling; MCP engineering deploys and scans the exact version; QA runs all
positive/negative cases on required surfaces; Growth supplies owned logo/copy and countries; an authorized owner alone
submits through the official portal.

## Anthropic: direct Claude custom connector

Package state: **NOT SUBMITTED**. A custom remote connector is configured by the user or workspace owner; it is not a
Connectors Directory listing.

| Evidence field | Value |
| --- | --- |
| Source URL | [Claude custom remote connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) |
| Checked | 2026-08-26 |
| Evidence state | Claude Desktop 1.37937.1 loaded the custom staging connector and completed OAuth-backed account, catalog, budget, exact-quote, media, recovery, upload-handoff, and top-up-handoff calls. No production publication occurred. |
| Uncertainty | Refresh, revocation, reconnect, Claude Code, plan/admin availability, production setup, and future UI steps remain unverified. |

Claude custom-connector compatibility does not establish directory eligibility. The direct setup package may be
published on MaxVideoAI's own site after gates pass even if no directory accepts MaxVideoAI. It must document the live
tool set, scopes, revocation, estimates versus exact quotes, references, top-up, explicit approval, recovery, and library continuity.

Owner action: rerun clean-account connection, consent denial/approval, refresh, revocation, reconnect, tool rendering,
and negative prompts on each claimed Claude surface; keep Claude Code and Claude Desktop evidence separate; never use
the Claude logo or “works with Claude” wording beyond the applicable brand and evidence rules.

## Anthropic Connectors Directory

Package state: **DO NOT SUBMIT — CURRENT POLICY BLOCKER**.

| Evidence field | Value |
| --- | --- |
| Source URL | [Anthropic Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy), [Anthropic directory submission guide](https://claude.com/docs/connectors/building/submission), [Anthropic pre-submission checklist](https://claude.com/docs/connectors/building/review-criteria), and [Anthropic Software Directory Terms](https://support.claude.com/en/articles/13145338-anthropic-software-directory-terms) |
| Checked | 2026-08-26 |
| Evidence state | Verified official policy says software that uses AI models to generate images, video, or audio is not accepted, except limited design-focused visual aids. MaxVideoAI's intended core workflow generates AI image/video media. No submission was attempted. |
| Uncertainty | The production publication gates are still closed, but the intended connector workflow is AI media generation. Submitting a narrow read-only facade would risk evading the stated policy. Only a future published policy change or written Anthropic determination can remove this blocker. |

The directory accepts remote MCP submissions through a Team/Enterprise organization with directory-management access
and asks for OAuth, annotations, documentation/privacy/support, test credentials, owned endpoints, examples, and
compliance acknowledgements. Those procedural fields do not override the unsupported-use rule: AI models to generate
images, video, or audio are currently not accepted.

Therefore **do not submit MaxVideoAI to the Anthropic Connectors Directory**. Do not strip generation language or offer
only discovery tools to obtain a listing for an intended media-generation service. Direct Claude custom-connector
setup remains a separate user-controlled path and does not imply review, verification, listing, partnership, or
endorsement.

Owner action: Legal and Product record this policy blocker. Recheck only if Anthropic changes the primary policy or
provides written clarification that covers MaxVideoAI's full intended workflow; then repeat security, legal, tool,
support, test-account, and host evidence review from scratch.

## Official MCP Registry

Package state: **ACTIVE — VERSION 0.3.3**.

| Evidence field | Value |
| --- | --- |
| Source URL | [Official registry overview](https://modelcontextprotocol.io/registry/about), [remote-server metadata](https://modelcontextprotocol.io/registry/remote-servers), [namespace authentication](https://modelcontextprotocol.io/registry/authentication), [registry terms](https://modelcontextprotocol.io/registry/terms-of-service), [registry FAQ](https://modelcontextprotocol.io/registry/faq), and [registry moderation policy](https://modelcontextprotocol.io/registry/moderation-policy) |
| Checked | 2026-08-29 |
| Evidence state | `mcp-publisher` 1.8.1 validated and published `plugins/maxvideoai/server.json`. The Registry accepted the HTTPS namespace proof for `maxvideoai.com`, and its API returned exactly one active record for `com.maxvideoai/maxvideoai` version 0.3.3 at `2026-08-29T16:51:36.852225Z`. The record points to the public Streamable HTTP endpoint, website, and GitHub repository. |
| Uncertainty | The registry is in preview, is primarily a source for downstream aggregators, and does not guarantee discovery in Codex, Claude, ChatGPT, or another host. Published metadata remains public; lifecycle status changes do not make the historical metadata private. The moderation policy says a status change to `"deleted"` is possible while metadata remains accessible through the API. |

The published metadata identity is:

```json
{
  "name": "com.maxvideoai/maxvideoai",
  "title": "MaxVideoAI",
  "description": "Plan, compare, price, generate, and recover AI video from compatible MCP clients.",
  "version": "0.3.3",
  "remotes": [
    {
      "type": "streamable-http",
      "url": "https://api.maxvideoai.com/mcp"
    }
  ],
  "repository": {
    "url": "https://github.com/camgraphe/maxvideoai-plugin",
    "source": "github",
    "id": "1349419332"
  },
  "websiteUrl": "https://maxvideoai.com/mcp"
}
```

The exact source remains `plugins/maxvideoai/server.json`. The public record is
available from the Registry API search for `com.maxvideoai/maxvideoai`; this is
registry metadata evidence, not a platform endorsement.

The Official MCP Registry is a metadata repository, not a curated endorsement. Its terms dedicate submitted registry
metadata to CC0 on a perpetual/irrevocable basis, make it public, and permit downstream processing. Those consequences
were presented before this owner-authorized publication. A registry record does not create a Claude, ChatGPT, or Codex
listing; downstream directories decide whether and how to ingest it.

Completed owner action: on 2026-08-29, the owner authorized publication after the CC0/public-metadata and lifecycle
constraints were presented. MCP Engineering validated the exact 0.3.3 metadata, matched it to the public GitHub
release, verified the OAuth-protected production endpoint, deployed the HTTPS namespace proof, published once, and
re-read the active Registry API record. Future versions require the same exact-payload approval and verification cycle.

## Global release checklist

- [ ] All eight checked-in publication flags are reviewed in a separate explicitly approved release change.
- [ ] Required MCP migrations are recorded as applied in the target environment before any live producer claim.
- [ ] OAuth least privilege, token refresh, revocation, reconnect, and no-extra-scope behavior pass claimed hosts.
- [ ] Legal approves EN/FR/ES privacy/terms/AUP changes, versions, re-consent, processors, and retention.
- [ ] Support, monitoring, incident/status ownership, security intake, and rollback/kill switches are operational.
- [ ] Exact tool annotations, narrow descriptions, positive/negative tests, and real host decisions pass.
- [ ] Real owned screenshots/demo/proof are available; no provider sample or synthetic testimonial is substituted.
- [ ] Directory-specific identity, ownership, role, terms, privacy, countries, test account, and asset requirements pass.
- [ ] The authorized owner rechecks every official source and explicitly approves that one distribution action.

Until every target-specific applicable item passes, MaxVideoAI must not claim a platform-directory submission,
approval, partnership, endorsement, or exact-host verification. The active Official MCP Registry metadata record may
be stated factually, but it must not be presented as a ChatGPT, Claude, or Codex marketplace listing.
