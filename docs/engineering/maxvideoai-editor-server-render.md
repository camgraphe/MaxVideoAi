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
