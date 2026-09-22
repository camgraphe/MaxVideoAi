# Admin redesign implementation

Spec: `2026-09-22-admin-redesign-brief.md`, V2 screens. Base: origin/main 772eb4d8a. Worktree: codex/admin-redesign.

## Invariants
Pricing owners, policy, overrides, routing, cache and commercial mutation services remain unchanged. No production writes, deployment, migration or public media behavior changes without a separately verified rollout. Preserve auth and existing URLs.

## Work sequence
1. Compact light admin shell; five work areas, contextual navigation, Settings, external links. Preserve direct routes and commercial services.
2. Honest Today overview with Madrid day boundaries; compact users and transactions with accurate review signals and contextual detail.
3. Content workspace and destination-oriented playlist editing. Preserve order; add keyboard movement and cancel. Explicitly stage any new public automatic-feed behavior behind opt-in and dedicated tests.
4. Focused behavior/architecture tests, pricing reference comparison, lint/type checks, local browser and design QA.

## Progress
- Resumed at Adrien’s request; reconciled main 6e3f7fd57 merged into the isolated branch.
- The first implementation lot and regression fixes are implemented. Pricing owner parity expanded to 130 files against reconciled main.
- See `2026-09-22-admin-redesign-validation.md` for validation evidence, limits and remaining stages.

## Integration
The earlier production reconciliation hold is lifted. Follow AGENTS Production delivery and docs/deployment/github-vercel.md. This task has not merged or deployed the admin redesign.
