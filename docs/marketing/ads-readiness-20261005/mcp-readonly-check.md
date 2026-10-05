# Current installed Codex connection — bounded read-only check

5 October 2026. Surface: the MaxVideoAI plugin tools exposed to this Codex desktop chat, using the existing authorized connection. This is separate from historical Codex CLI evidence and from Claude Desktop. No OAuth connection was created or changed, no quote confirmed, no generation or payment performed, no private media exported.

- `get_account_status` succeeded; email verification and safe account/library destinations were present. No identifier, balance or account detail was retained here.
- `list_models` restricted to video succeeded and returned 29 model entries. This proves this request's discovery response, not execution of all models.
- `list_recent_generations` restricted to one completed video succeeded and returned one existing completed job.
- `get_generation_status` recovered that same known job without submitting a new attempt. Only status and success are recorded; job ID, private/signed media URLs, prompt, price and owner were omitted.

This supplements the offline OAuth/quote/recovery contracts. It does not prove a new-user sign-up, browser authorization, successful reconnection after revocation, new paid creation, exact host version compatibility, or an end-to-end Claude workflow. The selected ad hypothesis still requires a fresh controlled Claude recording and separate paid-generation authorization if new media is needed.
