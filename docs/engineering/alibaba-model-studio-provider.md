# Alibaba Model Studio video provider

This guide owns the operational contract for the direct Alibaba Model Studio video path. The code remains disabled by default, while the production deployment has been publicly enabled since 2026-09-14 after administrator canaries and the release gates below passed.

## Ownership and model mapping

The integration reuses the shared video-provider boundaries:

| Responsibility | Owner |
| --- | --- |
| Provider identity, model mapping, payload, response, errors, cost, and HTTP client | `frontend/src/server/video-providers/alibaba-model-studio/` |
| Provider selection and fallback policy | `frontend/src/server/video-providers/router.ts` |
| Submission and pre-acceptance Fal fallback | `frontend/app/api/generate/_lib/alibaba-model-studio-submission.ts` |
| Polling, durable output copy, completion, failure, and refund | `frontend/server/alibaba-model-studio-poll.ts` |
| Cron authentication | `frontend/app/api/cron/alibaba-model-studio-poll/route.ts` |
| Attempt lifecycle and sanitized snapshots | `frontend/src/server/video-providers/provider-attempts.ts` |
| Admin aggregate metrics | `frontend/server/admin-mcp-metrics.ts` and `frontend/server/admin-mcp-metrics-queries.ts` |

| MaxVideoAI engine | Direct model | Modes | Fal fallback-compatible modes |
| --- | --- | --- | --- |
| `wan-3` | `wan3.0-video` | T2V, I2V, Ref2V, edit, extend | T2V, I2V, Ref2V |
| `wan-3-prime` | `wan3.0-video-prime` | T2V, I2V, Ref2V, edit, extend | T2V, I2V, Ref2V |
| `happy-horse-1-1` | HappyHorse 1.1 mode-specific T2V/I2V/R2V models | T2V, I2V, Ref2V | all three |

Wan 2.5, Wan 2.6, and HappyHorse 1.0 are intentionally outside this direct route.

### Wan 3 input parity

Wan 3 Standard and Prime share the same authored capability schema. Reference mode accepts image, video, audio, one public HTTPS document URL, or one public HTTPS webpage URL. Document and webpage references are mutually exclusive and require prompt expansion. The direct adapter maps them to Alibaba `file` and `link` media; the Fal pre-acceptance fallback adds Fal's required `enable_thinking=true` internally, so that transport-specific switch is not exposed as a MaxVideoAI product control.

The workspace prompt-expansion control maps to Alibaba `prompt_extend`. Fal's `enable_safety_checker` has no documented direct Alibaba equivalent and remains transport-specific rather than a public cross-provider option.

Alibaba's smart duration (`duration=-1`) is deliberately not exposed. MaxVideoAI quotes and reserves an exact customer amount before submission, while smart duration makes the billed output length unknown at quote time. Keep the explicit 2–30 second duration until a separately reviewed estimate-and-reconciliation billing contract exists.

## Environment contract

