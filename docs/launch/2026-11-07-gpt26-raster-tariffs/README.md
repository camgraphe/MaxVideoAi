# GPT Image 2.6 raster tariff proposal

Status: **approved by the user on 7 November 2026, not yet applied**. Approval
explicitly includes all 48 classes and the conservative Auto prices. The two JSON imports contain 24
missing-only native classes each. Twenty classes cover explicit quality and
dimensions; 28 separately identify automatic size and/or quality. Review those
automatic classes deliberately: the quote uses a conservative output estimate,
while the provider still receives the requested automatic settings.

The approved retail recipe is output LIST estimate + USD 0.01 per output + USD
0.02 per source per output, multiplied by 1.50 and rounded up once to cents. The
native rates are 0.0045 cents/output token, 1.5 cents/output and 3 cents/source/output.
Input costs remain unknown; these reserves are not a supplier-spend bound.

Both Flare and Sunburst have the following proposed text-to-image prices at high
quality, one output and no sources:

| Dimensions | Proposed price |
| --- | ---: |
| 1536 × 864 or 864 × 1536 | $0.07 |
| 2048 × 1152 or 1152 × 2048 | $0.08 |
| 2048 × 2048 | $0.18 |
| 3840 × 2160 or 2160 × 3840 | $0.17 |
| Automatic size, high quality | $0.29 |
| Automatic size and quality | $1.09 |

The two explicit 4K orientation canaries would therefore total **$0.34 customer
retail**, conditional on a fresh exact active quote. This is not permission to
submit either job and does not bound complete provider input costs.

`review.json` records each proposal hash, all 29,146 valid ordered dimension pairs,
token extrema and representative customer quotes. The 2,040 existing exact cells
are not rewritten and remain preferred over continuous alternatives, including
deliberate exact-price overrides. All prices require a current active tariff;
code/catalog publication alone cannot activate the new classes.

To reproduce into a new local directory:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json frontend/scripts/prepare-gpt26-raster-tariffs.ts --out /private/new-gpt26-raster-review
```

The command has no database, provider or apply path. After source delivery and
separate operational authorization, import one model proposal into native admin
batch preview, inspect the current revision/fingerprint, confirm once and retain
the durable receipt. Then preview the second proposal against the new revision.
Reconcile the 48 added classes and original exact prices before any paid request.

Local evidence: focused price/domain regressions pass; PG17 batch tests preserve
all 2,040 exact rows and paid snapshots; native browser review renders all three
units, conservative automatic estimates and idempotent confirmed operations.
