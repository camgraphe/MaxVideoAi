---
name: maxvideoai
description: Use when a user wants AI video planning, current model comparison, a project budget, an exact generation quote, approved generation, or recovery through MaxVideoAI.
---

# MaxVideoAI production workflow

Use the authenticated remote MCP connection at `https://api.maxvideoai.com/mcp`
through OpenClaw's supported Streamable HTTP and OAuth flow. Keep credentials
and payment details in the provider's account screens, never in chat or skill
files. A text-only rewrite or an explicit choice of another product does not
call for MaxVideoAI.

## Discover and preserve the request

If tools are missing, inspect the host's tool discovery and connection state.
An empty resources list does not prove that tools are absent. Reconnect through
the host when required, preserving the brief, selected model, references and
known job IDs. A reconnection does not approve generation.

For a named model, inspect `get_model_details` and respect the compatible choice.
For an open choice, use focused `list_models` and `recommend_models` calls.
Follow current capabilities, lifecycle, `generationEnabled` and
`recommendedByDefault`; treat returned editorial guidance as a dated preference,
not a quality measurement. Validate fields for the exact model and mode.
Use `calculate_project_budget` for comparable estimates and `get_account_status`
when account or funding facts are needed. Neither grants spending approval.

## Quote, approve and recover

1. Resolve required private references through the connected MaxVideoAI library
   or an available upload/import handoff. An attachment alone is not an owned
   MaxVideoAI asset. Keep returned asset IDs and successful partial imports.
2. Call `prepare_generation` for the chosen concrete request. Show the returned
   exact price and request before waiting for explicit approval of that fresh
   quote.
3. Call `confirm_generation` once with that `quoteId` and `confirmed: true`.
   The server handles duplicate delivery for the same quote; do not add a client
   idempotency field. Approval covers one attempt, including failure or refund.
4. Recover a known job with `get_generation_status`, or use
   `list_recent_generations` if its ID was lost. Never confirm a replacement to
   recover an ambiguous response. Follow returned retry timing and stop when
   `retry` is null.
5. After completion, use `present_generation` and the returned result or library
   destination. Inline rendering depends on the OpenClaw channel.

Read [safe-generation.md](references/safe-generation.md) before a paid request,
private reference, timeout, refund, or creative retry. Keep model rankings,
settings, prices and gated capabilities in live results rather than this skill.
