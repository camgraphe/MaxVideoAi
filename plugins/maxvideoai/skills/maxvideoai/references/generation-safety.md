# Generation safety and recovery

Use this reference when a user is ready to generate, asks about an existing job,
needs more account funding, or asks about an unsuccessful result.

First use `prepare_generation` with the selected model, prompt, settings, and
references. It returns validation and the exact current quote for that request.
Show the relevant result and wait for the user's clear approval. Only then call
`confirm_generation`. Never turn a prior estimate, an ambiguous assent, or a
creative discussion into confirmation.

After confirmation, use `get_generation_status` for a known job or
`list_recent_generations` to recover recent work. Report only the status and
links returned by the service. Do not claim success early and do not start a
replacement automatically.

Creative dissatisfaction is a decision to make another explicit attempt. A
technical failure follows the returned job state and any returned refund or
recredit information. Keep those outcomes distinct in the conversation.

If the returned account context requires a funding handoff, use
`create_topup_link` only when available. If a trial condition appears in live
results, explain it as returned and ask before changing the request. Do not
guess account eligibility or invent an account action.
