# Angle Landing Dark Mode Design

Date: 2026-07-13
Status: Approved design direction
Branch: `codex/angle-dark-mode`

## Objective

Give the complete public Angle landing page a premium dark presentation whenever the global MaxVideoAI theme is dark. The selected direction is **graphite cinema**: deep blue-black backgrounds, restrained cold highlights, layered graphite surfaces, and natural unfiltered imagery.

The light presentation, page content, localized routes, SEO metadata, JSON-LD, interactions, and image assets must remain unchanged.

## Root Cause

The marketing navigation correctly applies `data-theme="dark"` to the document root, but `AngleLanding.module.css` uses hard-coded light colors such as `#fffaf1` and `#f3eee5`. The stylesheet has no dark-theme selector and therefore paints light surfaces over the global dark body.

The fix belongs in the Angle landing stylesheet, not in the theme toggle or global theme state.

## Visual Direction

### Palette

- Page canvas: near-black blue graphite.
- Primary section surface: deep graphite with a subtle cool cast.
- Alternate section surface: a slightly elevated blue-black layer.
- Elevated cards and media mattes: dark slate surfaces with a faint inner highlight.
- Primary text: soft off-white rather than pure white.
- Secondary text: cool gray with sufficient contrast for long-form reading.
- Borders and dividers: translucent cool gray, visible without looking boxed-in.
- Accent and focus: the existing MaxVideoAI blue, brightened only where dark contrast requires it.

The design avoids strong neon, saturated gradients, image filters, and generic flat black panels.

### Page rhythm

The page keeps its current editorial alternation between sections. In dark mode, that rhythm comes from controlled differences between the canvas, section surfaces, elevated cards, and media mattes instead of switching between cream and beige.

Large images stay visually dominant. Dark framing should support the imagery rather than tint it.

## Theme Architecture

`AngleLanding.module.css` will own page-scoped semantic custom properties on `.page`, including:

- canvas and alternate canvas
- elevated and inset surfaces
- primary, secondary, and muted text
- border and strong border
- soft and elevated shadows
- accent and accent-soft treatments

The current light values become the default variable values. A single CSS Modules-compatible selector, `:global([data-theme='dark']) .page`, replaces those values for dark mode.

Existing class rules will consume the semantic properties. This prevents a large override block, keeps light and dark behavior aligned, and makes missed light-only colors detectable in review and tests.

No new React state, client component, theme provider, or global CSS rule is required.

## Component Treatment

### Hero and interactive orbit

- The hero uses a deep graphite gradient with one restrained blue radial highlight.
- The orbit stage becomes a translucent elevated panel with a cool border and deep shadow.
- The image remains untouched.
- Orbit controls use dark circular buttons, off-white icons, and the existing blue focus ring.
- Hover and drag behavior remain unchanged.

### Problem, solution, and use cases

- Section backgrounds alternate between the canvas and alternate canvas tokens.
- Use-case media groups use a graphite matte.
- Individual figures use an elevated surface and subtle border.
- Output figures retain a blue distinction without becoming luminous cards.
- Captions remain readable and preserve their current hierarchy.

### Workspace proof

- The outer workspace frame remains the darkest application-like surface.
- The inner browser window changes from cream to an elevated graphite surface.
- Chrome dots keep their semantic colors.
- Callout dividers and supporting copy use the dark border and secondary-text tokens.

### Benefits, FAQ, related links, and limits

- Lists and accordion rows use translucent dividers.
- The limits panel becomes an inset graphite surface with the existing blue rule.
- Questions, answers, and related links preserve their hierarchy and focus treatment.

### Final CTA

- The CTA remains the visual conclusion and becomes slightly deeper than the page canvas.
- Its orbit lines and nodes gain restrained cool luminosity.
- Text and buttons retain their existing contrast and behavior.

## Accessibility and Motion

- Primary text and essential controls target WCAG AA contrast against their surfaces.
- Secondary long-form text must remain comfortably readable, not merely decorative.
- Focus outlines stay visible on links, orbit controls, and FAQ summaries.
- `prefers-reduced-motion` behavior remains unchanged.
- The design must not encode state through color alone.

## Responsive Behavior

The current layout and breakpoints remain unchanged. Dark surfaces must cover the full width of each section on desktop and mobile without exposing light seams. Mobile stacked media cards and the final CTA retain their current geometry.

## Testing Strategy

1. Add an architecture regression test that fails while the Angle stylesheet has no page-scoped dark theme contract.
2. Assert the presence of the dark root selector and the semantic surface/text/border variables used by the page.
3. Run the existing Angle asset, state, localization, metadata, and architecture tests.
4. Run frontend lint, public-exposure validation, `git diff --check`, and the production build.
5. Run the integrated page locally and verify EN, FR, and ES routes.
6. In the browser, verify computed dark backgrounds, readable text, focus states, orbit controls, FAQ rows, and mobile stacking.
7. Capture comparable light and dark screenshots for the hero and the complete page.

## Acceptance Criteria

- The global theme toggle changes every visible Angle landing section to the graphite cinema palette.
- No cream or beige page surface remains visible in dark mode.
- The light theme is visually unchanged.
- Images are not duplicated, replaced, tinted, or filtered.
- Orbit drag, arrow controls, keyboard navigation, and reduced-motion behavior still work.
- EN, FR, and ES content and localized paths remain unchanged.
- Canonical URL, hreflang output, metadata, JSON-LD, and sitemap behavior remain unchanged.
- Focus states and long-form text remain accessible.
- The implementation introduces no new client-side theme state.

## Non-goals

- Redesigning the light theme.
- Replacing the existing Angle imagery.
- Changing copy, SEO targeting, routes, schema, or CTAs.
- Adding a page-specific theme switch.
- Changing global MaxVideoAI theme tokens for other pages.
