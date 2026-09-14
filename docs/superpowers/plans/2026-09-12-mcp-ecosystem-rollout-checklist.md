# MCP Ecosystem Rollout Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate, publish, distribute, and measure the complete MaxVideoAI MCP ecosystem without weakening the live Claude, ChatGPT, and Codex paths or claiming compatibility before host evidence exists.

**Architecture:** Keep the integration registry as the factual source for publication, acquisition, host evidence, installation, and store state. Promote one host at a time through recorded evidence, then update its localized marketing surface and distribution channel in separate reviewed changes. The shared MCP transport, OAuth, quote approval, generation, recovery, and account library remain common infrastructure.

**Tech Stack:** Next.js App Router, TypeScript, React Server Components, remote Streamable HTTP MCP, OAuth, OpenClaw CLI, Docker, n8n, platform-native MCP clients, Node test runner, Playwright, Vercel, and localized EN/FR/ES content.

**Spec:** `docs/superpowers/specs/2026-09-12-mcp-integration-ecosystem-design.md`

## Global Constraints

- Preserve `/mcp`, `/docs/mcp`, and the Claude, ChatGPT, and Codex integration pages in English, French, and Spanish.
- Preserve current production MCP transport, OAuth, quote confirmation, private-reference, recovery, wallet, and library behavior.
- Keep publication, indexation, acquisition, direct installation, package distribution, store status, and host evidence independent.
- Record the exact host version, environment, test account class, observed result, sanitized evidence reference, and limitations for every compatibility status change.
- A host stays `not-run` until its own lifecycle is exercised; evidence from another client never promotes it.
- A preview stays `noindex,follow` and outside sitemaps until its publication gate is explicitly changed.
- A hidden platform gets no public route, sitemap entry, acquisition key, or compatibility claim before its host gate passes.
- Recheck current first-party platform documentation on the day of any external submission or certification action.
- Never store credentials, tokens, private prompts, private media URLs, payment data, or raw OAuth artifacts in repository evidence.
- Never approve a paid generation without presenting the exact fresh MaxVideoAI quote and obtaining explicit approval for that amount.
- Commit each independently reviewable platform milestone; do not push, merge, deploy, publish, or submit as a side effect of a local evidence update.

---

## Completed Foundation

- [x] Register Claude, ChatGPT, Codex, OpenClaw, n8n, Cursor, GitHub Copilot, Gemini CLI, and Microsoft Copilot in `frontend/config/mcp-integrations.json`.
- [x] Preserve the immutable public floor for Claude, ChatGPT, and Codex.
- [x] Add integration-specific `live`, `preview_noindex`, and `hidden` publication behavior.
- [x] Add localized OpenClaw and n8n preview pages in English, French, and Spanish.
- [x] Keep preview pages out of sitemaps and acquisition attribution.
- [x] Prepare the credential-free ClawHub candidate under `distribution/clawhub/maxvideoai/`.
- [x] Prepare the three credential-free n8n workflow candidates under `distribution/n8n/`.
- [x] Document later-host promotion gates and platform-specific limitations.
- [x] Restructure `/mcp` around one platform selector, one production workflow, the existing demo, and a shorter FAQ/resources section.
- [x] Add locally served brand marks for all nine registry integrations and reuse them in the hub selector and integration-page heroes.

---

### Task 1: Close the Local Hub Refactor Gate

**Files:**
- Verify: `frontend/app/(localized)/[locale]/(marketing)/mcp/`
- Verify: `tests/mcp-marketing-copy.test.ts`
- Verify: `tests/mcp-marketing-route-architecture.test.ts`
- Verify: `tests/mcp-marketing-visual-contract.test.ts`
- Verify: `tests/mcp-seo-signals.test.ts`

**Interfaces:**
- Consumes: commit `c140a95ea` and the current integration registry.
- Produces: a reviewable EN/FR/ES hub whose platform hierarchy does not change publication state.

- [x] Run the focused MCP marketing, route, visual-contract, and SEO tests and record the passing counts.
- [x] Run frontend lint, exposure lint, `git diff --check`, and the production build.
- [x] Smoke-test `/mcp`, `/fr/mcp`, and `/es/mcp` for HTTP 200, canonical, reciprocal hreflang, one main landmark, and expected platform labels.
- [x] Inspect desktop and mobile layouts; confirm the selector shows three primary live choices, two clickable previews, and four non-clickable preparation states.
- [x] Confirm OpenClaw/n8n remain `preview_noindex`, later platforms remain hidden, and only Claude/ChatGPT/Codex remain acquisition-enabled.
- [x] Record the verification result in the branch handoff without changing the registry state.

Evidence recorded 2026-09-12: 60 focused marketing/route/visual/SEO tests and 14 registry/publication/baseline tests passed; frontend lint, exposure lint, `git diff --check`, and the production build exited successfully. EN/FR/ES hub smoke checks returned HTTP 200 with exact canonicals, reciprocal hreflang, one `main`, and all nine platform labels. Desktop 1440×900 and mobile 390×844 checks showed no horizontal overflow and the intended 3/2/4 platform hierarchy.

Brand-mark follow-up recorded 2026-09-12: all nine integrations render through the shared `McpIntegrationMark`; 43 focused registry, publication, route, and visual tests passed along with frontend lint, exposure lint, `git diff --check`, and a production build. Browser checks confirmed all nine visible hub marks and both OpenClaw/n8n hero marks load in light and dark layouts with zero horizontal overflow at 1440×900 and 390×844.

