# Seedance 2.5 Linking and Examples Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Seedance 2.0 vs Seedance 2.5 the single flagship comparison in the global dropdown and update the Seedance examples landing so 2.5 leads the existing copy and link order without adding any height before the videos.

**Architecture:** Keep navigation ownership in `frontend/config/navigation.ts`, localized content ownership in the three `modelLandingData` files, and examples link assembly in `examples-page-copy.ts`. Reuse the existing desktop/mobile dropdown renderers, model-link section, gallery, and below-gallery next-step section; do not create or modify a visual layout component.

**Tech Stack:** Next.js 15 App Router, React Server Components, next-intl localized navigation, TypeScript, Node test runner through `tsx`, repository SEO/i18n/build contracts.

## Global Constraints

- Add exactly one Seedance 2.5 comparison to the dropdown: `seedance-2-0-vs-seedance-2-5`.
- Keep the dropdown at six comparison entries by replacing `seedance-2-0-vs-veo-3-1` in its first slot.
- Display the existing generic localized `New` badge; do not hard-code Seedance-specific badge rendering.
- Do not add a banner, card, CTA row, link cluster, explanatory panel, or any other element above the videos.
- Do not add or modify client components for the examples-page change.
- Keep the first existing Seedance next-step destination as the localized Seedance 2.5 model page.
- Put the 2.0 vs 2.5 comparison only in the existing `ExamplesNextStepsSection`, which renders below `ExamplesGallerySection`.
- Keep existing Seedance 2.0, Fast, Mini, and 1.5 Pro examples represented accurately; do not label older renders as Seedance 2.5 output.
- Do not expose provider names, provider model IDs, internal pricing language, launch gates, or production operations.
- Do not add LinkedIn content or trigger LinkedIn, Search Console, paid generation, production environment mutation, push, or deployment.
- The localized self-redirect discovered during preview is a separate routing defect and is not part of this content/linking plan.

---

### Task 1: Promote the 2.0 vs 2.5 Comparison in the Shared Dropdown

**Files:**
- Modify: `frontend/config/navigation.ts:40-170`
- Modify: `frontend/messages/en.json:85-110`
- Modify: `frontend/messages/fr.json:95-120`
- Modify: `frontend/messages/es.json:95-120`
- Test: `tests/seedance-prelaunch.test.ts:400-435`
- Test: `tests/marketing-navigation.test.ts:1-150`

**Interfaces:**
- Consumes: `MarketingNavItem.badge?: 'new'`, `compareLink(slug)`, and the shared `MARKETING_NAV_COMPARE` collection.
- Produces: a six-item `MARKETING_NAV_COMPARE` whose first item is `{ key: 'seedance-2-0-vs-seedance-2-5', badge: 'new' }`; existing desktop, mobile, workspace-header, and marketing-header renderers consume it unchanged.

- [ ] **Step 1: Write the failing navigation contract**

Update the existing Seedance menu assertion in `tests/seedance-prelaunch.test.ts` so it requires the new first item and preserves the six-entry count:

```ts
assert.deepEqual(
  MARKETING_NAV_COMPARE.map((item) => item.key),
  [
    'seedance-2-0-vs-seedance-2-5',
    'gemini-omni-flash-vs-veo-3-1',
    'kling-3-pro-vs-kling-o3-pro',
    'ltx-2-3-pro-vs-veo-3-1',
    'seedance-2-0-vs-seedance-2-0-fast',
    'ltx-2-3-fast-vs-ltx-2-3-pro',
  ]
);
assert.equal(MARKETING_NAV_COMPARE.length, 6);
assert.equal(MARKETING_NAV_COMPARE[0]?.badge, 'new');
```

Add a focused assertion to `tests/marketing-navigation.test.ts` that the shared compare dropdown exposes the same item and that the generic badge is already consumed by all four renderers:

