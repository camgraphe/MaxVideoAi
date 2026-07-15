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

## Localized Comparison Content

Enriched comparison editorial content is owned by `content/comparisons/<canonical-slug>.json`.
Each document contains one `slug` plus complete `en`, `fr`, and `es` projections. Keep those
locale projections structurally aligned and edit them together; do not add locale-specific
TypeScript maps, an English fallback, a generated registry, or direct JSON imports in routes.

Routes and metadata builders consume only:

```ts
getComparePageOverride(locale, canonicalSlug)
```

Comparisons without a content document intentionally use the generic renderer. New or edited
documents must pass `tests/comparison-content-contract.test.ts`, including identity, schema,
locale parity, link, path-safety, and output-tracing contracts.

## Refactor Checklist

Before moving code:

- run `npm run architecture:audit -- --min-lines 500` if you are choosing the next cleanup target
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

## Current Line Caps

Use tighter caps once a route has been split:

- server `page.tsx` wrappers: usually 30-120 lines depending on metadata and redirects
- client route wrappers: usually below 40 lines
- route views: usually below 250-450 lines
- focused section components: usually below 150-250 lines
- large helper modules: allowed when they are pure and covered by contract tests, but still split when responsibilities diverge
