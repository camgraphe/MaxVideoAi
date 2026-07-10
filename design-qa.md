# Workspace density visual QA

## Scope and final captures

The final implementation was exercised as a guest in the authorized Playwright Chrome session against the local development server at `http://127.0.0.1:3000`. The required settled captures are:

| Route | Viewport | Source target | Final implementation |
| --- | --- | --- | --- |
| `/app` | 390 × 844 | `/Users/adrienmillot/.codex/generated_images/019f486b-af5c-7be2-b74f-e7457586bcd7/exec-ec897e31-e4be-4404-a505-8f562287b964.png` | `output/playwright/workspace-video-mobile.png` |
| `/app` | 1440 × 1024 | `/Users/adrienmillot/.codex/generated_images/019f486b-af5c-7be2-b74f-e7457586bcd7/exec-e8b6d408-809e-4061-b1f4-6d63ef66e7d4.png` | `output/playwright/workspace-video-desktop.png` |
| `/app/image` | 390 × 844 | `/Users/adrienmillot/.codex/generated_images/019f486b-af5c-7be2-b74f-e7457586bcd7/exec-0c9e7b82-d6cb-45e9-861e-2972c61231c7.png` | `output/playwright/workspace-image-mobile.png` |
| `/app/image` | 1440 × 1024 | `/Users/adrienmillot/.codex/generated_images/019f486b-af5c-7be2-b74f-e7457586bcd7/exec-a1c4bd95-268f-4acc-a7a1-3b7b7317ad70.png` | `output/playwright/workspace-image-desktop.png` |

Video captures use Kling 3 Pro / Pro, the curated warrior sample, the populated multi-scene prompt, and the `$1.10` quote. Image captures use Seedream 5.0 Lite, the curated camera-rig sample, and the `$0.06` quote. The source PNGs and corresponding final captures were opened together in the same comparison inputs, first as full views and then as focused crops.

## Full-view evidence

- Engine header: the compact engine and variant controls, Browse placement, borders, radii, and label hierarchy match at both widths.
- Viewer: the first-viewport preview footprint now tracks the source. Final media remains contained rather than cropped or stretched. Runtime inspection reported `object-fit: contain` for video and image previews.
- Composer: desktop settings and Generate share one row; mobile exposes the entire settings row and Generate without document overflow. The primary controls remain in the same visual and DOM order for guest and authenticated states.
- Upload/reference area: guest video locks visibly say `Sign in to upload`; image reference heading, Characters action, and add target enter the first mobile viewport and remain fully laid out on desktop.
- Rail and shell: desktop navigation, content rail, sample cards, and side promotion retain the repository's existing tokens and proportions.

## Focused-region evidence

Focused source/implementation pairs were generated under `output/playwright/comparison/` and reviewed together:

- Engine and viewer: `video-mobile-engine-viewer-source.png` with `video-mobile-engine-viewer-impl.png`; `image-mobile-engine-viewer-source.png` with `image-mobile-engine-viewer-impl.png`.
- Action row: `video-mobile-action-source.png` with `video-mobile-action-impl.png`; `image-mobile-action-reference-source.png` with `image-mobile-action-reference-impl.png`.
- Upload locks: `video-desktop-upload-source.png` with `video-desktop-upload-impl.png` confirms calm, paired guest lock fields and no `Unavailable` copy.
- Reference region: `image-desktop-action-reference-source.png` with `image-desktop-action-reference-impl.png` confirms the prompt/settings/Generate row, Reference images, Characters, add affordance, remaining-slot copy, and divider hierarchy.

## Fidelity review

- Fonts and typography: existing product typography is preserved. Uppercase micro-labels, prompt metadata, button weights, muted helper text, and price pills follow the source hierarchy.
- Spacing and layout: workspace-only preview, prompt, settings, action, and asset density were tightened. Shared/default component density is unchanged. The final mobile settings geometry is fully inside the 378px content viewport: video controls span x=30–348 and image controls x=30–348.
- Colors and tokens: surface, border, muted text, dark CTA, disabled CTA, and lock treatments continue to use the existing design tokens. No new visual language was introduced.
- Image fidelity: curated source media is used directly. The image preview is letterboxed when its aspect demands it, and the video preview preserves its full frame.
- Copy: primary labels match the source intent. Dynamic sample prompt frames and live quote values may differ from a static source frame; this is expected application data, not layout drift.

## Interaction and behavior checks

- Video engine menu opened and closed; Browse opened and closed; Pro, 4K, and Standard variants were selected.
- Multi-prompt was enabled, scenes were edited/added, and it was disabled again; regular prompt editing and Storyboard were exercised.
- Video settings selected 9:16, 1:1, and 16:9. The locked resolution trigger remained natively disabled and did not open programmatically.
- Guest video Generate opened the current auth gate; closing it returned focus to Generate. Only one composer price was rendered.
- Image engine menu, Browse, Lite/Pro variants, count, aspect, resolution, format, prompt, Generate-to-auth-gate, References, device upload validation, Library, Characters, and Advanced settings were exercised.
- Settings menus are body-portaled, stay viewport-visible, reposition when their nested horizontal scroller moves, close on outside click and Escape, and support ArrowDown/Enter selection.
- At 390 × 844, both routes reported `document.documentElement.scrollWidth === document.documentElement.clientWidth === 378`; all final settings triggers remained within x=30–348.

## Console result

A fresh direct `/app/image` session completed with 0 console errors and 0 warnings. The guest `/app` session produced the pre-existing unauthenticated `401` response for `/api/user/exports/summary` plus Stripe's local-HTTP warnings; no uncaught runtime exception or redesign-specific console error was observed. One navigation-aborted image preflight in the long multi-route session recovered immediately and was absent in the fresh direct-route console run.

## Findings and comparison history

1. Initial comparison was blocked by P1/P2 first-viewport density drift: preview docks were too tall, image prompt/action content ran below the target viewport, and desktop assets were pushed down.
2. The first TDD iteration added an opt-in workspace density contract and reduced preview/header/prompt/asset spacing without changing shared defaults.
3. The second paired comparison found a remaining P2: mobile settings inherited the shared 140px select minimum. A failing contract was added, then workspace-only flex sizing and action-row padding were implemented. All controls now fit the mobile row.
4. Final full and focused comparisons found no P0, P1, or P2 issue. Remaining P3 differences are limited to live sample-frame timing, dynamic starter copy/data, and slightly denser mobile trigger labels; accessible labels remain complete.

final result: passed