```ts
const flagshipComparison = MARKETING_NAV_DROPDOWNS.compare?.items[0];
assert.equal(flagshipComparison?.key, 'seedance-2-0-vs-seedance-2-5');
assert.equal(flagshipComparison?.badge, 'new');
assert.deepEqual(flagshipComparison?.href, {
  pathname: '/ai-video-engines/[slug]',
  params: { slug: 'seedance-2-0-vs-seedance-2-5' },
});

for (const locale of ['en', 'fr', 'es'] as const) {
  const dictionary = JSON.parse(readFileSync(`frontend/messages/${locale}.json`, 'utf8'));
  assert.equal(
    dictionary.nav.dropdown.compare.items['seedance-2-0-vs-seedance-2-5'],
    'Seedance 2.0 vs Seedance 2.5',
  );
}
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/seedance-prelaunch.test.ts \
  tests/marketing-navigation.test.ts
```

Expected: FAIL because the first shared comparison is still `seedance-2-0-vs-veo-3-1` and has no badge.

- [ ] **Step 3: Replace the first authored comparison without growing the menu**

Change the first `COMPARE_MENU` entry in `frontend/config/navigation.ts` to:

```ts
const COMPARE_MENU: LabeledSlug[] = [
  {
    slug: 'seedance-2-0-vs-seedance-2-5',
    label: 'Seedance 2.0 vs Seedance 2.5',
    badge: 'new',
  },
  { slug: 'gemini-omni-flash-vs-veo-3-1', label: 'Gemini Omni Flash vs Veo 3.1' },
  { slug: 'kling-3-pro-vs-kling-o3-pro', label: 'Kling 3 Pro vs Kling 3.0 Omni Pro' },
  { slug: 'ltx-2-3-pro-vs-veo-3-1', label: 'LTX 2.3 Pro vs Veo 3.1' },
  { slug: 'seedance-2-0-vs-seedance-2-0-fast', label: 'Seedance 2.0 vs Fast' },
  { slug: 'ltx-2-3-fast-vs-ltx-2-3-pro', label: 'LTX 2.3 Fast vs Pro' },
];
```

Update the compare projection in the same file so the authored badge reaches the shared renderers:

```ts
export const MARKETING_NAV_COMPARE: MarketingNavItem[] = COMPARE_MENU.map((item) => ({
  key: item.slug,
  label: item.label,
  href: compareLink(item.slug),
  badge: item.badge,
}));
```

Do not change a dropdown renderer: the shared desktop/mobile renderers already consume `MarketingNavItem.badge`. The new projection line is required because compare items do not currently forward the authored badge.

- [ ] **Step 4: Add exact localized dropdown labels**

Add the same property to `nav.dropdown.compare.items` in all three message files:

```json
"seedance-2-0-vs-seedance-2-5": "Seedance 2.0 vs Seedance 2.5"
```

The exact value is identical in English, French, and Spanish because it contains only product names and `vs`.

- [ ] **Step 5: Run navigation, i18n, and comparison route checks**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/seedance-prelaunch.test.ts \
  tests/marketing-navigation.test.ts \
  tests/comparison-content-contract.test.ts \
  tests/premerge-seo-routes.test.ts
pnpm --prefix frontend run i18n:check
```

Expected: all tests PASS; FR/ES message parity remains clean.

- [ ] **Step 6: Commit the dropdown change**

```bash
git add \
  frontend/config/navigation.ts \
  frontend/messages/en.json \
  frontend/messages/fr.json \
  frontend/messages/es.json \
  tests/seedance-prelaunch.test.ts \
  tests/marketing-navigation.test.ts
git commit -m "feat: feature Seedance 2.5 comparison in navigation"
```

---

### Task 2: Lead the Existing Seedance Examples Content With 2.5

**Files:**
- Modify: `frontend/lib/examples/modelLandingData.en.ts:155-205`
- Modify: `frontend/lib/examples/modelLandingData.fr.ts:160-200`
- Modify: `frontend/lib/examples/modelLandingData.es.ts:160-200`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-copy.ts:147-215`
- Test: `tests/examples-route-architecture.test.ts:110-205`
- Test: `tests/seo-internal-links.test.ts:35-90`
- Test: `tests/examples-commercial-copy.test.ts:1-130`

