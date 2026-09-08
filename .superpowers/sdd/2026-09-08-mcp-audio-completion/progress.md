# MCP Audio completion ledger

Task 1 is complete after corrective reviews. Task 2 private preparation/confirmation services are implemented locally and awaiting final validation/review. No public Audio generation tool is registered yet.

| Boundary | Decision / dependency |
| --- | --- |
| Existing web Audio → shared reservation | Selectively reuse e274b0871, preserve canonical pricing and existing execution. Validate wallet/job rollback on disposable PostgreSQL. |
| Quote SQL → surface codec | One lifecycle and table; SQL surface predicate must precede all mutations so wrong-surface calls cannot claim/invalidate another request before parsing it. Preserve video/image/trial defaults. |
| Canonical Audio → execution | Strict versioned settings and ToolAssetRef identities, never client URLs or provider endpoints. Existing validation remains semantic owner. |
| Mixed activity/top-up → Audio | Explicit union reader and actual next-tool names; preserve old payload signatures/fresh approval. |
| Confirmation → sources/providers | Preparation network work outside transaction; stored identities/policy and wallet/quote claim revalidated inside. Task 2 depends on qualified Task 1. |
| Result App → Studio | New immutable v5 for Audio; preserve pending Studio shared registration. Task 3 depends on Task 2. |

The source checkpoint is scaffolding, not acceptance evidence. Independent review follows the completed Task 1 increment. No provider call, remote mutation or profile activation.

Task 2 uses exact owned reference evidence, canonical current pricing and shared mixed spending/wallet state. Its disposable PostgreSQL proof covers same-quote exact-once execution, distinct-quote wallet serialization, rollback, drift/refusal and exact failure refund. See task-2-report.md and docs/engineering/mcp-audio.md; Task 3 owns registration and results.
