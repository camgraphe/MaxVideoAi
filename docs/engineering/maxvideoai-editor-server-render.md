# MaxVideoAI Editor Server Render

The editor export flow creates `app_timeline_exports` jobs from the route-local timeline manifest.

## Trust And Quote Boundary

- Estimate and create requests carry a Studio project ID and sequence ID. The server verifies both against the authenticated user, reloads the persisted sequence, and rebuilds readiness, clip timing, and overlap state instead of trusting client `ready` flags or tracks.
- Render clips carry stable asset IDs. The server resolves those IDs through a media-library row selected by authenticated user ID. Database dimensions and duration take precedence over persisted workspace values.
- Older project snapshots without a directly resolvable library asset may use a persisted project/node/timeline URL only when it decodes to an object-storage key under an explicit application media prefix scoped to the authenticated user. An approved host or same-origin URL is never ownership evidence by itself.
- Timeline role and media container are separate. An audio clip prefers a dedicated owned audio URL; an owned video asset may supply `video/mp4` to an audio track only when its provenance is explicitly `embedded`. External audio must resolve to owned audio media and an audio MIME type.
- After ownership is proven, compatibility validation permits HTTPS same-origin or explicitly approved storage hosts only, rejects redirects and credentials, and requires a bounded media `HEAD` response with a compatible MIME type. Arbitrary client URLs are never forwarded to Remotion.
- The worker reparses stored manifests, repeats bounded URL validation, and marks Remotion props as server-validated. The composition refuses media-bearing props without that trust marker.
- Estimates return a five-minute HMAC token bound to user, canonical manifest hash, quality preset, idempotency key, billing kind, and amount. Creation recomputes quota and price and verifies that token inside the same advisory-locked database transaction before free quota or wallet funds are reserved.
- `TIMELINE_EXPORT_ESTIMATE_SECRET` is the preferred signing secret. Deployments may reuse the existing server-only checkout, Stripe webhook, or cron secret infrastructure while rotating to a dedicated value. No signing material is exposed to the browser.

## Resource Limits

- A manifest is limited to 30 minutes, 120 clips, 12 tracks, and 108,000 frames. Source and composition dimensions are limited to an 8,192-pixel edge and 40 megapixels.
- Each unique input is limited to 512 MiB and all probed inputs together to 2 GiB. At most four `HEAD` probes run concurrently; each probe is capped at three seconds and manifest validation at ten seconds.
- Remotion renders at concurrency two. The default whole-render deadline is 30 minutes and `TIMELINE_EXPORT_RENDER_TIMEOUT_MS` may configure it between one and 45 minutes. Timeout cancellation uses Remotion's cancellation signal.
- The completed local artifact is checked before it is read or uploaded and is limited to 1 GiB. The per-job temporary directory is removed on success, failure, or timeout.

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

Use continuous mode only for local/staging debugging. In production the worker preflight rejects loop mode unless `--once` is present. The worker also fails fast when `DATABASE_URL` or object storage is missing, claims one queued job with `FOR UPDATE SKIP LOCKED`, renders the Remotion composition to MP4, uploads it under `timeline-exports/`, and saves it into media library.

When a worker receives `TIMELINE_EXPORT_TARGET_ID` or `--export-id <id>`, it claims only that queued export. Without a target id it keeps the older pool behavior and claims the next queued export. If a targeted once worker cannot claim the target because it is no longer queued, it exits without rendering another user's queued job.

## AWS ECS Fargate Launch

Vercel must not render MP4s inside route handlers. The create-export API only creates the durable `app_timeline_exports` row, reserves billing, then calls AWS ECS `RunTask` to start one short-lived Fargate worker task.

- Docker image: build from `Dockerfile.timeline-worker`, not the root mock API `Dockerfile`.
- Runtime command: `pnpm --prefix frontend run timeline-exports:worker:once`.
- ECS mode: `RunTask` only; do not run an always-on ECS service.
- Network mode: Fargate `awsvpc`, public subnets, `assignPublicIp: ENABLED`; no NAT Gateway required.
- Cost guard: one task per newly-created queued export. Idempotent retries that reuse an existing queued/rendering/completed export must not start another task.
- Targeting: `RunTask` passes `TIMELINE_EXPORT_TARGET_ID` as a container override so the spawned task renders the export row that triggered it.
- Worker size: keep the task definition at `2 vCPU / 4 GB`.
- Worker preflight: Fargate must provide `DATABASE_URL`, storage credentials, and `CHROME_BIN` or `PUPPETEER_EXECUTABLE_PATH`. The Dockerfile sets Chromium paths by default.
- API preflight: for a new idempotency key, the create-export route checks ECS launcher env before reserving free quota or wallet balance. Existing idempotent jobs can still be read without launching a duplicate task.

Required server-only env vars:

```bash
TIMELINE_EXPORT_ESTIMATE_SECRET=<at-least-32-random-bytes>
TIMELINE_EXPORT_RENDER_TIMEOUT_MS=1800000
TIMELINE_EXPORT_ECS_REGION=us-east-1
TIMELINE_EXPORT_ECS_CLUSTER=maxvideoai-timeline-exports
TIMELINE_EXPORT_ECS_TASK_DEFINITION=maxvideoai-timeline-export-worker:2
TIMELINE_EXPORT_ECS_CONTAINER_NAME=timeline-export-worker
TIMELINE_EXPORT_ECS_SECURITY_GROUP=sg-04be7e4806ef5f77a
TIMELINE_EXPORT_ECS_SUBNETS=subnet-056b0e21b43d5f9a0,subnet-052782533ff5c999b,subnet-0259349f2a43a61e9,subnet-02a8f9a8f9705eb93,subnet-08810baae918cd7e8,subnet-050836f43a4a5b96e
```

`TIMELINE_EXPORT_ECS_CONTAINER_NAME` defaults to `timeline-export-worker`. Set it only when the task definition uses a different container name.

Use a dedicated AWS launcher identity for Vercel, not the storage uploader credentials. Its policy should be limited to:

- `ecs:RunTask`
- optional `ecs:DescribeTasks`
- `iam:PassRole` for `maxvideoai-timeline-export-execution-role` and `maxvideoai-timeline-export-task-role`

Build and push image manually when needed:

```bash
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin 469541406686.dkr.ecr.us-east-1.amazonaws.com

docker build -f Dockerfile.timeline-worker \
  -t 469541406686.dkr.ecr.us-east-1.amazonaws.com/maxvideoai-timeline-export-worker:latest .

docker push 469541406686.dkr.ecr.us-east-1.amazonaws.com/maxvideoai-timeline-export-worker:latest
```

Do not run a real export or Fargate task from local validation without explicit approval.

## Failure Policy

- Missing media blocks the API before queueing.
- If ECS `RunTask` fails after a new job is created, the API marks the job failed and releases/refunds the billing reservation.
- Worker render failures mark the job failed.
- Empty or missing MP4 output is treated as a failed render, not a completed export.
- Free quota is released when a free job fails.
- Paid jobs are refunded when they fail before completion.
