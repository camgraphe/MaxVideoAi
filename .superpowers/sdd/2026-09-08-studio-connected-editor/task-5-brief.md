# Task 5 — Clarté finale, qualification et remise

Le plan versionné `docs/superpowers/plans/2026-09-08-studio-connected-editor.md` et ses contraintes globales restent la spécification. Commencer après qualification des Tasks 3 et 4. Un seul implémenteur produit à la fois ; revue et QA indépendantes peuvent travailler en parallèle.

## Périmètre du dernier polish

Lire `.superpowers/studio-audits/studio-final-clarity-audit.md`, les règles du prototype accepté dans `docs/design/global-app-concept/`, puis les captures fraîches du parent :

- `.superpowers/studio-visuals/pre-polish-mobile-light.png` : 390×844.
- `.superpowers/studio-visuals/pre-polish-desktop-light.png` : 1440×900, après Fit canvas et fermeture de la map.

Le projet local `project_7ea7aba4-60db-4380-9025-105a3db20939` est un starter minimal à deux blocs, Seedance 2.0, mode Mock. Aucun fournisseur appelé. Après recadrage, le titre du bloc passe sous la bande de sélection et sa sortie sous la barre de création. Sur mobile, la carte trop longue est miniaturisée et la timeline n'entre pas entièrement dans l'écran. Corriger cette lisibilité, sans nouvelle architecture de menus ni refonte globale de l'app.

### Cartes et connexions

1. Projection pure des entrées visibles : requises OU connectées ; métadonnées incomplètes => conserver visible par prudence.
2. Tous les IDs, handles React Flow, slots, budgets et arêtes sont conservés. Les ancres optionnelles vides gardent une géométrie non nulle, compacte et non interactive ; jamais de `display:none` supprimant leur géométrie.
3. Une commande Connections persistante expose les options vides et la capacité actuelle. Préciser « restant / maximum », sans recalculer une limite combinée. Inspecteur exhaustif et validateur métier inchangés.
4. Actualiser les internals après déplacement des handles. Vérifier l'aboutissement des arêtes et les cas début/fin, collections, audio, port plein et connexion devenue incompatible.
5. Après retrait du dernier lien, si son déclencheur disparaît, rendre le focus à Connections sur la même carte, puis au canevas si le bloc a été supprimé. Aucun accès uniquement au drag ou au hover.

### Recadrage et surface utile

Le fit doit employer la surface réellement libre, hors commandes flottantes et panneaux ouverts. Réutiliser une règle commune pour le fit initial des nouveaux projets et Fit canvas explicite, actuellement dans `WorkspaceCanvas.client.tsx` et `canvas/CanvasMap.tsx`. Ne pas écraser un viewport enregistré à chaque édition.

Après fit desktop/mobile/paysage, aucun bouton essentiel n'est sous un overlay. L'inspecteur et Connections à taille écran restent les alternatives tactiles/clavier aux petites commandes zoomées. Garder accès à la timeline et à l'audio ; pas de masquage définitif pour faire passer une capture.

### Projects et copie

- Projects : titre et une phrase de résultat par starter ; retirer la chaîne de workflow redondante et le texte générique. Préserver aperçus, récents, sauvegarde, notice globale avant génération et transfert médias de Task 3. Ne pas réinventer les handlers.
- Copy : erreur associée à la sélection actuelle, effacée à la réouverture d'Actions et au changement/vidage de sélection. Un échec tardif pour A ne doit pas polluer B ni écraser une nouvelle copie réussie. Promesse rejetée => message réel. Tester la durée de vie React avec promesses contrôlées.
- Annuler média : le bouton actuel du chutier (`TimelineProjectSidebar.tsx`) est affiché actif dès qu’un callback existe, même avec `mediaHistory` vide dans `useWorkspaceProjectMediaActions.ts`. Exposer la disponibilité réelle de cette histoire et désactiver l’action sans entrée ; la rendre active après une vraie modification puis inactive après son annulation. Hydratation et renouvellement privé ne constituent pas une action utilisateur annulable. Conserver les opérations et la portée compte/projet existantes.

## Vérification du polish

Adapter les anciens tests qui exigeaient toutes les options vides sur la carte : désormais option disponible dans Connections, puis visible après liaison. Ne pas supprimer les contrôles de capacité. L'ancienne assertion Générer ≤38px vers `editor-smoke:4055` contredit la cible de 44px : mesurer la densité sans rapetisser l'action.

