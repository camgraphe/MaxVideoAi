# MaxVideoAI Editor Server Render

The editor export flow creates `app_timeline_exports` jobs from the route-local timeline manifest.

## User Billing

- Every authenticated user receives two free server exports.
- Free exports are reserved while queued or rendering.
- Paid exports create an `app_receipts` charge with `surface = timeline_export` and `billing_product_key = server_render`.
- Failed paid exports create a refund receipt.

## Worker

Run one job:

```bash
pnpm --prefix frontend run timeline-exports:worker:once
```

Run continuously:

```bash
pnpm --prefix frontend run timeline-exports:worker
```

The worker claims one queued job with `FOR UPDATE SKIP LOCKED`, renders the Remotion composition to MP4, uploads it under `timeline-exports/`, and saves it into media library.

## Failure Policy

- Missing media blocks the API before queueing.
- Worker render failures mark the job failed.
- Free quota is released when a free job fails.
- Paid jobs are refunded when they fail before completion.
