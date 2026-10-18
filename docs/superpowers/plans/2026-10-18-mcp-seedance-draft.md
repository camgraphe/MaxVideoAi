# MCP Seedance Draft implementation plan

**Goal:** Quote, confirm and recover native Seedance 2.5 Draft 480p and separately approved 1080p finalization, without confusing standard 480p with Draft.

**Architecture:** Extend the canonical request with an explicit workflow discriminator. A transport adapter reuses the existing owned-parent resolver and media facts. Confirmation rechecks those facts and the independent tariff, then reserves the parent inside the existing wallet transaction. The trusted continuation uses the existing native provider submission and outcome owners.

**Constraints:** No paid canary, production change, wallet repair, receipt mutation or automatic resubmission. Preserve account isolation, quote hashes, expiry, capability gates and independent approval. Source changes do not update installed hosts. Use inline execution for this explicitly requested implementation.

- [x] Add failing normalization/schema and owned-parent adapter tests; implement shared request and workflow adapter.
- [x] Wire preparation, pricing, confirmation, atomic reservation and trusted provider continuation. Verify actual draft:true and draft_task payloads with disposable PostgreSQL and substituted HTTP only.
- [x] Expose live availability, constraints, prices and owned lifecycle through discovery and status/history. Test ordinary 480p, unavailable workflows, expiry, foreign owners, concurrent finals and repeats.
- [x] Update tool guidance, packaged skills/references, documentation and deterministic evaluation fingerprint. Record release/reconnect needs without claiming publication.
- [x] Run affected business tests, MCP client checks, lint, TypeScript and build where feasible; review the patch and prepare a GitHub PR without merging.

Validation: 1,365 MCP/Seedance tests passed, one existing skip; 68 focused checks passed; MCP client checks, TypeScript, lint/exposure, full frontend build and deterministic plugin archive passed. Reviewed PR: https://github.com/camgraphe/MaxVideoAi/pull/460. No paid canary or production action.
