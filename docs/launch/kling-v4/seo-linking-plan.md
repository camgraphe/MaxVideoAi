# Kling 4 — additive marketing and SEO placement

22 October 2026. Prepared destinations and copy; no public links, clips, playlist changes or indexability changes have been applied. `media-qualification.md` owns the admin procedure and current-order snapshot. The authored registry and actual launch readiness must govern every link.

## Existing search landing remains the family

Keep `/examples/kling`, its localized equivalents, canonical, stable family title and earlier-model sections. Do not redirect it or a historical Kling model to V4. `frontend/lib/examples/family-overview.ts` already supplies evergreen family copy. `frontend/config/model-families.ts` materializes eligible members from publication and readiness; V4 is now explicitly asset-gated there. Its missing clips must never create an empty public version link.

When real V4 videos are approved, use the existing `family-kling` collection and insert selected clips through `/admin/playlists`, with the fresh current revision/preview. Preserve all previous IDs, relative order and owner-selected featured/preferred values. Keep exact model labels and original prompts on older clips. The model's own collection is `examples-kling-v4`; it does not replace the family. Reordering performed manually by Adrien is authoritative.

A short additive paragraph for the existing family, only after V4 is available and its examples exist:

- EN: “Explore Kling 4.0 examples with the original prompt, shot plan and generation settings. Compare them with earlier Kling clips below, including image-to-video and reference-guided scenes.”
- FR: « Découvrez les exemples Kling 4.0 avec leur prompt d’origine, leur découpage et leurs réglages. Comparez-les aux vidéos des versions précédentes ci-dessous, notamment les scènes guidées par une image ou des références. »
- ES: « Explora ejemplos de Kling 4.0 con el prompt original, el plan de planos y los ajustes. Compáralos con los clips de versiones anteriores, incluidas escenas guiadas por imágenes y referencias. »

Only show a shot-plan claim for an actual multi-shot source. Do not describe a one-prompt generation as an authored shot plan.

## Link locations and reader purpose

| Source | Destination and purpose | Bound |
| --- | --- | --- |
| Existing Models menu | `/models/kling-v4`, within the existing Kling group, once registry discovery and readiness pass | One new model entry; editorial New badge using the existing menu/card projection; review removal 30 days after launch, no duplicated group |
| Existing Examples menu | `/examples/kling`, retaining family identity | No separate V4 top-level examples menu |
| Kling family version links | V4 model/examples filter alongside current/historical versions | Add V4 without deleting earlier links or making old URLs aliases of V4 |
| V4 normal model page | Family examples and one appropriate same-family comparison | Use supported visible claims and selected real clips |
| Existing Kling comparison | Add V4 only where the reader is choosing between versions; default candidate Kling 3.0 Omni vs Kling 4.0 | No broad all-model comparison rollout; actual available modes/prices and footage first |
| Homepage / popular-model cards | Optional accepted cinematic clip and exact model card after user selection | Replace an approved existing slot; no extra autoplay row or unmeasured best-seller claim |
| Selected `/video/{id}` pages | V4 model + Kling family + relevant prompt/use case | Only selected complete clips through `/admin/video-seo`; no blanket enrollment |
| YouTube description, when individually approved for publication | Most useful landing for the demonstrated scene: model or family | Preserve source clip/prompt IDs for reuse; no publication authorized by this plan |

The menu, catalogue and family-order candidates are now coded, while their public visibility remains a release step after accepted media exists. Do not automatically demote a historical family model or override a user-selected hero.

## Search and citation content

Use the factual terms Kling 4.0, multi-shot video, image-to-video, reference-to-video, native audio and video editing in sections that demonstrate them. These are capability terms from the documented contract, not verified search volumes or a newly measured trend. The existing GSC opportunity was observed for FLUX; do not represent it as Kling demand. A fresh dated GSC/Semrush comparison is needed before making a Kling traffic claim.

Make the page easy to cite with a concise capability table, source/date links and clear limitations: integer 3–30s output,720p/1080p, frame inputs only in supported modes, subject references and exact available audio controls. The fal voice API existing does not establish owned voice selection in MaxVideoAI. Quality scores require review of actual outputs against explicit criteria; absent scores remain absent. No special GEO schema is required. Use the existing supported structured data, with VideoObject only for an accepted playable indexed video and its original duration/thumbnail.

## Release verification

Capture before/after family content, canonical/hreflang, existing video links and curation revision. Confirm no old clips disappear and filters retain exact model identity. Inspect menu/card output in EN/FR/ES, check no duplicates or hidden-model links, and validate selected video SEO pages with real original/poster/preview metadata. Keep existing lazy card previews and responsive geometry; measure hero transfer/first-play before replacing a homepage slot. Historical search traffic should be compared over the same dates and pages after release, without attributing every fluctuation to the launch.

## Implemented preparation in this branch

- `navigation.ts`: one V4 candidate beside the current Kling entries, with the shared New badge. A non-indexable preview does not enter public discovery or displace a predecessor. The menu keeps its eleven-item limit; the comparison menu keeps its ten-item limit.
- `models/catalog.ts` and the existing catalogue decision owner: current-model priority, localized short cards and one promotion candidate. The five-item featured catalogue remains bounded; the selected FLUX homepage hero is untouched. A candidate only appears when supplied by public catalogue discovery.
- `content/comparisons/kling-o3-pro-vs-kling-v4.json`: complete EN/FR/ES introductory comparison copy. Menu, catalogue and family next-step candidates use this same canonical destination. The registry compare graph remains closed, and no public pair or score has been fabricated.
- Existing PAYG content and discovery owners: localized descriptions and a 5s/720p price/scenario candidate, resolved only through real published pricing rows. No authored numeric price or fallback app link activates V4.
- Existing Best-for guidance owner: concise controls/limits copy. No leaderboard recommendation is inferred from the version number.
- Existing family owner: V4 presentation order and localized additive copy depend on published family membership plus accepted media readiness. The default model remains Kling 3.0 Omni Pro. Family canonical, historical descriptions and admin playlist order are preserved.
- `data/benchmarks/kling-v4-evidence.v1.json`: eleven-criterion research and measurement dossier, not a public score source. See `scoreboard-evidence-2026-10-22.md` for dated sources, exclusions and missing observations.

The New badge uses the existing editorial mechanism; it does not expire automatically. Record the real launch date and schedule its editorial removal/review at launch. No new scheduler or independent publication switch is introduced here.

At activation, review the registry's compare relationships for the single prepared pair, complete its criterion evidence and localized scoreboard through their existing owners, then enable the relevant publication fields. Model-page example/pricing/comparison CTAs also remain intentionally internal anchors in this private preparation; wire their real destinations with accepted assets and active prices. Preparation does not authorize activation, missing-media substitution or a homepage hero change.
