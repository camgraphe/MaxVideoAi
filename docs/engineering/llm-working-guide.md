# LLM Working Guide

This guide is for Codex and other AI coding agents working on MaxVideoAI.

## Start Here

Read these files before changing architecture or route structure:

- `AGENTS.md`
- `docs/engineering/project-structure.md`
- `docs/engineering/page-architecture.md`
- `docs/engineering/refactor-roadmap.md`

Then run the large-file audit when choosing a cleanup target:

```bash
npm run architecture:audit -- --min-lines 900
```

Use JSON when another tool or agent needs to rank candidates:

```bash
npm run architecture:audit -- --json --min-lines 900
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

- The comparison detail route, admin insights route, and billing route have route-local architecture contract tests.
- The model detail route has route-local `_components` and `_lib`, but supporting files such as `model-page-specs.ts` can still be large.
- The dashboard route has route-local panels and helpers, but workspace app/image/audio routes and tool workspaces remain major cleanup candidates.
- Before proposing a new architecture PR, run `npm run architecture:audit -- --min-lines 900` and use the roadmap to separate low-risk route splits from high-blast-radius provider/API work.
- Root-level browser screenshots and `.playwright-mcp/` files are local QA artifacts and should stay untracked.
