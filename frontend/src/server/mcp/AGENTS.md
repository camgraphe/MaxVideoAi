# MCP server engineering rules

Created: **2026-09-21**. Reviewed: **2026-09-22**. Owner: MaxVideoAI engineering.
Applies to this server and its tool descriptors. Read
`docs/engineering/mcp-client-experience.md` before changing discovery, metadata,
authentication errors, or workflow guidance.

## Instruction ownership

- `instructions.ts` is a short discovery entrypoint, not a complete operating
  manual. Every combination of capability gates must remain **<= 2,000 UTF-8
  bytes**. The first 1,000 bytes must explain the product and exact-quote,
  explicit-approval, one-attempt boundary when generation is enabled.
- Each `tools/*.ts` descriptor owns its operation's prerequisites, effects,
  follow-up and recovery rules. Each description must stay <= 2,000 UTF-8 bytes.
  Use readable sentence blocks; do not repeat the global manual in every tool.
- Put input constraints in schemas and current facts in live results. Never copy
  a provider catalogue, price list or preferred-model ranking into instructions.
- Only advertise tools whose capability gates are open. Audio confirmation also
  requires paid generation. Do not enable a gate to satisfy a discovery test.
- When moving guidance, preserve the rule in its new owner and update the
  corresponding runtime metadata contract; do not just delete the old assertion.
- Size budgets are ceilings, not compression targets. Keep rules needed before
  tool selection in the global instructions. Explicitly retain prerequisites
  and failure branches, and record intentional policy changes separately from
  wording changes. Measure global instructions and tool descriptions separately.

## Continuity and authorization

- Installation, discovery, authentication and execution are distinct states.
  Missing credentials and rejected bearer credentials have different OAuth
  challenges. Keep HTTP 401, protected-resource discovery and private/no-store.
- Never expose credentials or guess why a token was rejected. Keep revocation,
  ownership and OAuth client binding enforced server-side.
- Generation always requires the exact quote and explicit approval. A refund or
  reconnect does not authorize another attempt. Recover the existing job after
  an ambiguous response before considering another submission.
- These rules do not authorize making account, reference, quote or generation
  tools public. Public discovery would require a separate isolation design.
- Keep complete structured results and a lossless compact JSON text fallback.
  Never remove data or media links just to lower response size. Follow returned
  `retry.afterSeconds` for status polling; a null retry ends automatic polling.
- Bound incoming JSON by bytes while reading the stream, even without a truthful
  Content-Length. Tests must prove early cancellation, not just a final 413.
- Reference upload capabilities are single-use. A retry batch needs fresh
  capabilities and must preserve prior successful asset IDs. Execute the embedded
  MCP App in regression tests; source-text assertions cannot prove recovery.
  `ui/update-model-context` replaces the view's previous context, so report the
  accumulated successful IDs after a retry, not only the last batch.
- Publish changed reference widgets under a new URI. Keep old URIs readable with
  the frozen legacy document and preserve its rendered-byte hash contract.

## Verification and maintenance

Run `pnpm mcp:client:check`, frontend lint, exposure lint and `git diff --check`.
The client check is deterministic and does not spend credits. Run affected
business tests when changing implementation beyond metadata.

Record dated changes, measured byte counts and evidence in the client-experience
guide. Refresh the curated policy fingerprint only after reviewing the changed
policy; never rewrite expected decisions merely to obtain green tests.

Metadata tests prove the published contract, not automatic selection by Codex,
Claude or ChatGPT. Record each real host/version independently using the guide's
protocol. Keep release, deployment and host verification statuses separate.
