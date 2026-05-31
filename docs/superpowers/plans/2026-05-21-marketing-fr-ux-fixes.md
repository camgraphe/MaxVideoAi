# Marketing French UX Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the new French visitor experience found in the May 21, 2026 marketing audit: French gallery clicks should not drop into an English watch page, `/app` should inherit the French locale from marketing, model and compare surfaces should use polished French labels, and verification should cover the exact first-user journey.

**Architecture:** Preserve current SEO/canonical behavior. The public canonical watch URL remains `/video/[id]`; localized marketing watch URLs render localized UI and keep canonical/noindex metadata as appropriate. Keep route files as orchestrators, put locale/copy/href logic in helpers, and update architecture tests when responsibilities move.

**Tech Stack:** Next.js App Router, React Server/Client Components, `next-intl`, existing Node architecture tests, Playwright/Atlas smoke testing.

---

## Problems Confirmed

- `/fr/galerie` example cards link to `/video/[id]`, which renders English labels (`Home`, `Examples`, `Render details`, `Recreate`) and breaks French-language continuity.
- The watch page prompt label says `Text-to-video prompt used to generate this render.` even for image-to-video renders.
- Visiting `/fr/tarifs` then opening `/app` shows the workspace in English, because `frontend/lib/i18n/server.ts` only trusts `next-intl` locale detection and does not fall back to locale cookies for non-localized core routes.
- `/fr/modeles` has visible unaccented or English copy such as `modeles`, `generer`, `duree`, `A partir`, `Jusqu a`, `Res. max.`, and `Image-to-video`.
- `/fr/comparatif/...` can still show English support values inside generated summaries, for example `Not supported vs Supported`.
- Pricing is mostly acceptable, but should be included in the final smoke test because it is the entry point that exposed the `/app` locale issue.

---

## Phase 1 - Lock The Locale Contract

- [ ] Add a pure locale resolver helper.

  Create `frontend/lib/i18n/server-locale.ts`:

  ```ts
  import type { AppLocale } from '@/i18n/locales';
  import { defaultLocale, locales } from '@/i18n/locales';
  import { LOCALE_COOKIE } from '@/lib/i18n/constants';
  import type { Locale } from '@/lib/i18n/types';

  type LocaleCookieValues = Partial<Record<typeof LOCALE_COOKIE | 'NEXT_LOCALE', string | undefined>>;

  export function normalizeServerLocale(value: string | null | undefined): Locale | null {
    if (!value) return null;
    return locales.includes(value as AppLocale) ? (value as Locale) : null;
  }

  export function resolveLocaleFromServerSignals({
    detected,
    cookies,
  }: {
    detected?: string | null;
    cookies?: LocaleCookieValues;
  }): Locale {
    return (
      normalizeServerLocale(detected) ??
      normalizeServerLocale(cookies?.[LOCALE_COOKIE]) ??
      normalizeServerLocale(cookies?.NEXT_LOCALE) ??
      defaultLocale
    );
  }
  ```

- [ ] Update `frontend/lib/i18n/server.ts` to read locale cookies when `getLocale()` does not return a supported locale.

  Use `cookies()` from `next/headers`, but keep the cookie ordering in the pure helper so it can be tested without Next runtime mocking.

- [ ] Add `tests/i18n-server-locale.test.ts`.

  Assertions:

  - detected locale wins when supported.
  - `mvid_locale=fr` resolves to `fr`.
  - `NEXT_LOCALE=es` resolves to `es` if `mvid_locale` is absent.
  - invalid cookie values fall back to `defaultLocale`.

- [ ] Fix header mobile labels in `frontend/components/HeaderBar.tsx`.

  Replace hardcoded `Creer` with `Créer`, or better use existing translation keys:

  ```ts
  const createAccountMobile = t('workspace.header.createAccountMobile', {
    fallback: locale === 'fr' ? 'Créer' : locale === 'es' ? 'Crear' : 'Create',
  });
  ```

  If adding new dictionary keys, add them to `frontend/messages/en.json`, `frontend/messages/fr.json`, and `frontend/messages/es.json`.

---

## Phase 2 - Keep French Gallery Clicks In French

