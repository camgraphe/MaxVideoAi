# Commercial Trust Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Status, Examples, the video watch page, and example recreation commercially honest and internally consistent while preserving public routes, SEO ownership, pricing calculations, and generation behavior.

**Architecture:** Keep each existing route as its current orchestrator. Add one pure route-local Status view-model helper and one pure Workspace readiness helper, then wire them into the existing Server Component and route-local hook. Examples copy continues through the existing locale copy/data modules, while the gallery keeps one full-card watch-page link and adds only a non-interactive visual affordance.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, next-intl dictionaries, Node test runner through `tsx`, existing MaxVideoAI server settings and Workspace contracts.

## Global Constraints

- Preserve `/status`, `/fr/statut`, `/es/estado`, Examples routes, watch routes, `/pricing`, canonical URLs, hreflang groups, sitemap membership, redirects, and route groups.
- Use `getServiceNoticeSetting()` as the only dynamic public Status source; do not add polling, telemetry, an incident database, or a second API contract.
- Render an enabled non-empty administrator notice verbatim; localize only the surrounding Status page copy.
- Do not claim that no active notice guarantees uptime or that all providers, queues, billing systems, callbacks, or webhooks are operational.
- Keep the gallery as discovery → watch page → Workspace. Do not add a direct-to-Generate gallery path or live pricing on gallery cards.
- Label historical watch-page cost as `Recorded render cost`; the Workspace Generate amount remains the current live quote.
- Do not change pricing algorithms, member discounts, wallet minimums, taxes, refunds, provider costs, engine selection policy, generation submission, polling, or upload behavior.
- Keep the existing `?from=job_*` handoff and resolver fallback contract. A temporarily empty engine catalog must not create a recreation error.
- Update English, French, and Spanish copy together.
- Preserve existing architecture line-count limits unless a focused test demonstrates that a very small increase is necessary.

---

## File Structure

### New files

- `frontend/app/(localized)/[locale]/(marketing)/status/_lib/status-page-state.ts`: pure conversion from the administrator setting to the localized active/empty Status view model.
- `tests/status-page-trust.test.ts`: Status source-of-truth, neutral-state, localization, and false-claim regression coverage.
- `tests/examples-commercial-copy.test.ts`: localized Examples promise, FAQ, metadata, card affordance, and accessible-name regression coverage.
- `tests/watch-page-commercial-copy.test.ts`: recorded-cost terminology regression coverage across the signal builder and watch content.

### Modified files

- `frontend/app/(localized)/[locale]/(marketing)/status/page.tsx`: fetches the existing service notice, renders the compact truthful page, and keeps route SEO ownership.
- `frontend/lib/i18n/dictionary-types.ts`: replaces the fictional Status systems/incidents shape with the current-notice, affected-generation, and support shape.
- `frontend/lib/i18n/dictionary-data/en-legal-status.ts`: updates the English fallback Status dictionary.
- `frontend/messages/en.json`, `frontend/messages/fr.json`, `frontend/messages/es.json`: localized Status and Examples copy, metadata, and recorded-cost labels.
- `frontend/app/(localized)/[locale]/(marketing)/examples/page.tsx`: truthful fallback hero body.
- `frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-copy.ts`: localized gallery affordance, descriptions, and featured-example CTAs.
- `frontend/app/(localized)/[locale]/(marketing)/examples/_components/examples-page-view.tsx`: passes the new gallery detail label.
- `frontend/app/(localized)/[locale]/(marketing)/examples/_components/examples-route-sections.tsx`: forwards the label into the shared grid.
- `frontend/components/examples/ExamplesGalleryGrid.tsx`: server wrapper prop contract and forwarding.
- `frontend/components/examples/ExamplesGalleryGrid.client.tsx`: client grid prop contract and card forwarding.
- `frontend/components/examples/ExampleGalleryCard.tsx`: one accessible watch link plus non-interactive `View settings & price` affordance.
- `frontend/components/examples/examples-gallery-helpers.ts`: localized accessible watch-link wording.
- `frontend/lib/examples/modelLandingFaq.ts`: truthful hub FAQ answers.
- `frontend/lib/examples/modelLanding.ts`, `frontend/lib/examples/modelLandingData.fr.ts`, `frontend/lib/examples/modelLandingData.es.ts`: remove model-landing claims that price is displayed directly in the gallery.
- `frontend/server/watch-page-signals/content.ts`: labels the historical value as recorded render cost.
- `frontend/app/(core)/video/[id]/_components/VideoWatchContent.tsx`: uses the same recorded-cost terminology in the prompt breakdown.
- `frontend/app/(core)/(workspace)/app/_lib/workspace-video-settings.ts`: exports the pure shared-video readiness predicate without altering snapshot resolution.
- `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceVideoSettings.ts`: waits for engines before applying or hydrating shared video settings.
- `tests/examples-route-architecture.test.ts`, `tests/examples-gallery-architecture.test.ts`, `tests/video-page-architecture.test.ts`, `tests/watch-page-signals-architecture.test.ts`, `tests/workspace-video-settings.test.ts`, `tests/workspace-video-settings-hook-contract.test.ts`: lock the new contracts into the existing architecture suite.

---

### Task 1: Replace the fictional Status dashboard with the administrator notice

