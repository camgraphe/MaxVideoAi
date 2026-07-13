# Angle Graphite Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the complete public Angle landing page follow the global dark theme with the approved graphite cinema palette while preserving the existing light theme, content, SEO, imagery, and interactions.

**Architecture:** Keep theme ownership inside `AngleLanding.module.css`. Define light semantic custom properties on the page root, override those properties through `:global([data-theme='dark']) .page`, and consume them from every color-bearing Angle selector. Lock the boundary with source-level architecture tests and verify the integrated result in a real browser.

**Tech Stack:** Next.js 15, React Server Components, CSS Modules, TypeScript, Node test runner, ESLint, local browser QA.

## Global Constraints

- The selected visual direction is graphite cinema: deep blue-black backgrounds, restrained cold highlights, layered graphite surfaces, and natural unfiltered imagery.
- The light presentation, page content, localized routes, SEO metadata, JSON-LD, interactions, and image assets must remain unchanged.
- Do not add React theme state, a client component, a theme provider, a page-specific switch, or global CSS for this change.
- Do not duplicate, replace, tint, or filter any Angle image.
- Preserve orbit drag, arrow controls, keyboard navigation, focus behavior, and `prefers-reduced-motion` behavior.
- Preserve EN, FR, and ES copy, routes, canonical URL, hreflang, JSON-LD, and sitemap behavior.
- Keep all theme variables scoped to `.page` in `AngleLanding.module.css`.

---

## File Map

- `frontend/src/components/tools/angle/landing/AngleLanding.module.css`: owns the light and dark Angle palette and consumes the semantic theme properties across all landing sections.
- `tests/tool-marketing-landing-architecture.test.ts`: locks the page-scoped dark selector, required semantic properties, and token consumption by representative section selectors.
- No React, message, route, metadata, schema, or asset file changes are planned.

### Task 1: Establish the page-scoped theme contract and critical surfaces

**Files:**
- Modify: `tests/tool-marketing-landing-architecture.test.ts`
- Modify: `frontend/src/components/tools/angle/landing/AngleLanding.module.css:1-53`

**Interfaces:**
- Consumes: the global document attribute `data-theme="dark"` applied by `MarketingNav`.
- Produces: light semantic properties on `.page` and dark replacements on `:global([data-theme='dark']) .page`.
- Produces: tokenized canvas, hero, orbit, heading, body-copy, link, and divider surfaces used by Task 2.

- [ ] **Step 1: Add the failing page-scoped theme contract test**

Append this test before the existing reduced-motion test:

```ts
test('Angle landing owns a page-scoped graphite dark theme contract', () => {
  const pageBlock = angleStylesSource.match(/\.page\s*\{([^}]*)\}/)?.[1];
  const darkPageBlock = angleStylesSource.match(/:global\(\[data-theme='dark'\]\)\s+\.page\s*\{([^}]*)\}/)?.[1];

  assert.ok(pageBlock, 'Angle styles should define light theme properties on .page');
  assert.ok(darkPageBlock, 'Angle styles should override those properties under the global dark theme');

  const requiredTokens = [
    '--angle-canvas',
    '--angle-canvas-alt',
    '--angle-hero-background',
    '--angle-surface',
    '--angle-surface-translucent',
    '--angle-surface-elevated',
    '--angle-surface-inset',
    '--angle-media-matte',
    '--angle-media-placeholder',
    '--angle-text',
    '--angle-text-secondary',
    '--angle-text-muted',
    '--angle-border',
    '--angle-border-strong',
    '--angle-output-border',
    '--angle-accent',
    '--angle-accent-soft',
    '--angle-shadow-soft',
    '--angle-shadow-elevated',
    '--angle-workspace-shell',
    '--angle-workspace-border',
    '--angle-workspace-text',
    '--angle-workspace-muted',
    '--angle-final-section',
    '--angle-final-background',
    '--angle-final-border',
    '--angle-final-copy',
  ];

  for (const token of requiredTokens) {
    const declaration = new RegExp(`${token}:`);
    assert.match(pageBlock, declaration, `${token} should have a light value`);
    assert.match(darkPageBlock, declaration, `${token} should have a graphite dark value`);
  }

  assert.match(darkPageBlock, /--angle-canvas:\s*#050910/);
  assert.match(darkPageBlock, /--angle-text:\s*#f4f1ea/);
  assert.doesNotMatch(darkPageBlock, /#fffaf1|#f3eee5|#ece5da/);

  for (const [selector, token] of [
    ['.hero', '--angle-hero-background'],
    ['.heroStage', '--angle-surface-translucent'],
    ['.orbitTrack', '--angle-media-placeholder'],
    ['.orbitButton', '--angle-surface'],
    ['.sectionRule', '--angle-border'],
    ['.sectionIntro h2', '--angle-text'],
    ['.sectionIntroBody', '--angle-text-secondary'],
    ['.textLink', '--angle-text'],
  ] as const) {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const declarations = angleStylesSource.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1];
    assert.ok(declarations, `${selector} should have a style block`);
    assert.match(declarations, new RegExp(`var\\(${token}\\)`), `${selector} should consume ${token}`);
  }
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/tool-marketing-landing-architecture.test.ts
```

