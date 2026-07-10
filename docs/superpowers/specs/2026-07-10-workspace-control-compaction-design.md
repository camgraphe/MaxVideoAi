# Video and Image Workspace Control Compaction Design

## Status and relationship to the previous design

This specification refines the implemented workspace density design in `2026-07-10-workspace-first-viewport-design.md`.

Where the specifications differ, this document is authoritative for engine controls, preview-tool alignment, prompt height, compact setting controls, Generate sizing, and asset-field grids. In particular, the earlier discreet `Browse engines` action is now removed from the workspace presentation.

## Objective

Improve the compactness, alignment, and readability of `/app` and `/app/image` without changing MaxVideoAI's visual language or any generation behavior.

The result should make the two workspaces feel intentionally composed:

- engine and variant controls read as one left-aligned group;
- preview actions align with the media users are actually viewing;
- prompts are easier to read and edit;
- settings remain compact and legible;
- Generate remains primary without overpowering the control row;
- asset placeholders form predictable responsive grids;
- Seedance's three primary inputs remain together whenever the viewport can support them.

## Scope

This lot includes:

- removing the workspace `Browse engines` link and its reserved layout space;
- keeping `Choose engine` and `Variant` on one line at every supported viewport;
- aligning preview action toolbars to the rendered media width for video and image;
- increasing workspace prompt textareas to at least seven complete text lines;
- compacting workspace setting selectors and removing their chevrons;
- simplifying displayed workspace resolution labels to `720p`, `1080p`, and `4K`;
- slightly reducing the workspace Generate button width and padding while retaining its price;
- standardizing asset-field cards and responsive outer grids;
- giving Seedance Start image, End image, and Source video equal three-column placement when space permits;
- focused contract, architecture, responsive, accessibility, and visual verification.

## Out of scope

- Removing the engine selector's existing dropdown or the full engine discovery modal reachable from inside that dropdown.
- Changing which engines or variants are available.
- Changing engine selection state, variant resolution, mode inference, pricing, wallet checks, authentication, generation payloads, uploads, polling, or persistence.
- Changing public routes, localized routes, metadata, canonical URLs, hreflang, JSON-LD, robots, redirects, or sitemaps.
- Restyling the product, replacing design tokens, changing typography, or introducing new primitives.
- Reordering asset fields or changing their required/optional semantics.
- Forcing multi-reference collections into a single slot; collections keep their existing internal slot grid.
- Translating provider-authored model descriptions as part of this layout lot.

## Chosen approach

Extend the existing opt-in `density="workspace"` presentation contract instead of changing shared default consumers or adding route-specific CSS patches.

This approach is preferred because:

- Generate Video and Generate Image already opt into the same compact primitives;
- marketing, tools, admin, audio, and other consumers retain their current appearance;
- layout intent remains explicit at component boundaries;
- contract tests can protect the workspace behavior without freezing unrelated screens;
- responsive behavior stays maintainable in the shared components that own it.

The rejected alternatives are:

1. global compaction of all shared controls, which has unnecessary visual blast radius;
2. route-only wrapper overrides, which would duplicate sizing logic and become brittle;
3. a new workspace-specific selector library, which would duplicate interaction and accessibility behavior.

## Engine and variant row

### Workspace behavior

The workspace engine control renders exactly one visible row:

```text
[ Choose engine: flexible width ] [ Variant: compact fixed width ]
```

- `Choose engine` and `Variant` are vertically aligned and use the same trigger height.
- The group is left aligned with a horizontal gap between 12px and 16px on desktop and a compact equivalent on mobile.
- The engine trigger uses `min-width: 0` and consumes remaining width.
- The variant trigger keeps a compact fixed or bounded width sufficient for current labels.
- On narrow mobile screens, the row does not wrap. The engine name truncates before Variant moves to a second line.
- Provider/version secondary copy may truncate, but the selected engine remains available through the accessible name and dropdown content.
- The row must not produce document-level horizontal overflow at 320px, 360px, 390px, or desktop widths.

### Browse removal

- The visible `Browse engines` link below the workspace selector is removed.
- Its icon, minimum hit area, margin, and vertical gap are removed with it.
- No empty wrapper or placeholder remains.
- The engine dropdown remains the primary model-selection entry point.
- Existing discovery access inside the expanded engine dropdown remains unchanged.
- Non-workspace EngineSelect consumers keep their existing Browse presentation.

## Preview media and toolbar alignment

### Video

