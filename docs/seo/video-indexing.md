# Video Indexing Monitoring Checklist (GSC)

Use this checklist after deploying the `/video` noindex + `/examples` canonical + video sitemap updates.

## Timeline
- Day 0-2: confirm deployment + crawl
- Day 3-7: watch exclusion trends stabilize
- Day 7-14: compare impressions/clicks shift

## What to check
1. **Page indexing > Excluded**
   - Expect `/video/job_` URLs to move to "Excluded by 'noindex'".
   - Watch for unexpected spikes in "Crawled - currently not indexed" for `/examples`.

2. **Video indexing report**
   - Submitted URLs should match `/examples?engine=...` (not `/video/job_`).
   - Watch "Video indexed" count trend (should stay stable or improve).

3. **Performance > Search results**
   - Filter by page: compare `/video/` vs `/examples` impressions.
   - Expect impressions to shift toward `/examples?engine=...` while total clicks stay stable or rise.

4. **Sitemaps**
   - `sitemap-video.xml`: verify only `/examples?engine=...` locs.
   - Confirm the number of submitted URLs aligns with the curated playlist size.

5. **URL Inspection (spot checks)**
   - `/video/job_<id>`: `noindex,follow` and canonical self.
   - `/examples?engine=<slug>`: `index,follow`, canonical keeps `engine` (and `page` when paginated).

## Regression alerts
- `/video/job_` URLs showing as "Indexed, not submitted in sitemap".
- `/examples?engine=...` canonical collapsing to `/examples` unexpectedly.
- Large drop in overall video impressions without a corresponding rise on `/examples`.
