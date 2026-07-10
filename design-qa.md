# Workspace density visual QA

## Scope, state, and final captures

The final implementation was exercised as a guest in Playwright Chrome against `http://127.0.0.1:3000` after the whole-branch keyboard, accessibility, stage-geometry, and hit-target review fixes. All four captures use the final overlap-safe layout with settled starter media and live composer data.

| Route | Viewport and state | Source target | Final implementation |
| --- | --- | --- | --- |
| `/app` | 390 × 844; Kling 3 Pro / Pro; curated warrior sample; populated multi-scene prompt | `/Users/adrienmillot/.codex/generated_images/019f486b-af5c-7be2-b74f-e7457586bcd7/exec-ec897e31-e4be-4404-a505-8f562287b964.png` | `output/playwright/workspace-video-mobile-overlap-fix.png` — SHA-256 `a76a5d5cf277600b6ceb4d90e5433c98d51acc6f8d947ac7e3e4ff013e3d42b7` |
| `/app` | 1440 × 1024; Kling 3 Pro / Pro; curated warrior sample; populated multi-scene prompt | `/Users/adrienmillot/.codex/generated_images/019f486b-af5c-7be2-b74f-e7457586bcd7/exec-e8b6d408-809e-4061-b1f4-6d63ef66e7d4.png` | `output/playwright/workspace-video-desktop-overlap-fix.png` — SHA-256 `708179c88915fe6f2cf63225b6b7d33c87733629c37eeb4f33f36b97866189b6` |
| `/app/image` | 390 × 844; Seedream 5.0 Lite; curated camera-rig sample and prompt; `$0.06` quote | `/Users/adrienmillot/.codex/generated_images/019f486b-af5c-7be2-b74f-e7457586bcd7/exec-0c9e7b82-d6cb-45e9-861e-2972c61231c7.png` | `output/playwright/workspace-image-mobile-overlap-fix.png` — SHA-256 `8daf7e2a7453b0d872300b29abb2afb3d515c33cc2035478a2383e7bd0b9e9dc` |
| `/app/image` | 1440 × 1024; Seedream 5.0 Lite; curated camera-rig sample and prompt; `$0.06` quote | `/Users/adrienmillot/.codex/generated_images/019f486b-af5c-7be2-b74f-e7457586bcd7/exec-a1c4bd95-268f-4acc-a7a1-3b7b7317ad70.png` | `output/playwright/workspace-image-desktop-overlap-fix.png` — SHA-256 `ed58b1bb56c1882e9a710fff6a23edd259b60e0535493375970211f6d7e59976` |

Every source and implementation full view was opened together in the same comparison input. Focused source and implementation crops were also opened together after their dimensions and hashes were verified.

## Full-view comparison evidence

| Target | Engine and viewer | Composer and actions | Asset area and first viewport |
| --- | --- | --- | --- |
| Video mobile | The stacked engine/variant header, Browse link, contained warrior frame, sample badge, and compact toolbar preserve the source hierarchy. | Prompt metadata and promoted actions stay legible. Settings remain one intrinsic-width row in a local scroller, with a full-width Generate row immediately below. | Start/End guest locks retain their paired layout and `Sign in to upload` copy. The document itself has no horizontal overflow. |
| Video desktop | Engine/variant controls, independently flowing Browse target, navigation affordances, toolbar, shell rail, and starter cards align with the source structure. The final branch review replaces the independently sized wide frame with a centered exact-16:9 stage derived from the overlap-safe height budget. | Prompt, settings, and Generate occupy the compact source-like rhythm; settings and Generate share one desktop row. | Paired Start/End fields, Negative prompt, and Advanced settings are present. Advanced spans y=985.0625–1021.0625 inside the 1024px target. |
| Image mobile | The engine header, independent Browse target, contained camera image, and five-action toolbar follow the reference composition without cropping or stretching the media. | Prompt, intrinsic settings, and the full-width Generate button retain clear hierarchy. Local settings overflow does not leak to the page. | Reference images spans the available card width, Characters stays aligned, the add target and remaining-slot copy are visible, and Advanced spans y=798–834. |
| Image desktop | Engine/variant controls, contained camera image, toolbar, navigation, promotion, and sample rail preserve the existing product shell and source proportions. | Prompt, settings, and Generate remain one compact desktop action surface. | Reference images uses 850px inside the 884px composer rather than the shared 640px solo cap. Advanced spans y=894–930 within the target. |

