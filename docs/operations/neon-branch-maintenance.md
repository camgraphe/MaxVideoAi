# Neon branch maintenance

`scripts/neon-branch-guard.mjs` reports the production Neon project branch count. The daily GitHub workflow uses `--delete-merged` to remove completed Vercel previews after a 24-hour grace period.

## Required credentials

- GitHub Actions secret `NEON_API_KEY`: use an organization API key restricted to project `shy-flower-71253790`.
- The workflow's own `GITHUB_TOKEN`: `contents: read` and `pull-requests: read` suffice. It verifies the current Git ref and all matching PR pages.

Never log either token. A Vercel environment variable marked sensitive cannot be exported for reuse; provision a dedicated project-scoped Neon key instead. Do not store a personal Neon OAuth access token in Actions, because it expires.

## Deletion policy

A branch must be created by Vercel, named `preview/codex/*`, and be a direct child of the default branch. Primary, default, protected, staging, backup and parent branches are preserved. Computes must be suspended and their last activity must be at least 24 hours old.

Deletion also requires a PR merged into `main` at least 24 hours ago, no currently open PR for that Git branch, and no later Git commits. A Neon branch created after the matching merge is preserved, so reused branch names are not mistaken for finished work. Deleted Git refs still require the matching merged PR. Missing or invalid API data stops cleanup. Branch inventory, computes and GitHub evidence are checked again before each deletion.

`--delete-archived` applies the same checks but only to archived branches. `--delete-pattern` can further restrict candidates; it cannot expand eligibility beyond the policy. `--dry-run` logs the count without deleting. The check-only mode needs only the Neon credential.

```bash
npm run neon:branches:check
node scripts/neon-branch-guard.mjs --delete-merged --dry-run
```

The guard limit of 8 is an operational threshold, separate from Neon's billing allowance. Launch includes 10 branches per project and Scale includes 25. The infra-cost report preserves metered historical branch-hours and projects future excess with `max(project branch count - included allowance, 0)` for each project independently. Branch state does not indicate whether compute is active.

Verified pricing: https://neon.com/pricing (5 September 2026). The API branch list uses `pagination.next` as the next request's opaque `cursor`.

## Staging

Keep `preview/mcp-staging` separate from completed PR previews. Polling schedules can keep its compute active when they run at the five-minute suspension interval. Before pausing staging crons, confirm that no tests or nonterminal jobs depend on them. Preserve the production project and staging database. Record any pause and the resumption procedure in the operational audit.