- The preview stage keeps its current aspect-safe sizing and 16:9-first behavior.
- The preview toolbar receives the same resolved width as the actual preview stage.
- The toolbar is centered under that width, not under the full section width.
- Portrait, square, ultrawide, and landscape media continue using contain behavior without crop or stretch.
- Playback, mute, loop, download, modal, guided navigation, and ready-state behavior remain unchanged.

### Image

- The image preview keeps its entry-derived aspect ratio and `object-contain` rendering.
- The image action toolbar shares the rendered preview's center axis.
- It may expand to a 244px minimum width, bounded by the preview parent, so five actions remain on one line under narrow portrait media.
- Its centered alignment remains correct for square, portrait, landscape, and custom dimensions without forcing a tall multi-row action stack.
- Edit, add/remove library, download, copy, modal, and variant navigation behavior remain unchanged.

The shared invariant is that media and its action bar read as one visual unit.

## Prompt contract

- Both workspace prompt textareas display at least seven complete text lines before internal scrolling.
- The implementation uses a workspace-only `min-height` based on the existing line height and padding rather than a rigid one-off height.
- `rows` reflects the seven-line intent for semantic and non-CSS fallbacks.
- Users may still resize where the current textarea behavior allows it.
- Prompt count, Multi-prompt, Storyboard, error states, placeholders, dynamic limits, persistence, and keyboard shortcuts remain unchanged.
- Multi-prompt's own editor keeps its current behavior; this requirement targets the standard prompt textarea.
- Default Composer consumers outside the workspace retain their current heights.

## Compact setting controls

Workspace setting controls use a denser but still clearly interactive treatment:

- trigger height: 32px to 36px;
- reduced horizontal padding;
- reduced gap between controls;
- narrower intrinsic minimum widths that still contain localized active values;
- visible border, background, hover state, focus ring, and menu behavior remain;
- dropdown chevrons are hidden for workspace setting selectors only;
- menus, keyboard navigation, outside-click behavior, disabled explanations, and portal positioning remain unchanged.

Icons are retained only when they help distinguish an otherwise ambiguous value. Duration, aspect ratio, and audio may keep their semantic icons. Resolution values and iteration counts are already self-explanatory and should not require decorative icons. The implementation should avoid adding replacement icons.

### Resolution labels

The workspace control displays normalized resolution values only:

- `720p`
- `1080p`
- `4K`

It must not append `HD`, `Full HD`, `Ultra HD`, or `Pro` in the compact workspace trigger or options. Other supported provider values such as `480p`, `512P`, `768P`, or `Auto` remain readable and unchanged except for consistent casing where the existing formatter already defines it.

This is presentation-only. Submitted resolution values and model capabilities do not change.

## Generate button

- Generate remains on the same desktop row as the compact setting controls.
- Its desktop minimum width and horizontal padding are reduced slightly from the current workspace values.
- Its mobile behavior remains usable and visually primary; it may remain full-width below the contained control scroller when required by the current responsive composition.
- The localized action label and formatted price remain visible once each.
- The price chip may use slightly reduced padding but must remain clearly legible.
- Loading, disabled, member-discount, auth-gate, animation, and click behavior remain unchanged.
- No price is added beside or below the button.

## Asset-field grid

### Shared responsive grid

Workspace asset fields use a predictable outer grid:

- mobile: one column;
- intermediate widths: two columns;
- standard desktop widths: three columns;
- wide desktop widths: four columns when four or more fields are present.

The grid must respond to the available workspace content width rather than assume the full browser width.

Single-value asset cards use consistent:

- width and stretch behavior;
- minimum height;
- border and radius tokens;
- outer padding;
- title typography;
- guidance and disabled-copy placement;
- slot alignment.

Multi-reference fields retain their internal multi-slot grid, limits, helpers, library actions, and collection semantics. Their outer card participates in the same responsive grid rather than receiving an arbitrary two-column span solely because `maxCount > 1`.

Filled full-bleed media states keep their existing aspect-safe preview behavior. Harmonization must not crop an uploaded asset or remove its controls.

### Seedance three-input rule

When the active Seedance workflow exposes all three single-value fields:

1. Start image;
2. End image;
3. Source video;

the fields render as three equal columns on one row whenever the content area reaches the standard three-column breakpoint.

- All three cards stretch to equal height.
- Titles, helper areas, slot bodies, and disabled/auth-lock states align consistently.
- The third card must not fall to a second row while the available width can support three readable cards.
- At intermediate widths the layout may become two columns plus one card.
- On mobile the layout becomes one column.
- Source video keeps its file type, size, duration, auth, upload, and library rules.

