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

## AWS ECS Fargate Launch

Vercel must not render MP4s inside route handlers. The create-export API only creates the durable `app_timeline_exports` row, reserves billing, then calls AWS ECS `RunTask` to start one short-lived Fargate worker task.

- Docker image: build from `Dockerfile.timeline-worker`, not the root mock API `Dockerfile`.
- Runtime command: `pnpm --prefix frontend run timeline-exports:worker:once`.
- ECS mode: `RunTask` only; do not run an always-on ECS service.
- Network mode: Fargate `awsvpc`, public subnets, `assignPublicIp: ENABLED`; no NAT Gateway required.
- Cost guard: one task per newly-created queued export. Idempotent retries that reuse an existing queued/rendering/completed export must not start another task.
- Worker size: keep the task definition at `2 vCPU / 4 GB`.

Required server-only env vars:

```bash
TIMELINE_EXPORT_ECS_REGION=us-east-1
TIMELINE_EXPORT_ECS_CLUSTER=maxvideoai-timeline-exports
TIMELINE_EXPORT_ECS_TASK_DEFINITION=maxvideoai-timeline-export-worker:2
TIMELINE_EXPORT_ECS_SECURITY_GROUP=sg-04be7e4806ef5f77a
TIMELINE_EXPORT_ECS_SUBNETS=subnet-056b0e21b43d5f9a0,subnet-052782533ff5c999b,subnet-0259349f2a43a61e9,subnet-02a8f9a8f9705eb93,subnet-08810baae918cd7e8,subnet-050836f43a4a5b96e
```

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
- Free quota is released when a free job fails.
- Paid jobs are refunded when they fail before completion.
