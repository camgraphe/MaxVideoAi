# Seedance 2.5 / FLUX 3 Max workflow coverage

This follow-up expands the existing cinematic migration without changing model
publication, runtime generation, pricing or public media ownership.

- Seedance: compact Create / Modify / Extend explorer. Covers first/last images,
  image/video/audio reference roles, motion reference, character/wardrobe/object
  changes, background/light/weather, audio changes and continuation before/after/
  between supplied clips. Limits: 30/10/10 reference counts; separate 30-second video
  and audio budgets; up to 10 Extend sources and a 4–30-second requested segment.
- FLUX Max: text, opening image, first/last frames and 1–10 timed keyframes. Shared
  sound, reasoning, seed and upscaled-1080p controls. The current integration does
  not have Modify or Extend: named actions open Seedance 2.5 / FLUX 3 instead.
- Three localized versions. Every explanation is in server HTML. Tabs reduce the
  visible text; they do not create a separate indexable URL or duplicate family page.
- Retained model-specific real UI captures, Draft/keyframe demonstrations, exact
  public recipes, prompt drawers, Milo, pricing, comparisons and citable spec exports.
- Existing canonical/hreflang and model URLs are retained. The 4K follow-up below
  deliberately updates titles/descriptions and two selected public proof films.

Validation on 17 November: 34 migration/template/current-price tests, 62 pricing/
streaming/loading tests and 47 content/media/keyframe/export contracts passed.
TypeScript and focused ESLint passed. Full ESLint: no errors, seven pre-existing
warnings. Exposure and registry checks passed. Desktop 1440px and mobile 390px:
both pages return 200, every tab works, Home/End navigation works, one H1, no page
JavaScript errors or horizontal overflow. Engine/mode/locale link contracts checked.
Screenshots and review JSON: local visualization folder `2026/11/17/model-workflows`.

## Coordinated 4K follow-up

The separate `codex/seedance-25-4k` task owns runtime, Draft finalization and prices.
Its verified provider evidence says direct 4K and Draft 480p → 1080p/4K, with 10-bit
H.265/HEVC in both 1080p and 4K. 10-bit is not exclusive to 4K. Flash remains separate.
Official references:
- https://docs.byteplus.com/en/docs/ModelArk/seedance-2-5
- https://docs.byteplus.com/en/docs/ModelArk/create-video-generation-task-api

The user authorized preparing the concrete 4K editorial candidate before activation.
Draft PR #657 now updates all three Seedance locale files together: metadata,
overview/hero, comparison/decision copy, FAQ Draft answer, cinematic intro/facts,
Create limits/compact facts and Draft final step. Authored specs and CSV/table exports
include 4K and the 1080p/4K codec. Family comparisons and the linked Veo comparison
no longer claim that Standard stops at 1080p. Re-captured the actual Draft final
controls from integration PR #659, with its 4K selector and EN/FR/ES labels.
The capture fixture uses example state, makes no API calls, and does not quote or
generate. Its source hash is recorded beside each immutable image. Describe
4K as 3840×2160 for 16:9, not as the dimensions of every aspect ratio. Check per-mode
output restrictions (especially Modify's LAS transport) and original-file codecs.
Keep the exact current customer quote; supplier token prices are not customer prices.
Do not merge or deploy this marketing availability until integration PR #659 and
the coordinated runtime/tariff activation are ready. Preparation is not activation.

Integration-owner update, 17 November (reported readiness, not production activation):

- ModelArk supports the 4K target and Draft 480p → 1080p/4K finalization in all five
  modes: text-to-video, image-to-video, references, Modify and Extend. Ordinary
  Modify may still use LAS at 480p/720p; distinguish that transport from Draft
  finalization instead of applying its resolution limit to both paths.
- 1080p and 4K originals are HEVC 10-bit. Do not infer HDR or 4:4:4 from that fact.
- Runtime/catalog cards derive 4K from shared capabilities in the integration
  branch. Authored `keySpecs`, cinematic copy and selected comparison destinations
  are prepared in this candidate; verify their agreement again at activation.
- The owner reports Studio/Milo, MCP and final-target selector browser checks
  passing, with independent review clear. Await its PR and release signal before
  treating this as deployed behavior. The actual controls are now captured locally.
- The owner's Standard ×2 tariff change does not affect Flash. Verify actual
  current quotes and their marketing projections at release; do not substitute
  the multiplier for a customer-facing price.
- The plugin package and OpenAI review submission remain outside this change.

## User-selected prompt film

The Prompt Guide now uses public job `job_ff94f180-0a2f-4f2b-acb2-bda8352fa9d9`,
Hard Bounce. Verified original: 1280×720 H.264, AAC, 24.064 seconds. Its exact public
prompt, output URL, immutable poster, reuse and Milo links share this job identity.
The guide explains its recurring circular motif, motion match cuts, camera direction
and rhythmic sound, without claiming the detailed shot list is reproduced exactly.
The Create film remains the selected 30-second pop comedy at its actual 480p.
Neither proof is relabelled 4K or borrowed from Flash. Original downloads stay
distinct from display posters; manual players retain `preload="none"`.

4K/media follow-up validation: 67 focused content, comparison, migration, template,
media and export tests passed; TypeScript, registry and exposure checks passed.
ESLint has no errors and seven existing unrelated warnings. Chromium EN desktop
1440px/mobile 390px and FR/ES 1100px verifies the exact Hard Bounce prompt and job
handoffs, 1280×720 first playback (24.064s), no clip request before Play, valid
canonical/hreflang/JSON-LD, one H1 and no overflow/page errors. Fresh poster and
Draft screenshots are in the local visualization folder
`2026/11/17/model-4k-prompt-review`. Required remote Quality CI is a separate release
gate and must pass on the final coordinated candidate.
