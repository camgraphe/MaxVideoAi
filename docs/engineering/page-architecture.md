# Page Architecture Guide

This guide defines the target architecture for large Next.js pages in MaxVideoAI.

## Target Responsibility Split

A page should answer four questions:

1. Who can view this route?
2. Which canonical route/data does it represent?
3. Which data does the route need?
4. Which sections make up the rendered page?

Everything else should usually live outside `page.tsx`.

## Server Page Pattern

Use this for marketing, SEO, model, comparison, docs, examples, legal, and admin server pages.

```tsx
export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  return buildFeatureMetadata(params);
}

export default async function Page(props: PageProps) {
  const params = await props.params;
  const model = await resolveFeaturePageData(params);

  if (!model) {
    notFound();
  }

  return <FeaturePageShell model={model} />;
}
```

Move these out of `page.tsx` when they grow:

- JSON-LD builders
- SEO title/description mapping
- pricing/spec calculations
- localized label maps
- repeated JSX sections
- example/gallery transformation
- comparison/scoring helpers

## Client Page Pattern

Use this for dashboard, workspace, app, billing, login, settings, and library pages.

Prefer:

```tsx
export default function DashboardPage() {
  const dashboard = useDashboardPage();

  return (
    <DashboardShell>
      <CreateHero {...dashboard.createHero} />
      <InProgressPanel {...dashboard.inProgress} />
      <RecentGrid {...dashboard.recent} />
    </DashboardShell>
  );
}
```

Extract client pages in this order:

1. constants and copy defaults
2. browser storage helpers
3. data/state hooks
4. self-contained panels/cards
5. heavy optional UI with `next/dynamic`

## Data Builder Pattern

When a route has many derived props, create a builder:

```txt
_lib/
  build-model-page-data.ts
```

The builder should return plain data. It should not return JSX.

This makes the route easier to inspect and makes unit testing possible.

## Section Component Pattern

Large JSX blocks should become named components with narrow props:

```tsx
export function ModelPricingSection({ pricing, labels }: ModelPricingSectionProps) {
  return <section>{/* rendering only */}</section>;
}
```

Avoid passing the entire dictionary or entire engine object unless the section truly needs it.

## JSON-LD Pattern

Build schema payloads in pure helpers, then render them at the route/shell level:

```tsx
const schemas = buildModelSchemas(modelPageData);

return schemas.map((schema, index) => (
  <script
    key={index}
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
  />
));
```

Keep serialization centralized to avoid inconsistent escaping.

## Refactor Checklist

Before moving code:

- identify behavior that must not change
- find route params, redirects, and metadata coupling
- check whether the file is server or client
- check whether imported modules are safe for the target boundary
- move one responsibility at a time

After moving code:

- run TypeScript/lint checks
- smoke-test the route
- compare important generated metadata/JSON-LD if the route is public
- confirm localized paths still resolve

