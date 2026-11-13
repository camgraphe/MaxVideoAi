# Seedream 5.5 and 5.0 Flash integration

The owner requested both new ByteDance image models across the app, MCP, Studio
and marketing, with particular care for the existing Seedream search visibility.
Implementation is authorized by that request; routine implementation choices
below are engineering decisions, not separately approved commercial changes.

## Approach

Extend the existing direct BytePlus image adapter and canonical registry. All
surfaces consume the same model capabilities and canonical customer quotes.
Separate surface-specific implementations would duplicate provider facts and
pricing. Renaming the established Seedream route would discard useful stable
URLs and is unnecessary.

## Contract

- Add `seedream-5-5` → `dola-seedream-5-5-261028` and
  `seedream-5-0-flash` → `dola-seedream-5-0-flash-260915`.
- Both support text-to-image and image-to-image, one output, at most ten image
  references, JPEG/PNG, and 1K/1.5K/2K, default 2K.
- Seedream 5.5 supports native transparent backgrounds with PNG output. Do not
  expose layer decomposition/OCR as a supported application workflow.
- Preserve Lite/Pro identities, saved jobs, existing prices, URLs, canonical
  ownership, localized paths and useful search copy. Add new localized pages and
  truthful internal links; do not redirect or retire existing pages.
- Do not inherit exact-version editorial reviews or signed supplier discounts.
- New customer prices use the existing canonical launch/tariff mechanism. Missing
  active tariffs fail closed; no runtime catalogue-price fallback.
- Reference quantities and resolution/pixel tiers must match supplier accounting
  and actual payloads across app, MCP, Studio and marketing.
- Preserve explicit quote approval, billing recovery, owned references and
  immutable original output delivery. No paid generation is authorized here.
- Use existing generic illustrations with accurate labels until verified new
  model outputs are separately produced; never misattribute demonstration media.

## Verification and delivery

Test provider payloads and rejection boundaries first, then model discovery,
MCP/Studio preparation, pricing/reference quantities, localized model content and
SEO invariants. Run registry/projection checks, focused and selected integration
tests, lint, type checking and local route/browser smoke checks. Prepare a clean
reviewable branch/PR; production delivery follows the repository release policy.

## Provider evidence checked 2026-11-13

- https://ai.byteplus.com/ark/region:ap-southeast-1/docs/model-list.md
- https://ai.byteplus.com/ark/region:ap-southeast-1/docs/image-generation-api.md
- https://ai.byteplus.com/ark/region:ap-southeast-1/docs/model-pricing.md
- https://docs.byteplus.com/en/docs/modelark/seedream-5-5
- https://ai.byteplus.com/ark/region:ap-southeast-1/docs/seedream-5-0-pro.md

Public documentation establishes provider support, not account activation or a
successful paid render. The public console shows 5.5 available; account-specific
activation remains a distinct release verification.