- [ ] Add a localized watch href helper to `frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-hrefs.ts`.

  ```ts
  import type { AppLocale } from '@/i18n/locales';

  export function buildExampleWatchHref(locale: AppLocale, videoId: string): string {
    const encodedId = encodeURIComponent(videoId);
    return locale === 'en' ? `/video/${encodedId}` : `/${locale}/video/${encodedId}`;
  }
  ```

- [ ] Update `frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-data.ts`.

  Import `buildExampleWatchHref` and replace:

  ```ts
  href: `/video/${encodeURIComponent(video.id)}`,
  ```

  with:

  ```ts
  href: buildExampleWatchHref(locale, video.id),
  ```

- [ ] Keep `frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-jsonld.ts` on canonical `/video/[id]` unless SEO requirements explicitly change. JSON-LD should continue to describe canonical assets, while the UI card href keeps the visitor in the localized route.

- [ ] Extend `tests/examples-route-architecture.test.ts`.

  Add assertions that:

  - `examples-page-hrefs.ts` exports `buildExampleWatchHref`.
  - `examples-page-data.ts` imports and calls `buildExampleWatchHref(locale, video.id)`.
  - JSON-LD still uses canonical `/video/[id]` links.

---

## Phase 3 - Render A Localized Watch Page

- [ ] Convert `frontend/app/(localized)/[locale]/(marketing)/video/[videoId]/page.tsx` from redirect-only to render the shared watch experience.

  Keep metadata canonical to `/video/[id]` and keep robots `noindex` if that is the existing SEO contract, but render localized UI for users who arrive from `/fr/galerie`.

  Route responsibilities should stay small:

  ```tsx
  export default async function LocalizedVideoPage({ params }: Props) {
    const { locale, videoId } = await params;
    const page = await getVideoWatchPageDataById(videoId);

    if (!page) {
      return <VideoUnavailableState locale={locale} />;
    }

    return <VideoWatchContent page={page} locale={locale} />;
  }
  ```

- [ ] Add `locale?: AppLocale` props to the watch components.

  Files:

  - `frontend/app/(core)/video/[id]/_components/VideoWatchContent.tsx`
  - `frontend/app/(core)/video/[id]/_components/VideoWatchSidebar.tsx`
  - `frontend/app/(core)/video/[id]/_components/VideoWatchRelatedExamples.tsx`
  - `frontend/app/(core)/video/[id]/_components/VideoUnavailableState.tsx`

  Default locale to `en` so the canonical core route remains unchanged.

- [ ] Extract watch-page copy into `frontend/app/(core)/video/[id]/_lib/video-watch-copy.ts`.

  Include all labels currently hardcoded in `VideoWatchContent.tsx` and `VideoWatchSidebar.tsx`:

  - breadcrumbs: `Home`, `Examples`, `Models`
  - sidebar: `Render details`, `Workflow`, `Created`, `Recreate in workspace`, `Open in workspace`, `About this engine`, `Learn more about this engine`, `Shot highlights`
  - prompt: `Prompt breakdown`, `Copy full prompt`, `Copied!`, `Show full prompt`, `Hide full prompt`, `Prompt improvement notes`
  - CTA: `Start a render`, `Recreate this video`, `Open model page`, `Compare this model`
  - pricing/details: `Estimated price`, `Key frames`

  The prompt description must be workflow-aware:

  ```ts
  export function getPromptDescription(locale: AppLocale, workflowLabel?: string | null) {
    const isImageToVideo = /image/i.test(workflowLabel ?? '');
    if (locale === 'fr') {
      return isImageToVideo
        ? 'Prompt image-vers-vidéo utilisé pour générer ce rendu.'
        : 'Prompt texte-vers-vidéo utilisé pour générer ce rendu.';
    }
    return isImageToVideo
      ? 'Image-to-video prompt used to generate this render.'
      : 'Text-to-video prompt used to generate this render.';
  }
  ```

- [ ] Add localized href mapping for watch-page internal links.

  Put this in `frontend/app/(core)/video/[id]/_lib/video-watch-locale.ts`:

  ```ts
  import type { AppLocale } from '@/i18n/locales';

  export function localizeWatchHref(locale: AppLocale, href: string | null | undefined) {
    if (!href || locale === 'en') return href ?? null;
    if (href.startsWith('/examples')) return href.replace('/examples', `/${locale}/galerie`);
    if (href.startsWith('/models')) return href.replace('/models', `/${locale}/modeles`);
    if (href.startsWith('/ai-video-engines')) return href.replace('/ai-video-engines', `/${locale}/comparatif`);
    return href;
  }
  ```

  Use it when rendering model, examples, related, and compare links. Do not rewrite `/app?from=...`; it should stay `/app?from=...` and rely on the server locale cookie fix from Phase 1.

