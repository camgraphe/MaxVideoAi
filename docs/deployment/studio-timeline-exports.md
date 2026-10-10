# Studio MP4 exports

Studio edits the canonical sequence; a separate ECS Fargate task renders the final
H.264 MP4 and publishes its owned library asset. The chat prepares an exact quote,
the user confirms it, and the canonical reservation/idempotency owner launches one
worker for that export ID. Enabling conversation exports alone does not configure
the renderer.

## Worker release

Use a committed, pushed GitHub candidate from a clean isolated worktree. Export
only that commit with `git archive --format=zip`; never package the shared Desktop
checkout, environment files, dependency directories or local build artifacts.

`Dockerfile.timeline-worker` owns Node, offline pnpm, Chromium and FFmpeg.
`buildspec.timeline-worker.yml` builds Linux AMD64, labels the exact source SHA,
checks the installed runtimes and actual entry-point refusal without credentials
or network, then publishes the SHA-tagged image. Supply the 40-character
`TIMELINE_EXPORT_SOURCE_SHA` as a build variable. The existing CodeBuild project
can use the committed buildspec and source archive as per-build overrides; this
does not replace its pilot configuration. Build credentials and temporary role
permissions must be scoped to this project/repository, expire, and be removed
after the build. No database, storage or provider secrets enter the build.

Register the production family `maxvideoai-timeline-export-worker` with the exact
ECR digest, never `latest`. Keep the production cluster
`maxvideoai-timeline-exports`, container `worker`, 2 vCPU / 4 GiB, dedicated
execution/task roles and `/ecs/maxvideoai-timeline-export-worker` logs. Its SSM
references under `/maxvideoai/timeline-export-worker/` select the production Neon
database and dedicated storage identity. Preserve the canonical
`media.maxvideoai.com` storage base; the legacy local environment copy is not
authoritative for that identity. Verify the actual owned sources with the worker
identity before activation. The image uses the configured Chromium executable
for both composition selection and rendering.

An initial task targeting a unique nonexistent export ID verifies image pull,
entry point and production database access without claiming any queued export.
Its expected result is “target export … is not queued” and exit 0. This health
probe does not prove a completed video; qualify an actual confirmed export too.

## Vercel configuration and activation

Production needs `TIMELINE_EXPORT_ECS_CLUSTER`,
`TIMELINE_EXPORT_ECS_TASK_DEFINITION`, `TIMELINE_EXPORT_ECS_REGION`,
`TIMELINE_EXPORT_ECS_SUBNETS`, `TIMELINE_EXPORT_ECS_SECURITY_GROUP` and
`TIMELINE_EXPORT_ECS_CONTAINER_NAME=worker`. Selected public subnets and the
outbound-only security group must share a VPC. Use a dedicated launcher identity
with RunTask restricted to that task definition/cluster, TagResource for created
tasks and PassRole for only the existing execution/task roles. Its credentials
are encrypted production-only server environment variables; do not overwrite
existing shared AWS credentials.

Keep `STUDIO_CONVERSATION_EXPORTS_ENABLED=false` until the image, sources, health
probe and source tests are qualified. Activate using the normal GitHub PR,
required Quality CI, merge and Vercel Git deployment documented in
[GitHub and Vercel delivery](github-vercel.md). Configuration changes only reach
functions in a new deployment. Verify both live domains against the merged SHA.

Then prepare a fresh exact quote in the real Studio conversation. Confirmation
consumes the existing free quota or wallet amount shown; preparation, timeline
editing and polling never authorize another export. Verify the same export ID
through queued, rendering and completed, its ECS exit, stored library identity,
H.264 dimensions/frame count, audio, original playback and authenticated MP4
download. Reload must recover that artifact without another task or charge.
AWS build/render/storage costs remain separate from the user export quote.

## Recovery

On qualification failure, disable new conversation exports with the flag and a
Git-backed configuration release; preserve completed delivery, jobs, receipts
and library originals. Retain the prior immutable task definition for rollback.
An accepted RunTask can still fail during image pull or container startup. Inspect
the exact ECS task and export row before resolving such a failure; a queued or
rendering row is not proof of live compute, and repeating confirmation must not
launch another worker or manufacture a successful artifact. The current renderer
releases billing on handled render failure; abrupt ECS termination requires
operator reconciliation. Do not erase financial records or retry unknown work.
