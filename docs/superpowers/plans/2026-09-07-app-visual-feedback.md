# App visual feedback implementation plan

Spec: `docs/superpowers/specs/2026-09-07-app-visual-feedback.md`

## Global constraints

Existing isolated branch: `codex/app-catalogue-validation`; starting source `52a234cd6`. Preserve unrelated work, route orchestrators, media originals and historical financial records. Follow repository engineering guides. No new dependency, production mutation or charge. Browser qualification is owned by the controller. Run focused meaningful tests per task; the controller runs the full validation suite/build once after integration. Do not rewrite frozen historical parity fixtures merely to make new commercial behavior pass.

## Task 1: Compact, coherent workspace controls

Read this task as the requirements; the spec above is summarized completely here.

Files: `frontend/components/library/RecentMediaList.client.tsx`, `recent-media-copy.ts`, `frontend/components/groups/CompositePreviewDock.tsx`, `CompositePreviewDockToolbar.tsx`, `frontend/app/(core)/(workspace)/app/_components/WorkspaceCreationHeading.tsx`, `frontend/components/Composer.tsx`, `frontend/src/styles/app-experience.css`; touch adjacent tests only if their behavior/contract changes.

1. Inspect these components and their focused contracts. Group recent media kind buttons into one segmented selector with a clearly selected state. Replace the wide refresh text button with an accessible refresh icon action, preserving disabled/busy state and minimum 44px touch targets. Avoid a fabricated fixed media count in helper copy. Preserve image/video/audio, selection and drag/drop handlers.
2. Remove the creation heading's duplicate Library link; retain the existing primary Media navigation.
3. Give the workspace reader one coherent frame and a lighter toolbar, removing nested rounded white panels. Do not crop media, change preview column geometry, change original media URLs or add loading/autoplay behavior. Preserve all reader actions and labels or accessible names.
4. Make the composer toolbar respond to its available width: settings, quantity and Generate on one line where they fit; clean wrapping otherwise. Keep Options in the settings group, price fully readable and quote-refresh state safe. Check existing image and video shared usage. The membership label can be removed now because Task 2 retires the program, but do not change pricing logic in this task.
5. Use semantic named classes and local app styling. No global Button redesign or tiny touch targets. No trivial implementation-mirroring tests for CSS. Run affected existing recent-media/composer/preview contracts, lint and diff checks. Controller will check actual browser at mobile and desktop widths and both themes.
6. Commit only this task's files and write report with changes, exact checks, limitations and commit hash.

## Task 2: Retire new membership discounts coherently

Read this task as the requirements; the spec above is summarized completely here.

The user explicitly retires the member discount program. Implement a product policy, not just hiding its display. Read `docs/engineering/pricing-engine.md`, and `admin-routes.md` before touching admin UI/routes. Inspect existing pricing/membership and agent confirmation tests.

Key owners: `frontend/src/lib/membership.ts`, `frontend/src/server/membership/user-membership-status.ts`, `frontend/server/pricing/quote-billing.ts`, `frontend/src/lib/pricing-public-quote.ts`, `frontend/src/lib/billing-products.ts`, `frontend/app/api/member-status/route.ts`, and agent `prepare-generation.ts`, `generation-pricing.ts`, `confirm-generation.ts`. The canonical kernel under `packages/pricing` remains capable of interpreting historical discounts; retirement belongs in live product adapters/policy. Trace all live callers so injected legacy tier maps or stale client tier arguments cannot reactivate discounts.

1. Add an explicit browser-safe retired membership policy, used consistently at live quote boundaries and account status. New video, image, storyboard, fixed-product and agent/MCP quotes must have standard tier/zero membership discount. Keep spend/budget data if other consumers need it. Avoid broad database/schema migrations or edits to stored tiers. Preserve historical quote snapshots, receipts, refunds and paid execution amounts.
2. Keep quote preparation and confirmation membership contexts coherent. A stored discounted pending quote should require refresh/reconfirmation using existing price-change protections; never silently change a charge. Included trials and promotional credits are separate and remain supported.
3. Remove active membership benefits and controls from workspace, wallet/billing, public pricing sections and estimators/price details in EN/FR/ES. Keep historical discount itemization truthful. Retire admin tier editing so dormant stored settings cannot reactivate the program; retain audit/history access as appropriate. Inspect consumers and remove obsolete calls/state where safe, without restructuring unrelated large owners.
4. Add behavioral tests that prove new standard pricing for stale member/plus/pro inputs, authenticated account status, public/app/fixed-product parity, and old discounted agent quote reconfirmation. Preserve frozen pre-migration fixtures as historical evidence; if adapter migration tests assumed active membership, separate the historical kernel baseline from the new intentional product policy instead of regenerating snapshots. Existing architecture contracts must remain explicit.
5. Update the engineering pricing guide with the retirement boundary and historical behavior. Run focused pricing/membership/agent/billing/public architecture checks and lint/type checks as useful. Full suite/build are controller-owned once after integration.
6. Commit this task's files and write report with exact checks, history preservation evidence, limitations and commit hashes. If the scope reveals a genuine product ambiguity, report the concrete tradeoff to the controller; do not silently defer active discount surfaces.

## Qualification

Controller: inspect actual connected UI at 320, 390, 1139 and 1440px as useful, light/dark, video/image; test filter switching, loading/refresh, Options, pricing refresh and no horizontal overflow. No paid generation. Validate new quote amount against the standard canonical price and preserve the existing user draft. Run `pnpm run test:validate`, lint/exposure/types and frontend build with the existing secret-free validation launchers. Keep screenshots/logs in ignored task artifacts. Independent task reviews and final increment review precede completion; leave the branch isolated for user validation.
