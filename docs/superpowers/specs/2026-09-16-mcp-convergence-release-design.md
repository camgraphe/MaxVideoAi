# MCP 0.3.4 Convergence Release Design

## Goal

Make the checked-in MaxVideoAI MCP truth, the public plugin repository, the
Official MCP Registry, and the most visible existing third-party records agree
with the production service as of 2026-09-16.

This is a convergence release, not a capability expansion. Production already
supports the current direct video and image workflow. The work removes stale
claims, publishes the reviewed 0.3.4 package, repairs existing distribution
records, and leaves higher-risk host or capability launches for later waves.

## Current Baseline

The checked-in publication source enables public marketing, indexing,
transport, OAuth, discovery, paid generation, and reference uploads. Trial,
montage preparation, paid Audio generation, and Studio montage creation remain
disabled.

The production server registers fourteen model-visible tools plus the
app-only `get_generation_download` helper. The operational flow covers account
status, live model discovery, recommendations, project budgets, private media,
reference imports and upload handoffs, exact quotes, explicit confirmation,
status and recovery, result presentation, top-up handoff, and Library
continuity.

The 0.3.4 plugin source and release assets pass the repository release checks.
The focused public repository, its latest release, and the Official MCP
Registry still publish 0.3.3. Several active support and acquisition documents
also retain pre-production wording that contradicts the enabled publication
source.

Existing external records are uneven:

- MCPBeat observes the endpoint answering correctly but derives version 0.3.3.
- Glama verifies ownership and OAuth but reports `Unhealthy` because its latest
  authenticated health check cannot complete without a maintained test profile.
- mcp.film describes a two-tool `plan` / `generate` surface and older recovery,
  install, model, and evidence facts that no longer match the public server.
- The first n8n workflow remains in private human review; the other two exact
  candidates remain unsubmitted while the portal blocks another submission.

## Scope

### Milestone A: checked-in truth convergence

Update active documents and the contracts that validate them. The authored
runtime sources remain unchanged unless a test exposes a real implementation
defect.

The active truth set is:

- `frontend/config/mcp-publication.json` for shared capability publication;
- `frontend/config/mcp-integrations.json` for host, site, acquisition, package,
  and store state;
- `frontend/src/server/mcp/server.ts` and the tool registrars for the runtime
  inventory;
- `docs/operations/mcp-host-compatibility-matrix.md` for exact host evidence;
- `docs/operations/mcp-support-runbook.md` for live support procedures;
- `docs/marketing/mcp-public-claims-matrix.md` for allowed and prohibited
  acquisition claims;
- `docs/marketing/mcp-directory-submissions.md` for external distribution
  state.

The claims matrix must describe the enabled direct-production boundary while
retaining these restrictions:

- no universal-host compatibility promise;
- no free-trial promise;
- no in-chat collection of card or payment data;
- no fixed price copied outside the canonical quote flow;
- no claim that Audio generation or Studio montage is live;
- no OpenAI or Anthropic directory listing claim.

The support runbook must distinguish current production behavior from dated
staging evidence. Historical staging checkpoints remain intact, but sentences
such as “production OAuth is off”, “no quote tool is public”, or “generation is
future-gated” must not appear as current instructions.

The directory record must use the exact fourteen model-visible plus one
app-only inventory, preserve the current policy blockers, and remove launch
blockers that are already resolved. It must not convert a direct setup path into
a marketplace approval claim.

Contract tests will fail when an active document reintroduces known
pre-production assertions or reports an inventory inconsistent with the live
server. Historical plans and immutable evidence narratives are not globally
rewritten merely because they contain an older state.

### Milestone B: immutable 0.3.4 publication

Publication follows the existing protected workflow and never force-updates a
tag or release.

1. Merge the reviewed checked-in convergence changes to the source repository.
2. Create the immutable source tag `maxvideoai-plugin-v0.3.4` at the accepted
   source commit.
3. Dispatch `publish-maxvideoai-plugin.yml` from that exact tag and approve the
   `maxvideoai-plugin-publication` environment only after reviewing the prepared
   public diff.
4. Verify the focused repository publishes version and tag `v0.3.4`, the
   deterministic ZIP and SHA-256 assets, the refreshed README, and the reviewed
   screenshots.
5. Create the matching zero-asset source-repository pointer release only after
   the focused public release exists, so it never links to an absent artifact.
6. Validate and publish `plugins/maxvideoai/server.json` version 0.3.4 through
   the Official MCP Registry publisher, then verify the API returns one active,
   latest 0.3.4 record for `com.maxvideoai/maxvideoai`.