**Interfaces:**
- Consumes: existing `getExampleModelLanding(locale, 'seedance')`, registry-derived Seedance model order, `buildModelHref`, `buildCompareHref`, and `ExamplesNextStepsSection`.
- Produces: concise EN/FR/ES Seedance landing metadata/copy led by 2.5; a five-item below-gallery next-step array whose first item remains the 2.5 model page and whose second item becomes the localized 2.0 vs 2.5 comparison.

- [ ] **Step 1: Write failing content and link-order tests**

Replace the old Seedance 2.0-led expectations inside the existing Seedance landing test in `tests/examples-route-architecture.test.ts`; retain its family aliases, complete model ordering, canonical, and hreflang assertions. Add these exact 2.5-led assertions:

```ts
const landing = getExampleModelLanding('en', 'seedance');
assert.ok(landing);
assert.equal(
  landing.metaTitle,
  'Seedance 2.5 AI Video Examples, Prompts & Settings | MaxVideoAI'
);
assert.match(landing.metaDescription, /^Explore Seedance 2\.5 video examples/);
assert.equal(
  landing.heroTitle,
  'Seedance 2.5 AI Video Examples, Prompts & Settings'
);
assert.match(landing.intro, /^Start with Seedance 2\.5/);
assert.match(landing.summary, /^Seedance 2\.5 is the flagship route/);
assert.doesNotMatch(landing.intro, /every example|all examples.*2\.5/i);
assert.deepEqual(getExampleFamilyCurrentModelSlugs('seedance').slice(0, 2), [
  'seedance-2-5',
  'seedance-2-0',
]);

const localizedLeadPatterns = {
  en: /^Start with Seedance 2\.5/,
  fr: /^Commencez par Seedance 2\.5/,
  es: /^Empieza con Seedance 2\.5/,
} as const;

for (const locale of ['en', 'fr', 'es'] as const) {
  const localizedLanding = getExampleModelLanding(locale, 'seedance');
  assert.ok(localizedLanding);
  assert.match(localizedLanding.metaTitle, /Seedance 2\.5/);
  assert.match(localizedLanding.metaDescription, /Seedance 2\.5/);
  assert.match(localizedLanding.heroTitle, /Seedance 2\.5/);
  assert.match(localizedLanding.intro, localizedLeadPatterns[locale]);
  assert.match(localizedLanding.summary, /^Seedance 2\.5/);
  assert.match(localizedLanding.intro, /Seedance 2\.0/);
  assert.match(localizedLanding.intro, /Fast/);
  assert.match(localizedLanding.intro, /Mini/);
}
```

Extend `tests/seo-internal-links.test.ts` with `EXPECTED_SEEDANCE_25_COMPARISON_TARGETS` beside `REQUIRED_SEEDANCE_25_TARGETS`, then assert it inside the existing locale loop while retaining the model-page-first assertion:

```ts
const EXPECTED_SEEDANCE_25_COMPARISON_TARGETS = {
  en: '/ai-video-engines/seedance-2-0-vs-seedance-2-5',
  fr: '/fr/comparatif/seedance-2-0-vs-seedance-2-5',
  es: '/es/comparativa/seedance-2-0-vs-seedance-2-5',
} as const;

assert.equal(examplesLinks[0]?.href, target);
assert.equal(examplesLinks[1]?.href, EXPECTED_SEEDANCE_25_COMPARISON_TARGETS[locale]);
assert.equal(examplesLinks.length, 5);
```

Add the structural guard in `tests/examples-route-architecture.test.ts` using the already loaded `pageViewSource`:

```ts
const gallerySectionIndex = pageViewSource.indexOf('<ExamplesGallerySection');
const nextStepsIndex = pageViewSource.indexOf('<ExamplesNextStepsSection');
assert.ok(gallerySectionIndex >= 0);
assert.ok(nextStepsIndex > gallerySectionIndex);
assert.match(
  pageViewSource,
  /<ExamplesIntroHero heroLead=\{heroLead\} heroSubtitle=\{heroSubtitle\} heroTitle=\{heroTitle\} \/>/,
);
```

The implementation must leave `examples-page-view.tsx` unchanged; the source-order assertion documents the existing below-gallery placement, while the exact hero assertion guards against adding an action/link prop.

- [ ] **Step 2: Run the focused examples tests and verify RED**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/examples-route-architecture.test.ts \
  tests/seo-internal-links.test.ts \
  tests/examples-commercial-copy.test.ts
```

Expected: FAIL because metadata, hero copy, summary, and the second next-step link are still Seedance 2.0-led.

- [ ] **Step 3: Update the English Seedance landing copy**

Set the English Seedance content to the following factual, compact contract:

```ts
seedance: {
  metaTitle: 'Seedance 2.5 AI Video Examples, Prompts & Settings | MaxVideoAI',
  metaDescription:
    'Explore Seedance 2.5 video examples and prompt patterns, then compare current Seedance 2.0, Fast, Mini and supported 1.5 Pro workflows.',
  heroTitle: 'Seedance 2.5 AI Video Examples, Prompts & Settings',
  subtitle:
    'Seedance examples, prompts and settings led by Seedance 2.5, with current and supported workflows kept in context.',
  intro:
    'Start with Seedance 2.5 for current 4–30 second, 720p, audio-enabled and reference-guided workflows, then compare Seedance 2.0, Fast and Mini examples without treating older renders as Seedance 2.5 output. Open a video first for its prompt and settings; use the model and comparison links below the gallery when you need the right route.',
  summary:
    'Seedance 2.5 is the flagship route for longer 720p workflows, generated audio, references, editing and extension. Seedance 2.0 remains available for higher-resolution and 4K intent, Fast and Mini cover draft or batch workflows, and Seedance 1.5 Pro remains supported as an older reference.',
  promptPatterns:
    'For Seedance 2.5, define one core action, camera direction and reference role before adding scene detail. Keep the same prompt structure when comparing 2.5 with Seedance 2.0, Fast or Mini.',
  strengthsLimits:
    'Use Seedance 2.5 when longer duration, generated audio, mixed references, editing or extension matter. Its public MaxVideoAI route is currently 16:9 at 480p or 720p, so keep Seedance 2.0 for higher-resolution or 4K intent.',
  pricingNotes:
    'Keep duration, audio choice and input class aligned when comparing Seedance routes. MaxVideoAI shows the current quote before generation; no authored price is embedded in this examples copy.',
  faq: [
    {
      question: 'Are all Seedance examples on this page generated with Seedance 2.5?',
      answer:
        'No. The gallery keeps factual labels for Seedance 2.5, Seedance 2.0, Fast, Mini and supported 1.5 Pro renders so you can compare the actual route used.',
    },
    {
      question: 'Which Seedance model should I start with for examples and prompt testing?',
      answer:
        'Start with Seedance 2.5 for the current flagship workflow. Use Seedance 2.0 for higher-resolution or 4K intent, Fast for quicker drafts, and Mini for repeatable batch variants.',
    },
    {
      question: 'What settings affect Seedance video pricing most?',
      answer:
        'Duration, generated audio and whether the workflow includes video input determine the main Seedance 2.5 quote class. Keep those settings aligned when comparing routes.',
    },
  ],
}
```

- [ ] **Step 4: Apply the exact factual French copy**

Replace the French `seedance` entry with this complete contract:

```ts
seedance: {
  metaTitle: 'Exemples vidéo IA Seedance 2.5, prompts et réglages | MaxVideoAI',
  metaDescription:
    'Découvrez des exemples vidéo Seedance 2.5 et leurs prompts, puis comparez les flux Seedance 2.0, Fast, Mini et 1.5 Pro encore pris en charge.',
  heroTitle: 'Exemples vidéo IA Seedance 2.5, prompts et réglages',
  subtitle:
    'Des exemples, prompts et réglages Seedance menés par Seedance 2.5, avec les flux actuels et encore pris en charge remis dans leur contexte.',
  intro:
    'Commencez par Seedance 2.5 pour les flux actuels de 4 à 30 secondes en 720p, avec audio généré et références, puis comparez les exemples Seedance 2.0, Fast et Mini sans présenter les anciens rendus comme des sorties Seedance 2.5. Ouvrez d’abord une vidéo pour voir son prompt et ses réglages; les liens modèle et comparatif restent sous la galerie.',
  summary:
    'Seedance 2.5 est la route phare pour les flux plus longs en 720p, l’audio généré, les références, l’édition et l’extension. Seedance 2.0 reste disponible pour les besoins de plus haute résolution et de 4K, Fast et Mini couvrent les brouillons ou les lots, et Seedance 1.5 Pro reste pris en charge comme ancien point de comparaison.',
  promptPatterns:
    'Pour Seedance 2.5, définissez une action principale, une direction caméra et le rôle de chaque référence avant d’ajouter les détails de scène. Gardez la même structure de prompt quand vous comparez 2.5 avec Seedance 2.0, Fast ou Mini.',
  strengthsLimits:
    'Utilisez Seedance 2.5 quand la durée, l’audio généré, les références mixtes, l’édition ou l’extension comptent. Sa route publique MaxVideoAI est actuellement en 16:9 à 480p ou 720p; gardez Seedance 2.0 pour les besoins de plus haute résolution ou de 4K.',
  pricingNotes:
    'Gardez la durée, le choix audio et la classe d’entrée alignés quand vous comparez les routes Seedance. MaxVideoAI affiche le devis actuel avant la génération; aucun prix rédigé en dur n’est intégré à ce texte d’exemples.',
  faq: [
    {
      question: 'Tous les exemples Seedance de cette page ont-ils été générés avec Seedance 2.5 ?',
      answer:
        'Non. La galerie conserve les libellés exacts des rendus Seedance 2.5, Seedance 2.0, Fast, Mini et 1.5 Pro encore pris en charge afin que vous puissiez comparer la route réellement utilisée.',
    },
    {
      question: 'Par quel modèle Seedance commencer pour les exemples et les tests de prompt ?',
      answer:
        'Commencez par Seedance 2.5 pour le flux phare actuel. Utilisez Seedance 2.0 pour les besoins de plus haute résolution ou de 4K, Fast pour des brouillons plus rapides et Mini pour des variantes répétables en lot.',
    },
    {
      question: 'Quels réglages influencent le plus le prix d’une vidéo Seedance ?',
      answer:
        'La durée, l’audio généré et la présence d’une vidéo en entrée déterminent la classe de devis principale de Seedance 2.5. Gardez ces réglages alignés quand vous comparez les routes.',
    },
  ],
}
```

- [ ] **Step 5: Apply the exact factual Spanish copy**

Replace the Spanish `seedance` entry with this complete contract:

```ts
seedance: {
  metaTitle: 'Ejemplos de video IA Seedance 2.5, prompts y ajustes | MaxVideoAI',
  metaDescription:
    'Explora ejemplos de video Seedance 2.5 y sus prompts, y compara los workflows Seedance 2.0, Fast, Mini y 1.5 Pro aún compatibles.',
  heroTitle: 'Ejemplos de video IA Seedance 2.5, prompts y ajustes',
  subtitle:
    'Ejemplos, prompts y ajustes de Seedance liderados por Seedance 2.5, con los workflows actuales y compatibles en contexto.',
  intro:
    'Empieza con Seedance 2.5 para los workflows actuales de 4 a 30 segundos en 720p, con audio generado y referencias, y compara después ejemplos de Seedance 2.0, Fast y Mini sin presentar renders anteriores como salidas de Seedance 2.5. Abre primero un video para ver su prompt y ajustes; los enlaces de modelo y comparativa permanecen bajo la galería.',
  summary:
    'Seedance 2.5 es la ruta principal para workflows más largos en 720p, audio generado, referencias, edición y extensión. Seedance 2.0 sigue disponible para necesidades de mayor resolución y 4K, Fast y Mini cubren borradores o lotes, y Seedance 1.5 Pro continúa compatible como referencia anterior.',
  promptPatterns:
    'Para Seedance 2.5, define una acción principal, la dirección de cámara y el papel de cada referencia antes de añadir detalles de escena. Mantén la misma estructura de prompt al comparar 2.5 con Seedance 2.0, Fast o Mini.',
  strengthsLimits:
    'Usa Seedance 2.5 cuando importen una mayor duración, el audio generado, las referencias mixtas, la edición o la extensión. Su ruta pública de MaxVideoAI está actualmente en 16:9 a 480p o 720p; conserva Seedance 2.0 para necesidades de mayor resolución o 4K.',
  pricingNotes:
    'Mantén alineados la duración, la elección de audio y la clase de entrada al comparar rutas Seedance. MaxVideoAI muestra la cotización actual antes de generar; este texto de ejemplos no incorpora ningún precio escrito de forma fija.',
  faq: [
    {
      question: '¿Todos los ejemplos de Seedance de esta página se generaron con Seedance 2.5?',
      answer:
        'No. La galería conserva las etiquetas exactas de los renders Seedance 2.5, Seedance 2.0, Fast, Mini y 1.5 Pro aún compatibles para que puedas comparar la ruta realmente utilizada.',
    },
    {
      question: '¿Con qué modelo Seedance debería empezar para ejemplos y pruebas de prompt?',
      answer:
        'Empieza con Seedance 2.5 para el workflow principal actual. Usa Seedance 2.0 para necesidades de mayor resolución o 4K, Fast para borradores más rápidos y Mini para variantes repetibles por lotes.',
    },
    {
      question: '¿Qué ajustes afectan más al precio de un video Seedance?',
      answer:
        'La duración, el audio generado y la presencia de video como entrada determinan la clase principal de cotización de Seedance 2.5. Mantén estos ajustes alineados al comparar rutas.',
    },
  ],
}
```

- [ ] **Step 6: Replace only the second existing Seedance next-step link**

In `buildExamplesNextStepLinks`, keep the first Seedance 2.5 model-page link unchanged and replace the current second comparison object with:

```ts
{
  href: buildCompareHref(appLocale, 'seedance-2-0-vs-seedance-2-5'),
  label:
    locale === 'fr'
      ? 'Comparer Seedance 2.0 vs Seedance 2.5'
      : locale === 'es'
        ? 'Comparar Seedance 2.0 vs Seedance 2.5'
        : 'Compare Seedance 2.0 vs Seedance 2.5',
},
```

Do not change `examples-page-view.tsx`, `examples-route-sections.tsx`, or any pre-gallery component.

- [ ] **Step 7: Run focused examples, internal-link, SEO, and i18n checks**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/examples-route-architecture.test.ts \
  tests/examples-commercial-copy.test.ts \
  tests/model-landing-data-architecture.test.ts \
  tests/seo-internal-links.test.ts \
  tests/seedance-2-5-marketing-page.test.ts \
  tests/premerge-seo-routes.test.ts
pnpm --prefix frontend run i18n:check
pnpm --prefix frontend run seo:check
```

