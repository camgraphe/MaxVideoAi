# Gallery admin destinations and safe curation

Date: 2026-09-28  
Status: approved for implementation planning in conversation
Scope: `/admin/playlists`, its destination inventory and curation APIs, and the route contracts they expose. Public gallery presentation, watch pages, and SEO metadata remain under their existing owners.

## Outcome

An operator can find the Examples hub, guest video starter, every example family, and each model collection; see exactly which public surface each collection affects; choose a four-video family opening with verified media formats; order the remaining videos; and preview the effective result before saving. The interface fits the Codex side browser as well as a full desktop window. No playlist is silently renamed, migrated, deleted, or republished by opening the admin.

The design retains existing public paths, localized routes, watch pages, media URLs, sitemap and Video SEO ownership, the current PostgreSQL playlists and curations, and opt-in curation semantics. The current versioned `preview → save` protocol stays the write boundary.

## Observed state and failure

The authenticated local admin on port 3210 returned a playlist named `examples` with 177 items (176 site-visible) and `welcome` with 20 site-visible videos. It classified both as `other`, hid them behind “Show draft / empty”, and did not assign a public route to either. The same runtime resolved the hub slug to `marketing-examples` and video starter to `starter`; neither expected slug had a playlist row. Consequently the admin's apparent inventory does not describe the data that an operator expects to curate. `examples` is locked only because it appears in the indexable slug list; `welcome` is not locked in this configuration and can reach the delete control. Production's actual environment values have not been established by this local observation and must be checked before release.

At a 688-pixel browser width the destination rail occupies the full row before the editor, with a scrollable list of all families and models. The chosen editor is pushed below that list. Candidate controls show only the first 100 matches even though the GET endpoint loads the complete candidate set into the browser. Existing families have a four-slot opening editor and the public catalog already deduplicates overlapping memberships by job ID. Those contracts must be retained and made understandable.

## Approaches considered

1. **Guided destinations on the existing storage and read paths — selected.** Build a server-owned destination inventory from the same slug and family helpers used by public readers. Reshape the admin around destinations and a guided curation editor. Retain IDs, URLs, persisted rows, and staged writes. This fixes the visibility and safety problem while keeping the release reviewable.
2. **Cosmetic compaction only.** Compress the current sidebar and cards. This leaves the local slug mismatch, the unprotected `welcome` row, and unclear inheritance untouched.
3. **Rename and migrate all playlists.** Standardize historical slugs and introduce a new collection model. This changes live readers and old admin links together, so its migration and rollback cost exceeds the present need.

## Destination contract

The server returns a read-only inventory that includes expected destinations even when their playlist row is missing. Each destination has a stable logical ID, active runtime slug, public route or workspace surface, source role, item count, effective public count, fallback source IDs, status (`connected`, `missing`, `historical`, or `unconnected`), and whether edits are permitted. This inventory is derived with the same `getExamplesHubPlaylistSlug`, `getStarterPlaylistSlug`, family slug, model slug, and starter media helpers used by readers. It is not derived from a playlist's display name.

| Logical destination | Current reader source | Public or workspace surface |
| --- | --- | --- |
| Examples hub | Configured hub slug | `/examples` and localized aliases |
| Guest video starter | Configured starter slug | Guest video feed in `/app` and its jobs fallback |
| Image and audio starter | `starter-image`, `starter-audio` | `/app/image`, `/app/audio` |
| Family | `family-{id}`; then model playlists and hub while no family curation is saved | `/examples/{family}` and localized aliases |
| Model | `examples-{modelSlug}` | `/models/{modelSlug}` examples and family fallback while not suppressed by family curation |

The hub is also the global gallery source. The public catalog can include family and model sources when hub curation is absent. A saved hub curation is authoritative. A saved family curation suppresses that family's inherited model and hub feed. The admin labels these relationships and shows the **effective page**, not merely the direct membership count. Its diagnostics use the same precedence and job-ID deduplication rules as `videos-catalog-page.ts`.

An existing historical row is never presented as the active destination merely because its name looks familiar. If the active slug is absent and `examples`, `marketing-examples`, `welcome`, or `starter` is present, the inventory shows both the missing active destination and the historical row, with a configuration mismatch warning. Curation and destructive controls for the mismatch are disabled until the runtime mapping is deliberately reconciled. Reserved hub and video-starter slugs are protected from rename and deletion independent of which slug is active in the current environment. The admin cannot fix an environment mismatch by changing a database slug.

The local review environment must use the verified production slug settings, or explicitly display that it does not. Before release, compare nonsecret production values for `EXAMPLES_PLAYLIST_SLUG`, `INDEXABLE_PLAYLIST_SLUGS`, and `STARTER_PLAYLIST_SLUG` with the live playlist rows and public reader output. Do not change a production environment value or public fallback default as a side effect of this admin release.

## Operator interface

The first screen opens **Examples** when connected, otherwise the first connected family and a prominent mismatch diagnostic. A compact destination switcher shows `Examples`, `Starter video`, `Families`, `Models`, and `Image / audio`; maintenance stays separate. On narrow screens it uses dense tabs or chips above the selected editor. It never renders the entire family and model inventory ahead of the editor. Full-width desktop may use a two-column selector, but its selection and content order match the narrow layout.

Families appear as compact labelled buttons with public counts and status. Selecting a family reveals its models grouped directly beneath it, ordered by the authored model registry rather than by playlist item count. A global search finds destination label, slug, family, model, and public path. Missing expected destinations remain visible with a specific explanation and a maintenance action; historical or disconnected collections remain in a separate diagnostic section. The header of the selected destination states its public path, source chain, publication status, and a direct view-page link.

