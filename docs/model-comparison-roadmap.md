# Plan de travail — Comparateur (1v1) + Guides “Best for X” — SEO-safe — v1

> Objectif : faire grandir un **cluster SEO** autour du choix d’engines vidéo IA avec :
> - des pages **/ai-video-engines/** (EN) + variantes locales (**/fr/comparatif**, **/es/comparativa**) *décisionnelles* (comparaisons 1v1)
> - des pages **Best for X** plus éditoriales (plus “rankables” + plus de backlinks)
> 
> Le tout **sans cannibaliser** les pages **/models/** (référence exhaustive) ni “polluer” GSC avec une explosion d’URLs thin.

---

## 1) Objectifs (Pourquoi on le fait)
- **UX** : aider l’utilisateur à choisir un engine en 10–30 secondes (side-by-side, scores, chips) + proposer un chemin “Best for X”.
- **SEO** : capter l’intent « *X vs Y* » (forte intention) **et** l’intent générique « *best AI video engine for X* » (souvent plus de volume).
- **Produit** : réduire les hésitations au moment de générer / payer, et orienter vers le bon engine.
- **Scalabilité** : un template 1v1 solide + une génération contrôlée + quelques guides Best-for qui apportent de la profondeur.

---

## 2) Positionnement (règle d’or : ne pas dupliquer /models)

### Pages **/models/<engine>** (référence / deep dive)
- Contenu riche : specs complètes, prompt structure, tips/limitations, safety, FAQ, galerie d’exemples.
- Cible : requêtes « what is / how to use ».

### Pages **/ai-video-engines/<a>-vs-<b>** (comparaison 1v1, EN)
- **Visuel + direct** : scores + chips + tableau compact.
- Option : vidéos « même prompt face-à-face » (1–3 max).
- Cible : requêtes « X vs Y ».
- **Ne pas recopier** les longs guides, FAQs, tips de /models.

### Pages **Best for X** (guides éditoriaux)
- Format “guide” : classement Top 3–5 + critères + recommandations + FAQ courte.
- Cible : requêtes « best for X » + “best AI video generator for X”.
- Sert de **hub** interne : pousse vers les meilleurs 1v1 et vers /models.

✅ Compare 1v1 = “choisir vite”. Best-for = “choisir pour un cas d’usage”. Models = “comprendre à fond”.

---

## 3) Portée (scope) v1

### Inclus (v1)
- Hub : **/ai-video-engines** (liste + comparaisons populaires + accès Best-for)
- Pages 1v1 : **/ai-video-engines/a-vs-b** (le cœur du programmatique)
- Pages Best-for : **/ai-video-engines/best-for/<usecase>** (8–15 pages max au départ)
- Système de scoring “hybride” (sur les pages 1v1) :
  - **Overall (Default)** (fair, vidéo-only)
  - **Overall (Audio + Sequencing)** (all-in-one readiness)
- Table compacte standard (10 lignes max) sur les pages 1v1

### Hors-scope (v1)
- **1v1v1 en volume** (trop faible ROI / trop de combinatoire)
- Comparateur “custom” interactif côté client (choisir 5 engines dynamiquement)
- Classements exhaustifs multi-critères de tout le catalogue
- Recommandations personnalisées (profil user)


### Note 1v1v1 (plus tard)
- Autorisé uniquement en **curated trophy pages** (ex: 5–10 triades max) si besoin, après traction.

---

## 3.1) Inputs concrets pour démarrer (V1 launch set)

### A) 5–10 comparaisons 1v1 “trophy” (EN d’abord)
Objectif : sortir des pages qui couvrent les hésitations les plus fréquentes (premium vs premium, premium vs value, stylized vs budget).

1) `sora-2` vs `veo-3-1`
2) `sora-2` vs `kling-2-6-pro`
3) `veo-3-1` vs `kling-2-6-pro`
4) `sora-2` vs `wan-2-6`
5) `veo-3-1` vs `wan-2-6`
6) `kling-2-6-pro` vs `wan-2-6`
7) `sora-2` vs `ltx-2`
8) `veo-3-1` vs `ltx-2`
9) `pika-text-to-video` (Pika 2.2) vs `minimax-hailuo-02-text`
10) `pika-text-to-video` vs `kling-2-6-pro` (stylized/social vs “pro”)

