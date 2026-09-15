# Generation waiting screen — design QA

final result: passed

## Visual target and evidence

- Selected target: `/Users/adrienmillot/.codex/generated_images/01a0a6c7-5bfb-7fc1-9905-93baf92e1fe0/exec-9bf1ca72-d1df-442b-adc1-858a1e1b891a.png` (the third image in the second ideation set).
- Source: 1677×937 pixels, normalized to 970px wide while preserving aspect ratio.
- Implementation: `output/playwright/companion-light.png` and `companion-dark.png`, 970×547 pixels; captured from the real `CompositePreviewDockTile` in the isolated Next.js fixture at http://127.0.0.1:3219.
- Browser: Codex in-app browser; viewport 1100×760 CSS px, preview 970×546.5 CSS px; full screenshots cropped to the measured preview bounds at 1× density.
- Full-view combined evidence: `output/playwright/companion-design-comparison.png` (source left, implementation right, 1940×547). Viewed together, not inferred from source code.
- State: queued, elapsed clock and 277-second estimate, delayed status refresh. Seconds differ because the implementation clock is live.
- Theme comparison: `output/playwright/companion-themes.png`.

## Findings

No actionable P0/P1/P2 findings remain.

- Typography: existing app sans-serif, dark olive ink, medium/bold heading and tabular numerals reproduce the hierarchy. Small status and refresh text are intentionally more restrained, as requested. Generic “création” keeps the shared audio reader accurate.
- Spacing: character, heading, queue status, paired times and quiet footer retain the selected composition. The live stage does not displace the timer columns. The frame belongs to the existing preview, with no additional nested card.
- Color: background is the existing `--app-panel`; foreground and secondary text use `--app-ink` and `--app-muted`. Dark mode uses the same theme tokens. No cream-colored rectangle is baked into the character asset.
- Artwork: eight ImageGen poses retain the coral pixel silhouette and square eyes. Real alpha transparency checked on both themes. Sprite cells have consistent centers and baselines. Leg poses change independently of horizontal travel; CSS respects reduced motion.
- Copy: retry is “Actualisation du statut en cours…”, overdue is “Le temps de création peut varier.”, as requested. The last confirmed check and actual failure state remain truthful.
- Responsive: 390px viewport and four-take compact tiles have no content scroll overflow. Tiny tiles prioritize status and timers; the normal mobile preview retains the animated character.

## Comparison history

- The earlier gold concept was discarded after user feedback; it is not a fidelity target.
- Initial capture normalization used the browser clip API, which produced an inconsistent scale. These images were replaced with full screenshots cropped at measured DOM coordinates before visual judgment.
- The first valid combined source/implementation comparison showed no substantive issues. Missing decorative lime trail pixels are P3; the character itself is animated and preserves the approved visual identity.

## Interaction verification

- Local completion simulation uses the real preview tile and a local existing video, without paid generation.
- After completion: zero `.processing-overlay` and `.generation-companion` elements; video `readyState=4`, `paused=false`, `currentTime>0`.
- Regression test verifies pending → completed and pending → failed, including cleanup of the display interval.
- Existing generation timing and workspace polling tests retain provider-only percentages, stale-check handling and completion behavior.
- Browser console: no errors or warnings in the final in-app session.
- Light, dark, mobile, multiple-take layouts and the overdue/refresh text were inspected. OS-level reduced-motion emulation and Safari were not run in this session; the component contains an explicit reduced-motion rule.

## Follow-up polish

- Optional P3: add the small lime pixel trail from the mockup to the raster artwork if desired.

## Implementation checklist

- [x] Animated transparent companion, shared theme tokens and compact layouts.
- [x] Neutral retry and overdue messages in EN/FR/ES.
- [x] Real preview completion and clock cleanup verified.
- [x] Matched-view visual comparison and light/dark captures.