**Files:**
- Create: `frontend/app/(localized)/[locale]/(marketing)/status/_lib/status-page-state.ts`
- Create: `tests/status-page-trust.test.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/status/page.tsx`
- Modify: `frontend/lib/i18n/dictionary-types.ts`
- Modify: `frontend/lib/i18n/dictionary-data/en-legal-status.ts`
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/fr.json`
- Modify: `frontend/messages/es.json`
- Verify: `tests/customer-facing-legal-contact.test.ts`

**Interfaces:**
- Consumes: `getServiceNoticeSetting(): Promise<{ enabled: boolean; message: string }>` from `@/server/app-settings` and `resolveDictionary(...)` from `@/lib/i18n/server`.
- Produces: `buildStatusNoticeState(setting: ServiceNoticeSetting, copy: StatusNoticeCopy): StatusNoticeState` and the new `Dictionary['status']` shape.

- [ ] **Step 1: Write the failing Status trust test**

Create `tests/status-page-trust.test.ts` with this complete coverage:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { buildStatusNoticeState } from '../frontend/app/(localized)/[locale]/(marketing)/status/_lib/status-page-state';

const root = process.cwd();
const pageSource = readFileSync(
  join(root, 'frontend/app/(localized)/[locale]/(marketing)/status/page.tsx'),
  'utf8'
);

function readMessages(locale: 'en' | 'fr' | 'es') {
  return JSON.parse(readFileSync(join(root, `frontend/messages/${locale}.json`), 'utf8')) as {
    status: {
      hero: { title: string; subtitle: string };
      currentNotice: { title: string; activeLabel: string; clearLabel: string; clearBody: string };
      affected: { title: string; body: string };
      support: { title: string; prefix: string; suffix: string };
    };
  };
}

test('active administrator notice is preserved verbatim', () => {
  const state = buildStatusNoticeState(
    { enabled: true, message: '  Seedance jobs are delayed.  ' },
    { activeLabel: 'Active service notice', clearLabel: 'No active service notice', clearBody: 'No notice.' }
  );

  assert.deepEqual(state, {
    isActive: true,
    label: 'Active service notice',
    message: 'Seedance jobs are delayed.',
  });
});

test('disabled or blank notices produce the neutral localized state', () => {
  const copy = {
    activeLabel: 'Active service notice',
    clearLabel: 'No active service notice',
    clearBody: 'There is no administrator-published service notice at this time.',
  };

  assert.deepEqual(buildStatusNoticeState({ enabled: false, message: 'Old incident' }, copy), {
    isActive: false,
    label: copy.clearLabel,
    message: copy.clearBody,
  });
  assert.deepEqual(buildStatusNoticeState({ enabled: true, message: '   ' }, copy), {
    isActive: false,
    label: copy.clearLabel,
    message: copy.clearBody,
  });
});

test('status route uses the shared service notice without fictional telemetry', () => {
  assert.match(pageSource, /getServiceNoticeSetting/);
  assert.match(pageSource, /buildStatusNoticeState/);
  assert.match(pageSource, /hreflangGroup: 'status'/);
  assert.doesNotMatch(pageSource, /content\.systems|content\.incidents|STATUS_BADGE_CLASSES/);

  for (const claim of [
    'Pika provider latency',
    'Callbacks & webhooks',
    'refresh continuously',
    'automatically shifts traffic',
    'RSS feed',
    'email digest',
    'every 60 seconds',
  ]) {
    assert.doesNotMatch(pageSource, new RegExp(claim, 'i'));
  }
});

test('English, French and Spanish expose equivalent honest status sections', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const status = readMessages(locale).status;
    assert.ok(status.hero.title);
    assert.ok(status.hero.subtitle);
    assert.ok(status.currentNotice.title);
    assert.ok(status.currentNotice.activeLabel);
    assert.ok(status.currentNotice.clearLabel);
    assert.ok(status.currentNotice.clearBody);
    assert.ok(status.affected.title);
    assert.ok(status.affected.body);
    assert.ok(status.support.title);
    assert.ok(status.support.prefix);
    assert.ok(status.support.suffix);
    assert.equal('systems' in status, false);
    assert.equal('incidents' in status, false);
    assert.equal('overview' in status, false);
  }
});
```

- [ ] **Step 2: Run the focused test and verify the new helper/shape are missing**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/status-page-trust.test.ts
```

Expected: FAIL because `status/_lib/status-page-state.ts` does not exist and the dictionaries still expose `systems`, `incidents`, and `overview`.

- [ ] **Step 3: Add the pure Status notice view model**

Create `frontend/app/(localized)/[locale]/(marketing)/status/_lib/status-page-state.ts`:

```ts
export type ServiceNoticeSetting = {
  enabled: boolean;
  message: string;
};

export type StatusNoticeCopy = {
  activeLabel: string;
  clearLabel: string;
  clearBody: string;
};

export type StatusNoticeState = {
  isActive: boolean;
  label: string;
  message: string;
};

