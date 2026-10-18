# Omni and Veo variant intent — 2026-10-18

Five existing comparison routes are clarified in EN, FR and ES: Omni/standard
Veo, Omni/Fast, standard/Fast, Fast/Lite and standard/Lite. Their SEO titles,
H1s, meta descriptions, canonical URLs, robots policy and hreflang remain
unchanged. Omni/Fast now has editorial content in the existing strict document
loader; its metadata still comes from the generic template. No new pair is
published and no comparison registry or sitemap policy changes.

The shared template retains selectors, independent galleries, pricing and
score/specification tables. Each opening explains the exact variant and links
to two existing related comparisons. The shared navigation's accessible label
is model-neutral instead of always saying “LTX version comparisons”.

Editorial decisions:
- Distinguish source-video editing from extending a clip.
- Avoid implying standard Veo alone supports several references: Fast also does.
- Separate Lite's start image/first-last frames from multiple subject references.
- Do not guarantee a faster delivery, a better standard-Veo take or a need to
  regenerate a successful Fast/Lite result with a more expensive model.
- Keep current price calculations and generated Omni FAQs; authored Veo FAQs
  explain how to compare quotes without embedding a new fixed price.

## Evidence and limitation

Sources checked on 2026-10-18:
- [Google Omni 1.1 Flash](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/omni-1-1-flash)
- [Google Veo features](https://ai.google.dev/gemini-api/docs/veo?hl=en)
- [Google Veo Lite](https://ai.google.dev/gemini-api/docs/models/veo-3.1-lite-generate-preview?hl=en)
- [fal Veo Fast reference-to-video schema](https://fal.ai/models/fal-ai/veo3.1/fast/reference-to-video/api)
- Existing engine capability definitions and public pricing projection in this repo.

Lite Extend needs a separate provider verification. MaxVideoAI's catalog exposes
it, but Google's Gemini API documentation excludes it. The public fal Lite Extend
URL returned HTTP 200 with a loading shell and no usable schema, which cannot
prove support. The two Lite FAQs make this discrepancy explicit; unconditional
Lite-extension claims in the edited editorial sections are removed. Runtime
routing and catalog capabilities are unchanged. No paid generation was performed.
Do not treat this content change as proof that Lite Extend works.

## Validation and measurement

- 57 focused comparison/content/localization/export tests passed.
- SEO, LLM discovery, internal links and public media-origin guards passed;
  focused ESLint and public-exposure guard passed.
- Fifteen rendered routes checked: exact pre/post title, H1, meta description,
  canonical and robots equality; one H1; four hreflang; two localized contextual
  links; visible FAQ/JSON-LD answer parity. Public galleries and prices available.
- Mobile opening inspected at 390px; no document overflow.
- Full build and final production-preview checks are recorded in the PR.

This is a content intervention before SEO-EXP-001's stable reference period.
The title B remains a proposal. Start the 28-day reference only after this change
is actually released and a subsequent crawl is observed. Track identical queries
across Omni/standard and Omni/Fast, plus the family total; URL redistribution alone
is not a site-level gain or proof of a cannibalization penalty.
