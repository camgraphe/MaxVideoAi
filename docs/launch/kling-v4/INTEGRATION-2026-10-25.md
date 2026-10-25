# Kling 4 integration — 25 October 2026

Four current fal contracts are implemented: `kling/v4/text-to-video`,
`kling/v4/image-to-video`, `kling/v4/reference-to-video` and
`kling/v4/video-to-video/edit`. Modify means video editing. Extend has no
verified published contract and is absent; no generation route substitutes for it.
The bounded 3s/720p T2V access test succeeded. It establishes neither other-route
qualification nor artistic quality. This change performs no inference or upload.

The [selected contract snapshot](schema-contract-2026-10-25.json) records source
URLs, capture instants and schema hashes. Main prompts allow 26,000 characters;
shot prompts allow 512. Generation uses whole-second 3–30s durations, 720p/1080p,
and the exact route-specific ratios. Prompt/shot-plan exclusivity is product
validation policy. Modify has one required owned video, no shot plan, independent
ratio or audio switch. An omitted Modify duration remains omitted in the provider
body while the quote uses the exact verified source seconds. An explicit duration
keeps the requested supported integer output seconds.

All image/video occurrences, including subject views, resolve to owned originals.
Confirmation resolves them again and binds URL, role/slot, dimensions, MIME, bytes,
exact duration and FPS in the existing reference fingerprint. Video subject
seconds join flat reference seconds in the 30s reference budget. Studio supports
43 reference selections for reference generation and 39 for Modify; the canonical
validators still enforce each field/subject limit. Voice binding remains explicitly
unavailable in App, Studio and MCP: no trusted owned fal voice registry is part of
this change, and caller voice IDs are rejected. Fal documents up to three voiced
reference subjects; Modify exposes no voice binding.

The existing fal queue owners are retained. An offline test exercises the installed
SDK against all four endpoint IDs: its owner/app normalization uses the historical
`kling/v4/requests/<id>` parent paths. HTTP 202 with `IN_PROGRESS` remains the same
request; no second POST occurs. This is transport evidence with an injected fetch,
not a provider or account test.

## Tariff preparation and release boundary

Supplier LIST facts are separate from retail: output seconds at 0.157/0.235 USD
for 720p/1080p without video; 0.094/0.141 USD per billable second with video.
Video billable seconds are `max(input + output, 2 * output)`. Account invoice and
contract amounts remain unverified.

Exact admin selectors contain V4 identity, route mode, resolution, effective
output seconds and `billingInputType`. Video classes additionally carry verified
aggregate source/reference/subject seconds. No-video and video-input classes are
disjoint. Unpriced ratio, prompt and ordered subject identities remain confirmed
request facts. Admin preparation can use exact fixed cells or a reviewed
`billable_seconds` unit rate; continuous video selectors preserve fractional
quantities. Modify continuous cells also cover effective inherited output timing.
A continuous cell requires a literal billable-second rate, never an old-model or
percentage-policy fallback. Every quote returns the canonical customer tariff
revision and cell ID. No reviewed cell means no customer quote, including admins.

The admin inventory includes this unpublished candidate for tariff preparation.
The rate input starts empty. Preview/confirmation/history reuse the canonical
append-only admin flow; this implementation does not invoke any writer, create a
price, activate a cell or authorize release. The former 30% matrix is historical
proposal material, not a live tariff.

`kling-v4-release-policy.ts` remains closed for every actor. Registry App, pricing,
comparison, examples and sitemap publication stay disabled; the prepared model
page remains noindex. Menus and tutorials retain the owner's choices. Production
merge, public activation, paid QA, new retail amounts and voice creation require
separate decisions.

## Review without spending

PR Preview shows the prepared noindex EN/FR/ES model pages. Public App and
Studio/MCP discovery do not expose executable V4 while release is closed.
`tests/kling-v4-workspace-browser.test.ts` mounts the actual composer/state/schema
owners with synthetic owned media, captures generation locally and exercises all
four modes. It is an isolated component review, not authenticated end-to-end QA.
Run it with `pnpm exec tsx --tsconfig frontend/tsconfig.json --test
 tests/kling-v4-workspace-browser.test.ts`. The current-contract, admin-tariff,
canonical-subjects, owned-media, request-projection and Studio tests use injected
local dependencies; none opens a spend path.

App/Studio/MCP live qualification, references, Modify outputs, voice identity,
audio listening and complete customer tariff coverage are pending. A passing
Preview or CI build does not certify them.