### Task 1B: Extend Privacy-Safe Admin Attribution

**Files:**
- Modify: `frontend/src/server/mcp/client-family.ts`
- Modify: `frontend/src/server/agent-api/audit-events.ts`
- Modify: `frontend/src/lib/schema/mcp-schema.ts`
- Create: `neon/migrations/42_mcp_client_family_ecosystem.sql`
- Modify: `frontend/server/admin-mcp-auth-metadata.ts`
- Modify: `frontend/server/admin-mcp-outcomes.ts`
- Modify: `frontend/server/admin-mcp-outcomes-queries.ts`
- Modify: `frontend/app/(core)/admin/mcp/_components/AdminMcpView.tsx`
- Verify: `tests/admin-mcp-outcomes.test.ts`
- Verify: `tests/admin-mcp-metrics-postgres.test.ts`
- Verify: `tests/admin-mcp-view.test.ts`

**Interfaces:**
- Consumes: the nine integration identities in the MCP registry and self-reported MCP `clientInfo.name` metadata.
- Produces: a privacy-safe admin application breakdown that preserves ChatGPT, Claude, Codex, and historical `other` attribution while distinguishing later clients only when evidence supports it.

- [x] Extend the coarse audit family allowlist to all nine registry integrations without retaining raw client names or versions.
- [x] Add an idempotent migration that widens the existing database check without rewriting historical rows.
- [x] Attribute OpenClaw, n8n, Cursor, GitHub Copilot, Gemini CLI, and Microsoft Copilot conservatively from explicit client-name prefixes.
- [x] Show every registry integration plus `Other / unidentified` in the account/video application breakdown.
- [x] Keep the acquisition funnel split limited to acquisition-enabled landing clients and label that boundary clearly in the admin UI.
- [x] Run focused admin, audit, migration, architecture, registry, and existing-client non-regression tests.
- [x] Record the verification result and commit the admin milestone independently.

Evidence recorded 2026-09-13: 91 focused admin, PostgreSQL, audit, MCP contract, acquisition, registry, publication, host-proof, and immutable live-baseline tests passed. Frontend lint, exposure lint, TypeScript checking, `git diff --check`, and the production build exited successfully. The admin application breakdown now includes all nine registry integrations plus the historical unidentified bucket; the acquisition-source split remains restricted to ChatGPT, Claude, Codex, and `Other / unidentified` until later acquisition gates are explicitly enabled.

### Task 2: Record OpenClaw Host Evidence

**Files:**
- Modify after evidence: `docs/operations/mcp-host-compatibility-matrix.md`
- Modify after evidence: `frontend/config/mcp-integrations.json`
- Test: `tests/mcp-host-proof.test.ts`
- Test: `tests/mcp-integration-registry.test.ts`

**Interfaces:**
- Consumes: `https://api.maxvideoai.com/mcp`, the installed OpenClaw CLI, and a disposable OpenClaw profile.
- Produces: a dated OpenClaw Gateway checkpoint with an evidence status no stronger than the observed lifecycle.

- [x] Record `openclaw --version`, operating system, transport mode, and the candidate file digest associated with this checkpoint. The digest was captured after the initial lifecycle and before the remaining validation steps, so it is not presented as a pre-test provenance record.
- [x] Create a disposable OpenClaw profile with no existing MaxVideoAI grant or cached MCP configuration.
- [x] Add the MaxVideoAI Streamable HTTP endpoint using OpenClaw's supported OAuth configuration.
- [x] Verify OAuth denial leaves protected tools unavailable and creates no job or wallet mutation.
- [x] Verify a distinct user-interrupted pre-approval login leaves the clean profile unauthorized with an empty token store, and observe automatic refresh through a read-only production capability probe without invoking a tool or generation.
- [x] Approve OAuth, verify account identity, list tools, inspect account status, list models, inspect model details, request recommendations, and calculate a project budget without spending.
- [x] Prepare one concrete generation and verify it returns a fresh exact quote without creating a paid job.
- [x] Present the exact quoted amount and obtain explicit approval before any minimal paid confirmation.
- [x] Confirm one explicitly approved `$0.07` quote exactly once, then recover the same accepted job from cold/lost context through `list_recent_generations`, `get_generation_status`, and `present_generation`; verify completion through the MaxVideoAI library fallback without a second `confirm_generation` or other paid call.
- [x] Exercise a literally ambiguous interrupted `confirm_generation` transport response, then recover without a duplicate confirmation or paid job. A deterministic local fault-injection used the exact installed OpenClaw 2026.9.4 build, the real MaxVideoAI HTTP handler, disposable PostgreSQL, and a fake provider: the response was destroyed only after MaxVideoAI accepted and buffered it; OpenClaw sent exactly one confirmation request, then recovered through list/status/present with one provider call, one job, one charge, and zero refunds. This is not presented as live-provider or production-network evidence.
- [ ] Exercise one bounded private-reference import path and clean up the disposable media.
- [x] Revoke the newest MaxVideoAI grant, verify the active disposable profile loses protected access, reconnect through a fresh browser approval, and verify protected tools return without a paid call or generation.
- [x] Record sanitized evidence, limitations, and the exact OpenClaw version in the compatibility matrix. This checkpoint covers denial, user-interrupted pre-approval login, automatic token refresh, one approved confirmation, cold/lost-context recovery, deterministic local interrupted-response recovery, revoke/access-loss/reconnect, and a read-only production capability probe; it does not cover private-reference cleanup, channel attachments, or the ClawHub lifecycle.
- [x] Update only the OpenClaw host evidence status and `lastChecked` field; keep site publication and acquisition unchanged until Task 3 passes.
- [x] Run the host-proof, registry, publication, marketing, and public-baseline tests; commit the evidence update.