Expected: FAIL in `Angle landing owns a page-scoped graphite dark theme contract` because the stylesheet has no `:global([data-theme='dark']) .page` block.

- [ ] **Step 3: Define the complete light and dark semantic palette**

Replace the one-line `.page` rule with these exact declarations and place the dark block immediately after it:

```css
.page {
  --angle-canvas: #fffaf1;
  --angle-canvas-alt: #f3eee5;
  --angle-hero-background: radial-gradient(circle at 82% 16%, rgb(68 125 255 / 10%), transparent 28rem), linear-gradient(135deg, #fffdf8 0%, #f6f0e6 54%, #fffaf1 100%);
  --angle-surface: #fffdf8;
  --angle-surface-translucent: rgb(255 253 248 / 72%);
  --angle-surface-elevated: #ece5da;
  --angle-surface-inset: #e9e1d5;
  --angle-media-matte: #e7dfd3;
  --angle-media-placeholder: #ded6cb;
  --angle-text: #292724;
  --angle-text-secondary: #625d56;
  --angle-text-muted: #6d675f;
  --angle-border: #d8d0c5;
  --angle-border-strong: #cfc5b8;
  --angle-output-border: #aebfff;
  --angle-accent: #1769ff;
  --angle-accent-soft: #aebfff;
  --angle-shadow-soft: 0 28px 75px rgb(50 43 34 / 10%);
  --angle-shadow-elevated: 0 32px 90px rgb(50 43 34 / 12%);
  --angle-workspace-shell: #20232a;
  --angle-workspace-border: #3e4148;
  --angle-workspace-text: #d6d0c8;
  --angle-workspace-muted: #9fa3ad;
  --angle-final-section: #e9e1d5;
  --angle-final-background: radial-gradient(circle at 20% 20%, rgb(83 130 255 / 24%), transparent 23rem), linear-gradient(135deg, #171a20 0%, #252833 55%, #111319 100%);
  --angle-final-border: #343743;
  --angle-final-copy: #d4d2d0;
  overflow: clip;
  color: var(--angle-text);
  background: var(--angle-canvas);
}

:global([data-theme='dark']) .page {
  --angle-canvas: #050910;
  --angle-canvas-alt: #0a1019;
  --angle-hero-background: radial-gradient(circle at 82% 16%, rgb(77 124 255 / 18%), transparent 30rem), linear-gradient(135deg, #070c14 0%, #0b121d 54%, #050910 100%);
  --angle-surface: #0f1722;
  --angle-surface-translucent: rgb(14 22 34 / 86%);
  --angle-surface-elevated: #111b29;
  --angle-surface-inset: #0c131e;
  --angle-media-matte: #0b121c;
  --angle-media-placeholder: #111c29;
  --angle-text: #f4f1ea;
  --angle-text-secondary: #c2c9d3;
  --angle-text-muted: #909baa;
  --angle-border: rgb(174 191 255 / 14%);
  --angle-border-strong: rgb(174 191 255 / 22%);
  --angle-output-border: rgb(112 153 255 / 60%);
  --angle-accent: #7da2ff;
  --angle-accent-soft: #aebfff;
  --angle-shadow-soft: 0 28px 75px rgb(0 0 0 / 30%);
  --angle-shadow-elevated: 0 32px 90px rgb(0 0 0 / 44%), inset 0 1px 0 rgb(255 255 255 / 4%);
  --angle-workspace-shell: #070b12;
  --angle-workspace-border: rgb(174 191 255 / 20%);
  --angle-workspace-text: #dde4ee;
  --angle-workspace-muted: #8e99a8;
  --angle-final-section: #060a11;
  --angle-final-background: radial-gradient(circle at 20% 20%, rgb(83 130 255 / 28%), transparent 23rem), linear-gradient(135deg, #080d16 0%, #111a29 55%, #05080e 100%);
  --angle-final-border: rgb(174 191 255 / 22%);
  --angle-final-copy: #cbd3df;
}
```

