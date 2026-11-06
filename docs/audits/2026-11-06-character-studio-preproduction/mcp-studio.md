# Character Studio / Recast: MCP and Studio prerelease audit

Audited 2026-11-06, branch `codex/character-studio-v2`, commit `c1bc6d0623ab34ad1868b6a71718b0d04adecf30`.

Scope: source and nonspending local tests for MCP discovery/preparation, saved character/look identity, Recast commercial scope, and Studio media continuation. No product code edit, provider generation, deployment, or production write was performed. Existing untracked `output/character-studio-v2/` was preserved. This report does not certify live host selection, production flags, deployment alignment, or provider quality.

## Conclusion

The candidate reuses sound shared generation, media and timeline foundations, but **Character Studio/Recast is not fully integrated as a product into MCP or conversational Studio**. Generic owned media can flow through those systems. Named saved characters/looks and Recast's own quote flow cannot. There is also a reproduced direct-UI continuation defect. These are P2 integration gaps; they block a release acceptance criterion that explicitly promises complete MCP + Studio integration, without establishing a defect in ordinary Wan billing.

| Journey | Current source behavior |
| --- | --- |
| Character output → Recast | Dedicated selection and owned original validation exist; focused picker/look tests pass. |
| Character output → Studio directly | Studio action is hidden because the character result ID is a gallery ID, not `ma_…`. |
| Saved character/look → MCP or Studio by name/identity | No named-character service, tool, picker or reference schema is wired into either consumer. |
| Existing image/video asset → MCP generation | Generic owned media/reference tools exist, with canonical model preparation and pricing. |
| Existing media asset → Studio timeline | Existing picker supports explicit insert/replace and revisioned persistence; focused DOM tests pass. |
| Recast → MCP/Studio exact preparation | No adapter or published tool; generic Wan preparation is a different commercial product. |
| Recast completed video → other workspaces | Submission offers `/app?job=…`; subsequent generic Media/Studio continuation is a separate journey. |
| Studio/MCP image → saved Character Studio identity/look | The save owner only accepts a completed job whose snapshot surface is `character-builder`; a generic image is not an identity recipe. |

## Findings

### P2 — Direct Character result → Studio action never appears for real result IDs

`frontend/src/components/tools/character-builder/_components/CharacterContinuation.client.tsx:9` passes `result.id` unchanged as `asset.id` into `MediaDestinationActions`. Current result IDs are `${jobId}:result:${index + 1}` (`frontend/src/components/tools/character-builder/_lib/character-builder-helpers.ts:314-317`); history uses `${jobId}:historical:${index + 1}` (`_hooks/useCharacterBuilderHistoricalResults.ts:30-35`).

The Studio action is created only when `asset.id` matches `/^ma_[a-f0-9]{32}$/` (`frontend/components/library/MediaDestinationActions.client.tsx:75-76`). Other destinations resolve the original on click at lines 32-44, but this Studio branch does not. Saving to Media also does not replace the result's ID: `_hooks/useCharacterBuilderResultActions.ts:84-91` discards the saved asset response and sets a status message only.

**Reproduction:** mounted the actual `CharacterContinuation` and actual `MediaDestinationActions` with authenticated fixture state and Studio enabled. `character-job:result:1` produced seven transformation buttons and no “Use in Studio”; a `ma_11111111111111111111111111111111` control produced the Studio picker. Both initial renders made zero requests. The temporary nonspending probe passed (1/1). Existing tests only exercise a canonical `ma_…` fixture (`tests/media-destination-actions-dom.test.ts:4,13-26`), so they do not catch this entry path.

**Minimal fix:** give Character continuation an explicit owned-output resolution/promotion step, then pass the returned canonical asset identity to the existing picker, or extend the picker through its canonical job-output boundary. Preserve exact originals, account cancellation and explicit apply. Do not substitute the gallery ID or signed URL as identity. Add a DOM regression starting from an actual Character result ID and covering save/reload.

### P2 — MCP and Studio cannot address the saved character/look product

The named library is implemented separately in `frontend/server/character-studio/store.ts:41-86,89-138` and exposed through session routes. Saving writes `character_studio_characters` / `character_studio_looks`; it does not publish a character catalogue to MCP or attach a character identity to Studio.

