# Model Prompting Content Organization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every model-specific Prompt Lab projection into the existing localized model JSON documents, preserve current behavior except 18 reviewed objective corrections, and reduce the decision Prompt Lab component to a focused renderer.

**Architecture:** `getEngineLocalized` exposes only the requested locale's raw `prompting` object. A strict route-local parser validates editorial content, a pure builder combines it with current media and capability inputs, and the server renderer consumes the resulting view model. A temporary legacy projector and converter prove exact 40-model-by-3-locale parity before all `custom` prompt fields and TypeScript fallback trees are deleted.

**Tech Stack:** Next.js 15 App Router, React 18 Server/Client Components, TypeScript 5.4, Zod 3, Node test runner through `tsx`, JSON localized content, pnpm 10.

## Global Constraints

- Start from the linked worktree on local `main`; preserve unrelated user changes and re-check `git status --short --branch` before every commit.
- Read root `AGENTS.md`, `docs/engineering/llm-working-guide.md`, and `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/AGENTS.md` before execution.
- All 40 configured models and all 120 `en`/`fr`/`es` documents must contain a non-null top-level `prompting` object.
- Model-specific Prompt Lab editorial content has exactly one final owner: `content/models/{locale}/{slug}.json#prompting`.
- `prompting` is exact-locale content. Never use `overlay.prompting ?? base.prompting`, an English fallback, a compatibility map, or a second filesystem loader.
- Preserve exact visible content, ordering, links, and conditional presence except the 18 approved corrections listed below: four wrong-locale guide links and 14 wrong-language customer-visible strings.
- Do not rewrite style, tone, prompts, model claims, or localized prose during migration.
- Do not change public routes, redirects, canonical, hreflang, metadata, JSON-LD, sitemap policy, model registry, pricing, billing, capability configuration, or media selection.
- Keep numeric prices and runtime facts out of prompting JSON. Media, duration, aspect ratio, audio state, and workspace destinations remain derived.
- `ModelDecisionPromptingSection.tsx` must finish at or below 300 physical lines; the parser and view-model builder at or below 300 each; UI copy at or below 180.
- `ModelExamplesSection.tsx` is out of scope.
- Use `apply_patch` for authored edits. The one-time converter may perform the mechanical 120-document rewrite.
- Every task follows red-green-refactor, runs its focused tests, and ends in a reviewable commit.

### Approved objective corrections

The migration parity allowlist contains exactly these 18 entries:

| # | Slug | Locale | Path | Exact old value | Exact new value | Objective evidence |
|---:|---|---|---|---|---|---|
| 1 | `dreamina-seedance-2-0-mini` | `fr` | `section.guide.href` | `/models/dreamina-seedance-2-0-mini` | `/fr/modeles/dreamina-seedance-2-0-mini` | `MODELS_BASE_PATH_MAP.fr` is `/fr/modeles`. |
| 2 | `dreamina-seedance-2-0-mini` | `es` | `section.guide.href` | `/models/dreamina-seedance-2-0-mini` | `/es/modelos/dreamina-seedance-2-0-mini` | `MODELS_BASE_PATH_MAP.es` is `/es/modelos`. |
| 3 | `seedance-2-0-fast` | `fr` | `section.guide.href` | `/models/seedance-2-0` | `/fr/modeles/seedance-2-0` | `MODELS_BASE_PATH_MAP.fr` is `/fr/modeles`. |
| 4 | `seedance-2-0-fast` | `es` | `section.guide.href` | `/models/seedance-2-0` | `/es/modelos/seedance-2-0` | `MODELS_BASE_PATH_MAP.es` is `/es/modelos`. |
| 5 | `luma-uni-1` | `fr` | `imageExamples.intro` | `Exemples adaptés aux stills campagne, typographie, retouches et finales 4K.` | `Exemples adaptés aux visuels de campagne, à la typographie, aux retouches et aux rendus finaux 4K.` | The existing localized-content forbidden-term contract rejects English `still`/`stills` in customer-facing French copy. |
| 6 | `luma-uni-1` | `fr` | `imageExamples.items.0.badge` | `2K still` | `Visuel 2K` | Same localized-content contract. |
| 7 | `luma-uni-1` | `fr` | `imageExamples.items.0.prompt` | `Still campagne 2K pour une bouteille de parfum ambrée sur acrylique blanc, lumière studio douce, ombre propre, headline exact "AURA NOIRE" en haut à gauche, logo discret en bas.` | `Visuel de campagne 2K pour une bouteille de parfum ambrée sur acrylique blanc, lumière studio douce, ombre propre, headline exact "AURA NOIRE" en haut à gauche, logo discret en bas.` | Same localized-content contract. |
| 8 | `luma-uni-1-max` | `fr` | `imageExamples.intro` | `Exemples adaptés aux stills campagne, typographie, retouches et finales 4K.` | `Exemples adaptés aux visuels de campagne, à la typographie, aux retouches et aux rendus finaux 4K.` | Same localized-content contract. |
| 9 | `luma-uni-1-max` | `fr` | `imageExamples.items.0.badge` | `2K still` | `Visuel 2K` | Same localized-content contract. |
| 10 | `luma-uni-1-max` | `fr` | `imageExamples.items.0.prompt` | `Still campagne 2K pour une bouteille de parfum ambrée sur acrylique blanc, lumière studio douce, ombre propre, headline exact "AURA NOIRE" en haut à gauche, logo discret en bas.` | `Visuel de campagne 2K pour une bouteille de parfum ambrée sur acrylique blanc, lumière studio douce, ombre propre, headline exact "AURA NOIRE" en haut à gauche, logo discret en bas.` | Same localized-content contract. |
| 11 | `luma-uni-1` | `es` | `imageExamples.intro` | `Ejemplos para stills de campaña, tipografía, ediciones con referencia y finales 4K.` | `Ejemplos para imágenes de campaña, tipografía, ediciones con referencia y finales 4K.` | The existing localized-content forbidden-term contract rejects English `still`/`stills` in customer-facing Spanish copy. |
| 12 | `luma-uni-1` | `es` | `imageExamples.items.0.title` | `Still de campaña` | `Imagen de campaña` | Same localized-content contract. |
| 13 | `luma-uni-1` | `es` | `imageExamples.items.0.badge` | `Still 2K` | `Imagen 2K` | Same localized-content contract. |
| 14 | `luma-uni-1` | `es` | `imageExamples.items.0.prompt` | `Still de campaña 2K para una botella de perfume ámbar sobre acrílico blanco, luz de estudio suave, sombra limpia, headline exacto "AURA NOIRE" arriba a la izquierda, logo discreto abajo.` | `Imagen de campaña 2K para una botella de perfume ámbar sobre acrílico blanco, luz de estudio suave, sombra limpia, headline exacto "AURA NOIRE" arriba a la izquierda, logo discreto abajo.` | Same localized-content contract. |
| 15 | `luma-uni-1-max` | `es` | `imageExamples.intro` | `Ejemplos para stills de campaña, tipografía, ediciones con referencia y finales 4K.` | `Ejemplos para imágenes de campaña, tipografía, ediciones con referencia y finales 4K.` | Same localized-content contract. |
| 16 | `luma-uni-1-max` | `es` | `imageExamples.items.0.title` | `Still de campaña` | `Imagen de campaña` | Same localized-content contract. |
| 17 | `luma-uni-1-max` | `es` | `imageExamples.items.0.badge` | `Still 2K` | `Imagen 2K` | Same localized-content contract. |
| 18 | `luma-uni-1-max` | `es` | `imageExamples.items.0.prompt` | `Still de campaña 2K para una botella de perfume ámbar sobre acrílico blanco, luz de estudio suave, sombra limpia, headline exacto "AURA NOIRE" arriba a la izquierda, logo discreto abajo.` | `Imagen de campaña 2K para una botella de perfume ámbar sobre acrílico blanco, luz de estudio suave, sombra limpia, headline exacto "AURA NOIRE" arriba a la izquierda, logo discreto abajo.` | Same localized-content contract. |

