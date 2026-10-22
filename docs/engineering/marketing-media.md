# Marketing media ownership

The admin library at `/admin/marketing-media` owns independent site copies of generated videos. One publication uses the existing video ID, with any number of gallery/homepage placements. Customer jobs, outputs, assets, billing and quota ownership are unchanged.

## Copy and reuse

`server/marketing-media/snapshot.ts` captures the versioned generation snapshot and a deduplicated manifest of original video, preview, poster, keyframes and reference media. Complete settings are mandatory; provider interaction dependencies cannot be silently substituted. Prompts and model parameters retain their values. Private owner/asset IDs and billing/provider execution records never enter the public recreation DTO. Source provenance stays in the admin-only database row.

`copy.ts` claims one leased attempt, copies bounded original bytes into `marketing-media/<copy UUID>/<content hash>.<extension>`, verifies public readability, then atomically makes the publication ready after rechecking the exact source. Limits are 64 source files, 256 MiB per file, 512 MiB total and a three-minute preparation deadline. An admin must confirm permission for another owner's video and its references. No generation or charge occurs. Failed preparations are retryable and never replace a public source. Interrupted files remain within the copy's namespace; deletion cleans that namespace, including files from failed attempts.

Ready copies are publicly readable storage objects. Publication visibility controls their appearance on the site. Reference grants require exact membership in a ready manifest; private publications allow reuse only for admins. No arbitrary internal storage prefix grants access.

`recreationSnapshot` is separate from the personal job. Normal `/app?from=<original ID>` reuse loads it without a later private-job request overwriting the copied references. Existing comparison links with `remix=1` retain their selected text-to-video settings. Current pricing/availability still applies at generation time. Typed references in older/API snapshots resolve to the active model's input schema when explicit UI slots are absent.

## Public compatibility

`marketingVideoReader` is used only by public/editorial read owners. It overlays ready publications over the existing `app_jobs` identity in the same SQL request. Personal activity, billing, job reads and private share tokens keep their own owners. No public page route, video ID, redirect, canonical slug, hreflang, editorial approval or sitemap publication rule changes. Output dimensions are retained independently of personal output rows.

Existing admin visibility, thumbnail and removal endpoints target the marketing publication when present. Customer indexing preferences must not remove marketing playlist membership. A deleted marketing identity remains a tombstone so the old public personal job cannot reappear accidentally.

The placement indicator inventories saved playlists/curations, homepage sections, editorial watch records, public catalog eligibility and registered authored demo sources. It is conservative: a saved but temporarily hidden explicit placement still blocks deletion. Remove placements and unpublish before deleting. Placement guards reject stale writes that reference deleting/deleted publications. Curation saves lock the marketing projection alongside their existing source locks.

Promotion of an original registered in `config/public-video-sources.json` is rejected until an explicit migration preserves its prepared playback renditions. Authored URLs in that registry, homepage assets and model/family configurations are not rewritten. Those original sources and their prepared renditions must be retained until a separate explicit migration verifies the exact reader, immutable derivative policy, HTTP/Range behavior and performance. This feature does not introduce customer physical purging or a bulk migration of existing site content.

## Activation and rollback

1. Follow `docs/deployment/github-vercel.md`: isolated branch, reviewed PR, required Quality CI, current main and normal Git deployment. This implementation does not apply production schema or deploy production.
2. Apply `neon/migrations/78_marketing_media.sql` explicitly to the application Neon database after existing playlist/homepage migrations. It adds the independent table and non-mutating placement guards; it copies no customer media. Replaying it installs guards on optional placement tables added later.
3. Set server-side `MARKETING_MEDIA_ENABLED=1` only after schema installation. The default is disabled; disabled public reads need no new table. Test an admin-owned video first, including reference reuse and public reader identity.
4. Before broad use, verify both production domains against the merged source, storage public GET/HEAD behavior for this namespace, admin authorization and the existing SEO audit. Do not hide build/CI failures or bypass the deployment policy.

Disabling the flag returns to legacy reads. After a personal source has been removed, disabling the projection cannot preserve that marketing publication; restore the source or keep the projection active while rolling back the admin UI. Do not drop the table or delete copied files as a rollback shortcut. Deleted identity tombstones and completed publications are durable site data.

## Verification

Focused tests cover byte preservation and bounds, exact prompt/settings/reference capture, permission, concurrent attempts, failed-copy retry, source changes/deletion, enabled/disabled public reads, placement-protected deletion and stale writes. Disposable PostgreSQL tests exercise the real catalog and approved watch slug after source deletion. Browser fixtures mount the real admin component at mobile/desktop widths and check retry, reuse links, placement controls and zero original-video requests before Play. Existing watch/SEO, share, curation, workspace and owned-media contracts remain part of validation.

Tests using PostgreSQL may be run with `--test-concurrency=1` on local macOS to avoid exhausting its shared-memory IDs. Use the repository PG17 resolver; do not override version checks. Browser fixtures and offline tests are not a production rollout or live Google Search Console verification.