Evidence recorded 2026-09-13: 66 focused host-proof, registry, publication, marketing, SEO, and immutable public-baseline tests passed. Frontend lint, exposure lint, and `git diff --check` passed. The OpenClaw Gateway alone moved to `tested_with_limits`; the later owner-authorized ClawHub publication made its package available and listing `listed`, while OpenClaw remains `preview_noindex`, non-indexable, and acquisition-disabled. The unchecked host-lifecycle gaps above remain required before a verified host claim.

Additional interrupted-response evidence recorded 2026-09-13: the exact pinned OpenClaw integration test, the hermetic injected-service transport contract, and the wider focused MCP/marketing/publication suite passed 192/192 with no skips. Frontend lint, exposure lint, TypeScript checking, and `git diff --check` also passed. The host remains `tested_with_limits`; private-reference cleanup and channel attachments remain open.

Private-reference attempt recorded 2026-09-14: staging OAuth completed in the
existing disposable OpenClaw 2026.9.4 profile, and a filtered probe exposed only
`create_reference_upload_link` and `list_media`, with no preparation or
confirmation tool. OpenClaw's isolated headless agent did not complete the
read-only media call (`PARAMETER_INVALID`), while its normal Gateway command
returned `DEVICE_IDENTITY_REQUIRED` and required authentication before opening
a WebSocket. The test stopped before creating an upload session: no upload
session, media asset,
job, quote, charge, or generation was created. The temporary staging entry and
its local OAuth credentials were removed, and the original production/local
profile state was restored.

Migration 43 is present in the deployed application source but is not attested
as applied to the production database, so production was not used for this
test. Staging has the required migrations, but physical staging cleanup still
requires a separately authorized operator credential and a bounded cleanup run.
The private-reference lifecycle remains unverified; no registry, publication,
marketing, indexation, acquisition, or store state changed.

### Task 3: Validate and Publish the ClawHub Candidate

**Files:**
- Verify: `distribution/clawhub/maxvideoai/SKILL.md`
- Verify: `distribution/clawhub/maxvideoai/references/safe-generation.md`
- Verify: `distribution/clawhub/maxvideoai/.clawhubignore`
- Modify after external result: `docs/operations/mcp-distribution-artifacts.md`
- Modify after external result: `docs/marketing/mcp-directory-submissions.md`
- Modify after external result: `frontend/config/mcp-integrations.json`
- Test: `tests/mcp-clawhub-artifact.test.ts`

**Interfaces:**
- Consumes: the successful OpenClaw host checkpoint from Task 2 and the exact local ClawHub candidate.
- Produces: a recorded dry-run and, after final owner review, an externally verifiable ClawHub listing.

- [x] Recheck current ClawHub publishing, scan, namespace, update, uninstall, and licensing documentation from first-party sources.
- [x] Resolve and execute the current official ClawHub CLI only from its documented distribution source and record its version; keep it ephemeral rather than globally installed.
- [x] Run the exact dry-run for slug `maxvideoai`, name `MaxVideoAI`, and version `1.0.0`; save only sanitized output and the resolved file list.
- [x] Confirm the package contains exactly the two reviewed payload files; keep `.clawhubignore` as the third local packaging-control file, and verify no credential, executable installer, fixed price, or copied model roster.
- [x] Review the MIT-0 consequence for the exact published files and obtain the product owner's explicit acceptance.
- [x] Sign in to the owner-controlled ClawHub account and verify the intended namespace before upload.
- [x] Publish version `1.0.0` once, then inspect its listing, file contents, permissions, scan result, source attribution, and install command.
- [x] Perform clean install, update check, and uninstall from a disposable OpenClaw profile; verify OAuth revocation remains a separate MaxVideoAI account action.
- [x] Record listing URL, published digest, publisher account, scan state, and timestamps in both distribution documents.
- [x] Change `store.status` from `preparing` only to the exact observed state (`submitted` or `listed`).
- [x] Run the ClawHub artifact, registry, public-baseline, and exposure tests; commit the listing evidence.

Dry-run evidence recorded 2026-09-13: the official npm package
`clawhub@0.23.3` from `openclaw/clawhub` ran under Node 23.9.0 (above its Node
22 minimum) through `npm exec`, without a global install. The exact
`maxvideoai`/`MaxVideoAI`/`1.0.0` dry-run returned `would-publish`,
`fileCount: 2`, and fingerprint
`d7cca882cf7561fcc8bc83d3f5c130d060beb132bfab98871ed219ccfbfa79dd`.
Disposable differential dry-runs proved `.clawhubignore` is not uploaded while
`references/safe-generation.md` is; `SKILL.md` is the required root payload.
The three local files are non-executable mode-`100644` ASCII text and passed the
credential, installer, fixed-price, and copied-roster audit. On 2026-09-13, the
product owner explicitly accepted MIT-0 for exactly the two payload files. At
`2026-09-13T20:59:22Z`, the official CLI verified the owner-controlled publisher
`@camgraphe`; an authenticated dry-run reproduced the same slug, version,
file count, and fingerprint, with `latestVersion: null`.