- [ ] **Step 4: Tokenize the critical page and hero declarations**

Replace only the color-bearing declarations in the existing selectors with these exact values; retain every existing layout, typography, transition, and radius declaration:

```css
.hero { color: var(--angle-text); background: var(--angle-hero-background); border-bottom-color: var(--angle-border); }
.heroStage { background: var(--angle-surface-translucent); border-color: var(--angle-border-strong); box-shadow: var(--angle-shadow-elevated); }
.orbitTrack { background: var(--angle-media-placeholder); border-color: var(--angle-border); }
.orbitTrack:focus-visible { outline-color: var(--angle-accent); }
.orbitControls { color: var(--angle-text-muted); }
.orbitButton { color: var(--angle-text); background: var(--angle-surface); border-color: var(--angle-border-strong); }
.orbitButton:focus-visible { outline-color: var(--angle-accent); }
.sectionRule { border-top-color: var(--angle-border); }
.eyebrow,
.finalEyebrow { color: var(--angle-accent); }
.sectionIntro h2 { color: var(--angle-text); }
.sectionIntroBody { color: var(--angle-text-secondary); }
.textLink { color: var(--angle-text); text-decoration-color: var(--angle-text-muted); }
.textLink:hover { color: var(--angle-accent); text-decoration-color: var(--angle-accent); }
.textLink:focus-visible,
.questionList summary:focus-visible { outline-color: var(--angle-accent); }
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/tool-marketing-landing-architecture.test.ts
```

Expected: all tests in the file PASS.

- [ ] **Step 6: Commit the theme foundation**

```bash
git add tests/tool-marketing-landing-architecture.test.ts frontend/src/components/tools/angle/landing/AngleLanding.module.css
git commit -m "feat: add angle graphite theme foundation"
```

### Task 2: Tokenize every remaining Angle landing section

**Files:**
- Modify: `tests/tool-marketing-landing-architecture.test.ts`
- Modify: `frontend/src/components/tools/angle/landing/AngleLanding.module.css:55-229`

**Interfaces:**
- Consumes: all `--angle-*` properties established in Task 1.
- Produces: complete dark coverage for use cases, workspace, benefits, FAQ, related links, final CTA, and desktop divider variants.

- [ ] **Step 1: Add the failing complete-section token coverage test**

Append this test immediately after the Task 1 dark-theme contract test:

```ts
test('Angle landing consumes theme tokens across every premium section', () => {
  const tokenizedSelectors = [
    ['.useCaseCollection', '--angle-canvas'],
    ['.useCaseSection:nth-of-type(even)', '--angle-canvas-alt'],
    ['.useCaseMedia', '--angle-media-matte'],
    ['.useCaseMedia figure', '--angle-surface'],
    ['.useCaseImage', '--angle-media-placeholder'],
    ['.workspaceSection', '--angle-surface-elevated'],
    ['.workspaceFrame', '--angle-workspace-shell'],
    ['.workspaceWindow', '--angle-surface'],
    ['.workspaceImage', '--angle-media-placeholder'],
    ['.conversionSection', '--angle-canvas'],
    ['.questionsSection', '--angle-canvas-alt'],
    ['.limitsParagraph', '--angle-surface-inset'],
    ['.relatedSection', '--angle-canvas'],
    ['.finalSection', '--angle-final-section'],
    ['.finalCta', '--angle-final-background'],
  ] as const;

  for (const [selector, token] of tokenizedSelectors) {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const declarations = angleStylesSource.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))?.[1];
    assert.ok(declarations, `${selector} should have a style block`);
    assert.match(declarations, new RegExp(`var\\(${token}\\)`), `${selector} should consume ${token}`);
  }
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/tool-marketing-landing-architecture.test.ts
```