The final full-view comparison found no remaining P0, P1, or P2 mismatch. Differences are limited to P3 live-data variation such as current prompt/price text and media-frame timing.

## Focused-region evidence

Genuine source/implementation region crops are stored in `output/playwright/crops-remediation/`:

| Pair | Source crop | Implementation crop |
| --- | --- | --- |
| Video desktop composer, upload locks, Negative prompt, Advanced | `source-video-desktop-composer.png` — 900×458 — SHA-256 `661ca93486ef5d9a7720074b0f577eaa1806f250640aa27adce4b92dd8c66405` | `impl-video-desktop-composer.png` — 876×454 — SHA-256 `b4e5aa859e4ccb4082df9cfde848d347bd6f11e6c236bbf75459e3ca4f929cef` |
| Image desktop composer, Generate, Reference images, Advanced | `source-image-desktop-composer.png` — 900×458 — SHA-256 `5afcead61af7950e5d78e9fbe0b3852b6046f352d8b5c5c394655f2cc577c0d6` | `impl-image-desktop-composer.png` — 884×359 — SHA-256 `3c93e5bde1bd883ac8d542f34ab57fd01c0c0e9f9f7a6eecad0fa8e4a1b8b4c3` |
| Video mobile prompt, settings, Generate, upload locks | `source-video-mobile-composer.png` — 790×744 — SHA-256 `4c34ba1804b3a1ec564e73bced89d9aeee84eb19910a3180c96d76fb00b3862c` | `impl-video-mobile-composer.png` — 358×386 — SHA-256 `55ec8e1a485c35f0cb40c762b75630279cbd905be4db404f79aeb1e4d21d59b2` |
| Image mobile prompt, settings, Generate, Reference images, Advanced | `source-image-mobile-composer.png` — 800×864 — SHA-256 `cfd15fde08e236c687ff691b13a178afdb351dfeb5ea179605a5110f69af5715` | `impl-image-mobile-composer.png` — 358×393 — SHA-256 `3fee163363f7a8062ebd8f418466654d427194722153fda2b77458a2194af4b7` |

The implementation crop dimensions and hashes differ from their 1440×1024 and 390×844 full screenshots. They are true focused regions, not duplicate full captures. Same-input inspection confirms the corrected action, upload, Reference images, and Advanced boundaries.

## Fidelity review

### Fonts and typography

- The existing product font stack is preserved; no replacement typeface was introduced.
- Uppercase engine, prompt, asset, Negative prompt, and Advanced micro-labels retain the source hierarchy, tracking, and muted color.
- Trigger labels use an 11px workspace treatment with enough intrinsic width to remain legible. Prompt copy, helper text, CTA labels, and price pills retain their established weights and contrast.
- Long mobile labels remain complete in their control and scroll into view instead of colliding with adjacent icons or text.

### Spacing and layout rhythm

- Workspace-only preview, toolbar, prompt, settings, asset, and extra-field spacing was tightened while shared/default component density remains unchanged.
- Desktop keeps the compact prompt/settings/Generate rhythm and exposes Advanced inside the target viewport.
- Mobile preserves one settings row and one Generate row. Horizontal movement is contained by the settings scroller and does not alter document width.
- Asset headings, dashed boundaries, lock circles, helper copy, dividers, and card padding maintain consistent alignment across video and image surfaces.

### Colors, tokens, borders, and radii

- Existing surface, border, placeholder, muted-text, brand, warning, disabled, and on-media tokens are retained.
- The dark Generate CTA, white price pill, calm guest-lock treatment, dashed asset boundary, and subtle workspace cards match the established system.
- Existing card/input radii and hairline dividers are preserved; no new visual language or one-off color palette was added.

