# Safe generation boundary

- A recommendation or project budget is advisory. `prepare_generation` returns
  an exact temporary quote; it does not authorize confirmation.
- Show the current quote and wait for its explicit approval. Changed model,
  prompt, settings, references or quote state require a fresh quote and approval.
- Use the discovered strict input schema. `confirm_generation` accepts the
  approved `quoteId` and `confirmed: true`; it has no client idempotency input.
- One approval permits one attempt. A failed or refunded attempt consumes it.
  A replacement or creative retry needs a new exact quote and new approval.
- After an accepted or ambiguous confirmation, recover the existing job. Use
  its known ID or `list_recent_generations`; do not repeat confirmation to
  recover a response.
- For a returned `retry`, wait at least `retry.afterSeconds` before calling
  `retry.tool` with `retry.arguments`. A null retry stops automatic polling.
  If the instruction is missing or cannot be followed, preserve the job and
  report the recovery limit instead of guessing a repeated paid operation.
- Private generation references must be owned MaxVideoAI assets when the live
  model contract requires them. Use available library or upload/import tools;
  never invent an external URL or assume a host attachment is already imported.
  Retain successful asset IDs and retry only failed imports. Do not persist
  private bytes, signed locations, or temporary upload capabilities in this skill.
- Funding occurs on MaxVideoAI. After a top-up invalidates a quote, inspect the
  account, prepare a new exact quote and wait for fresh approval.
- Reconnect with the host's supported flow while keeping the original brief and
  known jobs. Disconnecting requires both removing the host connection and
  revoking its saved grant in MaxVideoAI account connections.
