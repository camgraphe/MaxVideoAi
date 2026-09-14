# Task 15 n8n guideline compliance report

Date: 2026-09-14

## Result

The three credential-free n8n workflow candidates now each contain exactly one
yellow-default, non-connected `n8n-nodes-base.stickyNote`. Every note explains
the intended user and outcome, executable flow, self-hosted n8n and MaxVideoAI
MCP OAuth setup, relevant approval and recovery boundary, and the unsupported
n8n Cloud and MCP Client Tool scope.

Removing the Sticky Note from each revised JSON document produces a JSON object
identical to its `HEAD` version. No executable node, connection, setting,
credential boundary, activation state, tag, or workflow title changed.

## TDD evidence

RED:

```text
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-n8n-workflows.test.ts
not ok 1 - each n8n candidate includes one isolated submission-guideline note with complete setup guidance
brief-to-approved-generation.json: expected exactly one Sticky Note
0 !== 1
6 passed, 1 failed
```

The failure was the intended missing-feature failure; all pre-existing workflow
tests stayed green.

GREEN after adding the three documentation nodes:

```text
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-n8n-workflows.test.ts
7 passed, 0 failed
```

The test checks real exported workflow behavior: exactly one note, unique node
identity, readable geometry and position, substantive per-workflow guidance,
and absence from both sides of every graph connection.

## Revised SHA-256 digests

| Candidate | SHA-256 |
| --- | --- |
| `distribution/n8n/brief-to-approved-generation.json` | `c21b22387336292a3348ca10b65772143c67313ce7330eb0a433920f4024959f` |
| `distribution/n8n/campaign-queue.json` | `7e536cdf3f6599ee01c85424d153db86e8b9874a2978542f49b72df83f7bf650` |
| `distribution/n8n/completion-notification.json` | `845f2210ec5eda6d6d691ec4a76ec556cf4eeafcacff1282198f57b637e35bf8` |

The exact-hash test derives each digest from the current file bytes and matches
these values in `docs/marketing/mcp-directory-submissions.md`.

## Validation

- Focused n8n, exact-hash, registry, publication, and immutable public-baseline
  suite: 26 passed, 0 failed.
- All three JSON documents parse with `jq empty`.
- Executable projection comparison against `HEAD`: unchanged for all three
  candidates after removing the added Sticky Note.
- Frontend ESLint: passed.
- Public exposure lint: passed.
- Frontend TypeScript (`tsc --noEmit`): passed.
- `git diff --check`: passed.
- Repository-local n8n import validator: none found, so no such command was run.

## Self-review and concerns

The notes use the n8n Sticky Note node's default yellow presentation and remain
outside `connections`. Their prose does not add credentials, fixed prices,
model rosters, n8n Cloud claims, MCP Client Tool claims, or a second paid
confirmation path. The existing live self-hosted deterministic scope and all
recorded limitations remain unchanged.

No browser, login, upload, external submission, OAuth call, credential use,
generation, deployment, push, or external mutation occurred. The controller's
existing rollout-plan edit was preserved and excluded from this task commit.

Commit: recorded in the controller handoff because a Git commit cannot embed
its own final hash in a tracked file.
