# Task 2 — Studio connecté, interface et actions

## Livraison

- Worktree unique : `/Users/adrienmillot/.codex/worktrees/dce6/MaxVideoAi V2`.
- Branche : `codex/studio-connected-editor`.
- Socle visuel qualifié avant travail : `332bf4abf` ; HEAD précédant le commit d'implémentation : `e9259e41d` (inclut les commits de qualification du parent).
- Implémentation et guide d'architecture : `0fe59592c` — 54 fichiers, 877 insertions / 369 suppressions.
- Les fixtures performance, readiness e2e et PostgreSQL du parent ont été commitées séparément par leur propriétaire et ne sont pas incluses dans ce commit.

## Changements effectifs et propriétaires

- `WorkspaceEditorTopbar`, `WorkspaceEditorLayout`, styles `shell` : surfaces mates claires/sombres, contraste safran de sélection, un titre projet, accès Projects, Canevas/Viewer et contrôles de session conservés ; styles limités à Studio, police et logo existants.
- `CanvasFloatingToolbar`, `WorkspaceCanvas.client`, `useCanvasController` : création nommée clic/tap/Enter en une activation au centre visible ; drag conserve son point de dépôt. Suppression du mode fantôme nécessitant un second clic. Menus courts, sans métadonnées décoratives répétitives.
- Nouveaux `CanvasSelectionActions` / `CanvasConnectionPicker` et `workspace-canvas-actions` : bande à taille écran, Settings/Connections directs, Copy/Delete/Replace/Insert dans Actions. Les sources compatibles proviennent des vrais handles et du même validateur ; connect et disconnect empruntent les callbacks canoniques. Retrait annulable sans suppression de source et restauration du focus après une action qui retire son bouton.
- `useWorkspaceSelectionActions`, `useWorkspaceMobilePanels`, `WorkspaceMobilePanelFrame`, `NodeSettingsPanel` : inspection explicitement ouverte, indépendante de la sélection ; fermeture desktop et mobile sans désélection, retour au launcher. Sur mobile, Settings ouvre immédiatement le drawer au lieu de seulement révéler le bouton Inspector.
- `CanvasMap` / `CanvasGuideLayer` : plan replié par défaut à 600px et moins, zoom accessible ; cadrage initial lisible, repères compacts par défaut et explications développées sur action explicite, sans supprimer ni réécrire les guides enregistrés. Mouvements programmatiques et CSS respectent reduced motion.
- Shot cards et `ShotNodeInspector` : paramètres communs lisibles, paramètres avancés conservés dans l'inspecteur issu de la policy existante, aucun catalogue ou contrôle certifié supprimé.
- `useWorkspaceShotPricing`, `workspace-pricing`, `useWorkspaceGenerationActions` : ancienne somme retirée dès changement de clé de devis ; génération Live bloquée sans devis courant prêt, y compris dans le callback et pas seulement dans le bouton. Mode Mock affiché Simulation, autorisé sans devis Live mais avec validation modèle/opérationnelle/inputs inchangée. `workspace-generation` ne transforme plus une erreur Live en mock en développement.
- `workspace-node-media-preview` et `NodeInspectorMediaPreview` : montage du lecteur vidéo/audio natif après intention explicite seulement ; `preload="none"`, URLs originales conservées. Les images, médias manquants et sources audio indisponibles n'exposent pas de faux Play.
- Timeline toolbar/track/context menu : boutons nommés accessibles sans clic droit, callbacks de pistes et link/unlink existants, cibles 44px, navigation clavier, popovers bornés en hauteur.
- Copie EN/FR/ES : Start frame / End frame / References ; Image de début / Image de fin / Références ; Imagen inicial / Imagen final / Referencias. Rôles particuliers, IDs et slots inchangés.
- `docs/engineering/studio-editor-architecture.md` documente ces responsabilités. Contrats tests mis à jour pour les responsabilités nouvelles, sans relever les limites de taille existantes.

## Preuves

TDD ciblé : module de commandes absent puis tests verts ; devis loading conservant erronément 100 cents observé puis corrigé ; Mock refusé sans devis observé puis distingué explicitement ; erreur Live en dev retournant un faux succès reproduite (« Missing expected rejection »), puis suppression du fallback et test vert. RED Playwright création observé par le parent ; RED mobile Settings présent mais hidden pendant 5s observé avant correction du drawer.

Vérification finale de l'implémentation :

- `pnpm dlx node@22 frontend/node_modules/tsx/dist/cli.mjs --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-*.test.ts tests/studio-*.test.ts tests/timeline-export-*.test.ts` : **397/397 passent**.
- TypeScript frontend, `--noEmit -p frontend/tsconfig.json` sous Node22 : **0 erreur**, code retour 0.
- `npm --prefix frontend run lint` : **0 erreur**, 2 avertissements préexistants (dependencies des effets de `WorkspaceAssetLibraryBrowser` et `WorkspaceRuntimeModals`, non modifiés).
- `npm run lint:exposure` et `git diff --check` : passent.
- `tests/studio-canvas-actions.test.ts` : 7 tests, dont appels réels au service local Mock et au callback React Live sans devis, avec fetch intercepté, aucune requête payante.
- Parent : `editor-connected-actions.spec.ts` **4/4 GREEN** : création Enter unique et fermeture/focus, piste sans clic droit, Settings mobile immédiat avec conservation de sélection, connexion non-drag/disconnect/undo sans suppression de source.
- Parent : inspection réelle desktop plus lisible, menu vidéo court nommé ; panneau mobile 390px lisible et menu sombre 320px lisible après corrections. Capture confirmée : `.superpowers/studio-visuals/after-mobile-inspector-light.png`. Les autres captures et contrôles navigateur restent sous responsabilité du parent.
- Journaux locaux : `.superpowers/studio-visuals/task2-{tests,typecheck,lint,exposure}.log`.

