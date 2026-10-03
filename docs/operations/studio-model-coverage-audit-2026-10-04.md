# Studio model coverage audit — 2026-10-04

## Result and scope

The original Studio conversation allowlist exposed only five IDs: `wan-3`, `seedance-2-0-mini`, `minimax-h3`, `gpt-image-2-5-flare`, and legacy `gpt-image-2`. It hid 25 current models that already had compatible Studio certification. It was a conversation restriction, not evidence that Veo or the other models were unavailable on MaxVideoAI.

The bounded local change removes this redundant allowlist. Discovery, details, preparation, estimation and confirmation continue through canonical publication/runtime availability, then exact Studio model/block/workflow certification and conversation adapter support. Under the test's all-ready provider fixture, this yields **29 current and 10 published legacy models, 78 mode tuples**. It does not publish or certify another model. Real server readiness can reduce this catalog.

This is a source and fixture audit, plus a captured live read-only MCP discovery result. It is not a production Studio execution test, media-quality comparison, paid-generation test or proof of provider delivery. No credentials, provider generation APIs or production writes were used for this audit/implementation.

## Evidence and baseline reconciliation

- Worktree baseline: `eb581c5cdf924bd3f802d9b0e1ea9ec39e58810c`; target main: `5251f4d3f`. Both had the same 55 canonical model IDs. The problem was publication/policy drift and conversation visibility, not missing registry identities.
- Authored identity/publication: `frontend/config/model-registry.json`; generated projections: `model-runtime.json`, `engine-catalog.json`, frontend/docs rosters. Studio readiness: `workspace/_lib/models/workspace-model-certification.ts`; conversation authority: `generation-actor.ts` and the filter in `image-generation-service.ts`.
- Actual MCP `list_models({})` capture supplied by the parent agent: `output/studio-creative-workspace/human-validation/live-mcp-catalog-2026-10-04.json`, 38 current generation-enabled models, SHA-256 `bbbb42000d137a09926c1685eca4cf11862cdd868591a754d26cceb73e93fa52`. This supports discovery availability and modes at capture time, not successful generation. Sora and legacy GPT Image 2 were absent from default discovery.
- Official live [model directory](https://maxvideoai.com/models) shows current families/versions. Individually inspected official pages include [Seedance 2.5](https://maxvideoai.com/models/seedance-2-5), [Veo 3.1](https://maxvideoai.com/models/veo-3-1), [MiniMax H3 Max](https://maxvideoai.com/models/minimax-h3-max), [Wan 3 Prime](https://maxvideoai.com/models/wan-3-prime), [Sunburst](https://maxvideoai.com/models/gpt-image-2-5-sunburst), and [Seedance 1.5 Pro](https://maxvideoai.com/models/seedance-1-5-pro). Not every individual model page was fetched; the table's marketing column is registry publication, not browser certification of every page. Two Kling Turbo page fetches timed out; directory and MCP evidence are used for its presence.

Restored target-main policy: `seedance-1-5-pro` is `deep_legacy`, app/pricing publication false, family-current-copy membership false. Restored historical input aliases: `veo-3-fast` and `veo3fast` → `veo-3-1-fast`; `pika-image-to-video` → `pika-text-to-video`. The existing Flare Studio certification is retained. Seedance 1.5 was removed from editorial reference entries; the policy version changes to `2026-10-04.1`, retaining the original `2026-10-03` review date rather than claiming a new quality review.

Public archive rendering/copy for Sora and Seedance 1.5 is owned by the parallel published-baseline work. Keeping a historical URL does not imply that it is executable. Pricing audit results are tracked separately.

## Current models by surface

`Studio` below means the local fixture's eligible conversation modes after the change. `App / model page` means canonical registry publication. All rows were returned by the captured live MCP default catalog with `generationEnabled: true`. A model may have additional modes in MCP or Canvas without the conversation adapter being authorized to use them.

| Exact model ID | Live MCP modes | Studio conversation | App / model page |
| --- | --- | --- | --- |
| `flux-3` | t2v, i2v, fl2v, extend | Excluded: no Studio certification | yes / yes |
| `flux-3-draft` | t2v, i2v, fl2v, extend | Excluded: no Studio certification | yes / yes |
| `gemini-omni-flash` | t2v, i2v, ref2v, fl2v, v2v, extend | t2v, i2v | yes / yes |
| `gpt-image-2-5-flare` | t2i, i2i | t2i, i2i | yes / yes |
| `gpt-image-2-5-sunburst` | t2i, i2i | Excluded: no Studio certification | yes / yes |
| `grok-imagine-video-1-5` | t2v, i2v, ref2v | Excluded: no Studio certification | yes / yes |
| `happy-horse-1-1` | t2v, i2v, ref2v | t2v, i2v | yes / yes |
| `kling-3-4k` | t2v, i2v | t2v, i2v | yes / yes |
| `kling-3-pro` | t2v, i2v | t2v, i2v | yes / yes |
| `kling-3-standard` | t2v, i2v | t2v, i2v | yes / yes |
| `kling-3-turbo-pro` | t2v, i2v | Excluded: no Studio certification | yes / yes |
| `kling-3-turbo-standard` | t2v, i2v | Excluded: no Studio certification | yes / yes |
| `kling-o3-4k` | t2v, i2v, ref2v | t2v, i2v | yes / yes |
| `kling-o3-pro` | t2v, i2v, ref2v, v2v | t2v, i2v | yes / yes |
| `kling-o3-standard` | t2v, i2v, ref2v, v2v | t2v, i2v | yes / yes |
| `ltx-2-5-fast` | t2v, i2v, a2v | Excluded: no Studio certification | yes / yes |
| `ltx-2-5-pro` | t2v, i2v, a2v | Excluded: no Studio certification | yes / yes |
| `luma-ray-3-2` | t2v, i2v, v2v, reframe | t2v, i2v | yes / yes |
| `luma-uni-1` | t2i, i2i | t2i, i2i | yes / yes |
| `luma-uni-1-max` | t2i, i2i | t2i, i2i | yes / yes |
| `minimax-h3` | t2v, i2v, ref2v | t2v, i2v | yes / yes |
| `minimax-h3-max` | t2v, i2v, ref2v | Excluded: no Studio certification | yes / yes |
| `minimax-hailuo-02-text` | t2v, i2v | t2v, i2v | yes / yes |
| `nano-banana-2` | t2i, i2i | t2i, i2i | yes / yes |
| `nano-banana-lite` | t2i, i2i | t2i, i2i | yes / yes |
| `nano-banana-pro` | t2i, i2i | t2i, i2i | yes / yes |
| `pika-text-to-video` | t2v, i2v | t2v, i2v | yes / yes |
| `seedance-2-0` | t2v, i2v, ref2v, v2v, extend | t2v, i2v | yes / yes |
| `seedance-2-0-fast` | t2v, i2v, ref2v, v2v, extend | t2v, i2v | yes / yes |
| `seedance-2-0-mini` | t2v, i2v, ref2v, v2v, extend | t2v, i2v | yes / yes |
| `seedance-2-5` | t2v, i2v, ref2v, extend | t2v, i2v | yes / yes |
| `seedream` | t2i, i2i | t2i, i2i | yes / yes |
| `seedream-5-0-pro` | t2i, i2i | t2i, i2i | yes / yes |
| `veo-3-1` | t2v, i2v, ref2v, fl2v, extend | t2v, i2v | yes / yes |
| `veo-3-1-fast` | t2v, i2v, ref2v, fl2v, extend | t2v, i2v | yes / yes |
| `veo-3-1-lite` | t2v, i2v, fl2v, extend | t2v, i2v | yes / yes |
| `wan-3` | t2v, i2v, ref2v, v2v, extend | t2v, i2v | yes / yes |
| `wan-3-prime` | t2v, i2v, ref2v, v2v, extend | t2v, i2v | yes / yes |

The nine intentionally excluded current IDs are `kling-3-turbo-pro`, `kling-3-turbo-standard`, `minimax-h3-max`, `ltx-2-5-fast`, `ltx-2-5-pro`, `grok-imagine-video-1-5`, `flux-3`, `flux-3-draft`, and `gpt-image-2-5-sunburst`. All are published and in the live MCP capture; none has the required Studio certification tuple. Their presence on the site cannot authorize their conversation execution.

## Historical and hidden identities

| Exact IDs | Registry state | Studio fixture | Default MCP discovery / app / model page |
| --- | --- | --- | --- |
| `gpt-image-2`, `nano-banana` | legacy | t2i, i2i; explicit choices retained | absent / yes / yes |
| `happy-horse-1-0`, `kling-2-5-turbo`, `kling-2-6-pro`, `ltx-2-3`, `ltx-2-3-fast`, `lumaRay2`, `lumaRay2_flash`, `wan-2-6` | legacy | t2v, i2v; explicit choices retained | absent / yes / yes |
| `seedance-1-5-pro`, `sora-2`, `sora-2-pro`, `ltx-2`, `ltx-2-fast`, `wan-2-5` | deep_legacy | excluded | absent / no / yes |
| `seedance-2-0-fast-byteplus` | current, private | excluded | absent / no / no |

For legacy rows, absence means the captured default MCP catalog plus the current-only default-discovery contract; it does not deny exact-ID execution where published and ready. Retired execution definitions may remain for historical jobs and polling. No source identity or saved model selection is rewritten to a successor.

Studio visual catalog summaries and model details now include canonical `lifecycle`. Audio entries use `null` in catalog summaries because their identity owner differs. The director's separate instruction uses current compatible models first; legacy models remain for explicit choice or an explained concrete fit after current options are considered. Canonical automatic recommendations already filter to current models. Preserving legacy execution must not be read as making legacy a default recommendation.

## Action-specific recommendation and adapter boundaries

- Start with the requested action, owned inputs, format, duration, audio and actual available modes. Only then apply editorial preference for reviewed exact Seedance, Wan and Kling IDs. Pika stays discoverable for an explicit request. Editorial preference is neither a measured quality score nor runtime/certification authority.
- The director should normally propose one suitable model. The canonical recommendation helper can still return a small family-diverse comparison set when comparison is requested. An exact unavailable request must report its scoped limitation and obtain an explicit alternative choice; request builders do not silently substitute another model.
- Conversation video remains `t2v`/`i2v`, image remains `t2i`/`i2i`, one output, owned image references, maximum eight references. Reference-to-video, first/last-frame workflows, source-video editing, extension, source-audio modes and required multi-prompt structures remain outside its authority. A reference mention alone is not timeline insertion or generation intent.
- Current model details and shared canonical quote validation remain authoritative for settings and price. Broad catalog visibility does not allow the director to invent a price or skip the human's exact paid-quote confirmation.

## Verification and discovered defects

The test `tests/studio-conversation-catalog-matrix.test.ts` uses actual engine definitions, registry publication/lifecycle, public-mode projection, Studio certification, conversation details, image/video request builders, normalization, request authority and the shared pricing-read validator. Only provider readiness, reference metadata, membership and the final tariff are fixtures. The tariff is 123 cents solely as a deterministic test value; it is not a canonical or live model price.

Coverage checks the literal 29-current/10-legacy catalog, all 78 mode tuples, exact model/settings preservation, valid preset/custom image sizing, required image references, invalid resolutions, runtime and mode-level exclusion, the nine uncertified IDs, archived/private exclusion, unsupported actions, 4K fit over an incompatible preferred model, current image recommendations, and explicit Pika/unavailable choices. The matrix found and fixed a real latent default mismatch: Wan 2.6's safety enum projected string values, while canonical provider-control validation requires booleans. Canonical details now project those historical true/false enums as booleans; direct MCP details coverage locks this behavior.

Focused verification at this stage:

- 148 tests pass across catalog matrix, conversation generation options, registry parity, MCP catalog/details/recommendations, editorial policy, and conversation director.
- 65 session, model projection, request-option and workspace architecture tests pass. Disposable local PostgreSQL and a provider harness check exact quote scope, no charge on preparation, confirmation deduplication and preserved reference snapshots. This is not a real money or provider test.
- `pnpm model:registry:check`, frontend TypeScript, frontend lint and `npm run lint:exposure` pass. Lint has six existing `next/no-img-element` warnings in untouched conversation components. `git diff --check` passes.
- Local logs: `output/studio-creative-workspace/human-validation/catalog-{expansion-green,session-regression,registry-check,typecheck,lint}.log`. Failed-before-fix evidence is retained in `catalog-expansion-red.log`, `catalog-details-red.log`, and `catalog-lifecycle-red.log`. Whole-branch release validation is owned by the parent task.

## Remaining bounded work

Do not blindly admit the remaining nine models. For a requested new model/action, add and verify exact model/block/workflow certification, representable settings and references, normalized quote/submission parity, then separately exercise its provider under explicit live-test authorization. Prioritize concrete user needs, especially requested Kling/Seedance/Wan workflows, without converting editorial preference into another fixed allowlist.

Next targeted conversation probes should contrast (1) a compatible current exact model such as Veo or Seedance, (2) an explicitly requested legacy model, (3) a published but uncertified model such as Sunburst or Kling Turbo, and (4) an unsupported reference/extension action. Verify that the assistant says “unavailable in this Studio workflow” where appropriate, proposes one current compatible fit without pretending to execute it, preserves the original artistic intent, and never quotes fixture prices as live facts. Synthetic advice probes do not replace visual review, genuine customer research or provider canaries.
