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
- Le prochain livrable est un prototype manipulable de plusieurs écrans avec leur adaptation mobile, comprenant les allers-retours de références image, vidéo et audio.
- Les références grandissent à l’usage : aucun quadrillage de slots vides ni hauteur proportionnelle à la capacité maximale. Retirer du brouillon et supprimer de la bibliothèque sont deux actions distinctes.
- Les types, rôles, limites individuelles et budgets partagés viennent des capacités réelles du modèle/mode. Une grammaire commune ne signifie pas que tous les modèles acceptent tout.
- Pictos métier dessinés pour l’app, ou famille de qualité dont la licence est vérifiée. Les commandes essentielles conservent un nom court.
- La génération d’images n’est pas une dépendance du planning : les captures et le code existants sont disponibles ; le prototype est une nouvelle composition, pas un travail de fidélité à la planche Studio.
- Aucun rendu payant, écriture sur compte réel, faux prix, faux statut serveur ou faux montage enregistré pour les essais.
- Les commandes essentielles restent nommées, accessibles au toucher et au clavier. Minimum de 44 × 44 px pour les cibles tactiles isolées.
- Respecter `prefers-reduced-motion`. Le mouvement explique une sélection ou une action ; il ne crée pas de délai obligatoire.
- Pas de nouveau moteur de génération, de nouvel état global ou de nouvelle couche de projets persistés pour obtenir la refonte.

## Feuille de route du produit

| Étape | Résultat attendu | Condition de passage |
|---|---|---|
| Concept global | Carte des usages et langage visuel commun | Création, médias et compte ont chacun une interface adaptée, reliée par une navigation cohérente |
| Prototype | Création vidéo/image/audio, bibliothèque et paramètres manipulables sur ordinateur et mobile | L’utilisateur peut juger les parcours, les menus, les pictos, la densité et le mouvement dans un navigateur |
| Intégration app | Remplacement de la présentation et raccordement aux fonctions réelles, puis extension aux outils, connexions, activité et facturation | Le nouveau concept est retenu ; chaque surface conserve ses fonctionnalités et passe ses contrôles |
| Studio | Blocs, menus, sélection et inspecteur redessinés dans le langage commun | Les comportements du canevas sont clairs sans imposer un graphe à toute l’app |
| Montage MCP minimal | Déposer des clips sélectionnés dans l’ordre sur une nouvelle timeline persistée | Propriété des médias, transaction, idempotence et coexistence avec l’autosave Studio validées |

Les trois premières tâches ci-dessous construisent le prochain livrable. Les étapes d’intégration, Studio et montage feront chacune l’objet d’un plan d’implémentation correspondant au concept retenu et au code disponible, plutôt que de figer maintenant des détails de composants qui pourraient être rejetés.

## Direction recommandée

Une application de création organisée par activités : **Créer · Médias · Outils · Studio**. Compte, préférences, facturation et connexions se trouvent dans un espace personnel cohérent. Les destinations exactes restent celles du produit ; Studio reste soumis à sa disponibilité réelle dans l’app intégrée.

Le créateur principal propose une surface de travail, une sélection de modèle/outils, des références et des commandes contextualisées. La création depuis un texte seul reste directe. Après un rendu, le média et ses variantes prennent leur place dans cette même surface. Aucun canevas ou timeline obligatoire pour générer une image ou une vidéo.

La bibliothèque fonctionne comme un navigateur de médias : sélection claire, recherche, filtres, aperçu et actions sur la sélection. Les paramètres utilisent des préférences structurées et des commandes de type logiciel. On n’impose pas à ces trois usages le même gabarit.

Le langage visuel repose sur une vraie hiérarchie de typographie, des pictos pleins/duotones aux silhouettes reconnaissables, des contrôles différenciés selon leur fonction et des états de sélection affirmés. La référence aux jeux concerne le soin des menus, le focus et les retours visuels ; elle ne justifie ni scores, ni rareté, ni décor de jeu.

## Livrable de revue disponible

