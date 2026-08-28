# Price an AI video project before generating

**Short answer:** Start with the shot list and ask MaxVideoAI for comparable project budgets. Request an exact quote only for the concrete model and settings you are ready to approve, so a planning conversation cannot quietly become paid work.

![MaxVideoAI workspace showing a selected model and a completed glass-ribbon video](../assets/demos/model-choice-and-budget.webp)

*This current MaxVideoAI product visual proves a selector and completed result. It does not prove a displayed budget, an exact quote, approval, or execution in a named host.*

## What are you pricing?

Write the shots, desired duration, quality priorities, and any reference needs. A consistent-model route can make a campaign easier to compare; a deliberate model mix can give each shot a different trade-off.

**Prompt to copy:** “Use MaxVideoAI to plan a four-shot product campaign. Compare one consistent-model route with one deliberate model mix, give named project budgets, explain the trade-offs, and stop before you prepare a paid generation.”

## What MaxVideoAI should do

`$plan` uses current model facts to produce named project budgets without spending credits. After you select a concrete shot, `$generate` prepares it and returns a fresh exact quote. Only explicit approval authorizes one paid attempt.

```text
Shot list → comparable project budgets → concrete request → exact quote → explicit approval
```

## What to do if the plan changes

Change the brief or settings, then request a new quote. An earlier approval does not cover a different request. If a conversation is interrupted after submission, inspect the accepted job before another paid request and recover its result from the MaxVideoAI Library.

Read the [pricing boundary](https://maxvideoai.com/pricing?utm_source=github&utm_medium=example&utm_campaign=assistant_video_workflows&utm_content=price_a_video_project) and [privacy and permissions](../docs/privacy-and-permissions.md) before connecting a host.
