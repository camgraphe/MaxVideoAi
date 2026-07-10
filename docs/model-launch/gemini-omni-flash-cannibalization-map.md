# Gemini Omni Flash Cannibalization Map

Research Date: 2026-07-01

Purpose: assign one canonical owner for each Gemini Omni Flash search intent before public model, comparison, pricing, examples, and implementation surfaces are created.

## Ownership Matrix

| Intent | Owner URL | Supporting URLs | Pages That Must Not Target This Intent | Canonical Rule | Internal Link Rule |
| --- | --- | --- | --- | --- | --- |
| model decision | /models/gemini-omni-flash | /pricing, /models, selected comparisons | engineering docs, blog implementation posts, examples pages | self-canonical | Comparisons link back with "Gemini Omni Flash model specs" or equivalent descriptive anchor. |
| Vertex implementation | docs/engineering/google-vertex-omni.md | none public at launch | /models/gemini-omni-flash, /ai-video-engines/gemini-omni-flash-vs-veo-3-1, /pricing | not public/indexed | Keep implementation details out of the model page except a high-level access note. |
| comparison | /ai-video-engines/gemini-omni-flash-vs-veo-3-1 | /models/gemini-omni-flash, /models/veo-3-1, selected Sora/Seedance comparisons | /models/gemini-omni-flash, /pricing, engineering docs | self-canonical | Model page links to only the top 2-3 comparison pages, not every possible vs route. |
| pricing | /pricing#gemini-omni-flash-pricing | /models/gemini-omni-flash | comparison pages, engineering docs, examples pages | pricing page self-canonical | Use pricing anchors only where MaxVideoAI product pricing is confirmed. |
| examples | /examples/gemini-omni or no page | /models/gemini-omni-flash | model page, comparison pages, pricing page | self-canonical if published | Publish examples only after real MaxVideoAI Omni outputs exist, then link from model page once. |
| workspace generation | /app?engine=gemini-omni-flash | /models/gemini-omni-flash | public SEO pages | app remains auth/workspace surface | CTA only; do not write SEO copy around the workspace URL. |

## Noindex Or Do Not Publish

- Do not publish `/blog/gemini-omni-flash-vertex-ai` at launch unless a later research pass shows distinct public implementation demand and the article adds MaxVideoAI production lessons beyond official Google docs.
- Do not publish `/blog/gemini-omni-flash-api` while the article would mainly restate Google AI and Google Cloud API examples.
- Do not publish `/examples/gemini-omni` before real MaxVideoAI outputs, prompts, cost metadata, and approved media are available.
- Do not expose `docs/engineering/google-vertex-omni.md` as an indexable public SEO page. It is the internal owner for Vertex implementation and operations intent.
- Do not create separate comparison pages for phrasing variants such as `google-veo-vs-gemini-omni-flash`; point those terms to the canonical Omni vs Veo comparison owner.

## Canonical And Hreflang Notes

- English model canonical: `/models/gemini-omni-flash`.
- French model path: `/fr/modeles/gemini-omni-flash`.
- Spanish model path: `/es/modelos/gemini-omni-flash`.
- English comparison canonical: `/ai-video-engines/gemini-omni-flash-vs-veo-3-1`.
- French comparison path: `/fr/comparatif/gemini-omni-flash-vs-veo-3-1`.
- Spanish comparison path: `/es/comparativa/gemini-omni-flash-vs-veo-3-1`.
- Pricing localized paths should use `/pricing`, `/fr/tarifs`, and `/es/precios` with the same anchor only after the public pricing row exists.

## Page Boundaries

- The model page may mention Vertex/Agent Platform access only in a short availability note and should link to no public implementation guide at launch.
- The model page may include one pricing summary, but the pricing hub owns detailed price tables and billing caveats.
- The model page may include examples previews only after `/examples/gemini-omni` exists; until then, avoid placeholder examples.
- Comparison pages must not duplicate the full model page specs table. They should summarize enough specs to help users choose, then link back to model pages for detail.
- Pricing copy must not claim search volume, demand, or cost savings without first-party pricing data.
