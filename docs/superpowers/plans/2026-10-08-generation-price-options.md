# Generation price options implementation

Goal: offer three suitable, freshly priced choices and honest savings in Studio and MCP.
Architecture: one shared read-only comparison owner over generation-pricing-read; transport adapters preserve Studio certification/attachments and MCP actor/access gates.
Tech stack: TypeScript, Zod, canonical model projections/pricing, node:test, existing Studio/MCP contracts.
Spec: ../specs/2026-10-08-generation-price-options.md
Global constraints: no price tables, new model lists, quote/billing mutations, provider requests or increased response allowance. Explicit constraints and owned references remain exact.
Review focus: compatibility before selection, audio/reference combinations, current baseline savings, no authority injection, bounded history and metadata.

1. Add behavioral tests for shared comparison (three price levels, few matches, strict constraints, references/audio, unavailable prices, baseline savings). Observe failure, implement generation-price-comparison.ts using the existing read seam, then pass focused tests.
2. Add pricing.compare contract/action and visual service adapter. Update director guidance for open model choice, preserve explicit model/direct preparation. Cover strict tool schema and saved comparison history. Run Studio pricing/director tests.
3. Register compare_generation_prices in MCP with the shared service, schemas and read-only metadata. Update discovery/skills and policy fingerprint intentionally. Run MCP client checks.
4. Add concise localized quote footer inviting model, resolution, duration and price comparisons. Update engineering ownership documentation. Run type/lint/exposure, Studio suites and browser verification; review final diff.

Execution: inline in the managed worktree, following the user's authorization to proceed. Focused tests precede implementation. No production delivery is part of this change.
