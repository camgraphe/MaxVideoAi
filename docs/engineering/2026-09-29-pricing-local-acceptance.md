# Pricing branch local acceptance — 2026-09-29

## Environment and scope

Branch: `codex/bytedance-pricing-grid`, in its managed worktree. The local admin is served at `http://localhost:3106/admin/pricing`. This continuation performs no push, merge, deployment, production migration, remote database write, provider generation or support communication.

`pnpm pricing:sandbox` provisions a private Unix-socket PostgreSQL database and clears inherited and env-file credentials. Auth/API configuration points at loopback; providers use mock mode and analytics is disabled. The ignored worktree `.env.local` remains sanitized after exit. Its original credentials are backed up with mode 0600 in the runtime directory and are not restored automatically.

The production manual-tariff flag in `frontend/config/customer-tariffs.json` is false, with no versioned cells. The database seed is local and inactive. The development code gate requires both development mode and a validated local socket database URL. There is no global-activation admin endpoint.

## Accepted local behavior

- Registry-derived admin inventory: **48 app-published models across 15 families**, including executable legacy models without republishing them in public Pricing.
- **66,549** captured customer scenarios staged as explicit cents from the reviewed effective baseline. The local read-only parity check finds **0 missing sampled cells and 0 cent differences**. This proves parity for the collected scenarios, not exhaustive supported capabilities.
- Local authenticated API cycle: preview, confirm, immutable history and rollback; a Mini 5s/720p/16:9/silent price was changed from 95 to 96 cents and restored to 95. Global activation remains false.
- Supplier LIST estimate, verified account cost, observed invoice cost and historical retail basis have separate provenance. Unknown effective/observed costs remain unavailable rather than zero.
- Closed active tariff versions are immutable. New active updates and rollbacks append server-timed versions and increment the shared revision; deletion of active cells is rejected.
- Manual displayed revisions are propagated by web/image/Studio/Storyboard. The new wallet debit checks and locks that revision in the same transaction. MCP revalidates its prepared snapshot and maps tariff races to its stale-quote protocol.
- A stale displayed quote refreshes browser estimates without retrying generation automatically. Owned paid image/storyboard jobs and recovered reservations retain their original amounts and snapshots.
- Current database-aware quotes feed public Pricing, visible model offers and JSON-LD, model decision cards, estimators/chips, the homepage price demo, and current/reference/unavailable example prices. Stored receipts and refunds are not repriced.

The independent safety review found and prompted fixes for paid image recovery and missing storyboard snapshot propagation. Its follow-up found no remaining important issue in those reviewed inactive flows; it did not establish cutover readiness.

## Verification

Focused revision, wallet transaction, paid-image recovery, MCP confirmation, Studio pricing and Storyboard tests: **56 passed**. The Storyboard DOM test verifies both generation and edit revisions refresh while only calling the estimate endpoint.

TypeScript, lint and the public-exposure guard pass. Full-suite and build results are recorded after the final validation run. Local admin HTTP and inventory responses are verified. Visual desktop/mobile browser acceptance remains pending: in-app browser control timed out at `Emulation.setFocusEmulationEnabled`, and Chrome blocked the local tab with `net::ERR_BLOCKED_BY_CLIENT`.

## Remaining release gates

1. Resolve **122 capability boundaries**: automatic/custom selectors, open or fractional media durations, reference metadata, and unbounded token budgets. They are gaps in scenarios, not 122 missing models. Select exact supported tariffs or explicit reviewed unit terms without changing initial effective cents.
2. Generate and review the complete versioned retail seed. Test the first DB override and rollback of a versioned-only cell, including temporal quote history.
3. Define supplier evidence and settlement policy. Seedance's padded legacy retail basis is not a verified provider invoice and cannot govern a misleading below-cost decision.
4. Bind captured direct PaymentIntents to their original paid quotes through generation recovery and refunds. Metadata revision alone is insufficient; current preflight cannot establish that guarantee after an edit.
5. Complete the remaining consumer inventory and localized/browser acceptance, including open media quotes and bundle semantics. Revalidation is not permission to advertise a stale fallback as current.
6. Implement and exercise the full activation gate on an isolated local database only: complete coverage, zero cent delta, matching registry hash and effective DB revision, stale-confirmation rejection, and no active-model fallback to the global 30% rule.

The global 30% rule is still the live legacy authority while manual tariffs are inactive. Removing it globally and activating production prices are separate release operations after these gates; this continuation does neither.