Publication evidence recorded 2026-09-13: after explicit authorization, the
single `1.0.0` upload kept the same two-file fingerprint and became the public
listing [clawhub.ai/camgraphe/skills/maxvideoai](https://clawhub.ai/camgraphe/skills/maxvideoai)
under `@camgraphe`. Stored moderation is `clean` with no suspicious or malware
flag. Scan `w17cqj7rwt42xmjz4gh24zb9t18ebpax` completed successfully: static
analysis and A.I.G were clean, ClawScan returned `clean` / `benign`, and the
three Skillspector heuristics were recorded with their credential-prohibition,
declared-endpoint, and human-approval context. A disposable `clawhub@0.23.3`
install produced payloads byte-identical to the candidate, exact-version update
reported `1.0.0` current, and uninstall removed the skill. Registry state is now
`listed` and package availability is `available`; site publication remains
`preview_noindex` and acquisition remains disabled pending the separate
installed-Skill-to-OAuth end-to-end proof.

Listing-evidence verification recorded 2026-09-13: 46 focused ClawHub,
registry, publication, marketing, legal-readiness, sitemap, and exposure-boundary
tests passed with no skips. The public exposure lint and `git diff --check` also
passed.

Installed-Skill evidence recorded 2026-09-13: a clean OpenClaw 2026.9.4 profile
installed `@camgraphe/maxvideoai` version `1.0.0` from ClawHub. The Skill Card was
eligible, model-visible, and linked to the expected owner and artifact digests.
Browser OAuth completed and an authenticated probe exposed all 15 protected
capabilities without diagnostics. A later two-tool filter exposed only
`get_account_status` and `list_models`. Headless `agent exec` did not reuse the
profile's MCP OAuth state, so no agent-mediated protected call is claimed.
Credentials were cleared, the next probe failed closed with authorization
required, the Skill and MCP entry were removed, and the isolated profile residue
was moved to the Trash. No generation or paid call occurred.

### Task 4: Validate n8n Workflows in a Disposable Environment

**Files:**
- Verify: `distribution/n8n/brief-to-approved-generation.json`
- Verify: `distribution/n8n/campaign-queue.json`
- Verify: `distribution/n8n/completion-notification.json`
- Modify after evidence: `distribution/n8n/README.md`
- Modify after evidence: `docs/operations/mcp-host-compatibility-matrix.md`
- Modify after evidence: `frontend/config/mcp-integrations.json`
- Test: `tests/mcp-n8n-workflows.test.ts`

**Interfaces:**
- Consumes: Docker, an exact n8n image version, and a disposable OAuth credential bound after import.
- Produces: separate MCP Client and MCP Client Tool evidence with workflow import/export parity.

- [x] Recheck the current n8n MCP Client, MCP Client Tool, credential, import/export, wait, and template-library documentation.
- [x] Pull a pinned official n8n image and record the immutable image digest.
- [x] Start n8n with a disposable volume and loopback-only port; do not reuse a production n8n database or credential store.
- [x] Import all three JSON candidates before adding credentials and verify no secret or credential ID is embedded.
- [x] Configure a disposable OAuth credential for `https://api.maxvideoai.com/mcp` through the n8n UI.
- [x] Execute the read-only discovery and budget path with the deterministic MCP Client node.
- [x] Verify the AI Agent MCP Client Tool exposes only the selected planning tools and excludes preparation/confirmation; record that agent invocation is still unverified without a Chat Model credential.
- [x] Execute the preparation path and verify the workflow pauses on the exact quote before confirmation.
- [x] Present the exact quoted amount and obtain explicit approval before any minimal paid confirmation.
- [x] Verify one confirmation, server-side `quoteId` idempotency, a bounded polling graph, accepted-job recovery, a completed notification, and a zero-confirmation rejection path; retain live failure/refund notification as an explicit limitation.
- [x] Export each workflow and compare its graph, node IDs, endpoint, approval order, and credential-free shape with the repository candidate.
- [x] Destroy the disposable container and volume after exporting sanitized evidence.
- [x] Record exact n8n version, image digest, import results, OAuth lifecycle, node-specific limitations, and evidence references.
- [x] Update n8n host evidence only to the observed status; retain `preview_noindex` and disabled acquisition until Task 5 passes.
- [x] Run the workflow, host-proof, registry, publication, and public-baseline tests; commit the evidence update.

Evidence recorded 2026-09-14: the focused n8n, host-proof, registry,
publication, marketing-copy, SEO, and immutable public-baseline suite passed
58/58. The complete `tests/mcp-*.test.ts` suite then passed 1,012/1,012 with no
skips; frontend lint, public-exposure lint, JSON parsing, and `git diff --check`
also passed. Claude, ChatGPT, and Codex retain their existing publication,
indexation, acquisition, and host-evidence states. n8n alone moves to
`tested_with_limits`; its site remains `preview_noindex`, non-indexable, and
acquisition-disabled, with no n8n template-library submission.

### Task 5: Promote OpenClaw and n8n Marketing Independently

**Files:**
- Modify per approved host: `frontend/config/mcp-integrations.json`
- Modify per approved host: `frontend/app/(localized)/[locale]/(marketing)/integrations/_content/openclaw.ts`
- Modify per approved host: `frontend/app/(localized)/[locale]/(marketing)/integrations/_content/n8n.ts`
- Verify: explicit OpenClaw and n8n route owners in `frontend/app/(localized)/[locale]/(marketing)/integrations/`
- Test: `tests/mcp-marketing-copy.test.ts`
- Test: `tests/mcp-seo-signals.test.ts`
- Test: `tests/mcp-integration-public-baseline.test.ts`

**Interfaces:**
- Consumes: completed host evidence from Tasks 2 and 4 plus separate publication approval for each integration.
- Produces: truthful localized public pages and optional acquisition attribution for only the approved host.

- [x] Decide OpenClaw publication from its own evidence; do not wait for or inherit n8n evidence.
- [x] Decide n8n publication separately for deterministic MCP Client and AI Agent MCP Client Tool claims.
- [x] Replace preview language only with claims supported by the exact recorded versions and limitations.
- [x] Set `site.publication` and `site.indexable` only for the approved integration; review acquisition enablement as a separate change.
- [x] Add the approved EN/FR/ES paths to sitemap and canonical projections through the registry owner.
- [x] Verify reciprocal hreflang, JSON-LD, robots, one main landmark, localized paths, redirects, and installation actions.
- [x] Run the complete MCP marketing and SEO suites, lint, exposure lint, build, and localized HTTP smoke tests.
- [x] Commit OpenClaw and n8n promotions separately so either can be reverted without affecting the other or the live floor.

Decision recorded 2026-09-14: neither integration is promoted yet. OpenClaw
retains `preview_noindex` because private-reference cleanup and channel
attachment evidence remain open. n8n independently retains `preview_noindex`
because n8n Cloud, Chat-Model-backed agent invocation, token refresh, reconnect,
and a live failed/refunded notification remain unverified. Acquisition stays
disabled for both. Because no promotion was approved, no sitemap path or
indexable canonical projection was added; the localized preview copy keeps only
the exact tested-with-limits claims.

Verification recorded 2026-09-14: all 1,012 MCP tests passed with no skips,
including copy, route, JSON-LD, publication, SEO, acquisition, and immutable
public-baseline contracts. Frontend lint, public-exposure lint, the production
build, and `git diff --check` passed. A production-server smoke on `localhost`
validated all 21 EN/FR/ES owners: the 15-page Claude/ChatGPT/Codex, `/mcp`, and
`/docs/mcp` public floor remained HTTP 200 with `index, follow`; the six
OpenClaw/n8n previews remained HTTP 200 with `noindex, follow`. Every page had
its exact canonical, four reciprocal alternates, and one `main`. Since no
integration was promoted, the independent-promotion commit requirement is
satisfied by retaining both previews in this decision-only checkpoint rather
than creating empty promotion commits.

### Task 6: Validate and Promote Cursor

**Files:**
- Modify after evidence: `docs/operations/mcp-host-compatibility-matrix.md`
- Modify after evidence: `frontend/config/mcp-integrations.json`
- Create after evidence: localized Cursor integration content and explicit route owners following the existing integration architecture.
- Modify after evidence: `frontend/i18n/routing.ts`
- Test: MCP registry, host-proof, marketing-route, copy, publication, SEO, and public-baseline suites.

**Interfaces:**
- Consumes: Cursor's current remote MCP and OAuth implementation on an exact desktop version.
- Produces: separate manual-configuration and verified install-action evidence.

- [x] Recheck Cursor's first-party MCP, OAuth, `mcp.json`, Add to Cursor, catalogue, and branding documentation.
- [x] Record the exact Cursor version and test manual remote Streamable HTTP configuration first.
- [ ] Exercise OAuth denial, approval, refresh, revoke, reconnect, discovery, budget, quote preparation, approved minimal confirmation, recovery, and library result.
- [x] Verify the exact Add to Cursor URL encoding and behavior separately; do not infer it from manual configuration success.
- [x] Record sanitized evidence and limitations, then update only Cursor's host status.
- [ ] Create complete EN/FR/ES content and explicit routes from recorded evidence.
- [ ] Enable any install button only after its exact generated URL passes a clean-host test.
- [x] Decide site publication, indexation, acquisition, and catalogue submission as separate reviewed changes.
- [x] Run all focused and full non-regression gates; commit evidence, marketing, and external submission states separately.

Documentation preflight recorded 2026-09-14: current first-party Cursor MCP,
install-link, deep-link, plugin/Marketplace, security, publisher-terms, and brand
pages were reviewed. Manual remote configuration uses a minimal `url` entry for
`https://api.maxvideoai.com/mcp`; Desktop and Web/Agents callbacks are documented
as `http://localhost:8787/callback` and
`https://www.cursor.com/agents/mcp/oauth/callback`. Manual configuration and the
`cursor://anysphere.cursor-deeplink/mcp/install` action remain separate test
surfaces.

Desktop evidence recorded 2026-09-14: Cursor 3.20.17 build
`0c32194e3fb5ffaced9fb36430b860ec301e1fc0` ran on macOS 26.6.2 arm64 from an
official notarized DMG with SHA-256
`a3cf86050ea4c322b8a63fa840f35a54318c46da9b33281c2b223a17e473c738`.
The test used isolated profile, extension, and project directories. Cursor's
CLI `--add-mcp` path wrote the production endpoint into user settings but did
not surface it in the new MCP panel; the documented project `.cursor/mcp.json`
path did. OAuth connected through the localhost callback and exposed 15 tools
plus 6 resources. A project-scoped Cursor Grok 4.6 Medium agent completed
account, catalogue, model-detail, recommendation, budget, and quote-preparation
calls. It reported a matching `$0.34` estimate and exact quote for a 4-second
480p 16:9 Seedance 2.0 Mini request, then stopped before confirmation with no
job, charge, or generation. Explicit logout produced `Needs Authentication`,
and fresh browser OAuth restored `Connected`. The separately constructed
current Add to Cursor deep link opened a correctly prefilled Remote HTTPS
review dialog; the install was cancelled and no duplicate remained. OAuth
denial, automatic refresh, paid confirmation, accepted-job recovery, library
presentation, private-reference cleanup, and a completed deep-link install
remain open. Cursor moves only to `tested_with_limits`; the site stays hidden,
indexation and acquisition stay disabled, and no install action or catalogue
submission is enabled.

Verification completed 2026-09-14: the focused Cursor/publication suite passed
85/85, the complete MCP suite passed 1,013 tests, frontend lint and the public
exposure check passed, and the production build completed. This checkpoint
changes only evidence and documentation state; there is no Cursor marketing,
install-action, catalogue-submission, deployment, or existing-client state
change to split into a separate release commit.

### Task 7: Validate GitHub Copilot Surfaces Separately

**Files:**
- Modify after evidence: `docs/operations/mcp-host-compatibility-matrix.md`
- Modify after evidence: `frontend/config/mcp-integrations.json`
- Create after evidence: localized GitHub Copilot integration content and explicit route owners.
- Test: MCP registry, host-proof, publication, marketing, SEO, and public-baseline suites.

**Interfaces:**
- Consumes: exact supported IDE and Copilot CLI versions plus GitHub's current registry/discovery rules.
- Produces: distinct evidence for IDE, CLI, and cloud-agent surfaces.

- [x] Recheck GitHub's first-party MCP documentation for each supported IDE, Copilot CLI, cloud agent, OAuth, and registry discovery.
- [ ] Test one exact IDE/version through the complete OAuth, discovery, budget, quote, confirmation, recovery, revocation, and reconnect lifecycle.
- [ ] Test Copilot CLI independently through the same lifecycle and record its own limitations.
- [x] Verify the cloud agent's current remote-OAuth support; retain an explicit incompatibility statement while it cannot use the MaxVideoAI OAuth path.
- [x] Record sanitized evidence separately for IDE, CLI, and cloud agent; update each host record independently. The attempted IDE and CLI checkpoints remain `not-run` because the complete lifecycle did not pass.
- [ ] Create EN/FR/ES marketing content that names only the verified surfaces and versions.
- [x] Decide publication, indexation, acquisition, and GitHub registry/discovery submission independently. All remain disabled while the revocation blocker is unresolved in a hosted build.
- [ ] Run all focused and full non-regression gates; commit each surface milestone separately.

Documentation and controlled-host evidence recorded 2026-09-14: GitHub's
current first-party documentation treats Copilot in IDEs, Copilot CLI, and the
cloud agent as separate surfaces. Visual Studio Code 1.137.0 with bundled
GitHub Copilot Chat 0.65.0 completed OAuth, discovery, account, catalogue,
recommendation, budget, and exact `$0.37` quote preparation without a paid
confirmation. GitHub Copilot CLI 1.0.83 completed the same read/planning path,
then confirmed one separately approved exact `$0.34` quote and recovered the
completed result from a cold session without a duplicate confirmation. The
cloud agent remains explicitly incompatible because GitHub does not support
remote OAuth MCP servers on that surface.

The CLI revoke check exposed a server-side blocker: after its grant disappeared
from MaxVideoAI account connections, the already-issued access token still
completed one protected account-status call. Testing stopped under the support
runbook, so refresh and reconnect were not attempted and the IDE lifecycle was
not advanced to a paid confirmation. Commit `9a9c97999` adds a fail-closed,
uncached active-grant check to every MCP OAuth request with a `client_id`, keeps
first-party bearer behavior unchanged, and records the blocked evidence. The
focused security and host-evidence checks, TypeScript, frontend lint, public
exposure lint, and `git diff --check` passed; an independent Sol-medium review
reported no critical, important, or minor issue. The fix is branch-local only:
both tested surfaces remain registry `not-run`, the integration remains hidden,
and all publication, indexation, acquisition, install, and registry actions stay
disabled until deployment and a fresh revoke/access-loss/reconnect pass.

### Task 8: Validate Gemini CLI

**Files:**
- Modify after evidence: `docs/operations/mcp-host-compatibility-matrix.md`
- Modify after evidence: `frontend/config/mcp-integrations.json`
- Create after evidence: localized Gemini CLI integration content and explicit route owners.
- Test: MCP registry, host-proof, publication, marketing, SEO, and public-baseline suites.

**Interfaces:**
- Consumes: an exact Gemini CLI release and its current remote OAuth discovery behavior.
- Produces: callback and RFC 9207 issuer evidence before any extension distribution.

- [x] Recheck Gemini CLI's first-party MCP server, OAuth discovery, callback, RFC 9207 `iss`, extension, and gallery documentation.
- [x] Install or run a pinned Gemini CLI version in a disposable profile and record the package digest.
- [ ] Verify authorization-server discovery and the exact callback URI before protected tool execution.
- [ ] Exercise OAuth denial, approval, refresh, revoke, reconnect, discovery, budget, quote preparation, approved minimal confirmation, recovery, and library result.
- [ ] Record sanitized callback/issuer evidence and limitations; update only the Gemini CLI host status.
- [ ] Create EN/FR/ES content and explicit routes from the observed behavior.
- [ ] Prepare an extension candidate only after direct host OAuth passes; validate installation before any gallery submission.
- [ ] Decide publication, indexation, acquisition, and extension distribution independently.
- [ ] Run all focused and full non-regression gates; commit evidence, marketing, and distribution states separately.

Preflight result (2026-09-14): the pinned stable npm package
`@google/gemini-cli@0.59.0` reported the expected version from a disposable
extraction. Its calculated SHA-256 was
`59dc2cdb098b3000d36e34a185fc873932df4fd9d00900e817f2b19cd349d98b`,
and its registry SHA-1 and SHA-512 integrity values matched. The versioned
documentation and source confirm Streamable HTTP through `httpUrl`, OAuth
discovery, DCR, a default
`http://localhost:<OS-assigned port>/oauth/callback` callback, PKCE S256, and
random `state` validation. They also show that stable 0.59.0 does not validate
the RFC 9207 `iss` response parameter. The issuer fix landed in Gemini CLI
0.60.0-preview.0 only. Accordingly, no MaxVideoAI OAuth flow or protected tool
was started, the remaining lifecycle and marketing tasks stay unchecked, and
Gemini CLI remains hidden, non-indexable, acquisition-disabled, extension-free,
and registry `not-run`. Resume only on a stable release containing the issuer
check and after the MaxVideoAI active-grant revocation fix is deployed and
hosted-verified.

### Task 9: Validate Microsoft Copilot as an Enterprise Track

**Files:**
- Modify after evidence: `docs/operations/mcp-host-compatibility-matrix.md`
- Modify after evidence: `frontend/config/mcp-integrations.json`
- Create after evidence: localized Microsoft Copilot integration content and explicit route owners.
- Modify after external result: `docs/marketing/mcp-directory-submissions.md`
- Test: MCP registry, host-proof, publication, marketing, SEO, and public-baseline suites.

**Interfaces:**
- Consumes: an owner-controlled Microsoft tenant, Copilot Studio, Microsoft Agent 365 administration, and current certification rules.
- Produces: distinct tenant-level evidence for Copilot Studio and Agent 365.

- [x] Recheck Microsoft first-party documentation for existing MCP servers, Power Platform connectors, OAuth, tenant data policy, Agent 365 governance, Partner Center, and MCP certification.
- [ ] Confirm the publisher identity, Partner Center enrollment, tenant administrator, test users, and support contact are owner-controlled.
- [ ] Configure the MaxVideoAI remote MCP server in a non-production test tenant and record the exact Copilot Studio version/environment.
- [ ] Exercise OAuth denial, approval, refresh, revoke, reconnect, discovery, budget, quote preparation, approved minimal confirmation, recovery, and library result.
- [ ] Test tenant policies, connector permissions, administrator approval, audit visibility, disabled-user behavior, and removal.
- [ ] Test Agent 365 registration, governance, observability, and Copilot Studio reuse separately.
- [ ] Record sanitized evidence and limitations for both host records; update them independently.
- [ ] Create EN/FR/ES content that explains enterprise prerequisites and only observed compatibility.
- [ ] Establish certification eligibility before creating a Partner Center offer or MCP certification package.
- [ ] Decide publication, indexation, acquisition, and Microsoft certification independently.
- [ ] Run all focused and full non-regression gates; commit each enterprise milestone separately.

Documentation preflight result (2026-09-14): Copilot Studio documents direct
Streamable HTTP onboarding with OAuth dynamic discovery/DCR, but generates the
callback during setup and applies Power Platform data policies through its
connector boundary. Microsoft Agent 365 is the current product name. Its BYO
remote-MCP path is still preview and separately requires Agent 365 CLI
1.1.165-preview or later, a provisioned service principal, a public endpoint,
tenant administrator approval, and tenant-wide consent. Its ExternalOAuth path
documents a static client rather than DCR, may create multiple Entra
applications without automatic rollback, can take up to 30 minutes to
propagate, and currently supports neither republishing nor deleting a BYO MCP
registration. The current MCP certification path is also preview and now uses
the Partner Center **Apps and Agents for M365 and Copilot** offer with a
manifest, tool file, `intro.md`, public/legal/support material, and Azure Key
Vault configuration.

No owner-controlled Microsoft tenant, eligible licences, publisher enrollment,
administrator, maker, test users, support identity, Key Vault, or static OAuth
client has been established for this track. No tenant login, registration,
callback, protected tool, payment, Entra mutation, Partner Center offer, or
submission was attempted. Both hosts therefore remain independent registry
`not-run` checkpoints; the integration stays hidden, non-indexable,
acquisition-disabled, and without a prepared or submitted Microsoft package.

### Task 10: Close Existing Claude and ChatGPT Evidence Gaps

**Files:**
- Modify after evidence: `docs/operations/mcp-host-compatibility-matrix.md`
- Modify after evidence: `frontend/config/mcp-integrations.json`
- Modify only when supported: existing Claude and ChatGPT localized integration copy.
- Test: MCP host-proof, registry, marketing, publication, SEO, and public-baseline suites.

**Interfaces:**
- Consumes: exact Claude Code and ChatGPT Web versions/surfaces.
- Produces: host-specific evidence that strengthens existing pages without changing their live floor.

- [x] Recheck current first-party Claude Code and ChatGPT web/plugin documentation, version paths, OAuth behavior, permissions, results, and direct-versus-directory boundaries.
- [ ] Run the complete clean-account lifecycle in Claude Code and record its exact version and limitations.
- [ ] Run the complete graphical ChatGPT installation, OAuth, tool, quote, approved minimal confirmation, recovery, revoke, and reconnect lifecycle.
- [ ] Verify inline result rendering and the canonical MaxVideoAI fallback destination separately in each host.
- [ ] Update only the corresponding host evidence records and supported copy claims.
- [ ] Preserve Claude Desktop and Codex CLI verified evidence unless a newer checkpoint proves a change.
- [ ] Run the full MCP and public-baseline gates; commit Claude Code and ChatGPT evidence independently.

Documentation preflight result (2026-09-14): Claude Code's exact stable channel
resolved to 2.1.236. Anthropic documents pinning that version and verifying a
signed release manifest plus the platform SHA-256 before execution. That stable
supports remote Streamable HTTP, OAuth discovery, DCR, CIMD, OAuth callbacks at
`http://localhost:<random port>/callback`, secure token refresh, resources, and
default per-tool approval. Anthropic does not guarantee that logout invokes the
authorization server's revocation endpoint or that a result-level
`resource_link` receives a native rendering, so server-side revocation evidence
and the text fallback must both be checked in the future hosted pass.

OpenAI's current plugin documentation describes a ChatGPT developer-mode direct
connection to a public HTTPS Streamable HTTP MCP server. OAuth uses protected
resource and authorization-server metadata, prefers CIMD while retaining DCR,
requires PKCE S256 and `resource` propagation, and exposes the exact callback
through the connection-management surface. A developer connection remains
independent from public plugin submission. MaxVideoAI's existing public ChatGPT
page therefore remains intact while the separately documented plugin-directory
decision remains `do_not_submit` under the current commerce policy.

Neither host was connected or exercised during this preflight. Claude Code and
ChatGPT web remain registry `not-run`; Claude Desktop and Codex CLI retain their
existing `verified` checkpoints. No copy claim, route, sitemap entry, indexation,
acquisition, store state, quote, payment, generation, or external account state
was changed. The runtime checklist resumes only after the active-grant
revocation fix is deployed and hosted-verified.

### Task 11: Final Branch, Deployment, and Production Verification

**Files:**
- Verify: all changed source, tests, distribution candidates, and evidence documents.
- Modify after deployment: `docs/marketing/mcp-launch-evidence.md`
- Modify after deployment: `docs/marketing/mcp-gsc-baseline.md`

**Interfaces:**
- Consumes: every approved local platform milestone and an exact immutable deployment candidate.
- Produces: a production release record, rollback point, and post-deploy baseline.

- [x] Rebase or merge the latest target branch into the feature branch without weakening the frozen public baseline.
- [x] Run the complete repository test suite, full MCP suite, frontend lint, exposure lint, i18n check, SEO check, `git diff --check`, and production build.
- [x] Review the complete branch diff for credentials, generated-file drift, accidental public routes, unearned claims, and unrelated changes.
- [x] Smoke-test every live and preview EN/FR/ES route from the production build; confirm hidden routes still return 404.
- [x] Review canonical, reciprocal hreflang, robots, JSON-LD, sitemap, `llms.txt`, acquisition allowlist, and analytics event payloads.
- [x] Create the final review artifact or pull request with the commit map, verification evidence, known limitations, and rollback instructions.
- [x] Deploy an unaliased candidate and rerun transport, OAuth, account, discovery, quote, recovery, media, and marketing smoke tests.
- [x] Promote the exact verified candidate and record the previous deployment for rollback.
- [ ] Verify production HTTP behavior, OAuth metadata, MCP transport, account handoffs, platform pages, and store links.
- [x] Record deployment identifiers, timestamps, evidence links, limitations, and rollback target in the launch evidence document.

### Task 12: SEO, Store, and Funnel Follow-up

**Files:**
- Modify with observations: `docs/marketing/mcp-gsc-baseline.md`
- Modify with external results: `docs/marketing/mcp-directory-submissions.md`
- Modify with release outcomes: `docs/marketing/mcp-launch-evidence.md`

**Interfaces:**
- Consumes: the production release, verified listings, Search Console, analytics, and support observations.
- Produces: factual discovery and conversion evidence for the next prioritization cycle.

- [x] Confirm whether newly indexable canonical URLs or changed sitemap membership require a Search Console submission after production verification; this release added none, so no manual submission was made.
- [ ] Verify every external listing resolves to the canonical landing page and production MCP endpoint without redirect or tracking leakage.
- [ ] Record submitted, reviewed, rejected, listed, suspended, or delisted states per store with timestamp and evidence URL.
- [ ] Capture a clean 14-day baseline for hub visits, platform-card selection, OAuth starts, connected accounts, quote preparation, confirmation, completion/refund, and library continuation.
- [ ] Compare EN/FR/ES discovery and conversion separately; do not merge ChatGPT, Codex, Claude, or later-platform attribution.
- [ ] Review Search Console queries, impressions, clicks, canonical selection, indexing, hreflang, and rich-result warnings for each published route.
- [ ] Review support tickets and failed OAuth/recovery paths without storing private prompts, media, or credentials.
- [ ] Prioritize the next platform using verified host readiness, qualified demand, store reach, support cost, and conversion evidence.
- [ ] Update this checklist, the integration registry, compatibility matrix, directory record, and launch evidence so all status sources agree.

---

## Completion Definition

The rollout is complete only when every applicable checkbox above has evidence or an explicit current incompatibility record, every published claim is backed by a named host checkpoint, every external listing has a recorded factual state, the production release has a rollback point, and the post-release SEO/funnel observation window has been reviewed.