- [ ] Localize dates in `frontend/app/(core)/video/[id]/_lib/video-watch-page-utils.ts`.

  Change `formatWatchDate` to accept `locale` and call `Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : locale === 'es' ? 'es-ES' : 'en-US', ...)`.

- [ ] Update `tests/video-page-architecture.test.ts`.

  Current assertions expect English hardcoded labels in `VideoWatchContent.tsx`. Replace those checks with:

  - `VideoWatchContent.tsx` imports `getVideoWatchCopy` or equivalent.
  - `VideoWatchContent.tsx` passes `locale` to `VideoWatchSidebar` and `VideoWatchRelatedExamples`.
  - `video-watch-copy.ts` exists and exports the localized copy helper.
  - `video-watch-locale.ts` exists and exports `localizeWatchHref`.

- [ ] Add `tests/video-watch-localization.test.ts`.

  Assertions:

  - French copy includes `Détails du rendu`, `Recréer cette vidéo`, `Prompt image-vers-vidéo`.
  - `localizeWatchHref('fr', '/examples/kling') === '/fr/galerie/kling'`.
  - `localizeWatchHref('fr', '/models/seedance-2-0') === '/fr/modeles/seedance-2-0'`.
  - `localizeWatchHref('fr', '/ai-video-engines/seedance-2-0-vs-veo-3-1') === '/fr/comparatif/seedance-2-0-vs-veo-3-1'`.

---

## Phase 4 - Polish French Model Catalog Copy

- [ ] Update `frontend/messages/fr.json` under the model catalog/decision keys.

  Replace the visible unaccented strings from the audit:

  - `Annuaire des modeles IA video & image` -> `Annuaire des modèles IA vidéo et image`
  - `Comparez les modeles IA video & image avant de generer` -> `Comparez les modèles IA vidéo et image avant de générer`
  - `Parcourez les modeles video, image, audio et preparation...` -> accented French copy
  - `Parcourir les modeles` -> `Parcourir les modèles`
  - `Choisir le bon modele...` -> `Choisir le bon modèle...`
  - `A partir` -> `À partir`
  - `Jusqu a` -> `Jusqu’à`
  - `Res. max.` -> `Rés. max.`
  - `cote a cote` -> `côte à côte`
  - `duree`, `resolution`, `entree`, `generer` -> accented forms where they are UI copy.

- [ ] Update `frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-decision-data.ts`.

  French rows should use:

  - `Image vers vidéo`, not `Image-to-video`.
  - `Durée`, not `Duree`.
  - `Qualité de sortie`.
  - `Vérifiez la durée vidéo maximale...`.
  - `modèles`, `générer`, `audio natif`.

- [ ] Do a narrow pass over `frontend/lib/examples/modelLandingData.fr.ts` for the same high-visibility words only. Keep this scoped to copy quality; do not rewrite page architecture.

- [ ] Add `tests/french-marketing-copy-quality.test.ts`.

  It should scan the specific French files above and fail on the known audit tokens in user-visible copy:

  ```ts
  const banned = [
    /\bmodeles\b/i,
    /\bgenerer\b/i,
    /\bduree\b/i,
    /\bresolution\b/i,
    /\bA partir\b/,
    /\bJusqu a\b/,
    /\bImage-to-video\b/,
  ];
  ```

  Keep allowlists for URLs, slugs, engine IDs, and English-only technical fields if needed.

---

## Phase 5 - Localize Compare Support Summaries

- [ ] Update compare status labels in `frontend/messages/fr.json`.

  Prefer:

  - `supported`: `Pris en charge`
  - `notSupported`: `Non pris en charge`
  - `pending`: `Donnée à confirmer` or the existing product wording if already standardized.

