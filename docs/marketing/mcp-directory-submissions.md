# MaxVideoAI MCP distribution packages

Checked: 2026-07-14
Overall state: **NOT SUBMITTED — NOT READY FOR EXTERNAL DISTRIBUTION**

This file prepares evidence and owner decisions only. It does not authorize a submission, account creation, listing,
deployment, feature-flag change, or use of a third party's marks. Directory rules are current and unstable; recheck all
linked primary sources on the day an owner authorizes a submission.

Current repository truth: `publicMarketing=false`, `publicIndexing=false`, `transport=false`, `oauth=false`,
`discovery=false`, `paidGeneration=false`, `trial=false`, and `referenceUploads=false`.

The local, unpublished package has five read-only discovery tools and no public generation workflow. No real Codex,
Claude, or other-host installation, OAuth, rendering, or tool-selection bundle is recorded. Hosted OAuth refresh and
the production endpoint remain unverified.

## Canonical listing payload

This payload describes only the controlled read-only foundation. Revalidate every field after a capability, permission,
legal document, URL, or publication flag changes.

| Field | Exact prepared value / state |
| --- | --- |
| Product name | **MaxVideoAI**. Do not add “official,” “for Claude,” “for Codex,” or a platform endorsement to the product name. |
| Canonical landing page | EN `https://maxvideoai.com/mcp`; FR `https://maxvideoai.com/fr/mcp`; ES `https://maxvideoai.com/es/mcp`. All are gated, so they are not submission-ready URLs today. |
| Canonical endpoint | `https://api.maxvideoai.com/mcp`, a universal Streamable HTTP resource. `transport=false`; it is not presented as live. |
| Domain ownership | Proposed first-party namespace is `com.maxvideoai/maxvideoai`. Ownership of `maxvideoai.com`/the API subdomain must be proven inside each directory's required account, DNS, HTTP, or organization-verification flow. No external verification evidence is recorded here. |
| Concise description | **Local package only: compare public AI video and image model capabilities, inspect factual model details, build a named project estimate, and check MaxVideoAI account state from a compatible MCP client.** |
| Requested scopes | Intended least-privilege identity scopes: `openid`, `email`, `profile`. Never present the Codex default request for `phone` as approved. |
| Privacy URLs | EN `https://maxvideoai.com/legal/privacy`; FR `https://maxvideoai.com/fr/legal/privacy`; ES `https://maxvideoai.com/es/legal/privacy`. MCP-specific disclosure patch remains Legal-owner pending. |
| Terms URLs | EN `https://maxvideoai.com/legal/terms`; FR `https://maxvideoai.com/fr/legal/terms`; ES `https://maxvideoai.com/es/legal/terms`. Directory-specific acceptance remains an authorized-owner action. |
| Acceptable use URLs | EN `https://maxvideoai.com/legal/acceptable-use`; FR `https://maxvideoai.com/fr/legal/acceptable-use`; ES `https://maxvideoai.com/es/legal/acceptable-use`. The MCP-specific candidate patch remains Legal-owner pending. |
| Support URLs | EN `https://maxvideoai.com/contact`; FR `https://maxvideoai.com/fr/contact`; ES `https://maxvideoai.com/es/contact`; operational email `support@maxvideoai.com`. Do not add a response-time guarantee. |
| Current tools | `get_account_status`, `list_models`, `get_model_details`, `recommend_models`, `calculate_project_budget`. All are local-only, read-only, non-destructive, closed-world, authenticated, and idempotent with respect to account state. |
| Negative cases | No generation, exact quote, upload, trial, payment, or polling tool is currently public. `calculate_project_budget` is an estimate, not a quote, reservation, debit, or provider submission; a real generation still needs `prepare_generation` and explicit `confirm_generation` when those gated tools are released. The account email and payment details are not returned. Do not use MaxVideoAI for coding, research, local file editing, or unsupported source-video/audio/document work. |
| Screenshots and demo | **real screenshots and end-to-end demo: NOT AVAILABLE**. `getMcpProof()` is null and no current proof asset may be substituted with provider marketing media or a synthetic testimonial. |
| Changelog and status | EN `/changelog` and `/status`; FR `/fr/changelog` and `/fr/statut`; ES `/es/changelog` and `/es/estado`. Neither has an MCP-specific entry/component because no live release or monitored MCP health feed exists. |
| Owner checklist | Legal: approve disclosure/terms and directory terms. Security: threat model, OAuth, test account, incident intake. MCP engineering: public endpoint, exact tools/annotations, negative tests, compatibility. Growth: final copy/assets/countries. Support/Operations: runbook, monitoring, escalation. Billing/Risk: only after generation/trial tooling exists. |

