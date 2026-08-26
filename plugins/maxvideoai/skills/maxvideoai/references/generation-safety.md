# Generation safety and recovery

Use this reference when a user is ready to generate, asks about an existing job,
needs more account funding, or asks about an unsuccessful result.

First use `prepare_generation` with the selected model, prompt, settings, and
references. It returns validation and the exact current quote for that request.
Show the relevant result and wait for the user's clear approval. Only then call
`confirm_generation`. Never turn a prior estimate, an ambiguous assent, or a
creative discussion into confirmation.

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