The family editor leads with four visual slots in order: `16:9 lead`, `9:16 vertical`, `16:9 side`, `16:9 side`. The same format rules apply to any hub opening that is authored. Model examples do not acquire an obligatory four-video opening. Each slot shows a poster, model, actual measured format, and replace/remove action; the desktop and mobile preview use the gallery's real slot geometry. Slot selection filters by measured output dimensions, falling back to declared aspect ratio only where dimensions are unavailable. Four unique, eligible videos are required before a **new family curation** can be saved. Existing uncurated families continue to render their established feed while the operator gathers a valid opening; an incomplete draft never changes the site.

Below the opening is one compact ordered list of selected media, with poster, format, model, position, drag handle, keyboard move actions, and Video SEO link. A searchable candidate picker supports family/model and format filters, stable server pagination, total count, and lookup by exact video ID. It has no 100-result display ceiling and does not ship the complete candidate set to the browser on every destination open. The current 2,000-video adoption and ordered-ID guards are replaced with paged ID reads and validated server-side ordering, so a large gallery can be opened and curated without an arbitrary total-count cutoff. The public gallery continues to page 24 cards at a time; the four opening videos count within page one and never reappear in the remainder.

The old `manual` and `hybrid` modes remain persisted for backward compatibility. The operator sees one explicit policy control: **unselected videos hidden** or **eligible new videos appended automatically**. It reflects the saved mode and never switches silently. For large collections, a selected ordered segment can be edited without rendering every eligible video at once. Removing a video from a destination does not change its public/SEO publication status; a separate exclusion action blocks automatic re-entry to that destination.

## Preview, save, and failure behavior

Preview is read-only and required before save. It reports the effective public order and total after destination precedence and deduplication, the first 24 cards, four opening formats, how many IDs are added or removed relative to the current feed, and which fallback sources cease to contribute. A zero-result, large-removal, missing-format, stale-media, private-media, or disconnected-destination condition is explicit. The operator can cancel without persistence.

The server validates eligibility, route identity, media dimensions, unique opening IDs, exclusion conflicts, and revision during preview and again in the transaction used by save. It accepts only the preview fingerprint generated for the same draft and destination; a concurrent playlist, job-visibility, media-format, or inherited-source change invalidates it. Save never mutates `app_jobs` visibility, Video SEO editorial data, originals, pricing, or unrelated playlists. Errors retain the draft and explain how to refresh or replace an ineligible item. The old public feed stays intact until a successful explicit save.

Legacy playlist ordering remains available only for surfaces not yet using curations. A managed destination cannot be modified through both legacy and new endpoints. Bulk create/seed, raw slug editing, and deletion remain in maintenance, protected by server checks; they are absent from the daily ordering flow.

## Implementation boundaries and rollout

- A server destination-projection module owns logical IDs, current and historical slug classification, route/source relationships, and reserved-slug protection. Public readers keep their current slug helpers and SQL; no second route map is authored in the client.
- `/admin/playlists` remains the authenticated route orchestrator. Focused admin components own the destination switcher, compact grouped model selector, opening slots, selected list, candidate picker, and preview summary. Client components hold interaction state only.
- The curation API retains `GET` snapshot, `POST` preview, and `PUT` save responsibilities. `GET` returns the snapshot, selected IDs and selected-item metadata; a new authenticated `GET /api/admin/playlists/[playlistId]/curation/candidates` endpoint owns filtered, cursor-paged candidates and exact-ID lookup. The admin client and route change together. `POST` adds the effective-page summary to its existing preview token response; `PUT` retains the current token and revision requirements.
- No database migration or playlist data rewrite is part of the UI rollout. The optional `playlist_curations` and `opening_ids` schema gates continue to provide legacy behavior if unavailable. Deployment of code precedes any operator adoption of new curations.
- Public first-page media, poster priority, playback behavior, SEO canonical/hreflang, JSON-LD, sitemap eligibility, and watch URLs are unchanged by merely opening the admin. Any later public media selection is an explicit content change, reviewed through preview.

## Acceptance and verification

1. With `examples` and `welcome` rows but mismatched runtime settings, both are visible as historical/unconnected; the expected active destinations are visibly missing; no rename, delete, or curation write is offered for the mismatch. Matching settings identify the existing rows as connected without creating duplicates.
2. The connected hub and video starter are reachable within one selection from the first admin screen. At a 688-pixel width, the selected editor begins within the first screen, ahead of the long family/model inventory.
3. Every family and model listed in the authored registry has one destination entry. Models are grouped by family; status and count come from the actual destination. Missing model/family rows are reported, never silently created.
4. Four valid opening slots accept `16:9, 9:16, 16:9, 16:9`; wrong, duplicate, private, excluded, or stale media fail before save. Slot videos appear once in the first public page; pages two onward remain reachable and duplicate-free.
5. Manual and automatic tail policies preserve previously saved behavior. Search/pagination can reach a candidate beyond the first 100, and a destination with more than 2,000 eligible videos opens and previews without an arbitrary count failure. Order controls work by keyboard as well as pointer. Unsaved edits survive a rejected save and are guarded on destination change.
6. Preview and the published reader agree on first-page IDs, total, inheritance, and deduplication for hub, family, and model cases. Concurrent source and media changes reject stale saves. No admin GET installs schema or writes data.
7. Focused contracts cover destination mapping under production-like and mismatched environment values, protected slugs, candidate pagination, curation preview/save, route precedence, and SEO/watch isolation. Browser checks cover narrow and desktop admin, public `/examples`, family and model routes, and the first Play. Compare public first-load Core Web Vitals before and after only if the implementation changes their initial-loading path.
