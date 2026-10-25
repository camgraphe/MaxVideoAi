# Editorial video presentation contract

The controlled YouTube video block is shared by the public blog, authenticated
admin preview and phone reader through `EditorialReader` / `EditorialVisual`.
This change adds two optional data fields; it does not add a new media host or
change article publication/approval permissions.

| Field | Accepted values | Effective value when absent |
| --- | --- | --- |
| `presentation` | `inline`, `disclosure` | `disclosure` |
| `aspectRatio` | `16:9`, `9:16` | `16:9` |

Fields are optional, not nullable. Other values, arbitrary CSS, embed HTML and
unknown keys remain rejected by the strict block schema. Omitted fields stay
omitted after parsing/serialization: old article payloads and their digests must
not acquire explicit defaults. A deliberate addition of an explicit default is
still a content edit with a new digest.

```json
{
  "id": "sequence-result",
  "type": "video",
  "heading": "A sequence to watch",
  "videoId": "abcdefghijk",
  "sourceId": "sequence-source",
  "credit": "Creator",
  "startSeconds": 0,
  "caption": "Describe the actual sequence and its provenance.",
  "presentation": "inline",
  "aspectRatio": "9:16"
}
```

The ID above is a schema example, not a playable asset. `sourceId` must still
resolve to a source whose permitted HTTPS YouTube URL identifies that exact
`videoId`. A local MP4 or arbitrary iframe URL is not supported. The component
is generic across cinema, animation, UGC and other editorial subjects.

In EN/FR/ES bundles the existing video identity, credit and start position must
match, together with the **effective** presentation and ratio. An omitted value
and its explicit default compare equally. A localized title/caption may differ;
turning only one language into an inline or portrait reader fails ingestion.

## Rendering and export

`inline` renders the iframe directly. `disclosure` renders a native closed
`details` with the existing localized summary. The heading, caption and source
attribution remain visible. Neither presentation requests autoplay, hides
YouTube controls or adds playback synchronization. The iframe keeps lazy loading,
fullscreen support and `strict-origin-when-cross-origin`; the private admin path
and query must never be included in its cross-origin Referer.

The frame reserves its declared aspect ratio. Portrait occupies the available
column at viewport widths up to 700 px; above that it is centered and capped at
360 px (640 px tall). At 390 px the current article gutters leave a 354 × 629.33 px
portrait. Landscape retains the article column width. No `object-fit: cover`,
transformed crop or authored-video rewrite is involved. The declared ratio must
describe the real video; an unrelated landscape source in a portrait frame does
not become a portrait asset.

`publicEditorialArticleSchema` reuses the video block schema.
`projectPublicEditorialArticle`, `buildEditorialPreviewFiles` and the approved
publication compiler preserve both options in the sibling `.article.json` files.
The Markdown loader parses those files with the same schema. No schema-version
migration, database migration, authored-content rewrite or image optimizer change
is required. Existing report/approval/digest gates remain in force.

## Automatisation preview handoff (owner applies separately)

No Automatisation file is modified by this candidate. Its independent HTML
renderer must adopt this contract before it can represent an inline/portrait
article faithfully. Inspection on 2026-10-25 found these exact deltas:

1. `editorial/visual-blocks.mjs`, `validateSourceVideo`: accept the two optional
   fields and reject unsupported values, including `null`; retain all existing
   source/ID/start/credit checks. Do not fill absent fields in the returned object.
   Any locale parity checker must compare `(presentation ?? 'disclosure')` and
   `(aspectRatio ?? '16:9')` after strict validation, as the site does.
2. `editorial/pilot-renderer.mjs`, `case 'video'`: build the existing escaped iframe
   once inside a frame wrapper. Render that wrapper directly for `inline`, or
   inside the existing closed `details` otherwise. Keep localized summary/title,
   caption, attribution, lazy loading, fullscreen and origin-only referrer.
3. In `visualCss`, mirror the shared reader's geometry under its own class names:

```css
.source-video-frame iframe {
  display: block; width: 100%; height: auto; aspect-ratio: 16/9;
  border: 0; border-radius: 12px;
}
.source-video-frame.is-portrait { max-width: 360px; margin-inline: auto; }
.source-video-frame.is-portrait iframe { aspect-ratio: 9/16; }
@media (max-width: 700px) {
  .source-video-frame.is-portrait { max-width: none; }
}
```

4. Carry the two fields through any normalization/copy step. Use fixtures for
   old omitted fields, inline landscape, inline portrait, disclosure portrait,
   invalid values and mismatched localized options. Verify JSON export and
   mobile/desktop geometry against the source reader, not just a static opening
   mockup. No change is required to the existing CSP frame host.
5. The inspected preview's `conclusion` branch still omits the React reader's
   existing optional `cta`. Its owner should render the escaped label and its
   validated, locale-specific `href` when present. This is a known preview delta;
   the site CTA/links are not changed in this candidate.

The installed `.local/site-runtime` copy must eventually consume the reviewed
source commit through its normal owner workflow. A preview-only modification is
not a site delivery. Remote resources blocked in local QA cannot establish live
YouTube playback; test an authorized existing embed separately before releasing
a video-led article. Media upload and article publication remain separate actions.

## Reproducible checks

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/editorial-video-presentation.test.ts tests/editorial-video-presentation-browser.test.ts tests/editorial-reader-media.test.ts
EDITORIAL_VIDEO_EVIDENCE_DIR="$PWD/.reports/editorial-video-reader-2026-10-25" pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/editorial-video-presentation-browser.test.ts
```

The browser checks exercise both shared reader entry points in EN/FR/ES at 390
and 1440 px in Chromium and WebKit. Screenshots explicitly identify fixture player
responses. They prove layout/disclosure behavior, not external playback or iOS
device certification. The server is closed even if launching a browser fails;
literal launcher calls keep this file in the CI browser lane.

Local evidence is kept separately under
`.reports/editorial-video-reader-2026-10-25/` (not published or uploaded). The
controlled ABBA legacy comparison uses the same local response fixture before
and after: unchanged closed summary/caption geometry, zero initial iframe
requests, one request after opening and zero CLS at 390/1440 px. The combined
fixture HTML/CSS grows by 222 uncompressed bytes; there is no new client module.
This is a loading-boundary check, not evidence of a field Core Web Vitals gain.

The separate localhost live-embed check uses the already cited MaxVideoAI video
`hwF_A1VlA_U`, with no upload or new generation. WebKit confirmed manual playback:
player state 1, `paused: false`, `readyState: 4`, time 13.8 s after the user gesture.
Chromium loaded the real poster but remained cued at time 0 in this headless
environment; live playback there is not certified by the fixture tests.

The production build and public EN/FR/ES routes pass local smoke checks; their
existing default disclosure also opens with 16:9 geometry under the full site CSS.
The isolated build has no Supabase credentials, so a full authenticated admin
navigation was not established (the local middleware rejects missing auth env).
The actual admin renderer is covered directly, alongside existing access tests.
