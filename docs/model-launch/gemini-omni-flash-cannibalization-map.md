# Gemini Omni Flash Cannibalization Map

Research Date: 2026-09-03

Purpose: preserve the existing Gemini Omni Flash authority while moving visible product language and capabilities to 1.1.

## Ownership Matrix

| Intent | Owner URL | Supporting URL | Canonical rule | Internal link rule |
| --- | --- | --- | --- | --- |
| model decision | `/models/gemini-omni-flash` | `/models`, pricing and selected comparisons | self-canonical | Version aliases point here in one hop. |
| Vertex implementation | `docs/engineering/google-vertex-omni.md` | official Google docs | not public/indexed | Keep implementation details out of marketing copy. |
| comparison | `/ai-video-engines/gemini-omni-flash-vs-veo-3-1` | model pages | self-canonical | Both model links remain balanced. |
| pricing | `/pricing#gemini-omni-flash-pricing` | model page | pricing page self-canonical | Use one descriptive pricing link. |
| examples | `/examples/veo` and the model-page gallery | model page | family gallery remains canonical | Attach accepted 1.1 renders as ordinary gallery media. |
| workspace generation | `/app?engine=gemini-omni-flash` | model page | authenticated application surface | CTA only. |

## Noindex Or Do Not Publish

- Do not publish `/models/gemini-omni-flash-1-1`; it is an alias of the existing model owner.
- Do not publish a separate Omni 1.1 API or Vertex SEO page unless it adds first-party implementation value.
- Do not create phrase-order duplicates for existing comparison pages.
- Do not enroll the two launch examples in the watch-page/video-SEO rollout at launch.

## Canonical And Hreflang Notes

- English: `/models/gemini-omni-flash`
- French: `/fr/modeles/gemini-omni-flash`
- Spanish: `/es/modelos/gemini-omni-flash`
- The two aliases `gemini-omni-flash-1-1` and `gemini-omni-flash-preview` resolve directly to the same owner.
- Existing comparisons retain their English, French, and Spanish URL shapes.

## Page Boundaries

- Model page: 1.1 capabilities, examples, prompting and high-level choice.
- Comparison pages: numeric scoreboard, compact specs, and a short verdict.
- Pricing: exact product price by duration and resolution.
- Engineering docs: credentials, model IDs, polling, and provider operations.
