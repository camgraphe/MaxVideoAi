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
- No new media or repeated poster. Existing metadata/canonical/hreflang untouched.

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

Do not publish the 4K marketing availability from the provider documentation alone.
After that integration is merged/tested and production activation is confirmed,
update all three Seedance locale files as
one release: metadata, overview/hero, comparison/decision copy, FAQ Draft answer,
cinematic intro/facts, Create limits/compact facts and Draft final step. Re-capture
the real Draft controls after their final-target selector is available. Describe
4K as 3840×2160 for 16:9, not as the dimensions of every aspect ratio. Check per-mode
output restrictions (especially Modify's LAS transport) and original-file codecs.
Keep the exact current customer quote; supplier token prices are not customer prices.

Integration-owner update, 17 November (reported readiness, not production activation):

- ModelArk supports the 4K target and Draft 480p → 1080p/4K finalization in all five
  modes: text-to-video, image-to-video, references, Modify and Extend. Ordinary
  Modify may still use LAS at 480p/720p; distinguish that transport from Draft
  finalization instead of applying its resolution limit to both paths.
- 1080p and 4K originals are HEVC 10-bit. Do not infer HDR or 4:4:4 from that fact.
- Runtime/catalog cards now derive 4K from shared capabilities in the integration
  branch. Reconcile authored `keySpecs`, cinematic copy and comparison/example
  destinations in EN/FR/ES at activation so the two surfaces agree.
- The owner reports Studio/Milo, MCP and final-target selector browser checks
  passing, with independent review clear. Await its PR and release signal before
  treating this as deployed behavior. Re-capture the actual controls then.
- The owner's Standard ×2 tariff change does not affect Flash. Verify actual
  current quotes and their marketing projections at release; do not substitute
  the multiplier for a customer-facing price.
- The plugin package and OpenAI review submission remain outside this change.
