# Global App Concept Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Keep one visual owner; existing user authorization covers isolated prototype work without another execution-method question.

**Goal:** Démontrer une nouvelle expérience globale de MaxVideoAI sur la création, la bibliothèque et les paramètres, avant de généraliser son implémentation.

**Architecture:** Construire une preuve interactive isolée, avec navigation commune et données locales explicites, pour vérifier la direction visuelle et les interactions. Raccorder ensuite les surfaces retenues aux hooks et contrats existants. Le Studio reste un sous-projet distinct qui reprend le même langage visuel.

**Tech Stack:** Prototype local HTML/CSS/JavaScript sans dépendance de build ; application cible Next.js/React/TypeScript/SWR ; assets réels du dépôt.

**Spec:** `docs/superpowers/specs/2026-09-07-app-concept-reset.md`, corrigée avec la clarification globale du dernier échange.

## Global Constraints

- Branche isolée `codex/app-experience-first-lot`. Aucun merge, push ou déploiement sans instruction correspondante.
- Les fonctions du premier lot sont conservées. La direction visuelle précédente n’est pas validée par l’utilisateur.
- La refonte porte sur toute l’application ; le canevas ne devient pas son interface générale.
- Le prochain livrable est un prototype manipulable de plusieurs écrans avec leur adaptation mobile.
- La génération d’images n’est pas une dépendance du planning : les captures et le code existants sont disponibles ; le prototype est une nouvelle composition, pas un travail de fidélité à la planche Studio.
- Aucun rendu payant, écriture sur compte réel, faux prix, faux statut serveur ou faux montage enregistré pour les essais.
- Les commandes essentielles restent nommées, accessibles au toucher et au clavier. Minimum de 44 × 44 px pour les cibles tactiles isolées.
- Respecter `prefers-reduced-motion`. Le mouvement explique une sélection ou une action ; il ne crée pas de délai obligatoire.
- Pas de nouveau moteur de génération, de nouvel état global ou de nouvelle couche de projets persistés pour obtenir la refonte.

## Feuille de route du produit

| Étape | Résultat attendu | Condition de passage |
|---|---|---|
| Concept global | Carte des usages et langage visuel commun | Création, médias et compte ont chacun une interface adaptée, reliée par une navigation cohérente |
| Prototype | Création vidéo/image, bibliothèque et paramètres manipulables sur ordinateur et mobile | L’utilisateur peut juger les parcours, les menus, les pictos, la densité et le mouvement dans un navigateur |
| Intégration app | Remplacement de la présentation et raccordement aux fonctions réelles, puis extension aux outils, connexions, activité et facturation | Le nouveau concept est retenu ; chaque surface conserve ses fonctionnalités et passe ses contrôles |
| Studio | Blocs, menus, sélection et inspecteur redessinés dans le langage commun | Les comportements du canevas sont clairs sans imposer un graphe à toute l’app |
| Montage MCP minimal | Déposer des clips sélectionnés dans l’ordre sur une nouvelle timeline persistée | Propriété des médias, transaction, idempotence et coexistence avec l’autosave Studio validées |

Les trois premières tâches ci-dessous construisent le prochain livrable. Les étapes d’intégration, Studio et montage feront chacune l’objet d’un plan d’implémentation correspondant au concept retenu et au code disponible, plutôt que de figer maintenant des détails de composants qui pourraient être rejetés.

## Direction recommandée

Une application de création organisée par activités : **Créer · Médias · Outils · Studio**. Compte, préférences, facturation et connexions se trouvent dans un espace personnel cohérent. Les destinations exactes restent celles du produit ; Studio reste soumis à sa disponibilité réelle dans l’app intégrée.

Le créateur principal propose une surface de travail, une sélection de modèle/outils, des références et des commandes contextualisées. La création depuis un texte seul reste directe. Après un rendu, le média et ses variantes prennent leur place dans cette même surface. Aucun canevas ou timeline obligatoire pour générer une image ou une vidéo.

