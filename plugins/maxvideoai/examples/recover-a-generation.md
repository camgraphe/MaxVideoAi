# Recover an approved generation before paying twice

After approval, recover the accepted or recent job before considering a second paid request. A stopped response is not permission to confirm again, and a refund closes the authorization attached to that attempt.

## What is the intent?

Find the outcome of one approved generation and restore result continuity without creating a duplicate paid attempt.

![Completed MaxVideoAI workspace result paired with the same saved video in the MaxVideoAI Library](../assets/demos/library-continuity.webp)

*This visual proves a completed MaxVideoAI result can remain continuous from workspace to Library. It does not prove a native host recovery, quote, approval, or transaction history.*

## What prompt can I copy?

**Prompt to copy**: “The response stopped after I approved the exact quote. Recover the accepted job or inspect recent generations. Do not prepare or submit a second paid request.”

```text
Safe recovery starts from the accepted job, not from a repeated confirmation.
```

## What is the expected MaxVideoAI behavior?

1. `$generate` checks the accepted job when the conversation still has its context.
2. If that context is missing, it lists recent generations and identifies the relevant outcome safely.
3. It presents a completed result from the existing job or reports the terminal refunded outcome.
4. It stops before preparing a replacement unless you explicitly request one.

**Example**: Recovery reads existing job state; it does not authorize spend.

## Why use recovery before `$generate` again?

The original explicit approval authorized exactly one paid attempt. Once MaxVideoAI accepted that job, repeating the request could duplicate spend. Recovery is the appropriate first action; `$generate` becomes appropriate again only for a deliberate replacement or creative retry.

```text
Accepted job → recover status → present completion or report refund
Replacement → fresh request → fresh exact quote → new explicit approval
```

## Where did the quote and approval happen?

The exact quote appeared before the original submission, and explicit approval authorized one attempt. A refund closes that authorization. A replacement requires a fresh quote and new explicit approval; the previous confirmation cannot be recycled.

**Example**: “If the job is refunded, explain the outcome and stop. Do not resubmit automatically.”

## What if the response is lost again?

Repeat the read-only recovery path for the same accepted job or recent generation. If no safe match is available, stop and use private support rather than guessing or spending again.

## What remains in the MaxVideoAI Library?

A completed result stays in the connected MaxVideoAI Library for presentation or reuse. Supported private references used by the request also remain in that Library. A terminal refund leaves no completed result to present, but it still closes the original authorization.

Use the [recovery troubleshooting guide](../docs/troubleshooting.md), review [how paid generation stays deliberate](../docs/how-it-works.md), and check the [current compatibility evidence](https://maxvideoai.com/docs/mcp).

Last reviewed: 2026-08-28.
