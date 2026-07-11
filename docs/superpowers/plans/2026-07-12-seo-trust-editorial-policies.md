# SEO Trust And Editorial Policies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a compact, localized trust layer that names Adrien Millot as MaxVideoAI's author and editorial lead, explains editorial standards, clarifies commercial-use rights, and connects About, Company, the blog, Benchmark Lab, and the Terms without inventing people, credentials, or evidence.

**Architecture:** A server-safe editorial profile becomes the shared identity source. Thin marketing route orchestrators compose localized route-local copy and focused Server Components; blog and benchmark structured data consume the same profile. The Terms remain code-owned but share one fallback-version constant with consent entry points, while production publication continues through the existing Admin legal-document version and soft re-consent workflow.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, next-intl routing, Tailwind semantic tokens, Schema.org JSON-LD, Node test runner through `tsx`, existing MaxVideoAI sitemap and legal-consent infrastructure.

## Global Constraints

- Public identity is exactly `Adrien Millot`, `Founder & Product Lead`, `France`.
- English copy uses American English; Spanish uses Latin American Spanish and existing `es-419` metadata; French remains idiomatic French.
- Do not invent a team, reviewer, advisory board, certification, laboratory, qualification, award, affiliation, customer, or testing volume.
- Do not display generation counts, benchmark run counts, customer counts, or other small-volume proof.
- Do not add a separate author route or split Editorial Standards into thin policy routes.
- Do not imply independent external review, laboratory certification, or documented historical prompt-pack runs.
- Do not change benchmark scores, formulas, latency thresholds, pricing, wallet behavior, refund automation, model routes, or comparison routes.
- Do not revise the existing MaxVideoAI generated-media licence beyond the approved commercial-use clarification.
- Do not claim that MaxVideoAI never trains on, stores, or displays user content.
- Do not add repeated caveats to model, comparison, pricing, workspace, or generation pages.
- Current renders remain described as private by default only because the current Terms say so.
- The exact approved French commercial-use rule is: `Les utilisateurs peuvent utiliser commercialement leurs générations, sous réserve des droits de tiers, des lois applicables et des éventuelles restrictions propres au modèle ou fournisseur utilisé.`
- The Terms version change must use the existing soft re-consent workflow; default grace period remains 14 days.
- Keep public `page.tsx` files as route orchestrators and use Server Components unless browser APIs or interaction require a client boundary.
- Use only existing dependencies and semantic design tokens.
- Preserve unrelated worktree changes and generated SEO matrices.

---

## File Structure

### Shared identity

- Create `frontend/lib/editorial/profile.ts`: verified profile registry, localized bio, localized About fragment, absolute author URL.
- Create `tests/editorial-profile.test.ts`: profile contract, locale URLs, and unknown-id fallback.

### About

- Create `frontend/app/(localized)/[locale]/(marketing)/about/_lib/about-copy.ts`: complete localized About content.
- Create `frontend/app/(localized)/[locale]/(marketing)/about/_lib/about-schema.ts`: WebPage and breadcrumb builders.
- Create `frontend/app/(localized)/[locale]/(marketing)/about/_components/AboutView.tsx`: visual About composition.
- Modify `frontend/app/(localized)/[locale]/(marketing)/about/page.tsx`: metadata, profile resolution, schemas, and view orchestration.
- Create `tests/about-editorial-trust.test.ts`: identity, disclosure, schema, and architecture contract.

### Editorial Standards

- Create `frontend/app/(localized)/[locale]/(marketing)/editorial-standards/_lib/editorial-standards-copy.ts`: localized policy content.
- Create `frontend/app/(localized)/[locale]/(marketing)/editorial-standards/_lib/editorial-standards-schema.ts`: WebPage and breadcrumb builders.
- Create `frontend/app/(localized)/[locale]/(marketing)/editorial-standards/_components/EditorialStandardsView.tsx`: policy page sections.
- Create `frontend/app/(localized)/[locale]/(marketing)/editorial-standards/page.tsx`: localized route orchestrator.
- Create `frontend/app/editorial-standards/page.tsx`: default English wrapper.
- Modify `frontend/config/localized-slugs.json`, `frontend/i18n/routing.ts`, `frontend/lib/seo/hreflang.ts`, and `frontend/next-sitemap.config.js`: localized route graph.
- Create `tests/editorial-standards-route.test.ts`: route, copy, metadata, schema, sitemap, and routing coverage.

### Blog

- Modify `frontend/lib/content/markdown.ts`: optional `authorId` front-matter contract.
- Create `frontend/app/(localized)/[locale]/(marketing)/blog/[slug]/_lib/blog-editorial-copy.ts`: localized byline labels.
- Create `frontend/app/(localized)/[locale]/(marketing)/blog/[slug]/_components/blog-author-byline.tsx`: visible byline and author card.
- Modify `frontend/app/(localized)/[locale]/(marketing)/blog/[slug]/page.tsx`: resolve profile and dates.
- Modify `frontend/app/(localized)/[locale]/(marketing)/blog/[slug]/_components/blog-post-view.tsx`: render the byline and card.
- Modify `frontend/app/(localized)/[locale]/(marketing)/blog/[slug]/_lib/blog-post-seo.ts`: Person author JSON-LD.
- Modify `tests/blog-post-route-architecture.test.ts` and `tests/marketing-jsonld-schema-audit.test.ts`: visible and structured authorship contracts.

### Benchmark Lab

- Create `frontend/app/(localized)/[locale]/(marketing)/benchmarks/_components/BenchmarkEditorialOwnership.tsx`: named owner, methodology version/date, trust links.
- Modify `frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-copy.ts`: localized ownership labels.
- Modify `frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-schema.ts`: Person author on WebPage.
- Modify `frontend/app/(localized)/[locale]/(marketing)/benchmarks/_components/BenchmarkLabView.tsx` and `page.tsx`: profile orchestration and rendering.
- Modify `tests/benchmark-lab-route.test.ts`: ownership and schema assertions.

### Company

- Create `frontend/app/(localized)/[locale]/(marketing)/company/_lib/company-copy.ts`: localized hub and rights copy.
- Create `frontend/app/(localized)/[locale]/(marketing)/company/_components/CompanyTrustView.tsx`: grouped trust navigation and rights panel.
- Modify `frontend/app/(localized)/[locale]/(marketing)/company/page.tsx`: thin metadata/profile/view orchestration.
- Create `tests/company-content-rights.test.ts`: links, exact meaning, localization, and architecture.

### Terms and release operations

- Modify `frontend/app/(core)/legal/terms/_components/TermsArticleEn.tsx`, `TermsArticleFr.tsx`, and `TermsArticleEs.tsx`: stable rights fragment and commercial-use rule.
- Modify `frontend/src/lib/legal.ts`, `frontend/app/(core)/legal/terms/page.tsx`, and `frontend/app/api/legal/consents/route.ts`: one fallback-version source.
- Create `docs/deployment/legal-document-rollout.md`: deploy, verify, publish version, and test soft re-consent.
- Modify `tests/legal-documents-architecture.test.ts`: clause, deep link, fallback version, and re-consent architecture.

---

### Task 1: Create The Verified Editorial Profile Contract

**Files:**
- Create: `frontend/lib/editorial/profile.ts`
- Create: `tests/editorial-profile.test.ts`

**Interfaces:**
- Consumes: `AppLocale`, `localizePathFromEnglish()`, and `SITE_BASE_URL`.
- Produces: `DEFAULT_EDITORIAL_PROFILE_ID`, `ResolvedEditorialProfile`, `getEditorialProfile(locale, id?)`, and `getEditorialProfileAbsoluteUrl(profile)` for all later tasks.

- [ ] **Step 1: Write the failing profile contract test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_EDITORIAL_PROFILE_ID,
  getEditorialProfile,
  getEditorialProfileAbsoluteUrl,
} from '../frontend/lib/editorial/profile';

