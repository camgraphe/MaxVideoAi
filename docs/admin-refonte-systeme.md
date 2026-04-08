# RFC: Refonte Systeme Admin

## Statut

- Branche de travail: `codex/admin-refonte-systeme`
- Etat: draft initial
- Date: 2026-04-07

## Resume

L'admin actuel a deja une base exploitable:

- authentification admin
- shell avec sidebar et topbar
- navigation centralisee
- badges live de sante
- pages metier deja routees

En revanche, il n'existe pas encore de systeme admin coherent pour les surfaces data, les patterns analytiques, les tables, les filtres, les vues detail, et les workflows operateurs.

Le resultat actuel est previsible:

- pages heterogenes
- logique "cards first" trop presente
- densite mal maitrisee
- dashboards peu actionnables
- charts ad hoc
- difficultes a faire evoluer l'admin sans refaire l'UX page par page

Cette RFC propose une refonte systemique de l'admin, avec une architecture UI/UX et technique stable, performante, reutilisable et evolutive.

## Objectifs

- Construire un vrai systeme d'admin, pas une collection de pages isolees.
- Uniformiser l'experience operateur sur tous les ecrans admin.
- Rendre les pages analytics, ops et support lisibles, denses et actionnables.
- Poser des primitives reutilisables pour tables, filtres, vues detail, charts et alertes.
- Preparer une evolution de stack sans migration brutale ni rework inutile.

## Non-objectifs

- Refondre l'espace utilisateur public.
- Remplacer d'un coup toute la navigation admin par un template externe.
- Migrer immediatement tout le projet vers un nouveau framework sans passer par une couche systeme admin.
- Introduire une surcouche design decorative ou marketing dans l'admin.

## Etat Actuel

### Ce qui existe deja

- Shell admin:
  - `frontend/app/(core)/admin/layout.tsx`
  - `frontend/components/admin/AdminLayout.tsx`
  - `frontend/components/admin/AdminShell.tsx`
  - `frontend/components/admin/AdminTopbar.tsx`
  - `frontend/components/admin/SidebarNav.tsx`
- Donnees et securite:
  - `requireAdmin()`
  - endpoints admin existants
  - badges et health checks live
- Pages admin deja en place:
  - `/admin`
  - `/admin/insights`
  - `/admin/users`
  - `/admin/users/[userId]`
  - `/admin/jobs`
  - `/admin/transactions`
  - `/admin/engines`
  - `/admin/pricing`
  - `/admin/system`
  - `/admin/legal`
  - `/admin/theme`
  - `/admin/home`
  - `/admin/moderation`
  - `/admin/playlists`
  - `/admin/video-seo`
  - `/admin/marketing`
  - `/admin/audit`

### Limites identifiees

- Aucun langage unifie pour les pages "table-first", "detail-first" et "analytics-first".
- Charts custom trop fragiles et trop chers a maintenir.
- Tables admin insuffisamment outillees:
  - densite
  - tri
  - filtres
  - colonnes visibles
  - bulk actions
  - drawers/detail views
- Trop de composants de surface improvises par page.
- Pas de systeme clair de severite:
  - info
  - success
  - warning
  - critical
- Hierarchie visuelle inegale entre pages.
- Couche "theme tokens" existante, mais pas encore transformee en design system admin robuste.

## Principes de Conception

### 1. Admin = surfaces de travail

Une page admin doit d'abord permettre:

- de voir
- de comprendre
- de filtrer
- d'agir
- de creuser

Une page admin n'est pas une galerie de cartes.

### 2. Layout avant composant

On privilegie:

- shell stable
- toolbar stable
- surfaces principales bien identifiees
- details contextuels
- actions visibles

Avant d'ajouter un composant, on decide:

- ou se lit l'information
- ou s'appliquent les filtres
- ou se font les actions
- ou s'ouvre le detail

### 3. Densite maitrisee

L'admin doit etre:

- compact
- respirant
- lisible
- pilotable

Pas:

- vide
- decoratif
- surcharge de chips
- empilement de boites dans des boites

### 4. Tables et graphiques standards

On arrete de re-inventer:

- les tables
- les graphes
- les filtres
- les etats de vue

Le systeme doit fournir des primitives reutilisables.

### 5. Systeme d'etat commun

Toutes les surfaces admin doivent partager:

- loading
- empty
- error
- warning
- stale
- success

## Stack Cible

## Base applicative

- Conserver App Router et l'organisation serveur actuelle.
- Conserver `requireAdmin()` et les loaders serveur existants.
- Conserver SWR pour les surfaces live legeres tant qu'il n'y a pas un vrai besoin d'un cache client plus lourd.

## UI et interactions

- Radix Primitives pour les fondations d'accessibilite et d'interactions.
- `shadcn/ui` comme base de composants modifiables, pas comme "template fini".
- `TanStack Table` pour toutes les surfaces tabulaires admin.
- `Recharts` pour les vues analytiques standards.

## Evolution de stack recommandee

- Cible moyen terme:
  - `Next.js 16`
  - `React 19`
  - `Tailwind CSS 4`

## Pourquoi cette direction

- `TanStack Table` apporte un moteur table headless et durable.
- `Recharts` couvre vite et proprement le besoin admin analytics.
- `Radix + shadcn` permettent un systeme UI robuste sans lock-in template.
- `React 19` simplifie plusieurs patterns de mutations et d'etats d'action.
- `Tailwind 4` aide a mieux structurer les tokens et les surfaces.