- [ ] Update `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-spec-values.ts`.

  Keep raw computed support values as English canonical tokens for internal parsing, but expose a single display helper for summaries and spec rows:

  ```ts
  export function isSupportedSpecValue(value: string) {
    const normalized = value.trim().toLowerCase();
    return normalized === 'supported' || normalized.startsWith('supported ');
  }

  export function isUnsupportedSpecValue(value: string) {
    const normalized = value.trim().toLowerCase();
    return normalized === 'not supported' || normalized.startsWith('not supported ');
  }
  ```

  Reuse `localizeSpecDetailValue` for all rendered values.

- [ ] Update `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-scorecard.ts`.

  `valueForSupport` should:

  - use `isSupportedSpecValue` for winner detection.
  - pass localized values to the summary template:

    ```ts
    const leftDisplayValue = localizeSpecDetailValue(leftValue, activeLocale, labels);
    const rightDisplayValue = localizeSpecDetailValue(rightValue, activeLocale, labels);
    ```

  - never inject raw `Supported` or `Not supported` into French summaries.

- [ ] Add `tests/compare-page-localization.test.ts`.

  Directly call the helper functions and assert:

  - `localizeSpecDetailValue('Supported (modify / reframe workflows)', 'fr', labels)` contains `Pris en charge`.
  - `buildCompareSummaryRows(...)` with a supported vs unsupported pair in `fr` returns a value that contains `Pris en charge` / `Non pris en charge`, and does not contain `Supported` / `Not supported`.

- [ ] Extend `tests/compare-page-architecture.test.ts` if new helper exports are added.

---

## Phase 6 - Pricing And App Entry Smoke Contract

- [ ] Do not change pricing architecture unless the smoke test reveals a visible copy issue. `frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubCopy.ts` is already mostly localized.

- [ ] Add a small regression test for the marketing-to-app locale behavior once Phase 1 is in place.

  Preferred option: pure helper test in `tests/i18n-server-locale.test.ts` is enough for server behavior. If an existing middleware/i18n test exists, add an assertion that localized marketing pages write `mvid_locale` and `NEXT_LOCALE`.

- [ ] Manual smoke test after implementation:

  1. Open a fresh browser context.
  2. Visit `/fr/tarifs`.
  3. Click the live price/app CTA.
  4. Confirm `/app` shows French workspace copy such as `Créer un compte`, `Générer une vidéo`, and `Choisir un moteur`.

---

## Verification Commands

- [ ] Run focused Node tests:

  ```bash
  node --test \
    tests/i18n-server-locale.test.ts \
    tests/video-watch-localization.test.ts \
    tests/examples-route-architecture.test.ts \
    tests/compare-page-localization.test.ts \
    tests/french-marketing-copy-quality.test.ts
  ```

- [ ] Run architecture tests touched by the plan:

  ```bash
  node --test \
    tests/video-page-architecture.test.ts \
    tests/video-seo-canonical-slugs.test.ts \
    tests/compare-page-architecture.test.ts \
    tests/models-catalog-architecture.test.ts \
    tests/header-bar-architecture.test.ts \
    tests/workspace-app-client-architecture.test.ts \
    tests/pricing-page-architecture.test.ts
  ```

- [ ] Run project checks:

  ```bash
  npm --prefix frontend run lint
  npm run lint:exposure
  git diff --check
  ```

- [ ] Run a local smoke test with the current app:

  ```bash
  npm --prefix frontend run dev
  ```

  Then verify in Playwright or Atlas:

  - `/fr/galerie` -> open any example card -> URL stays under `/fr/video/...` and labels are French.
  - The same watch page shows workflow-aware prompt copy for image-to-video examples.
  - `/fr/modeles` has accented French in the hero and recommended cards.
  - `/fr/comparatif/seedance-2-0-vs-veo-3-1` has no visible `Supported` / `Not supported` in French summaries.
  - `/fr/tarifs` -> app CTA -> `/app` workspace opens with French copy.

---

## Rollout Notes

- Keep behavior changes scoped to locale presentation and href routing. Do not change pricing math, engine catalogs, auth, generation submission, or video data access.
- Keep canonical metadata for `/video/[id]` stable. The localized watch route is a UX continuity route, not a new SEO landing surface.
- If localized watch rendering creates import-boundary friction from `app/(core)`, extract only the shared watch page shell to a neutral component/helper path; do not duplicate the watch page.
- If a copy-quality regex catches slugs or engine IDs, add a precise allowlist rather than weakening the test globally.
