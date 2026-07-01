# Gemini Omni Flash Internal Linking Plan

Research Date: 2026-07-01

Purpose: define crawlable, descriptive internal links for Gemini Omni Flash launch pages while avoiding link stuffing and intent cannibalization.

## Anchor Rules

- Use descriptive, concise anchors.
- Avoid generic anchors that do not identify the destination.
- Avoid repeating exact-match "Gemini Omni Flash" more than necessary in dense sections.
- Use comparison anchors only on pages where a comparison helps the user choose.
- Keep model page quick links limited to the most relevant pages.
- Prefer localized route segments for French and Spanish pages.
- Link to canonical owner URLs, not aliases or duplicated intent pages.

## Required Links

| Source URL | Target URL | Anchor Text | Placement | Reason |
| --- | --- | --- | --- | --- |
| /models/gemini-omni-flash | /ai-video-engines/gemini-omni-flash-vs-veo-3-1 | Compare Gemini Omni Flash vs Veo 3.1 | hero quick link | Explicit model-vs-model decision path. |
| /models/gemini-omni-flash | /ai-video-engines/gemini-omni-flash-vs-sora-2 | Compare Omni Flash with Sora 2 | comparison section | Natural next choice for users comparing stateful editing against Sora. |
| /models/gemini-omni-flash | /pricing#gemini-omni-flash-pricing | Gemini Omni Flash pricing | pricing section | Pricing intent belongs on pricing hub once product pricing is confirmed. |
| /models/gemini-omni-flash | /app?engine=gemini-omni-flash | Open Gemini Omni Flash in the workspace | primary CTA | Conversion path. |
| /models/veo-3-1 | /ai-video-engines/gemini-omni-flash-vs-veo-3-1 | Compare with Gemini Omni Flash | compare section | Natural adjacent Google model comparison. |
| /ai-video-engines/gemini-omni-flash-vs-veo-3-1 | /models/gemini-omni-flash | Gemini Omni Flash model specs | model card/link block | Sends model-detail intent back to model page. |
| /ai-video-engines/gemini-omni-flash-vs-veo-3-1 | /models/veo-3-1 | Veo 3.1 model specs | model card/link block | Keeps comparison balanced. |
| /pricing | /models/gemini-omni-flash | Gemini Omni Flash specs and limits | model pricing row | Pricing users can inspect model constraints. |
| /models | /models/gemini-omni-flash | Gemini Omni Flash | model grid card | Discovery path from catalog. |
| /fr/modeles/gemini-omni-flash | /fr/comparatif/gemini-omni-flash-vs-veo-3-1 | Comparer Gemini Omni Flash et Veo 3.1 | hero quick link | French localized comparison path. |
| /fr/tarifs | /fr/modeles/gemini-omni-flash | Specs et limites de Gemini Omni Flash | model pricing row | French pricing users can inspect model constraints. |
| /es/modelos/gemini-omni-flash | /es/comparativa/gemini-omni-flash-vs-veo-3-1 | Comparar Gemini Omni Flash con Veo 3.1 | hero quick link | Spanish localized comparison path. |
| /es/precios | /es/modelos/gemini-omni-flash | Specs y limites de Gemini Omni Flash | model pricing row | Spanish pricing users can inspect model constraints. |

## Links To Avoid

- Do not link every Veo mention sitewide to Omni.
- Do not add Omni links to unrelated model pages unless the comparison is genuinely relevant.
- Do not publish `/blog/gemini-omni-flash-vertex-ai` unless research shows a distinct implementation intent that should be public.
- Do not link the public model page to internal engineering docs.
- Do not add repeated pricing anchors until MaxVideoAI pricing is confirmed and the pricing row exists.
- Do not use generic CTA labels that hide the destination.

## Placement Limits

| Surface | Link Limit | Allowed Target Types |
| --- | --- | --- |
| /models/gemini-omni-flash | 4-6 prominent internal links | workspace CTA, pricing anchor, 2-3 comparisons, examples only after real outputs exist |
| comparison pages | 2-4 model-detail links | left/right model pages, pricing only if relevant, workspace CTA only near conversion modules |
| pricing page | 1 model-detail link from the row | model page only |
| /models catalog | 1 card link | model page only |
| examples page, if later published | 1 model link plus optional workspace CTA | model page and workspace CTA |

## Verification Notes

- Confirm links are rendered as crawlable anchors in server-rendered or hydrated markup.
- Confirm French and Spanish localized paths resolve through the existing `next-intl` route mappings.
- Confirm no page receives multiple links with identical anchor text from the same section.
- Confirm links point to the canonical owner in the cannibalization map.