test('verified editorial profile resolves localized identity URLs', () => {
  const expected = {
    en: '/about#adrien-millot',
    fr: '/fr/a-propos#adrien-millot',
    es: '/es/acerca-de#adrien-millot',
  } as const;

  for (const locale of ['en', 'fr', 'es'] as const) {
    const profile = getEditorialProfile(locale);
    assert.equal(profile.id, DEFAULT_EDITORIAL_PROFILE_ID);
    assert.equal(profile.name, 'Adrien Millot');
    assert.equal(profile.jobTitle, 'Founder & Product Lead');
    assert.equal(profile.location, 'France');
    assert.equal(profile.aboutHref, expected[locale]);
    assert.ok(profile.bio.length >= 80);
    assert.equal(
      getEditorialProfileAbsoluteUrl(profile),
      `https://maxvideoai.com${expected[locale]}`,
    );
  }
});

test('unknown future author ids fail closed to the verified default', () => {
  assert.equal(getEditorialProfile('en', 'unknown-person').id, 'adrien-millot');
});
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/editorial-profile.test.ts`

Expected: FAIL with `Cannot find module '../frontend/lib/editorial/profile'`.

- [ ] **Step 3: Implement the server-safe profile registry**

```ts
import type { AppLocale } from '@/i18n/locales';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import { SITE_BASE_URL } from '@/lib/metadataUrls';

export const DEFAULT_EDITORIAL_PROFILE_ID = 'adrien-millot' as const;

export type ResolvedEditorialProfile = {
  id: typeof DEFAULT_EDITORIAL_PROFILE_ID;
  name: string;
  jobTitle: string;
  location: string;
  bio: string;
  aboutHref: string;
};

const BIOS: Record<AppLocale, string> = {
  en: 'Adrien Millot is the founder and product lead of MaxVideoAI. He builds the product, evaluates model behavior, and maintains its practical guides and benchmark methodology.',
  fr: 'Adrien Millot est le fondateur et responsable produit de MaxVideoAI. Il développe le produit, évalue le comportement des modèles et maintient ses guides pratiques ainsi que sa méthodologie de benchmark.',
  es: 'Adrien Millot es el fundador y responsable de producto de MaxVideoAI. Desarrolla el producto, evalúa el comportamiento de los modelos y mantiene sus guías prácticas y su metodología de benchmarks.',
};

export function getEditorialProfile(
  locale: AppLocale,
  id: string = DEFAULT_EDITORIAL_PROFILE_ID,
): ResolvedEditorialProfile {
  const resolvedId = id === DEFAULT_EDITORIAL_PROFILE_ID ? id : DEFAULT_EDITORIAL_PROFILE_ID;
  return {
    id: resolvedId,
    name: 'Adrien Millot',
    jobTitle: 'Founder & Product Lead',
    location: 'France',
    bio: BIOS[locale] ?? BIOS.en,
    aboutHref: `${localizePathFromEnglish(locale, '/about')}#${resolvedId}`,
  };
}

export function getEditorialProfileAbsoluteUrl(profile: ResolvedEditorialProfile): string {
  return `${SITE_BASE_URL}${profile.aboutHref}`;
}
```

- [ ] **Step 4: Run the profile test and type-check the new module**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/editorial-profile.test.ts && pnpm --prefix frontend exec tsc --noEmit --pretty false`

Expected: profile tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit the profile foundation**

```bash
git add frontend/lib/editorial/profile.ts tests/editorial-profile.test.ts
git commit -m "feat: add verified editorial profile"
```

### Task 2: Redesign About As The Human Source Of Truth

**Files:**
- Create: `frontend/app/(localized)/[locale]/(marketing)/about/_lib/about-copy.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/about/_lib/about-schema.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/about/_components/AboutView.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/about/page.tsx`
- Create: `tests/about-editorial-trust.test.ts`

**Interfaces:**
- Consumes: `getEditorialProfile(locale)`, localized marketing `Link`, `buildSeoMetadata()`, `buildMetadataUrls()`, and `JsonLd`.
- Produces: `AboutView`, `getAboutCopy(locale)`, `buildAboutWebPageJsonLd()`, and `buildAboutBreadcrumbJsonLd()`; later author links target `#adrien-millot` here.

- [ ] **Step 1: Write the failing About architecture and content test**

```ts
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { getAboutCopy } from '../frontend/app/(localized)/[locale]/(marketing)/about/_lib/about-copy';
import { buildAboutWebPageJsonLd } from '../frontend/app/(localized)/[locale]/(marketing)/about/_lib/about-schema';
import { getEditorialProfile } from '../frontend/lib/editorial/profile';

const pagePath = 'frontend/app/(localized)/[locale]/(marketing)/about/page.tsx';
const viewPath = 'frontend/app/(localized)/[locale]/(marketing)/about/_components/AboutView.tsx';

test('About owns a localized human identity and honest commercial disclosure', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = getAboutCopy(locale);
    const profile = getEditorialProfile(locale);
    assert.ok(copy.hero.title.length > 20);
    assert.equal(profile.name, 'Adrien Millot');
    assert.equal(profile.jobTitle, 'Founder & Product Lead');
    assert.equal(profile.location, 'France');
    assert.match(copy.independence.body, /sell|commercialise|comercializa/i);
    assert.equal(copy.sections.length, 3);
  }
});

test('About stays a thin route with focused view and schema modules', () => {
  assert.ok(existsSync(viewPath));
  const page = readFileSync(pagePath, 'utf8');
  const view = readFileSync(viewPath, 'utf8');
  assert.match(page, /AboutView/);
  assert.match(page, /getEditorialProfile/);
  assert.match(page, /buildAboutWebPageJsonLd/);
  assert.doesNotMatch(page, /content\.paragraphs\.map/);
  assert.match(view, /id="adrien-millot"/);
  assert.ok(page.split('\n').length <= 120);
});

test('About schema is a WebPage with MaxVideoAI publisher', () => {
  const schema = buildAboutWebPageJsonLd({
    canonicalUrl: 'https://maxvideoai.com/about',
    copy: getAboutCopy('en'),
    inLanguage: 'en-US',
  });
  assert.equal(schema['@type'], 'WebPage');
  assert.equal(schema.publisher.name, 'MaxVideoAI');
});
```

- [ ] **Step 2: Run the About test and confirm it fails before extraction**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/about-editorial-trust.test.ts`

Expected: FAIL because the route-local copy, schema, and view modules do not exist.

- [ ] **Step 3: Add complete localized About copy**

Implement `getAboutCopy(locale)` with this exact shape and substantive content in all three locales:

```ts
export type AboutCopy = {
  meta: { title: string; description: string };
  hero: { eyebrow: string; title: string; subtitle: string };
  identity: { label: string; body: string };
  sections: Array<{ title: string; body: string }>;
  independence: { title: string; body: string };
  links: { standards: string; benchmarks: string; company: string; legal: string };
};

