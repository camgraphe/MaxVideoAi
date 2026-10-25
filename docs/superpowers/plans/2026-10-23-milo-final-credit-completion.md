# Milo final review corrections — PR #502

User-approved scope (2026-10-23): use the last Max credits and finish the response, sponsoring any missing credits; open Studio without a forced product-ad brief; finish public Milo Max naming; clarify Standard's lack of monthly quota.

## Implementation

1. Add failing PostgreSQL coverage for realistic input with 10/40 credits, full-output completion, task-ceiling fallback, replay, concurrent reservations, actual-use refunds and sponsorship after purchase/continuation.
2. Preserve each task's existing input/output/call/time bounds. Reserve only spendable customer credits, retain the full output allowance, and reserve full supplier exposure against the sponsored campaign for courtesy completion. Persist a versioned completion authorization beside immutable funding; settle actual usage up to the customer cap, record the gift, and exclude gifts from future customer charges. No negative balance, automatic purchase, generation consent change or analysis subsidy.
3. Permit sponsored Standard fallback at the task monetary ceiling and same-ceiling continuation in the UI. Keep incomplete tools non-executable and recover saved responses without another Max dispatch.
4. Remove the general Studio starter parameter, broaden workflow copy, replace six public Sol labels, and clarify Standard copy.
5. Run focused financial/entry tests, Studio QA and browser validation; request independent review, refresh previews, commit and push the same PR. Do not merge or deploy.

## Verification notes

Provider responses are injected in accounting tests. They prove charging and recovery behavior, not live model answer quality. Sponsorship remains subject to existing campaign availability and task resource limits. Support waivers and legacy assistance retain their existing recovery semantics.