Expected: FAIL first on `.useCaseCollection should consume --angle-canvas`.

- [ ] **Step 3: Tokenize use cases and media frames**

Replace only the existing color-bearing declarations with these exact values:

```css
.useCaseCollection { background: var(--angle-canvas); }
.useCasePreludeTitle,
.useCaseCopy h2 { color: var(--angle-text); }
.useCasePrelude > :last-child,
.useCaseCopy > p:nth-of-type(2) { color: var(--angle-text-secondary); }
.useCaseSection { border-top-color: var(--angle-border); }
.useCaseSection:nth-of-type(even) { background: var(--angle-canvas-alt); }
.useCaseMedia { background: var(--angle-media-matte); border-color: var(--angle-border-strong); box-shadow: var(--angle-shadow-soft); }
.useCaseMedia figure { background: var(--angle-surface); border-color: var(--angle-border); }
.useCaseMedia figure[data-output='true'] { border-color: var(--angle-output-border); }
.useCaseMedia figcaption { color: var(--angle-text-muted); }
.useCaseMedia figure[data-output='true'] figcaption { color: var(--angle-accent); }
.useCaseImage { background: var(--angle-media-placeholder); border-top-color: var(--angle-border); }
```

- [ ] **Step 4: Tokenize workspace, benefits, FAQ, related links, and final CTA**

Replace only the existing color-bearing declarations with these exact values:

```css
.workspaceSection,
.conversionSection,
.questionsSection,
.relatedSection,
.finalSection { border-top-color: var(--angle-border); }
.workspaceSection { background: radial-gradient(circle at 86% 14%, rgb(23 105 255 / 10%), transparent 25rem), var(--angle-surface-elevated); }
.workspaceFrame { background: var(--angle-workspace-shell); border-color: var(--angle-workspace-border); box-shadow: var(--angle-shadow-elevated); }
.workspaceTopline { color: var(--angle-workspace-text); }
.workspaceTopline span:last-child { color: var(--angle-workspace-muted); }
.workspaceWindow { background: var(--angle-surface); border-color: var(--angle-workspace-border); }
.workspaceChrome span { background: var(--angle-text-muted); }
.workspaceWindow > p { color: var(--angle-text-muted); }
.workspaceImage { background: var(--angle-media-placeholder); border-top-color: var(--angle-border); }
.workspaceCallouts,
.workspaceCallouts li,
.benefitList,
.benefitList li,
.questionList,
.questionList details,
.relatedColumns > div { border-color: var(--angle-border-strong); }
.workspaceCallouts li > span,
.benefitList li > span,
.benefitList svg { color: var(--angle-accent); }
.workspaceCallouts h3,
.benefitList h3,
.relatedColumns h3,
.questionList summary { color: var(--angle-text); }
.workspaceCallouts p,
.benefitList p,
.questionList details > p { color: var(--angle-text-secondary); }
.conversionSection,
.relatedSection { background: var(--angle-canvas); }
.questionsSection { background: var(--angle-canvas-alt); }
.limitsParagraph { color: var(--angle-text-secondary); background: var(--angle-surface-inset); border-left-color: var(--angle-accent); }
.finalSection { background: var(--angle-final-section); }
.finalCta { background: var(--angle-final-background); border-color: var(--angle-final-border); box-shadow: var(--angle-shadow-elevated); }
.finalEyebrow { color: var(--angle-accent-soft); }
.finalCopy > p:not(.finalEyebrow) { color: var(--angle-final-copy); }
.finalOrbit span,
.finalOrbit i { background: var(--angle-accent-soft); border-color: var(--angle-workspace-shell); }
```

Keep the three semantic Chrome-dot overrides exactly as they are:

```css
.workspaceChrome span:first-child { background: #ef7c64; }
.workspaceChrome span:nth-child(2) { background: #e7bd55; }
.workspaceChrome span:last-child { background: #71b68a; }
```