> Note: si vous préférez réduire à 8 pages, drop #10 et #8.

### B) 8–15 pages Best-for (priorité business/SEO)
Objectif : pages plus “rankables”, plus éditoriales, et qui servent de hubs vers 1v1 + /models + Generate.

**Tier 1 (sortir en premier — conversion élevée)**
1) Best for **UGC ads / social ads**
2) Best for **product videos / ecommerce**
3) Best for **lipsync / dialogue**
4) Best for **cinematic realism**

**Tier 2 (fort potentiel SEO + utile au produit)**
5) Best for **fast drafts / cheapest iterations**
6) Best for **vertical shorts (TikTok/Reels/Shorts)**
7) Best for **image-to-video (animate a still / styleframe)**
8) Best for **stylized / anime / illustration**

**Tier 3 (nice-to-have, à ajouter après traction)**
9) Best for **motion graphics / overlays / loops**
10) Best for **consistent character / brand look**
11) Best for **text rendering / UI clarity**
12) Best for **camera moves / action / physics**

> Reco V1: publier 8–12 pages (Tier 1 + Tier 2), garder Tier 3 en backlog.

### C) Source canonique des specs engines (engineCatalog)
**Principe :** la source canonique doit être **MaxVideoAI** (pas Fal), car un engine MaxVideoAI peut agréger plusieurs endpoints/modes.

**Décision V1 :** créer un `engineCatalog` (TS) comme **source canonique** pour `/models` et `/ai-video-engines`.
- `falEngines.ts` reste la couche **intégration/mapping** (endpoints + params par mode).
- `engineCatalog` devient la couche **produit** (ce que MaxVideoAI “annonce”/supporte).
 - **/models ne sont pas la source** : elles consomment `engineCatalog` + leur contenu éditorial (copy).
 - **/compare** et **/best-for** consomment aussi `engineCatalog` (+ scores/metrics).

**Implémentation (V1) :**
- Générer `engineCatalog` depuis `falEngines` dans un script de build.
- Appliquer un `overrides.ts` (marketing + “some modes only”) pour éviter la duplication et garder la vérité produit.

**Build step (proposé) :**
- Script : `scripts/build-engine-catalog.ts` (calqué sur `scripts/generate-model-roster.mjs`)
- Commande : `pnpm engine:catalog`
- Inputs :
  - `frontend/src/config/falEngines.ts` via `listFalEngines()`
  - `frontend/src/config/engineCatalog.overrides.ts` (marketing + “some modes only”)
- Output :
  - `frontend/config/engine-catalog.json` (source produit consommée par `/models` + `/ai-video-engines`)
- Garde‑fous :
  - fail si un slug manquant, mode sans mapping, ou feature déclarée sans support réel
  - warnings si “some modes only” non documenté

### D) Métriques observées (disponibles ?)
**Décision V1 :** ship avec ce qui existe déjà : **avg + p95** (Observed, rolling 7 days).
- Pas de queue metrics et pas de p50 pour le lancement.
- UI label : “Observed (last 7 days on MaxVideoAI)”.
- Copy : “Avg render time” + “Worst-case (p95)”.

**V1.1 (optionnel) :** ajouter p50 + queue si besoin de diagnostics plus fins.

Définitions (pour éviter les débats):
- `avg` = moyenne `duration_ms` (completed)
- `p95` = percentile 95 `duration_ms` (completed)
- `fail_rate` = fails / (fails + successes) si on l’affiche

### E) Benchmark / quality scoring dataset (V1)
**Décision V1 :** ne pas bloquer le lancement sur l’automatisation.
- Fichier de scores explicite : `data/benchmarks/engine-scores.v1.json` (ou TS export).
- Champs : `fidelity`, `motion`, `anatomy`, `textRendering`, `consistency`, `lipsyncQuality`, `sequencingQuality`, `last_updated`.
- Scores V1 = **curation manuelle** (tests internes), évolutifs plus tard.