All routing switches are server-only. Never create `NEXT_PUBLIC_` aliases for them.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ALIBABA_MODEL_STUDIO_API_KEY` | unset | Singapore-scoped credential; secret |
| `ALIBABA_MODEL_STUDIO_BASE_URL` | Singapore international endpoint | Optional public endpoint or private workspace host; treat a workspace hostname as private configuration |
| `ALIBABA_MODEL_STUDIO_REGION` | `ap-southeast-1` | Required region coupling |
| `ALIBABA_MODEL_STUDIO_ENABLED` | `false` | Master direct-provider switch |
| `ALIBABA_MODEL_STUDIO_PUBLIC_ROUTING_ENABLED` | `false` | Allows non-admin routing only after a separate launch decision |
| `ALIBABA_MODEL_STUDIO_ADMIN_ONLY` | `true` | Keeps the enabled route restricted to administrators |
| `ALIBABA_MODEL_STUDIO_FALLBACK_TO_FAL_ENABLED` | `false` | Enables eligible pre-acceptance fallback |
| `ALIBABA_MODEL_STUDIO_SUBMIT_TIMEOUT_MS` | `30000` | Submission timeout |
| `ALIBABA_MODEL_STUDIO_POLL_TIMEOUT_MS` | `30000` | Individual poll timeout |
| `ALIBABA_MODEL_STUDIO_POLL_MAX_MINUTES` | `185` | Local manual-review threshold |
| `ALIBABA_MODEL_STUDIO_POLL_TOKEN` | unset | Optional local cron token; secret |
| `CRON_SECRET` | unset | Shared production cron authorization; secret |

The API key, region, and base URL must belong to the same Singapore deployment. The client rejects non-HTTPS, non-Singapore, credential-bearing, path-bearing, query-bearing, or fragment-bearing base URLs. Do not copy a private workspace hostname into logs, tickets, tests, or documentation.

## Routing and fallback invariants

With the master switch off, existing Fal-compatible modes continue through Fal. Direct-only Wan edit and extend fail closed because no equivalent Fal route exists.

With the master switch on, an administrator may use the direct route while public routing remains off. A non-admin remains on Fal for compatible modes and cannot use direct-only modes.

Fallback is permitted only when all of these are true:

- the fallback flag is enabled;
- the mode has an equivalent Fal contract;
- submission failed with a transient, timeout, rate-limit, or invalid-response classification;
- Alibaba has not returned a provider task ID.

Once a provider task ID has been accepted, Alibaba remains authoritative. Never submit the same paid job to Fal after acceptance; polling must reconcile the accepted task instead.

## Capacity, polling, and output ownership

Treat 5 requests per second and 5 concurrent tasks as the current account safety ceiling. Verify the actual account quota before any later enablement and throttle below the lower of the documented and account-specific limits.

Alibaba task results are retained by the provider for approximately 24 hours. The application poller must therefore run continuously while direct routing is active. It polls only Alibaba-owned active jobs, records progress in the shared attempt ledger, and marks locally over-age jobs `polling_stalled` for manual review instead of blindly refunding them.

A provider success is not an application completion. The output video is first copied through the shared durable media path. The job becomes complete only after the owned video URL is stored and the shared media-library projection is updated. A failed copy remains retryable and must not publish an expiring provider URL as the completed asset.

## Pricing and observability

Customer quotes continue to come from the canonical MaxVideoAI pricing pipeline. They are not derived from the Alibaba provider-cost calculation. The attempt ledger stores a catalog-rate provider-cost estimate separately for margin and operational reporting:

- Wan 3 and Wan 3 Prime count source-video plus generated duration where applicable;
- HappyHorse 1.1 counts generated output duration;
- returned provider usage units replace estimated units when available.

This estimate uses the dated Singapore catalog rates encoded in the adapter. It does not know the Alibaba account's remaining free quota, temporary promotions, negotiated discounts, credits, taxes, or final invoice adjustments. Alibaba billing is therefore authoritative for cash cost and reconciliation; do not present `provider_cost_usd` as an invoiced amount when one of those account-level adjustments applies.

Admin metrics group the shared attempt ledger by provider and report only aggregate attempts, acceptances, completions, failures, fallbacks, stalled polls, cost coverage, and latency. They never select raw request/response snapshots, task IDs, URLs, prompts, or user identities.

Snapshots written by the common helper redact credential-like keys, workspace identifiers, signed URLs, oversized strings, and inline binary data. Provider errors shown to customers must stay provider-neutral.

## Production launch evidence

The public launch completed on 2026-09-14 with the Singapore account supplied for the Alibaba PoC:

- four Wan 3 calls completed successfully: two Wan 3 Prime and two Wan 3 Standard renders, each 15 seconds at 1080p;
- all four outputs were copied into durable MaxVideoAI storage and appeared in the Camgraph Admin library;
- the Alibaba console reported four HTTP 200 calls and no failure;
- MaxVideoAI charged $18.72 in total, moving the test wallet from $78.13 to $59.41;
- the Alibaba billing console showed $0 total, pre-tax, and bill cost because the calls consumed the Singapore free PoC quotas;
- the catalog-rate supplier value was $12.60 with the then-current Wan 3 Standard promotion, so the observed customer sale represented $6.12 nominal gross profit, or 32.7%, before taxes and other costs.

Happy Horse 1.1 is part of the same Alibaba direct adapter. Its public T2V contract was revalidated without spending: 3 seconds at 720p quoted successfully at $0.55, and 5 seconds at 480p quoted successfully at $0.46. A paid Happy Horse provider canary remains a separately approved spend.

## Post-deploy operating checklist

1. Run the provider, routing, polling, MCP, Studio, architecture, registry, pricing, lint, type, build, and diff checks under Node 22. Direct `tsx` test commands must include `--tsconfig frontend/tsconfig.json` so `@/` aliases resolve.
2. Open the authenticated `/admin/engines` surface once after deploying changed engine capabilities. Its existing seed owner refreshes system-owned `engine_settings` rows; administrator-owned rows remain authoritative.
3. Re-read each affected model through the public MCP catalog and prepare one zero-spend quote at the capability boundary. A published option that cannot be quoted is not launch-ready.
4. Verify production storage and the Alibaba cron independently, then keep monitoring accepted jobs until they reach a durable local terminal state.
5. Reconcile attempt-ledger estimates with Alibaba billing. Record free quota, promotion, discount, credit, and invoice differences outside `provider_cost_usd`.
6. Keep the fallback flag explicit and verify Fal credentials before deployment. Production enables only the eligible pre-acceptance path; do not broaden the compatible modes or error classes without a separate review.

Production currently uses the master switch, public routing, and the narrowly scoped Fal fallback described above. The defaults stay fail-closed for every unconfigured environment. The fallback was enabled on 2026-09-14 after the focused routing, submission, polling, refund, and architecture suite passed; no synthetic provider outage was introduced on the public route to force a live fallback.

## Rollback and release gates

The immediate rollback is to set `ALIBABA_MODEL_STUDIO_ENABLED=false`. Also keep `ALIBABA_MODEL_STUDIO_PUBLIC_ROUTING_ENABLED=false` and `ALIBABA_MODEL_STUDIO_FALLBACK_TO_FAL_ENABLED=false`. Continue polling already accepted Alibaba task IDs until they reach a durable local terminal state; disabling new routing does not cancel accepted work.

Before any later deployment or routing change, require:

- `pnpm model:registry:check`;
- the focused Alibaba provider, routing, submission, polling, storage-copy, refund, MCP, Studio, admin-metrics, and architecture tests;
- frontend TypeScript and lint checks plus `git diff --check`;
- a secret scan confirming that no key, workspace identifier, signed URL, or raw provider payload entered the branch;
- explicit approval for new provider spend and any materially broader routing or fallback change.
