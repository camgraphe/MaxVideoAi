# Video and Image Workspace First-Viewport Conversion Design

## Objective

Make the video and image Workspaces immediately understandable and actionable on a 390 × 844 mobile viewport while preserving the same product experience before and after authentication.

The primary success scenario is:

1. A visitor opens `/app` or `/app/image` on mobile.
2. The visitor can identify the selected engine and variant, inspect the starter preview, read or edit the prompt, understand the route-appropriate core settings, see the exact price, and reach Generate without encountering a different guest-only layout.
3. The visitor selects Generate and the existing authentication gate opens.
4. After authentication, the visitor returns to the same Workspace structure with the existing draft-continuity behavior.
5. The same Generate action continues through the existing pricing, wallet-preflight, top-up, and generation pipeline.

## Scope

This conversion-repair lot includes:

- a denser mobile presentation of the existing engine selector and variant controls;
- a compact mobile preview treatment that keeps the current preview-first mental model;
- denser video- and image-composer presentations on mobile;
- a restrained desktop density pass that preserves the current vertical Workspace order;
- one compact Pro / 4K / Standard variant selector beside the engine selector;
- a discreet Browse engines action in place of the current full-width secondary button;
- an aspect-ratio-safe viewer that prioritizes 16:9 and contains other formats without crop or stretch;
- one prompt-header row containing the dynamic character count, Multi-prompt action, and Storyboard action when those actions are available;
- one desktop row containing all core settings and Generate without wrapping;
- neutral guest upload placeholders without the aggressive Unavailable badge;
- one price presentation, inside the Generate button only;
- responsive behavior that preserves the current desktop Workspace hierarchy and asset-field order;
- equivalent density and control-alignment improvements for `/app/image`, while preserving its image-specific preview actions, reference-images area, and advanced settings;
- focused architecture, component, responsive, and visual-regression coverage.

## Out of Scope

- A guest-specific Workspace layout.
- Reordering the Workspace after login.
- Removing starter samples, preview navigation, playback controls, the latest-renders rail, or the mobile gallery rail.
- Changes to engine selection, mode inference, prompt persistence, draft hydration, authentication, wallet preflight, top-up, checkout, generation submission, polling, or asset uploads.
- Changes to pricing calculations, model catalog data, character limits, or supported settings.
- Changes to image estimation, image generation, image history, image library persistence, or image-reference orchestration.
- Changes to public URLs, localized slugs, canonical URLs, hreflang, JSON-LD, sitemaps, redirects, or route groups.
- A desktop split-view redesign, a new global state layer, or a new modal.
- Removing, hiding, tabbing, or reordering Start frame, End frame, negative-prompt, or advanced-setting fields.
- Adding a second estimated-price label, credit estimate, or price chip outside the Generate button.

## Selected Visual Target

The selected direction is the compact preview-first mobile mockup, refined as follows:

- the existing compact mobile header remains;
- the engine selector and active variant remain above the preview but use less vertical space;
- the starter preview remains before the composer and keeps its core playback/navigation affordances;
- the prompt composer follows immediately after the preview;
- `Prompt` and the live `{count}/{limit}` value form one label group on the left of the composer header;
- Multi-prompt and Storyboard stay on the right of that same header row when they are available;
- the core settings stay readable in one compact mobile row without creating horizontal page overflow;
- the primary action is a wide `Generate {formattedPrice}` button;
- the price appears nowhere else in this surface.

The approved desktop companion preserves the current vertical order and adds:

- an engine selector and compact variant selector on one row;
- a discreet Browse engines text action;
- the current large preview above the composer;
- all five core settings and Generate on one non-wrapping row;
- Start frame and End frame placeholders below that row;
- no Unavailable badge or orange warning treatment for the guest upload lock;
- one subtle `Sign in to upload` prompt per locked placeholder.

The final visual references are:

- video mobile: `exec-ec897e31-e4be-4404-a505-8f562287b964.png`;
- video desktop: `exec-e8b6d408-809e-4061-b1f4-6d63ef66e7d4.png`;
- image mobile: `exec-0c9e7b82-d6cb-45e9-861e-2972c61231c7.png`;
- image desktop: `exec-a1c4bd95-268f-4acc-a7a1-3b7b7317ad70.png`.

They were generated from current `/app` captures at 390 × 844 and 1440 × 1024. They are hierarchy and density targets, not permission to replace dynamic product data with the mock values shown in the images.

## Chosen Approach

Keep one authentication-neutral DOM hierarchy per Workspace and introduce route-controlled responsive density for mobile and desktop through shared presentation contracts.

The Workspace continues to render, in order:

1. notices when present;
2. the optional center gallery when enabled;
3. engine selection and the composite preview;
4. the composer;
5. the existing mobile latest-renders rail outside the main content.