The `kind: "layout"` value is a non-customer semantic enum and is excluded by key from the existing localized-content string scan; `prompting` itself remains fully scanned. Any nineteenth difference is a failed migration unless it is independently evidenced, added to the design specification, and protected by a focused permanent assertion before cutover.

## File Structure

### Permanent files to create

- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content.ts` — strict Zod contract, identity check, relational validation, and locale-aware guide-link validation.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-ui-copy.ts` — generic `en`/`fr`/`es` Prompt Lab interface labels only.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-view-model.ts` — pure runtime derivation and render-ready types.
- `tests/model-prompting-content-contract.test.ts` — permanent 40-by-3 inventory, strictness, structural parity, locale, and correction contract.
- `tests/model-prompting-view-model.test.ts` — pure builder matrix for media, prompt source, audio, duration, aspect, and workspace routes.
- `tests/model-prompting-architecture.test.ts` — permanent ownership and line-cap rules.

### Permanent files to modify

- `frontend/lib/models/i18n.ts` — expose `prompting?: unknown` from the requested overlay only.
- `content/models/en/*.json`, `content/models/fr/*.json`, `content/models/es/*.json` — add top-level `prompting` in Task 3, then remove only Prompt Lab-owned `custom` keys in Task 6.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx` — parse once, build once, pass one view model.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelPromptingSection.tsx` — consume the view model in both render variants.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionPromptingSection.tsx` — renderer only.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionPromptTabs.client.tsx` — receive labels and URLs instead of deriving locale or engine routes.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-copy.ts` — remove Prompt Lab parsing from `custom`.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-specs-types.ts` — remove Prompt Lab fields from `SoraCopy`.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-specs.ts` — remove obsolete Prompt Lab type exports if no consumer remains.
- `frontend/scripts/scaffold-model-page.ts` — retarget `prompting.modelSlug` for new model scaffolds.
- `scripts/model-setup.mjs` — require explicit localized Prompt Lab review in setup instructions.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/AGENTS.md` — document final prompting ownership and boundaries.
- `tests/model-page-layout-architecture.test.ts` — replace source-string ownership assertions with the new parser/builder/renderer contract.
- `tests/kling-o3-model-pages.test.ts` — assert O3 prompting through parsed localized content, not fallback source strings.
- `tests/gemini-omni-marketing-surfaces.test.ts` — assert Omni prompting through parsed localized content.
- `tests/model-page-template-content.test.ts` — retain visible content checks through the new contract.
- `tests/model-setup-cli.test.ts` — require prompting identity retargeting and localized review instructions.

### Temporary migration files to create and delete in this project

- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-legacy.ts` — pure normalized projection of the existing TypeScript behavior.
- `scripts/model-prompting-corrections.ts` — the 18-entry allowlist and exact path replacement helper.
- `scripts/migrate-model-prompting-content.ts` — dry-run/write converter and legacy-key remover.
- `tests/model-prompting-legacy-projection.test.ts` — old/new deep parity while both representations exist.

---

### Task 1: Lock the strict Prompt Lab content contract and generic UI vocabulary

**Files:**

- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-ui-copy.ts`
- Create: `tests/model-prompting-content-contract.test.ts`

**Interfaces:**

- Produces: `parseModelPromptingContent(input, expectedSlug, locale, source?): ModelPromptingContent`.
- Produces: `getModelPromptingUiCopy(locale): ModelPromptingUiCopy`.
- `ModelPromptingContent` is the exact normalized schema approved in the design; Tasks 2–6 import this type instead of defining parallel shapes.

- [ ] **Step 1: Write failing parser and UI-copy tests**

Create a complete valid fixture and rejection cases before creating either production module:

```ts
function validPromptingFixture() {
  return {
    modelSlug: 'fixture-model',
    section: {
      title: 'How to prompt Fixture',
      intro: 'Fixture introduction',
      tip: 'Fixture tip',
      guide: { label: 'Fixture guide', href: '/models/fixture-model' },
      referencesTitle: 'How Fixture uses references',
    },
    tabs: [{ id: 'quick', label: 'Quick', title: 'Quick prompt', description: null, copy: 'Subject, action, camera' }],
    tabNotes: [{ tabId: 'quick', body: 'Keep the subject explicit.' }],
    globalPrinciples: ['Lead with the subject.'],
    engineWhy: ['Fixture follows explicit camera direction.'],
    demo: {
      title: 'Fixture demo',
      promptLabel: 'Text prompt',
      prompt: 'A chef works at a night market.',
      notes: [],
      summary: {
        subject: 'Night-market chef',
        action: 'Prepares noodles',
        camera: 'Slow push-in',
        style: 'Cinematic documentary',
        output: 'Market ambience',
      },
      presentationOverrides: {
        modeLabel: 'Text-to-video',
        outputLabel: 'Audio',
        duration: null,
        aspectRatio: null,
        audioChipMode: 'media',
        audioChipLabel: null,
        altContext: 'Fixture night-market render',
      },
    },
    imageExamples: null,
  };
}

test('prompting parser rejects missing, identity mismatch, unknown fields, blanks, and dangling tab notes', () => {
  assert.throws(
    () => parseModelPromptingContent(undefined, 'fixture-model', 'en', 'missing.json'),
    /Missing prompting content.*fixture-model.*en/
  );
  assert.throws(
    () => parseModelPromptingContent({ ...validPromptingFixture(), modelSlug: 'other-model' }, 'fixture-model', 'en'),
    /identity mismatch/i
  );
  assert.throws(
    () => parseModelPromptingContent({ ...validPromptingFixture(), extra: true }, 'fixture-model', 'en'),
    /Invalid prompting content/
  );
  assert.throws(
    () => parseModelPromptingContent({ ...validPromptingFixture(), section: { ...validPromptingFixture().section, title: '   ' } }, 'fixture-model', 'en'),
    /Expected a non-empty string/
  );
  assert.throws(
    () => parseModelPromptingContent({ ...validPromptingFixture(), tabNotes: [{ tabId: 'missing', body: 'Dangling' }] }, 'fixture-model', 'en'),
    /unknown tab/i
  );
});

test('prompting guide hrefs accept HTTPS and only the current internal locale family', () => {
  const accepted = {
    en: '/models/fixture-model',
    fr: '/fr/modeles/fixture-model',
    es: '/es/modelos/fixture-model',
  } as const;
  for (const locale of ['en', 'fr', 'es'] as const) {
    const local = validPromptingFixture();
    local.section.guide = { label: 'Local guide', href: accepted[locale] };
    assert.doesNotThrow(() => parseModelPromptingContent(local, 'fixture-model', locale));
    const external = validPromptingFixture();
    external.section.guide = { label: 'Official guide', href: 'https://developers.openai.com/example' };
    assert.doesNotThrow(() => parseModelPromptingContent(external, 'fixture-model', locale));
  }
  const crossed = validPromptingFixture();
  crossed.section.guide = { label: 'Wrong locale', href: '/models/fixture-model' };
  assert.throws(() => parseModelPromptingContent(crossed, 'fixture-model', 'fr'), /Invalid fr guide href/);
});

test('generic UI copy is complete and contains no model identity', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = getModelPromptingUiCopy(locale);
    assert.ok(Object.values(copy).every((value) => typeof value === 'string' && value.trim().length > 0));
    assert.doesNotMatch(JSON.stringify(copy), /seedance|kling|veo|sora|nano banana/i);
  }
});
```

- [ ] **Step 2: Run the new test and verify the red state**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-prompting-content-contract.test.ts
```

Expected: FAIL because `model-page-prompting-content.ts` and `model-page-prompting-ui-copy.ts` do not exist.

- [ ] **Step 3: Implement the strict parser**

Use strict Zod objects and one relational pass. The production contract must follow this structure and export only the inferred type plus parser:

```ts
const nonEmptyString = z.string().refine((value) => value.trim().length > 0, 'Expected a non-empty string');
const nullableString = nonEmptyString.nullable();
const tabSchema = z.object({
  id: nonEmptyString,
  label: nonEmptyString,
  title: nonEmptyString,
  description: nullableString,
  copy: nonEmptyString,
}).strict();
const demoSchema = z.object({
  title: nonEmptyString,
  promptLabel: nonEmptyString,
  prompt: nonEmptyString,
  notes: z.array(nonEmptyString),
  summary: z.object({
    subject: nonEmptyString,
    action: nonEmptyString,
    camera: nonEmptyString,
    style: nonEmptyString,
    output: nonEmptyString,
  }).strict(),
  presentationOverrides: z.object({
    modeLabel: nonEmptyString,
    outputLabel: nonEmptyString,
    duration: nullableString,
    aspectRatio: nullableString,
    audioChipMode: z.enum(['media', 'supported', 'on', 'off', 'silent']),
    audioChipLabel: nullableString,
    altContext: nonEmptyString,
  }).strict(),
}).strict();
const imageExampleSchema = z.object({
  id: nonEmptyString,
  title: nonEmptyString,
  badge: nonEmptyString,
  kind: z.enum(['image', 'references', 'edit', 'typography', 'layout', 'quality']),
  prompt: nonEmptyString,
}).strict();
const promptingSchema = z.object({
  modelSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  section: z.object({
    title: nonEmptyString,
    intro: nullableString,
    tip: nullableString,
    guide: z.object({ label: nonEmptyString, href: nonEmptyString }).strict().nullable(),
    referencesTitle: nullableString,
  }).strict(),
  tabs: z.array(tabSchema),
  tabNotes: z.array(z.object({ tabId: nonEmptyString, body: nonEmptyString }).strict()),
  globalPrinciples: z.array(nonEmptyString),
  engineWhy: z.array(nonEmptyString),
  demo: demoSchema.nullable(),
  imageExamples: z.object({
    title: nonEmptyString,
    intro: nonEmptyString,
    workspaceLabel: nonEmptyString,
    items: z.array(imageExampleSchema).min(1),
  }).strict().nullable(),
}).strict();

export type ModelPromptingContent = z.infer<typeof promptingSchema>;

const INTERNAL_GUIDE_HREF: Record<AppLocale, RegExp> = {
  en: /^\/models\/[a-z0-9]+(?:-[a-z0-9]+)*$/,
  fr: /^\/fr\/modeles\/[a-z0-9]+(?:-[a-z0-9]+)*$/,
  es: /^\/es\/modelos\/[a-z0-9]+(?:-[a-z0-9]+)*$/,
};

function isAllowedGuideHref(href: string, locale: AppLocale): boolean {
  return /^https:\/\/[^\s]+$/.test(href) || INTERNAL_GUIDE_HREF[locale].test(href);
}

export function parseModelPromptingContent(
  input: unknown,
  expectedSlug: string,
  locale: AppLocale,
  source = `content/models/${locale}/${expectedSlug}.json#prompting`,
): ModelPromptingContent {
  if (input === undefined) {
    throw new Error(`[model-prompting-content] Missing prompting content for ${expectedSlug}/${locale} in ${source}`);
  }
  const result = promptingSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`).join('; ');
    throw new Error(`[model-prompting-content] Invalid prompting content in ${source}: ${issues}`);
  }
  if (result.data.modelSlug !== expectedSlug) {
    throw new Error(`[model-prompting-content] Model identity mismatch in ${source}: expected ${expectedSlug}, received ${result.data.modelSlug}`);
  }
  const tabIds = new Set(result.data.tabs.map((tab) => tab.id));
  if (tabIds.size !== result.data.tabs.length) throw new Error(`[model-prompting-content] Duplicate tab id in ${source}`);
  const notedTabIds = new Set<string>();
  for (const note of result.data.tabNotes) {
    if (!tabIds.has(note.tabId)) throw new Error(`[model-prompting-content] Tab note references unknown tab ${note.tabId} in ${source}`);
    if (notedTabIds.has(note.tabId)) throw new Error(`[model-prompting-content] Duplicate tab note for ${note.tabId} in ${source}`);
    notedTabIds.add(note.tabId);
  }
  const exampleIds = result.data.imageExamples?.items.map((item) => item.id) ?? [];
  if (new Set(exampleIds).size !== exampleIds.length) {
    throw new Error(`[model-prompting-content] Duplicate image example id in ${source}`);
  }
  if (Boolean(result.data.demo) === Boolean(result.data.imageExamples)) {
    throw new Error(`[model-prompting-content] Expected exactly one demo or imageExamples block in ${source}`);
  }
  const guideHref = result.data.section.guide?.href;
  if (guideHref && !isAllowedGuideHref(guideHref, locale)) {
    throw new Error(`[model-prompting-content] Invalid ${locale} guide href in ${source}: ${JSON.stringify(guideHref)}`);
  }
  return result.data;
}
```

`isAllowedGuideHref` accepts `https://` URLs and only `/models/...`, `/fr/modeles/...`, or `/es/modelos/...` for the matching locale. It rejects protocol-relative URLs, whitespace, crossed locale prefixes, and bare relative strings.

- [ ] **Step 4: Implement the generic UI-copy table**

The table contains the union of current `getPromptLabels` and client-tab labels, with no model interpolation:

```ts
export type ModelPromptingUiCopy = {
  tipPrefix: string;
  global: string;
  quirks: string;
  subject: string;
  action: string;
  camera: string;
  style: string;
  audio: string;
  output: string;
  viewFull: string;
  showPrompt: string;
  copyPrompt: string;
  copyTemplate: string;
  copied: string;
  example: string;
  viewRender: string;
  usePrompt: string;
  textToVideo: string;
  audioOn: string;
  audioOff: string;
  silent: string;
  demoPreview: string;
};

const COPY: Record<AppLocale, ModelPromptingUiCopy> = {
  en: { tipPrefix: 'Tip', global: 'Global principles', quirks: 'Engine quirks / what to watch for', subject: 'Subject', action: 'Action', camera: 'Camera', style: 'Style', audio: 'Audio', output: 'Output', viewFull: 'View full render', showPrompt: 'View full prompt', copyPrompt: 'Copy prompt', copyTemplate: 'Copy template', copied: 'Copied', example: 'EXAMPLE', viewRender: 'View example render', usePrompt: 'Use this prompt', textToVideo: 'Text-to-video', audioOn: 'Audio on', audioOff: 'Audio off', silent: 'Silent', demoPreview: 'Demo preview.' },
  fr: { tipPrefix: 'Astuce', global: 'Principes globaux', quirks: 'Points moteur à surveiller', subject: 'Sujet', action: 'Action', camera: 'Caméra', style: 'Style', audio: 'Audio', output: 'Sortie', viewFull: 'Voir le rendu complet', showPrompt: 'Voir le prompt complet', copyPrompt: 'Copier le prompt', copyTemplate: 'Copier le template', copied: 'Copié', example: 'EXEMPLE', viewRender: 'Voir le rendu exemple', usePrompt: 'Utiliser ce prompt', textToVideo: 'Texte-vers-vidéo', audioOn: 'Audio activé', audioOff: 'Audio désactivé', silent: 'Silencieux', demoPreview: 'Aperçu de démonstration.' },
  es: { tipPrefix: 'Consejo', global: 'Principios globales', quirks: 'Puntos del motor a vigilar', subject: 'Sujeto', action: 'Acción', camera: 'Cámara', style: 'Estilo', audio: 'Audio', output: 'Salida', viewFull: 'Ver resultado completo', showPrompt: 'Ver prompt completo', copyPrompt: 'Copiar prompt', copyTemplate: 'Copiar plantilla', copied: 'Copiado', example: 'EJEMPLO', viewRender: 'Ver ejemplo', usePrompt: 'Usar este prompt', textToVideo: 'Texto a video', audioOn: 'Audio activado', audioOff: 'Audio desactivado', silent: 'Sin audio', demoPreview: 'Vista previa de demostración.' },
};

export function getModelPromptingUiCopy(locale: AppLocale): ModelPromptingUiCopy {
  return COPY[locale];
}
```

- [ ] **Step 5: Run focused tests and line checks**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-prompting-content-contract.test.ts
wc -l 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content.ts' 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-ui-copy.ts'
git diff --check
```

Expected: parser/UI tests PASS; parser is at or below 300 lines; UI copy is at or below 180; diff check is clean.

- [ ] **Step 6: Commit the contract**

```bash
git add tests/model-prompting-content-contract.test.ts 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content.ts' 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-ui-copy.ts'
git commit -m "feat: add strict model prompting contract"
```

### Task 2: Isolate and characterize the effective legacy projection

**Files:**

- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-legacy.ts`
- Create: `scripts/model-prompting-corrections.ts`
- Create: `tests/model-prompting-legacy-projection.test.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelPromptingSection.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionPromptingSection.tsx`

**Interfaces:**

- Consumes: `ModelPromptingContent` from Task 1 and existing `SoraCopy`.
- Produces temporarily: `buildLegacyModelPromptingContent(args): ModelPromptingContent`, `resolveLegacyPromptingModelName(args): string`, and the exact 18-entry correction helper used only by tests/migration tooling.
- The current component must consume this normalized projection so the existing 69-test baseline proves the extraction before JSON cutover.

- [ ] **Step 1: Add a failing legacy-projection architecture test**

```ts
test('legacy prompting decisions are isolated behind one temporary pure projector', () => {
  assert.ok(existsSync(legacyPath));
  assert.match(legacySource, /export function buildLegacyModelPromptingContent/);
  assert.match(componentSource, /buildLegacyModelPromptingContent/);
  assert.doesNotMatch(componentSource, /function getKlingO3PromptingTabs|function getImagePromptExamples|function getRouteDemoSummary/);
});
```

Add a 40-by-3 loop that builds the projection from current localized JSON/copy, applies `applyApprovedPromptingCorrections` to the test value, parses it with `parseModelPromptingContent`, asserts `modelSlug`, and verifies `demo === null` only for image models and `imageExamples === null` only for video models. The component continues to render the uncorrected legacy projection until the JSON cutover, so Task 2 remains behavior-preserving.

- [ ] **Step 2: Run the test and verify the red state**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-prompting-legacy-projection.test.ts
```

Expected: FAIL because the legacy projector does not exist and the component still owns the helper tree.

- [ ] **Step 3: Move legacy editorial selection into one pure module**

Create `scripts/model-prompting-corrections.ts` first with the exact 18 entries from Global Constraints and a shared immutable helper that asserts each exact old value before replacing its known path:

```ts
export function applyApprovedPromptingCorrections(
  content: ModelPromptingContent,
  slug: string,
  locale: AppLocale,
): ModelPromptingContent;
```

The helper verifies the old path before replacement and throws if the source value differs. Task 2 uses it only in characterization tests; production rendering remains byte-identical.

Move the existing localized helper bodies and model branches without editing their strings. Normalize their output at one public boundary:

```ts
export function buildLegacyModelPromptingContent({
  copy,
  engineId,
  isImageEngine,
  locale,
  modelName,
  modelSlug,
}: {
  copy: SoraCopy;
  engineId: string;
  isImageEngine: boolean;
  locale: AppLocale;
  modelName: string;
  modelSlug: string;
}): ModelPromptingContent {
  const labels = getPromptLabels(locale, modelName);
  const demoProfile = isImageEngine ? null : resolveLegacyDemoProfile({ copy, engineId, locale, labels });
  const imageExamples = isImageEngine ? resolveLegacyImageExamples({ engineId, locale, labels }) : null;

  return {
    modelSlug,
    section: {
      title: copy.promptingTitle ?? getRoutePromptingTitle(locale, engineId, modelName),
      intro: copy.promptingIntro?.trim() ? copy.promptingIntro : null,
      tip: copy.promptingTip?.trim() ? copy.promptingTip : null,
      guide: copy.promptingGuideUrl && copy.promptingGuideLabel
        ? { label: copy.promptingGuideLabel, href: copy.promptingGuideUrl }
        : null,
      referencesTitle: resolveLegacyReferencesTitle(locale, engineId, modelName),
    },
    tabs: resolveLegacyTabs(copy, locale, engineId),
    tabNotes: Object.entries(copy.promptingTabNotes).flatMap(([tabId, body]) =>
      typeof body === 'string' && body.trim() ? [{ tabId, body }] : []
    ),
    globalPrinciples: resolveLegacyGlobalPrinciples(copy, locale, engineId),
    engineWhy: resolveLegacyEngineWhy(copy, locale, engineId),
    demo: demoProfile,
    imageExamples,
  };
}
```

The moved module must not read files, media, browser state, prices, or routes outside existing editorial guide links. Convert image-example Lucide components into stable semantic `kind` values at the projector boundary; keep the icon mapping in the renderer.

Keep the private normalization seams typed as follows; their bodies are the current helper branches moved without prose edits:

```ts
type LegacyPromptingLabels = ReturnType<typeof getPromptLabels>;

function resolveLegacyDemoProfile(args: {
  copy: SoraCopy;
  engineId: string;
  locale: AppLocale;
  labels: LegacyPromptingLabels;
}): NonNullable<ModelPromptingContent['demo']>;

function resolveLegacyImageExamples(args: {
  engineId: string;
  locale: AppLocale;
  labels: LegacyPromptingLabels;
}): NonNullable<ModelPromptingContent['imageExamples']>;

function resolveLegacyReferencesTitle(locale: AppLocale, engineId: string, modelName: string): string;
function resolveLegacyTabs(copy: SoraCopy, locale: AppLocale, engineId: string): ModelPromptingContent['tabs'];
function resolveLegacyGlobalPrinciples(copy: SoraCopy, locale: AppLocale, engineId: string): string[];
function resolveLegacyEngineWhy(copy: SoraCopy, locale: AppLocale, engineId: string): string[];
```

Use one shared model-name resolver in both the temporary component and converter so generic legacy titles materialize identically:

```ts
export function resolveLegacyPromptingModelName({
  copy,
  engine,
  localized,
}: {
  copy: SoraCopy;
  engine: FalEngineEntry;
  localized: Pick<EngineLocalizedContent, 'hero' | 'marketingName'>;
}): string {
  const rawTitle = copy.heroTitle ?? localized.hero?.title ?? localized.marketingName ?? 'Sora 2';
  return normalizeHeroTitle(rawTitle, resolveProviderInfo(engine).name);
}
```

- [ ] **Step 4: Make the existing component render the normalized legacy projection**

Replace its editorial declarations with one call:

```ts
const content = buildLegacyModelPromptingContent({
  copy,
  engineId: engineSlug,
  isImageEngine,
  locale,
  modelName,
  modelSlug,
});
```

Add canonical `modelSlug` to the temporary `ModelPromptingSection` and `ModelDecisionPromptingSection` props and pass `engine.modelSlug` from the layout. Do not infer identity from `engineSlug` because aliases and provider engine IDs may differ. Retain only runtime media derivation in the component during this temporary stage.

- [ ] **Step 5: Run the extraction and baseline tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/model-prompting-legacy-projection.test.ts \
  tests/model-page-layout-architecture.test.ts \
  tests/model-page-template-content.test.ts \
  tests/model-page-decision-data.test.ts \
  tests/kling-o3-model-pages.test.ts \
  tests/gemini-omni-marketing-surfaces.test.ts
```

Expected: all tests PASS with no visible-content assertion changes. The original focused baseline remains 69 passes, plus the new legacy-projection tests.

- [ ] **Step 6: Commit the behavior-preserving extraction**

```bash
git add scripts/model-prompting-corrections.ts tests/model-prompting-legacy-projection.test.ts 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-legacy.ts' 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx' 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionPromptingSection.tsx' 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelPromptingSection.tsx'
git commit -m "refactor: isolate legacy model prompting projection"
```

### Task 3: Expose exact-locale prompting and migrate all 120 documents

**Files:**

- Modify: `frontend/lib/models/i18n.ts`
- Modify: `content/models/en/*.json`
- Modify: `content/models/fr/*.json`
- Modify: `content/models/es/*.json`
- Create: `scripts/migrate-model-prompting-content.ts`
- Modify: `tests/model-prompting-content-contract.test.ts`
- Modify: `tests/model-prompting-legacy-projection.test.ts`

**Interfaces:**

- Consumes: `buildLegacyModelPromptingContent`, `parseModelPromptingContent`, and the 18-entry allowlist.
- Produces: `EngineLocalizedContent.prompting?: unknown` selected as `overlay.prompting` only.
- Produces: 120 strict JSON `prompting` objects.

- [ ] **Step 1: Extend permanent tests to require the 120-document contract**

Add dynamic inventory and structure tests modeled on `tests/model-decision-content-contract.test.ts`:

```ts
test('all 40 model documents expose strict prompting content in every locale', () => {
  const expectedFiles = listModelPageTemplateSlugs().map((slug) => `${slug}.json`).sort();
  assert.equal(expectedFiles.length, 40);
  for (const locale of LOCALES) {
    assert.deepEqual(files(locale), expectedFiles, `${locale} model inventory`);
    for (const fileName of expectedFiles) {
      const slug = fileName.slice(0, -5);
      const parsed = parseModelPromptingContent(rawPrompting(locale, slug), slug, locale, `${locale}/${fileName}#prompting`);
      assert.equal(parsed.modelSlug, slug);
    }
  }
});

test('localized prompting selection never falls back to English', () => {
  assert.match(I18N_SOURCE, /prompting:\s*overlay\.prompting/);
  assert.doesNotMatch(I18N_SOURCE, /prompting:\s*overlay\.prompting\s*\?\?\s*base\.prompting/);
});
```

Add structural signatures for EN/FR/ES and exact assertions for all 18 reviewed corrections.

- [ ] **Step 2: Run the permanent contract and verify it fails on missing JSON content**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-prompting-content-contract.test.ts
```

Expected: FAIL because current documents do not yet contain top-level `prompting` and the loader does not expose it.

- [ ] **Step 3: Add exact-locale loader exposure**

Add `prompting?: unknown` immediately before `decision?: unknown` in both `EngineOverlay` and `EngineLocalizedContent`, then add the exact-locale projection to the returned object:

```ts
prompting: overlay.prompting,
```

Do not change `custom`, prompts, FAQs, SEO, hero, or any other fallback policy.

- [ ] **Step 4: Implement the one-time converter with the existing correction helper**

The converter must support dry-run and `--write` in Task 3, plus the guarded `--remove-legacy` mode used in Task 6. Its write path is deterministic:

```ts
for (const locale of LOCALES) {
  for (const modelSlug of listModelPageTemplateSlugs().sort()) {
    const filePath = path.join(CONTENT_ROOT, locale, `${modelSlug}.json`);
    const document = JSON.parse(await fs.readFile(filePath, 'utf8')) as ModelDocument;
    const engine = engines.find((candidate) => candidate.modelSlug === modelSlug);
    if (!engine) throw new Error(`Missing engine for ${modelSlug}`);
    const localized = await getEngineLocalized(modelSlug, locale);
    const copy = buildSoraCopy(localized, modelSlug, locale);
    const projected = buildLegacyModelPromptingContent({
      copy,
      engineId: engine.id,
      isImageEngine: (() => {
        const modes = engine.engine.modes ?? [];
        const hasVideoMode = modes.some((mode) => mode.endsWith('v'));
        const hasImageMode = modes.some((mode) => mode.endsWith('i'));
        return hasImageMode && !hasVideoMode;
      })(),
      locale,
      modelName: resolveLegacyPromptingModelName({ copy, engine, localized }),
      modelSlug,
    });
    const corrected = applyApprovedPromptingCorrections(projected, modelSlug, locale);
    document.prompting = parseModelPromptingContent(corrected, modelSlug, locale, `${filePath}#prompting`);
    if (WRITE) await fs.writeFile(filePath, `${JSON.stringify(document, null, 2)}\n`);
  }
}
```

Use the route's exact `engine.engine.modes` image/video classification rather than inventing a slug list. Import `applyApprovedPromptingCorrections` from the Task 2 helper so the converter and parity test share one allowlist implementation.

- [ ] **Step 5: Run the converter dry, write, and prove exact parity**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json scripts/migrate-model-prompting-content.ts
pnpm exec tsx --tsconfig frontend/tsconfig.json scripts/migrate-model-prompting-content.ts --write
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-prompting-content-contract.test.ts tests/model-prompting-legacy-projection.test.ts
```

Expected:

- dry-run reports 120 valid projections and 18 approved corrections;
- write reports 120 updated documents;
- permanent contract PASS;
- legacy parity PASS for all 120 projections after applying exactly the 18 allowlist entries;
- zero additional differences.

- [ ] **Step 6: Audit the data-only delta**

Run:

```bash
git diff --numstat -- content/models
rg -n '"prompting"' content/models | wc -l
git diff --check
```

Expected: 120 documents changed; exactly 120 top-level prompting matches; no malformed JSON or whitespace errors. Review the four corrected hrefs and 14 corrected wrong-language strings directly and confirm no price, SEO, decision, registry, or route file changed.

- [ ] **Step 7: Commit loader and migrated content**

```bash
git add frontend/lib/models/i18n.ts content/models scripts/model-prompting-corrections.ts scripts/migrate-model-prompting-content.ts tests/model-prompting-content-contract.test.ts tests/model-prompting-legacy-projection.test.ts
git commit -m "content: migrate localized model prompting"
```

### Task 4: Build the pure render-ready Prompt Lab view model

**Files:**

- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-view-model.ts`
- Create: `tests/model-prompting-view-model.test.ts`

**Interfaces:**

- Consumes: parsed `ModelPromptingContent`, `ModelPromptingUiCopy`, `FeaturedMedia | null`, canonical `modelSlug`, provider `engineId`, capability/runtime booleans, and decision reference workflows.
- Produces: `buildModelPromptingViewModel(input): ModelPromptingViewModel`.
- The builder is synchronous and pure; it receives all state and performs no file reads, fetches, registry lookups, or slug branching.

- [ ] **Step 1: Write the failing runtime matrix**

Define deterministic local fixtures, then cover the runtime matrix:

```ts
function videoContent(): ModelPromptingContent {
  return {
    modelSlug: 'fixture-model',
    section: { title: 'Fixture prompting', intro: null, tip: null, guide: null, referencesTitle: null },
    tabs: [{ id: 'quick', label: 'Quick', title: 'Quick prompt', description: null, copy: 'Subject, action, camera' }],
    tabNotes: [],
    globalPrinciples: ['Name the subject.'],
    engineWhy: ['Explicit motion is more stable.'],
    demo: {
      title: 'Fixture demo',
      promptLabel: 'Text prompt',
      prompt: 'Editorial fallback prompt',
      notes: [],
      summary: { subject: 'Chef', action: 'Cooks', camera: 'Push-in', style: 'Cinematic', output: 'Market ambience' },
      presentationOverrides: {
        modeLabel: 'Text-to-video',
        outputLabel: 'Audio',
        duration: null,
        aspectRatio: null,
        audioChipMode: 'media',
        audioChipLabel: null,
        altContext: 'Fixture render',
      },
    },
    imageExamples: null,
  };
}

function media(overrides: Partial<FeaturedMedia> = {}): FeaturedMedia {
  return {
    id: 'job_fixture',
    prompt: null,
    videoUrl: '/fixture.mp4',
    previewVideoUrl: null,
    posterUrl: '/fixture.jpg',
    durationSec: 12,
    hasAudio: false,
    href: '/video/job_fixture',
    label: 'Fixture',
    aspectRatio: '16:9',
    ...overrides,
  };
}

function imageInput(): BuildModelPromptingViewModelInput {
  const content: ModelPromptingContent = {
    ...videoContent(),
    modelSlug: 'fixture-image',
    demo: null,
    imageExamples: {
      title: 'Fixture image prompts',
      intro: 'Fixture image introduction',
      workspaceLabel: 'Open image workspace',
      items: [{ id: 'product', title: 'Product still', badge: '2K', kind: 'image', prompt: 'A clean product still.' }],
    },
  };
  return {
    content,
    locale: 'en',
    engineId: 'fixture-image',
    modelSlug: 'fixture-image',
    imageAnchorId: 'prompting',
    isImageEngine: true,
    supportsNativeAudio: false,
    useDemoMediaPrompt: false,
    demoMedia: null,
    referenceWorkflows: [],
  };
}

test('video view model prefers the selected media prompt and derives media labels', () => {
  const result = buildModelPromptingViewModel({
    content: videoContent(),
    locale: 'fr',
    engineId: 'fixture-engine',
    modelSlug: 'fixture-model',
    imageAnchorId: 'prompting',
    isImageEngine: false,
    supportsNativeAudio: true,
    useDemoMediaPrompt: true,
    demoMedia: media({ prompt: 'Prompt média', durationSec: 8, aspectRatio: '9:16', hasAudio: true }),
    referenceWorkflows: [{ title: 'Image de référence', body: 'Verrouille le sujet.' }],
  });
  assert.equal(result.demo?.prompt, 'Prompt média');
  assert.equal(result.demo?.durationLabel, '8 s');
  assert.equal(result.demo?.aspectLabel, '9:16');
  assert.equal(result.demo?.audioChipLabel, 'Audio activé');
  assert.equal(result.tabs.usePromptHref, '/app?engine=fixture-engine');
});

test('missing media uses editorial fallback without becoming a content error', () => {
  const result = buildModelPromptingViewModel({
    content: videoContent(),
    locale: 'en',
    engineId: 'fixture-engine',
    modelSlug: 'fixture-model',
    imageAnchorId: 'prompting',
    isImageEngine: false,
    supportsNativeAudio: false,
    useDemoMediaPrompt: false,
    demoMedia: null,
    referenceWorkflows: [],
  });
  assert.equal(result.demo?.prompt, 'Editorial fallback prompt');
  assert.equal(result.demo?.durationLabel, '12s');
  assert.equal(result.demo?.aspectLabel, '16:9');
  assert.equal(result.demo?.posterSrc, null);
  assert.equal(result.demo?.videoSrc, null);
});

test('image view model routes to image workspace and does not manufacture a demo', () => {
  const result = buildModelPromptingViewModel(imageInput());
  assert.equal(result.demo, null);
  assert.equal(result.imageExamples?.workspaceHref, '/app/image?engine=fixture-image');
  assert.equal(result.tabs.usePromptHref, '/app/image?engine=fixture-image');
});
```

Add one assertion for each `audioChipMode`: `media`, `supported`, `on`, `off`, and `silent`; add fixed duration/aspect override tests; add a non-mutation assertion using a frozen fixture.

- [ ] **Step 2: Run the builder test and verify the red state**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-prompting-view-model.test.ts
```

Expected: FAIL because `model-page-prompting-view-model.ts` does not exist.

- [ ] **Step 3: Implement the view-model types and pure derivation**

Use one input and one output contract:

```ts
export type ModelPromptingViewModel = {
  id: string;
  section: ModelPromptingContent['section'];
  tabs: {
    items: ModelPromptingContent['tabs'];
    notesById: Record<string, string>;
    exampleHref: string | null;
    usePromptHref: string;
  };
  globalPrinciples: string[];
  engineWhy: string[];
  referenceWorkflows: Array<{ title: string; body: string }>;
  demo: {
    title: string;
    promptLabel: string;
    prompt: string;
    notes: string[];
    summary: NonNullable<ModelPromptingContent['demo']>['summary'];
    modeLabel: string;
    outputLabel: string;
    durationLabel: string;
    aspectLabel: string;
    audioChipLabel: string;
    alt: string;
    posterSrc: string | null;
    videoSrc: string | null;
    fullHref: string | null;
  } | null;
  imageExamples: (NonNullable<ModelPromptingContent['imageExamples']> & {
    workspaceHref: string;
  }) | null;
  ui: ModelPromptingUiCopy;
};

export type BuildModelPromptingViewModelInput = {
  content: ModelPromptingContent;
  locale: AppLocale;
  engineId: string;
  modelSlug: string;
  imageAnchorId: string;
  isImageEngine: boolean;
  supportsNativeAudio: boolean;
  useDemoMediaPrompt: boolean;
  demoMedia: FeaturedMedia | null;
  referenceWorkflows: Array<{ title: string; body: string }>;
};

export function buildModelPromptingViewModel(input: BuildModelPromptingViewModelInput): ModelPromptingViewModel {
  const ui = getModelPromptingUiCopy(input.locale);
  const workspaceBase = input.isImageEngine ? '/app/image' : '/app';
  const usePromptHref = `${workspaceBase}?engine=${encodeURIComponent(input.engineId)}`;
  const demo = input.content.demo ? buildDemoViewModel(input, input.content.demo, ui) : null;
  return {
    id: input.imageAnchorId,
    section: input.content.section,
    tabs: {
      items: input.content.tabs,
      notesById: Object.fromEntries(input.content.tabNotes.map((note) => [note.tabId, note.body])),
      exampleHref: input.demoMedia?.href ?? null,
      usePromptHref,
    },
    globalPrinciples: input.content.globalPrinciples,
    engineWhy: input.content.engineWhy,
    referenceWorkflows: input.referenceWorkflows,
    demo,
    imageExamples: input.content.imageExamples
      ? { ...input.content.imageExamples, workspaceHref: usePromptHref }
      : null,
    ui,
  };
}
```

`buildDemoViewModel` uses `presentationOverrides.duration ?? localizedMediaDuration`, `presentationOverrides.aspectRatio ?? validatedMediaAspect`, and `useDemoMediaPrompt && demoMedia.prompt.trim()` before the editorial fallback. It maps audio modes only from the enum and runtime booleans; no model slug appears in this file.

Its private signature is fixed so the exported builder and tests use one return shape:

```ts
function buildDemoViewModel(
  input: BuildModelPromptingViewModelInput,
  demo: NonNullable<ModelPromptingContent['demo']>,
  ui: ModelPromptingUiCopy,
): NonNullable<ModelPromptingViewModel['demo']>;
```

- [ ] **Step 4: Run builder tests and line cap**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-prompting-view-model.test.ts
wc -l 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-view-model.ts'
git diff --check
```

Expected: all builder matrix tests PASS; builder is at or below 300 lines; diff check is clean.

- [ ] **Step 5: Commit the pure builder**

```bash
git add tests/model-prompting-view-model.test.ts 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-view-model.ts'
git commit -m "feat: derive model prompting view models"
```

### Task 5: Cut every Prompt Lab renderer over to parsed JSON

**Files:**

- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelPromptingSection.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionPromptingSection.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionPromptTabs.client.tsx`
- Modify: `tests/model-page-layout-architecture.test.ts`
- Modify: `tests/kling-o3-model-pages.test.ts`
- Modify: `tests/gemini-omni-marketing-surfaces.test.ts`
- Modify: `tests/model-page-template-content.test.ts`
- Create: `tests/model-prompting-architecture.test.ts`

**Interfaces:**

- Consumes: `localizedContent.prompting`, parser, builder, and `ModelPromptingViewModel`.
- Produces: renderer props containing one `viewModel`; no `SoraCopy`, locale, engine, or route-selection props reach `ModelDecisionPromptingSection`.
- Existing client components remain client components but receive already-derived labels and URLs.

- [ ] **Step 1: Write failing architecture assertions for the final data flow**

```ts
test('model prompting parses and builds once before rendering', () => {
  assert.match(layoutSource, /parseModelPromptingContent\(localizedContent\.prompting/);
  assert.match(layoutSource, /buildModelPromptingViewModel/);
  assert.match(promptingWrapperSource, /viewModel:\s*ModelPromptingViewModel/);
  assert.match(decisionSource, /viewModel:\s*ModelPromptingViewModel/);
  assert.doesNotMatch(decisionSource, /SoraCopy|engineSlug:\s*string|locale:\s*AppLocale|getRouteDemoSummary|getImagePromptExamples/);
});

test('prompting renderer and helpers respect permanent line caps', () => {
  assert.ok(lineCount(decisionSource) <= 300);
  assert.ok(lineCount(parserSource) <= 300);
  assert.ok(lineCount(viewModelSource) <= 300);
  assert.ok(lineCount(uiCopySource) <= 180);
});
```

Update O3 and Gemini tests to parse `document.prompting` and assert tabs, prompts, principles, engine notes, and demo presentation values there. Stop asserting that model prose exists in the component source.

- [ ] **Step 2: Run the architecture and special-model tests to verify the red state**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/model-prompting-architecture.test.ts \
  tests/model-page-layout-architecture.test.ts \
  tests/kling-o3-model-pages.test.ts \
  tests/gemini-omni-marketing-surfaces.test.ts
```

Expected: FAIL because layout still passes legacy prompting props and the renderer still derives data.

- [ ] **Step 3: Parse and build exactly once in the server layout**

After `templateData`, `supportsNativeAudio`, and `useDemoMediaPrompt` are known, add:

```ts
const promptingContent = parseModelPromptingContent(
  localizedContent.prompting,
  engine.modelSlug,
  locale,
  `content/models/${locale}/${engine.modelSlug}.json#prompting`,
);
const promptingViewModel = buildModelPromptingViewModel({
  content: promptingContent,
  locale,
  engineId: engine.id,
  modelSlug: engine.modelSlug,
  imageAnchorId,
  isImageEngine,
  supportsNativeAudio,
  useDemoMediaPrompt,
  demoMedia,
  referenceWorkflows: templateData?.referenceWorkflows ?? [],
});
```

Replace the current `promptingProps` object with `{ viewModel: promptingViewModel }` plus only the variant input already supplied by `ModelPageContentSections`.

- [ ] **Step 4: Make the server renderers view-model-only**

Use this boundary:

```ts
type ModelPromptingSectionProps = {
  viewModel: ModelPromptingViewModel;
  variant?: 'default' | 'decision';
};

type ModelDecisionPromptingSectionProps = {
  viewModel: ModelPromptingViewModel;
};
```

The decision renderer maps semantic image-example `kind` values to Lucide icons locally, renders reference workflows, tabs, principles, demo, and image examples, and performs no content/model selection. The default branch adapts the same view model to `SoraPromptingTabs` and `MediaPreview`; it does not read Prompt Lab fields from `SoraCopy`.

- [ ] **Step 5: Make the client tab component receive labels and URLs**

Replace locale/engine routing props with explicit inputs:

```ts
type ModelDecisionPromptTabsProps = {
  tabs: ModelPromptingViewModel['tabs']['items'];
  labels: Pick<ModelPromptingUiCopy, 'copyTemplate' | 'copied' | 'example' | 'viewRender' | 'usePrompt'>;
  exampleHref: string | null;
  usePromptHref: string;
};
```

Remove its local `getCopy`, `engineSlug`, `isImageEngine`, and URL construction. Keep only state, active-tab selection, prompt splitting, clipboard interaction, and rendering.

- [ ] **Step 6: Run all focused rendering tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/model-prompting-content-contract.test.ts \
  tests/model-prompting-view-model.test.ts \
  tests/model-prompting-architecture.test.ts \
  tests/model-prompting-legacy-projection.test.ts \
  tests/model-page-layout-architecture.test.ts \
  tests/model-page-template-content.test.ts \
  tests/model-page-decision-data.test.ts \
  tests/kling-o3-model-pages.test.ts \
  tests/gemini-omni-marketing-surfaces.test.ts
```

Expected: all tests PASS; legacy/new projection still reports exactly 18 approved differences; special-model behavior is asserted from localized JSON and the final view model.

- [ ] **Step 7: Run TypeScript, lint, and line caps**

Run:

```bash
pnpm --prefix frontend exec tsc --noEmit
pnpm --prefix frontend run lint
wc -l 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionPromptingSection.tsx'
git diff --check
```

Expected: TypeScript and lint PASS; renderer is at or below 300 lines; diff check is clean.

- [ ] **Step 8: Commit the renderer cutover**

```bash
git add frontend/app tests/model-prompting-architecture.test.ts tests/model-page-layout-architecture.test.ts tests/kling-o3-model-pages.test.ts tests/gemini-omni-marketing-surfaces.test.ts tests/model-page-template-content.test.ts
git commit -m "refactor: render model prompting from localized content"
```

### Task 6: Delete hybrid ownership, update scaffolding/guides, and complete verification

**Files:**

- Modify: `content/models/en/*.json`
- Modify: `content/models/fr/*.json`
- Modify: `content/models/es/*.json`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-copy.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-specs-types.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-specs.ts`
- Modify: `frontend/scripts/scaffold-model-page.ts`
- Modify: `scripts/model-setup.mjs`
- Modify: `tests/model-setup-cli.test.ts`
- Modify: `tests/model-prompting-content-contract.test.ts`
- Modify: `tests/model-prompting-architecture.test.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/AGENTS.md`
- Delete: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-legacy.ts`
- Delete: `scripts/model-prompting-corrections.ts`
- Delete: `scripts/migrate-model-prompting-content.ts`
- Delete: `tests/model-prompting-legacy-projection.test.ts`

**Interfaces:**

- Consumes: the fully cut-over JSON/parser/view-model renderer from Tasks 3–5.
- Produces: one permanent content owner, future scaffold compliance, and architecture tests that prevent reintroduction of the legacy system.

- [ ] **Step 1: Add failing permanent no-legacy assertions**

Extend permanent tests with the exact forbidden key set:

```ts
function readDocument(locale: AppLocale, slug: string): { custom?: Record<string, unknown>; prompting?: unknown } {
  return JSON.parse(readFileSync(path.join(CONTENT_ROOT, locale, `${slug}.json`), 'utf8')) as {
    custom?: Record<string, unknown>;
    prompting?: unknown;
  };
}

const PROMPTING_CUSTOM_KEYS = [
  'promptingTitle',
  'promptingIntro',
  'promptingTip',
  'promptingGuideLabel',
  'promptingGuideUrl',
  'promptingTabs',
  'promptingGlobalPrinciples',
  'promptingEngineWhy',
  'promptingTabNotes',
  'demoTitle',
  'demoPromptLabel',
  'demoPrompt',
  'demoNotes',
] as const;

test('model custom blocks contain no Prompt Lab ownership', () => {
  for (const locale of LOCALES) for (const slug of listModelPageTemplateSlugs()) {
    const document = readDocument(locale, slug);
    for (const key of PROMPTING_CUSTOM_KEYS) assert.equal(Object.hasOwn(document.custom ?? {}, key), false, `${slug}/${locale}/${key}`);
  }
});

test('temporary prompting migration owners are absent', () => {
  for (const filePath of [legacyPath, correctionsPath, converterPath, legacyTestPath]) assert.equal(existsSync(filePath), false);
});
```

Add source assertions that `SoraCopy` and `buildSoraCopy` contain none of the forbidden keys and that the route has no model-specific prompting string map or slug branch.

- [ ] **Step 2: Run the no-legacy tests and verify the red state**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-prompting-content-contract.test.ts tests/model-prompting-architecture.test.ts tests/model-setup-cli.test.ts
```

Expected: FAIL because legacy `custom` keys, types, migration files, and scaffold omissions still exist.

- [ ] **Step 3: Remove only Prompt Lab keys from all localized `custom` blocks**

Run the converter's guarded removal mode before deleting it:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json scripts/migrate-model-prompting-content.ts --remove-legacy --write
```

The remover deletes only the exact `PROMPTING_CUSTOM_KEYS` list. It must not remove gallery, tips, safety, hero, specs, SEO, decision, or unrelated demo/media fields. Re-run JSON parsing for all 120 files immediately.

- [ ] **Step 4: Remove Prompt Lab fields from TypeScript copy contracts**

Delete the same fields from `SoraCopy`, remove their readers and return properties from `buildSoraCopy`, and remove obsolete `PromptingTab`/`PromptingTabId` exports only after `rg` confirms no consumer:

```bash
rg -n "PromptingTab|promptingTitle|promptingIntro|promptingTip|promptingGuide|promptingTabs|promptingGlobalPrinciples|promptingEngineWhy|promptingTabNotes|demoPrompt|demoNotes" frontend tests
```

Expected after cleanup: matches occur only in the new prompting contract/view model, intentional generic components, migration-history documentation, and permanent forbidden-key tests.

- [ ] **Step 5: Update model scaffolding and setup guidance**

Retarget both strict identities in `frontend/scripts/scaffold-model-page.ts`:

```ts
for (const field of ['decision', 'prompting'] as const) {
  const block = transformed[field];
  if (block && typeof block === 'object' && !Array.isArray(block)) {
    transformed[field] = { ...(block as Record<string, unknown>), modelSlug: options.targetSlug };
  }
}
```

Change setup guidance to require review of every localized `decision` and `prompting` block, exact `modelSlug`, locale-correct hrefs, and no English prompting fallback. Extend `tests/model-setup-cli.test.ts` to assert both identities and both review instructions.

- [ ] **Step 6: Update the nested route guide**

Add these permanent rules to `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/AGENTS.md`:

```markdown
- Keep model-specific Prompt Lab editorial content only in `content/models/{locale}/{slug}.json#prompting`.
- Load Prompt Lab content through `getEngineLocalized`, validate it with `model-page-prompting-content.ts`, and derive runtime display state with `model-page-prompting-view-model.ts`.
- Never add English fallback, Prompt Lab fields under `custom`, model-slug copy branches, direct JSON imports, or workspace URL construction in Prompt Lab components.
- Keep generic Prompt Lab UI labels in `model-page-prompting-ui-copy.ts`; keep model-specific titles, prompts, notes, demos, and image examples in localized JSON.
```

- [ ] **Step 7: Delete every temporary migration owner**

Delete the legacy projector, correction helper, converter, and temporary parity test. Run:

```bash
rg -n "buildLegacyModelPromptingContent|APPROVED_PROMPTING_CORRECTIONS|migrate-model-prompting-content" frontend scripts tests
```

Expected: no production or test references remain; only the design/plan history may mention these names.

- [ ] **Step 8: Run permanent focused contracts**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/model-prompting-content-contract.test.ts \
  tests/model-prompting-view-model.test.ts \
  tests/model-prompting-architecture.test.ts \
  tests/model-page-layout-architecture.test.ts \
  tests/model-page-template-content.test.ts \
  tests/model-page-decision-data.test.ts \
  tests/kling-o3-model-pages.test.ts \
  tests/gemini-omni-marketing-surfaces.test.ts \
  tests/model-setup-cli.test.ts
```

Expected: all PASS; 120 strict prompting documents; all 18 approved corrections remain exact; no legacy content owner.

- [ ] **Step 9: Run full static and architecture validation**

Run:

```bash
pnpm test:validate
pnpm --prefix frontend run lint
pnpm lint:exposure
pnpm --prefix frontend exec tsc --noEmit
pnpm model:registry:check
pnpm architecture:audit -- --min-lines 500
git diff --check
```

Expected: every command PASS. Architecture audit no longer lists `ModelDecisionPromptingSection.tsx`; no new prompting file exceeds its cap.

- [ ] **Step 10: Run the production build and localized smoke checks**

Run:

```bash
pnpm --prefix frontend run build
```

Then start the production server and verify one standard video model, one Kling O3 model, one image model, the four corrected guide-link projections, and representative FR/ES Luma Uni copies from the 14 wrong-language corrections. Confirm Prompt Lab title, tabs, principles, demo/media state, copy action, workspace link, canonical, and hreflang. Expected: all pages render with requested-locale prompting and unchanged route/SEO output.

- [ ] **Step 11: Review scoped diff and commit final cleanup**

Run:

```bash
git diff --stat
git diff -- frontend/config packages/pricing frontend/app/sitemap.ts
git status --short
```

Expected: no pricing, registry, sitemap, route-map, or generated catalog changes; only planned prompting/content/scaffold/test/guide files are present.

Commit:

```bash
git add content/models frontend/lib/models/i18n.ts frontend/app frontend/scripts/scaffold-model-page.ts scripts/model-setup.mjs tests docs/superpowers/specs/2026-07-15-model-prompting-content-organization-design.md
git commit -m "refactor: remove legacy model prompting ownership"
```

## Final Completion Gate

Before declaring the project complete:

- verify local `main` is clean and contains all six task commits;
- compare `git diff origin/main...HEAD --name-status` and confirm the scoped file set;
- record the exact full-test and build totals;
- record whether the correction count is exactly 18;
- report `ModelDecisionPromptingSection.tsx`, parser, builder, and UI-copy physical line counts;
- state explicitly that routes, SEO, pricing, model registry, and `ModelExamplesSection.tsx` did not change;
- do not push until the user explicitly requests the push.
