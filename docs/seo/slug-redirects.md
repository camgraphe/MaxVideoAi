# 301 Redirect Plan

| Ancienne URL | Nouvelle URL | Motif |
| --- | --- | --- |
| http → https (`maxvideoai.com/:path*`) | https://maxvideoai.com/:path* | Force HTTPS |
| https://maxvideoai.com/:path* | https://maxvideoai.com/:path* | Canonical non-www |
| /:path*/ | /:path* | Remove trailing slash |
| /calculator | /pricing-calculator | Keyword-rich pricing calculator slug |
| /docs/getting-started | /docs/get-started | Shorten onboarding slug |
| /models/openai-sora-2 | /models/sora-2 | Standardize Sora slug |
| /models/openai-sora-2-pro | /models/sora-2-pro | Standardize Sora Pro slug |
| /models/google-veo-3 | /models/veo-3 | Drop brand prefix for Veo |
| /models/google-veo-3-fast | /models/veo-3-fast | Drop brand prefix for Veo fast |
| /models/minimax-video-01 | /models/minimax-video-1 | Simplify MiniMax version |
| /models/minimax-hailuo-02-pro | /models/hailuo-2-pro | Shorten Hailuo slug |
| /blog/veo-v2-arrives | /blog/veo-3-updates | Align Veo launch post with version 3 |
| /privacy | /legal/privacy | Move policies under /legal hub |
| /terms | /legal/terms | Move policies under /legal hub |
| /legal/privacy/ | /legal/privacy | Ensure trailing slash removal |
| /legal/terms/ | /legal/terms | Ensure trailing slash removal |

**Implementation tips**
- Configure domain-level redirects (HTTP → HTTPS, www → apex) at DNS provider or via Vercel project settings.
- Define path-level redirects in `vercel.json` or Next.js `next.config.js` (`async redirects()`).
- Test each redirect with `curl -I` and via Google Search Console “Inspect URL”.
- Maintain this table in version control; update whenever a slug change is shipped.
