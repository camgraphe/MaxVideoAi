# Refonte visuelle de l’application — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Une revue indépendante des contrats fonctionnels peut avancer pendant le travail visuel ; un seul propriétaire coordonne la direction graphique.

**Goal:** Livrer une refonte visuelle substantielle, fonctionnelle et mobile de l’application en conservant les acquis techniques.

**Architecture:** Séparer la présentation du domaine existant. Les hooks de génération, bibliothèque et compte gardent leurs responsabilités ; la composition et un CSS applicatif dédié remplacent les surfaces imbriquées. Les nouveaux styles visent des classes explicites, sans modifier globalement les primitives marketing.

**Tech Stack:** Next.js 15, React 18, TypeScript, SWR, Tailwind/CSS, Lucide ; police locale ou next/font avec licence vérifiée.

**Spec:** `docs/superpowers/specs/2026-09-07-app-visual-refonte.md`.

## Contraintes globales

- Branche isolée `codex/app-experience-first-lot`, validation avant fusion/déploiement.
- Priorité actuelle : direction et composition visuelles, puis qualification de l’ensemble.
- Conserver les contrats API, propriété des médias, références, drafts, prix, moteurs et paiements.
- Pas de contrôles essentiels accessibles uniquement au survol ou dans un défilement horizontal invisible.
- Pas de tests qui recopient chaque détail CSS ; tests comportementaux pour fonctions, contrats pour frontières, captures pour apparence.
- Aucun rendu payant ni mutation de compte réel pour la QA.

## Acquis à intégrer

- [x] Pagination/search bibliothèque : commits `2cce39ac3`, `3e496a5de`, tests PostgreSQL exécutés.
- [x] Préparation MCP bornée : `e63a8b73c`, `36f0dc226`, flag désactivé ; aucun projet Studio créé.
- [x] Préférences compte : `6bb0e48af`, `d79cf2ee3`, `0f300640f`, `b17f0ca93`, sauvegarde minimale du nom et gardes de changement de compte.
- [x] Première passe fonctionnelle UI : navigation mobile, recherche, actions nommées, focus, champs tactiles. Cette passe ne vaut pas validation de la refonte visuelle.

## Lot V1 — Système visuel et coque de l’application

**Fichiers :** créer `frontend/src/styles/app-experience.css`; modifier `frontend/app/(core)/layout.tsx`, `frontend/components/HeaderBar.tsx`, `frontend/components/AppSidebar.tsx`, `frontend/components/header/WorkspaceMobileNav.tsx`, `frontend/components/header/HeaderMobileMenu.tsx` et `frontend/messages/{en,fr,es}.json`.

**Interface :** classe racine `app-experience`, classes de responsabilité `app-topbar`, `app-sidebar`, `app-mobile-nav`. Variables `--app-ink`, `--app-muted`, `--app-canvas`, `--app-panel`, `--app-line`, `--app-accent`. Aucun remplacement des tokens marketing globaux.

- [x] Écrire le brief, la carte d’écrans et les critères ci-dessus avant la nouvelle passe visuelle.
- [x] Charger une police réelle et vérifier sa licence ; la déclaration actuelle de Geist seule ne prouve pas qu’elle soit chargée.
- [x] Définir les deux palettes et une échelle de typo/espace dans le CSS dédié :

```css
.app-experience { --app-ink: #20232a; --app-muted: #70747e; --app-canvas: #f6f6f4; --app-panel: #fff; --app-line: #e3e5e8; --app-accent: #6655db; }
[data-theme="dark"] .app-experience { --app-ink: #f1f2f5; --app-muted: #a0a4af; --app-canvas: #15171b; --app-panel: #1d2026; --app-line: #30343d; --app-accent: #a398ff; }
```

- [x] Regrouper les destinations de la sidebar par usage, raccourcir les libellés localisés, garder toutes les URLs et liens d’assistants.
- [x] Réduire le bruit marketing dans l’en-tête applicatif tout en conservant l’accès via le menu ; conserver la place stable portefeuille/compte.
- [x] Inspecter toute la coque à 1440 et 390 px, avant de retoucher les détails des contrôles.

## Lot V2 — Atelier vidéo/image

