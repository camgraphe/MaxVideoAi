# Validation Checklist & Expected Impacts

## Sitemap & Robots
- Regenerate the sitemap data (`npm run build` calls `app/sitemap.ts`) and confirm `curl https://maxvideoai.com/sitemap.xml` returns the updated `<urlset>` entries.
- Confirm `robots.txt` keeps only canonical sitemap URL and continues to disallow `/_next/` and `/api/`.
- After deployment, fetch `https://maxvideoai.com/sitemap.xml` and resubmit it in Google Search Console.

## Canonical & Metadata Updates
- Update `<link rel="canonical">` tags for any page whose slug changes (pricing calculator, legal, model detail pages, blogs).
- Adjust Open Graph / Twitter cards, schema.org markup, and JSON-LD references to new URLs.
- Refresh breadcrumbs/navigation structures in shared components (`<Link>` targets) to point to the canonical slugs.

## Redirect & QA
- Implement 301s listed in `slug-redirects.md` inside `next.config.js` or `vercel.json`.
- Smoke test each redirect (`curl -I`) to ensure HTTP 301 → 200.
- Run Google Search Console “URL Inspection” on a sample of renamed pages to verify Google sees the canonical and the redirect chain.

## Analytics & Tracking
- Update analytics goal configurations, tagged dashboards, and any paid campaign tracking URLs to the new slugs.
- Verify that segment filters or Looker/Amplitude dashboards referencing old slugs are updated.

## Post-Launch Monitoring
- Monitor Search Console coverage for “Duplicate, Google chose different canonical” issues.
- Track 404 logs in Vercel/Logflare for any missed legacy URLs and patch with additional redirects if needed.
- Re-run the healthcheck and internal link audits (`npm run lint:exposure`) after updating internal links.