### F) Best-for content (copy + ranking + storage)
**Décision V1 :** stocker Best-for en fichiers de contenu + config légère de ranking.
- Contenu :
  - `content/en/best-for/<usecase>.mdx`
  - `content/fr/best-for/<usecase>.mdx`
  - `content/es/best-for/<usecase>.mdx`
- Ranking :
  - calculé via `engineCatalog` + `engineScores` + pricing/metrics
  - overrides par page possible (ex: `topPicks: [engine_slug, ...]`)

**Plan V1 :** démarrer avec 8–12 pages (Tier 1 + Tier 2).

### G) Design/UX (réutiliser vs recréer)
**Décision V1 :** pas de page type “tableur/Excel”. Les pages compare doivent être **app-like** et alignées avec le style MaxVideoAI.

**Ce qui doit dominer (app-like)**
- 2 cards hero (A vs B) : nom/logo, “best for”, **Overall score**, mini pillar bars, CTA “Generate”.
- Chips visibles : Audio, Lipsync, Sequencing, Price/s, Observed speed (avg + p95).
- Row “Winner badges” : Best Fidelity / Best Motion / Best Value / Best Lipsync / Best Sequencing.
- Showdown (optionnel mais clé) : same prompt, A vs B côte‑à‑côte (1–3 max).

**Où vont les specs (sans effet Excel)**
- Module compact **sous le fold** (10 lignes max).
- Mobile : accordion “setting rows” (label gauche, valeur droite, chips/tooltips).
- Desktop : table courte et aérée ou “spec rows”, **jamais** une grille dense.

**Reuse vs create**
- Réutiliser au maximum : cards, chips, typographies, CTA blocks, gallery.
- Créer uniquement les blocs compare spécifiques :
  - layout 2‑col compare
  - dual totals (Overall Default + Overall Audio/Sequencing)
  - winner badges
  - compact spec module
  - showdown gallery

---

## 4) IA (Information Architecture) + navigation

### URLs
- Hub (EN) : `/ai-video-engines` (déjà en prod)
- Hub (FR/ES) : `/fr/comparatif`, `/es/comparativa`

**Comparaisons 1v1**
- 1v1 (EN) : `/ai-video-engines/sora-2-vs-veo-3-1`
- 1v1 (FR/ES) : `/fr/comparatif/sora-2-vs-veo-3-1`, `/es/comparativa/sora-2-vs-veo-3-1`

**Guides Best-for**
- Best-for hub (EN) : `/ai-video-engines/best-for`
- Best-for detail (EN) : `/ai-video-engines/best-for/ugc-ads`
- Best-for detail (FR/ES) : `/fr/comparatif/best-for/ugc-ads`, `/es/comparativa/best-for/ugc-ads` (**Option A retenue**)

**Note slug policy**
- `docs/seo/slug-policy.md` exige l’anglais → on garde `best-for` en EN partout (cohérent + moins de mapping)

### Canonicalisation (critique)
- **Ordre canonique** : slug imposé (A vs B), redirection 301 si inverse (B vs A)
- **Canonical** : self-canonical sur la version canonique uniquement

### Best-for quality gate (anti thin content)
- Minimum 600–800 mots par page
- Top 3–5 moteurs + tableau comparatif rapide
- 2 liens vers pages 1v1 + 2 liens vers /models
- FAQ courte (3–5 questions) + 1 visuel/graph si possible

### Méthodologie de classement (Best-for)
- Mix **scoring observé** (perf/qualité/coût) + **curation éditoriale**
- Toujours expliquer “pourquoi” (critères + contexte d’usage)
- Indiquer si un moteur est recommandé pour *budget*, *fidelity* ou *rapidité*
- Best-for : self-canonical par locale + hreflang cohérent

