# MaxVideoAI Engineering Guide

This file is the first reference for Codex, AI agents, and contributors working in this repository.

## Product Shape

MaxVideoAI is a production Next.js application for AI video generation, model comparison, examples, pricing, billing, media library, and admin operations.

The frontend lives in `frontend/`. Most product work should happen there.

## High-Level Layout

- `frontend/app`: Next.js App Router routes, route handlers, layouts, metadata, redirects, and route-level orchestration.
- `frontend/components`: Shared React components. Put reusable UI here when it is used by more than one route or feature.
- `frontend/components/ui`: Low-level reusable UI primitives.
- `frontend/lib`: Pure application logic, formatting, route helpers, SEO helpers, pricing helpers, and browser-safe utilities.
- `frontend/server`: Server-only data access and backend orchestration.
- `frontend/config`: Product catalog and configuration data.
- `frontend/content`, `frontend/messages`, `content`: Localized content and documentation surfaces.
- `docs`: Human-facing engineering, deployment, SEO, pricing, licensing, and operating guides.
- `neon/migrations`: Application database migrations. Do not put application database migrations in Supabase.
- `supabase`: Supabase Auth configuration only.

## Page File Rule

Keep `page.tsx` files as route orchestrators.

A healthy `page.tsx` should usually:

- export `generateMetadata` and `generateStaticParams` when needed
- read route params and search params
- authorize, redirect, or call `notFound`
- fetch or compose route-level data
- render named sections/components

A `page.tsx` should avoid becoming the owner of:

- large JSX sections
- pricing algorithms
- SEO schema builders
- localization mapping tables
- browser storage helpers
- dashboards with many client-side panels
- chart/table rendering components

When a `page.tsx` grows past roughly 500 lines, prefer extracting the next meaningful responsibility before adding more code.

## Component Placement

Prefer colocated route components when the component is only used by one route:

```txt
frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/
```

Prefer shared component folders when the component is reusable:

```txt
frontend/components/marketing/
frontend/components/admin-system/
frontend/components/library/
frontend/components/ui/
```

Use `*.client.tsx` for components that require browser APIs, event handlers, local state, effects, or client-only libraries.

## Server and Client Boundaries

Default to Server Components in `frontend/app`.

Add `'use client'` only when the file needs:

- `useState`, `useEffect`, `useMemo`, `useCallback`, or other client hooks
- browser APIs like `window`, `localStorage`, `sessionStorage`, `File`, or `URL.createObjectURL`
- user interaction handlers
- client-only dependencies

Do not import server-only modules into client files. Anything using database access, secrets, `node:fs`, `node:path`, or admin checks belongs in server-side modules or route handlers.

## Refactor Style

Refactor incrementally:

- keep behavior unchanged unless the task explicitly asks for a behavior change
- move pure functions before moving JSX
- preserve existing public URLs, metadata behavior, and localization output
- avoid global rewrites that touch unrelated features
- keep user changes in the worktree intact

For large files, split by responsibility rather than by technical layer:

- data builders
- schema/metadata builders
- pricing/spec helpers
- route sections
- client-only interactions
- tables/charts/panels

## Workspace App Boundaries

For the authenticated workspace route, keep `frontend/app/(core)/(workspace)/app/AppClient.tsx` as the route-level orchestrator.

- Keep route shell rendering in `_components/WorkspaceAppShell.tsx`; `AppClient.tsx` should not compose `WorkspaceChrome`, `GalleryRail`, the center gallery, or the preview dock inline.
- Keep notice timers, onboarding route redirects, and preview/viewer composition in route-local hooks under `_hooks/`.
- Keep composer engine/mode orchestration in `_hooks/useWorkspaceEngineModeState.ts`; `useWorkspaceComposerState.ts` should focus on composer input field state and field handlers.
- Keep wallet balance preflight in `_hooks/useWorkspaceWalletPreflight.ts`; `useWorkspaceGenerationRunner.ts` should focus on generation submission, local render state, accepted results, and polling.
- Keep composer JSX in `_components/WorkspaceComposerSurface.tsx` and shared modal wiring in `_components/WorkspaceRuntimeModals.tsx`.
- Add or update contract tests in `tests/workspace-*-contract.test.ts` when moving workspace responsibilities, so the architecture stays explicit.

## Verification

Use focused checks first:

```bash
npm --prefix frontend run lint
npm run lint:exposure
```

For route refactors, also run the relevant app locally and smoke-test the touched pages.

For public/SEO pages, verify:

- canonical URL
- hreflang output
- JSON-LD script output
- localized path behavior
- redirect behavior
- sitemap inclusion assumptions

For client app pages, verify:

- auth flow still works
- browser storage reads/writes still work
- loading and empty states still render
- dynamic imports still open on demand
- no obvious extra re-render loops

## Documentation

When adding a new feature area, add or update the relevant guide in `docs/engineering/` if future work would otherwise require rediscovering the architecture.