## Bornes et suites

- Aucun provider payé, secret, DB, endpoint nouveau ou changement global Activity/Billing. Pas d'implémentation Task3 (adaptateurs média Toolbox) ni Task4 (MCP/persistence). Toolbox et certification restent dans leurs propriétaires importés.
- Seuls les lecteurs de **cards** et de **l'inspecteur** ont changé. `ProgramPlaybackLayers` et `useProgramPlaybackSync` n'ont pas été modifiés : le chargement initial des nombreuses couches timeline est une dette distincte, à traiter avec preuves audio/scrub. Aucun gain de performance n'est revendiqué ici. Le parent mesure BEFORE/AFTER comparable ; les captures ne sont pas une mesure de performance.
- Les 3 URLs historiques de démonstration absentes n'ont pas été réécrites, pour ne pas inventer une identité source ni des métadonnées. Une réparation future doit rester explicite et s'appuyer sur un mapping local audité.
- Les tests ne prouvent pas une génération provider réelle, toutes les combinaisons modèle/paramètres en navigateur, ni l'ensemble des matrices appareil/thème. Les contrats automatisés couvrent le catalogue existant et les gestes principaux ; la revue indépendante et la matrice visuelle finale appartiennent au parent.
- Mesure stress AFTER du parent : 150 requêtes média initiales inchangées, 178 requêtes totales contre 203 BEFORE ; Play 291ms, scrub 49ms, drag 326ms, zoom 98ms, pan 161ms. Un seul passage développement, pas une qualification CWV ni une démonstration causale de gain.
- TDD a guidé les commandes et régressions comportementales ; le guide d'architecture/contrats a conservé les propriétaires existants et évité un second catalogue ou moteur de validation.

## Revue corrective — historique, focus et Copy

Revue de `603f45a4b`, correctif séparé après la qualification responsive parent `8cf596d54`. Aucun fichier de qualification responsive ou d'auth du parent n'est inclus dans ce correctif.

- `WorkspaceCanvas.client.tsx` réactive le canevas depuis les deux entrées Connections (bande et lanceur de port), ainsi que Copy. Les chemins adjacents Settings, Delete et Replace activaient déjà le canevas ; Insert vise intentionnellement la timeline.
- `workspace-shot-input-dock.tsx` porte désormais `aria-disabled` sur la poignée d'ajout seulement, pas sur toute la ligne : un slot plein peut ouvrir sa gestion et être déconnecté. `isConnectable` et le validateur d'ajout restent inchangés.
- `workspace-node-media-preview.tsx` transfère le focus au lecteur natif vidéo/audio lors de son montage, via une ref stable et `tabIndex=0`. Modifier ensuite un autre champ ne lui reprend pas le focus. Aucun changement aux URLs, aux adaptateurs média, aux requêtes provider ni aux couches timeline.
- Copy conserve le snapshot canonique et écrit le marqueur texte déjà compris par le paste canonique. En cas de refus ou d'absence de Clipboard API, le repli natif `execCommand('copy')` utilise un champ éphémère retiré immédiatement, avec restauration du focus. Si les deux moyens échouent, une alerte ponctuelle localisée invite au raccourci clavier ; aucun faux succès n'est annoncé.

RED constatés dans les composants réels : Undo laisse zéro lien au lieu d'un après sélection/mouvement d'un clip ; les lecteurs vidéo/audio restent inactifs pour le focus ; Copy garde quatre blocs au lieu de cinq après paste ; aucun message d'échec de copie quand les deux APIs sont bloquées. Les tests de menu attendent sa fermeture effective avant le raccourci, sans sommeil arbitraire.

Vérification finale du correctif :

```sh
PLAYWRIGHT_EDITOR_BASE_URL=http://127.0.0.1:3032 PLAYWRIGHT_EDITOR_SKIP_WEB_SERVER=1 pnpm dlx node@22 node_modules/@playwright/test/cli.js test -c playwright.editor.config.ts editor-review-regressions.spec.ts editor-connected-actions.spec.ts --output=.superpowers/studio-visuals/review-results
pnpm dlx node@22 frontend/node_modules/tsx/dist/cli.mjs --tsconfig frontend/tsconfig.json --test tests/maxvideoai-editor-*.test.ts tests/studio-*.test.ts tests/timeline-export-*.test.ts
pnpm dlx node@22 frontend/node_modules/typescript/bin/tsc --noEmit -p frontend/tsconfig.json
npm --prefix frontend run lint
git diff --check
```

Résultats : **12/12 e2e**, **397/397 tests Studio**, **TypeScript 0 erreur**, lint **0 erreur / 2 avertissements préexistants** et diff-check propre. E2E couvre les deux lanceurs Connections après un vrai mouvement/sélection timeline, Undo sans modification de la timeline, Copy avec API disponible/refusée/absente et double refus, puis focus vidéo/audio y compris après rerender. Logs : `.superpowers/studio-visuals/task2-review-{red,red-corrected,clipboard-red,green,unit,typecheck,lint}.log` ; artefacts finaux isolés dans `review-results`. Qualification Chromium sur le serveur existant 3032, aucun nouveau serveur ou DB.

Allègement visuel proposé, **non implémenté dans ce correctif** : garder les entrées obligatoires et connectées visibles sur la carte ; déplacer les entrées optionnelles vides et leurs compteurs dans Connections, sans supprimer rôles/handles/slots/capacités ni changer la validation. Vérifier ensuite l'accès tactile/clavier à tous les ports et la hauteur des cartes. Le constat du parent sur les répétitions et compteurs n'est pas présenté comme résolu ici.