## Component boundaries

- `AppClient.tsx` remains an orchestrator and receives no new layout JSX.
- `WorkspacePreviewDock.tsx` continues composing `EngineSettingsBar` with `CompositePreviewDock`.
- `ImageWorkspaceComposerSurface.tsx` continues composing `EngineSelect`, `ImageCompositePreviewDock`, and the image Composer.
- `EngineSelect` owns workspace engine/variant alignment and workspace Browse suppression.
- `EngineVariantControl` owns its bounded workspace width and trigger sizing.
- `CompositePreviewDock` and `ImageCompositePreviewDock` own media-relative toolbar widths.
- `Composer` owns the workspace prompt minimum height, Generate sizing, and the outer asset-field grid.
- `CoreSettingsBar` and the image settings surface own their compact selector presentation and normalized labels.
- `SelectMenu` exposes existing presentation options such as `hideChevron`; its default behavior remains unchanged.
- `AssetDropzone` owns consistent card treatment and internal slot layout, not outer page orchestration.

No server-only module, database access, route handler, or secret-bearing module enters the client graph.

## Accessibility

- Hidden chevrons do not remove `aria-haspopup`, `aria-expanded`, `aria-controls`, keyboard navigation, or focus indication.
- Engine and variant triggers retain accessible names even when visible text truncates.
- Touch targets remain at least the current workspace control height and are not reduced below 32px.
- Toolbar buttons retain their current accessible labels and focus order.
- Seven prompt lines remain real editable text, not a visual placeholder.
- Responsive grids preserve DOM order and logical keyboard order.
- Disabled field reasons remain available without relying only on color.

## Localization, routing, and SEO safety

- EN, FR, and ES continue using the existing message dictionaries.
- Layout must tolerate longer localized labels through truncation and bounded widths without document overflow.
- No new required user-facing copy is introduced for this lot.
- `/app`, `/app/image`, and all existing query parameters remain unchanged.
- No marketing page, localized slug, canonical, hreflang, JSON-LD, robots directive, redirect, middleware rule, or sitemap builder is modified.

## Testing strategy

Implementation follows red-green-refactor.

Contract tests must first fail for the missing presentation rules, then pass after implementation. Coverage includes:

- workspace EngineSelect suppresses the visible Browse link and keeps engine/variant in one non-wrapping row;
- non-workspace EngineSelect behavior remains available;
- workspace prompt uses a seven-line minimum while defaults remain unchanged;
- workspace setting selectors hide chevrons and use normalized resolution labels;
- Generate keeps one price and uses the smaller workspace width contract;
- asset fields use the 1/2/3/4 responsive grid without collection-driven outer spans;
- Seedance three-field workflows reach three equal columns at the standard breakpoint;
- video and image toolbar widths are tied to their media stages;
- architecture line ceilings and route ownership remain intact.

Focused checks include the existing engine-select, composer, preview-dock, image-preview, asset-dropzone, workspace first-viewport, and workspace contract tests.

Visual verification covers:

- `/app` and `/app/image` at 390 × 844 and 1440 × 1024;
- at least one narrow 320px or 360px viewport for the single-line engine/variant invariant;
- Seedance with Start image, End image, and Source video visible;
- representative Sora or Kling variant selection;
- portrait, square, and 16:9 preview media;
- EN, FR, and ES label lengths;
- keyboard opening/selection for compact SelectMenu controls;
- absence of document-level horizontal overflow.

Before completion, run focused tests, TypeScript, lint, exposure checks, `git diff --check`, the full validation suite, and a production build.

## Acceptance criteria

The lot is complete when:

1. no visible workspace Browse link or residual space remains;
2. engine and variant stay on one aligned row down to 320px;
3. preview tools center on the actual video/image stage, with the image toolbar retaining a compact one-row action width;
4. standard workspace prompts show seven full lines;
5. compact settings omit chevrons and redundant resolution suffixes;
6. Generate is slightly smaller while preserving one readable price;
7. asset cards follow the responsive 1/2/3/4 grid and consistent sizing;
8. Seedance's three primary inputs share one equal three-column row when space permits;
9. all existing selection, pricing, auth, upload, generation, preview, and accessibility behaviors still work;
10. routes, localized marketing surfaces, and SEO output remain unchanged;
11. focused tests, full tests, lint, TypeScript, exposure checks, build, and visual QA pass.
