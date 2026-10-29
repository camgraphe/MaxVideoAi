# Milo live check — 2026-10-29

PR #555 candidate `0151ddeb2` was checked against actual OpenAI Responses and an isolated Neon branch copied from the current application database. This is a bounded functional check, not a comparative quality benchmark or a production release.

## Environment and migrations

- Branch: `test/milo-pr555-live-20261029`, PostgreSQL 17, 0.25 CU with 300-second idle suspension.
- Applied only migrations 85, 86, 87 and 88, in one transaction. Existing account/call counts and aggregate historical charges were unchanged by the migrations.
- A subsequent read-only check confirmed that the parent still lacks the composer tables and Terra account constraint: the parent was not migrated.
- All three exact API model IDs were accessible with the existing project credential. Responses confirmed Luna/high, Terra/high and Sol/xhigh under the frozen 6,000-token output allowance.
- The local app on port 3018 now uses the isolated branch and live Milo flags through the ignored `frontend/.env.development.local`. The original `.env.local` remains untouched. Connection details, synthetic responses and audit queries are private under `.local/milo-live/`; no credential or account identifier is committed.
- The database is isolated; OpenAI text calls are real and billable. No media generation, credit-pack purchase, parent migration or deployment was triggered.

## Completed checks

| Case | Evidence |
| --- | --- |
| Lite, Standard, Max | Two consecutive video exchanges per level, using the actual Seedance 2.5 guide. Each retained the scene and incorporated the second request to remove lettering/music and change the door action. |
| Included credits | Lite did not consume customer credits. Each short Standard reply used 10 credits; each short Max reply used 30 credits. |
| Replay | Replaying each of the eight service requests returned the saved reply without another provider call or another debit. |
| Image | Standard returned an English square product-photo prompt using the GPT Image 2.5 Flare guide. |
| Audio | Standard returned only two spoken French sentences for voice over, with no stage directions. |
| Browser | The shared panel selected Standard; an actual Wan 3 composer exchange completed. `Use prompt` applied the result and `Undo` restored the preceding text. |
| Purchased credits | The copied account's displayed purchased balance changed from 1,540 to 1,530 credits after that browser exchange. No pack was bought. |
| Draft safety | Changing the manual draft disabled the stale suggestion. The user's original 9,914-character draft and initial Lite selection were restored after QA. |
| Long draft | Standard revised a 10,807-character, ten-shot video prompt in 43.3 seconds. The 10,797-character result exactly matched the original with only the ten requested `navy-blue apron` → `rust-red apron` substitutions. All timings and other text were preserved; the exchange used 40 included credits. |

All **ten** provider responses completed and settled, with no unresolved reservation. They cost an estimated **$0.05065385** in supplier usage, according to the recorded provider facts and existing rate policy. Customer assistance accounting totaled **150 credits** on the isolated branch (140 included credits on a synthetic QA account and 10 purchased credits on the copied browser account). This is not an OpenAI invoice or a forecast of average production cost.

Short service exchanges took approximately 14–17 seconds for Lite/Standard and 27–35 seconds for Max, including token counting, database work and settlement. The first Lite result was recovered during a QA reporting-script correction; its replay duration is not treated as live response latency. No duplicate call was made for that recovery.

## Scope and operational limits

- The three levels were tested with short video briefs. Image/audio checks used Standard; not every generator, operation, reference combination or Studio autonomous task was exercised.
- Nano Banana Pro was rejected by the local capability preflight because its media-provider route was not executable in this environment. That rejection occurred before a provider call; image QA used the available GPT Image route. No capability gate was bypassed.
- Reference perception remains metadata-only. These checks do not establish visual or audio understanding.
- The local branch is retained for hands-on review. Do not deploy its credentials, copy its synthetic records into production, or run media workers as part of this text-assistance check.
- Before production activation, apply the reviewed pending migrations to the intended environment, verify its configuration and complete the normal PR/release checks. This local activation does not enable the hosted PR preview or production.