### Image quality and containment

- Final captures use the real curated warrior and camera-rig media rather than placeholders or recreated assets.
- Video and image previews preserve the full subject and source framing through contained rendering. The video stage measures exactly 16:9, a 16:9 source fills it, and portrait/square sources letterbox without crop or stretch.
- Starter thumbnails and the main selected media stay crisp at both target sizes; toolbar and overlay controls do not obscure the primary subject.

### Copy and content

- Primary labels retain the source intent: Choose engine, Variant, Browse engines, Prompt, Multi-prompt, Storyboard, Generate, Reference images, Characters, Negative prompt, and Advanced settings.
- Guest upload fields say `Sign in to upload`; the rejected `Unavailable` treatment does not appear.
- One price is rendered in the composer. Live quote, sample metadata, and prompt wording may differ from the static source frame and are classified as data variation rather than visual drift.

## Measured geometry and overflow

- Both mobile routes report equal document client/scroll widths (378/378 in headed Chrome, where the visible scrollbar consumes 12px of the 390px viewport).
- Video mobile settings: 330px client width, 675px scroll width, and 345px maximum scroll. Image mobile settings: 330px client width, 528px scroll width, and 198px maximum scroll.
- Short mobile controls retain a 112px minimum. `1080p • Full HD • Pro` measures 195.14px and `Horizontal 16:9` measures 161.66px; labels and icons do not collide.
- Mobile Generate spans x=30–360 (330px) on both routes.
- Image Reference images spans x=29–361 (332px) on mobile and 850px inside the 884px desktop composer.
- At 1440×1024 the final video stage is 561×315.5625px (`1.7777777777777777`, exactly 16/9). Its live media box uses computed `object-fit: contain`. Browser containment geometry is 561×315.5625 for 16:9, 177.50390625×315.5625 for 9:16, and 315.5625×315.5625 for 1:1. The mobile stage is 344×193.5px at the same exact ratio.
- Compact Browse owns an independent 36px flow/hit box with no negative vertical margins. At desktop it spans y=163.5–199.5; at mobile y=167.5–203.5. Engine and variant controls end exactly at Browse top without positive-area intersection, and preview begins 5px after Browse bottom.
- `elementFromPoint` at Browse top+0.5 and bottom−0.5 resolves Browse. Top−0.5 resolves the adjacent Pro/Lite variant, bottom+0.5 resolves the header gap, and preview top+0.5 resolves the preview—not Browse.
- Video desktop Advanced spans y=985.0625–1021.0625; image desktop spans y=894.5–930.5; settled image mobile spans y=798–834.
- Final live checks found no document-level horizontal overflow: desktop client/scroll widths were 1428/1428 in the headed browser and mobile client/scroll widths were 378/378 after accounting for the visible browser scrollbar.

## Primary interaction and behavior checks

### Video workspace

- Opened and closed the engine selector and Browse surface; selected Pro, 4K, and Standard variants.
- Enabled Multi-prompt, edited scene 1, added scene 2, disabled Multi-prompt, and edited the regular prompt.
- Opened and closed Storyboard.
- Selected 9:16, 1:1, and 16:9 settings while preview media remained contained.
- Confirmed the locked resolution control remained natively disabled and did not open programmatically.
- Guest Generate opened the current auth gate; closing with `Maybe later` returned focus to Generate.
- Confirmed Start/End locks display `Sign in to upload`, Advanced exposes seed/lock/shot controls, and exactly one composer price is displayed.

### Image workspace

- Opened and closed the engine selector and Browse surface; selected Lite and Pro variants.
- Selected image count 2, Square 1:1, 4K, and PNG; confirmed the Pro resolution lock remained disabled as expected.
- Edited the prompt and confirmed Generate opened the current auth gate.
- Opened References and its media picker; invoked device upload with an invalid local non-image to verify validation without an external upload; opened Library.
- Opened Characters and confirmed its empty state.
- Expanded Advanced settings and confirmed the AI-watermark control; exactly one composer price is displayed.