The image Workspace keeps its equivalent route order:

1. engine selection and image preview;
2. status messaging when present;
3. prompt, image settings, and Generate;
4. reference images;
5. image advanced settings;
6. the existing image latest-renders rail.

The conversion improvement comes from reducing avoidable vertical space, not from moving guests into a separate layout or changing the order after login. Desktop retains the current hierarchy and vertical order while receiving tighter engine, composer, and action-row treatment. The responsive presentation must remain stable when authentication state changes.

This approach is preferred over placing the composer before the preview because it preserves the current sample-led Workspace model and avoids a visible reflow for existing users. It is preferred over a desktop preview/composer split because that composition would crowd the real asset placeholders and diverge from the established workflow. It is preferred over a sticky duplicate Generate action because the real prompt, settings, price, and action remain one coherent form. It is preferred over Create/Preview tabs because tabs would hide useful context and introduce new interaction state.

## Responsive Layout

### Mobile target

The blocking design-QA viewport is 390 × 844.

At that viewport:

- the page has no horizontal scrolling;
- engine selection, active variant, preview, prompt controls, and Generate read as one continuous workflow;
- the preview remains a natural 16:9 media surface and is not stretched or cropped to imitate the mockup;
- icon-only preview controls retain accessible names and touch targets;
- the composer reduces padding, gaps, and prompt minimum height only enough to surface the primary action earlier;
- core settings may use a contained horizontal overflow region when all supported controls cannot fit, but the document itself must not overflow horizontally;
- the Generate button is full-width within its mobile action row and displays the localized label plus the existing formatted price;
- conditional asset fields, negative prompt, advanced settings, notices, and validation errors remain below their current logical owners and remain reachable by scrolling.

The target is not a brittle guarantee that every engine configuration fits completely above the fold. Engines with additional workflow notices, validation errors, promoted actions, asset requirements, or unusually long localized labels may require scrolling. The invariant is that default guest and standard authenticated entry states are materially denser and that no required information is hidden or duplicated.

For `/app/image` at the same mobile target:

- Seedream and its variant selector share the compact engine row;
- Browse engines uses the same discreet secondary treatment;
- the image preview remains before the composer and contains square, portrait, landscape, and custom outputs without crop or stretch;
- image count, aspect, resolution, format, quality, and style controls use one contained compact row when present;
- Generate images is full-width below that row and displays the estimated price once;
- Reference images and Advanced settings remain below the composer in their current order.

### Desktop refinement

At the existing desktop breakpoint:

- the current sidebar, main preview, composer, asset placeholders, and latest-renders rail stay in their current vertical and horizontal regions;
- the engine selector and one Pro / 4K / Standard variant selector share one compact row;
- Browse engines is a discreet secondary text action rather than a full-width button;
- the current preview sizing logic and 50-viewport-height cap remain unchanged unless visual QA exposes a regression caused by the mobile classes;
- the default media stage prioritizes 16:9, while portrait, square, and other media use contain behavior with neutral empty space instead of crop, stretch, or forced fill;
- Prompt count, Multi-prompt, and Storyboard share one aligned header row;
- 5s, 1080p, 16:9, Audio, 1x, and Generate share one horizontal action row at 1440 × 1024;
- at narrower desktop widths, that action row remains single-line inside a contained overflow region or uses narrower control widths; it must not make the page overflow horizontally;
- Start frame and End frame remain immediately below the action row;
- guest-locked placeholders omit the Unavailable badge and aggressive warning color while retaining one `Sign in to upload` affordance;
- no authenticated or guest branch changes the layout order.

For `/app/image` on desktop:

- the current vertical engine → preview → composer → references → advanced-settings order remains;
- Seedream and its Lite/Pro variant selector share the same compact engine-row contract as video;
- all currently visible image settings and Generate images share one non-wrapping row at 1440 × 1024;
- Reference images remains immediately below the composer and retains Characters and slot-count behavior;
- the image preview keeps its existing aspect-aware stage and actions.

## Component Boundaries

`AppClient.tsx` remains a route-level orchestrator and does not receive new layout JSX.

`WorkspaceAppShell.tsx` keeps ownership of the route shell and surface order. It must not branch on `user`, `session`, or `authStatus` to choose a layout.

`WorkspacePreviewDock.tsx` remains the route-local owner of the engine-settings composition around `CompositePreviewDock`. It may select a compact mobile presentation through explicit presentation props, but it must not own authentication or generation state.

The shared engine selector may expose an explicit compact variant-control presentation. The variant values and engine-mode handlers remain derived from the current engine contract; the UI must not create a second mode state.

`WorkspaceComposerSurface.tsx` remains the video-route owner of composer composition. It opts the shared `Composer` into the compact Workspace mobile treatment rather than duplicating the composer.

`ImageWorkspace.tsx` remains the image route orchestrator. It does not receive new inline layout helpers.

