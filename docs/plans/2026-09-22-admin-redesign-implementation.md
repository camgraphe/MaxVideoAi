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
- Baseline: 49 focused pricing/admin tests passed. Dependencies installed from frozen lockfile offline.
- Pricing implementation reference: .local/admin-redesign/pricing-reference.json (SHA-256 of 48 pricing owner files; actual count recorded by verifier). No live database export or mutation.

## Integration hold
Production is CLI revision 436a10063, ahead of main. Coordination task is reconciling it; no merge, push or deployment before synchronization. The local pricing reference is against main only.
