# MCP Existing External Record Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the existing mcp.film and Glama records after canonical 0.3.4 publication, then record current MCPBeat, mcpdirectory.dev, and n8n states without adding a new directory.

**Architecture:** Treat canonical 0.3.4 publication as the prerequisite. Send one disclosed factual correction to mcp.film, repair Glama's owner-controlled test profile without weakening OAuth, and observe registry-derived records before contacting them. Keep every external state independent and write one sanitized evidence update after actions finish.

**Tech Stack:** Browser UI, public HTTP probes, GitHub and MCP Registry evidence, Markdown distribution ledger, TypeScript contract tests.

**Spec:** `docs/superpowers/specs/2026-09-16-mcp-convergence-release-design.md`

## Global Constraints

- Start only after the focused public repository and Official MCP Registry both expose 0.3.4.
- Do not request favorable rankings, reciprocal links, testimonials, or endorsements.
- Disclose MaxVideoAI maintainer status in correction messages.
- Do not weaken OAuth, expose anonymous tools, or use a personal production credential to satisfy an aggregator health check.
- Do not create a new test identity, accept new legal terms, pay, or disclose a secret without a separate owner decision.
- Do not submit to Smithery, PulseMCP, an awesome list, OpenAI, Anthropic, Docker, or another new channel in this wave.
- Do not submit the two queued n8n templates while workflow `19591` keeps the portal's next-template action disabled.

---

### Task 1: Capture the Post-0.3.4 External Baseline

**Files:**
- Verify: `docs/marketing/mcp-directory-submissions.md`
- External reads: Official MCP Registry, focused GitHub release, mcp.film, Glama, MCPBeat, mcpdirectory.dev, n8n Creator Portal

**Interfaces:**
- Consumes: canonical 0.3.4 release evidence.
- Produces: dated before-action observations for every existing record.

- [ ] **Step 1: Verify canonical prerequisites**

```bash
test "$(gh api repos/camgraphe/maxvideoai-plugin/contents/VERSION --jq .content | base64 --decode | tr -d '\r\n')" = "0.3.4"
gh release view v0.3.4 --repo camgraphe/maxvideoai-plugin --json url,isDraft,isPrerelease,assets
curl -fsSL 'https://registry.modelcontextprotocol.io/v0.1/servers?search=com.maxvideoai%2Fmaxvideoai' | \
  jq -e '.metadata.count == 1 and .servers[0].server.version == "0.3.4" and .servers[0]._meta["io.modelcontextprotocol.registry/official"].status == "active"'
```

Expected: both canonical sources are public at 0.3.4.

- [ ] **Step 2: Record public record fields without authentication**

Capture displayed version, health/ownership labels, last-check time, tool summary, install command, and feedback path from:

```text
https://mcp.film/mcps/maxvideoai/
https://glama.ai/mcp/connectors/com.maxvideoai/maxvideoai
https://mcpbeat.com/mcp-servers/maxvideoai/maxvideoai/
https://mcpdirectory.dev/s/maxvideoai/
```

Do not infer state from a cached search snippet when the public page is readable.

- [ ] **Step 3: Inspect n8n workflow 19591 through the existing owner session**

Record exactly one observed state:

```text
Pending / Under review — no public URL; next submission remains blocked.
Accepted / Published — record the public library URL and published metadata.
Rejected / Changes requested — record the visible reason without account-private data.
```

Do not upload another workflow.

### Task 2: Submit One Factual mcp.film Correction

**Files:**
- External write: mcp.film feedback form or linked public issue route
- Later modify: `docs/marketing/mcp-directory-submissions.md`

**Interfaces:**
- Consumes: public 0.3.4 release, exact inventory, endpoint, and compatibility matrix.
- Produces: one disclosed correction and its acknowledgement or issue URL.

- [ ] **Step 1: Submit this exact correction packet**

```text
Maintainer correction from MaxVideoAI:

The MaxVideoAI record was last verified on August 31 and several factual fields are now stale. The canonical public plugin release and Official MCP Registry record are now version 0.3.4.

The MCP server does not expose two tools named `plan` and `generate`. It exposes fourteen model-visible tools: get_account_status, list_models, get_model_details, recommend_models, calculate_project_budget, list_media, create_reference_upload_link, import_reference_files, prepare_generation, confirm_generation, get_generation_status, list_recent_generations, present_generation, and create_topup_link. `get_generation_download` is a separate app-only helper.

The current Claude Code command is:
`claude mcp add --transport http maxvideoai https://api.maxvideoai.com/mcp`

An accepted confirmation is recovered through list_recent_generations and get_generation_status; an interrupted client response must not trigger a second confirmation, fresh charge, or duplicate job. The current public repository is https://github.com/camgraphe/maxvideoai-plugin and the live catalogue should be used instead of a hard-coded historical model list.

