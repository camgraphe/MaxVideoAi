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
- [ ] Complete exact manual customer tariff coverage in the canonical pricing engine, preserving current customer totals to the cent at the initial cutover. Reject missing or overlapping cells before charging.
- [ ] Add an admin editor for an explicit customer tariff cell, with affected-scenario preview, explicit confirmation, immutable history and rollback. The current editor changes margin rules, not direct price cells.
- [ ] Add provider-family projections to the same comparison contract one family at a time. Each family must bring a supported scenario, true execution provider, supplier provenance and canonical customer quote.

## Related release gates on this branch

- [ ] Connect Seedance 2.5 Draft 480p → optional final 1080p to independent quotes, charges, polling, refunds and creator controls; keep it unpublished until tested.
- [ ] Run remaining direct-provider and original-image trust canaries, then retire only proven-unused ByteDance new-job Fal choices. Preserve historical provider-specific readers.
- [ ] Deploy through the reviewed GitHub/Vercel path, check the authenticated admin route, historical Seedance 1.5 first Play, and post-release Search Console/AI-search signals. Do not send support messages without the user's approval.
