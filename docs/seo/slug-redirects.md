# 301 Redirect Plan

| Ancienne URL | Nouvelle URL | Motif |
| --- | --- | --- |
| http → https (`maxvideoai.com/:path*`) | https://maxvideoai.com/:path* | Force HTTPS |
| https://maxvideoai.com/:path* | https://maxvideoai.com/:path* | Canonical non-www |
| /:path*/ | /:path* | Remove trailing slash |
| /a | / | Catch stray single-letter tests |
| /ai | / | Funnel AI typo hits to homepage |
| /video | / | Remove obsolete short slug |
| /sora2 | /models/sora-2 | Handle hyphen-less Sora queries |
| /sora-2 | /models/sora-2 | Promote canonical Sora page |
| /pika | /models/pika-text-to-video | Map shorthand Pika slug |
| /pikavideo | /models/pika-text-to-video | Capture manual Pika tests |
| /pricing-calculator | /pricing | Consolidate calculator content into main pricing hub |
| /calculator | /pricing | Legacy keyword slug routed to canonical pricing page |
| /docs/getting-started | /docs/get-started | Shorten onboarding slug |
| /models/pika-2-2 | /models/pika-text-to-video | Consolidate legacy Pika slug |
| /models/pika-image-video | /models/pika-text-to-video | Align Pika image-to-video slug |
| /models/pika-image-to-video | /models/pika-text-to-video | Merge old standalone Pika page |
| /models/openai-sora-2 | /models/sora-2 | Standardize Sora slug |
| /models/openai-sora-2-pro | /models/sora-2-pro | Harmonise legacy naming with new Sora Pro page |
| /models/google-veo-3 | /models/veo-3-1 | Promote latest Veo release |
| /models/google-veo-3-fast | /models/veo-3-1-fast | Drop brand prefix for Veo fast |
| /models/veo-3-fast | /models/veo-3-1-fast | Sunset legacy Veo 3 slug |
| /models/google-veo-3-1-fast | /models/veo-3-1-fast | Align new fast tier naming |
| /models/minimax-video-01 | /models/minimax-hailuo-02-text | Map legacy MiniMax slug to Standard text tier |
| /models/minimax-video-1 | /models/minimax-hailuo-02-text | Additional legacy MiniMax slug |
| /models/minimax-hailuo-02 | /models/minimax-hailuo-02-text | Normalize Hailuo Standard route |
| /models/minimax-hailuo-02-pro | /models/minimax-hailuo-02-text | Sunset Pro variant |
| /models/hailuo-2-pro | /models/minimax-hailuo-02-text | Redirect deprecated Pro slug to Standard page |
| /models/luma-dream-machine | /models | Route removed Luma engine to models hub |
| /models/luma-ray-2 | /models | Route legacy Luma Ray 2 slug to models hub |
| /models/luma-ray-2-flash | /models | Route Ray 2 Flash slug to models hub |
| /models/kling-2-5-turbo-pro | /models/kling-2-5-turbo | Consolidate retired Kling tier into refreshed Kling detail page |
| /models/kling-25-turbo-pro | /models/kling-2-5-turbo | Consolidate retired Kling tier into refreshed Kling detail page |
| /blog/express-case-study | /blog/compare-ai-video-engines | Merge legacy case study into comparison guide |
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
