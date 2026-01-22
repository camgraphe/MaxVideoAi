# Video Indexing Monitoring Checklist (GSC)

Use this checklist after deploying the `/video` noindex + `/examples/[model]` canonical + video sitemap updates.

## Timeline
- Day 0-2: confirm deployment + crawl
- Day 3-7: watch exclusion trends stabilize
- Day 7-14: compare impressions/clicks shift

## What to check
1. **Page indexing > Excluded**
   - Expect `/video/job_` URLs to move to "Excluded by 'noindex'".
   - Watch for unexpected spikes in "Crawled - currently not indexed" for `/examples`.

2. **Video indexing report**
   - Submitted URLs should match `/examples/<model>` (not `/video/job_`).
   - Watch "Video indexed" count trend (should stay stable or improve).

3. **Performance > Search results**
   - Filter by page: compare `/video/` vs `/examples` impressions.
   - Expect impressions to shift toward `/examples/<model>` while total clicks stay stable or rise.

4. **Sitemaps**
   - `sitemap-video.xml`: verify only `/examples/<model>` locs.
   - Confirm the number of submitted URLs aligns with the curated playlist size.

5. **URL Inspection (spot checks)**
   - `/video/job_<id>`: `noindex,follow` and canonical self.
   - `/examples/<slug>`: `index,follow`, canonical self.
   - `/examples?engine=<slug>`: canonical points to `/examples/<slug>`. Combos with extra filters should be `noindex,follow`.

## Regression alerts
- `/video/job_` URLs showing as "Indexed, not submitted in sitemap".
- `/examples/<slug>` canonical collapsing to `/examples` unexpectedly.
- Large drop in overall video impressions without a corresponding rise on `/examples`.
