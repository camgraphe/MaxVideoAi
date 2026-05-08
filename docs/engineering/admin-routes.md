# Admin Route Architecture

This guide defines the preferred split for admin pages in MaxVideoAI.

## Target Shape

Admin route files should stay small and server/client boundaries should be obvious.

For server admin routes:

```tsx
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AdminFeaturePage(props: PageProps) {
  const params = await props.params;
  const data = await fetchAdminFeatureData(params);

  return <AdminFeatureView data={data} />;
}
```

For client admin routes:

```tsx
'use client';

export default function AdminFeaturePage() {
  const controller = useAdminFeatureController();

  return <AdminFeatureView {...controller} />;
}
```

## Route-Local Modules

Prefer route-local folders for admin feature code that is not shared:

```txt
frontend/app/(core)/admin/example/
  page.tsx
  _components/
    AdminExampleView.tsx
    AdminExampleTable.tsx
    AdminExampleInspector.tsx
  _hooks/
    useAdminExampleController.ts
  _lib/
    admin-example-data.ts
    admin-example-format.ts
    admin-example-metrics.ts
```

Use shared admin-system components for shell and surfaces:

- `AdminPageHeader`
- `AdminSection`
- `AdminSectionMeta`
- `AdminInspectorPanel`
- `AdminMetricGrid`
- `AdminDataTable`
- `AdminStatTable`
- `AdminNotice`
- `AdminEmptyState`

## What Belongs Where

Keep in `page.tsx`:

- route params
- auth/redirect/notFound gates
- server data fetch orchestration
- dynamic/runtime exports
- rendering the route view

Move out of `page.tsx`:

- metric builders
- table rendering
- status badges
- detail panels
- formatters
- filter normalization
- href builders
- support/action rails
- SWR or URL state hooks

## Detail Pages

For pages such as `admin/users/[userId]`, prefer these sections:

- identity/access section
- usage/spend section
- wallet/ledger section
- support actions inspector
- route-local format and metric helpers

Do not type detail components with `Awaited<ReturnType<typeof fetcher>>[...]` when the server module already exports named DTO types. Import named types with `import type`.

## Contract Tests

Every refactored admin route should have an architecture test that checks:

- route file line cap
- route imports its view/controller
- route still owns data fetch orchestration when server-rendered
- tables and badges are not in `page.tsx`
- helpers are exported from `_lib`
- major sections are exported from `_components`

Use existing tests as templates:

```txt
tests/admin-users-architecture.test.ts
tests/admin-user-detail-architecture.test.ts
tests/admin-video-seo-architecture.test.ts
tests/admin-seo-gsc-architecture.test.ts
```