Source reproductible : `docs/design/global-app-concept/` (carte d’actions, règles visuelles, prototype, serveur local et revue). `python3 docs/design/global-app-concept/preview.py` prépare la copie servie sous `.superpowers/sdd/global-app-concept/prototype/`, puis ouvre un serveur local sur le port 3025. Les assets existants sont copiés à la préparation, sans duplication de ces originaux dans Git ; les captures restent locales.

Les tâches 1 et 2 sont réalisées. La tâche 3 attend le retour visuel réel de l’utilisateur ; aucun accord sur la nouvelle direction n’est présumé. Voir `docs/design/global-app-concept/review.md` pour les parcours essayés et les limites non démontrées.

## Task 1 — Fixer les usages et la grammaire visuelle

**Files:**
- Create: `.superpowers/sdd/global-app-concept/experience-map.md`
- Create: `.superpowers/sdd/global-app-concept/visual-rules.md`
- Read: `frontend/components/AppSidebar.tsx`, `frontend/components/HeaderBar.tsx`, `frontend/components/header/WorkspaceMobileNav.tsx`
- Read: `frontend/components/Composer.tsx`, `frontend/components/library/AssetLibraryBrowser.tsx`, `frontend/app/(core)/settings/_components/AccountSettingsPanel.tsx`

**Interfaces:** produit une carte `activité → écran → action principale → commandes secondaires → état vide → version mobile`. Cette carte est l’entrée de la tâche 2, sans modification des routes ni des fonctions serveur.

- [x] Décrire les quatre activités et l’espace personnel avec les URLs existantes ; vérifier que chaque destination actuelle conserve un accès.
- [x] Définir le parcours de création depuis texte seul et depuis une référence, puis consultation et réutilisation du résultat.
- [x] Cartographier Ajouter → Bibliothèque / Importer / Créer → retour au brouillon et au rôle d’origine. Préserver instruction, modèle, réglages, ordre et autres références ; Annuler ne modifie rien.
- [x] Définir remplacement atomique, retrait annulable, réorganisation accessible, budget partagé, erreurs par fichier et changement de modèle sans perte silencieuse. Une collection de 50 médias disponibles ne signifie pas 50 entrées autorisées.
- [x] Distinguer couverture MCP existante (liste/import image-vidéo-audio, génération image/vidéo) et contrats à compléter (génération audio autonome, timeline persistée).
- [x] Définir sélection, aperçu, recherche et actions de bibliothèque ; définir apparence, langue, profil et connexions côté compte.
- [x] Définir pour chaque type de contrôle sa forme : navigation, outil, valeur, transport et action principale. Éviter la répétition du même bouton arrondi.
- [x] Fixer une direction commune de typo, pictos, contraste, densité et mouvement ; vérifier qu’elle fonctionne sur les trois usages, y compris leurs états vides.

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
  mediaKind: 'video', // video | image | audio
  drafts: {}, // brouillons distincts conservés par activité
  returnContext: null, // brouillon, rôle et remplacement à retrouver après création d’une référence
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

- [x] Monter la coque et une navigation commune vers les trois écrans ; donner aux destinations de périmètre ultérieur un état explicite dans la revue, sans fausse fonction dans l’app réelle.
- [x] Construire la création vidéo/image/audio : choix de mode et modèle, instruction éditable, choix/remplacement de référence, réglages accessibles, états vide et résultat illustratif.
- [x] Construire les références progressives : Ajouter à vide, vignettes compactes ensuite, résumé +N et gestion dédiée. Première/dernière image, vidéo source et référence audio restent des rôles nommés ; Remplacer et Retirer sont accessibles sans survol.
- [x] Démontrer le détour de création d’une référence et le retour au brouillon initial, y compris annulation ; inclure l’écoute audio et les incompatibilités. Les profils de démonstration restent explicites tant qu’ils ne sont pas reliés au catalogue réel.
- [x] Faire de la sélection du média et de l’ouverture d’un outil des interactions visibles et réversibles. Le bouton de génération du prototype annonce explicitement une simulation locale ; aucun faux rendu serveur.
- [x] Construire la bibliothèque : filtrer/rechercher les données locales, sélectionner un média, ouvrir son aperçu, revenir à la grille et réutiliser sa référence dans le créateur.
- [x] Construire les paramètres : apparence et réduction des mouvements effectives dans le prototype, navigation de préférences, formulaire local de profil avec annulation. Aucune écriture Supabase.
- [x] Ajouter des transitions interrompables sur sélection et ouverture ; leurs versions réduites conservent les mêmes états et annonces.
- [x] Composer réellement les versions mobiles : navigation nommée stable, commandes principales visibles, panneaux explicitement ouvrables et refermables, aucun fonctionnement dépendant du survol.

