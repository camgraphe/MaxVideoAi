# MCP Audio execution on the existing website runtime

The native website and MCP share `executeReservedAudioRun`, canonical Audio pricing,
provider selection, outputs and refunds. MCP adds its exact quote, OAuth-owner and
reservation controls before calling that same executor. It must not call the web
HTTP endpoint with fabricated session credentials or reserve a second charge.

`MCP_AUDIO_EXECUTION_MODE=site` and `MCP_AUDIO_EXTENDED_ENABLED=true` select the
native website execution path for the full catalogue. No external queue consumer
is required by this mode. Existing paid generation and individual provider/model
publication gates still apply. No seven-pack capability or option is removed.

Absent execution mode, or explicit `worker`, retains the previous behaviour:
extended Audio also requires `AUDIO_GENERATION_WORKER_ENABLED=true`, atomically
enqueues migration-100 dispatches and depends on a separately qualified consumer.
Unknown mode values do not enable the extension. Execution mode participates in
catalogue revision so pending quotes cannot cross a mode change. Existing accepted
jobs remain recoverable by ID; switching mode does not drain already queued work.

The selector lives in `agent-api/audio-execution.ts`. It only supplies execution
dependencies to the existing confirmation owner. Replay, locking, exact pricing,
transaction boundaries and source ownership remain unchanged. Site mode does not
require a new cron, an always-on ECS service, or a new supplier tariff.

## Qualification and costs

Site and MCP routes both declare `maxDuration=800`. The source Audio execution is
awaited as it is on the website. No detached promise or `after()` lifetime extension
is introduced. Client timeout is not permission to repurchase: use the same quote
and owned job status. Queued legacy work still requires its existing consumer.

Local tests prove selection, catalogue parity and reservation/replay invariants.
They do not prove the duration of a real provider call or ChatGPT host tolerance.
Provider budgets can accumulate beyond the route window (sound design 600 s,
music 600 s, voice 300 s, plus media processing), as with the website. Qualify
representative long packs, provider failures, disconnect/recovery, FFmpeg output
and final library delivery on the isolated test before activating this mode.
Do not claim this selector solves provider timeout/reconciliation behaviour.

Pricing and suppliers are unchanged. Existing Vercel/DB/storage usage may increase
with additional work; this is not a guarantee of zero marginal hosting cost.
The previous estimate for an additional permanent 2-vCPU/4-GiB Audio service is
not a prerequisite of this route. Paid qualification, production configuration
and deployment require the owner's explicit approval. No configuration was changed
by this local implementation.

Tests: `mcp-audio-site-runtime.test.ts`, existing Audio service/reservation tests,
and the unchanged durable dispatch/worker suites for backward compatibility.
