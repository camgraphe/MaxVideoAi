# OpenAI provider configuration — 2026-10-30

## Purpose

Apply the ChatGPT Pro API-credit benefit to MaxVideoAI's direct OpenAI calls.
The benefit was linked to the subscription owner's Personal API organization,
where billing confirmed an initial $199 grant and a $200 renewal allocation
scheduled for 2026-11-29. Credits expire with the subscription billing cycle.

The existing MaxVideoAI API organization did not display the linking offer.
Its existing key remains active for rollback. No support request was sent.

## Configuration

- A dedicated key, `maxvideoai-production-pro`, belongs to Personal's Default
  project. It has no expiration and restricted permissions: list models,
  Responses read/write, and Chat Completions requests.
- The existing Vercel `OPENAI_API_KEY` value was replaced. Its original default
  environment targets remain development, preview, and production. Separate
  branch-specific preview overrides were not changed.
- The secret is stored only in server configuration, never in this repository.
- This documentation release applies the new environment value through the
  normal GitHub PR, Quality CI, merge-to-main, and Vercel Git deployment path.
  No application code or provider routing changes are required.

## Validation and scope

The new key successfully listed the required `gpt-6.1-sol`, `gpt-6-luna`, and
`gpt-audio-1.5` models. Live checks passed for Responses input-token counting,
a minimal text response, and Chat Completions with a synthetic silent WAV.
Personal's limits page reports the Launch tier.

The benefit covers usage billed directly to this OpenAI organization. Image or
video generations routed through fal or another provider keep their existing
provider billing. Credits are used before paid OpenAI balances; without any
remaining credits, API calls fail rather than drawing from the previous
organization's balance.

After the Git deployment is READY, verify both production domains against the
merged revision, confirm the deployment's OpenAI credential matches the new
key, and check the affected application paths. Rollback consists of restoring
the previous server credential and deploying that configuration through the
same Git delivery policy.

Reference: [API credits for ChatGPT subscribers](https://developers.openai.com/api/docs/guides/chatgpt-api-credits).
