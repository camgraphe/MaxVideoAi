# Production Git alignment audit — 2026-09-22

## Finding and scope

Per the owner's request, this audit covers **only the last 15 days**, from
**2026-09-07 17:01 UTC** through **2026-09-22 17:01 UTC**.
The inspected production-target records in that window comprise **58 deployments**:
**53 Git records and 5 CLI records**. Older history is excluded from
this report and from any recovery work. Sanitized CLI evidence is in
`production-git-audit-2026-09-22.json`. All recorded Git revisions in this window
are ancestors of GitHub main at the audit checkpoint,
`772eb4d8a4744e2bd829324ce929c0fab2cf7875`.

Production website and API currently point to CLI deployment
`dpl_5ucWc1py4Lt3bTnVhqJwNjKwbAiF`, created 2026-09-22 15:19 UTC.
It has no Vercel Git commit provenance. Its recovered source is local commit
`436a10063baac14bb80f3fd22423113360715df9`, parent `772eb4d8…`, on
`codex/multimodal-reference-production-20260922`. That branch had not been pushed
and had no PR when inspected. Releasing old main would remove this deployed delta:
120 files, including Wan/MiniMax multimodal references and pricing projections.

The originating task's final `release-source.json`, deployment log and isolated
source directory map the successful deployment to this snapshot. All 120 changed
files match both the final SHA-256 manifest and snapshot commit, with zero
mismatches. The earlier copy-time manifest predates six final source updates and
must not be used as the final release manifest. Existing MCP 0.3.6 and MCP admin
metrics files in this snapshot match main. Shared Desktop changes were not imported.

## Other records within the 15-day window

- **2026-09-17 / 2026-09-09:** the two earlier READY CLI records are redeploys of
  existing GitHub-main deployments, linked to their original deployment IDs.
  Their revisions are present in main. They are not unpublished source uploads.
- **2026-09-21:** the unmerged auth recovery branch upload was BLOCKED and had no
  alias assignment. **2026-09-22 15:18 UTC:** the first multimodal upload failed its
  build and had no alias assignment. Neither is the current public deployment.
- No other successful unpublished-source upload was identified in this window.
  Deployment metadata does not by itself establish byte-level parity or reconstruct
  every historical domain assignment. No older deployment is restored or repaired.

## Recovery and prevention

The recovery branch `codex/production-git-alignment-20260922` starts from the exact
successful production snapshot, preserving its full delta for a normal GitHub PR
and Quality CI. This one-time reconciliation intentionally starts while the live
alignment check reports missing provenance; it does not authorize overwriting
production with old main or bypassing future checks. Final merge/deployment IDs
are reported in the task/PR after validation, without a second documentation-only
production rollout.

The active task “Planifier la refonte de ladmin” confirmed isolated work on
`codex/admin-redesign` from old main and no prepared or performed push, PR, merge,
deployment or domain change. Its release actions are held until it integrates the
reconciled main. No modifications are made to its worktree or pricing baseline.

The dated root AGENTS policy and `docs/deployment/github-vercel.md` define the GitHub
PR → Quality CI → main → Vercel path. A production prebuild guard rejects missing
Git provenance; `pnpm deployment:check` verifies both live domains and candidate
ancestry before release and checks domain alignment afterward. These prevent the
observed accidental path, but do not replace Vercel access control or prove historic
byte-level parity. No credentials, permissions, billing data or production domain
settings are changed by the guards or this audit.
