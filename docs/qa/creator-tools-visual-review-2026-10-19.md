# Creator tools visual review — 2026-10-19

The five creator tools were redesigned after product feedback rejected the first
schematic presentation. This revision is implemented in the actual React surfaces,
with EN/FR/ES copy, authored presentation artwork, the existing MaxVideoAI brand,
responsive controls, and connected Media/Studio components. User visual acceptance
is still pending. Public activation and creator-profile qualification remain closed.

## Scope and review environment

The local review at `http://127.0.0.1:54870/` exposes all five tools, app/marketing
views, initial/result states, three languages and a mobile viewport. It mounts
the real HeaderBar, AppSidebar, MarketingNav, AssetLibraryBrowser,
MediaDestinationActions and lazy StudioMediaAction. Session, Next routing and
API boundaries use local doubles. The banner identifies simulated account/actions.
The Subtitles page now uses a real Wan 3 source and three real subtitle exports;
the single source generation was approved at USD 0.78. Fixture actions make no
provider requests, charges or production writes and do not validate genuine auth.

Browser/IAB was unavailable because local browser use is disabled in Work
settings. The fallback was isolated Playwright Chromium. The review server is a
temporary local process; these URLs are not a deployment.

## Visual evidence and comparison ledger

Generated concepts and source artwork are stored locally under
`/Users/adrienmillot/.codex/generated_images/01a1541a-18c5-7263-a11a-6e34cbe5ca73/`:

- Workspace: `exec-2d9299a4-3e20-45eb-b2a5-89d199f9f749.png`.
- Marketing hero: `exec-7cac41db-30e9-4590-afb8-881de0003c7a.png`.
- Marketing continuation: `exec-9cc36f23-7340-43a2-bae5-7bf8f01df313.png`.

Final browser evidence is local under `/tmp/five-tools-review/`:

- `final-marketing-1536.png`, `final-marketing-390.png`.
- `final-{toolId}-{1440,390}.png` for all five initial app screens.
- `final-result.png` for the photo Media → quote → result flow.
- `final-checks.json`, `loading-before.json`, `loading-after.json`,
  `loading-final-integrated.json`, `build.log`, `lint.log`.

Concepts and actual renders were inspected with `view_image`. Marketing was
checked at the concepts' native 1536px width and at 390px mobile; app screens
were checked at 1440px and 390px. The comparison covered:

| Point | Implementation and repair | Deliberate differences |
| --- | --- | --- |
| Composition | Editorial hero, dominant 3:2 art, open workflow rows and dark continuation band. App uses a 330px control rail and large preview. | Full landscape art is preserved in the paired scene examples instead of clipping the product into portrait frames. |
| Typography | Local Geist, explicit title/body/control scales, compact app titles, deliberate mobile line breaks. Font preloading removes the measured fixture font-swap shift. | Existing application typography and navigation remain integrated. |
| Brand and palette | Actual MaxVideoAI mark and navigation, cream/bronze application tokens, neutral marketing surface. | The generated concept's invented wordmark/header is replaced by the existing product identity. |
| Artwork | Five separately generated editorial images, responsive WebP variants, reserved dimensions. Subtitles has a distinct real dialogue video in its result section. | Still artwork remains labelled as presentation. The three subtitle examples are actual exported MP4s; other tools' examples remain presentation art. |
| Copy and action hierarchy | Outcome-first localized copy, source roles, three stages, useful empty states. Download and Studio lead the result footer; other transforms are grouped. | “Bientôt disponible” and the generic price footer were removed from all five presentations. Concrete action links are shown; route and execution gates remain separate. |
| Responsive behavior | Source precedes preview and settings on mobile; optional references and advanced settings are collapsed. No horizontal overflow in the tested widths. | Desktop two-column sections stack in reading order rather than shrinking the desktop composition. |

Above-fold copy was checked against the localized sources. Recorded differences
from the generated concepts are the real navigation labels, more precise source
and result wording, truthful artwork captions, and concrete tool CTAs. No invented
customer metrics, testimonials or performance promises were added. The rendered
direction was checked for fidelity to the generated references with these
documented product constraints; this is not a claim of user design approval.

## Interaction and engineering checks

- Integrated app sweep: all five FR initial states at 390px and 1440px, decoded
  artwork, no page errors or horizontal overflow.
- Real Media picker → image selection → prompt → price → confirmation → completed
  result; actual Studio picker → film selection → apply, against local API doubles.
- Actual subtitle editing and save advances the displayed saved revision.
- Focused DOM/browser suites cover all three locales, input validation, progressive
  settings, price invalidation, recovery, subtitle editing, public gates and
  marketing controls. Shared result-footer tests retain the default Media behavior
  and verify the creator presentation uses the exact original media reference.
- Production build including prebuild and sitemap passed. TypeScript, exposure
  lint and diff checks passed. Full frontend lint: zero errors, six pre-existing
  warnings. Paid provider quality and real authentication are not covered by this
  review environment.

## Loading observations

Three runs per width in unthrottled local Chromium, fixed 1000px viewport height:

| Fixture | 390px median LCP / CLS | 1440px median LCP / CLS |
| --- | --- | --- |
| Previous schematic surface | 20ms / 0 | 20ms / 0 |
| Authored art before final font preload | 28ms / 0.01464 | 28ms / 0.00147 |
| Final integrated brand/navigation surface | 36ms / 0 | 36ms / 0 |

The original and intermediate fixtures isolate the presentation change. The final
fixture also adds actual navigation, so it is a smoke measurement rather than a
controlled performance comparison. There is no field Core Web Vitals or production
performance claim. New visual bytes are intentional: the photo hero transfers
about 70KB at mobile and 134KB at desktop; native lazy loading may also fetch
nearby lower-page artwork. All art variants together occupy about 1.8MB on disk.
Fixed geometry, responsive sources and lazy lower-page images are preserved.
The final local runs show no layout shift or overflow. Production network and
device measurements remain part of release review.

See [qualification record](../engineering/creator-tools-qualification.md) for
provider, worker, migration, MCP-host and deployment requirements.

## Real subtitle result follow-up

The approved Wan 3 scene is a 12-second English dialogue, 854×480 at 30fps with
native audio. Local Whisper supplied word timings. The actual worker renderer
created Pop, Cinema and Contrast versions with the shared editor overlay, retaining
audio and measured duration (12,033ms against the 12,028ms source). Provenance and
immutable files are under `frontend/public/assets/tools/subtitle-demo`.

The result section no longer repeats the hero image. Manual playback loads no MP4
before Play. Decoded-pixel checks distinguish Pop and Cinema, and changing style
preserves time and play/pause state. Original comparison and download point at the
selected exact file. Play, pause, seek, mute and fullscreen controls are exercised
in Chromium. Controls sit below the video to keep mobile captions unobstructed.

Local screenshots `subtitles-result-{390,1536}.png`,
`subtitles-page-{390,1536}.png` and `subtitles-editor-{390,1536}.png` under
`/tmp/five-tools-review` show the integrated navigation and real scene. The CTA
reaches the actual editor component using local API doubles; no overflow or page
errors were observed. Paid Scribe transcription and live authenticated exports
remain outside this evidence. No new field performance claim is made.