const COPY: Record<AppLocale, AboutCopy> = {
  en: {
    meta: { title: 'About MaxVideoAI', description: 'Meet the founder of MaxVideoAI and learn how the product, model comparisons, and editorial methodology are maintained.' },
    hero: { eyebrow: 'About MaxVideoAI', title: 'A clearer way to choose and use AI video models.', subtitle: 'MaxVideoAI brings model comparison, price-before-generation, and production workflows into one focused workspace.' },
    identity: { label: 'Built and maintained by', body: 'Adrien builds the product, evaluates model behavior, and maintains MaxVideoAI’s practical guides and benchmark methodology.' },
    sections: [
      { title: 'What we build', body: 'One workspace for comparing current and legacy AI video models, preparing inputs, seeing the price before generation, and reviewing outputs.' },
      { title: 'Why model choice matters', body: 'Different shots need different strengths. MaxVideoAI keeps model capabilities, pricing, examples, and controls visible so the choice stays practical.' },
      { title: 'How we evaluate models', body: 'Provider specifications, observed production timing, and MaxVideoAI editorial scores are kept separate and linked to their methodology.' },
    ],
    independence: { title: 'Our commercial relationship', body: 'MaxVideoAI sells access to the models it covers. We disclose that relationship and separate sourced facts, observed production metrics, and editorial judgment.' },
    links: { standards: 'Read Editorial Standards', benchmarks: 'Open Benchmark Lab', company: 'Company & Trust', legal: 'Legal center' },
  },
  fr: {
    meta: { title: 'À propos de MaxVideoAI', description: 'Découvrez le fondateur de MaxVideoAI et la manière dont le produit, les comparatifs et la méthodologie éditoriale sont maintenus.' },
    hero: { eyebrow: 'À propos de MaxVideoAI', title: 'Une manière plus claire de choisir et d’utiliser les modèles vidéo IA.', subtitle: 'MaxVideoAI réunit comparaison des modèles, prix avant génération et workflows de production dans un espace de travail ciblé.' },
    identity: { label: 'Conçu et maintenu par', body: 'Adrien développe le produit, évalue le comportement des modèles et maintient les guides pratiques ainsi que la méthodologie de benchmark de MaxVideoAI.' },
    sections: [
      { title: 'Ce que nous construisons', body: 'Un seul espace pour comparer les modèles vidéo IA actuels et legacy, préparer les entrées, voir le prix avant génération et examiner les rendus.' },
      { title: 'Pourquoi le choix du modèle compte', body: 'Chaque plan demande des qualités différentes. MaxVideoAI garde capacités, prix, exemples et contrôles visibles pour rendre le choix concret.' },
      { title: 'Comment nous évaluons les modèles', body: 'Les spécifications fournisseurs, les temps de production observés et les scores éditoriaux MaxVideoAI restent séparés et reliés à leur méthodologie.' },
    ],
    independence: { title: 'Notre relation commerciale', body: 'MaxVideoAI commercialise l’accès aux modèles présentés. Nous déclarons cette relation et séparons les faits sourcés, les mesures de production observées et le jugement éditorial.' },
    links: { standards: 'Lire les normes éditoriales', benchmarks: 'Ouvrir Benchmark Lab', company: 'Entreprise & confiance', legal: 'Centre juridique' },
  },
  es: {
    meta: { title: 'Acerca de MaxVideoAI', description: 'Conoce al fundador de MaxVideoAI y cómo se mantienen el producto, las comparativas y la metodología editorial.' },
    hero: { eyebrow: 'Acerca de MaxVideoAI', title: 'Una forma más clara de elegir y usar modelos de video con IA.', subtitle: 'MaxVideoAI reúne comparación de modelos, precio antes de generar y flujos de producción en un solo espacio de trabajo.' },
    identity: { label: 'Creado y mantenido por', body: 'Adrien desarrolla el producto, evalúa el comportamiento de los modelos y mantiene las guías prácticas y la metodología de benchmarks de MaxVideoAI.' },
    sections: [
      { title: 'Lo que desarrollamos', body: 'Un espacio para comparar modelos de video con IA actuales y legacy, preparar entradas, ver el precio antes de generar y revisar resultados.' },
      { title: 'Por qué importa elegir el modelo', body: 'Cada toma necesita fortalezas diferentes. MaxVideoAI mantiene visibles las capacidades, los precios, los ejemplos y los controles para facilitar una decisión práctica.' },
      { title: 'Cómo evaluamos los modelos', body: 'Las especificaciones de proveedores, los tiempos de producción observados y las puntuaciones editoriales de MaxVideoAI se mantienen separados y vinculados a su metodología.' },
    ],
    independence: { title: 'Nuestra relación comercial', body: 'MaxVideoAI comercializa el acceso a los modelos que presenta. Declaramos esa relación y separamos los datos con fuente, las métricas de producción observadas y el criterio editorial.' },
    links: { standards: 'Leer estándares editoriales', benchmarks: 'Abrir Benchmark Lab', company: 'Empresa y confianza', legal: 'Centro legal' },
  },
};
```

- [ ] **Step 4: Build focused schema helpers and the About view**

Implement schema builders returning only `WebPage` and `BreadcrumbList`:

```ts
import type { AboutCopy } from './about-copy';

export function buildAboutWebPageJsonLd({ canonicalUrl, copy, inLanguage }: { canonicalUrl: string; copy: AboutCopy; inLanguage: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: copy.meta.title,
    description: copy.meta.description,
    url: canonicalUrl,
    inLanguage,
    publisher: { '@type': 'Organization', name: 'MaxVideoAI', url: 'https://maxvideoai.com' },
  };
}

export function buildAboutBreadcrumbJsonLd({ canonicalUrl, copy }: { canonicalUrl: string; copy: AboutCopy }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ '@type': 'ListItem', position: 1, name: copy.hero.eyebrow, item: canonicalUrl }],
  };
}
```

Implement `AboutView` as a Server Component with this complete structure:

```tsx
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import type { ResolvedEditorialProfile } from '@/lib/editorial/profile';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import type { AboutCopy } from '../_lib/about-copy';

export function AboutView({ copy, locale, profile }: { copy: AboutCopy; locale: AppLocale; profile: ResolvedEditorialProfile }) {
  const links = [
    { href: { pathname: '/editorial-standards' }, label: copy.links.standards },
    { href: { pathname: '/benchmarks' }, label: copy.links.benchmarks },
    { href: { pathname: '/company' }, label: copy.links.company },
    { href: localizePathFromEnglish(locale, '/legal'), label: copy.links.legal },
  ];
  return (
    <main className="container-page max-w-6xl space-y-12 py-14 sm:space-y-16 sm:py-20">
      <header className="max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">{copy.hero.eyebrow}</p>
        <h1 className="mt-5 font-display text-4xl font-semibold tracking-[-0.04em] text-text-primary sm:text-6xl">{copy.hero.title}</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-text-secondary">{copy.hero.subtitle}</p>
      </header>
      <section id="adrien-millot" className="scroll-mt-[calc(var(--header-height)+32px)] rounded-[28px] border border-brand/20 bg-accent-subtle/35 p-6 shadow-card sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">{copy.identity.label}</p>
        <div className="mt-4 grid gap-5 md:grid-cols-[1fr_2fr]">
          <div><h2 className="text-2xl font-semibold text-text-primary">{profile.name}</h2><p className="mt-2 text-sm text-text-secondary">{profile.jobTitle} · {profile.location}</p></div>
          <p className="text-base leading-7 text-text-secondary">{copy.identity.body}</p>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">{copy.sections.map((section) => <article key={section.title} className="rounded-[24px] border border-hairline bg-surface/75 p-6"><h2 className="text-xl font-semibold text-text-primary">{section.title}</h2><p className="mt-3 text-sm leading-7 text-text-secondary">{section.body}</p></article>)}</section>
      <section className="rounded-[24px] border border-hairline bg-surface/75 p-6 sm:p-8"><h2 className="text-xl font-semibold text-text-primary">{copy.independence.title}</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-text-secondary">{copy.independence.body}</p></section>
      <nav aria-label={copy.hero.eyebrow} className="flex flex-wrap gap-3">{links.map((item) => <Link key={item.label} href={item.href} className="rounded-full border border-hairline bg-surface px-4 py-2 text-sm font-semibold text-text-primary hover:border-brand/35 hover:text-brand">{item.label}</Link>)}</nav>
    </main>
  );
}
```

The route orchestrator must resolve `copy`, `profile`, canonical URL, and both schemas, then render:

```tsx
<>
  <JsonLd json={buildAboutWebPageJsonLd({ canonicalUrl, copy, inLanguage: localeRegions[locale] })} />
  <JsonLd json={buildAboutBreadcrumbJsonLd({ canonicalUrl, copy })} />
  <AboutView copy={copy} locale={locale} profile={getEditorialProfile(locale)} />
</>
```

- [ ] **Step 5: Run focused About, metadata, and type checks**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/about-editorial-trust.test.ts tests/marketing-jsonld-schema-audit.test.ts && pnpm --prefix frontend exec tsc --noEmit --pretty false`

Expected: all focused tests PASS and TypeScript exits 0.

- [ ] **Step 6: Commit the About redesign**

```bash
git add 'frontend/app/(localized)/[locale]/(marketing)/about' tests/about-editorial-trust.test.ts
git commit -m "feat: establish human trust on About"
```

### Task 3: Publish The Localized Editorial Standards Route

**Files:**
- Create: `frontend/app/(localized)/[locale]/(marketing)/editorial-standards/_lib/editorial-standards-copy.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/editorial-standards/_lib/editorial-standards-schema.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/editorial-standards/_components/EditorialStandardsView.tsx`
- Create: `frontend/app/(localized)/[locale]/(marketing)/editorial-standards/page.tsx`
- Create: `frontend/app/editorial-standards/page.tsx`
- Modify: `frontend/config/localized-slugs.json`
- Modify: `frontend/i18n/routing.ts`
- Modify: `frontend/lib/seo/hreflang.ts`
- Modify: `frontend/next-sitemap.config.js`
- Create: `tests/editorial-standards-route.test.ts`

