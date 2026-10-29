# Shared Milo levels — 2026-10-29

Studio and the video/image/audio prompt assistants use the same account, credit lots and settings dialog. Clicking Milo opens that dialog directly. Reading it or inspecting a tier does not select a model, buy credits or start a provider call.

| Level | API model | Reasoning | Funding | Retail $/million input / cached / output |
| --- | --- | --- | --- | --- |
| Lite | `gpt-6-luna` | `high` | Existing sponsored assistance, subject to fair use and availability | No customer credit debit |
| Standard | `gpt-6.1-terra` | `high` | Shared included/purchased Milo credits | 2.50 / 0.10 / 10 |
| Max | `gpt-6.1-sol` | `xhigh` | Same credit lots | 5 / 0.20 / 20 (unchanged) |

Canonical ownership: `assistance-contract.ts` defines levels, tariffs and the frozen runtime; `assistance-provider-facts.ts` verifies supplier usage; `quote-studio-assistance.ts` computes retail amounts. Terra uses the reviewed Standard/global/short-context supplier rates ($1 / $0.05 / $1.25 cache-write / $5 output per million), with the existing 100% markup on the conservative cache-write basis. No regional, Fast, long-context or hosted-tool rate is inferred.

The same 500 included monthly credits and purchased packs fund Standard and Max. Switching models retains purchased-usage pauses and all balances. A pack purchase retains the existing separate confirmation, frozen revision/tariff and idempotency key. Shared receipts say “Milo credit pack”; historical receipts are unchanged. Existing storage names (`included_sol`, `paid_sol`, `STUDIO_SOL_PACK_CENTS`) remain compatibility identifiers, not separate pools.

New task policy `studio-task-budget-2026-10-29-v3` freezes the model's reasoning and 6000 output tokens (including reasoning), keeping existing call, deadline and customer-credit ceilings. New non-task turns store `milo-levels-2026-10-29-v1` inside the immutable tariff snapshot. Composer requests load that snapshot rather than consulting the current account selection. Historical v1/v2 tasks and turns without the new runtime keep their original bounds. Provider errors and unknown usage retain existing recovery semantics; no blind retry or silent model downgrade is added. Existing final-credit completion and sponsored Luna fallback remain bounded.

The pinned SDK lacks `xhigh` in its generated type. `assistance-reasoning.ts` narrowly adapts that transport type; the actual API payload remains `xhigh`. Upgrade the SDK independently after compatibility verification.

## Deployment prerequisites

1. Apply **only the pending** migrations in order: 86 (account/turn Terra), 87 (frozen non-task bounds and optional composer table), 88 (three-level task profiles). Composer migration 85 must precede 87 when enabling prompt assistance. Studio task schema through 67 must precede 88.
2. Apply the migrations before deploying this runtime and its workers. Do not replay the full historical migration directory over an upgraded database: older migrations intentionally reject unfamiliar policy constraints. Use the reviewed pending migration list with a direct Neon connection.
3. Keep the existing assistance approval flags and independent prompt-assistance feature flag. The panel can read the real shared account in a visual composer preview; when assistance is disabled, it displays the tiers without inventing a balance or allowing a purchase.
4. Verify API access to the three exact models in the deployment's OpenAI project before activation. Official API documentation confirms the models and efforts; it does not prove project access. No live provider call, shared-database migration or deployment was performed for this change.
5. Rollback must preserve new records and tariffs. Do not run an old worker on v3 tasks or turn off credit accounting while new credit calls remain unresolved. Drain or pause dispatch and deploy a forward-compatible fix.

## Sources and validation

Verified official [Terra model](https://developers.openai.com/api/docs/models/gpt-6.1-terra), [Sol model](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [Luna model](https://developers.openai.com/api/docs/models/gpt-6-luna), and [pricing](https://developers.openai.com/api/docs/pricing) on 2026-10-29.

Focused PostgreSQL tests cover selection, frozen calls, both paid tariffs, shared grants/packs, pause/resume, duplicate settlement, support release, old policies and missing migrations. Browser tests cover direct dialog opening, three levels, draft/focus preservation and narrow Chromium/WebKit layouts. Provider payload tests use injected offline Responses, not billable calls.


Final validation on the committed candidate: 1,451 Studio/editor/export checks passed, 0 failures, 1 optional real-render check skipped, on a clean environment-free checkout. The 6 focused dialog/composer browser checks passed, including Chromium and WebKit at 320/390/1440 widths. TypeScript and exposure checks passed; ESLint reported no errors and 7 existing warnings. The independent review found a v2 video-fingerprint compatibility regression; a persisted historical fixture reproduced the permission stop, then passed after preserving the v2 recipe for v2 and v3. No critical or minor findings were recorded.

Review boundaries: malformed database model/tariff pairs remain guarded by normal reservation validation; no manual-history repair was added. Terra task extension is supported server-side; the legacy budget-pause button remains Sol-only because no reachable Terra budget pause was established under the current completion/fallback path. A future caller introducing those pauses must expose the same explicit extension control. API project eligibility, production deployment, shared migrations and billable quality evaluation were not performed.
