# Video Indexing Monitoring Checklist (GSC)

Use this checklist after deploying the curated `/video/job_*` watch-page indexing rollout and video sitemap updates.

## Timeline
- Day 0-2: confirm deployment + crawl
- Day 3-7: watch exclusion trends stabilize
- Day 7-14: compare impressions/clicks shift

## What to check
1. **Page indexing > Excluded**
   - Curated `/video/job_` URLs should not be blocked by `noindex`.
   - Watch for unexpected spikes in "Crawled - currently not indexed" on the curated watch pages.

2. **Video indexing report**
   - Submitted URLs should match the curated `/video/job_` watch pages.
   - Watch "Video indexed" count trend (should stay stable or improve).

3. **Performance > Search results**
   - Filter by page: compare `/video/` vs `/examples` impressions.
   - Expect curated `/video/` pages to pick up video impressions without collapsing the supporting `/examples` hub pages.

4. **Sitemaps**
   - `sitemap-video.xml`: verify only curated `/video/job_` locs.
   - Confirm the number of submitted URLs aligns with the curated playlist size.

5. **URL Inspection (spot checks)**
   - `/video/job_<id>`: `index,follow` when the job is still eligible, canonical self.
   - `/examples/<slug>`: `index,follow`, canonical self.
   - `/examples?engine=<slug>`: canonical points to `/examples/<slug>`. Combos with extra filters should be `noindex,follow`.

## Regression alerts
- `/video/job_` URLs showing as "Excluded by 'noindex'".
- `/video/job_` URLs missing from `sitemap-video.xml`.
- `/examples/<slug>` canonical collapsing to `/examples` unexpectedly.