Expected: all checks PASS; current model ordering remains `2.5, 2.0, Fast, Mini`; no examples layout component changes.

- [ ] **Step 8: Commit the examples content and linking change**

```bash
git add \
  frontend/lib/examples/modelLandingData.en.ts \
  frontend/lib/examples/modelLandingData.fr.ts \
  frontend/lib/examples/modelLandingData.es.ts \
  'frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-copy.ts' \
  tests/examples-route-architecture.test.ts \
  tests/seo-internal-links.test.ts \
  tests/examples-commercial-copy.test.ts
git commit -m "feat: lead Seedance examples with 2.5"
```

---

### Task 3: Verify the Final Linking State Without Delaying the Gallery

**Files:**
- Modify: `docs/model-launch/seedance-2-5.md`
- Test: no new test file; consume Tasks 1–2 contracts.

**Interfaces:**
- Consumes: the shared dropdown item, localized Seedance landing copy, registry-derived model order, and below-gallery next-step links from Tasks 1–2.
- Produces: a clean source SHA and recorded verification evidence ready for the separate localized-routing fix and later deployment gate.

- [ ] **Step 1: Confirm exact commit and worktree boundaries**

Run:

```bash
git status --short --branch
git log --oneline -8
git diff --check
```

Expected: only intentional linking commits are ahead of the approved launch state; worktree is clean.