All MCP registrations are in `frontend/src/server/mcp/server.ts:379-415`; none invokes the character library or Recast owner. `prepare_creator_tool` admits only Subtitles, Product Photo Editor, Product Video Editor, Lip Sync and Motion Transfer (`frontend/src/server/mcp/tools/creator-tools.ts:19-36`). `list_media` accepts only kind/cursor/limit (`tools/list-media.ts:8-12`) and returns ordinary asset metadata (`frontend/src/server/agent-api/media-library.ts:176-202`), with no character ID, look ID, saved recipe, or identity/looks relationship.

Searches of `frontend/src/server/mcp`, `frontend/src/server/studio`, the Studio route and plugin skills found no use of the character-library owners or `characterId`/`lookId`. Studio's generation source contract accepts attached library assets or exact ready project outputs (`frontend/src/server/studio/conversation-media-generation.ts:100-118`). Its normal tools can use a portrait as a reference image, but cannot resolve “use my saved Basil look” or preserve the Character Studio recipe through an identity-aware action.

The reverse save path is also absent: `frontend/server/character-studio/source.ts:40-46` requires a completed, visible `settings_snapshot.surface='character-builder'` job with builder traits. A generic Studio/MCP image cannot simply be saved as an identity/look. This guard is appropriate; weakening it would lose the recipe/lineage contract.

**Minimal integration:** add account-scoped read/selection adapters over the existing library owner, with exact original references and bounded names/looks. Define whether creating/saving a new identity/look from MCP/Studio is in release scope; implement it through the Character Builder owner and recipe validation if so. Add OAuth-client/project ownership and isolation tests. Merely adding “Character Studio” to instructions would advertise nonexistent functionality.

### P2 — Recast commercial preparation is unavailable through MCP and conversational Studio

The real Recast owner selects `wan-3-prime`, derives i2v/ref2v/v2v, validates/promotes its portrait, prepares selected passages, orders references and invokes `createCreatorGenerationService` with server-chosen `billingProduct: 'character-recast'` (`frontend/server/character-studio/recast.ts:17,54-62,70-133`). Its confirmation verifies the Recast binding and selects the same billing product (`:160-181`).

Only the browser/session route reaches it (`frontend/app/api/tools/character-studio/recast/prepare/route.ts:29-47`); `runCreatorHttp` constructs a `toolbox-session` actor (`frontend/src/server/tools/creator-http.ts:76-85`). OAuth and Studio quotes retain separate immutable origin/project scopes (`frontend/src/server/agent-api/generation-actor.ts:75-88`).

MCP default preparation calls the ordinary `createPrepareGenerationService` (`frontend/src/server/mcp/server.ts:266-283`). Studio's normal generation adapter calls the shared generic prepare service without the Recast product billing override (`frontend/src/server/studio/image-generation-service.ts:183-207`). The explicit product override exists in `frontend/src/server/tools/creator-generation-service.ts:35-38,67-90`; it is not supplied by those consumers.

Therefore generic Wan 3 Prime execution through MCP/Studio is **not** Recast execution or a guarantee of its configured provider-cost multiplier. Recast's price is its exact DB product policy, not a model alias (`frontend/server/pricing/quote-recast.ts:24-43`). The 2× fixture uses `marginPercent: 1`; this multiplier is configurable, not hardcoded, and this audit did not read live production policy.

The commercial test deliberately verifies isolation: 8 seconds of output plus 7.5 seconds of input at 720p produces a $4.34 Recast fixture quote, while ordinary model pricing remains independent (`tests/character-studio-recast-commercial-pricing.test.ts:74-93`). It also verifies that absence of an exact product rule fails closed. This is correct protection, not an overcharge/undercharge finding.

**Minimal integration:** add explicit Recast discovery/prepare/confirm/recovery adapters for OAuth and Studio, carrying their own actor scopes while reusing the trusted Recast product/pricing owner. Keep product selection server-authorized; do not accept an arbitrary discount/billing marker through generic settings or replay Toolbox quotes under another actor. Test transport parity of exact inputs, ordered references, passages, expiry, pricing revision and reservation identity.

## What already works at the shared boundary

