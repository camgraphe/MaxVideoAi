# Task 9 Report — Launch Generation Briefs (Pre-Quote)

Date: 2026-09-03

## Status

**Blocked before exact quotes/generation.** The eight launch briefs and their
canonical request projection are ready for review, but this phase deliberately
made no quote, prepare, confirmation, provider probe, paid submission,
generation, migration, or publication request. No generation manifest or
output URL has been created or accepted.

Commits:

- `71d5673fc content: add p1 launch generation brief`
- `content: harden p1 launch generation briefs` (review round 1; this commit)

## Delivered

- Exactly eight distinct briefs: two each for Gemini Omni Flash, Kling 3 Turbo
  Standard, Kling 3 Turbo Pro, and MiniMax H3 Max.
- Every brief fixes `outputCount: 1` and an executable priced resolution:
  Gemini `1080p`, Kling Standard `720p`, Kling Pro `1080p`, and H3 Max `768P`.
  Gemini explicitly enables native audio; Kling and H3 omit an audio boolean
  because their current runtime always generates audio. H3 explicitly uses
  `promptExpansionMode: "quality"`.
- A reusable brief-to-canonical-request projection preserves ordinary prompts
  but converts the reviewed Kling multishot into `prompt: ""` plus all three
  structured `multiPrompt` shots. It never sends the editorial summary and
  structured shots together.
- Human briefs require two independent safeguards: an explicit anonymous
  subject and face-hiding framing. The safety check has a broader bounded
  high-risk denylist, while exact SHA-256 hashes freeze all eight top-level
  prompts and the three sub-prompts for mandatory re-review after any edit.
- The Kling Standard baker is intentionally simple: one dough cord, one knot,
  one tray placement, one rapid lateral move, oven breath, and one tray snap.
  The multishot, glass atomizer, and observatory briefs include concise ambient
  audio direction and no dialogue.
- Canonical capability and paid-body projection now carry H3's existing
  `prompt_expansion_mode` schema as `promptExpansionMode`, including the
  reviewed `quality` value. No provider request was executed.

## Eight Concepts and Fixed Parameters

| Model | Concept | Request parameters |
| --- | --- | --- |
| Gemini Omni Flash | Anonymous night bicycle mechanic | `t2v`, 6s, 9:16, 1080p, audio, 1 output |
| Gemini Omni Flash | Sunrise meltwater through a salt valley | `t2v`, 8s, 16:9, 1080p, audio, 1 output |
| Kling 3 Turbo Standard | Anonymous baker makes one dough knot | `t2v`, 5s, 9:16, 720p, 1 output |
| Kling 3 Turbo Standard | Three-shot rainy parcel delivery | `t2v`, 9s, 16:9, 720p, 3 structured shots, 1 output |
| Kling 3 Turbo Pro | Unlabelled glass atomizer macro | `t2v`, 6s, 1:1, 1080p, 1 output |
| Kling 3 Turbo Pro | Blizzard observatory mechanism | `t2v`, 8s, 16:9, 1080p, 1 output |
| MiniMax H3 Max | Anonymous fabric dancer study | `t2v`, 8s, 9:16, 768P, quality expansion, 1 output |
| MiniMax H3 Max | Unbranded kinetic desk lamp | `t2v`, 7s, 1:1, 768P, quality expansion, 1 output |

## RED / GREEN

The review-round tests were changed before production/content implementation.
The first focused run had 10 tests: 4 passed and 6 failed as expected. It
demonstrated the missing H3 setting exposure/normalization, missing deterministic
brief fields, overly complex baker prompt, absent canonical projection helper,
and changed reviewed prompt hashes.

After implementation:

- Brief plus MCP parity suite: 10/10 passed.
- Exact brief command: 4/4 passed.
- P1 capability, pricing, request-body, privacy, and runtime contracts: 118/118
  passed.
- Full `pnpm test:validate`: 4,059/4,059 passed.
- Frontend lint, public-exposure lint, TypeScript, and `git diff --check` passed.

The local environment reports Node `v23.9.0` while the repository requests
Node `22.x`; all checks above completed successfully.

## Local Indicative Provider-Cost Estimate

This is a local provider-cost-only draft derived from the checked-in pricing
inputs and the fixed durations/resolutions. It is **not an exact quote**, wallet
reservation, customer debit, or authorization to generate.

| Model | Local calculation | Indicative cost |
| --- | --- | ---: |
| Gemini Omni Flash, 1080p | 14s × 8,688 tokens/s × $17.50/M tokens | $2.12856 |
| Kling 3 Turbo Standard, 720p | 14s × $0.112/s | $1.56800 |
| Kling 3 Turbo Pro, 1080p | 14s × $0.140/s | $1.96000 |
| MiniMax H3 Max, 768P | 15s × $0.080/s | $1.20000 |
| **Aggregate** | 57 generated seconds | **$6.85656** |

## Remaining Preconditions

Before requesting exact paid quotes or generating anything:

1. Deploy the reviewed canary/MCP build to the staging environment.
2. Configure the exact staging account and MCP OAuth client allowlists.
3. Fund the Kling provider path and verify the intended staging credentials.
4. Request fresh exact paid quotes for all eight immutable requests, present
   the aggregate maximum wallet debit, and obtain explicit confirmation for
   that aggregate. Earlier confirmations do not authorize this batch.

Only after those steps may Task 9 proceed to the sequential paid generation and
editorial-review phase. Until then the status remains **blocked before exact
quotes/generation**.