## Architecture Cible

### Dossier propose

```text
frontend/
  components/
    admin-system/
      shell/
      navigation/
      filters/
      table/
      chart/
      metrics/
      detail/
      feedback/
      forms/
  features/
    admin/
      insights/
      users/
      jobs/
      transactions/
      engines/
      shared/
```

### Regle d'organisation

- `components/admin-system/*`
  primitives et patterns reutilisables
- `features/admin/*`
  logique metier et composition par domaine
- `app/(core)/admin/*`
  pages fines et loaders serveur

## Primitives a construire

### Shell

- `AdminPageHeader`
- `AdminToolbar`
- `AdminSection`
- `AdminSplitLayout`
- `AdminInspectorDrawer`
- `AdminCommandBar`

### Data

- `DataTable`
- `DataTableToolbar`
- `DataTableFilters`
- `ColumnVisibilityMenu`
- `BulkActionBar`
- `RowActionsMenu`
- `PaginationFooter`

### Analytics

- `KpiBar`
- `MetricCard`
- `TrendChart`
- `ComparisonChart`
- `BreakdownTable`
- `FunnelChart`
- `AlertRail`

### Feedback

- `EmptyState`
- `InlineError`
- `LoadingSkeleton`
- `StatusBadge`
- `SeverityBadge`

## Archetypes de Pages

### 1. Hub

Exemple:

- `/admin`

Structure:

- health rail
- quick actions
- navigation par domaine
- incidents et anomalies

### 2. Table-first

Exemples:

- `/admin/users`
- `/admin/jobs`
- `/admin/transactions`

Structure:

- header
- toolbar filtres/actions
- table principale
- drawer ou page detail

### 3. Detail-first

Exemples:

- `/admin/users/[userId]`
- `/admin/system`
- `/admin/engines`

Structure:

- header entite
- resume
- sections detail
- historique / actions

### 4. Analytics-first

Exemple:

- `/admin/insights`

Structure:

- barre de KPI dense
- explorateur de tendances
- synthese current vs previous
- funnel
- breakdowns
- tables actionnables

## Plan de Migration

### Phase 0: cadrage

- Valider cette RFC.
- Figer les principes UX admin.
- Choisir la stack cible pour:
  - tables
  - charts
  - primitives UI
- Lister les composants admin-system a produire.

### Phase 1: fondations

- Construire `admin-system/shell`
- Construire `admin-system/feedback`
- Construire `admin-system/metrics`
- Construire `admin-system/filters`
- Introduire `TanStack Table`
- Introduire `Recharts`

### Phase 2: pages prioritaires

- Refondre `/admin`
- Refondre `/admin/insights`
- Refondre `/admin/jobs`
- Refondre `/admin/users`

### Phase 3: coherence metier

- Refondre `/admin/transactions`
- Refondre `/admin/engines`
- Refondre `/admin/system`
- Refondre `/admin/users/[userId]`

### Phase 4: secondaires

- Refondre moderation, playlists, marketing, audit, legal, theme, home, video-seo

### Phase 5: upgrade stack globale

- Migration `Next 14 -> 16`
- Migration `React 18 -> 19`
- Migration `Tailwind 3 -> 4`
- Nettoyage de l'ancien code admin devenu obsolete

## Premiere Tranche Recommandee

La premiere tranche implementable doit rester limitee et rentable.

### Scope recommande

- Introduire le dossier `components/admin-system/`
- Refondre le shell admin sans casser les routes
- Construire:
  - `AdminPageHeader`
  - `AdminSection`
  - `KpiBar`
  - `TrendChart`
  - `StatusBadge`
  - `EmptyState`
  - `DataTable` minimal
- Migrer ensuite:
  - `/admin`
  - `/admin/insights`

### Pourquoi ce scope

- Fort impact visuel et UX
- Forte reutilisation
- Risque de migration contenu
- Permet de juger tres vite si la direction est bonne

## Performance

### Regles

- Preferer server rendering et loaders serveur pour les vues initiales.
- Limiter les composants client aux interactions reelles:
  - filtres riches
  - menus
  - column visibility
  - drawer detail
  - refresh live
- Eviter les dashboards entierement client si la data peut etre pre-rendue.
- Virtualiser les grosses listes si necessaire.
- Ne pas recalculer les graphs dans plusieurs composants differents.

## Risques

- Melanger refonte UI et upgrade framework dans le meme chantier.
- Importer un template GitHub trop prescriptif.
- Faire une refonte `insights` seule sans systeme reutilisable.
- Continuer a ajouter des composants admin "one-off".

## Questions Ouvertes

- Veut-on une densite admin proche de Linear/Vercel, ou plus proche d'un backoffice type ops/finance ?
- Souhaite-t-on garder SWR seul pour les interactions live, ou introduire TanStack Query plus tard ?
- Faut-il faire evoluer aussi le shell global de l'admin des la phase 1, ou commencer par les surfaces internes ?

## Decision Proposee

- Valider la direction "refonte systeme admin"
- Conserver le shell et la securite existants comme base
- Construire `admin-system`
- Refondre d'abord `/admin` et `/admin/insights`
- Reporter l'upgrade complet framework apres stabilisation de la couche admin-system