### i18n (aligné avec le code)
- `frontend/config/localized-slugs.json` :
  - clé `compare` → `ai-video-engines` / `comparatif` / `comparativa`
  - clé `bestFor` → `best-for` / (`best-for` ou `meilleur-pour`) / (`best-for` ou `mejor-para`)
- `frontend/i18n/routing.ts` : ajouter les routes compare detail + best-for hub/detail
- Slug comparaison **non traduit** (reste en EN pour stabilité SEO)
- Slug usecase : recommandé **en EN** (stable) même si le segment “best-for” est localisé
- `buildSeoMetadata` + `buildMetadataUrls` avec `englishPath` = `/ai-video-engines/<slug>`

### Accès
- Header : **Models** (dropdown) → “Compare engines”
- Hub `/ai-video-engines` :
  - blocs “Popular comparisons”
  - bloc “Best for X” (liste)
- Page `/models/<engine>` : CTA “Compare” (pré-remplie avec l’engine actuel) + “Best for X” (2–3 liens)
- Page 1v1 : liens “Deep dive” vers les 2 pages `/models` concernées
- Footer : lien “Compare engines” + “Best for X” + “Popular comparisons”

---

## 5) Source de vérité & données (MaxVideoAI > Fal)

### Principe
MaxVideoAI fusionne parfois plusieurs endpoints Fal en **un seul engine** ⇒ la source de vérité “produit” doit être **MaxVideoAI**.

### Couches de données (3)
1) **Engine Catalog (canonique MaxVideoAI)**
   - `engine_slug`, nom, provider, positionnement, modes (résolution/durée/input), features “marketing” validées
2) **Fal manifest (feed fournisseur)**
   - schéma OpenAPI + pricing par endpoint (utile pour auto-détecter des capacités)
3) **Observed metrics (source: app)**
   - latency p50/p95, queue p50/p95 (optionnel), fail/retry rates (rolling 7/30 jours)

### Règle d’affichage (éviter les surprises)
- Si une feature n’existe que sur certains modes : afficher **“Yes (some modes)”** + tooltip (ex: “1080p only”).

### Ownership & cadence
- Owner: PM/Content pour le Catalog, Eng pour les metrics observées.
- Cadence: refresh weekly (catalog), daily (metrics), override manuel si besoin.

---

## 6) Contenu standard — pages 1v1 (v1)

### Above the fold (skimmable)
- 2 cards (A vs B)
- **Overall (Default)** + barres des 6 piliers
- **Overall (Audio + Sequencing)** (secondaire mais visible)
- Highlight blocks :
  - **Audio (Yes/No)** + **Lipsync score** (si observé)
  - **Sequenced prompts (Yes/No)** + score (si observé)
- CTA : “Generate with A” / “Generate with B”
- Liens : “Deep dive A” / “Deep dive B”

### Milieu de page
- Badges “Winner by category” : Best Fidelity / Best Motion / Best Value / Best Lipsync / Best Sequencing
- Tableau compact (10 lignes max)
- 2–3 bullets “Why it wins” par engine

### Bas de page
- 1–3 “Same prompt face-to-face” (même prompt, rendu A et B)
- Related comparisons
- Mini FAQ (compare-specific seulement, 3–5 questions)

---

## 7) Contenu standard — pages Best-for (v1)

### Structure recommandée (plus éditoriale, plus rankable)
- Intro courte : qui est ce guide + le critère principal (ex: “best for lipsync”) 
- **Top 3–5** engines (cards) :
  - “Best overall” + 2–4 alternatives (best value, best realism, best speed)
  - “Why” + “Avoid if” (2 bullets)
- Tableau compact “criteria” (8–12 critères max, pas forcément le même que 1v1)
- Section “Compare the top picks” : liens vers 3–6 pages 1v1 pertinentes
- 1–3 showdowns (même prompt) si dispo
- FAQ courte (unique)
- CTA vers Generate + liens /models

### Règle anti-thin
- Une page Best-for doit apporter **du texte unique** + un vrai angle (sinon noindex).

---