### Prepared positive cases (read-only only)

1. “Is MaxVideoAI connected and is my account verified?” → `get_account_status`.
2. “Which public video models support reference images and audio?” → `list_models` with supported filters.
3. “What are the constraints and evidence for H3?” → `get_model_details`.
4. “Shortlist models for a product-video brief, but do not generate or quote it.” → `recommend_models`.
5. “Compare my named 60-second proposals, including explicit creative retries.” → `calculate_project_budget`.

### Prepared negative cases

1. “Generate the video and charge my wallet.” → no tool; explain that connected generation and spending are unavailable.
2. “Upload this local image and use it as a reference.” → no tool; do not ingest a local path/base64/private URL.
3. “Tell me the exact generation price from the recommendation.” → decline exact-price inference; use the MaxVideoAI web price review.
4. “Edit my source video/audio/document.” → outside the current MCP scope.
5. Unrelated coding or research request → do not invoke MaxVideoAI.

## OpenAI: direct Codex configuration

Package state: **NOT SUBMITTED**. Direct MCP configuration is a user setup path, not a directory submission.

| Evidence field | Value |
| --- | --- |
| Source URL | [OpenAI MCP documentation for ChatGPT desktop and Codex clients](https://learn.chatgpt.com/docs/extend/mcp) |
| Checked | 2026-07-14 |
| Evidence state | Official documentation is a packaging reference only. The local MaxVideoAI package has not been loaded by Codex, and no production publication occurred. |
| Uncertainty | Codex installation, OAuth, refresh, rendering, and real host tool-selection decisions are unverified for this branch. Client behavior and commands may change. |

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
| Checked | 2026-07-14 |
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

- every publication flag is false and the public landing/docs/endpoint are fail-closed;
- Legal has not approved the MCP-specific disclosure patch;
- there is no real proof media, complete public demo, or review-ready test account procedure;
- the five local read-only tools have no hosted rendering or real-host decision evidence, while the intended generation/trial/reference product is unimplemented;
- Codex/Claude/other host-selection scorecards have no real decision evidence;
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
| Checked | 2026-07-14 |
| Evidence state | Official documentation is a packaging reference only. The local MaxVideoAI package has not been loaded by Claude, and no production publication occurred. |
| Uncertainty | Claude custom connectors remain a distinct beta/client capability. Claude OAuth, tool rendering, refresh, revocation, and tool-selection evidence are unverified for this branch. Plan/admin availability and UI steps may change. |

Claude custom-connector compatibility does not establish directory eligibility. The direct setup package may be
published on MaxVideoAI's own site after gates pass even if no directory accepts MaxVideoAI. It must state the exact
five local discovery tools, scopes, revocation steps, estimates versus exact quotes, and unavailable generation/upload/payment behavior.

Owner action: rerun clean-account connection, consent denial/approval, refresh, revocation, reconnect, tool rendering,
and negative prompts on each claimed Claude surface; keep Claude Code and Claude Desktop evidence separate; never use
the Claude logo or “works with Claude” wording beyond the applicable brand and evidence rules.

## Anthropic Connectors Directory

Package state: **DO NOT SUBMIT — CURRENT POLICY BLOCKER**.

| Evidence field | Value |
| --- | --- |
| Source URL | [Anthropic Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy), [Anthropic directory submission guide](https://claude.com/docs/connectors/building/submission), [Anthropic pre-submission checklist](https://claude.com/docs/connectors/building/review-criteria), and [Anthropic Software Directory Terms](https://support.claude.com/en/articles/13145338-anthropic-software-directory-terms) |
| Checked | 2026-07-14 |
| Evidence state | Verified official policy says software that uses AI models to generate images, video, or audio is not accepted, except limited design-focused visual aids. MaxVideoAI's intended core workflow generates AI image/video media. No submission was attempted. |
| Uncertainty | The current MCP exposes only read-only discovery, but submitting that narrow facade for a product whose intended connector workflow is AI media generation risks evading the stated policy. Only a future published policy change or written Anthropic determination can remove this blocker. |

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

Package state: **NOT SUBMITTED — BLOCKED**.

| Evidence field | Value |
| --- | --- |
| Source URL | [Official registry overview](https://modelcontextprotocol.io/registry/about), [remote-server metadata](https://modelcontextprotocol.io/registry/remote-servers), [namespace authentication](https://modelcontextprotocol.io/registry/authentication), [registry terms](https://modelcontextprotocol.io/registry/terms-of-service), [registry FAQ](https://modelcontextprotocol.io/registry/faq), and [registry moderation policy](https://modelcontextprotocol.io/registry/moderation-policy) |
| Checked | 2026-07-14 |
| Evidence state | Verified owner documentation describes a preview centralized metadata registry for publicly accessible MCP servers. It supports Streamable HTTP remote URLs and reverse-DNS/domain ownership. No `server.json`, registry login, DNS/HTTP challenge, publication, or API lookup was performed for MaxVideoAI. |
| Uncertainty | The registry is in preview, is primarily a source for downstream aggregators, and does not guarantee discovery in Codex, Claude, ChatGPT, or another host. Metadata versions are immutable; the FAQ says publisher unpublish/delete is not currently available. Separately, the moderation policy says a registry removal normally sets status to `"deleted"` while the metadata remains accessible through the API, except that metadata may be overwritten or erased in extreme cases. |

The proposed neutral metadata identity is:

```json
{
  "name": "com.maxvideoai/maxvideoai",
  "title": "MaxVideoAI",
  "description": "Compare public AI video and image model capabilities, get a factual model shortlist, and check your MaxVideoAI connection and wallet status from a compatible MCP client.",
  "version": "UNASSIGNED",
  "remotes": [
    {
      "type": "streamable-http",
      "url": "https://api.maxvideoai.com/mcp"
    }
  ]
}
```

This is a planning fragment, not a valid submission artifact. Version, schema URL, repository metadata, ownership
method, and final description remain owner decisions. The endpoint must first be publicly reachable and release-ready.

The Official MCP Registry is a metadata repository, not a curated endorsement. Its terms dedicate submitted registry
metadata to CC0 on a perpetual/irrevocable basis, make it public, and permit downstream processing. Legal must approve
that dedication and the current inability to unpublish before any owner authenticates or publishes. A registry record
also does not create a Claude/Codex listing; downstream directories decide whether and how to ingest it.

Owner action: Legal accepts registry terms/CC0 implications; the domain owner selects and proves the
`com.maxvideoai/*` namespace; Security confirms the production remote; MCP engineering validates exact metadata and
version; Growth approves factual copy; an authorized owner runs the publisher only after every launch gate passes.

## Global release checklist

- [ ] All eight checked-in publication flags are reviewed in a separate explicitly approved release change.
- [ ] Migrations 30–32 exist, migration 33 is reviewed/applied in the approved environment, and live producers exist.
- [ ] OAuth least privilege, token refresh, revocation, reconnect, and no-extra-scope behavior pass claimed hosts.
- [ ] Legal approves EN/FR/ES privacy/terms/AUP changes, versions, re-consent, processors, and retention.
- [ ] Support, monitoring, incident/status ownership, security intake, and rollback/kill switches are operational.
- [ ] Exact tool annotations, narrow descriptions, positive/negative tests, and real host decisions pass.
- [ ] Real owned screenshots/demo/proof are available; no provider sample or synthetic testimonial is substituted.
- [ ] Directory-specific identity, ownership, role, terms, privacy, countries, test account, and asset requirements pass.
- [ ] The authorized owner rechecks every official source and explicitly approves that one distribution action.

Until every applicable item passes, MaxVideoAI may document manual setup on its own site only after its own publication
gates pass; it must not claim an external submission, listing, approval, verification, endorsement, or availability.
