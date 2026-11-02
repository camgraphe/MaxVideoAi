# Public video analytics

Accepted scope: distinguish future public video opens and deliberate playback in the existing Vercel dashboard. No historical backfill or new admin dashboard. SEO approval automatically enables identification; no extra admin field.

Only approved, indexable editorial videos with a valid canonical slug receive an analytics path in the server-owned watch detail. Other videos retain `/video/:video`. The shared standalone/gallery reader publishes a hidden measurement marker. Vercel waits for a rendered reader on video routes, then records one page view per mounted reader, with the approved canonical path. This handles asynchronous gallery detail and next/previous navigation without counting an initial placeholder and then the resolved video twice.

Manual playback emits `public_video_play` with `video_slug` and `surface` after the controls receive `playing` for a visible, intended, current source. One event per reader opening; resumes, buffering, quality fallback, hover and autoplay do not add events. Respect existing analytics consent and admin exclusion. Page views keep the existing Vercel policy.

API hostname is excluded from browser commercial analytics and Vercel collection. This does not block forged HTTP submissions or identify bot operators.

Preserve canonical/hreflang/redirect/VideoObject/sitemap behavior, original media URLs, poster markup, geometry, preload and playback policy. No database migration, extra fetch, or media preload.