Update the desktop-only workspace divider to consume the same token:

```css
@media (min-width: 768px) {
  .workspaceCallouts li { border-right-color: var(--angle-border-strong); }
}
```

- [ ] **Step 5: Run all focused Angle tests and verify GREEN**

Run:

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/angle-orbit-assets.test.ts tests/angle-orbit-state.test.ts tests/tool-marketing-landing-architecture.test.ts
```

Expected: 25 tests PASS, 0 fail. The total is the current 23 tests plus the two new theme-contract tests.

- [ ] **Step 6: Run static validation**

Run:

```bash
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 7: Commit complete dark section coverage**

```bash
git add tests/tool-marketing-landing-architecture.test.ts frontend/src/components/tools/angle/landing/AngleLanding.module.css
git commit -m "feat: complete angle graphite dark mode"
```

### Task 3: Production and browser verification

**Files:**
- Verify only: `frontend/src/components/tools/angle/landing/AngleLanding.module.css`
- Capture outside the repository: `/Users/adrienmillot/.codex/visualizations/2026/07/13/019f5a77-03ca-7320-a5a4-a641aae33caf/angle-dark-mode-*.png`

**Interfaces:**
- Consumes: the global marketing theme toggle and the final CSS token contract.
- Produces: evidence that light mode is preserved, graphite dark mode covers the full page, localized routes render, and production compilation succeeds.

- [ ] **Step 1: Run the production build**

Run:

```bash
npm --prefix frontend run build
```

Expected: exit 0, `/tools/angle`, `/fr/outils/angle`, and `/es/herramientas/angle` appear in the generated route list.

- [ ] **Step 2: Start the isolated development server**

Run:

```bash
npm --prefix frontend run dev -- --port 3002
```

Expected: the server reports ready at `http://localhost:3002`.

- [ ] **Step 3: Smoke-test localized routes and the hero asset**

Run:

```bash
for url in \
  http://localhost:3002/tools/angle \
  http://localhost:3002/fr/outils/angle \
  http://localhost:3002/es/herramientas/angle \
  http://localhost:3002/assets/tools/angle-orbit-hero-dialogue-field.webp; do
  curl -fsS -o /dev/null -w '%{http_code} %{url_effective}\n' "$url"
done
```

Expected: HTTP 200 for all four URLs.

- [ ] **Step 4: Verify light computed styles before toggling**

In the browser at `http://localhost:3002/tools/angle`, read computed styles and confirm:

```text
document.documentElement.getAttribute('data-theme') is null
.angle-page > div background is rgb(255, 250, 241)
the hero background is the existing warm light gradient
```

Capture:

```text
angle-dark-mode-light-hero.png
angle-dark-mode-light-full.png
```

- [ ] **Step 5: Toggle dark mode and verify graphite computed styles**

Click the unique `Switch to dark theme` button, then confirm:

```text
document.documentElement.getAttribute('data-theme') is "dark"
.angle-page > div background is rgb(5, 9, 16)
the hero, use-case collection, workspace, FAQ, related section, and final section are not cream or beige
primary text is rgb(244, 241, 234)
```

Capture:

```text
angle-dark-mode-dark-hero.png
angle-dark-mode-dark-full.png
```

- [ ] **Step 6: Verify interactions and responsive coverage**

In dark mode:

```text
ArrowRight advances the hero orbit by one view.
ArrowLeft returns by one view.
Dragging at least 64px changes one view.
Opening one FAQ row reveals readable secondary text.
At a 390x844 viewport, use-case media stacks without a light seam.
Focus outlines remain visible on orbit buttons and FAQ summaries.
```

- [ ] **Step 7: Run final verification and inspect branch state**

Run:

```bash
npx tsx --tsconfig frontend/tsconfig.json --test tests/angle-orbit-assets.test.ts tests/angle-orbit-state.test.ts tests/tool-marketing-landing-architecture.test.ts
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
git status --short
git log --oneline -3
```

Expected: 25 tests pass; lint, exposure, and diff checks exit 0; the worktree is clean; the latest commits are the two dark-mode implementation commits and the design/plan documentation commits.