export function buildStatusNoticeState(
  setting: ServiceNoticeSetting,
  copy: StatusNoticeCopy
): StatusNoticeState {
  const message = setting.message.trim();
  if (setting.enabled && message) {
    return { isActive: true, label: copy.activeLabel, message };
  }
  return { isActive: false, label: copy.clearLabel, message: copy.clearBody };
}
```

- [ ] **Step 4: Replace the Status dictionary contract and localized copy**

Replace `Dictionary['status']` in `frontend/lib/i18n/dictionary-types.ts` with:

```ts
status: {
  hero: { title: string; subtitle: string };
  currentNotice: {
    title: string;
    activeLabel: string;
    clearLabel: string;
    clearBody: string;
  };
  affected: { title: string; body: string };
  support: { title: string; prefix: string; suffix: string };
};
```

Use this English object in both `frontend/lib/i18n/dictionary-data/en-legal-status.ts` and `frontend/messages/en.json`:

```json
{
  "hero": {
    "title": "Service status",
    "subtitle": "Current service notices published by the MaxVideoAI team."
  },
  "currentNotice": {
    "title": "Current notice",
    "activeLabel": "Active service notice",
    "clearLabel": "No active service notice",
    "clearBody": "There is no administrator-published service notice at this time."
  },
  "affected": {
    "title": "If a generation is affected",
    "body": "Failed generations follow the existing refund policy. If a job is delayed, avoid submitting duplicates and keep its job ID available."
  },
  "support": {
    "title": "Need help?",
    "prefix": "Contact",
    "suffix": "and include the job ID and engine name so the team can investigate."
  }
}
```

Use this French object in `frontend/messages/fr.json`:

```json
{
  "hero": {
    "title": "État du service",
    "subtitle": "Avis de service actuels publiés par l’équipe MaxVideoAI."
  },
  "currentNotice": {
    "title": "Avis actuel",
    "activeLabel": "Avis de service actif",
    "clearLabel": "Aucun avis de service actif",
    "clearBody": "Aucun avis de service n’est actuellement publié par l’équipe."
  },
  "affected": {
    "title": "Si une génération est affectée",
    "body": "Les générations échouées suivent la politique de remboursement existante. Si une tâche est retardée, évitez de la soumettre plusieurs fois et conservez son identifiant."
  },
  "support": {
    "title": "Besoin d’aide ?",
    "prefix": "Contactez",
    "suffix": "en indiquant l’identifiant de la tâche et le nom du moteur afin que l’équipe puisse enquêter."
  }
}
```

Use this Spanish object in `frontend/messages/es.json`:

```json
{
  "hero": {
    "title": "Estado del servicio",
    "subtitle": "Avisos de servicio actuales publicados por el equipo de MaxVideoAI."
  },
  "currentNotice": {
    "title": "Aviso actual",
    "activeLabel": "Aviso de servicio activo",
    "clearLabel": "No hay avisos de servicio activos",
    "clearBody": "El equipo no ha publicado ningún aviso de servicio en este momento."
  },
  "affected": {
    "title": "Si una generación se ve afectada",
    "body": "Las generaciones fallidas siguen la política de reembolso existente. Si un trabajo se retrasa, evita enviarlo de nuevo y conserva su identificador."
  },
  "support": {
    "title": "¿Necesitas ayuda?",
    "prefix": "Contacta con",
    "suffix": "e incluye el identificador del trabajo y el nombre del motor para que el equipo pueda investigarlo."
  }
}
```

- [ ] **Step 5: Rebuild the Status route around the real setting**

In `frontend/app/(localized)/[locale]/(marketing)/status/page.tsx`:

1. Import `getServiceNoticeSetting` and `buildStatusNoticeState`.
2. Export `revalidate = 30`.
3. Replace the metadata copy with truthful localized descriptions:

```ts
const STATUS_META: Record<AppLocale, { title: string; description: string }> = {
  en: {
    title: 'Service status — MaxVideoAI',
    description: 'Read current MaxVideoAI service notices and get help with an affected AI video generation.',
  },
  fr: {
    title: 'État du service — MaxVideoAI',
    description: 'Consultez les avis de service MaxVideoAI et obtenez de l’aide pour une génération vidéo IA affectée.',
  },
  es: {
    title: 'Estado del servicio — MaxVideoAI',
    description: 'Consulta los avisos de servicio de MaxVideoAI y obtén ayuda con una generación de video IA afectada.',
  },
};
```

4. Keep `hreflangGroup: 'status'` and `slugMap: STATUS_SLUG_MAP`, but use:

```ts
keywords: ['AI video service status', 'MaxVideoAI service notice', 'generation support'],
imageAlt: 'MaxVideoAI service status.',
```

5. Load the dictionary and setting together, then build the view model:

```ts
const [{ dictionary }, serviceNotice] = await Promise.all([
  resolveDictionary({ locale: params.locale }),
  getServiceNoticeSetting(),
]);
const content = dictionary.status;
const notice = buildStatusNoticeState(serviceNotice, content.currentNotice);
```

6. Replace the overview, systems, and incidents markup with these three sections while retaining the existing related-links paragraph:

```tsx
<section className="rounded-card border border-hairline bg-surface p-6 shadow-card sm:p-8">
  <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
    {content.currentNotice.title}
  </p>
  <div className="mt-4 flex flex-wrap items-center gap-3">
    <span
      className={
        notice.isActive
          ? 'rounded-pill bg-[var(--warning-bg)] px-3 py-1 text-xs font-semibold text-[var(--warning)]'
          : 'rounded-pill bg-surface-subtle px-3 py-1 text-xs font-semibold text-text-secondary'
      }
    >
      {notice.label}
    </span>
  </div>
  <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
    {notice.message}
  </p>
</section>

<div className="grid gap-4 md:grid-cols-2">
  <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
    <h2 className="text-lg font-semibold text-text-primary">{content.affected.title}</h2>
    <p className="mt-2 text-sm leading-relaxed text-text-secondary">{content.affected.body}</p>
  </section>
  <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
    <h2 className="text-lg font-semibold text-text-primary">{content.support.title}</h2>
    <p className="mt-2 text-sm leading-relaxed text-text-secondary">
      {content.support.prefix}{' '}
      <ObfuscatedEmailLink user="support" domain="maxvideoai.com" label="support@maxvideoai.com" />{' '}
      {content.support.suffix}
    </p>
  </section>
</div>
```

Delete `STATUS_BADGE_CLASSES`; do not add a replacement subsystem map or incident list.

- [ ] **Step 6: Run Status and existing route tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/status-page-trust.test.ts \
  tests/customer-facing-legal-contact.test.ts
```

Expected: PASS. The localized slugs and contact/footer references remain intact.

- [ ] **Step 7: Commit the truthful Status page**

```bash
git add \
  'frontend/app/(localized)/[locale]/(marketing)/status' \
  frontend/lib/i18n/dictionary-types.ts \
  frontend/lib/i18n/dictionary-data/en-legal-status.ts \
  frontend/messages/en.json \
  frontend/messages/fr.json \
  frontend/messages/es.json \
  tests/status-page-trust.test.ts
git commit -m "fix: make service status truthful"
```

---

### Task 2: Align Examples copy, metadata, card affordance, and accessibility

**Files:**
- Create: `tests/examples-commercial-copy.test.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/examples/page.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-copy.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/examples/_components/examples-page-view.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/examples/_components/examples-route-sections.tsx`
- Modify: `frontend/components/examples/ExamplesGalleryGrid.tsx`
- Modify: `frontend/components/examples/ExamplesGalleryGrid.client.tsx`
- Modify: `frontend/components/examples/ExampleGalleryCard.tsx`
- Modify: `frontend/components/examples/examples-gallery-helpers.ts`
- Modify: `frontend/lib/examples/modelLandingFaq.ts`
- Modify: `frontend/lib/examples/modelLanding.ts`
- Modify: `frontend/lib/examples/modelLandingData.fr.ts`
- Modify: `frontend/lib/examples/modelLandingData.es.ts`
- Modify: `frontend/lib/i18n/dictionary-data/en-content.ts`
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/fr.json`
- Modify: `frontend/messages/es.json`
- Modify: `tests/examples-route-architecture.test.ts`
- Modify: `tests/examples-gallery-architecture.test.ts`
- Verify: `tests/marketing-jsonld-schema-audit.test.ts`

**Interfaces:**
- Consumes: the current watch URL on `ExampleGalleryVideo.href`, existing model links, existing localized Examples page data, and `getHubExamplesFaq(locale)`.
- Produces: `galleryUiCopy.detailsCta: string`, `detailsCtaLabel: string` through page view → section → server grid → client grid → card, and accessible watch-link names that mention settings and price.

- [ ] **Step 1: Write the failing Examples commercial-copy test**

Create `tests/examples-commercial-copy.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { buildWatchAnchorText } from '../frontend/components/examples/examples-gallery-helpers';
import { getHubExamplesFaq } from '../frontend/lib/examples/modelLandingFaq';
import {
  getExamplesGalleryUiCopy,
  getExamplesLongDescription,
  getExamplesMainVideoCopy,
} from '../frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-copy';