- [ ] **Step 2: Run the complete focused linking suite**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/seedance-prelaunch.test.ts \
  tests/marketing-navigation.test.ts \
  tests/navigation-surfaces-architecture.test.ts \
  tests/examples-route-architecture.test.ts \
  tests/examples-commercial-copy.test.ts \
  tests/model-landing-data-architecture.test.ts \
  tests/seo-internal-links.test.ts \
  tests/comparison-content-contract.test.ts \
  tests/premerge-seo-routes.test.ts \
  tests/seedance-2-5-marketing-page.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run repository validation and production build**

Run:

```bash
pnpm test:validate
pnpm --prefix frontend run lint
pnpm lint:exposure
pnpm --prefix frontend run i18n:check
pnpm --prefix frontend run seo:check
pnpm --prefix frontend exec tsc --noEmit --pretty false
pnpm --prefix frontend run build
git diff --check
```

Expected: every command exits 0; full test count is at least the current 2,492; build still emits 729 static pages unless another intentional route change alters that count.

- [ ] **Step 4: Perform a local read-only visual smoke**

With the development server running, inspect desktop and mobile states for:

```text
/models/seedance-2-5
/examples/seedance
/ai-video-engines/seedance-2-0-vs-seedance-2-5
```

Verify:

```text
- Compare dropdown has six items; 2.0 vs 2.5 is first and displays New.
- Seedance hero copy leads with 2.5 but adds no new visual block or action row.
- Main video/gallery position is unchanged relative to the hero and existing model links.
- Existing model links lead with Seedance 2.5.
- The 2.0 vs 2.5 comparison appears only in Next steps below the gallery.
- No Generate button is pressed.
```

