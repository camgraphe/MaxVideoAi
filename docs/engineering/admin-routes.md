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
- `AdminPricingChangePreviewDialog`
- `AdminPricingHistory`

## Commercial Pricing Domains

Commercial administration has exactly three active route owners:

- `/admin/pricing` owns canonical engine pricing policy;
- `/admin/membership` owns membership thresholds and discounts;
- `/admin/billing-products` owns fixed products referenced by live billing consumers.

Do not add membership or product controls back to `/admin/pricing`. Do not add direct-save commercial routes. Each domain uses authorized inventory/history reads and a server-owned `preview → explicit confirmation → immediate apply` mutation protocol. Confirmation recomputes the preview fingerprint inside the transaction boundary before persistence.

The server rejects a stale preview fingerprint without persistence or cache invalidation. Every successful mutation and its immutable event commit in one transaction. Rollback is a new mutation: callbacks send only `targetId` and `eventId`, historical state is resolved server-side, and restoration enters the same fresh preview and confirmation flow. History is never updated or deleted.

Pricing proposals exclude settlement routing. `vendorAccountId` may appear only as read-only operational context; policy updates preserve its stored value and creates cannot set it. When the database is unavailable, public quote resolution may use versioned fallback policy, but commercial admin inventory must show the outage and every mutation must fail explicitly.

All three views share `AdminPricingHistory`. The old `/api/admin/membership-tiers` and `/api/admin/pricing/rules` endpoints are intentionally absent and must not be recreated as compatibility shims. The detailed operating procedure and verification commands live in `docs/engineering/pricing-engine.md` under **Safe price-change runbook**.

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

## MCP Acquisition Measurements

`/admin/mcp` loads operational audit metrics and account/video outcomes independently.
`frontend/server/admin-mcp-outcomes.ts` and `admin-mcp-outcomes-queries.ts` own the latter;
the route-local `McpGenerationOverview` renders them ahead of tool-call activity.

- MCP accounts are distinct authenticated accounts observed in the audit or quote ledger
  before the reporting end. This is cumulative usage, not installation or signup attribution.
- New signups using MCP match those accounts to synchronized `profiles.created_at` within
  the UTC window. A bounded server-only Auth lookup fills missing/unsynchronized profiles
  in memory; unresolved dates make this measure unavailable. It does
  not prove MCP caused the signup, and signups that never use MCP are outside this cohort.
- Video jobs are scoped by `app_jobs.created_at` in UTC `[from, to)`, joined to a canonical
  MCP quote on both job and user ownership, and restricted to `surface = 'video'`. Current
  completed status counts as a generated video job; failed/cancelled and pending jobs are
  shown separately. Quote retries, polling, images and unrelated website jobs do not count.
- Global users are deduplicated across applications. Application rows may overlap for users,
  while each video job has one application. Account application uses the latest observed
  activity for its user/OAuth-client pair; video attribution uses evidence at submission time.
- Migration 41 and the existing audit bootstrap add nullable `client_family`. Successful MCP
  initialization stores only a normalized family from self-reported `clientInfo.name`; raw
  metadata is discarded. This field is analytics only and must never authorize access.
  Recorded connection-link attribution is the fallback for the same user/OAuth-client pair.
  A bounded server-only lookup of current registered OAuth client names supplies an
  indicative historical fallback when event-time evidence is missing.
  Null client IDs and missing evidence remain unidentified; later observations never relabel
  an earlier video through event-time evidence; the current OAuth registry fallback is
  explicitly labeled as indicative. Old schemas continue to serve outcomes using the
  available attribution.

The commercial funnel capability flags must not be flipped merely because tables exist.
Paid preparation/acceptance/completion funnel events are not yet fully produced, so the
legacy conversion, receipt-attribution and provider-cost panels retain their unavailable
states. The public `trial` flag controls a separate free-trial rollout, not analytics; this
change does not enable that offer. The new outcomes read the existing quote/job producers
and work while the commercial funnel is disabled.

Validation: `tests/admin-mcp-metrics-postgres.test.ts` exercises real PostgreSQL outcomes,
window boundaries, multiple clients, ownership, missing profiles and legacy schemas;
`tests/admin-mcp-outcomes.test.ts` covers failure handling and client-family normalization.

Auth metadata fallbacks use the existing Supabase admin client in
`frontend/server/admin-mcp-auth-metadata.ts`: at most 100 requested identities per page,
four concurrent reads, only missing dates and unidentified applications. No synchronization
writes occur; raw names, account records and credentials never enter the page DTO.
The outcome query returns bounded internal ID arrays solely for this server-side lookup.
See the [Auth account lookup](https://supabase.com/docs/reference/javascript/auth-admin-getuserbyid)
and [OAuth client lookup](https://supabase.com/docs/reference/javascript/oauth-admin-getclient) contracts.
