# Workspace First-Viewport Conversion Design

## Objective

Make the video Workspace immediately understandable and actionable on a 390 × 844 mobile viewport while preserving the same product experience before and after authentication.

The primary success scenario is:

1. A visitor opens `/app` on mobile.
2. The visitor can identify the selected engine, inspect the starter preview, read or edit the prompt, understand the core settings, see the exact price, and reach Generate without encountering a different guest-only layout.
3. The visitor selects Generate and the existing authentication gate opens.
4. After authentication, the visitor returns to the same Workspace structure with the existing draft-continuity behavior.
5. The same Generate action continues through the existing pricing, wallet-preflight, top-up, and generation pipeline.

## Scope

This conversion-repair lot includes:

- a denser mobile presentation of the existing engine selector and variant controls;
- a compact mobile preview treatment that keeps the current preview-first mental model;
- a denser video-composer presentation on mobile;
- one prompt-header row containing the dynamic character count, Multi-prompt action, and Storyboard action when those actions are available;
- one price presentation, inside the Generate button only;
- responsive behavior that preserves the current desktop Workspace hierarchy;
- focused architecture, component, responsive, and visual-regression coverage.

## Out of Scope

- A guest-specific Workspace layout.
- Reordering the Workspace after login.
- Removing starter samples, preview navigation, playback controls, the latest-renders rail, or the mobile gallery rail.
- Changes to engine selection, mode inference, prompt persistence, draft hydration, authentication, wallet preflight, top-up, checkout, generation submission, polling, or asset uploads.
- Changes to pricing calculations, model catalog data, character limits, or supported settings.
- Changes to public URLs, localized slugs, canonical URLs, hreflang, JSON-LD, sitemaps, redirects, or route groups.
- A desktop redesign, a new global state layer, or a new modal.
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

The final visual reference is the approved Image Gen result `exec-ec897e31-e4be-4404-a505-8f562287b964.png`, generated from the current `/app` captures at 390 × 844 and 1440 × 1024. It is a hierarchy and density target, not permission to replace dynamic product data with the mock values shown in the image.

## Chosen Approach

Keep one authentication-neutral DOM hierarchy and introduce a route-controlled compact mobile density.

The Workspace continues to render, in order:

1. notices when present;
2. the optional center gallery when enabled;
3. engine selection and the composite preview;
4. the composer;
5. the existing mobile latest-renders rail outside the main content.

The conversion improvement comes from reducing avoidable vertical space, not from moving guests into a separate layout or changing the order after login. Desktop retains the current spacing and hierarchy. The compact treatment applies at the existing non-desktop Workspace breakpoint and must remain stable when authentication state changes.

This approach is preferred over placing the composer before the preview because it preserves the current sample-led Workspace model and avoids a visible reflow for existing users. It is preferred over a sticky duplicate Generate action because the real prompt, settings, price, and action remain one coherent form. It is preferred over Create/Preview tabs because tabs would hide useful context and introduce new interaction state.

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

### Desktop preservation

At the existing desktop breakpoint:

- the current sidebar, main preview, composer, and latest-renders rail proportions remain intact;
- the current preview sizing logic and 50-viewport-height cap remain unchanged unless visual QA exposes a regression caused by the mobile classes;
- full desktop labels, spacing, and control density remain the default;
- no authenticated or guest branch changes the layout order.

## Component Boundaries

`AppClient.tsx` remains a route-level orchestrator and does not receive new layout JSX.

`WorkspaceAppShell.tsx` keeps ownership of the route shell and surface order. It must not branch on `user`, `session`, or `authStatus` to choose a layout.

`WorkspacePreviewDock.tsx` remains the route-local owner of the engine-settings composition around `CompositePreviewDock`. It may select a compact mobile presentation through explicit presentation props, but it must not own authentication or generation state.

`WorkspaceComposerSurface.tsx` remains the video-route owner of composer composition. It opts the shared `Composer` into the compact Workspace mobile treatment rather than duplicating the composer.

The shared `Composer` and preview primitives may accept narrowly scoped presentation props or responsive class changes. Those changes must preserve their default behavior for image, audio, and other consumers.

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

## Authentication and Funnel Continuity

The layout is independent of authentication state.

- Guests and authenticated users receive the same surface order and density at the same viewport.
- Generate without a valid session continues to open `WorkspaceAuthGateModal`.
- Login and signup targets continue to use the current sanitized Workspace return target.
- Existing draft storage and prompt hydration remain authoritative.
- No automatic generation occurs after login.
- After authentication, pricing and wallet checks continue through the existing hooks.
- Insufficient funds continue to open the existing top-up flow from the preceding checkout-unification lot.

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
5. Existing generation, auth-gate, draft, pricing, wallet-preflight, preview, and Workspace architecture contracts remain green.
6. TypeScript, lint, exposure lint, full validation, production build, and `git diff --check` pass.

Manual and visual coverage:

- capture the current and implemented guest Workspace at 390 × 844 using the approved Playwright browser workflow;
- compare the implementation and approved mockup in the same visual QA input;
- verify engine selection, sample navigation, prompt editing, Multi-prompt, Storyboard, core settings, Generate-to-auth-gate, and no horizontal page overflow;
- capture 1440 × 1024 and verify that desktop hierarchy and the latest-renders rail did not regress;
- verify the primary action remains reachable with default data after the page settles;
- record all findings in `design-qa.md` and require `final result: passed` before handoff.

## Acceptance Criteria

- At 390 × 844, the current default guest Workspace is materially denser and exposes the creation flow earlier without a guest-only layout.
- Logging in does not reorder the Workspace.
- The preview remains before the composer on mobile and desktop.
- Prompt count, Multi-prompt, and Storyboard share one header row at the target Kling state.
- The prompt limit remains dynamic per engine.
- The price appears exactly once, inside the Generate button.
- Generate preserves the existing authentication, pricing, wallet, top-up, and generation behavior.
- The document has no horizontal overflow at the target viewport.
- Desktop presentation remains functionally and visually stable.
- No public route, SEO output, payment endpoint, database contract, or localization route is changed.
- Automated verification passes and `design-qa.md` ends with `final result: passed`.
