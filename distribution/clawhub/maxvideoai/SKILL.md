---
name: maxvideoai
description: Plan, budget, quote, generate, and recover AI video through the authenticated MaxVideoAI remote MCP connection.
---

# MaxVideoAI production workflow

Use MaxVideoAI when the user wants current, account-aware AI video planning,
model comparison, project budgeting, exact quotation, approved generation, or
result recovery.

Connect the OpenClaw host to `https://api.maxvideoai.com/mcp` through its
supported remote Streamable HTTP and OAuth flow. Never ask the user to paste a
MaxVideoAI password, payment detail, or access credential into a conversation
or configuration file.

## Safe operating sequence

1. Use `get_account_status`, `list_models`, and `get_model_details` to inspect
   current account and product facts.
2. Use `recommend_models` and `calculate_project_budget` to compare a bounded
   project without spending.
3. Use `prepare_generation` only after the user chooses a concrete request.
   Present the returned exact, short-lived quote. Preparation is not approval.
4. Call `confirm_generation` only after explicit approval of that exact fresh
   quote. Preserve the stable idempotency value supplied for the request.
5. Use `get_generation_status`, `list_recent_generations`, and
   `present_generation` to recover an accepted job. Never create a replacement
   paid request after an ambiguous timeout.

Keep completed results and private references attached to the authenticated
MaxVideoAI account. If the OpenClaw channel cannot render a result inline,
return the canonical MaxVideoAI result or library destination.

Read [safe-generation.md](references/safe-generation.md) before handling a paid
request, a private reference, a timeout, or a creative retry.