`image/_components/ImageWorkspaceComposerSurface.tsx` remains the owner of image preview, engine-control composition, image settings, shared composer configuration, and the image form. It opts into the same shared compact engine and composer contracts while keeping image-only controls and copy.

`ImageSettingsBar.tsx` remains the image-specific settings owner and may expose a compact, non-wrapping presentation contract parallel to `CoreSettingsBar`.

The shared `Composer` and preview primitives may accept narrowly scoped presentation props or responsive class changes. Those changes must preserve their default behavior for image, audio, and other consumers.

Asset-field components may distinguish the guest authentication lock from genuine engine unavailability for presentation only. Required-field semantics, upload handlers, disabled behavior, and authenticated states remain unchanged.

The shared density props must be opt-in. Other `Composer`, `EngineSelect`, `CoreSettingsBar`, and `ImageSettingsBar` consumers retain their current default presentation.

No server module, database module, payment module, or route handler is added to the client dependency graph.

## Prompt Header Contract

The prompt header has three conceptual regions:

```txt
[Prompt {current}/{limit}] [Multi-prompt] [Storyboard]
```

- The character count remains derived from the selected engine's real `promptMaxChars` value.
- No `2500` or `5000` limit is hardcoded in layout code.
- Multi-prompt renders only when the existing multi-prompt contract is supplied.
- Storyboard renders only for the existing supported engines.
- The buttons retain their current handlers, disabled state, tooltip, pressed state, and keyboard behavior.
- The counter is rendered once; it is not duplicated inside the textarea.
- At 390px, the supported Kling/Storyboard combination should fit on one header row with compact spacing.
- At narrower widths or with longer localized labels, the header may wrap without clipping or causing document overflow.

## Price and Generate Contract

The existing formatted price remains the single source of displayed price truth.

- When pricing is available, the button renders `Generate` and the formatted price once.
- While pricing is loading, the current loading label and disabled behavior remain unchanged.
- When price is unavailable, the button keeps the current label without inventing a fallback amount.
- Member discount messaging remains governed by the current preflight response and is not replaced by a duplicate estimate.
- No separate `Estimated price`, credit conversion, or amount summary is added beside or above the button.
- Generate continues to call the existing `startRender` handler exactly once.
- Generate images continues to call the existing image `handleRun` path exactly once.

On desktop, the core-setting controls and Generate remain one logical row. The row must not wrap at the 1440 × 1024 target. A contained horizontal overflow fallback is acceptable at narrower desktop widths, but a second settings line is not.

The same single-price rule applies to Generate images: the image estimate is formatted once inside the button, with no adjacent estimate or credits duplicate.

## Viewer Aspect-Ratio Contract

The preview remains primarily optimized for 16:9 output.

- A 16:9 group fills the intended 16:9 media stage without distortion.
- Portrait, square, and other supported aspect ratios are centered with contain behavior.
- Media must never be stretched to 16:9 or cropped merely to fill the stage.
- Neutral letterboxing is acceptable and preferable to content loss.
- Preview controls, guided-sample navigation, modal opening, download, autoplay, mute, loop, and ready-state behavior remain unchanged.
- The implementation derives aspect behavior from existing group/item metadata or natural media dimensions; it does not add a user-facing aspect toggle to the viewer.
- `ImageCompositePreviewDock` keeps its current entry-derived CSS aspect ratio and `object-contain` behavior; the lot must not regress it while compacting the surrounding engine controls.

## Guest Asset-Placeholder Contract

Guest upload locks remain functional but use calmer presentation.

- Start frame and End frame remain visible, sized, and ordered as today.
- The word `Unavailable` is not shown for the guest authentication lock.
- Orange warning styling is not used merely because the visitor is logged out.
- One subtle `Sign in to upload` affordance is sufficient for each locked field.
- Genuine engine or workflow unavailability may retain its existing distinct disabled explanation where applicable.
- Authentication, upload, library, field validation, and required-asset behavior remain unchanged.

## Authentication and Funnel Continuity

The layout is independent of authentication state.

- Guests and authenticated users receive the same surface order and density at the same viewport.
- Generate without a valid session continues to open `WorkspaceAuthGateModal`.
- Login and signup targets continue to use the current sanitized Workspace return target.
- Existing draft storage and prompt hydration remain authoritative.
- Existing image-composer persistence and query hydration remain authoritative on `/app/image`.
- No automatic generation occurs after login.
- After authentication, pricing and wallet checks continue through the existing hooks.
- Insufficient funds continue to open the existing top-up flow from the preceding checkout-unification lot.
- Image generation continues to use its current authentication and estimation flow; this lot does not route image generation through the video wallet-preflight hook.

## Accessibility

