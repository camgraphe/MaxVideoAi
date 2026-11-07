# GPT Image 2.6 correction and Flash capability review

Started 6 November; implementation and validation continued 7 November 2026.
Branch `codex/gpt26-capabilities-flash-audit` starts from `594bceaee` on main.

PR #627 merged as `a5d40efe66b2074cfc053f7a20f739df7fb9a3a3` and deployed to
both production domains. The 48 approved native tariff additions are committed,
all 2,040 historical exact prices are preserved, and both authorized 4K raster
qualifications completed after correcting the deployed OpenAI key's Images
permission. See [tariff receipts](../2026-11-07-gpt26-raster-tariffs/README.md)
and [observed qualification](QUALIFICATION.md).

The compact resolution formatter also needed to preserve pixel dimensions:
otherwise both landscape and portrait controls displayed only “4K”. The follow-up
in PR #629 preserves these dimension labels and includes Character Studio's
concurrent PR #628 without changing its files.

## Raster correction

Flare and Sunburst share the same dimension contract: 17 exact pixel presets,
custom dimensions and provider automatic size. Both dimensions must be multiples
of 16, total pixels 655,360–8,294,400, maximum edge 3,840 and ratio between 1:3
and 3:1. Real 16:9 and 9:16 presets include 1536×864, 2048×1152,
2560×1440, 3840×2160 and their portrait equivalents. The former three presets
remain unchanged. 1920×1080 is not offered because 1080 is not divisible by 16.

All five explicit qualities plus provider Auto, independent planning complexity,
PNG/JPEG/WebP, opaque/transparent/automatic background and ten output images are
supported by the raster contract. Compression is optional for JPEG/WebP only.
Studio retains one output per action and now accepts the provider's sixteen
reference images. Its requested ratio must agree with the exact dimensions.

The shared request, estimate, immutable quote, executor, direct OpenAI payload,
response recovery and catalog projections must agree. Unsupported geometry and
inconsistent settings reject before provider submission. Ten requested images
must all be present before completion; an ambiguous outcome never causes a retry.

## Customer tariffs

The 2,040 existing exact cells retain precedence and values. A bounded inventory
of 48 authored continuous cells covers custom/preset dimensions, 1–10 outputs,
edit reference counts and separately identifiable automatic choices. The native
database reader remains mandatory; no missing tariff falls back to a catalog
price or percentage rule. The extension uses the approved ×1.50 commercial
formula with the existing input reserves, expressed as literal customer unit
rates and one final upward rounding. These reserves do not bound supplier input
cost or guarantee margin.

Auto size quotes use the maximum output-token quantity for the validated raster
envelope; Auto quality uses the max-quality quantity. Provider requests retain
the actual `auto` choice. App, discovery and public descriptions disclose the
conservative customer quote. No claim of measured provider output usage is made
before generation; returned usage keeps its existing owner.

The additional cells must be previewed and confirmed with the native admin
protocol before the new scenarios can be charged. Exact historical prices,
paid jobs and receipts must remain unchanged.

## Other capabilities

See [Kling audit](KLING-AUDIT.md): all options in the three currently used Fal
routes are covered. Direct Kling Modify and original-audio selection require a
new direct adapter and new qualification; they cannot be enabled by relabeling
Reference mode. Extend remains unavailable in the official contract.

The user requested GIF/SVG as an additional tool, not an option in the raster
composer. See [separate tool design](GIF-SVG-TOOL.md). The previously deferred
annotation workflow is not silently admitted by this raster correction.

## Release checks

New regression tests cover dimensions through canonical requests and provider
payloads, mismatched ratios, ten-result extraction, automatic argument preservation,
continuous tariff selection, the complete valid dimension envelope and historical
price preservation. Native PostgreSQL checks cover missing-only preview/confirmation
and repeated confirmation without duplicate history. Compression tests cover
state persistence and provider projection.

Follow the normal clean candidate → PR → required Quality CI → main Git deployment
path. Verify both domains against the merged SHA, native prices and live App/Studio/MCP
discovery. The two separately authorized paid 4K qualifications are specified in
[QUALIFICATION.md](QUALIFICATION.md); do not resubmit them automatically.

## Official sources

- [Exact GPT Image 2.6 prompting guide](https://developers.openai.com/api/docs/guides/image-prompting#gpt-image-2.6-guide).
- [Images generation reference](https://developers.openai.com/api/reference/resources/images/methods/generate).
- [Image-generation guide and calculator](https://developers.openai.com/api/docs/guides/image-generation).

The generic size prose still names older GPT Image versions. The exact 2.6
prompting guide establishes custom multiples-of-16 dimensions and ratios; the
current official calculator explicitly includes 2.6 and supplies the pixel/edge
envelope. Paid qualification is separate from those documentation facts.
