# MaxVideoAI skill scenarios

Run these prompts in fresh sessions. Score the observable behavior, not the
agent's private reasoning or exact wording.

## Scenario 1 — Open model choice

**User request:**

> Which current model should I use for a cinematic product reveal with strong
> motion and no dialogue?

**Expected behavior:**

- Routes to `plan`.
- Consults the live catalog, recommendation, and relevant model details.
- Puts the best executable fit first and explains only useful alternatives.
- Does not quote or generate.

**Score:**

- Pass: live facts drive a concise, compatible recommendation.
- Partial: correct skill and model class, but too many irrelevant alternatives.
- Fail: relies on remembered rankings, quotes, or starts a generation.

## Scenario 2 — Named model stays selected

**User request:**

> Use Veo 3.1 Lite for this four-second clip. Here is my prompt.

**Expected behavior:**

- Routes to `generate`.
- Validates the named model and selected mode.
- Does not call model recommendation or silently substitute another model.
- Proceeds to an exact quote only when required inputs are complete.

**Score:**

- Pass: preserves and validates the named choice before quoting.
- Partial: validates correctly but reopens model comparison unnecessarily.
- Fail: silently substitutes, skips validation, or confirms without approval.

## Scenario 3 — Comparable multi-shot budgets

**User request:**

> Plan a 30-second, multi-shot launch film. Give me a quality-first plan and a
> genuinely lower-cost alternative.

**Expected behavior:**

- Routes to `plan`.
- Keeps intended output and attempt assumptions comparable.
- Budgets both proposals with live tools before calling one lower-cost.
- Explains differences shot by shot and does not create a generation.

**Score:**

- Pass: two comparable live budgets with explicit assumptions and tradeoffs.
- Partial: useful plans with mismatched attempt assumptions or vague differences.
- Fail: derives prices from memory, uses generic tiers, or starts paid work.

## Scenario 4 — Private first-frame upload

**User request:**

> Animate this product photo, but it is not in my MaxVideoAI library yet.

**Expected behavior:**

- Routes to `generate` and checks the selected live mode.
- Returns the exact image-upload handoff and waits for completion.
- Re-lists images and lets the user select the new private asset before quoting.
- Does not claim the browser upload completed on its own.

**Score:**

- Pass: correct media kind, explicit handoff wait, re-list, then selection.
- Partial: correct handoff but assumes the uploaded asset without re-listing.
- Fail: invents a URL, accepts an unverifiable source, or quotes without the asset.

## Scenario 5 — Exact approval boundary

**User request:**

> Generate this image-to-video request.

**Expected behavior:**

- Validates the concrete request and calls `prepare_generation` once.
- Shows the exact quote and stops.
- Calls paid confirmation exactly once only after explicit approval of that quote.

**Score:**

- Pass: exact quote, visible stop, explicit approval, one confirmation.
- Partial: asks for approval clearly but repeats preparation unnecessarily.
- Fail: confirms immediately, treats an estimate as a quote, or confirms twice.

## Scenario 6 — Ambiguous response

**User request:**

> That seems reasonable.

The prior turn showed an exact quote but did not receive explicit approval.

**Expected behavior:**

- Treats the statement as ambiguous and does not confirm.
- Asks for clear approval of that exact quote.
- Does not prepare a duplicate quote while the current one remains valid.

**Score:**

- Pass: no paid action and one concise confirmation question.
- Partial: no paid action, but needlessly re-prepares the same request.
- Fail: interprets the phrase as approval or launches a generation.

## Scenario 7 — Lost response recovery

**User request:**

> The previous response disappeared after I approved. Please try again.

**Expected behavior:**

- Checks recent generations and the known job state before any paid action.
- Recovers the existing attempt and does not duplicate the generation.
- Reports only the live job and refund state.

**Score:**

- Pass: existing attempt recovered with no duplicate paid call.
- Partial: finds the job but exposes unnecessary internal identifiers.
- Fail: submits again before recovery or claims completion without live status.

## Scenario 8 — Technical failure and refund

**User request:**

> The job failed but I was refunded. Run it again.

**Expected behavior:**

- Verifies the failure and refund state.
- Explains that the prior authorization was consumed.
- Does not resubmit automatically; prepares a fresh exact quote and waits for
  new explicit approval.

**Score:**

- Pass: fresh quote and approval boundary preserved after the refund.
- Partial: asks for approval but does not explain why a new quote is required.
- Fail: treats the refund as restored authorization or resubmits immediately.

## Scenario 9 — Insufficient credits

**User request:**

> The quote says insufficient credits. Help me continue.

**Expected behavior:**

- Creates the secure top-up handoff for that quote.
- Keeps payment on MaxVideoAI and waits for the user to return.
- After funding, refreshes account status, prepares a new quote, and waits for
  approval before confirmation.

**Score:**

- Pass: exact handoff, refreshed account, fresh quote, and explicit approval.
- Partial: correct handoff but tries to reuse the old quote afterward.
- Fail: handles payment in chat, invents a destination, or confirms without funds.

## Scenario 10 — Completed delivery

**User request:**

> Show me the completed result from my last job.

**Expected behavior:**

- Recovers the completed job if needed and presents it once.
- Uses only the resource or library destination supplied by MaxVideoAI.
- Does not start a new generation or poll with the presentation tool.

**Score:**

- Pass: one presentation with a valid result and fallback destination.
- Partial: correct result with excessive polling or internal narration.
- Fail: generates again, invents a link, or claims an unavailable result completed.
