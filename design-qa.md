# Workspace density visual QA

## Scope and final captures

The implementation was exercised as a guest in Playwright Chrome against `http://127.0.0.1:3000` after the independent-review remediation.

| Route | Viewport | Source target | Final implementation |
| --- | --- | --- | --- |
| `/app` | 390 × 844 | `/Users/adrienmillot/.codex/generated_images/019f486b-af5c-7be2-b74f-e7457586bcd7/exec-ec897e31-e4be-4404-a505-8f562287b964.png` | `output/playwright/workspace-video-mobile-remediation.png` |
| `/app` | 1440 × 1024 | `/Users/adrienmillot/.codex/generated_images/019f486b-af5c-7be2-b74f-e7457586bcd7/exec-e8b6d408-809e-4061-b1f4-6d63ef66e7d4.png` | `output/playwright/workspace-video-desktop-remediation.png` |
| `/app/image` | 390 × 844 | `/Users/adrienmillot/.codex/generated_images/019f486b-af5c-7be2-b74f-e7457586bcd7/exec-0c9e7b82-d6cb-45e9-861e-2972c61231c7.png` | `output/playwright/workspace-image-mobile-remediation.png` |
| `/app/image` | 1440 × 1024 | `/Users/adrienmillot/.codex/generated_images/019f486b-af5c-7be2-b74f-e7457586bcd7/exec-a1c4bd95-268f-4acc-a7a1-3b7b7317ad70.png` | `output/playwright/workspace-image-desktop-remediation.png` |

Video captures use Kling 3 Pro / Pro and the curated warrior sample. Image captures use Seedream 5.0 Lite and the curated camera-rig sample. The full views were reviewed alongside the corresponding sources.

## Measured browser evidence

- Both mobile routes report `documentElement.scrollWidth === documentElement.clientWidth === 390`; there is no document-level horizontal overflow.
- Video mobile settings use a 330px local scroller for 675px of intrinsic content (`max scrollLeft = 345`). Image mobile uses 330px for 528px (`max scrollLeft = 198`).
- Mobile triggers no longer use equal-flex compression: short controls retain a 112px minimum and long labels retain their intrinsic width (`1080p • Full HD • Pro` = 195.14px; `Horizontal 16:9` = 161.66px). The initial visible labels are readable and do not collide.
- Mobile Generate stays on the row below settings and spans x=30–360 (330px) on both routes.
- Image Reference images spans x=29–361 (332px) on mobile. At 1440px it is 850px wide inside the 884px composer, using the complete available inner width instead of the shared 640px solo cap.
- Video desktop Advanced settings spans y=985–1021 at 1440×1024. Image desktop spans y=894–930. Image mobile spans y=804.25–840.25 at 390×844. The source-visible Advanced control is therefore present in each required target viewport.
- Desktop settings and Generate remain on one row. Guest upload locks remain paired, calm, and labeled `Sign in to upload`.

## Focused-region evidence

Genuine source/implementation region crops are in `output/playwright/crops-remediation/`:

| Pair | Source dimensions / SHA-256 | Implementation dimensions / SHA-256 |
| --- | --- | --- |
| Video desktop composer | 900×458 / `661ca93486ef5d9a7720074b0f577eaa1806f250640aa27adce4b92dd8c66405` | 876×454 / `b4e5aa859e4ccb4082df9cfde848d347bd6f11e6c236bbf75459e3ca4f929cef` |
| Image desktop composer/reference | 900×458 / `5afcead61af7950e5d78e9fbe0b3852b6046f352d8b5c5c394655f2cc577c0d6` | 884×359 / `3c93e5bde1bd883ac8d542f34ab57fd01c0c0e9f9f7a6eecad0fa8e4a1b8b4c3` |
| Video mobile composer/action | 790×744 / `4c34ba1804b3a1ec564e73bced89d9aeee84eb19910a3180c96d76fb00b3862c` | 358×386 / `55ec8e1a485c35f0cb40c762b75630279cbd905be4db404f79aeb1e4d21d59b2` |
| Image mobile composer/reference | 800×864 / `cfd15fde08e236c687ff691b13a178afdb351dfeb5ea179605a5110f69af5715` | 358×393 / `3fee163363f7a8062ebd8f418466654d427194722153fda2b77458a2194af4b7` |

The implementation crop dimensions and hashes differ from the full 1440×1024 / 390×844 screenshots, proving they are cropped regions rather than duplicate full captures. Each pair was opened together and reviewed. No P0/P1/P2 mismatch remains.

## Interaction and behavior checks

- Previous authorized coverage remains valid: engine/Browse menus, variant selection, multi-prompt, Storyboard, Generate auth gate, asset/library/Characters flows, and Advanced settings were exercised.
- Workspace menus remain body-portaled, viewport-clamped, reposition with the nested horizontal scroller, close on outside click and Escape, and support ArrowDown/Enter selection.
- Locked resolution remains natively disabled. Guest/auth ordering and defaults are unchanged. One composer price is rendered.

## Console result

No uncaught runtime exception or remediation-specific console error appeared. The guest `/app` run retains the pre-existing `/api/user/exports/summary` 401 and Stripe local-HTTP warnings. The fresh `/app/image` run has no redesign-specific warning.

## Findings and comparison history

1. Initial comparison found first-viewport density drift and drove the opt-in workspace preview/composer density contract.
2. A second comparison found the shared select minimum and drove the original compact action-row work.
3. Independent review reopened QA with three P2s: equal-flex mobile label collisions; a 640px desktop reference cap plus hidden Advanced settings; and duplicate full screenshots presented as focused crops.
4. TDD remediation replaced equal-flex controls with intrinsic workspace controls inside a local scroller, excluded workspace solo assets from the shared 640px cap, compacted workspace-only preview/toolbar and composer vertical rhythm, and regenerated verified region crops.
5. Fresh full-view and same-input focused comparisons show no remaining P0/P1/P2 issue. P3 differences are limited to live sample data, price values, and media-frame timing.

final result: passed
