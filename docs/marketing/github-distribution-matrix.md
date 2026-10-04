# MaxVideoAI GitHub distribution matrix

Checked: **2026-08-29**. This is a preparation and evidence record. It also
records the completed Official MCP Registry publication. `eligible_and_verified`
is the only state that permits a positive exact-target availability claim.

Registry-only checkpoint: **2026-09-21**. The Official MCP Registry row now
reflects its active 0.3.5 record. Other rows and policy reviews retain their
previous evidence dates; this checkpoint does not certify another host.

| Target | Authority level | Audience | Status | Blocker | Required evidence | Canonical backlink | Next check | Submission owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MaxVideoAI owned website documentation | First party | Prospective users | eligible_pending_exact_host_evidence | Publish only after product release gates and host-specific wording are evidenced | Released installation page, endpoint health, OAuth and support evidence | `https://maxvideoai.com/mcp` | Release-gate review | Growth + MCP Engineering |
| Direct ChatGPT configuration | Official OpenAI documentation | ChatGPT users | eligible_pending_exact_host_evidence | The exact MaxVideoAI production setup and behavior are not recorded for a ChatGPT host; this is separate from the OpenAI directory gate | Exact ChatGPT client/version install, consent, tool behavior, revocation, recovery, and support reproduction | `https://maxvideoai.com/mcp` | ChatGPT client or documentation change | MCP Engineering |
| Direct Codex configuration | Official OpenAI documentation | Codex users | eligible_pending_exact_host_evidence | Documentation exists; MaxVideoAI has no recorded production clean-account proof | Exact client/version install, consent, tool, revocation, recovery, and support reproduction | `https://maxvideoai.com/mcp` | Client or documentation change | MCP Engineering |
| Direct Claude custom connector | Official Anthropic documentation | Claude users and workspace owners | eligible_pending_exact_host_evidence | Custom connection is distinct from the directory; exact production-host proof is absent | Exact plan/client install, consent, tool, revocation, recovery, and support reproduction | `https://maxvideoai.com/mcp` | Claude policy, client, or documentation change | MCP Engineering |
| Generic compatible MCP client | Protocol and client documentation | MCP-capable users | eligible_pending_exact_host_evidence | Compatibility cannot be inferred from protocol support alone | Named client/version and successful production installation evidence | `https://maxvideoai.com/mcp` | Client evidence refresh | MCP Engineering |
| GitHub release and repository | First-party GitHub controls | Developers and evaluators | eligible_pending_exact_host_evidence | A release must be generated from the reviewed source tag and carry current install/support material | Reviewed tag, checksum, release notes, clean install, and source-link evidence | `https://maxvideoai.com/mcp` | Each release | Plugin release owner |
| Official MCP Registry | Official MCP Registry | Downstream aggregators | eligible_and_verified | None for the active 0.3.5 registry record. The Registry is a metadata source and does not guarantee placement in a host or downstream directory. | Registry API rechecked 2026-09-21: `com.maxvideoai/maxvideoai` 0.3.5 is active/latest, published 2026-09-16, with the production remote endpoint. Original namespace/publication proof remains recorded below. | `https://maxvideoai.com/mcp` | Every new plugin version, Registry schema change, or terms/FAQ change | Product owner + MCP Engineering |
| ChatGPT/OpenAI directory | Official OpenAI platform | ChatGPT users | do_not_submit | Current commerce rule is incompatible with the intended credit-funded digital-media workflow; this is a MaxVideoAI inference | Written OpenAI clarification or policy change, Legal review, then all portal and exact-host evidence | `https://maxvideoai.com/mcp` | Written clarification or policy change | Legal + Product |
| Anthropic Connectors Directory | Official Anthropic directory | Claude users | do_not_submit | Current Directory Policy conclusion blocks the intended AI-media-generation workflow; this is a MaxVideoAI interpretation | Written Anthropic determination or policy change, then new full-scope technical/legal/review evidence | `https://maxvideoai.com/mcp` | Written clarification or policy change | Legal + Product |
| Maintained MCP catalogs and curated lists | Third-party, manually qualified | MCP evaluators | qualification_required | No directory is pre-approved; quality, policy, and current maintenance must be reviewed | Maintainer identity, current policy, audience fit, factual listing copy, and owner approval | `https://maxvideoai.com/mcp` | Before each proposed outreach | Growth |

## Source notes and operating rules

- [Active official Registry record](https://registry.modelcontextprotocol.io/v0.1/servers?search=com.maxvideoai%2Fmaxvideoai&version=latest):
  checked 2026-09-21. The API returns one record, version 0.3.5, status `active`,
  `isLatest: true`, publication timestamp `2026-09-16T20:25:15.392142Z`, and remote
  `https://api.maxvideoai.com/mcp`. This was a read-only check, not a publication.

- [MCP Registry overview](https://modelcontextprotocol.io/registry/about),
  [remote server guidance](https://modelcontextprotocol.io/registry/remote-servers),
  [terms](https://modelcontextprotocol.io/registry/terms-of-service), and
  [FAQ](https://modelcontextprotocol.io/registry/faq): checked 2026-08-29. The
  Registry remains preview software; remote records use `server.json`, must
  point to publicly accessible servers, and registry metadata has the CC0 and
  lifecycle constraints recorded in the table. MaxVideoAI 0.3.3 was published
  with `mcp-publisher` 1.8.1 and verified active through the Registry API at
  `2026-08-29T16:51:36.852225Z`.
- [OpenAI plugin guidelines](https://developers.openai.com/plugins/app-guidelines)
  and [submission requirements](https://developers.openai.com/plugins/deploy/submission):
  checked 2026-08-28. OpenAI's rule concerns commerce categories; the resulting
  MaxVideoAI gate is an internal eligibility conclusion pending a written
  platform determination.
- [Anthropic directory submission guidance](https://claude.com/docs/connectors/building/submission)
  and [Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy):
  checked 2026-08-28. The policy remains the deciding source for the internal
  gate; a direct custom connector is a separate path.
- [OpenAI MCP configuration](https://learn.chatgpt.com/docs/extend/mcp) and
  [Anthropic custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp):
  checked 2026-08-28. These document configuration routes, not a MaxVideoAI
  host decision or directory status.

Prioritize first-party documentation, reviewed GitHub releases, the official
registry after Legal approval, official platform paths after eligibility is
resolved, maintained catalogs, and relevant curated-list pull requests. Do not
bulk-submit to scraped, abandoned, pay-to-list, or low-quality directories.
