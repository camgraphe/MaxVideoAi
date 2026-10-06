# Clarity measurement

Clarity initially loads on consented public marketing/tool pages in production.
An SDK already loaded there can follow subsequent SPA navigation, as before.
This integration does not initialize recordings for direct workspace/billing
entries. GA4 and server records remain the complete commercial measurement path.

The CMP sends separate analytics and advertising storage choices through
`consentv2`. Analytics consent alone never grants ads consent. Authoritative
commercial admin exclusion from `commercial-client.ts` suppresses initialization,
commands and the event mirror. Role resolution or consent withdrawal stops the
loaded SDK even after its React loader unmounts. Restoring eligible consent on a
public page starts the existing SDK without inserting a second script.

`clarity-context.ts` supplies public page, category, locale and route-family tags.
The authored `page` tag omits queries/fragments; private identifiers are not added
as page tags. This does not scrub the vendor's automatically recorded URLs or DOM.
Keep project masking enabled; inspect private content masking before expanding
initial recording scope. Existing custom visitor identifiers are unchanged.

`ordered-events.ts` mirrors allowlisted canonical event names after successful
prepared GA4 sends. Clarity receives only `mvai_<event>`: no payload, prompt,
job ID, account ID, signed URL, transaction ID or money amount. It creates no new
queue or journey and retains the existing bridge's role resolution and deduplication.
Clarity failure cannot retry an already successful GA4 send. Events require a
loaded eligible SDK, so they are a subset of canonical events, not a revenue ledger.
Automatic Clarity sign-up/purchase heuristics remain separate from these events.

Verification: `tests/clarity-measurement.test.ts` exercises consent separation,
stored and resolved exclusion, event/URL privacy, loaded-SDK stop/restoration,
single injection, and success/failure/retry mirroring. Existing analytics, auth,
consent and role-lifecycle tests cover the shared transport contracts.
