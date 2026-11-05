# Gemini Omni Flash 1.2 — November 5, 2026 source candidate

## Availability and limits

Google announced `gemini-omni-1.2-flash` as GA on November 5. Vertex uses the global Interactions endpoint; the Gemini Developer API is a separate access/rollout surface. Sources checked that day:

- [Google Cloud announcement](https://cloud.google.com/blog/products/ai-machine-learning/gemini-omni-1-2-flash-generally-available)
- [Vertex model card](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/omni-1-2-flash)
- [Google Cloud pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing)
- [Gemini API changelog](https://ai.google.dev/gemini-api/docs/changelog), for comparison only

The existing Vertex account completed a direct text-to-video request at 22:06 Europe/Madrid (21:06 UTC): 3 seconds, 360p, 16:9, HTTP 200 submission and polling, final `completed`, MP4 output. Usage reported 61 input text tokens, 5,793 output video tokens and 538 reasoning tokens. List-price estimate including those tokens: $0.0744495; this is not an invoice. No credential, prompt, media bytes or signed output URL is included here.

This confirms one account/endpoint/mode/resolution combination. Image/reference generation, first/last frames, edit, extend, refine, higher resolutions and production app routing were not tested by that probe. Google documents those video workflows; audio-reference access is allowlisted and remains unsupported in this candidate.

Google documents generation/editing up to 15 seconds, but first/last frames and added extension are capped at 10. The candidate retains the currently sold 3–10-second domain and existing source limits. Longer durations need reviewed customer-tariff coverage and separate acceptance. No new upscale mode or provider fallback is introduced.

## Pricing boundary

New provider media estimates use $12/million output video tokens (formerly $17.50), with unchanged input media rates. Production customer-tariff cells and historical paid receipts have not been mutated. The user-approved retail policy is prepared separately: [saved 1.1 customer price × 1.5, rounded up](gemini-omni-flash-1-2-tariffs.md). Legacy inactive-policy audit/development quotes continue to derive from current costs and therefore change; do not present those projections as a production retail discount. Historical in-flight 1.1 attempts retain their stored model/rate; missing model provenance cannot be guessed from the current catalog.

## Search decision

Search Console was checked for the existing site's `omni` queries over Oct 7–Nov 3, 2026, before the 1.2 launch. The existing Omni/Veo comparison owners carried most observed discovery; version-specific searches predominantly referred to 1.1. Exact account metrics remain in the private local research record and are not published in this source note.

This supports upgrading the existing owners in place. It does not establish existing cannibalization, forecast 1.2 demand or guarantee future ranking; the filter also contains some unrelated Kling Omni queries.

Keep `/models/gemini-omni-flash`, `/ai-video-engines/gemini-omni-flash-vs-veo-3-1`, and `/ai-video-engines/gemini-omni-flash-vs-veo-3-1-fast`, with the existing localized paths. Add `gemini-omni-1-2-flash` and `gemini-omni-flash-1-2` only as aliases. No new version landing page or duplicate launch article.

Current titles, navigation, calls to action, specs and discovery describe 1.2. Real 1.1 videos, prompts and their captions remain intact. The September 3 score row is preserved under `historicalScores` with its version, excluded from current ratings. Localized historical notes explain the transition; no 1.2 quality score is inferred from 1.1.

## Delivery and verification

The implementation is isolated on `codex/omni-12-upgrade` from `origin/main` at `b5f4bdddaa27e8620293dc9a59811559decc0cf5`. The parallel model-launch worktree and shared Desktop checkout were not edited. No production environment flags, customer-tariff cells or media assets were changed.

Focused runtime/pricing tests cover new routing/rates, old and unknown model provenance, owned edit timing, provider polling and historical/current tariff domains. Marketing tests cover localized owners, aliases, original 1.1 proof, current score exclusion and preserved internal links. Registry/runtime/catalog/roster projections are regenerated through their owners. Final validation results are recorded with the PR.

Local source verification on November 5:

- Nine real Next.js responses: model page plus both Veo comparisons in EN/FR/ES, HTTP 200, unchanged self-canonical, complete locale alternates, valid JSON-LD, current 1.2 heading and historical 1.1 evidence.
- Nine old/new localized aliases: one-hop 301 to the existing model owner. The local public API retained all four captured Omni examples as 1.1.
- Real Chromium: French model page at 390 px has the current name, the existing engine CTA and no horizontal overflow; the comparison card opens a dialog explicitly labeled 1.1 after hydration. The native watch link remains usable before hydration.
- Gallery/pagination PostgreSQL: 14/14 checks; opening/version/catalog/browser contracts: 27/27. Current types, lint, exposure, registry and generated projections pass (lint retains seven unrelated existing warnings).
- Canonical price audit: 270 scenarios, 266 unchanged, four explicit supplier-rate changes, zero unexplained mismatches. Active-tariff semantics are covered by the dedicated Omni PostgreSQL and domain tests.

The HTTP/browser checks use an isolated development server and a snapshot captured
from the anonymous public examples API, without a production database connection.
They establish rendering and link behavior, not deployed generation availability.
The full fast and exhaustive financial suites are additional PR validation gates;
their final status belongs to the PR, not to the direct Vertex access probe.

Before production delivery, follow the normal GitHub/Quality CI/Vercel policy, reconcile current main and verify the deployed domains against the merged commit. The direct account probe does not replace that deployment acceptance. New 1.2 marketing demonstrations and 11–15-second tariffs are follow-up work, not claims of this release.