La bibliothèque fonctionne comme un navigateur de médias : sélection claire, recherche, filtres, aperçu et actions sur la sélection. Les paramètres utilisent des préférences structurées et des commandes de type logiciel. On n’impose pas à ces trois usages le même gabarit.

Le langage visuel repose sur une vraie hiérarchie de typographie, des pictos pleins/duotones aux silhouettes reconnaissables, des contrôles différenciés selon leur fonction et des états de sélection affirmés. La référence aux jeux concerne le soin des menus, le focus et les retours visuels ; elle ne justifie ni scores, ni rareté, ni décor de jeu.

## Task 1 — Fixer les usages et la grammaire visuelle

**Files:**
- Create: `.superpowers/sdd/global-app-concept/experience-map.md`
- Create: `.superpowers/sdd/global-app-concept/visual-rules.md`
- Read: `frontend/components/AppSidebar.tsx`, `frontend/components/HeaderBar.tsx`, `frontend/components/header/WorkspaceMobileNav.tsx`
- Read: `frontend/components/Composer.tsx`, `frontend/components/library/AssetLibraryBrowser.tsx`, `frontend/app/(core)/settings/_components/AccountSettingsPanel.tsx`

**Interfaces:** produit une carte `activité → écran → action principale → commandes secondaires → état vide → version mobile`. Cette carte est l’entrée de la tâche 2, sans modification des routes ni des fonctions serveur.

- [ ] Décrire les quatre activités et l’espace personnel avec les URLs existantes ; vérifier que chaque destination actuelle conserve un accès.
- [ ] Définir le parcours de création depuis texte seul et depuis une référence, puis consultation et réutilisation du résultat.
- [ ] Définir sélection, aperçu, recherche et actions de bibliothèque ; définir apparence, langue, profil et connexions côté compte.
- [ ] Définir pour chaque type de contrôle sa forme : navigation, outil, valeur, transport et action principale. Éviter la répétition du même bouton arrondi.
- [ ] Fixer une direction commune de typo, pictos, contraste, densité et mouvement ; vérifier qu’elle fonctionne sur les trois usages, y compris leurs états vides.

**Validation:** une seule page de carte d’usages et une seule page de règles ; aucune nouvelle enquête exhaustive ni inventaire déjà couvert par l’audit. Les arbitrages doivent être visibles dans le prototype suivant.

## Task 2 — Construire le prototype global manipulable

**Files:**
- Create: `.superpowers/sdd/global-app-concept/prototype/index.html`
- Create: `.superpowers/sdd/global-app-concept/prototype/app.css`
- Create: `.superpowers/sdd/global-app-concept/prototype/app.js`
- Create: `.superpowers/sdd/global-app-concept/prototype/data.js`
- Create: `.superpowers/sdd/global-app-concept/prototype/assets/` pour les copies nécessaires d’assets existants, licences conservées

**Interfaces:** données locales et état explicites, distincts de toute session réelle :

```js
export const initialState = {
  screen: 'create', // create | library | settings
  mediaKind: 'video', // video | image
  selectedMediaId: null,
  prompt: '',
  query: '',
  appearance: 'system',
  motion: 'system',
  inspector: null, // model | references | settings
};

// data.js : médias illustratifs réellement disponibles dans les assets locaux.
// Aucun fetch vers les API de génération, de compte ou de paiement.
// État de prototype dans app.js ; seule la préférence d'apparence peut
// persister sous une clé propre au prototype, jamais sous une clé de l'app.
```

