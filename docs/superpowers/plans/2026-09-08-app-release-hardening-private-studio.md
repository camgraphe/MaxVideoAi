# App release hardening and private Studio implementation plan

**Goal:** Turn the current redesign into a coherent, responsive, production-ready application while keeping Studio available only to administrators for its first validation phase.

**Execution:** Work in independent lots with focused tests and commits. Preserve authored model, pricing, media, and Studio capability owners. Do not replace real behavior with demo state.

## Lot 1 — Release baseline and regressions

- [x] Confirm isolated branch, clean worktree, architecture audit, and existing focused commits.
- [ ] Re-run the complete test suite with the repository-supported Node 22 runtime.
- [ ] Fix remaining reproducible application failures: legacy marketing assets, Studio auth contracts, Angle atomic wallet behavior, and broken UI contracts.
- [ ] Run lint, exposure lint, TypeScript, `git diff --check`, and a production build.
- [ ] Smoke-test authenticated routes on desktop, tablet, and mobile.

## Lot 2 — Video and Image creation consistency

- [ ] Keep model selection fast and direct; move alternative pricing, pinning, and comparison into Compare.
- [ ] Align model, variant, player, prompt, references, options, quantity, price, and generate controls across Video and Image.
- [ ] Preserve model-specific start frame, end frame, reference, video reference, and audio reference compatibility rules.
- [ ] Make recent render actions compact, explicit, and responsive; use a two-column rail at intermediate widths.
- [ ] Verify Image uses the same visual language and compact contextual Media picker as Video.
- [ ] Add focused interaction and responsive contracts.

## Lot 3 — Audio creation hardening

- [ ] Repair quote preparation so valid Voice over, Instrumental, Song, Sound effects, and Ambiences drafts do not show `Price unavailable`.
- [ ] Expose the real supported models and quality choices through existing capability owners.
- [ ] Make recent audio creations selectable, highlighted, playable, reusable, and downloadable.
- [ ] Align visual hierarchy, compact controls, loading, errors, and mobile layout with the creation app.
- [ ] Validate pricing, reservation, generation, history, and responsive behavior.

## Lot 4 — Activity and Media performance

- [ ] Keep Activity as chronological generation/status history and Media as the reusable asset destination.
- [ ] Confirm every contextual picker reads the canonical account-scoped Media API with stable pagination and late-response protection.
- [ ] Measure `/api/jobs` and `/api/media-library/assets` read paths with fixed data and diagnostics.
- [ ] Remove any remaining schema/bootstrap or repair work from latency-sensitive GET routes, using migrations and explicit fallbacks.
- [ ] Verify thumbnail/original separation, lazy loading, pagination, empty/loading/error states, and account isolation.

## Lot 5 — Studio private admin validation

- [ ] Gate Studio navigation, project routes, workspace routes, and privileged APIs to administrators while leaving the implementation in the codebase.
- [ ] Stabilize project menus, canvas/viewer overlays, Project media, inspector, and timeline at desktop and narrow widths.
- [ ] Add quick insertion from Media and recent generated assets through typed Project media/timeline contracts.
- [ ] Connect the first bounded assistant/MCP edit action only when it can place real shots on the active timeline without inventing export or generation behavior.
- [ ] Run Studio architecture, unit, and browser smoke contracts with Node 22.

## Lot 6 — Wallet, Billing, Settings, and connections

- [ ] Remove membership-pricing presentation from application surfaces while preserving ledger, wallet, and Stripe correctness.
- [ ] Redesign wallet and billing hierarchy for balance, top-up, usage, receipts, and payment actions on desktop/mobile.
- [ ] Keep System as the default appearance when no device preference exists.
- [ ] Present ChatGPT and Claude connections with credible existing brand assets and clear connected/disconnected actions.
- [ ] Fix overlaps, inert controls, loading, empty, and error states.

## Final review

- [ ] Integrate each lot with a focused commit and rerun affected contracts after every merge.
- [ ] Run the complete test suite, lint, TypeScript, exposure checks, production build, and `git diff --check`.
- [ ] Review `/app`, `/app/image`, `/app/audio`, `/app/library`, `/jobs`, `/app/tools`, `/settings`, `/billing`, and admin Studio in the in-app browser.
- [ ] Leave the authenticated local application open for manual user review and document any environment-only limitation precisely.
