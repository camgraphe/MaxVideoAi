# Video sharing

The Result modal and media library use `MediaActionPanel.client.tsx`. Video sharing is a compact, secondary panel below the original download action. The creation composer does not carry a prominent share CTA. Public example videos can use the same panel without a signed-in account. Public `/video/[id]` watch pages place a small share button directly below the player and lazy-load that panel when opened.

## Link ownership

- `POST /api/video-shares` checks the exact original URL and the authenticated user's ownership before minting an unguessable `/s/[token]` link. The source remains in `job_outputs`, `media_assets`, `user_assets`, or `app_jobs`; the share table stores only source identity and owner, never a copied media URL.
- Public examples use their existing `/video/[id]` watch page after confirming public visibility, indexability, a stable URL, and an exact original match. Only the explicit `public-example` source takes this path; a user's private result gallery uses authenticated ownership checks. These links need no token or owner revocation.
- `GET /api/video-shares/public-download` streams a verified public example from the owned media CDN. It supports real MP4 saving and compatible browser file shares for visitors; it does not accept an arbitrary source URL.
- `/s/[token]` reads the current source at request time, is excluded from indexing, and disappears if the source is removed or the owner deactivates the link. `DELETE /api/video-shares` requires the owner.
- The underlying original may already be publicly reachable. Deactivating the MaxVideoAI share page does not revoke direct media URLs that a recipient copied separately.
- Signed, temporary, private, and placeholder media URLs cannot receive a lasting link. File sharing remains available when the browser supports it.

Apply `neon/migrations/49_video_share_links.sql` before deploying the API and page. This migration does not run in a request path. The new URL must remain same-origin in local development and use `SITE_ORIGIN` in production.

## Destinations and suggested text

| Visible | Behavior |
| --- | --- |
| Link | Copy the MaxVideoAI page URL. |
| E-mail | Open a draft with the link and editable “Video created with MaxVideoAI” style footer. |
| TikTok, Reels, Shorts | Offer the browser's native video file share when supported, plus MP4 saving. Suggest editable `#MaxVideoAI`; a destination app may ignore prefilled text. |
| X | Expand a native-video path: save MP4, open an X draft with editable `#MaxVideoAI` and the share link when available, then attach the MP4 before posting. A separate link-only action explicitly says it produces an image preview. X's intent URL cannot attach the file. |
| More | WhatsApp and Telegram receive link plus editable footer. LinkedIn and Facebook receive the URL only because their share dialogs do not guarantee custom text. Native link share is offered where available. |

The user may edit or erase either suggestion. No watermark is applied to the video. `video-share-intents.ts` builds the platform URLs; `VideoSharePanel.client.tsx` owns the browser share/file behavior; `video-share-copy.ts` owns EN/FR/ES UI copy.

The existing consent-aware `cta_click` event records panel openings and destination selections with a `video_share_*` action name. It does not send the video URL, token, caption, or hashtag. Use those counts to judge which destinations merit deeper integrations.

The browser's file-share API does not select a specific destination app. It lets the user choose an installed app; saving the MP4 remains a clear alternative. Keep this distinction in UI text and QA. The `/s/[token]` page currently advertises a `summary_large_image` X card, so a link-only X post shows a still cover rather than an in-feed video. A Player Card is a separate integration with platform-specific validation and cannot be treated as a native uploaded video.

Platform references: [Web Share files and user activation](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share), [TikTok content sharing and watermark rules](https://developers.tiktok.com/docs/en/content-sharing-guidelines), [TikTok direct-post capability](https://developers.tiktok.com/products/content-posting-api), and [LinkedIn link-post guidance](https://www.linkedin.com/help/linkedin/answer/a525301/sharing-articles-or-links?lang=en). Recheck these before introducing direct publishing or changing text assumptions.

## Validation

Run `tests/video-sharing.test.ts` and `tests/media-library-contract.test.ts`, frontend lint and typecheck, then smoke-test the Result modal at desktop and mobile widths. Verify a logged-in generated video with the migration applied before release: create, open, copy, e-mail, deactivate, and refresh its `/s/[token]` page. Public examples should resolve to an existing watch page for visitors.
