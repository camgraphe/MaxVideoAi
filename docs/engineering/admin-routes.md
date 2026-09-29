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

Commercial services retain three domain owners; their UI exposure differs:

- `/admin/pricing` is an authenticated cockpit with comparison, customer-price, pricing-rule and history tabs. The comparison and customer-price views include all 48 app-published models in 15 registry families, including app-sellable models hidden from public Pricing. The customer-price tab reads one live canonical quote per displayed scenario, lets an admin navigate supported exact mode/resolution/duration/media options, and separates supplier list evidence from the customer total. Its editor supports staged `preview → confirm`, history, delete and rollback when migration 54 is available. Manual tariffs remain inactive, and a missing database disables writes. The separate pricing-rule editor still changes the current margin rules. `/admin/engines` shows read-only model activity;
- `/admin/membership` owns read-only historical membership thresholds, discounts, and audit events;
- `/admin/billing-products` owns fixed products referenced by live billing consumers.

Do not add membership or product controls back to `/admin/pricing`. Do not add direct-save commercial routes. Pricing and billing products use authorized inventory/history reads and a server-owned `preview → explicit confirmation → immediate apply` mutation protocol. Confirmation recomputes the preview fingerprint inside the transaction boundary before persistence. Membership is retired for mutation: inventory/history remain readable and preview, confirmation, and rollback fail with `410 membership_retired`.

The server rejects a stale preview fingerprint without persistence or cache invalidation. Every successful mutation and its immutable event commit in one transaction. Rollback is a new mutation: callbacks send only `targetId` and `eventId`, historical state is resolved server-side, and restoration enters the same fresh preview and confirmation flow. History is never updated or deleted.

The customer-tariff service lives in `frontend/server/pricing-admin/customer-tariff-service.ts`; its API routes under `/api/admin/pricing/tariffs/` require `requireAdmin` before reading inventory, scenarios, preview, confirmation or history. The scenario endpoint returns only the selected model's valid cascading options and exact current quote. An inactive cell edit increments the tariff revision and writes an immutable pricing event in one transaction. Migration 55 adds immutable closed cell versions: an active edit uses a server-owned effective instant, preserves the stable selector/currency, appends the previous version and increments the revision atomically. Rollback creates another version. Active deletion is forbidden. Confirmation revalidates public Pricing, model, home, examples and watch pages; refresh failure is reported after commit. Active-edit behavior is tested only on disposable local databases; global activation remains off pending complete coverage, revision binding and settlement provenance.

Pricing proposals exclude settlement routing. `vendorAccountId` may appear only as read-only operational context; policy updates preserve its stored value and creates cannot set it. When the database is unavailable, public quote resolution may use versioned fallback policy, but commercial admin inventory must show the outage and every mutation must fail explicitly.