- Character → Recast validates the selected job/original and can promote a completed output into an owned asset (`frontend/server/character-studio/recast.ts:18-45`). The picker/look suites passed.
- Generic Wan modes are in Studio certification (`frontend/app/(core)/(workspace)/app/studio/_shared/_lib/models/workspace-model-certification.ts:34,61,86,106,112`); catalogue workflow tests passed. Provider flags still determine current executability.
- Canonical `ma_…` assets can open the Studio film picker, resolve owned media, choose a film, and explicitly insert or replace (`frontend/components/library/StudioMediaAction.client.tsx:24-50`). The exact revision/idempotency receipt is retained after an ambiguous response. Tests verify explicit apply, replacement, conflict and read retry.
- MCP timeline tools reuse the same server edit owner (`frontend/src/server/agent-api/studio-timeline.ts:1-8`). Tool registration, editing and export gates remain separate. A successful timeline edit is not proof of enabled or completed MP4 export.
- Recast submission returns a normal job and links to its video history (`frontend/src/components/tools/character-builder/_components/CharacterStudioRecastSubmit.client.tsx:107-114`). The parent audit separately checks the actual browser continuation from that history.

## Validation executed

1. Focused command, 212 passed, 0 failed, 0 skipped:

   ```sh
   pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
     tests/media-destination-actions-dom.test.ts \
     tests/studio-media-action-dom.test.ts \
     tests/character-studio-look.test.ts \
     tests/character-studio-recast-character-picker.test.ts \
     tests/character-studio-recast-commercial-pricing.test.ts \
     tests/mcp-model-catalog.test.ts \
     tests/studio-video-catalog-workflows.test.ts \
     tests/wan-prime-reference-compatibility.test.ts
   ```

2. `pnpm mcp:client:check`: 194 passed, 0 failed, 1 skipped (195 total); the repository authoring-validator test is skipped because the Codex authoring validators are not installed. The subsequent deterministic evaluator completed successfully with 70 fixtures and 39 policy checks. Real-host metrics explicitly remain unrecorded. Log: `/tmp/character-mcp-client-check.log`.
3. Temporary actual-component continuation probe: 1 passed, 0 failed. Script: `/tmp/character-studio-continuation-probe.ts`. This reproduces the defect; it is not a product fix or a committed regression test.

The focused tests use fixtures/mocks and are not a production rollout or provider canary. No test here establishes selection by the installed Codex/Claude/ChatGPT host. Local test discovery output is also not the production MCP capability configuration.

## Minimum acceptance before claiming complete integration

1. Resolve the three findings or explicitly narrow the release promise to the web Character/Recast workspace plus manual generic-media reuse.
2. Verify one real saved identity and one look from the isolated preview through the exact Character → Studio path; insert/replace, reload, edit and reload again. Confirm no generation/charge is triggered by import/edit and a second account cannot read the source/project.
3. For the new product adapters, verify MCP tools/list discovery and Studio discovery against the same release candidate, then prepare equivalent Recast requests through each supported entry point and compare the exact canonical request and product quote. Include ordered character/product/audio slots and fractional selected video/audio passages.
4. Validate fresh-quote confirmation, expired/repriced quote rejection, lost-response recovery, exact existing-job recovery and one charge/refund in disposable PostgreSQL. Preserve OAuth-client/project/Toolbox origin isolation.
5. Exercise a fresh supported MCP host session after metadata deployment/reconnection and record host/version separately. Confirm named saved-character/looks selection and returned artifact links. A deliberately authorized paid canary, if required for release, needs separate exact quote approval; none was performed by this audit.

Normal production provenance, current-main/Quality CI and dual-domain alignment gates remain owned by the overall release audit.

## Parent browser audit addendum

The authenticated test preview also verified generic Studio reuse in the browser: Add media → Library → `basil-look.png` → Add to timeline inserted a five-second image clip, and a full reload retained it. No Milo message, generation or export was submitted. Screenshot `output/character-studio-v2/preproduction-2026-11-06/07-studio-persisted.png` shows the persisted clip and preview. This supports the generic-media path; it does not resolve any of the three identity-aware integration findings above. The Recast history was visible in `/app`, including the existing Dixie/Vesper videos and their immutable original costs; its Reuse dialogue had no direct Studio action. See the parent README for the exact browser scope and remaining device/runtime qualification.
