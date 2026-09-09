# Toolbox consolidation handoff

> Historical checkpoint. Its activation restrictions were superseded by the owner-approved production pilot recorded on 8 September 2026 in `frontend/src/server/tools/finishing-release.ts` and `docs/engineering/toolbox-integration.md`.

The user asked to retain only the principal app task and Studio. This task stops after preserving the selected-tool increment; no new qualification or feature work is authorized by this checkpoint.

## Recovery

- Branch: `codex/connected-toolbox`; implementation commit **b6ea6b36a**, based on **0daf78d1a**.
- Worktree: `/Users/adrienmillot/.codex/worktrees/8710/MaxVideoAi V2`.
- Main already imported earlier Toolbox work including `0daf78d1a` as `dd70c1e33`, and `c1c2d97ae` as `bbdf61de8`. Recover the new implementation commit and this documentation checkpoint only.
- Working files are all committed. No reset/discard, push, remote DB write, deployment or paid generation. No subagents. Dedicated preview on port 3036 stopped; final tests and build finished successfully.
- Temporary isolated build worktree `/tmp/maxvideoai-toolbox-finishing-build-20260908` remains for evidence; do not mistake its old base HEAD for the source implementation.

## Delivered

Four P0 forms and catalogue tiles: Restore Video, Denoise, Fix Blur, Smooth Motion. Standard by default; Pro candidate for Restore/Denoise/Motion, no Pro for Fix Blur. Shared import/library, quote, result comparison/save/download/reuse, FR/EN/ES and small screens. Candidate providers are server-only. The `tool` job surface is additive; exact source/result references persist, creator feeds exclude these jobs, generic status reads preserve tool originals.

Services cover authenticated owned-source resolution, measured metadata, strict settings/limits, canonical pricing, atomic wallet/job reservation, provider submission, stored request-ID polling, single finalization claim, immutable output/poster storage and exact refunds. The same-session pending job survives a reload. Missing cadence is rejected instead of silently using 30fps, and output audio presence/cadence/duration/dimensions are checked.

Validation: **4,503 tests passed**, final typecheck/lint/exposure/diff checks passed, isolated production build passed. See `2026-09-08-toolbox-validation.md` for commands and proof limits.

## Remaining user work and release dependencies

1. Integrate and review `b6ea6b36a` in the principal task, including shared media/surface/pricing files. Reconcile with Studio media contract **4c986b84e**, received but not cherry-picked here; Studio/MCP new execution remains disabled.
2. All seven provider profiles are unqualified candidates. `FINISHING_QUALIFICATIONS` is empty and server execution cannot charge/submit. Compare owned corpus, validate quality minimum and useful Pro improvement, preserve content/audio/temporal behavior and reconcile invoices before activation. Denoise Nyx Fast is only a candidate for Standard; promote Nyx if needed and omit Pro if no gain. Restore Pro reconstruction is disclosed.
3. Topaz example-block pricing is a conservative budget, not an exact invoice formula. Replace or substantiate it through reconciliation before release. The proposed 42-run qualification estimate is documented in `2026-09-08-toolbox-finishing-tools.md`; **no paid test is authorized**.
4. Migration **42_toolbox_finishing_pricing.sql** inserts only the new engine policy at the selected ×2.5 target and preserves an existing rule. It was applied only to disposable PostgreSQL. Confirm numbering and separately authorize remote rollout. Missing explicit DB policy is refused, because generic DB rules otherwise override versioned engine defaults.
5. No background sweeper/new webhook or cross-device history reopening in this increment. Leaving the page defers finalization/refund until another status read; an interrupted submission without a durable request ID is refunded on a status read after 15 minutes. Agree orphan reconciliation/history behavior before public activation. Runtime audio-presence checks do not prove audio fidelity.
6. Smart Reframe, Subtitles, Clean Audio, Remove Object and Extend Clip remain later research priorities, not implemented by this first P0 group.

Do not describe the four new cards as commercially active or provider-qualified. The UI explicitly says “In validation”.
