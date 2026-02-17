# Image Audit And Alt Quality Checks

## Purpose
- Audit image metadata quality on marketing SEO surfaces.
- Catch missing/invalid alt regressions in CI before merge.

## Audit script
- Script: `/Users/adrienmillot/Desktop/MaxVideoAi V2/scripts/audit-images.mjs`
- Output files:
  - `/Users/adrienmillot/Desktop/MaxVideoAi V2/image-audit.csv`
  - `/Users/adrienmillot/Desktop/MaxVideoAi V2/image-audit-summary.md`

### Run
```bash
node scripts/audit-images.mjs
```

### Optional environment variables
- `AUDIT_SITE_ORIGIN` (default: `https://maxvideoai.com`)
- `AUDIT_SITEMAP_URL` (default: `${AUDIT_SITE_ORIGIN}/sitemap.xml`)
- `AUDIT_OUTPUT_CSV` (default: `image-audit.csv`)
- `AUDIT_OUTPUT_SUMMARY` (default: `image-audit-summary.md`)
- `AUDIT_EXCLUDE_METADATA_ISSUES` (default: `true`)

When `AUDIT_EXCLUDE_METADATA_ISSUES=true`, `og:image` and `jsonld-thumbnail` rows stay in CSV but are excluded from issue scoring.

## Alt quality check script (CI gate)
- Script: `/Users/adrienmillot/Desktop/MaxVideoAi V2/scripts/check-image-alt.mjs`
- Scope:
  - `/Users/adrienmillot/Desktop/MaxVideoAi V2/frontend/components/examples`
  - `/Users/adrienmillot/Desktop/MaxVideoAi V2/frontend/components/marketing`
  - `/Users/adrienmillot/Desktop/MaxVideoAi V2/frontend/app/(localized)`
- Blocking rules:
  - `<Image>` / `<img>` must have `alt`
  - `alt` must not contain `undefined`
  - empty literal `alt` fails unless decorative
- Decorative allowlist for empty `alt`:
  - `aria-hidden={true}` or `role="presentation"` / `role="none"`
  - `data-alt-allow-empty`
  - asset src prefixes: `/assets/icons/`, `/assets/frames/`, `/assets/placeholders/`
- Non-blocking warning:
  - `<video poster=...>` without `aria-label` / `aria-labelledby`

### Run
```bash
node scripts/check-image-alt.mjs
```