Please keep host evidence qualified: production Codex has an end-to-end recorded checkpoint, while ChatGPT web and Claude Code remain separate unrecorded full-lifecycle checks. This is a factual maintainer correction, not a request for ranking, endorsement, or favorable editorial language.
```

- [ ] **Step 2: Verify submission result**

Record the visible `Sent` acknowledgement or public issue URL and timestamp. Do not resend after an ambiguous response; inspect the issue route or wait for a visible record first.

### Task 3: Repair the Glama Test Profile Without Weakening OAuth

**Files:**
- External write: Glama connector Admin → Test Profile
- Later modify: `docs/marketing/mcp-directory-submissions.md`

**Interfaces:**
- Consumes: verified owner account, endpoint, and an existing dedicated bounded test identity.
- Produces: a current authenticated health result or explicit blocked diagnosis.

- [ ] **Step 1: Open the verified connector administration page**

Confirm the public record still says `Ownership verified`, record current health and last-tested time, then open `Admin → Test Profile` through the existing authenticated owner session.

- [ ] **Step 2: Validate the test identity boundary**

Proceed only when the profile uses a dedicated test identity limited to MCP health and tool discovery. Stop if Glama requires a new account, personal production credentials, a paid generation, or reusable secret storage outside its documented credential field.

- [ ] **Step 3: Save or refresh and run the check**

Use `https://api.maxvideoai.com/mcp`, allow normal browser OAuth, and authorize only intended identity scopes. Do not enable anonymous discovery or change production.

- [ ] **Step 4: Record the honest result**

Record `Healthy` only if the public page shows a successful current check. Otherwise record `Unhealthy`, the exact visible diagnostic, and timestamp; do not retry by changing OAuth, tool exposure, or production data.

### Task 4: Observe Registry-Derived Records and Contact Only When Needed

**Files:**
- External reads: MCPBeat and mcpdirectory.dev
- Conditional external write: documented feedback path on a stale service
- Later modify: `docs/marketing/mcp-directory-submissions.md`

**Interfaces:**
- Consumes: 0.3.4 Registry record and downstream crawl time.
- Produces: current downstream states and at most one correction per stale service.

- [ ] **Step 1: Re-read MCPBeat**

Record version, answering state, 24-hour checks, seven-day observation, latency, owner label, and last commit. Treat uptime and latency as dated independent measurements, not an SLA.

- [ ] **Step 2: Re-read mcpdirectory.dev**

Record version and tool/capability description. If it still shows 0.3.3 or `plan` / `generate` after its next documented refresh, use its documented feedback route once with the same factual inventory and canonical links.

- [ ] **Step 3: Preserve independent measurements**

Do not ask MCPBeat to change uptime, latency, or auth-hidden tool observations. Contact it only for a stale derived version or source URL after the Registry exposes 0.3.4.

### Task 5: Record Sanitized External Outcomes

**Files:**
- Modify: `docs/marketing/mcp-directory-submissions.md`
- Modify: `docs/marketing/github-outreach-ledger.md`
- Modify: `tests/mcp-legal-support-readiness.test.ts`

**Interfaces:**
- Consumes: Tasks 1-4 observations and acknowledgements.
- Produces: current, sourced, dated external-state records without private account data.

- [ ] **Step 1: Add a failing evidence contract**

```ts
assert.match(directory, /mcp\.film[\s\S]*maintainer correction[\s\S]*2026-09-16/i);
assert.match(directory, /Glama[\s\S]*(?:Healthy|Unhealthy)[\s\S]*Last Tested/i);
assert.match(
  directory,
  /MCPBeat[\s\S]*(?:version `0\.3\.4`|still derived `0\.3\.3`)/i,
);
assert.match(
  directory,
  /workflow `19591`[\s\S]*(?:Pending|Published|Rejected|Changes requested)/i,
);
```

Use the actual action date if execution occurs after 2026-09-16 and update the assertion to the same date.

- [ ] **Step 2: Update external records with observed facts**

For each surface record URL, timestamp, observed state, acknowledgement or issue URL, unresolved limitation, and next review trigger. Do not store screenshots exposing identity, tokens, prompts, private media, or billing data.

- [ ] **Step 3: Run focused gates**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-legal-support-readiness.test.ts \
  tests/mcp-host-proof.test.ts \
  tests/mcp-integration-registry.test.ts \
  tests/mcp-publication.test.ts
npm run lint:exposure
git diff --check
```

Expected: every test passes and no private value appears in the diff.

- [ ] **Step 4: Commit and open the evidence PR**

```bash
git add \
  docs/marketing/mcp-directory-submissions.md \
  docs/marketing/github-outreach-ledger.md \
  tests/mcp-legal-support-readiness.test.ts
git commit -m "docs: record MCP directory repairs"
git push -u origin codex/mcp-external-record-repair
gh pr create \
  --base main \
  --head codex/mcp-external-record-repair \
  --title "docs: record MCP directory repairs" \
  --body "Records disclosed mcp.film correction, Glama test-profile outcome, registry-derived record freshness, and n8n review state. No runtime capability or new-directory submission."
```
