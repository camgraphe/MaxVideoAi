# Add Seedream 5.0 Lite Image Model

Date: 2026-05-11

## Scope

Add Seedream 5.0 Lite as a public BytePlus ModelArk image model and connect it to Seedance reference-image workflows without promising guaranteed acceptance, bypassed moderation, or review-free generation.

## Provider Contract

Use BytePlus ModelArk image generation API:

- Endpoint: `/api/v3/images/generations`
- Default AP base URL: `https://ark.ap-southeast.bytepluses.com/api/v3`
- Default model id: `seedream-5-0-260128`
- Text prompt field: `prompt`
- Image edit input field: `image` as a URL/base64 string or array
- Output size field: `size`
- Return format: `response_format: "url"` for app persistence
- Output format: `output_format: "jpeg" | "png"`
- Watermark toggle: `watermark: boolean`

Do not send `n` for Seedream 5.0 Lite standard image requests; it is not part of the documented request body. Keep the app at one image per standard Seedream request until a separate batch workflow can handle `sequential_image_generation`, actual returned image count, and billing/refunds correctly.

## Product Tasks

1. Add `seedream` to the image engine registry with BytePlus provider metadata.
2. Add BytePlus Seedream provider modules for payload, client, response parsing, error handling, and execution.
3. Add `/models/seedream` localized model content in EN/FR/ES.
4. Update Seedance 2.0 and Seedance 2.0 Fast pages with Seedream reference-image workflow copy.
5. Update Seedance app helper text to suggest Seedream references for consistency.
6. Add internal links between Seedream and Seedance pages.
7. Exclude Seedream from video comparison surfaces while keeping it in image-model discovery.
8. Regenerate engine catalog and model roster.

## Seedream UI Options

Expose only user-facing provider options that are safe in the current architecture:

- `size`: `2K`, `3K`, `4K`, plus documented pixel presets.
- `output_format`: `jpeg`, `png`.
- `watermark`: enabled/disabled.
- `image_urls` in edit mode: up to 14 references, 10 MB each, with jpeg/png/webp/bmp/tiff/gif support.

Keep these as server-controlled details, not user controls:

- `response_format`: fixed to `url`.
- `stream`: not used by the current non-streaming persistence flow.
- `sequential_image_generation`: defer until the app can price and reconcile actual batch output count.

## Verification

Focused checks:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/byteplus-seedream-payload.test.ts tests/byteplus-seedream-response.test.ts tests/byteplus-seedream-provider.test.ts tests/seedream-image-model.test.ts tests/seedance-seedream-workflow-copy.test.ts tests/image-input-schema.test.ts tests/image-generation-server-architecture.test.ts tests/model-page-layout-architecture.test.ts tests/model-page-copy-architecture.test.ts tests/fal-engine-catalog-architecture.test.ts tests/models-catalog-architecture.test.ts tests/workspace-composer-surface-contract.test.ts tests/image-workspace-split-contract.test.ts
npm --prefix frontend run lint
npm run lint:exposure
npm run model:check
npm run models:audit
git diff --check
```

Live BytePlus smoke test requires `BYTEPLUS_ARK_API_KEY` and model activation in the selected BytePlus region.