- [ ] Monter la coque et une navigation commune vers les trois écrans ; donner aux destinations de périmètre ultérieur un état explicite dans la revue, sans fausse fonction dans l’app réelle.
- [ ] Construire la création vidéo/image : choix de mode et modèle, instruction éditable, choix/remplacement de référence, réglages accessibles, états vide et résultat illustratif.
- [ ] Faire de la sélection du média et de l’ouverture d’un outil des interactions visibles et réversibles. Le bouton de génération du prototype annonce explicitement une simulation locale ; aucun faux rendu serveur.
- [ ] Construire la bibliothèque : filtrer/rechercher les données locales, sélectionner un média, ouvrir son aperçu, revenir à la grille et réutiliser sa référence dans le créateur.
- [ ] Construire les paramètres : apparence et réduction des mouvements effectives dans le prototype, navigation de préférences, formulaire local de profil avec annulation. Aucune écriture Supabase.
- [ ] Ajouter des transitions interrompables sur sélection et ouverture ; leurs versions réduites conservent les mêmes états et annonces.
- [ ] Composer réellement les versions mobiles : navigation nommée stable, commandes principales visibles, panneaux explicitement ouvrables et refermables, aucun fonctionnement dépendant du survol.

**Validation navigateur:** à 1440, 390 et 320 px, parcourir `Créer → changer de modèle → choisir une référence → ouvrir les réglages → Bibliothèque → rechercher → aperçu → réutiliser → Paramètres → apparence → retour à Créer`. Vérifier le clavier, Échap, le retour de focus, le scroll et les contrôles en bas d’écran. Les captures seules ne valent pas validation des interactions. Ne pas écrire de tests qui recopient la structure CSS du prototype.

## Task 3 — Faire une revue du concept global

**Files:**
- Create: `.superpowers/sdd/global-app-concept/review.md`
- Create: `.superpowers/sdd/global-app-concept/captures/` pour captures desktop/mobile comparables
- Update: `docs/superpowers/specs/2026-09-07-app-concept-reset.md` avec le retour réel du prochain échange

**Interfaces:** transmet un prototype utilisable et un relevé `retenu / à corriger / non démontré`. Les données et actions simulées sont séparées des capacités existantes dans ce relevé.

- [ ] Inspecter les trois écrans comme un ensemble : identité, navigation, pictos, boutons, espacement et densité doivent constituer un langage commun, tout en servant des usages différents.
- [ ] Inspecter les états vides, la sélection, les menus ouverts et la variante mobile. Corriger les contrôles coupés, focus perdus ou commandes essentielles masquées.
- [ ] Ouvrir le prototype dans Codex et présenter les parcours manipulables. Expliquer brièvement les arbitrages et les limites de simulation.
- [ ] Recueillir le retour sur cette direction globale avant d’investir dans sa généralisation aux composants de production.

## Frontières pour l’intégration suivante

- La coque réutilise le prédicat `isAppExperiencePath` afin de préserver les routes marketing, admin et import privé MCP.
- `AppClient` et `ImageWorkspace` restent des orchestrateurs ; prix, génération, drafts, références et polling restent dans leurs hooks.
- La bibliothèque réelle garde `useLibraryPageData`, sa recherche serveur, sa pagination et l’isolation par compte.
- Les paramètres réels gardent `useAccountNameForm` et `useThemePreference` ; les connexions reflètent leur état réel.
- Les retouches de média préservent les rôles thumbnail/preview/original.
- Les vérifications de production comprennent les contrats concernés, les tests comportementaux utiles, lint, types, i18n, build, essais navigateur et chargement comparable.

## Hors du premier prototype

Réécriture du backend, nouveaux modèles, changement de tarification, assistant autonome, éditeur complet et montage avancé. Le montage MCP minimal reste un lot borné : ordre des clips et insertion dans une nouvelle timeline, avec le travail de persistance nécessaire avant toute promesse dans l’UI.

## Self-review

- Périmètre global couvert par création, bibliothèque et paramètres ; outils/connexions/activité/facturation explicitement dans la généralisation.
- Studio séparé de la conception générale ; timeline non imposée au créateur.
- Prototype vérifiable avant intégration coûteuse ; qualité visuelle évaluée séparément de la qualification technique du premier lot.
- Branche et acquis fonctionnels préservés ; aucune nouvelle demande d’autorisation d’exécution ou de choix d’outil nécessaire pour ce plan.