**Fichiers :** `WorkspaceChrome.tsx`, `WorkspaceCreationHeading.tsx`, `WorkspacePreviewDock.tsx`, `WorkspaceBootSurface.tsx`, `WorkspaceBootSkeletons.tsx` sous `frontend/app/(core)/(workspace)/app/_components/`; composants `image/_components/ImageWorkspaceComposerSurface.tsx`, `ImageWorkspaceShell.tsx`; `frontend/components/Composer.tsx`, `CoreSettingsBar.tsx`, `ImageSettingsBar.tsx`; `frontend/src/components/ui/EngineSelect.tsx` et ses composants de menu.

**Interface :** préserver les props de Composer et les callbacks de prix/génération. Ajouter uniquement des classes/surfaces de présentation : `app-creation-heading`, `app-model-strip`, `app-prompt-surface`, `app-generation-action`, `app-reference-section`.

- [x] Remplacer l’empilement carte → carte → champ par modèle ouvert + un espace de brief + actions/références.
- [x] Donner au titre, aux pictos et au bouton de génération une hiérarchie nette ; coût toujours présent dans l’action.
- [x] Garder le lecteur seulement pour un résultat/chargement, et aligner le boot vide avec le rendu final.
- [x] Garder tous les modes et références ; vérifier que les contrôles image héritent de la même logique mobile.
- [x] Finir le menu des modèles : largeur bornée au viewport, fermeture nommée, familles sélectionnables sur mobile, recherche/clavier natifs.
- [x] Capturer le générateur réel aux deux tailles et vérifier une session locale sans soumettre de génération.

## Lot V3 — Bibliothèque, résultat, paramètres

**Fichiers :** `frontend/components/library/AssetLibraryBrowser.tsx`, route `library/_components/LibraryPageClient.tsx`, `frontend/components/MediaLightbox.tsx`, `media-lightbox/MediaLightboxEntryCard.tsx`, `frontend/app/(core)/settings/page.tsx`, `settings/_components/AccountSettingsPanel.tsx`, `frontend/components/settings/SettingsTabs.tsx`, CSS dédié et dictionnaires.

**Interfaces conservées :** `useLibraryPageData` expose query/pages/mutations ; `useAccountNameForm` gère les mutations ; `useThemePreference` synchronise les thèmes. Aucun composant de présentation ne réimplémente ces flux.

- [x] Bibliothèque : retirer la grande carte d’en-tête, séparer vues/types, donner la priorité visuelle à la grille et à la recherche.
- [x] Résultat : lecteur + barre d’actions + détails à plat ; conserver téléchargement original, copie, réutilisation et sauvegarde.
- [x] Compte : lignes de réglages sans cartes imbriquées, choix d’apparence illustrés, nom/email lisibles, messages de sauvegarde près des actions.
- [x] Inspecter les états vide/erreur/chargement ainsi que les contrôles authentifiés via fixtures locales explicites.

## Lot V4 — Qualification et livraison reviewable

**Fichiers :** tests existants des zones modifiées, nouveaux tests comportementaux si une interaction le nécessite ; `docs/engineering/app-experience.md` pour les frontières ; preuves privées sous `.superpowers/sdd/2026-09-07-app-experience-first-lot/qa/`.

- [ ] Supprimer la route de fixture `frontend/app/(core)/api/experience-review/page.tsx` et déplacer le fixture hors du tsconfig de production.
- [ ] Exécuter :

```sh
NODE_PATH="$PWD/frontend/node_modules" pnpm test:validate
pnpm --prefix frontend run lint
npm run lint:exposure
pnpm --prefix frontend exec tsc --noEmit --incremental false
pnpm --prefix frontend run i18n:check
git diff --check
```

- [ ] Build production avec les variables factices documentées dans `qa/task-5-baseline-loading.md` ; mesurer le candidat avec les mêmes 3 runs Lighthouse.
- [ ] Corriger les régressions reproduites, puis revue indépendante du diff intégré. Ne pas présenter les fixtures comme une validation de l’auth ou des générations réelles.
- [ ] Conserver captures + bilan des limites ; commits lisibles, branche isolée, aucune fusion ni publication.

## Critère de fin

Le résultat présente une nouvelle composition reconnaissable sur les quatre familles d’écrans, des commandes réelles et les contrôles techniques passants. Une interface fonctionnelle mais visuellement quasi inchangée ne satisfait pas ce plan.
