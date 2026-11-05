# Character Studio preview alignment — 2026-11-05

## Cause and scope

The preview served Character Studio commit `41c212087` correctly, but its branch
was based on main `390ac3e86` (November 3), missing 14 commits through
`0f9b45c6d` (November 5). Separately, the custom environment did not include
production's Milo public/server activation flags. The existing shared shell uses
`PROMPT_ASSISTANCE_PREVIEW` for both assistance and its current layout; merging
main alone would therefore leave the old layout visible.

Integrate main into `codex/character-studio-v2`; preserve both sides of the
migration documentation. No changes to the shared layout, assistant protocol,
pricing policy or production feature flags are needed to resolve this drift.
The complete migration filenames distinguish Character Studio 93/94 from Milo
93/94; neither already-applied migration is renamed.

## Preview isolation and recovery

- Git recovery ref: `codex/character-studio-v2-before-main-20261105` at `41c212087`.
- Vercel custom environment: `character-studio-test`, scoped to this branch.
- Neon target: `br-square-king-aenyqhsq` in `shy-flower-71253790`.
- Pre-update database copy: `br-sparkling-cell-aeq4etlz`
  (`character-studio-before-main-20261105`), child of the test branch, no compute.
- Test storage remains `maxvideoai-character-studio-test-20261104`.
- Read-only schema inspection found both Milo additions already present, including
  the validated 50,000-character reply constraint. No hosted DDL was necessary.
- Existing test content: 12 characters, 8 looks and 25 jobs.
- Provider credentials were already attached to the test environment. No secret
  value was copied or changed for this alignment.
- Stripe and outbound email remain disabled in this environment.

Sixteen public/server Milo and Studio configuration values are independently
scoped to the custom environment, with empty built-in target lists. They mirror
the existing production feature flags and approved assistance/media-analysis
policies; the existing prompt worker flag remains active. This includes live
assistance, reference perception, conversation actions/media/editing/exports/tasks,
and their worker activation. Public flags require a fresh build.

Preview workers have scoped request wake-ups; Vercel production cron is not a
preview scheduler. Lost wake-up recovery must be exercised explicitly on this
environment before qualifying long-running preview work.

## Validation evidence

- 220 focused tests passed: Character Studio/Recast persistence, account isolation,
  timing/pricing/payment, real excerpt encoding with test media, and Milo refund,
  reply storage, personal video history and revoked-session contracts. Test
  provider execution remains substituted; no new paid media was requested.
- TypeScript passed. Frontend lint: zero errors, seven existing warnings.
- Public exposure and staged whitespace checks passed.
- The production environment inventory is compared before/after using fingerprints
  without exposing secrets. The private QA records live under
  `.local/character-preview/main-sync-*`.

Remote build, authenticated read-path checks and GitHub Quality CI results must
be recorded after deployment. Local browser automation is unavailable in this
session; DOM/integration tests and HTTP evidence are not a visual browser review.

## Production gate

This work deploys only the branch preview. Do not merge or promote on the strength
of these focused checks alone. Before production: refresh main, qualify the latest
committed candidate, pass every selected Quality CI lane, inspect exact pending
production migrations, and run the Git/Vercel alignment checks required by
`docs/deployment/github-vercel.md`. Keep generated demo jobs/media and test wallets
in test; publish selected marketing assets through the separate media workflow.
