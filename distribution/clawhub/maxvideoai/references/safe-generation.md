# Safe generation boundary

- Planning, recommendation, and `calculate_project_budget` are advisory and do
  not authorize a charge.
- `prepare_generation` validates one exact request and returns a temporary
  quote. It does not authorize `confirm_generation`.
- Require explicit approval of the current quote. If prompt, settings,
  references, model, or quote state changes, prepare a fresh quote.
- After confirmation is accepted, recover that accepted job with
  `get_generation_status` or `list_recent_generations`. A transport timeout is
  never permission to confirm again.
- A technical recovery may retry only an operation documented as unable to
  create another provider job or charge. A creative retry always needs a new
  quote and a new explicit approval.
- Private media uses the MaxVideoAI library or its bounded upload/import
  handoff. Do not copy private bytes or signed locations into durable skill
  files.
- Payment stays on MaxVideoAI. The agent may provide a first-party top-up
  destination but must not collect payment details in chat.
- Disconnect both sides: remove or log out the OpenClaw MCP entry and revoke
  the saved grant in MaxVideoAI account connections.
