# Studio + MCP main integration — 4 October 2026

The owner authorized continuing integration and release qualification after the local candidate handoff. This record supersedes the earlier “no integration performed” status only for the operations recorded here; it does not claim production or package publication.

## Source reconciliation

Merged target `5251f4d3f826da175ed1c334e0c8e3e10b3fc82a` into the Studio candidate `f2e03df16`. All 107 conflicted paths were reviewed by responsibility. Current-main model/provider/pricing/editorial/gallery/authentication changes and the production Git provenance gate are preserved alongside Studio's conversation, assistance, private media and MCP features. Dependencies use the merged frozen lockfile (Next 15.5.25, Sharp 0.35.4).

The reconciliation found two compatibility issues beyond textual conflicts: historical Mini trial validation through the mixed quote reader, and versioned video measurements losing original-file provenance during a library copy. Both received focused regressions. Local login preserves both the one-level PKCE route and the chosen language. The admin navigation keeps main's compact grouping and adds Studio interaction review to Overview.

Package 0.3.7 is a local release candidate. Fresh GitHub and official Registry reads confirmed 0.3.6 as published/latest and 0.3.7 unused. Public-site installation metadata points to published 0.3.6 until the new artifact is actually available. No tag, release, Registry record or external listing has been changed.

## Environment checkpoint

Production still serves GitHub main `5251f4d3f826da175ed1c334e0c8e3e10b3fc82a`, deployment `dpl_Gmbi8ZZuajWdQWparYELy8Nec2ne`, on both `maxvideoai.com` and `api.maxvideoai.com`. No production configuration or data was changed.

The existing protected `maxvideoai-studio-pilot` project (`prj_YfetGQTdeFzHBjiEagQEgI4KyQtU`) has its own schema-only Neon branch `br-twilight-sea-ae32jnf3`, private storage and preview-scoped credentials. Migrations `54_studio_assistance_ledger.sql` and `55_admin_studio_review_access.sql` were applied there as one targeted transaction. Verification found zero assistance accounts/calls/choices/review events, the immutable-call trigger and the review index. The first transaction submission was rejected before execution because the connector accepts one SQL statement per array entry; splitting the exact migration sources into 14 statements succeeded. No historical wallet/project/media rows were changed.

The separate public MCP staging project's five schedules remain paused. Its discovery and authorization discovery endpoints return 200. It has no Studio assistant configuration and has not been redeployed by this work.

## Validation status at integration commit

Focused backend, archive/marketing, login and MCP checks passed, including disposable PostgreSQL scope tests. The current pricing baseline retains 577 rows. MCP client checks passed 150 tests plus all 70 offline policy scenarios, with the existing optional Codex validator skipped. Initial integrated TypeScript, model-registry, frontend lint and exposure checks passed; lint retains six existing native-image warnings. The complete integrated 1,308-file standard suite and four isolated Studio files, final build and hosted qualification follow this commit. Earlier candidate test totals do not certify this new merge.

The OpenAI text validation ceiling remains the original cumulative $5. Settled usage before hosted qualification is $0.490465965, with no unresolved reservation. This integration has made no new model call, paid media generation or render dispatch.
