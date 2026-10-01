# Model pricing: interface and rollout backlog

The `/admin/pricing` cockpit is the single admin entry point for supplier evidence and MaxVideoAI customer prices. Keep supplier facts separate from commercial tariffs. An absent contract or invoice amount is unknown, never zero. All customer amounts come from canonical quotes.

## Now: make the page understandable

- [x] Put the comparison first; move the policy inventory and immutable history into separate tabs.
- [x] Show one short row per model/scenario with supplier **list estimate** and current customer quote. Reveal contract, invoice, promotion, source, policy and indicative gap on demand.
- [x] Separate each model into a card with blue supplier-list and purple customer-total tiles, a visible details control, and distinct evidence panels. Use current quote and supplier projections; do not copy illustrative mockup amounts.
- [x] Provide family, media, provider and text filters from the returned comparison rows. Future families enter through data, without a new page layout or invented placeholder prices.
- [x] Keep an explicit route from a comparison detail to its pricing rule and the existing server preview/confirmation flow.
- [x] Hide stale SWR data when the inventory request fails, and show a sign-in/retry path.
- [x] Confirm comparison, detail and rule flows in an isolated authenticated dev browser at desktop and mobile widths.
- [x] Open the user's in-app `localhost:3105` admin tab through the existing local development session and inspect the fresh comparison, supplier detail and rules inventory there.
- [ ] Diagnose the separate Google OAuth callback error in the in-app browser; the ordinary sign-in flow still does not restore that session.

## Next: complete commercial control

- [ ] Verify production-effective customer quotes and BytePlus contract/invoice costs for all sellable ByteDance scenarios. Keep list, temporary promotion, contract and observed cost distinct.
- [x] Complete exact manual customer tariff coverage and isolated local cutover for all 48 models, preserving every amount except the 24 separately approved +1-cent GPT reference floors. Reject missing or overlapping cells before charging. Production parity and activation remain separate.
- [x] Provide inline customer tariff editing, including continuous unit rates, affected-scenario preview, explicit confirmation, immutable history and rollback. Model percentage rules are historical/read-only in the active local sandbox.
- [x] Project all 15 families through supported scenarios, intended execution provider, qualified supplier references and canonical customer quotes. Account costs/invoices remain unknown unless confirmed.

The [2026-10-02 preproduction acceptance](2026-10-02-pricing-preproduction.md)
owns the current active-grid evidence, workflow correction and remaining release gates.
It supersedes earlier inventory counts and the negative Seedance-input checkpoint.
The usable review
page is [localhost:3106/admin/pricing](http://localhost:3106/admin/pricing), with
Video, Image, Audio, Tools and Storyboard sections.

## Related release gates on this branch

- [x] Connect Seedance 2.5 Draft 480p → optional final 1080p locally to independent quotes, charges, polling, refunds and creator controls. PostgreSQL and signed-auth browser acceptance distinguish workflow tariffs from ordinary 480p/1080p.
- [ ] Complete the bounded real app-owned storage/Studio Draft acceptance and reviewed publication gate. The preceding minimum provider pair proves provider execution only; the signed-auth browser uses disposable media and makes no paid submission.
- [ ] Run remaining direct-provider and original-image trust canaries, then retire only proven-unused ByteDance new-job Fal choices. Preserve historical provider-specific readers.
- [ ] Deploy through the reviewed GitHub/Vercel path, check the authenticated admin route, historical Seedance 1.5 first Play, and post-release Search Console/AI-search signals. Do not send support messages without the user's approval.
