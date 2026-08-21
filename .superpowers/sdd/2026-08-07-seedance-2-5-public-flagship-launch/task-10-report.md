# Task 10 — Seedance 2.5 internal-link launch graph

## Outcome

Seedance 2.5 is now the first Seedance recommendation on the requested high-authority and intent-matched surfaces in English, French, and Spanish. Seedance 2.0 remains published, indexable, self-owned, directly linked as the 4K alternative, and unchanged on the dedicated 4K cluster.

## Launch-link matrix

| Source owner | English anchor/target | French anchor/target | Spanish anchor/target |
| --- | --- | --- | --- |
| Homepage model profile | Seedance 2.5 → `/models/seedance-2-5` | Seedance 2.5 → `/fr/modeles/seedance-2-5` | Seedance 2.5 → `/es/modelos/seedance-2-5` |
| Models catalogue | Current Seedance flagship → `/models/seedance-2-5` | Flagship Seedance actuel → `/fr/modeles/seedance-2-5` | Flagship actual de Seedance → `/es/modelos/seedance-2-5` |
| Pay-as-you-go model choices | Seedance 2.5 for 30-second cinematic video → `/models/seedance-2-5` | Seedance 2.5 pour la vidéo cinématique de 30 secondes → `/fr/modeles/seedance-2-5` | Seedance 2.5 para video cinematográfico de 30 segundos → `/es/modelos/seedance-2-5` |
| Seedance examples | Discover Seedance 2.5 for 30-second cinematic video → `/models/seedance-2-5` | Découvrir Seedance 2.5 pour la vidéo cinématique de 30 secondes → `/fr/modeles/seedance-2-5` | Descubrir Seedance 2.5 para video cinematográfico de 30 segundos → `/es/modelos/seedance-2-5` |
| Footer engines | Seedance 2.5 → `/models/seedance-2-5` | Seedance 2.5 → `/fr/modeles/seedance-2-5` | Seedance 2.5 → `/es/modelos/seedance-2-5` |
| Seedance 2.0 decision module | Discover the latest Seedance 2.5 → `/models/seedance-2-5` | Découvrir le nouveau Seedance 2.5 → `/fr/modeles/seedance-2-5` | Descubre el nuevo Seedance 2.5 → `/es/modelos/seedance-2-5` |
| Seven best-for clusters | Localized Seedance 2.5 profile is first; 2.0 remains a direct 4K alternative | Same localized contract | Same localized contract |

The seven updated clusters are ads, cinematic realism, image-to-video, reference-to-video, multi-shot video, product videos, and UGC ads. Their ranked configuration also leads with `seedance-2-5` and retains `seedance-2-0`.

## TDD evidence

- RED: the four requested linking test files ran 49 tests, with 45 passing and 4 expected launch-graph failures (homepage/catalogue/footer; 2.0 discovery module; pay-as-you-go; examples/cluster matrix).
- GREEN: the same four files passed 49/49 after implementation.
- Contract follow-up: the expanded eight-file set passed 110/110 after updating four stale ordering/ID contracts exposed by the full suite.
- Static checks: `npm --prefix frontend run lint`, `npm run lint:exposure`, and `git diff --check` passed.
- Full validation: `pnpm test:validate` passed 2475/2475 with 0 failures on the final implementation state.

## Anti-cannibalization evidence

- Tests assert `seedance-2-0` remains published, indexable, self-slugged, and has no registry replacement.
- Tests assert published status for the Seedance 2.0 Fast and Mini registry entries.
- Generated redirects are checked to ensure no localized 2.0 profile redirects to 2.5.
- English, French, and Spanish `4k-video.mdx` files are checked for a direct localized 2.0 link and the absence of a 2.5 link; those files were not edited.
- Seedance 2.0 page SEO titles were not changed, and the existing exact-match 2.0 comparison links remain intact.
- No model-registry, provider, generation, payment, pricing-number, or route-canonical policy was changed.

## Files and ownership

- Homepage: `constants.ts` plus `examples.ts` so resolved example-family profile CTAs use the current family default.
- Catalogue/footer/examples: catalogue decision data, `MarketingFooter.tsx`, and examples next-step copy.
- Pay-as-you-go: supported-model type/config and localized editorial modules; numeric pricing is untouched.
- Model content: the three localized Seedance 2.0 JSON files receive one compact discovery card.
- Best-for: 21 selected localized MDX documents plus their seven ranked `compare-config.json` entries.
- Tests: four requested launch-link suites plus four existing contracts whose fixed expectations changed with the intentional ordering.

## Self-review and concerns

- Direct localized paths are asserted for all three locales; anchors are descriptive and user-facing rather than internal/provider terminology.
- Seedance 2.0 remains visibly available wherever 2.5 becomes first, with 4K as its distinct intent.
- Existing comparison URLs remain 2.0-focused because those pages and exact-match anchors own that separate query intent.
- No open implementation concern identified; the only broad-suite failures observed before contract updates were the four expected stale assertions listed above.

## Fix round 1/5 — catalogue lip-sync capability

- Finding: the EN/FR/ES catalogue row for `Native audio & lip sync` incorrectly named Seedance 2.5, whose launch facts validate optional audio but not lip sync. Seedance 2.0 owns the explicit lip-sync capability.
- Root cause: the Task 10 catalogue update promoted four use-case leaders together and included the pre-existing lip-sync row even though that intent has a stricter capability requirement.
- Fix: restored Seedance 2.0 only for the `native-audio` use case in all three locales. Seedance 2.5 remains the leader for cinematic video, image-to-video, and product ads.
- Regression contract: `home-seo-signals.test.ts` asserts the four capability leaders from the real catalogue builder for EN, FR, and ES.
- TDD: RED was 8/9 with the sole mismatch `Seedance 2.5` versus `Seedance 2.0`; GREEN covering tests passed 49/49.
- Final verification: `pnpm test:validate` passed 2476/2476; frontend lint, public-exposure lint, and `git diff --check` passed.
