# Character Studio — discovery, pricing and lifecycle audit

Review date: 2026-11-05. Branch: `codex/character-studio-v2`. Preview only. No new paid render, production publication, tariff activation or production database change.

## Implemented

- Homepage: dedicated below-fold visual section pairing the actual Dixie and Vesper Recasts with their character references. Manual playback, sound available, deferred posters, stable geometry, no autoplay. Catalog reads stream separately from the unchanged opening hero.
- Character Studio Explorer: the same independently published films and a direct Recast entry. Public Examples: optional proof after the existing SSR gallery/pagination, excluding duplicate video URLs. The homepage link targets its stable `character-studio` anchor.
- Marketing: Character Studio naming aligned across EN/FR/ES, footer, contextual blog CTAs and model-example alt text. The explanatory “previously Character Builder” FAQ remains. Existing public URLs, metadata owners, guides, sitemap and localized route mappings are preserved.
- Pricing: one-image billing explained for portrait and sheet; a dedicated Recast row describes the actual quote inputs instead of recycling a historical demo charge. No invented fixed price or future margin is advertised.
- New character: clears custom appearance, clothing, scene and direction along with the other draft fields and references. Removes stale `job` and `mode` route instructions. An older in-flight result can enter history but cannot replace the new draft. Leaving and returning restores a genuine saved draft with a visible notice and a restart action; saved characters are not deleted. Recast's separate draft remains preserved when switching modes.

## Price evidence

Read-only checks on the isolated cloud preview compared `/api/images/estimate` with `/api/pricing/quote` for Nano Banana 2.1: text-to-image and image-reference modes, one image each, at 1K/2K/4K. All six pairs returned exact matching quotes: **$0.07 / $0.11 / $0.23**, tariff revision **2115**. These are the preview's observed customer prices, not provider cost or a guarantee of future prices. Local development intentionally cannot execute the production tariff reader; its unavailable-price state must not be “fixed” by weakening that guard.

The requested Recast provider-cost ×2 policy is a commercial target, **not activated by this change**. Before commercial release, its scoped admin policy, effective quotes, ledger charges and refunds still need a separate agreed-price qualification. The marketing row continues to direct users to the current exact application quote.

## Competitor comparison

Official public interfaces inspected in Codex on 2026-11-05, without account creation or paid generations. Screenshots retained in the local QA directory. Supporting sources: [Higgsfield AI Influencer help](https://higgsfield.ai/creator-hub/help-center/tools/how-do-i-use-ai-influencer), [Higgsfield studio](https://higgsfield.ai/ai-influencer-studio), [Pollo Recast](https://pollo.ai/recast), [Pollo AI Influencer](https://pollo.ai/ai-influencer).

| Area | Observed competitor pattern | MaxVideoAI assessment |
| --- | --- | --- |
| Creation | Large optional reference-photo area, visual type selectors, compact categories and persistent Generate | Same useful direction; New and visible draft restoration now prevent hidden instructions carrying over |
| Discovery | Higgsfield separates creation/motion and Explorer/history; Pollo exposes many Recreate examples | Dixie/Vesper provide real proof in our discovery surfaces; two films are not yet a broad reusable motion-template catalog |
| Recast inputs | Pollo exposes a reference video, reference images, optional prompt and quality; Higgsfield Motion exposes transfer and object swap | Saved identity/look handoff, separate video/audio excerpts, product reference and dialogue/duration are useful workflow choices. Paid comparative output quality was not tested |
| Purchase clarity | Credit-based creation actions visible in the inspected public interfaces | USD image quotes match our public pricing API; output/resolution choices are visible. Recast's separate commercial margin still needs activation and qualification |
| Publication | Pollo's inspected advanced panel exposes public visibility/copy-protection options | Our marketing examples come from explicitly published independent copies; private customer jobs are not a fallback source |

These observations are a product comparison, not a claim that every competitor account, plan or paid result behaves identically. The main remaining opportunities are a curated, rights-reviewed motion-template catalog with a real reusable source handoff; a convincing approved product/UGC example; and broader scenario coverage before release. Opening Recast is deliberately not labelled “recreate this result”.

## Validation

Behavioral tests cover empty/new/reset/reload, full prompt cleanup, late asynchronous results and account isolation; EN/FR/ES proof readers and truthful unavailable-media states; public gallery contracts; homepage loading/streaming; and pricing projections. Live cloud checks, the candidate commit and the preview URL are recorded in the PR. The readonly source review found a missing Examples anchor, corrected before publication.

Production release still requires current-main alignment, successful required Quality CI, the deployment provenance gate and user validation of the preview. This audit does not certify Core Web Vitals improvements, generation fidelity, external reference rights or production tariff activation.