**Interfaces:**
- Consumes: editorial profile from Task 1, marketing routing and SEO helpers.
- Produces: `getEditorialStandardsCopy(locale)`, the `/editorial-standards` route family, and stable trust links used by blog, benchmark, and Company tasks.

- [ ] **Step 1: Write the failing route and localization test**

```ts
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { generateMetadata } from '../frontend/app/(localized)/[locale]/(marketing)/editorial-standards/page';
import { getEditorialStandardsCopy } from '../frontend/app/(localized)/[locale]/(marketing)/editorial-standards/_lib/editorial-standards-copy';
import { routing } from '../frontend/i18n/routing';

test('Editorial Standards publishes complete localized policy content', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = getEditorialStandardsCopy(locale);
    assert.equal(copy.sections.length, 6);
    assert.match(copy.sections.map((section) => section.id).join(','), /authorship.*sources.*process.*corrections.*benchmarks.*disclosure/);
    assert.match(copy.sections.at(-1)?.body ?? '', /sells|commercialise|comercializa/i);
  }
});

test('Editorial Standards routing owns approved localized slugs', () => {
  assert.deepEqual(routing.pathnames['/editorial-standards'], {
    en: '/editorial-standards',
    fr: '/normes-editoriales',
    es: '/estandares-editoriales',
  });
  assert.ok(existsSync('frontend/app/editorial-standards/page.tsx'));
  assert.match(readFileSync('frontend/next-sitemap.config.js', 'utf8'), /['"]\/editorial-standards['"]/);
});

test('Editorial Standards metadata is reciprocal in every locale', async () => {
  const cases = [
    ['en', 'https://maxvideoai.com/editorial-standards'],
    ['fr', 'https://maxvideoai.com/fr/normes-editoriales'],
    ['es', 'https://maxvideoai.com/es/estandares-editoriales'],
  ] as const;
  for (const [locale, canonical] of cases) {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale }) });
    assert.equal(metadata.alternates?.canonical, canonical);
    assert.equal(metadata.openGraph?.locale, locale === 'en' ? 'en_US' : locale === 'fr' ? 'fr_FR' : 'es_419');
  }
});
```

- [ ] **Step 2: Run the route test and confirm the missing-route failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/editorial-standards-route.test.ts`

Expected: FAIL because the route and copy modules do not exist.

- [ ] **Step 3: Add the route to every localization and sitemap owner**

Add these exact mappings:

```json
"editorialStandards": {
  "en": "editorial-standards",
  "fr": "normes-editoriales",
  "es": "estandares-editoriales"
}
```

```ts
'/editorial-standards': {
  en: '/editorial-standards',
  fr: '/normes-editoriales',
  es: '/estandares-editoriales',
},
```

Add `editorialStandards: '/editorial-standards'` to `HREFLANG_GROUP_PATHS` and `'/editorial-standards'` to `MARKETING_CORE_PATHS`.

- [ ] **Step 4: Implement complete policy copy and Server Component presentation**

Use this common section contract in all locales:

```ts
type EditorialStandardsSectionId =
  | 'authorship'
  | 'sources'
  | 'process'
  | 'corrections'
  | 'benchmarks'
  | 'disclosure';

export type EditorialStandardsCopy = {
  meta: { title: string; description: string };
  hero: { eyebrow: string; title: string; intro: string; reviewedLabel: string; reviewedDate: '2026-07-12' };
  sections: Array<{ id: EditorialStandardsSectionId; title: string; body: string; bullets?: string[] }>;
  links: { about: string; benchmarks: string; contact: string };
};
```

English section meaning must be exactly:

```ts
[
  { id: 'authorship', title: 'Authorship and accountability', body: 'Adrien Millot, Founder & Product Lead, is the primary author and editorial lead for MaxVideoAI. If another contributor authors or materially reviews a page, that person will be identified on the page.' },
  { id: 'sources', title: 'How we label sources', body: 'We keep provider documentation, MaxVideoAI product configuration, anonymized observed production metrics, and MaxVideoAI editorial judgment distinct.', bullets: ['Provider specifications link to the provider or product source.', 'Observed timing describes rolling production behavior, not a controlled experiment.', 'Editorial scores are MaxVideoAI judgments under the published methodology.'] },
  { id: 'process', title: 'Before publication', body: 'Material product claims are checked against current routes, source links, visible pricing behavior, and supported controls before publication or a substantial update.' },
  { id: 'corrections', title: 'Corrections', body: 'Send factual corrections to support@maxvideoai.com with the page URL and supporting source. Material corrections update the page and its modified date; they do not rewrite the original publication date.' },
  { id: 'benchmarks', title: 'Benchmark updates', body: 'Benchmark definitions, formulas, prompt protocols, observed latency rules, and methodology changes are versioned in Benchmark Lab. Historical editorial scores are not relabeled as documented prompt-pack runs.' },
  { id: 'disclosure', title: 'Commercial-interest disclosure', body: 'MaxVideoAI sells access to the models it compares. We disclose that commercial relationship and separate sourced facts, observed production metrics, and editorial judgment.' },
]
```

Translate the same meaning idiomatically into French and Latin American Spanish. Render a calm hero, a six-card editorial grid, a correction contact panel, and links to About, Benchmark Lab, and Contact. Emit only `WebPage` and `BreadcrumbList` JSON-LD.

Use this complete component contract and structure:

```tsx
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import type { ResolvedEditorialProfile } from '@/lib/editorial/profile';
import type { EditorialStandardsCopy } from '../_lib/editorial-standards-copy';

export function EditorialStandardsView({ copy, locale, profile }: { copy: EditorialStandardsCopy; locale: AppLocale; profile: ResolvedEditorialProfile }) {
  return (
    <main className="container-page max-w-6xl space-y-12 py-14 sm:space-y-16 sm:py-20">
      <header className="max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">{copy.hero.eyebrow}</p>
        <h1 className="mt-5 font-display text-4xl font-semibold tracking-[-0.04em] text-text-primary sm:text-6xl">{copy.hero.title}</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-text-secondary">{copy.hero.intro}</p>
        <p className="mt-5 text-sm text-text-muted">{copy.hero.reviewedLabel} <time dateTime={copy.hero.reviewedDate}>{copy.hero.reviewedDate}</time> · <Link href={profile.aboutHref} className="font-semibold text-text-primary hover:text-brand">{profile.name}</Link></p>
      </header>
      <section className="grid gap-4 md:grid-cols-2">{copy.sections.map((section) => <article id={section.id} key={section.id} className="scroll-mt-[calc(var(--header-height)+32px)] rounded-[24px] border border-hairline bg-surface/75 p-6"><h2 className="text-xl font-semibold text-text-primary">{section.title}</h2><p className="mt-3 text-sm leading-7 text-text-secondary">{section.body}</p>{section.bullets?.length ? <ul className="mt-4 space-y-2">{section.bullets.map((bullet) => <li key={bullet} className="text-sm leading-6 text-text-secondary">• {bullet}</li>)}</ul> : null}</article>)}</section>
      <nav aria-label={copy.hero.eyebrow} className="flex flex-wrap gap-3"><Link href={profile.aboutHref} className="rounded-full border border-hairline px-4 py-2 text-sm font-semibold">{copy.links.about}</Link><Link href={{ pathname: '/benchmarks' }} className="rounded-full border border-hairline px-4 py-2 text-sm font-semibold">{copy.links.benchmarks}</Link><Link href={{ pathname: '/contact' }} className="rounded-full border border-hairline px-4 py-2 text-sm font-semibold">{copy.links.contact}</Link></nav>
    </main>
  );
}
```

The schema builders mirror the About helpers but use the Editorial Standards title and URL. The localized route must be exactly:

```tsx
export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }): Promise<Metadata> {
  const { locale } = await params;
  const copy = getEditorialStandardsCopy(locale);
  return buildSeoMetadata({ locale, hreflangGroup: 'editorialStandards', title: copy.meta.title, description: copy.meta.description, imageAlt: copy.hero.title });
}