The retained commercial views share `AdminPricingHistory`; the membership view locks rollback controls. The pricing cockpit is linked from Settings navigation. The old `/api/admin/membership-tiers` and `/api/admin/pricing/rules` endpoints are intentionally absent and must not be recreated as compatibility shims. The detailed operating procedure and verification commands live in `docs/engineering/pricing-engine.md` under **Safe price-change runbook**.

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
tests/admin-retired-gsc-contract.test.ts
```

## MCP Acquisition Measurements

`/admin/mcp` loads operational audit metrics and account/generation outcomes independently.
`frontend/server/admin-mcp-outcomes.ts` and `admin-mcp-outcomes-queries.ts` own the latter;
the route-local `McpGenerationOverview` leads with eight cards: completed videos, completed
images, tool calls, active tool users, MCP accounts, MCP signups and the two creator counts.
Tool-call totals include status polling calls and are separate from generation counts; the
lower activity sections retain the detailed tool, success and failure breakdowns.

- MCP accounts are distinct authenticated accounts observed in the audit or quote ledger
  before the reporting end. This is cumulative usage, not installation or signup attribution.
- New signups using MCP match those accounts to synchronized `profiles.created_at` within
  the UTC window. A bounded server-only Auth lookup fills missing/unsynchronized profiles
  in memory; unresolved dates make this measure unavailable. It does
  not prove MCP caused the signup, and signups that never use MCP are outside this cohort.
- Video outcome totals are scoped by `app_jobs.created_at` in UTC `[from, to)`, joined to a
  canonical MCP quote on both job and user ownership, and restricted to `surface = 'video'`.
  Current completed status counts as a generated video job; failed/cancelled and pending jobs
  are shown separately. Image outcome totals use the same contract with `surface = 'image'`.
  Quote retries are deduplicated by job, while polling, quote-only rows and unrelated website
  jobs do not count.
- `McpGenerationOverview` also renders a bounded recent generation feed (maximum 30 jobs) from
  both surfaces. Each row exposes only job ID, image/video surface, public engine ID/label,
  current status, UTC creation time and coarse application attribution; its job link targets
  `/admin/jobs?jobId=...`. Prompts, signed/private media URLs and payment details stay out of
  this DTO. The feed uses the same UTC half-open window and quote/job ownership join, and
  deduplicates quote retries by job before attribution.
- Global users are deduplicated across applications. Application rows may overlap for users,
  while each deduplicated video or image job has one application. Account application uses the
  latest observed activity for its user/OAuth-client pair; generation attribution uses evidence
  at submission time.
- Migration 41 and the audit bootstrap add nullable `client_family`; migration 42 widens its
  database constraint for the complete ecosystem. Successful MCP initialization stores only
  a normalized family from self-reported
  `clientInfo.name`; raw metadata is discarded. The admin application breakdown covers the
  nine integration-registry families, the separate Glama MCP-client family, and
  `Other / unidentified`. Glama is an analytics label for a client identifying itself
  as Glama, not a first-party host integration or proof that a directory listing
  sent the user. Ambiguous names stay unidentified. This field must never authorize access.
  Recorded connection-link attribution is the fallback for the same user/OAuth-client pair.
  A bounded server-only lookup of current registered OAuth client names supplies an
  indicative historical fallback when event-time evidence is missing.
  Null client IDs and missing evidence remain unidentified; later observations never relabel
  an earlier generation through event-time evidence; the current OAuth registry fallback is
  explicitly labeled as indicative. Old schemas continue to serve outcomes using the
  available attribution.
- Migration 48 admits `glama` in the Neon audit constraint without rewriting historical
  rows. Apply it before deploying runtime code that records this family; old `other`
  entries are not force-reclassified.
- The separate acquisition-source split remains limited to acquisition-enabled landing-page
  clients. Direct, preview, hidden, and unidentified hosts remain in its `Other / unidentified`
  row until their acquisition gate is deliberately enabled; this does not prevent their
  self-reported family from appearing in the application breakdown.

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

## Internal activity filter

`/admin` and `/admin/insights` exclude the Camgraph Admin account and manual admin wallet credits by default. The filter preserves the Today/24h and Insights range selections; `excludeAdmin=0` restores the full view. It applies to overview registrations, receipt totals and recent activity, unresolved job failures, and Insights top-up, conversion and usage metrics. It changes reporting only, never receipts or wallet balances. Camgraph's account ID is owned by `frontend/lib/admin/exclusions.ts`; manual wallet grants are marked by `app_receipts.metadata.reason = 'manual_admin_topup'`.

## Admin navigation and overview (2026-09-22)

`frontend/lib/admin/navigation.ts` owns five work areas: Overview, Users, Transactions,
Generations and Content, plus Settings and two external links. The command palette
uses this same inventory. Legacy direct URLs remain; theme and membership are absent
from daily navigation. Search Console reporting is an external link.

The former in-app GSC cockpit, reports and URL inspection routes redirect to
`/admin/seo`, which links to Google Search Console and the separate video publishing
workspace. Their three authenticated action endpoints return `410` and do not call
Google. The GSC runtime client, OAuth configuration and cache writers have been
removed; existing historical cache rows are left intact. No scheduled GSC job was
found in the repository. Public SEO, publication and video SEO services are separate
and remain active. The pure SEO analysis helpers and historical snapshots remain for
offline research; they have no live admin reader.

`/admin/theme` redirects to Settings and the authenticated theme-token API returns
`410` for reads and writes. This removes the obsolete editing surface without
deleting stored overrides. `app/layout.tsx` still applies the existing theme
setting, and the pricing runtime and database override precedence are unchanged.

The light palette is scoped to `.admin-workspace`. Shared sections use separators and
compact tables. The mobile sidebar traps keyboard focus while open and restores it on
Escape. Removed navigation badges no longer trigger server health reads or polling;
health reporting remains available from its existing API and operational views.

Overview authorizes before `fetchAdminOverview`. Reporting windows use Europe/Madrid,
with calendar Today (including DST) separate from rolling 24 hours. Auth and wallet
sources have independent five-second deadlines. Auth scanning is bounded to 100 pages
of 1000 accounts and stops after a late response; partial scans are unavailable, never
presented as full counts. This is a read path, without schema creation. Wallet top-ups in the full view
include manual credits and must not be labelled cash revenue. Transactions search and filters apply to the full ledger before pagination; deep
receipt links resolve independently and preserve PostgreSQL bigint IDs as strings.

Playlist order is an explicit draft. Movement is available by drag or keyboard buttons;
Cancel restores the last confirmed snapshot. Loading another destination commits its ID
and items together after a successful fetch. Async actions remain locked until completion.
Maintenance is disabled with a dirty order. After a successful PUT, the local snapshot is
confirmed before a refresh, so a failed refresh cannot resurrect the old order. Backend
replacement is transactional. Migrated destinations use the opt-in curation workflow
below; unsupported unconfigured collections retain this manual editor.

Contracts: admin-dashboard-architecture, admin-navigation, admin-reporting-window,
admin-overview-read, admin-playlist-selection and admin-playlist-order-postgres tests.


The operational workspaces follow-up keeps Users directory and Generations audit controllers intact while simplifying their views. Collapsed job filters stay mounted and open for active advanced parameters. Moderation accepts an initial read error separately from an empty successful collection. The editorial inventory joins the exact version/digest publication record and separately reports the latest verified published version; neither approval nor an older publication establishes publication of a new draft. Insights renders one focus series and retains the existing comparison query semantics. Regression coverage includes `admin-job-filters-render`, `admin-moderation-read-state`, `admin-editorial-status` and `editorial-admin-inventory-postgres`.

Insights keeps data fetching in the server route and chart interaction in `InsightsLineChart.client.tsx`. Its URL owns the selected range, custom day count (2–90), focus metric, daily or seven-day totals, comparison visibility and admin exclusion. `insights-navigation.ts` normalizes these options and builds links that preserve them; `insights-chart-model.ts` groups real daily series into seven-day totals aligned to the latest day. The first group may be shorter, and the latest group includes the current incomplete UTC day, shown with an open point. The comparison query continues to read the previous equal-length window; hiding its line does not change the other comparison values in the page. Focused contract and browser tests are `admin-insights-chart-options.test.ts`, `admin-insights-architecture.test.ts` and `e2e/admin-insights-charts.spec.ts`.

## Opt-in public curation

Migration `52_playlist_curations.sql` adds separate per-destination state and performs no data migration. Apply it through the normal Neon migration process before enabling the new editor. Missing schema preserves legacy public readers and the existing manual editor. Homepage and starter destinations keep their existing workflows.

`server/playlists/curation-service.ts` owns eligibility, preview fingerprints and transactional saves. `curation-store.ts` owns revision snapshots and the advisory lock shared with legacy playlist mutations. Existing feeds are unchanged until an operator previews and saves Manual or Featured + Automatic. Automatic order uses creation date descending and job ID because publication timestamps are not reliable. Public candidates must be completed video jobs, explicitly public/indexable, have a playable source, match canonical destination aliases and have no matching deleted output/asset. Exclusions precede ordering and limits. Every public read rechecks eligibility. Configured empty results are authoritative, including model fallback routes.

`server/videos-playlists.ts` preserves the legacy SQL and delegates configured destinations to the same resolver as preview. Media normalization, originals, preview URLs, output dimensions and public playback hooks retain their owners. A concurrent revision or changed preview is rejected without persistence. No pricing or production data is migrated by this feature.

### Full transaction history

The transaction workspace reads through `server/admin-transactions/history.ts`.
Search, type/review and Madrid Today/24h/all-time filters apply before the page
limit. A cursor preserves the initial time window and the exact PostgreSQL
microsecond timestamp plus receipt ID; it is bound to the selected filters.
Receipt deep links resolve independently of the visible page. Filter state is
in the URL and navigation uses a pending Next router transition, without a
second client-side copy of the query results. The table never sorts a page again.

Email lookup remains in Users (Supabase Auth owns that data); each user detail
links to their all-time transaction history. The ledger searches receipt/account
IDs, generation IDs, description, model and status. These reads perform no schema
bootstrap. The existing anomaly scan and refund command retain their owners.

First family adoption fingerprints inherited playlists, selections and curation states. Selection writers share an advisory transaction lock; first adoption additionally holds source tables against uncoordinated creation/deletion while revalidating. Configured model galleries bypass static reinsertion and aspect-ratio sorting. Unsupported unconfigured collections retain manual controls; retired configured collections stay closed.

### Four-video gallery opening

Migration `53_playlist_opening.sql` adds optional `opening_ids` without rewriting existing destinations. The admin exposes this feature only after that column exists; old schemas still support ordinary curation saves. Read paths use optional JSON field projection and never install schema.

The [video discovery release runbook](../deployment/video-discovery-release.md)
covers schema preflight, bounded migration, missing model collection reconciliation
and rollback. `tests/gallery-release-rehearsal-postgres.test.ts` replays the migration
and the actual collection helper in disposable PostgreSQL, verifying unchanged public
projections and stored authoring, membership, media and SEO records.

`lib/admin/playlist-curation.ts` owns the four-slot contract: landscape 16:9, portrait 9:16, then two landscape 16:9 originals. Measured output dimensions take priority over declared aspect ratios, with 2% tolerance for encoded sizes. Slots must be complete, unique, eligible and not excluded. They precede the remaining selection, count as normal page entries, and are deduplicated against it. Other catalog sort orders remain authoritative.

`PlacementOpeningEditor` filters candidates by format, previews desktop/mobile placement, and links directly to `/admin/video-seo?video=…`. Existing SEO entries open their editorial detail; new entries prefill the candidate form and still require explicit draft creation and approval. The inventory describes sitemap eligibility, never assumes Google has indexed a page. Preview/save fingerprints include the media dimensions and opening state, so format or eligibility changes invalidate stale saves. Fixtures cover pre-migration behavior, migration replay, stale formats, private media and paginated ordering.

The public popup and direct watch reader share the same editorial projection. Successful SEO create/save/removal APIs call `revalidateVideoSeoPages` after persistence, invalidating the affected watch identifiers and sitemap routes. Rejected writes leave caches intact. A deep link to a disabled video opens its archive section as well as its editor. `tests/admin-video-seo-revalidation.test.ts` and the persisted editorial parity case in `tests/examples-catalog-pagination-postgres.test.ts` cover the connection.

### Paged destination curation editor

`PlacementCandidatePicker` searches the authenticated curation candidates endpoint in
48-item pages. Family, model, measured format, prompt and exact-ID filters run before
server pagination; family and all other filters are bound into the cursor fingerprint.
Family/model aliases are intersected with destination eligibility. Hub and family
candidate reads expand historical registry aliases exactly as the public catalog does;
search, selected windows, complete-ID adoption and preview/save share that scope.
Direct model candidate semantics stay unchanged. Cursor fingerprints still bind the
resolved aliases and filters; changing eligibility requires restarting an old cursor.
A filter change restarts at page one. Opening selection uses that same picker with the slot's format.

First adoption of the active examples hub seeds its draft from the complete effective
catalog, including independent family/model sources, in 500-ID read windows. Family
adoption uses the same membership reader for its scope. Saved manual or hybrid
selections remain authoritative and are never expanded by opening the editor.
Removing or excluding an opening video in its inspector clears that slot and removes
any duplicate from the continuation. Preview stays disabled until the four slots are
complete again; exclusions cannot leave an excluded ID in the opening.

`usePlacementEditor` retains the complete ordered-ID draft and hydrates selected media
in windows of at most 48. `PlacementMediaList` receives the complete tail ID order so
keyboard moves at a window boundary preserve every other ID. Dropping on a selected
page navigation button moves the video to that adjacent page's first position.
The explicit automatic-to-manual policy switch still reads IDs in 500-ID pages.
New family adoption requires four unique, correctly formatted slots. If optional
opening storage is unavailable, adoption returns 503; existing saved legacy family
configurations and model curation remain editable.
Rejected saves retain the draft and invalidate its preview; destination-switch and
before-unload guards retain their existing ownership.

The gallery workbench keeps the complete ID draft in `usePlacementEditor` and
renders only the current 48-item selected window. `DestinationPicker` is the one
compact destination control before the editor; it groups hub, starter, families,
models, image/audio and maintenance entries, with search by name, slug and path.
Missing and historical entries remain diagnostics linked to explicit collection
maintenance. Browsing them never creates or reconciles a collection. The legacy
`PlaylistsSidebar` remains only when no destination projection is available.
`PlacementOpeningEditor` displays the four measured source slots as a visual board;
its portrait slot requires a 9:16 source, and the opening IDs are omitted from the
continuation grid. When opening storage is absent, the editor states that the four-slot
layout is unavailable and keeps the ordered selection usable; it does not attempt a
schema write. `PlacementMediaList` presents selected cards and moves an ID to
a one-based position in the complete order, including unloaded windows.

`PlacementExplorerDialog` mounts `PlacementCandidatePicker` only when Add videos
or an opening slot is chosen. It reuses the authenticated 48-item cursor endpoint,
resets cursors on filter/slot change and drops late responses after closing.
The opening-enabled browser fixture records zero candidate-page requests and zero
MP4 requests on initial load; opening the explorer starts a candidate-page request,
and explicit Play starts an MP4 request. The earlier editor requested its first
candidate page during initial load. This is an admin request-path check, not a
measured public Core Web Vitals improvement.
`PlacementMediaInspector` loads no original video until Play; opening it performs
one authenticated read at `/api/admin/video-seo/[videoId]/status`. That GET derives
editorial state and actual video-sitemap eligibility from the existing watch-row
owner, returns no prompt or media URL, and links to the Video SEO editor. Gallery
selection and Video SEO approval are displayed as separate states. No SEO write is
performed from the workbench.

`PlacementDraftActions` keeps the current mode, cancel, preview and save in view.
The focused preview dialog shows effective current/proposed totals, first 24 IDs,
removals, suppressed sources, opening formats and warnings. Save still requires the
current preview token and revision through the existing transactional service.
A failed or 409 save keeps the draft, clears the preview token and requires a new
preview. A successful save confirms the local snapshot before any inventory refresh.
The workbench changes admin composition only; it does not alter public pagination,
watch URLs, SEO publication gates, model registry or media-delivery owners.


### Gallery destinations and reconciliation

`server/playlists/destinations.ts` projects the authored registry and current public
reader helpers into the inventory. `connected` means the expected runtime slug has a
row; `missing` means that row does not exist; `historical` marks an inactive reserved
hub/starter slug; `unconnected` is an unrelated collection. Direct membership and
effective public counts are distinct. Empty family membership can inherit public
videos from model playlists and the hub. A saved family curation suppresses those
inherited sources; a saved hub curation is authoritative for the hub. Model counts use
the shared final model-gallery projection, including filtering, LTX fallback and
unmanaged preferred/featured additions. At most four model projections run
concurrently; each reads at most 200 playlist videos plus the finite authored
addition IDs. Counts retain legacy behavior when optional curation storage is absent.

The picker opens the connected hub, otherwise the first connected family. Its
menu separates Examples & starters, Families, and Models; model submenus are
grouped by family. Search reveals matching destinations across all sections,
and reopening a selected model expands its family. It precedes the opening board
and selected cards at narrow and desktop widths. Missing/historical
entries are diagnostics, not aliases for active readers. Reserved `examples`,
`marketing-examples`, `welcome`, and `starter` cannot be renamed or deleted, independent
of configuration. Historical mismatches reject ordering and curation writes too.
Reconcile deployment settings deliberately; never rename rows to conceal a mismatch.

Collection maintenance contains legacy creation/seeding/raw collection controls.
Opening it or selecting a destination does not create, migrate, rename, delete or
republish anything. Missing expected collections require a separate explicit operator
decision. Maintenance and destination changes respect dirty-draft/busy guards.

### Effective preview and explicit save

Authenticated GET inventory, snapshot and candidate routes are read-only. Schema
installation belongs to deployment operations. POST preview runs in a read-only,
repeatable-read transaction. PUT is the curation write boundary and requires the
current revision and preview token. Manual retains the authored order; hybrid appends
eligible new videos automatically. Changing the policy is explicit.

Preview shows effective first-page IDs, total, additions/removals, suppressed sources,
opening formats and empty/large-removal warnings. Hub/family projection shares the
public catalog's source precedence and deduplication; opening entries count within
its 24 cards. Model preview shares the final model-gallery projector, including
engine/editorial/public filtering and unmanaged preferred/featured additions. The
model reader takes at most 200 playlist videos before these rules; that is not a
200-card final render cap. Preview does not change Video SEO or publication state.

Save rechecks draft, revision, eligible media, source snapshots and effective output.
A changed source, visibility, format or media URL rejects the stale token. The draft
survives a 409 and Save stays disabled until a fresh preview. Save uses NOWAIT SHARE
locks on six source tables with a two-second SQL deadline; writer contention returns
a retryable 409. Never retry automatically with an old token. Existing optional-schema
fallback remains for public reads; first family adoption needs opening storage.

### Read-only gallery release checklist

- Record the exact candidate SHA and verify the local server's checkout. Read the
  production values of `EXAMPLES_PLAYLIST_SLUG`, `INDEXABLE_PLAYLIST_SLUGS`, and
  `STARTER_PLAYLIST_SLUG`, then compare active slugs with live playlist rows and the
  hub/starter readers. Record unset values and the deployed source defaults explicitly.
  Never infer production settings from local diagnostics. If settings, rows or deployed
  reader evidence is inaccessible, leave this release gate unresolved.
- Keep environment and database unchanged during the audit. Check schema availability
  through catalog reads. Use disposable PostgreSQL for opening-enabled browser fixtures;
  do not migrate a shared local database just to show four slots.
- At 688 × 900, approximately 960 pixels, desktop 1440 × 1000 and mobile, confirm the
  compact picker and opening media precede the candidate explorer, mismatch diagnostics
  are reachable, and no horizontal overflow occurs. Check search, candidate page 3, selected-window paging, keyboard and
  pointer ordering, dirty destination guard, preview summary and rejected-save draft
  retention. Validate 16:9 / 9:16 / 16:9 / 16:9 slot geometry on the disposable fixture.
- Open `/examples`, a family route, and a model route. Follow available pagination,
  inspect the first 24 hub/family IDs for duplicates, and exercise first Play plus watch
  navigation. Model pages retain their existing gallery behavior, not hub pagination.
  Verify canonical, localized hreflang/paths, JSON-LD watch URLs, redirects, and sitemap
  eligibility through their existing owners. Curation must not take ownership of SEO.
- Run Tasks 1–6 focused tests with disposable PostgreSQL available, frontend TypeScript,
  frontend lint, exposure lint, and `git diff --check`. Preserve server-rendered poster
  discovery, single priority image, media originals and shared playback owners.
  Attach comparable before/after Core Web Vitals only when initial public loading changes.
- Record screenshots/observations and precise limitations in the release report; a
  passing source contract is not a browser or production check. Review the committed
  branch before any separate production merge/deployment procedure.
