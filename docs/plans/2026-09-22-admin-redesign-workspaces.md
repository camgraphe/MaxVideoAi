# Admin redesign — operational workspaces

Spec: `docs/plans/2026-09-22-admin-redesign-brief.md`. Continues the approved V2 direction on `codex/admin-redesign` after first-lot commit `76ab15e71`.

## Global constraints
Preserve authorization, public URLs, data queries, refunds, publishing confirmations and all pricing owners. No production mutation, merge or deployment. Use English, a compact light interface, tables and separators. Automatic public gallery migration remains a separate implementation with explicit privacy qualification.

## Task 1: Users and generations
Bring the directory and generation audit to the first screen: compact registration strip, consolidated identity/access columns, primary search/status filters, advanced filters available without dropping active query values. Preserve pagination, detail links and job actions. Simplify user detail identity and operational sections where safe.
Verification: existing user/detail/jobs contracts and filter behavior tests, TypeScript, local desktop/mobile browser. New tests cover changed behavior; pure styling is checked visually, not by brittle class assertions.
Expected: green checks; search, reset and drill-down remain usable. Commit the completed work.

## Task 2: Content and trends
Remove duplicate moderation summaries and put media controls first. Reshape article inventory into a compact table, distinguishing saved versions from confirmed publication without inferring publication from draft existence. Flatten Trends to one focus chart and secondary operational tables, removing repeated executive/pulse/narrative values. Preserve chart helpers and query semantics.
Verification: relevant existing architecture and publication contracts, focused behavior coverage where logic changes, local browser, lint/type check.
Expected: green checks; article and moderation actions stay guarded. Commit the completed work.

## Task 3: Qualification and review
Run focused admin/editorial tests, pricing parity, build and full Quality CI. Inspect desktop/mobile pages and save fictitious-data screenshots. One independent final review of the branch; resolve important findings. Update PR 332 and validation record.
Expected: clean committed branch; preview ready; no production rollout.

## Review Focus
Check that compact filters submit all active values; identity links and security context survive consolidation; moderation never labels a failed read as an empty successful queue; article versions never imply an unverified publication; reduced Trends retains the selected comparison and does not mix units.