export default async function EditorialStandardsPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const copy = getEditorialStandardsCopy(locale);
  const profile = getEditorialProfile(locale);
  const canonicalUrl = buildMetadataUrls(locale, undefined, { englishPath: '/editorial-standards' }).canonical;
  return <><JsonLd json={buildEditorialStandardsWebPageJsonLd({ canonicalUrl, copy, inLanguage: localeRegions[locale] })} /><JsonLd json={buildEditorialStandardsBreadcrumbJsonLd({ canonicalUrl, copy })} /><EditorialStandardsView copy={copy} locale={locale} profile={profile} /></>;
}
```

- [ ] **Step 5: Add the default English wrapper**

```tsx
import EditorialStandardsPage, {
  generateMetadata as generateLocalizedMetadata,
} from '../(localized)/[locale]/(marketing)/editorial-standards/page';
import DefaultMarketingLayout from '../default-marketing-layout';
import { DEFAULT_LOCALE } from '../default-locale-wrapper';

export const generateMetadata = () =>
  generateLocalizedMetadata({ params: Promise.resolve({ locale: DEFAULT_LOCALE }) });

export default function EditorialStandardsDefaultPage() {
  return (
    <DefaultMarketingLayout>
      <EditorialStandardsPage params={Promise.resolve({ locale: DEFAULT_LOCALE })} />
    </DefaultMarketingLayout>
  );
}
```

- [ ] **Step 6: Run focused route, sitemap, i18n, and schema checks**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/editorial-standards-route.test.ts tests/marketing-jsonld-schema-audit.test.ts && pnpm --prefix frontend run i18n:check`

Expected: all tests PASS and the i18n key validator exits 0.

- [ ] **Step 7: Commit the Editorial Standards route**

```bash
git add 'frontend/app/(localized)/[locale]/(marketing)/editorial-standards' frontend/app/editorial-standards frontend/config/localized-slugs.json frontend/i18n/routing.ts frontend/lib/seo/hreflang.ts frontend/next-sitemap.config.js tests/editorial-standards-route.test.ts
git commit -m "feat: publish editorial standards"
```

### Task 4: Add Visible And Structured Blog Authorship

**Files:**
- Modify: `frontend/lib/content/markdown.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/blog/[slug]/_lib/blog-editorial-copy.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/blog/[slug]/_components/blog-author-byline.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/blog/[slug]/page.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/blog/[slug]/_components/blog-post-view.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/blog/[slug]/_lib/blog-post-seo.ts`
- Modify: `tests/blog-post-route-architecture.test.ts`
- Modify: `tests/marketing-jsonld-schema-audit.test.ts`

**Interfaces:**
- Consumes: `getEditorialProfile(locale, post.authorId)`, `ResolvedEditorialProfile`, and localized Editorial Standards route from Task 3.
- Produces: `getBlogEditorialCopy(locale)`, `BlogAuthorByline`, visible dates, and Article `Person` authorship.

- [ ] **Step 1: Extend the failing blog architecture and schema tests**

Add assertions equivalent to:

```ts
assert.ok(existsSync(authorBylinePath));
assert.match(pageSource, /getEditorialProfile/);
assert.match(pageSource, /getBlogEditorialCopy/);
assert.match(viewSource, /BlogAuthorByline/);
assert.match(authorBylineSource, /Founder & Product Lead/);
assert.match(authorBylineSource, /editorial-standards/);
```

Update the Article schema test case to assert:

```ts
assert.deepEqual(articleSchema.author, {
  '@type': 'Person',
  name: 'Adrien Millot',
  jobTitle: 'Founder & Product Lead',
  url: 'https://maxvideoai.com/about#adrien-millot',
});
assert.equal(articleSchema.publisher['@type'], 'Organization');
```

Add `Person` to `KNOWN_SCHEMA_TYPES` in `tests/marketing-jsonld-schema-audit.test.ts` because the nested author is now intentionally a person.

- [ ] **Step 2: Run the focused blog tests and confirm they fail on organization authorship**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/blog-post-route-architecture.test.ts tests/marketing-jsonld-schema-audit.test.ts`

Expected: FAIL because `BlogAuthorByline` is missing and Article author is still `Organization`.

- [ ] **Step 3: Add the optional author id and localized editorial labels**

Add `authorId?: string` to `ContentFrontMatter`. Create:

```ts
export type BlogEditorialCopy = {
  by: string;
  published: string;
  updated: string;
  aboutAuthor: string;
  standards: string;
};

const COPY: Record<AppLocale, BlogEditorialCopy> = {
  en: { by: 'By', published: 'Published', updated: 'Updated', aboutAuthor: 'About the author', standards: 'Editorial Standards' },
  fr: { by: 'Par', published: 'Publié le', updated: 'Mis à jour le', aboutAuthor: 'À propos de l’auteur', standards: 'Normes éditoriales' },
  es: { by: 'Por', published: 'Publicado', updated: 'Actualizado', aboutAuthor: 'Acerca del autor', standards: 'Estándares editoriales' },
};
```

- [ ] **Step 4: Implement one reusable visible byline component**

`BlogAuthorByline` receives `copy`, `profile`, `publishedLabel`, and optional `modifiedLabel`. It renders:

```tsx
<div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-text-secondary">
  <span>{copy.by} <Link href={profile.aboutHref} className="font-semibold text-text-primary hover:text-brand">{profile.name}</Link></span>
  <span aria-hidden="true">·</span>
  <span>{profile.jobTitle}</span>
  <span aria-hidden="true">·</span>
  <span>{copy.published} {publishedLabel}</span>
  {modifiedLabel ? <><span aria-hidden="true">·</span><span>{copy.updated} {modifiedLabel}</span></> : null}
</div>
```

The same file exports an author-card component containing the localized bio, About link, and `localizePathFromEnglish(locale, '/editorial-standards')` link. Place the compact byline in the article header and the author card after the article body.

- [ ] **Step 5: Resolve profile and true dates in the route**

In `BlogPostPage`, add:

```ts
const editorialProfile = getEditorialProfile(locale, post.authorId);
const editorialCopy = getBlogEditorialCopy(locale);
const publishedLabel = formatBlogPostDate(locale, post.date);
const modifiedLabel = post.updatedAt && post.updatedAt !== post.date
  ? formatBlogPostDate(locale, post.updatedAt)
  : null;
```

Pass these values into both JSON-LD and `BlogPostView`. Do not generate a current date.

- [ ] **Step 6: Replace organization author JSON-LD with the verified person**

Extend `buildBlogPostJsonLd` with `editorialProfile: ResolvedEditorialProfile` and emit:

```ts
author: {
  '@type': 'Person',
  name: editorialProfile.name,
  jobTitle: editorialProfile.jobTitle,
  url: getEditorialProfileAbsoluteUrl(editorialProfile),
},
```

Keep the MaxVideoAI publisher object unchanged.

- [ ] **Step 7: Run focused blog tests, type-check, and one content parse**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/blog-post-route-architecture.test.ts tests/marketing-jsonld-schema-audit.test.ts && pnpm --prefix frontend exec tsc --noEmit --pretty false`

Expected: all tests PASS and TypeScript exits 0.

- [ ] **Step 8: Commit blog authorship**

```bash
git add frontend/lib/content/markdown.ts 'frontend/app/(localized)/[locale]/(marketing)/blog/[slug]' tests/blog-post-route-architecture.test.ts tests/marketing-jsonld-schema-audit.test.ts
git commit -m "feat: add verified blog authorship"
```

### Task 5: Name The Benchmark Lab Editorial Owner

**Files:**
- Create: `frontend/app/(localized)/[locale]/(marketing)/benchmarks/_components/BenchmarkEditorialOwnership.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-copy.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/benchmarks/_lib/benchmark-schema.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/benchmarks/_components/BenchmarkLabView.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/benchmarks/page.tsx`
- Modify: `tests/benchmark-lab-route.test.ts`

**Interfaces:**
- Consumes: profile from Task 1, Editorial Standards route from Task 3, and existing benchmark methodology version/effective date.
- Produces: `BenchmarkEditorialOwnership` and WebPage Person author data without touching scores or observed metrics.

- [ ] **Step 1: Write failing ownership and schema assertions**

Add to `tests/benchmark-lab-route.test.ts`:

```ts
test('benchmark lab names its real editorial owner without independent-review claims', () => {
  const source = readFileSync(path.join(routeRoot, '_components/BenchmarkEditorialOwnership.tsx'), 'utf8');
  assert.match(source, /Adrien Millot|profile\.name/);
  assert.match(source, /editorial-standards/);
  assert.doesNotMatch(source, /independently reviewed|certified|laboratory/i);
});
```

Update the schema expectation to include:

```ts
assert.deepEqual(webPage.author, {
  '@type': 'Person',
  name: 'Adrien Millot',
  jobTitle: 'Founder & Product Lead',
  url: 'https://maxvideoai.com/about#adrien-millot',
});
```

- [ ] **Step 2: Run the benchmark test and confirm the missing-component failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/benchmark-lab-route.test.ts`

Expected: FAIL because the ownership component and WebPage author do not exist.

- [ ] **Step 3: Add localized ownership copy**

Extend `BenchmarkCopy` with:

```ts
ownership: {
  label: string;
  methodologyVersion: string;
  effective: string;
  about: string;
  standards: string;
};
```

Use:

```ts
en: { label: 'Editorial lead', methodologyVersion: 'Methodology', effective: 'Effective', about: 'About the editor', standards: 'Editorial Standards' }
fr: { label: 'Responsable éditorial', methodologyVersion: 'Méthodologie', effective: 'Applicable le', about: 'À propos du responsable', standards: 'Normes éditoriales' }
es: { label: 'Responsable editorial', methodologyVersion: 'Metodología', effective: 'Vigente desde', about: 'Acerca del responsable', standards: 'Estándares editoriales' }
```

- [ ] **Step 4: Implement the compact ownership component and wire it near the hero**

The component receives `copy`, `locale`, `methodology`, and `profile`, formats `effectiveDate` with `localeRegions`, and renders the owner, role, `v{version}`, effective date, About link, and Editorial Standards link. Use this implementation and place it below the hero proof and above the sticky navigation:

```tsx
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { localeRegions } from '@/i18n/locales';
import type { ResolvedEditorialProfile } from '@/lib/editorial/profile';
import type { BenchmarkCopy } from '../_lib/benchmark-copy';
import type { BenchmarkPageData } from '../_lib/benchmark-page-data';

export function BenchmarkEditorialOwnership({ copy, locale, methodology, profile }: { copy: BenchmarkCopy; locale: AppLocale; methodology: BenchmarkPageData['methodology']; profile: ResolvedEditorialProfile }) {
  const effective = new Intl.DateTimeFormat(localeRegions[locale], { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(methodology.effectiveDate));
  return (
    <div className="mx-auto mt-8 flex max-w-4xl flex-wrap items-center justify-center gap-x-3 gap-y-2 border-t border-hairline pt-5 text-sm text-text-secondary">
      <span>{copy.ownership.label}: <Link href={profile.aboutHref} className="font-semibold text-text-primary hover:text-brand">{profile.name}</Link></span>
      <span aria-hidden="true">·</span><span>{profile.jobTitle}</span>
      <span aria-hidden="true">·</span><span>{copy.ownership.methodologyVersion} v{methodology.version}</span>
      <span aria-hidden="true">·</span><time dateTime={methodology.effectiveDate}>{copy.ownership.effective} {effective}</time>
      <span aria-hidden="true">·</span><Link href={{ pathname: '/editorial-standards' }} className="font-semibold text-brand hover:text-brandHover">{copy.ownership.standards}</Link>
    </div>
  );
}
```

Do not add counts or a reviewer field.

- [ ] **Step 5: Add Person authorship to Benchmark WebPage JSON-LD**

Extend `buildBenchmarkWebPageJsonLd` with `editorialProfile: ResolvedEditorialProfile` and emit:

```ts
author: {
  '@type': 'Person',
  name: editorialProfile.name,
  jobTitle: editorialProfile.jobTitle,
  url: getEditorialProfileAbsoluteUrl(editorialProfile),
},
publisher: {
  '@type': 'Organization',
  name: 'MaxVideoAI',
  url: 'https://maxvideoai.com',
},
```

Resolve `const editorialProfile = getEditorialProfile(locale)` once in the route and pass it to both `buildBenchmarkWebPageJsonLd()` and `BenchmarkLabView`. Extend `BenchmarkLabViewProps` with `editorialProfile: ResolvedEditorialProfile` and pass the profile plus `data.methodology` into `BenchmarkEditorialOwnership`.

- [ ] **Step 6: Run benchmark, schema, and type checks**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/benchmark-lab-route.test.ts tests/marketing-jsonld-schema-audit.test.ts && pnpm --prefix frontend exec tsc --noEmit --pretty false`

Expected: all tests PASS and no benchmark score, specification, latency, or methodology fixture changes.

- [ ] **Step 7: Commit benchmark ownership**

```bash
git add 'frontend/app/(localized)/[locale]/(marketing)/benchmarks' tests/benchmark-lab-route.test.ts tests/marketing-jsonld-schema-audit.test.ts
git commit -m "feat: name benchmark editorial owner"
```

### Task 6: Turn Company Into The Compact Trust Hub

**Files:**
- Create: `frontend/app/(localized)/[locale]/(marketing)/company/_lib/company-copy.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/company/_components/CompanyTrustView.tsx`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/company/page.tsx`
- Create: `tests/company-content-rights.test.ts`

**Interfaces:**
- Consumes: localized About, Editorial Standards, Benchmark, Terms, Privacy, and sub-processor paths.
- Produces: a grouped Company trust index and localized rights summary; Task 7 makes the Terms deep link authoritative.

- [ ] **Step 1: Write the failing Company content-rights test**

```ts
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { getCompanyCopy } from '../frontend/app/(localized)/[locale]/(marketing)/company/_lib/company-copy';

test('Company exposes the complete trust graph in every locale', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = getCompanyCopy(locale);
    const hrefs = copy.resources.flatMap((group) => group.links.map((link) => link.href));
    for (const href of ['/about', '/editorial-standards', '/benchmarks', '/legal/terms', '/legal/privacy', '/legal/subprocessors']) {
      assert.ok(hrefs.includes(href), `${locale} should include ${href}`);
    }
    assert.match(copy.rights.commercialUse, /commercial|commercialement|comercialmente/i);
    assert.match(copy.rights.privacy, /private|privés|privados/i);
  }
});

test('Company route delegates visual ownership to a focused view', () => {
  const page = readFileSync('frontend/app/(localized)/[locale]/(marketing)/company/page.tsx', 'utf8');
  assert.ok(existsSync('frontend/app/(localized)/[locale]/(marketing)/company/_components/CompanyTrustView.tsx'));
  assert.match(page, /CompanyTrustView/);
  assert.doesNotMatch(page, /copy\.links\.map/);
  assert.ok(page.split('\n').length <= 100);
});
```

- [ ] **Step 2: Run the Company test and confirm the missing-module failure**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/company-content-rights.test.ts`

Expected: FAIL because the copy and view modules do not exist.

- [ ] **Step 3: Implement grouped trust copy in all three locales**

Use this contract:

```ts
export type CompanyCopy = {
  meta: { title: string; description: string };
  hero: { eyebrow: string; title: string; intro: string };
  resources: Array<{ title: string; links: Array<{ href: string; label: string; description: string }> }>;
  rights: { eyebrow: string; title: string; uploads: string; outputs: string; commercialUse: string; privacy: string; legalCta: string; privacyCta: string };
};
```

The exact substantive rights strings are:

```ts
en: {
  uploads: 'Your uploaded prompts and assets remain yours under the Terms.',
  outputs: 'Generated media remains yours, subject to the Terms.',
  commercialUse: 'Users may use their generations commercially, subject to third-party rights, applicable laws, and any restrictions specific to the model or provider used.',
  privacy: 'New renders are private by default. Provider processing and sub-processors are explained in our privacy resources.',
}
fr: {
  uploads: 'Vos prompts et assets importés restent les vôtres conformément aux Conditions.',
  outputs: 'Les médias générés restent les vôtres, sous réserve des Conditions.',
  commercialUse: 'Les utilisateurs peuvent utiliser commercialement leurs générations, sous réserve des droits de tiers, des lois applicables et des éventuelles restrictions propres au modèle ou fournisseur utilisé.',
  privacy: 'Les nouveaux rendus sont privés par défaut. Le traitement par les fournisseurs et les sous-traitants est expliqué dans nos ressources de confidentialité.',
}
es: {
  uploads: 'Los prompts y recursos que subes siguen siendo tuyos conforme a los Términos.',
  outputs: 'Los medios generados siguen siendo tuyos, sujetos a los Términos.',
  commercialUse: 'Los usuarios pueden usar comercialmente sus generaciones, siempre que respeten los derechos de terceros, las leyes aplicables y cualquier restricción específica del modelo o proveedor utilizado.',
  privacy: 'Los nuevos renders son privados de forma predeterminada. El procesamiento de proveedores y los subencargados se explican en nuestros recursos de privacidad.',
}
```

Populate the three resource groups with these canonical paths before localization:

```ts
[
  { title: peopleAndEditorialTitle, links: ['/about', '/editorial-standards', '/benchmarks'] },
  { title: productOperationsTitle, links: ['/docs', '/workflows', '/status', '/changelog', '/contact'] },
  { title: legalAndDataTitle, links: ['/legal', '/legal/terms', '/legal/privacy', '/legal/subprocessors', '/return-policy'] },
]
```

Each link object also has a localized `label` and one-sentence `description`. Preserve all existing Company destinations while adding Editorial Standards, Benchmark Lab, Privacy, and sub-processors.

- [ ] **Step 4: Implement the grouped Server Component view**

Render three resource groups — `People & editorial`, `Product operations`, and `Legal & data` with localized titles — followed by one positive rights panel. Store English canonical paths in copy and localize them at render time with this implementation:

```tsx
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/locales';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import type { CompanyCopy } from '../_lib/company-copy';

export function CompanyTrustView({ copy, locale }: { copy: CompanyCopy; locale: AppLocale }) {
  const href = (path: string) => path === '/return-policy' ? path : localizePathFromEnglish(locale, path);
  return (
    <main className="container-page max-w-6xl space-y-12 py-14 sm:space-y-16 sm:py-20">
      <header className="max-w-4xl"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">{copy.hero.eyebrow}</p><h1 className="mt-5 font-display text-4xl font-semibold tracking-[-0.04em] text-text-primary sm:text-6xl">{copy.hero.title}</h1><p className="mt-6 text-lg leading-8 text-text-secondary">{copy.hero.intro}</p></header>
      <section className="grid gap-4 lg:grid-cols-3">{copy.resources.map((group) => <article key={group.title} className="rounded-[24px] border border-hairline bg-surface/75 p-6"><h2 className="text-lg font-semibold text-text-primary">{group.title}</h2><ul className="mt-5 space-y-4">{group.links.map((item) => <li key={item.href}><Link href={href(item.href)} className="font-semibold text-brand hover:text-brandHover">{item.label}</Link><p className="mt-1 text-sm leading-6 text-text-secondary">{item.description}</p></li>)}</ul></article>)}</section>
      <section className="rounded-[28px] border border-brand/20 bg-accent-subtle/35 p-6 shadow-card sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">{copy.rights.eyebrow}</p><h2 className="mt-3 text-2xl font-semibold text-text-primary">{copy.rights.title}</h2><div className="mt-6 grid gap-4 md:grid-cols-2">{[copy.rights.uploads, copy.rights.outputs, copy.rights.commercialUse, copy.rights.privacy].map((body) => <p key={body} className="rounded-[18px] border border-hairline bg-surface/70 p-4 text-sm leading-7 text-text-secondary">{body}</p>)}</div><div className="mt-6 flex flex-wrap gap-3"><Link href={`${href('/legal/terms')}#generated-media-rights`} className="rounded-full border border-hairline px-4 py-2 text-sm font-semibold">{copy.rights.legalCta}</Link><Link href={href('/legal/privacy')} className="rounded-full border border-hairline px-4 py-2 text-sm font-semibold">{copy.rights.privacyCta}</Link></div></section>
    </main>
  );
}
```

Include `/legal/subprocessors` among the `Legal & data` resources.

- [ ] **Step 5: Run Company, localized path, and type checks**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/company-content-rights.test.ts && pnpm --prefix frontend exec tsc --noEmit --pretty false`

Expected: all tests PASS and the existing `/company`, `/fr/entreprise`, `/es/empresa` route contract remains unchanged.

- [ ] **Step 6: Commit the Company trust hub**

```bash
git add 'frontend/app/(localized)/[locale]/(marketing)/company' tests/company-content-rights.test.ts
git commit -m "feat: strengthen company trust hub"
```

### Task 7: Align The Terms And Legal Version Workflow

**Files:**
- Modify: `frontend/app/(core)/legal/terms/_components/TermsArticleEn.tsx`
- Modify: `frontend/app/(core)/legal/terms/_components/TermsArticleFr.tsx`
- Modify: `frontend/app/(core)/legal/terms/_components/TermsArticleEs.tsx`
- Modify: `frontend/src/lib/legal.ts`
- Modify: `frontend/app/(core)/legal/terms/page.tsx`
- Modify: `frontend/app/api/legal/consents/route.ts`
- Create: `docs/deployment/legal-document-rollout.md`
- Modify: `tests/legal-documents-architecture.test.ts`

**Interfaces:**
- Consumes: approved commercial-use meaning and existing Admin legal version/re-consent endpoints.
- Produces: `LEGAL_FALLBACK_VERSIONS`, `#generated-media-rights`, versioned Terms copy, and an exact deployment runbook.

- [ ] **Step 1: Write failing legal consistency assertions**

Add to `tests/legal-documents-architecture.test.ts`:

```ts
const legalLibSource = readFileSync(join(root, 'frontend/src/lib/legal.ts'), 'utf8');
const consentRouteSource = readFileSync(join(root, 'frontend/app/api/legal/consents/route.ts'), 'utf8');

test('commercial generation rights are explicit and deep-linkable in every Terms locale', () => {
  assert.match(termsArticleEnSource, /id="generated-media-rights"/);
  assert.match(termsArticleFrSource, /id="generated-media-rights"/);
  assert.match(termsArticleEsSource, /id="generated-media-rights"/);
  assert.match(termsArticleEnSource, /use their generations commercially/);
  assert.match(termsArticleFrSource, /utiliser commercialement leurs générations/);
  assert.match(termsArticleEsSource, /usar comercialmente sus generaciones/);
});

test('Terms fallback version has one source shared by pages and signup consent', () => {
  assert.match(legalLibSource, /LEGAL_FALLBACK_VERSIONS/);
  assert.match(termsPageSource, /LEGAL_FALLBACK_VERSIONS\.terms/);
  assert.match(consentRouteSource, /LEGAL_FALLBACK_VERSIONS/);
  assert.doesNotMatch(consentRouteSource, /versions\.terms \?\? '2025-10-26'/);
});
```

- [ ] **Step 2: Run the legal test and confirm missing clause/version failures**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/legal-documents-architecture.test.ts`

Expected: FAIL because the section id, commercial-use sentences, and shared version constant do not exist.

- [ ] **Step 3: Add the approved clause without rewriting the existing licence**

Add `id="generated-media-rights"` to section 6 in all three Terms components. Add one new first bullet before `Generated media licence`:

```tsx
<li>
  <strong>Commercial use.</strong> Users may use their generations commercially, subject to third-party rights, applicable laws, and any restrictions specific to the model or provider used.
</li>
```

```tsx
<li>
  <strong>Utilisation commerciale.</strong> Les utilisateurs peuvent utiliser commercialement leurs générations, sous réserve des droits de tiers, des lois applicables et des éventuelles restrictions propres au modèle ou fournisseur utilisé.
</li>
```

```tsx
<li>
  <strong>Uso comercial.</strong> Los usuarios pueden usar comercialmente sus generaciones, siempre que respeten los derechos de terceros, las leyes aplicables y cualquier restricción específica del modelo o proveedor utilizado.
