---
name: generate
description: |
  Execute a concrete AI video or image request through the connected MaxVideoAI account. Use when: a selected AI video or image request needs an exact price or exact quote, explicit approval of a fresh quote, a generation action, job status, result presentation, or result recovery. Chain from plan after a model is chosen, or use directly when the request is already concrete. NOT for: open-ended project planning, model comparison, or a budget or pricing estimate before a request is selected (use plan).
---

# Generate with MaxVideoAI

Take one concrete request from references through delivery while preserving a
strict paid-action boundary. Live tool results are authoritative for the model
contract, account, quote, job, and destination.

## UX rules

1. Match the user's language and keep polling, schemas, and internal mechanics
   out of normal chat.
2. Ask only for unresolved inputs that block validation or materially change
   the result. Do not re-interview a user whose request is already concrete.
3. Do not show raw IDs or JSON unless the user explicitly asks for diagnostics.
4. Never silently substitute a named model. Explain the live incompatibility
   and ask before changing the request.
5. Never claim an upload, payment, approval, generation, or download completed
   unless the corresponding live result says so.

## Validate the concrete request

Call `get_model_details` for the selected model and mode before relying on
required fields, settings, aspect ratios, reference roles, counts, audio policy,
or duration limits. Send only fields supported by that exact live contract.

When prompt help is useful, use `promptingSources` from those details and share
only the relevant reviewed official provider link. If none is returned, do not
invent one or substitute web search or browsing. A provider guide informs prompt
craft; it is not evidence of current
MaxVideoAI availability, settings, pricing, or execution. The live contract is
authoritative for those facts.

For an existing library reference, call `list_media` by image, video, or audio
kind. For new user-authorized host attachments or an authorized generation
result with temporary file handles, call `import_reference_files` once with up
to eight files. Preserve input order and use its returned asset IDs directly;
do not call `list_media` after a successful direct import. Keep successful IDs
from a partial batch and retry only the failed files. Never invent a file URL.

When the host cannot expose a file handle, call
`create_reference_upload_link` for the required kind. A compatible UI host can
render its short-lived in-chat multi-file importer; otherwise send the exact
browser destination as the manual fallback. In Codex or Claude Code, create one
link per local file and run the packaged local helper. It reads local bytes and
returns asset IDs without sending a raw local path to the MCP server, publishing
a public URL, or using Computer Use. After the browser fallback, call
`list_media`; after the in-chat importer or helper, use returned IDs directly.
If the link tool fails, ask the user to authorize or retry the handoff.

Required typed references must be private MaxVideoAI assets so their metadata
can be verified. Do not replace them with an arbitrary external URL. Read
[reference inputs](references/reference-inputs.md) for first and last frames,
source video, ordered references, edits, extensions, and conditional assets.

## Quote, stop, and wait

Call `prepare_generation` only after the model, mode, prompt, settings, and
references are concrete. Present the exact price and relevant validated request,
then stop and wait for explicit approval of that quote.
When a required private reference or asset is missing, say that an exact quote
cannot be created yet. A budget calculation may be shown only as an estimate,
never as the exact quote.
Treat the returned `expiresAt` as UTC and display it without converting the date
incorrectly. Do not call a quote expired merely from a local-date comparison;
report expiry as definitive only when MaxVideoAI returns `QUOTE_EXPIRED`.

Ambiguous assent is not confirmation. Do not interpret discussion, a project
estimate, silence, an old approval, or approval of another quote as permission.
After clear approval, call `confirm_generation` once.

That confirmation authorizes exactly one paid attempt and is consumed whether
the job is accepted, failed, or refunded. A refund does not restore the
authorization. Every replacement or creative retry requires `prepare_generation`,
a fresh exact quote, and new explicit approval.

## Follow and recover without duplication

After confirmation, use `get_generation_status` for a known job. If the client
response was lost, stale, or interrupted, use `list_recent_generations` before
considering any new paid call. Recover the existing job rather than creating a
duplicate or second paid attempt.

For a technical failure, inspect the returned refund or recredit state and do
not resubmit automatically. A creative retry is a new paid attempt with its own
fresh quote and approval.

When a job is completed, call `present_generation` once when the result should
be delivered. Compatible hosts may show inline video or images. Otherwise use
only the returned resource and MaxVideoAI library destinations. The completed
result remains in the same connected MaxVideoAI library.

Read [generation safety and recovery](references/generation-safety.md) before a
paid confirmation, recovery, retry, trial decision, or top-up handoff.

## Account and funding

Use `get_account_status` for the connected account, credit balance, trial state,
spending limits, and safe destinations. Never guess them.

If the exact quote reports insufficient credits, call `create_topup_link` with
that quote and direct the user to the exact returned MaxVideoAI destination.
Payment stays on MaxVideoAI. The old quote becomes invalid. After the user says
funding is complete, call `get_account_status`, then `prepare_generation` again,
show the fresh exact quote, and wait for explicit approval before confirmation.

## Failure policy

- Missing or expired authentication: explain that a MaxVideoAI account is
  required and let the host restart the connection flow.
- Invalid live field: refresh `get_model_details`; never guess a replacement.
- Lost response or timeout: recover status; never duplicate a paid request.
- Equivalent technical failure twice: stop and report the concrete live error.
- Browser handoff: use the exact returned URL and never claim the user completed it.
- Direct or local import: never expose capability links, local paths, or raw IDs
  in normal chat; report the human file names and whether each reference is ready.