- Existing semantic labels and button names remain intact.
- Compact controls must keep usable touch targets; visual density must not collapse interactive targets below the project's current button primitives.
- Keyboard focus order follows DOM order: engine, preview actions, prompt actions, prompt, settings, Generate, then secondary fields.
- Focus rings must not be clipped by newly reduced padding or overflow containers.
- Horizontal control scrolling, if used, must remain keyboard- and touch-scrollable.
- Text must not be embedded in raster assets; all UI text remains real localized content.

## SEO, Routing, and Localization Safety

This lot changes only responsive client presentation inside the existing Workspace.

It preserves:

- `/app` and all existing query parameters;
- `/app/image` and all existing image-workspace query parameters;
- `/login`, `/billing`, and the current authentication return contract;
- all public and localized marketing routes;
- canonical, hreflang, JSON-LD, robots, and sitemap behavior;
- current engine labels, prompt placeholders, button copy, and price formatting;
- current English, French, and Spanish lookup behavior without adding required English-only copy.

No metadata file, sitemap builder, redirect, middleware rule, API route, or database schema is changed.

## Testing Strategy

Implementation follows red-green-refactor.

Required automated coverage:

1. The Workspace shell preserves preview-before-composer order and does not branch on authentication state for layout.
2. The video Workspace opts into the compact mobile composer treatment while other shared-composer consumers retain the default.
3. The prompt header renders the dynamic count and the available Multi-prompt and Storyboard actions in one compact header owner without duplicating the count.
4. The formatted price is rendered only in the Generate button for the selected Workspace treatment.
5. The compact variant selector exposes the existing Pro, 4K, and Standard modes without creating duplicate mode state.
6. The desktop core controls and Generate use a non-wrapping row at the target breakpoint.
7. The preview uses aspect-safe contain behavior for non-16:9 media without changing preview interactions.
8. Guest asset locks omit the Unavailable badge and aggressive warning styling while preserving disabled behavior and the sign-in affordance.
9. The image Workspace opts into compact engine and composer density without moving image orchestration into `ImageWorkspace.tsx`.
10. Image settings and Generate images stay on one desktop row and use a contained compact mobile row.
11. Image preview containment, references, Characters action, persistence, pricing estimate, auth gate, history, and advanced settings remain intact.
12. Existing generation, auth-gate, draft, pricing, wallet-preflight, preview, asset, and Workspace architecture contracts remain green.
13. TypeScript, lint, exposure lint, full validation, production build, and `git diff --check` pass.

Manual and visual coverage:

- capture the current and implemented guest Workspace at 390 × 844 using the approved Playwright browser workflow;
- compare the implementation and approved mockup in the same visual QA input;
- verify engine selection, sample navigation, prompt editing, Multi-prompt, Storyboard, core settings, Generate-to-auth-gate, and no horizontal page overflow;
- capture 1440 × 1024 and verify the compact variant selector, discreet Browse engines action, non-wrapping settings/action row, retained asset placeholders, and unchanged latest-renders rail;
- open representative 16:9, portrait, and square previews and verify contain behavior without crop or stretch;
- repeat mobile and desktop captures on `/app/image`, including a non-16:9 image, reference-images access, Characters, image settings, Generate-to-auth-gate, and Advanced settings;
- verify the primary action remains reachable with default data after the page settles;
- record all findings in `design-qa.md` and require `final result: passed` before handoff.

## Acceptance Criteria

- At 390 × 844, the current default guest Workspace is materially denser and exposes the creation flow earlier without a guest-only layout.
- Logging in does not reorder the Workspace.
- The preview remains before the composer on mobile and desktop.
- Prompt count, Multi-prompt, and Storyboard share one header row at the target Kling state.
- The prompt limit remains dynamic per engine.
- The price appears exactly once, inside the Generate button.
- The desktop engine row uses one compact Pro / 4K / Standard selector and one discreet Browse engines action.
- Desktop core settings and Generate remain on one row at 1440 × 1024.
- Non-16:9 previews are contained without crop or stretch.
- Guest Start/End-frame placeholders keep the sign-in affordance without the Unavailable badge or aggressive warning treatment.
- Start frame, End frame, negative prompt, and advanced settings remain in their existing order.
- Generate Image uses the same compact engine/variant/Browse hierarchy without receiving video-only controls.
- Image settings and Generate images share one desktop row, while mobile controls remain contained without page overflow.
- Image preview, Reference images, Characters, and Advanced settings retain their current behavior and order.
- Image price appears exactly once inside Generate images.
- Generate preserves the existing authentication, pricing, wallet, top-up, and generation behavior.
- The document has no horizontal overflow at the target viewport.
- Desktop presentation remains functionally stable and retains its current vertical hierarchy.
- No public route, SEO output, payment endpoint, database contract, or localization route is changed.
- Automated verification passes and `design-qa.md` ends with `final result: passed`.