</li>
```

Do not alter the following existing bullets in this task: generated media licence, privacy controls, uploads versus generated content, and MaxVideoAI IP.

- [ ] **Step 4: Centralize fallback versions**

Add to `frontend/src/lib/legal.ts`:

```ts
export const LEGAL_FALLBACK_VERSIONS = {
  terms: '2026-07-12',
  privacy: '2025-10-26',
  cookies: '2025-10-26',
} as const satisfies Record<LegalDocumentKey, string>;
```

Use `LEGAL_FALLBACK_VERSIONS.terms` in the Terms page. Import the same constant in the consent route and replace each hard-coded legal fallback with the matching key. Preserve the existing guard that refuses signup when required production legal documents are not configured.

- [ ] **Step 5: Write the exact Admin publication runbook**

Create `docs/deployment/legal-document-rollout.md` containing:

```md
# Legal document rollout

## Terms 2026-07-12

1. Deploy the code containing the localized Terms body.
2. Verify `/legal/terms`, `/fr/legal/terms`, and `/es/legal/terms`, including `#generated-media-rights`.
3. In Admin → Legal documents, update Terms to version `2026-07-12`, public URL `/legal/terms`, and the actual publication timestamp.
4. Confirm Admin reports `SOFT` re-consent with a 14-day grace period. Do not switch to hard mode for this release.
5. With an account that accepted the previous Terms, call `/api/legal/reconsent` and confirm `needsReconsent: true`, `mode: "soft"`, and the expected grace deadline.
6. Accept the update in the re-consent prompt and confirm the Terms mismatch disappears.
7. Verify a new signup records Terms version `2026-07-12`.

The Admin version update occurs only after the new Terms body is live. Never publish the new registry version before the matching body is deployed.
```

- [ ] **Step 6: Run legal, consent, contact, and type checks**

Run: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/legal-documents-architecture.test.ts tests/legal-reconsent-auth-scope.test.ts tests/customer-facing-legal-contact.test.ts && pnpm --prefix frontend exec tsc --noEmit --pretty false`

Expected: all tests PASS, TypeScript exits 0, and no re-consent mode/default changes.

- [ ] **Step 7: Commit the versioned Terms clarification**

```bash
git add 'frontend/app/(core)/legal/terms' frontend/src/lib/legal.ts frontend/app/api/legal/consents/route.ts docs/deployment/legal-document-rollout.md tests/legal-documents-architecture.test.ts
git commit -m "feat: clarify commercial generation rights"
```

### Task 8: Complete Trust Links, Full Verification, And Browser QA

**Files:**
- Review only: `frontend/components/marketing/MarketingFooter.tsx` must retain its existing Company & Trust link; this lot does not add a direct Editorial Standards footer link.
- Test: `tests/editorial-standards-route.test.ts`
- Test: `tests/about-editorial-trust.test.ts`
- Test: `tests/company-content-rights.test.ts`
- No production file is expected to change in this task unless a preceding task fails its own stated acceptance contract.

**Interfaces:**
- Consumes: every prior task.
- Produces: one fully linked, verified release candidate based on the latest `origin/main`.

- [ ] **Step 1: Verify every required trust path has an inbound link**

Run:

```bash
rg -n "editorial-standards|normes-editoriales|estandares-editoriales" \
  'frontend/app/(localized)/[locale]/(marketing)/about' \
  'frontend/app/(localized)/[locale]/(marketing)/company' \
  'frontend/app/(localized)/[locale]/(marketing)/blog/[slug]' \
  'frontend/app/(localized)/[locale]/(marketing)/benchmarks'
```

Expected: About, Company, blog articles, and Benchmark Lab each link to Editorial Standards, while `MarketingFooter.tsx` retains the existing `/company` link. Do not add a direct Editorial Standards footer link.

- [ ] **Step 2: Run the complete focused trust suite**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/editorial-profile.test.ts \
  tests/about-editorial-trust.test.ts \
  tests/editorial-standards-route.test.ts \
  tests/blog-post-route-architecture.test.ts \
  tests/benchmark-lab-route.test.ts \
  tests/company-content-rights.test.ts \
  tests/legal-documents-architecture.test.ts \
  tests/legal-reconsent-auth-scope.test.ts \
  tests/marketing-jsonld-schema-audit.test.ts
```

Expected: every focused test passes with zero failures.

- [ ] **Step 3: Run repository-wide static and architecture validation**

Run:

```bash
pnpm --prefix frontend run lint
pnpm run lint:exposure
pnpm --prefix frontend run i18n:check
pnpm --prefix frontend run seo:check
pnpm run architecture:audit -- --min-lines 500
git diff --check
```

Expected: all commands exit 0; architecture audit reports no new oversized owner file in the changed routes.

- [ ] **Step 4: Run the complete automated validation suite**

Run: `pnpm test:validate`

Expected: all tests pass. Restore only the two known generated comparison matrix artifacts if this command rewrites them:

```bash
git restore -- docs/seo/comparison-indexation-matrix-2026-07-08.json docs/seo/comparison-indexation-matrix-2026-07-08.md
```

- [ ] **Step 5: Build the production frontend**

Run: `rm -rf frontend/.next && pnpm --prefix frontend run build`

Expected: Next.js production build and postbuild sitemap generation complete successfully; the route list contains the English default and localized Editorial Standards route.

- [ ] **Step 6: Run local browser smoke tests**

Start the app:

```bash
pnpm --prefix frontend run dev
```

Verify at desktop and mobile widths:

- `/about`, `/fr/a-propos`, `/es/acerca-de` identify Adrien and render the commercial relationship panel;
- `/editorial-standards`, `/fr/normes-editoriales`, `/es/estandares-editoriales` render all six standards sections;
- one English, French, and Spanish blog article shows author, role, publication date, and true modification date where present;
- `/benchmarks`, `/fr/benchmarks`, `/es/benchmarks` show editorial lead, methodology version, and effective date without counts or independent-review wording;
- `/company`, `/fr/entreprise`, `/es/empresa` show the rights panel and correct legal/privacy links;
- `/legal/terms#generated-media-rights`, `/fr/legal/terms#generated-media-rights`, and `/es/legal/terms#generated-media-rights` land on the approved clause;
- page source contains locale-correct canonical, reciprocal hreflang, and Person Article authorship;
- keyboard focus is visible and no horizontal overflow appears in either color scheme.

Expected: every route and link behaves as specified with no hydration warning or console error.

- [ ] **Step 7: Rebase onto the latest remote main and repeat risk-proportionate checks**

Run:

```bash
git fetch origin main
git rebase origin/main
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/editorial-profile.test.ts \
  tests/editorial-standards-route.test.ts \
  tests/blog-post-route-architecture.test.ts \
  tests/benchmark-lab-route.test.ts \
  tests/company-content-rights.test.ts \
  tests/legal-documents-architecture.test.ts \
  tests/marketing-jsonld-schema-audit.test.ts
git diff --check
```

Expected: clean rebase and all focused tests pass on the latest `origin/main`.

- [ ] **Step 8: Commit only genuine integration corrections**

If Step 1, build, browser QA, or rebase required corrections, commit them:

```bash
git add frontend tests docs
git commit -m "test: verify editorial trust integration"
```

If no files changed, do not create an empty commit.

- [ ] **Step 9: Record the production legal handoff without mutating production**

In the final handoff, state that Admin → Legal documents must publish Terms version `2026-07-12` only after deployment and that this intentionally starts the existing 14-day soft re-consent window. Do not update production Admin, deploy, merge, or push unless the user separately authorizes that action.

---

## Self-Review Checklist

- Every spec surface is owned by a task: profile (1), About (2), Editorial Standards and route graph (3), blog (4), benchmarks (5), Company (6), Terms/re-consent (7), integration and browser QA (8).
- The plan creates one substantive Editorial Standards route, not three policy routes.
- The profile name, role, location, and French commercial-use sentence match the approved spec exactly.
- Article `author.name` contains only `Adrien Millot`; `jobTitle` owns the role; publisher remains MaxVideoAI.
- No task changes benchmark data, pricing, refunds, wallet behavior, model routing, or comparison routing.
- No task adds generation counts, customer counts, fake reviewers, portraits, qualifications, or certifications.
- Terms version publication is ordered after deployment and uses the existing soft re-consent workflow.
- Every new route owns canonical, hreflang, sitemap, default wrapper, and schema tests.
- All function and type names consumed by later tasks are produced by earlier tasks.
- The plan contains no deferred implementation placeholders.