## 8) Tableau compact (pages 1v1) — 10 lignes max (officiel)
1) Max resolution
2) Duration options
3) Aspect ratios (16:9 / 9:16 / 1:1)
4) Inputs (Text / Image / Video / Multi-image)
5) Audio (Yes/No)
6) Lipsync (Yes/No + score si observé)
7) Sequenced prompts (Yes/No + score si observé)
8) Core controls (Seed / Negative prompt / Extend / Inpaint)
9) Avg render time (observed p50)
10) **Price per second** (tiers clés, ex: 720p vs 1080p)

---

## 9) Scoring (pages 1v1) — v1

### Piliers “base” (0–10) pour **Overall (Default)**
- Fidelity / prompt following (25%)
- Motion / physics (20%)
- Cost/Value (20%)
- Specs/Flexibility (15%)
- Consistency/Control (10%)
- Speed/Reliability (10%)

### Piliers “featured” (mis en avant)
- Audio/Lipsync
- Sequenced prompts / storyboarding

### Deux totaux (hybride)
- **Overall (Default)** : n’inclut pas Audio+Sequencing (affichés séparément)
- **Overall (Audio + Sequencing)** : inclut Audio+Sequencing avec pénalité si absent

### Transparence
- Specs/capabilities = provider/schema + catalog MaxVideoAI
- Qualité = benchmark pack (observed)
- Perf = logs app (observed)
- Tooltips : “Provider spec” vs “Observed on MaxVideoAI (7d/30d)”

---

## 10) Benchmark pack (pour alimenter les scores qualité)
Pack standard (mêmes prompts pour tous) :
- A : Human + hands + interaction objet (hard)
- B : Product + ref image + slow camera
- C : Environment + particles + lighting shift
- D : Stylized (optionnel)
- E : Dialogue + lipsync (si audio)

Règle : 3 rendus par test → prendre la médiane.

---

## 11) Performance & fiabilité (source = app)
Même si Fal ne fournit pas ces métriques :
- `latency_p50`, `latency_p95`
- `queue_p50`, `queue_p95` (optionnel)
- `fail_rate`, `retry_rate`
- fenêtres : rolling 7d / 30d

Label UI : “Observed (last 7 days on MaxVideoAI)”.

---

## 12) SEO safety + stratégie de publication (ne pas flinguer GSC)

### A) En ligne ≠ indexé (pilotage)
- Toutes les pages peuvent exister en prod, mais **seules les pages “curated”** deviennent indexables.
- Pilotage recommandé :
  - **Allowlist** (pages indexables)
  - **Sitemap** dédié “compare” (n’inclure que les pages allowlist)
  - Pages hors allowlist : `noindex,follow`

### B) Rollout conseillé (par lots)
- **Phase 1 (EN)** :
  - 20–50 pages 1v1 “high-intent” (indexables)
  - 8–12 pages Best-for (indexables)
- **Phase 2** : ajouter des lots seulement quand la majorité du lot précédent est indexée et performe.
- **FR/ES** : recommandé **après stabilisation EN** (pour ne pas tripler le “discovered”).

### C) Anti-cannibalisation
- 1v1 = décisionnel, pas de duplication des guides / prompts / FAQ longs
- Best-for = guide unique (texte + angle + recommandations)
- Liens systématiques vers /models

### D) Technique
- self-canonical sur /ai-video-engines et sous-pages
- éviter les variantes querystring indexables
- hreflang cohérent FR/ES/EN

### E) Perf
- pas de médias lourds au-dessus du fold
- lazy-load des vidéos showdown

---

## 13) Plan d’exécution (branche dédiée)

### Ordre fixe (roadmap complète)
1) **Cadre data (source canonique)**  
   Créer `engineCatalog` + `overrides.ts`, puis générer `frontend/config/engine-catalog.json`.
2) **Scores & metrics (V1)**  
   Ajouter `data/benchmarks/engine-scores.v1.json` + brancher avg/p95 (Observed 7d).
3) **Slugs & listes curées**  
   Centraliser `trophyComparisons`, `bestForPages`, `relatedComparisons` (config unique).