7. Record exact public URLs, source and public commit identities, checksums,
   workflow result, registry timestamp, and observed downstream versions in a
   post-publication evidence change.

Any public base drift, tag collision, checksum mismatch, failed release gate,
or registry record mismatch stops the sequence. Existing 0.3.3 releases and
tags are never edited or deleted.

### Milestone C: existing-record repair

Repair current distribution records only after the canonical 0.3.4 release is
public.

For mcp.film, submit one factual correction packet covering:

- the fourteen model-visible tools and separate app-only helper rather than
  `plan` and `generate`;
- the current Claude setup command and focused public repository;
- accepted-job recovery without duplicate confirmation;
- current production and host evidence, with its limitations;
- removal of the hard-coded historical model summary in favor of the live
  catalogue.

The message must disclose that it comes from the MaxVideoAI maintainer and must
not ask for favorable language, ranking, or reciprocal links.

For Glama, use the verified owner account to add or update the connector Test
Profile. The profile must use a dedicated bounded test identity and must not
store a personal production credential in repository files or evidence. Run the
authenticated health check, record the observed result, and keep `Unhealthy`
as the recorded state if Glama still cannot scan the server. A failed check is
diagnosed; it is not hidden by weakening OAuth or exposing anonymous tools.

For MCPBeat and mcpdirectory.dev, first allow the registry-driven records to
refresh from 0.3.4. Send a correction only if a record remains stale after the
canonical registry update and the site exposes a documented feedback path.

For n8n, inspect the Creator Portal state of workflow `19591`. Record the exact
observed state and public URL if accepted. If it remains pending, leave the
other two candidates unsubmitted. This wave does not bypass the portal's review
lock or create duplicate templates.

## Out of Scope

- Enabling paid Audio generation, montage preparation, or Studio montage.
- Adding or changing model identity, pricing, provider routing, or generation
  behavior.
- Completing ChatGPT web, Claude Code, Cursor, Copilot, Gemini, or Microsoft
  host certification.
- Submitting to OpenAI or Anthropic directories while the recorded policy
  blockers remain.
- Publishing to Smithery, PulseMCP, or a new awesome list in this convergence
  wave.
- Changing the Business Source License or pursuing Docker catalogue inclusion.
- Deleting historical plans, archived evidence, local worktrees, or user-owned
  files as cosmetic cleanup.

## Work Isolation

All repository changes run in a dedicated worktree based on `origin/main` and
the `codex/mcp-convergence-034` branch. The local `main` checkout and its user
changes remain untouched.

External publication begins only from an accepted source commit. Portal actions
use existing owner-controlled accounts. If a portal requires new credentials,
new legal acceptance, payment, or disclosure of a secret, execution stops for
an explicit owner decision.

## Verification

Milestone A requires:

- focused red-first contract tests for current flags, inventory, and forbidden
  stale claims;
- MCP documentation, legal/support readiness, publication, host-proof,
  integration-registry, plugin, and public-release tests;
- plugin asset and content release checks;
- frontend lint, public exposure lint, and `git diff --check`.

Milestone B additionally requires:

- the protected workflow's complete prepared diff and deterministic rebuild;
- source and public release tags resolving to the expected commits;
- downloaded release checksum verification;
- focused-repository zero-drift verification;
- the Official MCP Registry API returning active latest version 0.3.4;
- a live unauthenticated endpoint probe returning the expected OAuth challenge.

Milestone C records screenshots or sanitized text evidence without tokens,
private prompts, private media, payment data, or personal account information.

## Success Criteria

The wave is complete when:

1. Active checked-in claims and support procedures agree with the publication
   source and the fourteen-plus-one inventory.
2. Source release `maxvideoai-plugin-v0.3.4`, focused public release `v0.3.4`,
   focused repository `VERSION`, and the Official MCP Registry all agree on
   0.3.4.
3. The public release contains the reviewed current content and colorful
   screenshots and passes checksum verification.
4. mcp.film has received one factual maintainer correction.
5. Glama has a current bounded test profile and an honestly recorded health
   result.
6. MCPBeat, mcpdirectory.dev, and n8n have current observed states recorded;
   unresolved external review or crawl delay remains explicit.
7. No new capability, directory approval, host compatibility, trial, Audio, or
   montage claim is introduced without its own evidence.

## Rollback and Failure Handling

Checked-in documentation changes are reverted independently if their tests or
review reveal an overclaim. The immutable 0.3.4 release is never rewritten; a
material package defect requires a later patch release. The direct production
endpoint remains independent from third-party directory status, so an external
rejection or failed health check changes only that record. OAuth, paid
generation, and public indexing are not disabled merely to make an aggregator
green.
