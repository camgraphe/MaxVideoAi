# Project Structure Guide

This guide explains where code should live in MaxVideoAI and how to decide when to create a new file.

## Goals

- Keep route files readable.
- Keep server logic out of client bundles.
- Keep feature code discoverable by domain.
- Make future refactors small and safe.

## Main Folders

| Path | Responsibility |
| --- | --- |
| `frontend/app` | Routes, layouts, route handlers, metadata, redirects, and page orchestration. |
| `frontend/components` | Shared React components. |
| `frontend/components/ui` | Small reusable UI primitives. |
| `frontend/components/admin-system` | Admin shell, surfaces, metrics, tables, and operational UI patterns. |
| `frontend/components/marketing` | Marketing sections, model surfaces, examples, comparison UI, SEO-oriented components. |
| `frontend/lib` | Pure helpers, route utilities, formatting, SEO builders, pricing helpers, browser-safe utilities. |
| `frontend/server` | Server-only data access, admin fetchers, database-backed workflows, privileged integrations. |
| `frontend/config` | Product/catalog configuration. |
| `frontend/hooks` | Reusable client hooks. |
| `frontend/i18n`, `frontend/messages` | Locale configuration and message dictionaries. |
| `docs` | Engineering and operating guides. |
| `neon/migrations` | Application database migrations. |
| `supabase` | Supabase Auth configuration only. |

## Route Files

Route files should compose the page. They should not become the only place where the feature exists.

Recommended shape:

```tsx
export async function generateMetadata() {
  // metadata only
}

export default async function Page(props: PageProps) {
  // params, auth, redirects, data assembly
  return <FeaturePage sections={sections} />;
}
```

Move large rendering blocks into route-local `_components` folders or shared component folders.

## Route-Local Files

Use route-local folders when code belongs to one route only:

```txt
frontend/app/(localized)/[locale]/(marketing)/models/[slug]/
  page.tsx
  model-jsonld.ts
  _components/
    ModelHero.tsx
    ModelPricing.tsx
    ModelSpecs.tsx
    ModelExamples.tsx
```

Use this when extracting code would not help any other route.

## Shared Files

Move code to shared locations only when reuse is real:

- shared marketing sections: `frontend/components/marketing`
- shared admin surfaces: `frontend/components/admin-system`
- shared low-level controls: `frontend/components/ui`
- shared pure logic: `frontend/lib`
- server-only data access: `frontend/server`

Avoid promoting a one-off helper into `frontend/lib` just because it is long.

## Naming Conventions

- `*.client.tsx`: browser-only component.
- `*.server.ts`: server-only helper when the boundary is not obvious from the folder.
- `route.ts`: Next.js route handler.
- `page.tsx`: route entry point only.
- `_components`: route-local React components.
- `_lib`: route-local pure helpers when the helpers are not shared.

## File Size Signals

These are not hard rules, but they are useful triggers:

- 0-250 lines: usually comfortable.
- 250-500 lines: still acceptable if responsibilities are focused.
- 500-1000 lines: consider extracting the next clear responsibility.
- 1000+ lines: plan a split before adding more behavior.

For client files, be stricter because everything in the module participates in the browser bundle boundary.