4) **Routing & i18n**  
   Ajouter routes 1v1 + best-for + mapping i18n + metadata/hreflang.
5) **UI compare (app-like)**  
   Hero cards, chips, winner badges, dual totals, spec module compact.
6) **Showdown**  
   Section face‑à‑face (1–3 max) avec lazy‑load.
7) **Best‑for (structure + 1 pilote)**  
   Loader MDX + 1 page pilote.
8) **Compare “golden page”**  
   1 page 1v1 exemplaire + CTAs /models + Generate.
9) **Sitemap + QA**  
   Pages curées seulement + checks canonical/hreflang/anti‑thin.
10) **Scale v1**  
   Publier 8–12 Best‑for + 8–10 1v1 + interlinking.

### Étape A — Design & composants (UI)
- Pages 1v1 : CompareHero, EngineCards, PillarBars, HighlightBlocks (Audio/Sequencing), CompactSpecTable, WinnerBadges, RelatedComparisons, ShowdownGallery
- Pages Best-for : BestForHero, TopPicksCards, CriteriaTable, CompareLinks, FAQ, ShowdownGallery
- Responsive : mobile-first (table en accordion)

### Étape B — Données (catalog + mapping)
- Définir `engineCatalog` (source canonique)
- Schéma validé (ex: Zod) + normalisation unités/coûts
- Relier chaque **mode** à un endpoint Fal (si besoin)
- Importer `fal-engine-manifest.json` comme aide (non canonique)
- Brancher observed metrics depuis tables/logs

### Étape C — Routing
- Hub existe : `/ai-video-engines`
- Créer la route 1v1 : `/ai-video-engines/[slug]`
- Créer les routes Best-for :
  - `/ai-video-engines/best-for` (hub)
  - `/ai-video-engines/best-for/[usecase]` (detail)
- Générer statiquement une liste **curated** (top combos + best-for)

### Étape D — Golden pages (pilot)
- 1v1 : “Sora 2 vs Veo 3.1”
- Best-for : “Best for lipsync” (ou “Best for UGC ads”)
- Ajouter CTAs & liens depuis /models concernées

### Étape E — SEO validation
- vérifier indexation, CTR, engagement
- vérifier absence de cannibalisation sur requêtes /models

### Étape F — Scale
- Ajouter des lots 1v1 + best-for (progressif)
- (Optionnel plus tard) 5–10 1v1v1 trophy pages

---

## 14) Definition of Done (v1)
- `/ai-video-engines` hub : comparaisons + accès Best-for
- 1 page 1v1 “golden” en prod, stylée comme le site
- 1 page Best-for “golden” en prod (guide)
- Tableau compact 1v1 = 10 lignes max (dont price per second)
- Audio/Lipsync + Sequencing mis en avant
- Render time = avg + p95 (Observed 7d)
- Liens : 1v1 → /models et /models → 1v1 ; Best-for → 1v1 + /models
- Slugs canoniques + redirection 301 (A vs B)
- Indexation pilotée (allowlist + sitemap)
- Aucun signal de régression SEO (spot-check GSC + crawl)

---

## 15) Questions ouvertes (à trancher)
- Segment Best-for localisé (meilleur-pour / mejor-para) ou garder `best-for` partout ?
- Fenêtre métriques par défaut : 7d ou 30d ?
- Liste “Top comparisons” (priorité SEO / conversion)
- Liste “Best-for” initiale (8–12 pages)

---

## 16) Risques
- Explosion combinatoire des pages → thin content → GSC bruit
- Variabilité des providers → scores/perf qui changent vite
- Features “some modes only” → confusion si mal affiché

---

## 17) Checklist release (rapide)
- [ ] Sitemap compare contient **uniquement** les pages allowlist
- [ ] Pages hors allowlist : `noindex,follow`
- [ ] Canonical + internal links ok
- [ ] Hreflang ok (checker via `frontend/scripts/qa/hreflang-check.ts`)
- [ ] Lazy-load vidéo showdown
- [ ] Monitoring : impressions/clicks compare + impact models
