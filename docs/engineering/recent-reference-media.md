# Recent media references

The video workspace offers separate Activity and Recents views. Activity keeps its existing `GalleryRail` mounted, including job history, batch actions and polling. The named mobile Recents action opens the same bounded list and restores focus on Escape/Close.

`useWorkspaceRecentMedia` reuses Library's `buildRecentOutputsKey` and `recentOutputsFetcher`, including the account identity, media kind and first-page limit of 60. It projects at most 12 ready originals, has no polling timer, and does not retain previous account/filter data. Image, video and audio filters are supported. Original URLs, output ids and job ids survive projection; thumbnails are display-only. Video/audio readers are never mounted in the recent list. Stored image thumbnails use `LibraryImageThumbnail`, preserving private/signed sources outside the public optimizer.

`getWorkspaceReferenceFields` is the shared composer/recents availability owner. The recent-reference adapter retains the actual `EngineInputField` and selected slot index. Both explicit selection and internal desktop drag open the same role chooser. Drag data contains an ephemeral local token, not a URL or a caller-selected media id; the adapter re-resolves the current owned feed identity at drop time. External drags remain in the existing upload owner.

`getRecentReferenceIssue` checks kind, duration and existing `resolveEngineMediaFieldConstraint`/`validateMediaFileAgainstConstraint` limits, including engine fallback size/formats. It uses `tryInsertReferenceAsset` to preview per-role and shared budgets. Unknown required metadata is never assumed valid. Multiple compatible roles require explicit choice; occupied slots expose an explicit Replace choice. Production acceptance still goes through `useWorkspaceReferenceAssets.handleSelectLibraryAsset`, including synchronous reservation, generated-video mirroring, settlement and rollback. No selection removes an existing reference before this owner accepts it.

## Metadata read boundary

Recent-output listing does not contain byte size. After an explicit media selection that needs metadata, `useWorkspaceRecentMetadata` calls `GET /api/media-library/recent-outputs/metadata?outputId=...`. The endpoint takes an output id only and uses the existing route-auth owner. Its server helper selects one ready, nonhidden output belonging to both the output and job owner. A saved asset's bytes are usable only when its kind and exact original URL match; otherwise the existing configured-storage key parser and metadata HEAD owner read one original object. It never probes caller URLs, external provider URLs or private arbitrary hosts, downloads content, creates schema, saves assets or changes jobs.

The endpoint is private/no-store and combines request cancellation with an eight-second abort signal. The storage HEAD accepts that signal; the database read is bounded to one row but retains the existing database driver's query timeout. The client cancels on selection/account changes or closing, has a ten-second timeout and explicit retry, and accepts enrichment only for the exact current account/output/kind/original identity. Metadata changes size/MIME only. External originals or originals with unresolved size/duration/format remain unavailable for constrained roles with a clear import-original alternative.

## Reuse and scope

`RecentMediaList` accepts a destination callback and optional `actionLabel`; it owns neither reference mutation nor project membership. A future Studio adapter must provide its own authorized project/canvas command and validate its destination. No Studio route, success action or timeline mutation is implemented here.

This integration covers image/video/audio sources in the video workspace. Specialized Luma/Omni inputs retain their dedicated selectors, as do Kling element assets. Image and audio creator routes retain their existing library/insertion owners; the shared list is reusable but is not wired into those creators in this lot.

## Verification limits

Behavior tests use controlled DTOs, actual SWR hooks and JSDOM callbacks, plus injected database/storage metadata dependencies. They cover account/filter staleness, metadata cancellation/retry, original identity, type/size/format/duration limits, role/slot selection, shared budgets, reservation rollback and focus. SQL authorization predicates have a source contract; no live/disposable database or real storage HEAD was used for this change. Root browser QA covers actual guest/error surfaces and controlled local media callbacks; it does not establish live authenticated feed, remote mirroring, storage readiness, physical mobile behavior or Core Web Vitals.
