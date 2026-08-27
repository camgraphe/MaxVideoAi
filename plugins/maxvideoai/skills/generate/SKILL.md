---
name: generate
description: |
  Prepare, approve, generate, present, and recover AI video or images through the connected MaxVideoAI account. Use when: "generate this", "animate this image", "use my reference", "quote this request", "create the video", "check my job", "show my result", or when a selected MaxVideoAI request is ready for exact pricing. Chain from plan after a model is chosen, or use directly when the request is already concrete. NOT for: open-ended model comparison or multi-shot project budgeting before a request is selected (use plan).
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

For references, first call `list_media` by image, video, or audio kind. When an
asset is missing, call `create_reference_upload_link` for that kind and send the
exact returned browser destination. Wait for the user to say the upload is
complete, then call `list_media` again and let them select the private asset.

Required typed references must be private MaxVideoAI assets so their metadata
can be verified. Do not replace them with an arbitrary external URL. Read
[reference inputs](references/reference-inputs.md) for first and last frames,
source video, ordered references, edits, extensions, and conditional assets.

## Quote, stop, and wait

Call `prepare_generation` only after the model, mode, prompt, settings, and
references are concrete. Present the exact price and relevant validated request,
then stop and wait for explicit approval of that quote.

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