const root = process.cwd();
const cardSource = readFileSync(join(root, 'frontend/components/examples/ExampleGalleryCard.tsx'), 'utf8');
const pageSource = readFileSync(
  join(root, 'frontend/app/(localized)/[locale]/(marketing)/examples/page.tsx'),
  'utf8'
);
const modelLandingSources = [
  'frontend/lib/examples/modelLanding.ts',
  'frontend/lib/examples/modelLandingData.fr.ts',
  'frontend/lib/examples/modelLandingData.es.ts',
].map((path) => readFileSync(join(root, path), 'utf8')).join('\n');

const sample = {
  id: 'job_1',
  href: '/video/job_1',
  modelHref: '/models/kling-3-pro',
  recreateHref: '/app?from=job_1',
  engineLabel: 'Kling 3 Pro',
  engineIconId: 'kling',
  prompt: 'A train arriving at night',
  promptFull: 'A train arriving at night',
  durationSec: 8,
  aspectRatio: '16:9',
  hasAudio: true,
  rawPosterUrl: null,
  heroPosterUrl: null,
  previewVideoUrl: null,
  videoUrl: null,
  priceLabel: null,
} as Parameters<typeof buildWatchAnchorText>[1];

test('gallery affordance and accessible watch names describe settings and price', () => {
  assert.equal(getExamplesGalleryUiCopy('en').detailsCta, 'View settings & price');
  assert.equal(getExamplesGalleryUiCopy('fr').detailsCta, 'Voir réglages et prix');
  assert.equal(getExamplesGalleryUiCopy('es').detailsCta, 'Ver ajustes y precio');

  assert.match(buildWatchAnchorText('en', sample), /View settings and price for/);
  assert.match(buildWatchAnchorText('fr', sample), /Voir les réglages et le prix de/);
  assert.match(buildWatchAnchorText('es', sample), /Ver los ajustes y el precio de/);

  assert.match(cardSource, /aria-label=\{watchAnchorText\}/);
  assert.match(cardSource, /detailsCtaLabel/);
  assert.match(cardSource, /aria-hidden/);
  assert.doesNotMatch(cardSource, /aria-label=\{altText\}/);
  assert.doesNotMatch(cardSource, /recreateHref|recreateLabel|showRecreateLink/);
});

test('localized Examples copy sends visitors to the detail page for recorded cost', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const description = getExamplesLongDescription(locale);
    const mainVideo = getExamplesMainVideoCopy(locale);
    const faq = getHubExamplesFaq(locale);
    assert.match(description, /recorded cost|coût enregistré|coût du rendu|coste registrado|coste del render/i);
    assert.match(mainVideo.openExample, /settings|réglages|ajustes/i);
    assert.match(faq.items[2]?.answer ?? '', /open|ouvrez|abre/i);
  }
});

test('Examples source no longer claims gallery cards display price per clip', () => {
  const falseClaim = /pricing shown per clip|price per clip|prix par clip|precio por clip/i;
  assert.doesNotMatch(pageSource, falseClaim);
  assert.doesNotMatch(modelLandingSources, falseClaim);

  for (const locale of ['en', 'fr', 'es'] as const) {
    const messages = JSON.parse(readFileSync(join(root, `frontend/messages/${locale}.json`), 'utf8')) as {
      examples: { hero: { body: string } };
      gallery: { meta: { description: string; description_engine: string } };
    };
    assert.doesNotMatch(messages.examples.hero.body, falseClaim);
    assert.doesNotMatch(messages.gallery.meta.description, falseClaim);
    assert.doesNotMatch(messages.gallery.meta.description_engine, falseClaim);
  }
});
```

- [ ] **Step 2: Run the test and verify the old promise fails it**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/examples-commercial-copy.test.ts
```

Expected: FAIL because `detailsCta` does not exist, accessible names say `Watch`, and several sources promise `price per clip` in the gallery.

- [ ] **Step 3: Add exact localized gallery and featured-example copy**

Extend every fallback object returned by `getExamplesGalleryUiCopy`:

```ts
// English
detailsCta: 'View settings & price',

// French
detailsCta: 'Voir réglages et prix',

// Spanish
detailsCta: 'Ver ajustes y precio',
```

Replace `getExamplesLongDescription` values with:

```ts
if (locale === 'fr') {
  return 'Parcourez des exemples vidéo IA par famille de modèles. Ouvrez un exemple pour consulter son prompt, ses réglages, sa durée et le coût enregistré du rendu, puis recréez-le dans votre studio.';
}
if (locale === 'es') {
  return 'Explora ejemplos de video IA por modelo. Abre un ejemplo para consultar su prompt, ajustes, duración y coste registrado del render, y después recréalo en tu espacio de trabajo.';
}
return 'Browse AI video examples by model. Open any example to inspect its prompt, settings, duration, and recorded render cost, then recreate it in your workspace.';
```

Replace the `openExample` and `openWatchPage` values in `getExamplesMainVideoCopy`:

```ts
// English
openExample: 'View settings & price',
openWatchPage: 'Open video details',

// French
openExample: 'Voir réglages et prix',
openWatchPage: 'Ouvrir les détails de la vidéo',

// Spanish
openExample: 'Ver ajustes y precio',
openWatchPage: 'Abrir los detalles del video',
```

Replace `HERO_BODY_FALLBACK` in `examples/page.tsx` with:

```ts
const HERO_BODY_FALLBACK =
  'Browse AI video examples by model. Open an example to inspect its prompt, settings, duration, and recorded render cost, then recreate it in your workspace.';
```

- [ ] **Step 4: Wire the gallery detail label through existing component boundaries**

Add `detailsCta: string` to `galleryUiCopy` in `examples-page-view.tsx`, and pass:

```tsx
<ExamplesGallerySection
  detailsCtaLabel={galleryUiCopy.detailsCta}
  // keep every existing prop unchanged
/>
```

Add `detailsCtaLabel: string` to `ExamplesGallerySectionProps` and forward it in `examples-route-sections.tsx`:

```tsx
<ExamplesGalleryGrid
  detailsCtaLabel={detailsCtaLabel}
  // keep every existing prop unchanged
/>
```

Add this optional prop and default to both `ExamplesGalleryGrid.tsx` and `ExamplesGalleryGrid.client.tsx`:

```ts
detailsCtaLabel = 'View settings & price',
```

Declare it as:

```ts
detailsCtaLabel?: string;
```

Forward `detailsCtaLabel` from the server wrapper to the client grid, then to both mobile and desktop `ExampleGalleryCard` instances. Remove `showRecreateLink` from both card calls; the gallery must always open the watch page before recreation.

- [ ] **Step 5: Keep one card link and add the visual affordance**

In `ExampleGalleryCard.tsx`, add `detailsCtaLabel: string` to the prop type and destructuring. Remove `showRecreateLink` from the prop type and destructuring, then delete `recreateLabel` and the conditional `video.recreateHref` link block. Keep `recreateHref` in `ExampleGalleryVideo`; other surfaces may still consume the data contract.

Change the overlay link to:

```tsx
<Link href={video.href} className="absolute inset-0 z-0" aria-label={watchAnchorText} prefetch={false}>
  <span className="sr-only">{watchAnchorText}</span>
</Link>
```

Add this after the aspect/duration line and before the optional recreate link:

```tsx
<p
  aria-hidden="true"
  className="pt-0.5 text-[11px] font-semibold text-brand transition group-hover:text-brand-hover"
>
  {detailsCtaLabel} →
</p>
```

Do not wrap this affordance in another `Link` or `button`; the existing overlay remains the only watch-page hit target.

Replace `buildWatchAnchorText` with:

```ts
export function buildWatchAnchorText(locale: string, video: ExampleGalleryVideo): string {
  const ratio = video.aspectRatio ?? 'Auto';
  const duration = locale === 'es' ? `${video.durationSec} s` : `${video.durationSec}s`;
  if (locale === 'fr') {
    return `Voir les réglages et le prix de l'exemple vidéo ${video.engineLabel} - ${video.prompt} - ${ratio} - ${duration}`;
  }
  if (locale === 'es') {
    return `Ver los ajustes y el precio del ejemplo de video ${video.engineLabel} - ${video.prompt} - ${ratio} - ${duration}`;
  }
  return `View settings and price for ${video.engineLabel} video example - ${video.prompt} - ${ratio} - ${duration}`;
}
```

- [ ] **Step 6: Replace hub hero, FAQ, and metadata promises in all three locales**

Use these hub hero bodies in `frontend/messages/*.json` and the English fallback in `frontend/lib/i18n/dictionary-data/en-content.ts`:

```json
// en
"Open any example to inspect its prompt, settings and recorded render cost, then recreate it in your workspace."

// fr
"Ouvrez un exemple pour consulter son prompt, ses réglages et le coût enregistré du rendu, puis recréez-le dans votre studio."

// es
"Abre un ejemplo para consultar su prompt, ajustes y el coste registrado del render, y después recréalo en tu espacio de trabajo."
```

Use these `gallery.meta` values:

```json
// en
{
  "title": "AI Video Examples: Prompts, Models & Recorded Costs",
  "description": "Browse real AI video examples, then open a video to inspect its prompt, settings, duration and recorded render cost before recreating it.",
  "description_engine": "Browse {engineName} examples, then open a video to inspect its prompt, duration, audio settings and recorded render cost."
}

// fr
{
  "title": "Exemples vidéo IA : prompts, modèles et coûts enregistrés",
  "description": "Parcourez des exemples vidéo IA, puis ouvrez une vidéo pour consulter son prompt, ses réglages, sa durée et le coût enregistré avant de la recréer.",
  "description_engine": "Parcourez des exemples {engineName}, puis ouvrez une vidéo pour consulter son prompt, sa durée, ses réglages audio et le coût enregistré."
}

// es
{
  "title": "Ejemplos de video IA: prompts, modelos y costes registrados",
  "description": "Explora ejemplos de video IA y abre un video para consultar su prompt, ajustes, duración y coste registrado antes de recrearlo.",
  "description_engine": "Explora ejemplos de {engineName} y abre un video para consultar su prompt, duración, ajustes de audio y coste registrado."
}
```

Keep each existing `title_engine` unchanged.

Replace only the pricing FAQ answer in `modelLandingFaq.ts`:

```ts
// en
answer: 'Open an example to see its recorded render cost and settings before recreating it.',

// fr
answer: 'Ouvrez un exemple pour voir le coût enregistré du rendu et ses réglages avant de le recréer.',

// es
answer: 'Abre un ejemplo para ver el coste registrado del render y sus ajustes antes de recrearlo.',
```

The questions may remain unchanged because the answers now explain where the value appears.

- [ ] **Step 7: Remove the same false promise from model-family Examples landing copy**

In `frontend/lib/examples/modelLanding.ts`, make these exact replacements while keeping engine names, modes, links, and variable interpolation unchanged:

```text
Comparez mouvement, cadrage, durée et prix par clip
→ Comparez mouvement, cadrage et durée, puis ouvrez un exemple pour voir son coût enregistré

Le prix par clip varie selon le modèle, la durée, la résolution et le mode.
→ Le coût enregistré affiché sur la fiche d’un exemple varie selon le modèle, la durée, la résolution et le mode.

Compara movimiento, encuadre, duración y precio por clip
→ Compara movimiento, encuadre y duración, y abre un ejemplo para ver su coste registrado

El precio por clip cambia según modelo, duración, resolución y modo.
→ El coste registrado de la ficha de un ejemplo cambia según modelo, duración, resolución y modo.

Compare motion, framing, duration, and price per clip
→ Compare motion, framing, and duration, then open an example to see its recorded render cost

Exemples vidéo IA ${label} avec prompts, réglages et prix par clip.
→ Exemples vidéo IA ${label} avec prompts, réglages et coût enregistré sur chaque fiche.

Ejemplos de video con IA de ${label} con prompts, ajustes y precio por clip.
→ Ejemplos de video con IA de ${label} con prompts, ajustes y coste registrado en cada ficha.

${label} examples with prompts, settings, and price per clip.
→ ${label} examples with prompts, settings, and recorded cost on each detail page.

Consultez les prompts, les réglages et le prix par clip avant de lancer un nouveau rendu.
→ Ouvrez un exemple pour consulter son prompt, ses réglages et le coût enregistré avant de lancer un nouveau rendu.

Revisa prompts, ajustes y precio por clip antes de lanzar un nuevo render.
→ Abre un ejemplo para consultar su prompt, ajustes y coste registrado antes de lanzar un nuevo render.

Review prompts, settings, and price per clip before running a new render.
→ Open an example to review its prompt, settings, and recorded render cost before running a new render.
```

In `frontend/lib/examples/modelLandingData.fr.ts`, make these exact replacements:

```text
Vérifiez le prix par clip avant de lancer plusieurs variantes.
→ Ouvrez un exemple pour vérifier son coût enregistré avant de lancer plusieurs variantes.

Parcourez des exemples Veo 3.1, prompts, reglages, schemas image-vers-video et prix par clip
→ Parcourez des exemples Veo 3.1, prompts, réglages et schémas image-vers-vidéo, puis ouvrez une fiche pour voir le coût enregistré

Parcourez des exemples vidéo IA Seedance avec prompts, réglages et prix par clip
→ Parcourez des exemples vidéo IA Seedance avec prompts et réglages, puis ouvrez une fiche pour voir le coût enregistré
```

In `frontend/lib/examples/modelLandingData.es.ts`, make these exact replacements:

```text
Revisa el precio por clip antes de escalar.
→ Abre un ejemplo para revisar su coste registrado antes de escalar.

Revisa ejemplos de video IA de Seedance con prompts, ajustes y precio por clip
→ Revisa ejemplos de video IA de Seedance con prompts y ajustes, y abre una ficha para ver el coste registrado
```

Do not change engine names, slugs, specs, comparison URLs, or pricing anchors.

- [ ] **Step 8: Strengthen the existing Examples architecture contracts**

In `tests/examples-gallery-architecture.test.ts`, add these assertions to the delegation test:

```ts
assert.match(gridSource, /detailsCtaLabel=\{detailsCtaLabel\}/, 'grid should pass the detail affordance to every card');
assert.match(cardSource, /aria-label=\{watchAnchorText\}/, 'the full-card watch link should own the descriptive accessible name');
assert.match(cardSource, /aria-hidden="true"/, 'the visual detail affordance should not duplicate the link name');
assert.doesNotMatch(cardSource, /aria-label=\{altText\}/, 'image alt text should not replace the link action name');
assert.doesNotMatch(cardSource, /recreateHref|showRecreateLink/, 'gallery cards should route through the watch page before recreation');
assert.match(helpersSource, /View settings and price for/, 'watch-link names should describe the detail destination');
```

In `tests/examples-route-architecture.test.ts`, keep all current route-ownership assertions and add:

```ts
assert.match(pageViewSource, /detailsCtaLabel=\{galleryUiCopy\.detailsCta\}/);
assert.match(routeSectionsSource, /detailsCtaLabel=\{detailsCtaLabel\}/);
```

Replace the existing `examples hub owns clone-focused CTR metadata` test block with:

```ts
test('examples hub metadata sends visitors to detail pages for recorded costs', () => {
  const title = 'AI Video Examples: Prompts, Models & Recorded Costs';
  const description =
    'Browse real AI video examples, then open a video to inspect its prompt, settings, duration and recorded render cost before recreating it.';

  assert.equal(enMessages.gallery?.meta?.title, title);
  assert.equal(enMessages.gallery?.meta?.description, description);
  assert.match(pageSource, /titleBranding:\s*locale === 'en' \? 'none' : 'auto'/);

  const metadata = buildSeoMetadata({
    locale: 'en',
    title,
    description,
    englishPath: '/examples',
    titleBranding: 'none',
  });

  assert.equal(typeof metadata.title === 'object' ? metadata.title.absolute : metadata.title, title);
  assert.equal(metadata.description, description);
});
```

Keep the Kling and all other model-family metadata tests unchanged; their pricing language describes the family rather than claiming that the gallery card displays a price. Do not weaken canonical, JSON-LD, pagination, or route ownership assertions.

- [ ] **Step 9: Run all focused Examples and JSON-LD tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/examples-commercial-copy.test.ts \
  tests/examples-gallery-architecture.test.ts \
  tests/examples-route-architecture.test.ts \
  tests/marketing-jsonld-schema-audit.test.ts
```

Expected: PASS. The gallery still links to `/video/<id>`, model links remain available, and FAQ JSON-LD uses the new visible answers.

- [ ] **Step 10: Commit the Examples journey correction**

```bash
git add \
  'frontend/app/(localized)/[locale]/(marketing)/examples' \
  frontend/components/examples \
  frontend/lib/examples \
  frontend/lib/i18n/dictionary-data/en-content.ts \
  frontend/messages/en.json \
  frontend/messages/fr.json \
  frontend/messages/es.json \
  tests/examples-commercial-copy.test.ts \
  tests/examples-gallery-architecture.test.ts \
  tests/examples-route-architecture.test.ts
git commit -m "fix: clarify examples detail journey"
```

---

### Task 3: Distinguish recorded watch-page cost from the live Workspace quote

**Files:**
- Create: `tests/watch-page-commercial-copy.test.ts`
- Modify: `frontend/server/watch-page-signals/content.ts`
- Modify: `frontend/app/(core)/video/[id]/_components/VideoWatchContent.tsx`
- Modify: `frontend/messages/en.json`
- Modify: `frontend/messages/fr.json`
- Modify: `frontend/messages/es.json`
- Modify: `tests/video-page-architecture.test.ts`
- Modify: `tests/watch-page-signals-architecture.test.ts`

**Interfaces:**
- Consumes: the immutable `video.finalPriceCents` and `video.currency` already used by `buildDetailRows`, plus `getDetailValue(detailRows, 'cost')` in the watch content.
- Produces: one label for the historical value: `Recorded render cost` in the current English watch route and equivalent dictionary copy for localized consumers.

- [ ] **Step 1: Write the failing recorded-cost test**

Create `tests/watch-page-commercial-copy.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const signalSource = readFileSync(join(root, 'frontend/server/watch-page-signals/content.ts'), 'utf8');
const contentSource = readFileSync(
  join(root, 'frontend/app/(core)/video/[id]/_components/VideoWatchContent.tsx'),
  'utf8'
);

test('watch surfaces identify historical job cost as recorded render cost', () => {
  assert.match(signalSource, /label: 'Recorded render cost'/);
  assert.match(contentSource, /label: 'Recorded render cost'/);
  assert.doesNotMatch(signalSource, /label: 'Render cost'/);
  assert.doesNotMatch(contentSource, /label: 'Estimated price'/);
});

test('localized recorded-cost labels do not imply a live or estimated quote', () => {
  const expected = {
    en: 'Recorded render cost',
    fr: 'Coût enregistré du rendu',
    es: 'Coste registrado del render',
  } as const;

  for (const locale of ['en', 'fr', 'es'] as const) {
    const messages = JSON.parse(readFileSync(join(root, `frontend/messages/${locale}.json`), 'utf8')) as {
      videoPage: { details: { priceTotalLabel: string } };
    };
    assert.equal(messages.videoPage.details.priceTotalLabel, expected[locale]);
  }
});
```

- [ ] **Step 2: Run the test and verify both conflicting labels fail**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/watch-page-commercial-copy.test.ts
```

Expected: FAIL because the sources currently use `Render cost` and `Estimated price`.

- [ ] **Step 3: Normalize the historical value without touching its calculation**

In `frontend/server/watch-page-signals/content.ts`, change only:

```ts
label: 'Render cost',
```

to:

```ts
label: 'Recorded render cost',
```

In `VideoWatchContent.tsx`, change only the prompt-breakdown row:

```ts
{ label: 'Recorded render cost', value: costLabel ?? 'Shown before render' },
```

Do not change `finalPriceCents`, currency formatting, hero chips, JSON-LD, or recreation URLs.

Change the existing localized `priceTotalLabel` values in place:

```json
// en
"priceTotalLabel": "Recorded render cost"

// fr
"priceTotalLabel": "Coût enregistré du rendu"

// es
"priceTotalLabel": "Coste registrado del render"
```

- [ ] **Step 4: Update architecture assertions and run the watch suite**

In `tests/video-page-architecture.test.ts`, replace the old assertion with:

```ts
assert.match(contentSource, /Recorded render cost/, 'watch page should identify the historical job cost');
assert.doesNotMatch(contentSource, /Estimated price/, 'watch page should not present recorded cost as a live estimate');
```

In `tests/watch-page-signals-architecture.test.ts`, add:

```ts
assert.match(readModule('content.ts'), /Recorded render cost/);
assert.doesNotMatch(readModule('content.ts'), /label: 'Render cost'/);
```

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/watch-page-commercial-copy.test.ts \
  tests/video-page-architecture.test.ts \
  tests/watch-page-signals-architecture.test.ts \
  tests/watch-page-aspect-ratio.test.ts
```

Expected: PASS with the same monetary value and watch-page layout.

- [ ] **Step 5: Commit the recorded-cost terminology**

```bash
git add \
  'frontend/app/(core)/video/[id]/_components/VideoWatchContent.tsx' \
  frontend/server/watch-page-signals/content.ts \
  frontend/messages/en.json \
  frontend/messages/fr.json \
  frontend/messages/es.json \
  tests/watch-page-commercial-copy.test.ts \
  tests/video-page-architecture.test.ts \
  tests/watch-page-signals-architecture.test.ts
git commit -m "fix: distinguish recorded example cost"
```

---

### Task 4: Defer shared-video recreation until the engine catalog is ready

**Files:**
- Modify: `frontend/app/(core)/(workspace)/app/_lib/workspace-video-settings.ts`
- Modify: `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceVideoSettings.ts`
- Modify: `tests/workspace-video-settings.test.ts`
- Modify: `tests/workspace-video-settings-hook-contract.test.ts`

**Interfaces:**
- Consumes: `sharedVideoSettings: SharedVideoPreview | null` and `engines: EngineCaps[]` already passed to `useWorkspaceVideoSettings`.
- Produces: `canApplySharedVideoSettings(sharedVideoSettings: unknown, engineCount: number): boolean` and a guarded effect that does not call snapshot resolution or job hydration until `engineCount > 0`.

- [ ] **Step 1: Add the failing pure readiness tests**

Extend the import in `tests/workspace-video-settings.test.ts`:

```ts
import {
  buildVideoSettingsFormState,
  buildVideoSettingsSnapshotFromTile,
  canApplySharedVideoSettings,
  resolveVideoSettingsSnapshot,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-video-settings';
```

Add:

```ts
test('shared video settings wait for a non-empty engine catalog', () => {
  const sharedVideo = { id: 'job_123' };
  assert.equal(canApplySharedVideoSettings(sharedVideo, 0), false);
  assert.equal(canApplySharedVideoSettings(sharedVideo, 1), true);
  assert.equal(canApplySharedVideoSettings(null, 1), false);
});
```

Extend `tests/workspace-video-settings-hook-contract.test.ts` with:

```ts
assert.match(hookSource, /canApplySharedVideoSettings\(sharedVideoSettings, engines\.length\)/);
assert.match(hookSource, /if \(!canApplySharedVideoSettings/);
assert.match(hookSource, /engines\.length/);
```

- [ ] **Step 2: Run the focused tests and verify the helper is missing**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/workspace-video-settings.test.ts \
  tests/workspace-video-settings-hook-contract.test.ts
```

Expected: FAIL because `canApplySharedVideoSettings` is not exported or used.

- [ ] **Step 3: Add the minimal pure readiness predicate**

Add near the exported snapshot types in `workspace-video-settings.ts`:

```ts
export function canApplySharedVideoSettings(
  sharedVideoSettings: unknown,
  engineCount: number
): boolean {
  return Boolean(sharedVideoSettings) && engineCount > 0;
}
```

Do not modify `resolveVideoSettingsSnapshot`; its `No engines available to apply this snapshot` error remains valid for direct misuse and its existing legacy/fallback policy remains unchanged.

- [ ] **Step 4: Gate the shared-video effect at the hydration boundary**

Import `canApplySharedVideoSettings` into `useWorkspaceVideoSettings.ts` with the other `workspace-video-settings` exports.

Replace the current shared-video effect with:

```ts
useEffect(() => {
  if (!canApplySharedVideoSettings(sharedVideoSettings, engines.length)) return;
  if (!sharedVideoSettings) return;
  applyVideoSettingsSnapshot(buildVideoSettingsSnapshotFromSharedVideo(sharedVideoSettings));
  void hydrateVideoSettingsFromJob(sharedVideoSettings.id);
}, [
  applyVideoSettingsSnapshot,
  engines.length,
  hydrateVideoSettingsFromJob,
  sharedVideoSettings,
]);
```

The second null check is intentional TypeScript narrowing after the pure predicate. Do not clear `notice`, mark the shared video consumed, change URL cleanup, or add a second ref in this task.

- [ ] **Step 5: Run hydration, resolver, and route contract tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/workspace-video-settings.test.ts \
  tests/workspace-video-settings-hook-contract.test.ts \
  tests/workspace-route-form-state-contract.test.ts \
  tests/workspace-engine-mode-state-contract.test.ts
```

Expected: PASS. The prior guest duration regression test still proves `durationOption` follows the selected example, and the resolver fallback behavior remains unchanged.

- [ ] **Step 6: Commit the hydration fix**

```bash
git add \
  'frontend/app/(core)/(workspace)/app/_lib/workspace-video-settings.ts' \
  'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceVideoSettings.ts' \
  tests/workspace-video-settings.test.ts \
  tests/workspace-video-settings-hook-contract.test.ts
git commit -m "fix: defer shared video settings hydration"
```

---

### Task 5: Cross-surface validation and manual conversion-journey QA

**Files:**
- Verify only; no production file should change unless a failing check identifies a real regression within this specification.

**Interfaces:**
- Consumes: the four independently committed tasks above.
- Produces: evidence that Status, Examples, watch-page cost language, and guest/auth recreation work together without SEO, localization, architecture, or build regressions.

- [ ] **Step 1: Scan for prohibited public claims and stale conflicting labels**

Run:

```bash
rg -n -i \
  'Pika provider latency|Callbacks & webhooks|refresh continuously|automatically shifts traffic|RSS feed|email digest|pricing shown per clip|price per clip|prix par clip|precio por clip|Estimated price' \
  'frontend/app/(localized)/[locale]/(marketing)/status' \
  'frontend/app/(localized)/[locale]/(marketing)/examples' \
  frontend/components/examples \
  frontend/lib/examples \
  frontend/server/watch-page-signals \
  'frontend/app/(core)/video/[id]' \
  frontend/messages/en.json \
  frontend/messages/fr.json \
  frontend/messages/es.json
```

Expected: no matches in the touched Status, Examples, or watch commercial copy. If a match is an unrelated accurate pricing explanation rather than a gallery-display promise, narrow the automated test to the exact false phrase and document why the source is outside this lot; do not perform a global marketing rewrite.

- [ ] **Step 2: Run all focused and architecture tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/status-page-trust.test.ts \
  tests/customer-facing-legal-contact.test.ts \
  tests/examples-commercial-copy.test.ts \
  tests/examples-gallery-architecture.test.ts \
  tests/examples-route-architecture.test.ts \
  tests/marketing-jsonld-schema-audit.test.ts \
  tests/watch-page-commercial-copy.test.ts \
  tests/video-page-architecture.test.ts \
  tests/watch-page-signals-architecture.test.ts \
  tests/watch-page-aspect-ratio.test.ts \
  tests/workspace-video-settings.test.ts \
  tests/workspace-video-settings-hook-contract.test.ts \
  tests/workspace-route-form-state-contract.test.ts \
  tests/workspace-engine-mode-state-contract.test.ts
```

Expected: all tests PASS.

- [ ] **Step 3: Run repository quality gates**

Run each command separately and fix only in-scope failures:

```bash
npm --prefix frontend run lint
pnpm --prefix frontend exec tsc --noEmit
npm run lint:exposure
git diff --check
```

Expected: all exit with status 0.

- [ ] **Step 4: Run the production build**

```bash
pnpm --prefix frontend run build
```

Expected: build exits 0; localized Status and Examples routes compile, and no server-only module leaks into client bundles.

- [ ] **Step 5: Verify the public journey in the in-app browser**

Use `browser:control-in-app-browser` and inspect the running local application at desktop and mobile widths:

1. Open `/status`, `/fr/statut`, and `/es/estado`.
2. Confirm the neutral state says only that no notice is published and does not claim every subsystem is operational.
3. Enable a temporary administrator service notice through the existing local admin flow if available; confirm its message is displayed verbatim, then restore the prior setting.
4. Open `/examples`; confirm cards visually show `View settings & price`, retain one full-card watch link, retain their model link, and expose a visible keyboard focus ring.
5. Open a card; confirm the watch page displays prompt/settings and `Recorded render cost` with the existing amount.
6. As a guest, select `Recreate this video`; confirm engine, prompt, duration, resolution, aspect ratio, audio, preview, and current Generate price restore, and confirm no `No engines available to apply this snapshot` notice appears.
7. Repeat the recreation while authenticated.
8. Smoke-test French and Spanish Examples copy and mobile reflow for Status, gallery cards, watch details, and the Workspace notice area.

Expected: every acceptance criterion in `docs/superpowers/specs/2026-07-10-commercial-trust-consistency-design.md` is visibly satisfied.

- [ ] **Step 6: Review the final diff and commit only if validation required changes**

```bash
git status --short
git diff --stat origin/main...HEAD
git diff --check
```

Expected: only the planned files are changed. If Step 1–5 finds a regression, return to the owning task, add a failing regression assertion to that task's test, apply the smallest in-scope fix, rerun that task's command, and commit the exact changed files under that task's commit message. If validation requires no code changes, do not create an empty commit.

---

## Completion Criteria

- `/status`, `/fr/statut`, and `/es/estado` remain reachable, canonical, hreflang-linked, indexable, and present only the administrator notice or neutral empty state.
- No Status source claims unsupported live telemetry, automatic rerouting, queue refresh frequency, public incident history, RSS, or email subscriptions.
- Examples hero, descriptions, cards, featured CTA, FAQs, metadata, and model-family copy direct visitors to a watch page for prompt, settings, and recorded cost.
- Every gallery card retains one primary watch-page link and shows a localized non-interactive detail affordance.
- Watch-page historical cost consistently reads `Recorded render cost`; generation pricing calculations and displayed amounts are unchanged.
- Guest and authenticated `?from=job_*` recreation waits for engines, restores the recorded settings, and does not show the false empty-engine notice.
- Focused tests, architecture tests, lint, TypeScript, exposure lint, diff checks, production build, and manual browser checks all pass.