### Menus, keyboard, portal, and overflow behavior

- Workspace settings menus render in the document body, remain viewport-visible, and reposition/clamp when the nested horizontal scroller moves.
- Outside click and Escape close an open menu.
- ArrowDown/ArrowDown/Enter keyboard selection changed the image aspect to Square 1:1.
- The final focused keyboard proof opened the 16:9 workspace listbox, moved its highlight with ArrowDown, and pressed Tab. Focus moved normally to the `On` trigger, the old listbox count became zero, and 16:9 remained selected. Space then opened the `On` listbox, proving the departed menu did not handle the competing control's key.
- The open duration trigger had id `_r_1_` and `aria-controls="_r_2_"`; the body-portaled listbox had id `_r_2_` and `aria-labelledby="_r_1_"`.
- Mobile settings scroll locally in one row, Generate remains below, and neither route introduces document-level horizontal overflow.
- Guest/auth route ordering and default settings remain unchanged by the workspace-only density contract.

## Console result

A fresh direct `/app/image` run completed without console errors or warnings attributable to the redesign. The guest `/app` run retained the pre-existing unauthenticated `/api/user/exports/summary` 401 and Stripe local-HTTP warnings. No uncaught runtime exception or remediation-specific console error appeared. A navigation-aborted preflight observed during an earlier rapid multi-route session recovered and did not reproduce in the fresh direct-route run.

## Findings and complete comparison history

1. The initial full/source comparison was blocked by P1/P2 first-viewport density drift: preview docks pushed primary composer content down and the image mobile primary path did not match the target rhythm.
2. A first TDD pass introduced opt-in workspace preview, header, prompt, settings, action, and asset density while retaining shared defaults.
3. A second comparison found the shared 140px select minimum forcing mobile partial overflow. A red contract drove workspace-specific trigger sizing and action-row changes.
4. Independent review rejected that version with three P2s: equal-flex mobile controls caused label/icon collisions; desktop Reference images retained a 640px solo cap and Advanced fell below the video target; two implementation focus artifacts were duplicate full screenshots rather than crops.
5. Remediation began with new failing contracts for intrinsic mobile controls/local scrolling, workspace solo-asset width, source-visible vertical density, and compact workspace preview/toolbars.
6. The implementation replaced equal-flex compression with intrinsic controls inside a local scroller, excluded only workspace solo assets from the shared cap, compacted workspace-only vertical rhythm, and preserved portals, keyboard behavior, defaults, and shared density.
7. Fresh settled captures at all four exact viewports produced the geometry above. Genuine focused crops were regenerated, dimension/hash verified, and opened with their source counterparts.
8. Final full-view and focused comparisons contain no P0/P1/P2 issue. Remaining P3 variation is limited to live starter data, quote values, prompt copy, and media-frame timing.
9. Whole-branch review then found the shared portaled selector could retain document-wide Enter/Space ownership after focus departure, lacked stable trigger/listbox ownership, and sized the workspace video stage with independent width and height.
10. Focused RED contracts drove focus-in dismissal, target-scoped key handling, stable ARIA ids, disabled variant explanations, and a height-budget-derived workspace width that leaves CSS aspect ratio authoritative.
11. Live verification found the restored 36px Browse target initially pushed desktop Advanced below the target viewport. An interim fix used compact negative margins to retain density.
12. Re-review correctly rejected that workaround because the 36px interactive rectangle overlapped the variant row above and preview boundary below, creating a boundary-tap risk.
13. New RED contracts forbade negative Browse margins and assigned density recovery to non-interactive workspace space: 12px from the video height budget, plus 4px preview-toolbar and 8px preview-composer safe gaps on the image route.
14. Exact `getBoundingClientRect`, intersection, and `elementFromPoint` checks at desktop/mobile prove Browse owns an independent 36px target, adjacent regions own their boundary pixels, stages remain contained/exact, Advanced remains visible where required, and documents do not overflow. No P0/P1/P2 remains.

final result: passed
