# Site Console Audit - 2026-05-09

## Contexte

- Branche: `codex/site-console-audit`
- URL locale testee: `http://localhost:3001`
- Dev server: `npm --prefix frontend run dev -- --port 3001`
- Audit initial: 93 routes/pages environ
- Sweep post-corrections: 82 routes/pages
- Perimetre: marketing public, i18n, blog, models, comparatif/best-for, examples, pricing, legal, login/callback, workspace, outils app, library, billing, settings, dashboard/jobs, admin non authentifie.

## Routes et groupes audites

- Home: `/`, `/fr`, `/es`
- Models: catalogues EN/FR/ES, Seedance 2.0 EN/FR/ES, Sora 2, Veo 3.1, Nano Banana, Kling 3 Pro EN/FR/ES
- Compare/best-for: hubs EN/FR/ES, `sora-2-vs-veo-3-1` EN/FR/ES, `best-for/cinematic-realism` EN/FR/ES
- Blog: hubs EN/FR/ES, article compare EN/FR/ES, anciens slugs FR accentues, article angle EN/FR/ES
- Pricing: `/pricing`, `/fr/tarifs`, `/es/precios`
- Examples: hubs EN/FR/ES, `seedance` EN/FR/ES, `kling`
- Tools publics: hubs EN/FR/ES, Angle EN/FR/ES, Character Builder, Upscale
- Legal/content: legal hub, privacy EN/FR/ES, terms, cookies redirect, mentions, about EN/FR/ES, status, contact, docs, get-started, workflows
- App/auth: `/login`, `/auth/callback`, `/app`, `/app/tools/angle`, `/app/image`, `/app/library`, `/billing`, `/settings`, `/dashboard`, `/jobs`
- Admin: `/admin`, `/admin/home`, `/admin/jobs` sans session admin

## Problemes trouves et corrections appliquees

### 1. Liens marketing racine hydrates avec la mauvaise locale

- Symptome: sur `/`, avec cookie locale FR/ES, les liens du hero anglais pouvaient hydrater vers `/fr/galerie` ou `/es/galeria`.
- Cause: `frontend/i18n/request.ts` utilisait le cookie `mvid_locale` comme fallback pour une route marketing non prefixee.
- Correction: resolution i18n limitee a la locale explicite, au segment de route, puis `defaultLocale`.
- Commit: `be0c9935 Fix default marketing locale link hydration`

### 2. Pages examples famille en 500

- Symptome: `/examples/seedance`, `/fr/galerie/seedance`, `/es/galeria/seedance` rendaient une 500 avec `next/image` car la source etait deja une URL `/_next/image?...`.
- Cause: la donnee hero preferait `heroPosterUrl` optimise avant l'URL brute.
- Correction: preferer `rawPosterUrl`, puis fallback optimise si necessaire.
- Commit: `94022fc4 Fix examples family hero poster source`

### 3. Article blog compare FR casse / slug canonique incoherent

- Symptome: l'article FR compare et l'ancien slug accentue retournaient 404/500 selon le chemin, avec une erreur visible de contexte i18n sur la page 404.
- Cause: le frontmatter FR et `frontend/config/blog-slugs.ts` utilisaient un slug accentue `modeles`, tandis que le fichier, les liens internes et le middleware utilisaient le slug crawlable ASCII `moteurs`. La page 404 globale utilisait aussi le Link i18n hors provider dans certains `notFound()`.
- Correction: alignement frontmatter/canonical/config sur `comment-comparer-les-moteurs-video-dia-sora-vs-veo-vs-pika`, redirects 301 depuis les formes accentuees encodees/non encodees, et 404 avec hrefs localises via `next/link`.
- Commit: `1f740b11 Fix French compare blog slug routing`

### 4. Warnings React de cles dupliquees sur `/settings`

- Symptome: `/settings` emettait des erreurs React pour les cles `EN`, `FR`, `ES`, `System`, `Light`, `Dark`.
- Cause: `deepmerge` concatene les tableaux par defaut; les options fallback et localisees etaient doublees.
- Correction: appliquer `arrayMerge: (_destination, source) => source` comme dans Billing.
- Commit: `09c8965c Fix settings option merge warnings`

## Problemes non corriges ou classes attendus

- `/billing`: avertissement Stripe attendu en HTTP local: `You may test your Stripe.js integration over HTTP...`; pas une erreur produit locale.
- `/admin`, `/admin/home`, `/admin/jobs`: 401 attendus sans session admin locale.
- Dev server: un log serveur catché `[examples] failed to load playlist "examples"` avec `getaddrinfo ENOTFOUND ...neon.tech` est apparu pendant le sweep. La page concernée est restee en 200 avec fallback; classe comme dependance Neon locale non joignable, pas comme regression frontend.
- Videos/media: quelques `net::ERR_ABORTED` observes pendant le premier audit sur des medias autoplay/preload; non reproduits comme erreurs bloquantes et classes comme aborts navigateur/headless.
- `/app/tools/angle`: warnings GPU/WebGL observes au premier passage; classes comme bruit local/headless, sans erreur runtime ni 5xx.
- `/models/kling-2-1`: 404 du sweep post-correction cause par un slug d'echantillon invalide. Les slugs catalogue reels `kling-3-pro` EN/FR/ES repassent en 200.

## Verifications executees

- Browser/Playwright:
  - Audit initial navigateur sur environ 93 routes.
  - Retests cibles apres chaque correction.
  - Sweep post-corrections sur 82 routes, sortie temporaire: `/tmp/maxvideoai-site-console-audit-postfix-2026-05-09.json`.
  - In-app Browser sur `http://localhost:3001/settings`, console warnings/errors a zero.
- Tests cibles:
  - `tests/i18n-dictionaries-architecture.test.ts`
  - `tests/middleware-architecture.test.ts`
  - `tests/marketing-navigation.test.ts`
  - `tests/home-route-architecture.test.ts`
  - `tests/examples-route-architecture.test.ts`
  - `tests/blog-language-switch.test.ts`
  - `tests/blog-post-route-architecture.test.ts`
  - `tests/settings-page-architecture.test.ts`
- QA locale/SEO:
  - `npm --prefix frontend run i18n:check`
  - `QA_BASE_URL=http://localhost:3001 QA_EXPECT_CANONICAL_BASE_URL=https://maxvideoai.com QA_EXPECT_CANONICAL_HOST=maxvideoai.com npm --prefix frontend run qa:examples-locales`
  - `QA_BASE_URL=http://localhost:3001 QA_EXPECT_CANONICAL_BASE_URL=https://maxvideoai.com npm --prefix frontend run qa:hreflang`
- Checks globaux:
  - `git diff --check`
  - `npm --prefix frontend run lint`
  - `npm run lint:exposure`
  - `./node_modules/.bin/tsc -p tsconfig.json --noEmit` depuis `frontend/`

## Recommandations restantes

- Ajouter un audit automatise leger des routes critiques avec classification des erreurs attendues (401 admin, Stripe HTTP local, abort media) pour eviter le tri manuel.
- Eviter les slugs accentues dans les frontmatter publics lorsque les liens internes et les sitemaps utilisent des slugs ASCII.
- Revoir les merges de dictionnaires client qui utilisent `deepmerge` sans `arrayMerge`, car les tableaux d'options UI peuvent se dupliquer silencieusement.
