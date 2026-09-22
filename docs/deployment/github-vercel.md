# GitHub and Vercel production delivery

Created/reviewed: 2026-09-22. Owner: application engineering.

## Source of truth

The production Vercel project is `maxvideoai` (`prj_CA8KpDAwYzihVJZyDNnEUrDszaMu`),
team `camgraphes-projects`, root `frontend`, connected to GitHub
`camgraphe/MaxVideoAi`, production branch `main`. Both `maxvideoai.com` and
`api.maxvideoai.com` must serve the same validated deployment.
`.github/workflows/quality.yml` owns Quality CI. There is no parallel CLI upload
workflow for normal production releases.

## Release sequence

1. Use a clean isolated worktree. Preserve the shared Desktop checkout and other
   tasks' uncommitted work. Fetch `origin/main` and incorporate it into the candidate.
2. Run focused validation, open a GitHub PR and wait for Quality CI to pass.
3. Immediately before merging, run `git fetch origin main` and
   `pnpm deployment:check` from the committed candidate. This read-only remote
   check uses the authenticated Vercel CLI and GitHub remote; it never deploys,
   changes domains, pulls environment secrets or changes repository files.
   It requires both live domains to share a READY GitHub-main deployment, that
   deployed revision to be present in main, and the candidate to include current
   main. Missing Git history, authentication or provenance fails closed.
4. If production contains unpublished source, stop concurrent release actions,
   recover its exact source in an isolated branch, record evidence and reconcile
   through a validated PR. Do not overwrite it with an older main deployment.
5. Merge only after checks pass. Let the Vercel Git integration build main.
   Recheck production immediately before merge if another task has released.
6. After READY, run `pnpm deployment:check` from the freshly fetched main commit.
   Verify that both returned SHAs equal that merged commit (the premerge check
   allows production to be an ancestor while a newer build is pending). Smoke-test
   the affected routes and inspect runtime errors. Record the PR, merge SHA and
   deployment ID in the task result.

The command does not lock other releases; tasks must coordinate the final merge
and domain checks. Never merge another branch while production reconciliation is
pending. Rebase/merge onto the confirmed new main before resuming that branch.

## Build guard and limits

`frontend` prebuild calls `scripts/check-production-git.mjs` after the existing
registry gate. Production builds require the known production project, GitHub
repository, main branch and a full commit SHA in Vercel's system environment.
This rejects copied local uploads that lack Git provenance. Local and preview
builds remain available. Only the exact separate MCP staging project
`prj_OsS8N2tQBAvjxnPO2rGDWbLJeReJ` uses the existing staging policy and
`scripts/deploy-mcp-staging-vercel.sh`; a project name or arbitrary staging flag
cannot exempt the public production project.

Keep Vercel's automatic system-variable exposure enabled. Do not add an environment
bypass switch. This is an accident-prevention check, not an access-control boundary:
metadata can be supplied manually, a privileged operator can remove the guard,
and prebuilt artifacts or alias changes can avoid a new build. Repository rules,
the live premerge check and cross-task coordination therefore remain necessary.
Stronger enforcement requires separately approved Vercel roles/permissions; this
change does not modify account access or credentials.

## Exceptions and recovery

A generic instruction such as “deploy” uses the GitHub path. Direct production
uploads, `--prebuilt`, promotions, rollbacks and manual aliases require an explicit
exception identifying the action and immutable, published GitHub source, validation
and rollback target. Never publish a dirty working tree or untracked files.
Prefer redeploying the exact existing Git-backed deployment when Vercel infrastructure
fails. Such a redeploy can report `source=cli` while retaining its original Git
provenance; it differs from uploading local source. Record that distinction.

The 2026-09-22 reconciliation is documented in
`docs/operations/production-git-audit-2026-09-22.md`. Its known premerge mismatch
must be resolved by preserving the deployed snapshot, not by disabling the guard.
No recurring exception or bypass is created by this recovery.

## References

- [Vercel Git integration](https://vercel.com/docs/git)
- [System environment variables](https://vercel.com/docs/environment-variables/system-environment-variables)
- [Deployment CLI](https://vercel.com/docs/cli/deploy)
- [Roles and production deployment access](https://vercel.com/docs/rbac/access-roles)