**Validation navigateur:** à 1440, 390 et 320 px, parcourir `Créer → changer de modèle → choisir une référence → ouvrir les réglages → Bibliothèque → rechercher → aperçu → réutiliser → Paramètres → apparence → retour à Créer`. Ajouter les parcours de création d’une référence image/audio avec retour au brouillon, remplacement, retrait/annulation, limite atteinte et changement de profil sans perte. Vérifier le clavier, Échap, le retour de focus, le scroll et les contrôles en bas d’écran. Les captures seules ne valent pas validation des interactions. Ne pas écrire de tests qui recopient la structure CSS du prototype.

## Task 3 — Faire une revue du concept global

**Files:**
- Create: `.superpowers/sdd/global-app-concept/review.md`
- Create: `.superpowers/sdd/global-app-concept/captures/` pour captures desktop/mobile comparables
- Update: `docs/superpowers/specs/2026-09-07-app-concept-reset.md` avec le retour réel du prochain échange

**Interfaces:** transmet un prototype utilisable et un relevé `retenu / à corriger / non démontré`. Les données et actions simulées sont séparées des capacités existantes dans ce relevé.

- [x] Inspecter les trois écrans comme un ensemble : identité, navigation, pictos, boutons, espacement et densité doivent constituer un langage commun, tout en servant des usages différents.
- [x] Inspecter les états vides, la sélection, les menus ouverts et la variante mobile. Corriger les contrôles coupés, focus perdus ou commandes essentielles masquées.
- [x] Ouvrir le prototype dans Codex et présenter les parcours manipulables. Expliquer brièvement les arbitrages et les limites de simulation.
- [ ] Recueillir le retour sur cette direction globale avant d’investir dans sa généralisation aux composants de production.

## Frontières pour l’intégration suivante

- La coque réutilise le prédicat `isAppExperiencePath` afin de préserver les routes marketing, admin et import privé MCP.
- `AppClient`, `ImageWorkspace` et `AudioWorkspace` gardent leurs frontières ; prix, génération, drafts, références et polling restent dans leurs hooks.
- La bibliothèque réelle garde `useLibraryPageData`, sa recherche serveur, sa pagination et l’isolation par compte.
- Les paramètres réels gardent `useAccountNameForm` et `useThemePreference` ; les connexions reflètent leur état réel.
- La projection des capacités réutilise les schémas d’entrée et `reference-budget.ts`. Les commandes UI et MCP partagent les validations métier ; la génération audio autonome ne se déduit pas du booléen audio d’un modèle vidéo.
- Les retouches de média préservent les rôles thumbnail/preview/original.
- Les vérifications de production comprennent les contrats concernés, les tests comportementaux utiles, lint, types, i18n, build, essais navigateur et chargement comparable.

## Hors du premier prototype

Réécriture du backend, nouveaux modèles, changement de tarification, assistant autonome, éditeur complet et montage avancé. Le montage MCP minimal reste un lot borné : ordre des clips et insertion dans une nouvelle timeline, avec le travail de persistance nécessaire avant toute promesse dans l’UI.

## Self-review

- Périmètre global couvert par création, bibliothèque et paramètres ; outils/connexions/activité/facturation explicitement dans la généralisation.
- Studio séparé de la conception générale ; timeline non imposée au créateur.
- Prototype vérifiable avant intégration coûteuse ; qualité visuelle évaluée séparément de la qualification technique du premier lot.
- Branche et acquis fonctionnels préservés ; aucune nouvelle demande d’autorisation d’exécution ou de choix d’outil nécessaire pour ce plan.
