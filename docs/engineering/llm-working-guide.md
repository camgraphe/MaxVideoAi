# LLM Working Guide

This guide is for Codex and other AI coding agents working on MaxVideoAI.

## Start Here

Read these files before changing architecture or route structure:

- `AGENTS.md`
- `docs/engineering/project-structure.md`
- `docs/engineering/page-architecture.md`
- `docs/engineering/admin-routes.md` when touching admin pages
- `docs/engineering/refactor-roadmap.md`

Then run the large-file audit when choosing a cleanup target:

```bash
npm run architecture:audit -- --min-lines 500
```

Use JSON when another tool or agent needs to rank candidates:

```bash
npm run architecture:audit -- --json --min-lines 500
```

For a focused task, inspect the nearest route-local `AGENTS.md` if one exists.

## Working Rules

- Treat `frontend/app` route files as orchestration files.
- Keep route-only code in route-local `_components` and `_lib` folders.
- Promote code to `frontend/components`, `frontend/lib`, or `frontend/server` only when reuse or boundary clarity is real.
- Preserve public URLs, localized slugs, metadata, canonical URLs, hreflang, and JSON-LD behavior during SEO page refactors.
- Do not introduce Zustand, TanStack Query, Redux, or another state library as part of a cleanup unless the task explicitly targets client state architecture.
- The current server-data client cache is SWR. Prefer standardizing existing SWR hooks before considering a data-layer migration.

## Server And Client Boundaries

- Default to Server Components in App Router routes.
- Add `'use client'` only for hooks, browser APIs, event handlers, or client-only libraries.
- Never import database access, secrets, Node APIs, or admin-only helpers into client files.
- Put privileged or database-backed logic in `frontend/server` or route handlers.

## Refactor Order

For large pages, extract in this order:

1. Static copy, constants, and localization fallback maps.
2. Pure builders for metadata, schema, pricing, specs, and derived route data.
3. Self-contained sections into named components.
4. Client-only panels and browser storage helpers.
5. Shared components only after reuse is clear.

## Verification

Run focused checks after route or helper refactors:

```bash
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

For public marketing/model pages, also smoke-test representative localized routes:

```txt
/models/seedance-2-0
/fr/modeles/seedance-2-0
/es/modelos/seedance-2-0
```

Before merge or PR, run a full build when feasible:

```bash
npm --prefix frontend run build
```

## Current Architecture Notes

- The comparison detail route, jobs route, blog post route, examples route, admin users list, admin user detail, admin insights route, admin SEO routes, and billing route have route-local architecture contract tests.
- The workspace app now has many route-local hooks and shell modules, but `AppClient.tsx` is still a priority cleanup target because it owns a large prop surface.
- `BillingClient.tsx` and `LibraryPageClient.tsx` pass current contracts but remain good candidates for deeper controller/mutation splits.
- Before proposing a new architecture PR, run `npm run architecture:audit -- --min-lines 500` and use the roadmap to separate low-risk route splits from high-blast-radius provider/API work.
- Root-level browser screenshots and `.playwright-mcp/` files are local QA artifacts and should stay untracked.

## Workspace Boundaries

Keep these boundaries stable when continuing workspace cleanup:

- `frontend/app/(core)/(workspace)/app/AppClient.tsx` should remain the route-level orchestrator, not the owner of every prop transformation.
- `WorkspaceAppShell` owns route shell rendering.
- `WorkspaceRuntimeModals` owns shared modal wiring.
- `useWorkspaceEngineModeState` owns engine/mode orchestration.
- `useWorkspaceComposerState` owns prompt/input field state.
- `useWorkspaceWalletPreflight` owns wallet balance preflight.
- `useWorkspaceGenerationRunner` owns generation submission, accepted results, and polling.
- `useWorkspaceAssetLibrary`, `useWorkspaceReferenceAssets`, and `useWorkspaceKlingElementAssets` own their specific asset concerns.