Do not use the currently looping FR/ES preview routes as evidence until the separate routing defect is fixed.

- [ ] **Step 5: Record current evidence in the launch handoff**

First run `git rev-parse HEAD` and retain the exact 40-character output. Then append a section headed `### Internal linking and examples refresh — 2026-08-08` to `docs/model-launch/seedance-2-5.md` with these facts:

- `Verified source SHA:` followed by the exact `git rev-parse HEAD` output from the completed Tasks 1–2.
- `Compare dropdown:` six items; Seedance 2.0 vs Seedance 2.5 first with localized `New`.
- `Seedance examples:` EN/FR/ES copy led by 2.5; existing gallery layout unchanged; 2.0 vs 2.5 linked only below the gallery.
- `Focused suite:` PASS, followed by the exact test count printed by Step 2.
- `Full validation:` PASS, followed by the exact test count printed by `pnpm test:validate` in Step 3.
- `Production build:` PASS, followed by the exact static-page count printed by the build in Step 3.
- `Local smoke:` PASS for the EN menu, examples, and comparison routes; no generation submitted.
- `Deployment:` still blocked until the separate localized-route self-redirect is fixed and reverified.

Copy counts from command output; do not estimate or write a template value.

- [ ] **Step 6: Commit verification evidence**

```bash
git add docs/model-launch/seedance-2-5.md
git commit -m "docs: verify Seedance 2.5 examples linking"
```

Do not push or deploy.
