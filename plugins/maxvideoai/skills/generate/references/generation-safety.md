# Paid generation safety and recovery

Load this reference when a user is ready to generate, asks about an existing
job, needs more account funding, or asks about an unsuccessful result.

First use `prepare_generation` with the selected model, prompt, settings, and
references. It returns validation and the exact current quote for that request.
Show the relevant result and wait for the user's clear approval. Only then call
`confirm_generation`. Never turn a prior estimate, ambiguous assent, or creative
discussion into confirmation.

That confirmation authorizes exactly one paid attempt. It is consumed whether
the job is accepted, failed, or refunded. A refund or recredit does not restore
the authorization. Every replacement attempt requires `prepare_generation`, a
fresh exact quote, and new explicit approval.

Use `get_account_status` to explain the current credit balance, trial state,
spending limits, and returned account destinations. Existing MaxVideoAI credits
belong to the connected account; do not guess a balance or payment state.

After confirmation, use `get_generation_status` for a known job or
`list_recent_generations` to recover recent work. Report only the status and
links returned by the service. Do not claim success early and do not start a
replacement automatically. A completed result is saved in the same connected
MaxVideoAI library; use only the returned library or workspace destination.

Honor the returned status schedule: wait at least `retry.afterSeconds` before
calling `retry.tool` with `retry.arguments`. A null `retry` ends automatic
polling. This schedule recovers the existing job and never permits another
generation attempt.

For a technical failure, inspect the returned failure and refund or recredit
state and do not resubmit automatically. A creative retry is a new paid attempt:
use `prepare_generation`, show the new exact quote, and wait for explicit user
approval before `confirm_generation`.

If an exact quote reports insufficient credits, use `create_topup_link` with
that quote and direct the user to its exact returned destination. Payment takes
place only on the MaxVideoAI website. The old quote is invalid after the funding
handoff. After the user says funding is complete, call `get_account_status`, then
`prepare_generation` again, show the fresh exact quote, and wait for explicit
approval before confirmation. If a trial condition appears in live results,
explain it as returned and ask before changing the request. Do not guess account
eligibility, invent an account URL, or claim the browser step completed.

## Seedance 2.5 native Draft → final

Use the workflow fields only when the retrieved live schema and details expose
them. For a true Draft, prepare with `seedanceWorkflow: {"step":"draft"}` and
compatible settings/references. The workflow locks native 480p and one output.
Show the Draft quote and any returned final supplement and total. Label the
future final price as a current estimate until a separate final quote exists.
Never promise a free final, unverified savings or pixel-for-pixel preservation.

After separate explicit Draft approval, confirm once. Recover its MaxVideoAI
job ID with status/history and deliver the result for review. The returned
`seedanceWorkflow` reports actual expiry, eligibility and existing final job.
Only `finalizationAvailable: true` authorizes offering a final quote. For an
existing finalJobId, recover that job; neither uncertainty nor a refund permits
an automatic replacement. Expired, failed, pending and reserved Drafts cannot
be silently replaced or converted from an ordinary 480p video.

To prepare the final, use the same model and
`seedanceWorkflow: {"step":"final","draftJobId":"<owned MaxVideoAI Draft job ID>"}`.
Omit mode, prompt, settings and references: the server inherits the Draft's
creative facts and reuses its private provider reference. Never accept or invent
a provider task ID. Show the separate exact final quote, the paid Draft cost
and combined total when returned; wait for new explicit final approval, then
confirm once. A final quote is not approval of another Draft or a retry.

Do not promise a new seven-day window after completion or reconnection. Use the
server's actual expiresAt and state, including when a quoted Draft expires
before confirmation. If an older host schema lacks workflow fields, refresh
its supported connection/catalog and preserve known jobs. If still unavailable,
say so and offer the web path only when live availability confirms it.