Conserver matrices modèles, payloads et prix, ainsi que Undo, Copy, connexions, Escape et les douze E2E revus. Comparer le même graphe, modèle et état ; vérifier EN/FR/ES, clair/sombre, reduced motion et 1440×900, 390×844, 320×844, 844×390. L'absence de recouvrement se prouve par géométrie DOM et captures réelles, pas seulement `toBeVisible`.

Le test racine `tests/e2e/editor/editor-canvas-clarity.spec.ts` est désormais disponible : 24 combinaisons locales/thèmes/viewports, même starter minimal sélectionné, fit réel puis fermeture de la map, géométrie du titre/Générer/réglages comparée au canevas et aux HUD. RED confirmé sur desktop EN clair, portrait FR sombre et paysage ES sombre ; captures et traces dans `.superpowers/studio-clarity-matrix-red/`. Les titres et réglages passent réellement sous la barre de sélection. Ne pas supprimer l'assertion ou la remplacer par `toBeVisible` : le polish doit la rendre verte. La racine garde l'ownership de ce test pour une qualification indépendante.

Observation de densité supplémentaire : le même accès Réglages est répété dans le HUD, l'icône d'en-tête et une ligne pleine largeur du bloc. Éliminer la redondance visuelle seulement si les accès au clavier/toucher restent explicites et testés. Un port déjà lié ouvre la gestion des connexions : son libellé doit refléter cette action, pas suggérer une entrée vide. Préserver le validateur et les possibilités de changement/retrait.

## Lecture et performance : périmètre borné

Ne pas étendre automatiquement vers un nouveau moteur de lecture fenêtré. La dette des 150 lecteurs préchargés peut rester explicitement documentée si elle est inchangée ; ne pas revendiquer de gain CWV.

Si une régression confirmée exige de toucher ce moteur, convenir d'un lot borné avec le parent et lire `studio-playback-window-audit.md` : ownership audio global, nettoyage des refs détachées, transitions, scrub et lecture conservés.

Le test `editor-media-decoding.spec.ts`, revu à `e1c1e1848`, vérifie des frames réellement décodées, le RMS audio et un nouveau callback après seek. Le test de stress historique mesure seulement horloge et gestes. Ne pas confondre leurs preuves.

### Première présentation du montage connecté

Le navigateur privé réel a révélé un défaut de première présentation : la fixture320×180 n’occupe qu’une petite vignette au centre du programme1080p, puisque la commande reprend le `scale:1` historique. Ce n’est pas une régression de décodage. Examiner le helper existant de composition/Fit et initialiser les seuls NOUVEAUX montages connectés avec un ajustement conservant le ratio et l’image entière, commun à UI et MCP. Ne pas modifier les transforms des projets enregistrés ni la sémantique générale des insertions historiques. Si les dimensions mesurées manquent, conserver le fallback existant explicite ; aucune mesure/probe distante implicite. Ajouter un test pur de cette initialisation et une vérification de géométrie réelle du programme, tout en conservant les assertions de lecture native.

## Qualification complète adaptée

- Ciblés, puis TypeScript, lint, exposure, registre, suites Studio et contrats MCP.
- PostgreSQL 17 jetable vérifié, auth locale signée, idempotence/CAS, réouverture sans cache et accès privé pour Task 4.
- E2E pertinents et build assaini sur snapshot isolé, jamais avec environnement hérité.
- Un seul travail lourd de build/benchmark à la fois. Ne pas toucher le preview3032, l'app3026, le baseline3034/3035 ou le processus tiers3036.
- Revue indépendante du lot complet, correction des findings bloquants et documentation des limites exactes.

Les preuves antérieures ne remplacent pas cette qualification : Task2 et composition `eb791a266` revues ; MCP21/21 avant Task4 ; QA lecture3unit+1E2E. Les six échecs globaux observés pendant Task3 ne peuvent être déclarés résolus qu'après un nouveau run.

## Remise

Conserver branche et preview, sans push, déploiement, fusion ni génération payante. Livrer la chaîne exacte de commits séparant interfaces partagées et propriétaires Studio, sans le merge de composition `3bb6188e0`. Mettre à jour les états « en cours » des documents selon les preuves finales.

Toutes les interfaces Audio/Toolbox/Billing/MCP Audio passent par la tâche principale `01a07920-6fc3-7131-911d-321ce840ffdd`. Les anciens commits restent dans Git, leurs anciennes worktrees sont archivées. Pas d'import global sans audit.

Conserver comme réserves réelles : Live Chat sans contrat tarifaire, tarification export1440p à arbitrer et worker/stockage de production non qualifiés. La tranche montage crée un projet, pas un MP4 exporté.
