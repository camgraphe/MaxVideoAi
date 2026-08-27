# Plan a multi-shot product launch without losing spend control

One launch brief can become a coherent shot plan, a deliberate model choice, and one approved generation—without treating a project estimate as permission to spend.

## What is the intent?

Turn one launch brief into multiple shots, compare a quality-first proposal with a genuinely comparable lower-cost proposal, then prepare one selected concrete shot for approval.

![Completed MaxVideoAI workspace result paired with the saved result in the MaxVideoAI Library](../assets/demos/brief-to-video-workflow.webp)

*This visual proves a completed MaxVideoAI result can continue into the connected Library. It does not prove that a native host performed the brief, quote, approval, or generation shown in this example.*

## What prompt can I copy?

**Prompt to copy**: “Plan a three-shot launch film from this brief. Give me a quality-first proposal and a genuinely comparable lower-cost proposal. Recommend one concrete hero shot, but do not prepare or approve paid work yet.”

```text
Keep the brief reusable: audience, message, visual direction, shot count, duration target, and delivery format.
```

## What is the expected MaxVideoAI behavior?

1. `$plan` reads live model facts and turns the one launch brief into multiple shots.
2. It calculates comparable named project budgets for the quality-first and lower-cost routes without spending credits.
3. You select one concrete shot, model direction, and supported settings.
4. `$generate` validates that request and prepares a fresh exact quote.
5. The workflow stops for explicit one-attempt approval, then submits only that accepted job.
6. It follows completion and presents the result from the connected MaxVideoAI Library.

**Example**: A project budget helps choose the production route; it is not the exact quote for the selected request.

## Why use `$plan`, then `$generate`?

`$plan` is appropriate while creative and budget decisions are still open. It can compare live executable options without authorizing spend. `$generate` is appropriate only after one shot is concrete enough to validate, quote, and approve.

```text
$plan: compare the project routes
$generate: prepare one selected shot and wait at the approval boundary
```

## Where do quote, approval, and recovery happen?

The exact quote appears after `$generate` prepares the selected shot. Explicit approval is required before one paid attempt is submitted. If the response is lost or the conversation is interrupted after approval, recover the accepted job or list recent generations before considering a second paid request.

**Example**: “The response stopped after approval. Recover the accepted job; do not submit another paid request.”

## What stays in the MaxVideoAI Library?

Supported private references remain in the connected MaxVideoAI Library, and the completed result returns there for later presentation or reuse. A refunded attempt closes its authorization; a replacement requires a fresh exact quote and new explicit approval.

Read [how planning and generation divide responsibility](../docs/how-it-works.md), review [privacy and permissions](../docs/privacy-and-permissions.md), and verify [current compatibility evidence](https://maxvideoai.com/docs/mcp).

Last reviewed: 2026-08-28.
