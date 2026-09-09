# Studio connecté — lot terminé, à valider avant intégration

Les cinq tâches du plan sont réalisées et vérifiées. Branche conservée :
`codex/studio-connected-editor`, worktree
`/Users/adrienmillot/.codex/worktrees/dce6/MaxVideoAi V2`.
Produit final : `4a119520ac3b2ad5529890bae932599ad9651737`.
Les commits suivants ne contiennent que preuves et documentation de remise.
Revue produit indépendante Sol high : **Approved**, aucun finding ouvert.
Cela ne constitue pas une autorisation de lancement en production.

> Complément après revue visuelle utilisateur : le lot compact postérieur au
> produit ci-dessous est documenté dans
> `docs/engineering/studio-feedback-refinement-review.md`. Il ne réécrit pas les
> preuves historiques de ce manifeste.

## Ce qui fonctionne

- Canevas et blocs refondus, sélection lisible, menus bornés, inspecteur explicite,
  création par clic/clavier/toucher, connexions sans drag obligatoire et annulation.
  Les ports optionnels restent disponibles dans Connexions ; IDs, poignées,
  capacités et budgets canoniques sont conservés. Réglages reste accessible depuis
  le bloc, la sélection et le raccourci I, sans rangée redondante.
- Projets allégé, descriptions de résultat EN/FR/ES, palette locale cohérente avec
  l’app, thèmes réels clair/sombre et réduction des mouvements. Les actions legacy
  sont préservées ; les commandes indisponibles des projets connectés sont
  désactivées et expliquées, pas présentées comme fonctionnelles.
- Bibliothèque et récents image/vidéo/audio vers projet, canevas et timeline selon
  compatibilité. Références canoniques et originaux exacts, remplacement, retrait,
  annulation et sauvegarde/rechargement vérifiés. Annuler n’est actif qu’avec une
  vraie modification dans le compte/projet courant.
- `create_studio_montage` et le dialogue UI utilisent la même commande métier :
  nouveau projet et séquence persistés, ordre explicite, 2–12 vidéos appartenant
  au compte, validation, reçu idempotent et lien Studio ouvrable après commit SQL.
  Autosave avec révision/CAS, conflits et brouillons conservés, sortie soumise à
  un vrai ACK, purge au changement de compte et renouvellement des accès privés.
  Les nouveaux montages sont ajustés au cadre selon les dimensions mesurées,
  sans modifier les transformations des projets déjà enregistrés.
- Catalogue, certification historique, familles, prix avant génération et faits
  communs devis/soumission restent les propriétaires existants. Pas de second
  catalogue ou de moteur de montage autonome ajouté.

## Prévisualiser

Prévisualisation principale déjà lancée :
[Studio local](http://127.0.0.1:3032/app/studio/projects), auth anonyme locale3033.
Copie immuable finale également disponible sur
[Studio figé](http://127.0.0.1:3040/app/studio/projects), auth anonyme3041,
dans `/private/tmp/studio-ui-qa.p6hTSn`.

Ces aperçus utilisent des **brouillons locaux**, pas une base serveur ou un compte
de production. Wallet indisponible, synchronisation, upload serveur et génération
Live ne sont donc pas qualifiés par ce lien. La persistance authentifiée est
prouvée séparément par les fixtures locales PostgreSQL/Auth/octet privé ci-dessous.
Le port3026, les sources app/éditeur et le processus tiers3036 n’ont pas été touchés.

Si le preview principal est arrêté, depuis la worktree, sans fichier `.env` :

```sh
pnpm dlx node@22 scripts/studio-local-preview.mjs --port=3032
```

Le lanceur refuse les fichiers d’environnement et ne transmet aucune configuration
DB, fournisseur, paiement ou stockage. Ne pas lancer une seconde instance sur un
port déjà occupé. Commencer par un projet vierge, puis Réglages/Connexions et
Visionneuse pour vérifier les accès ; le mode Simulation ne lance pas de fournisseur.

## Qualification finale

| Contrôle | Résultat |
| --- | --- |
| Studio, export, contrats, DOM, PostgreSQL jetable | 496/496, aucun skip,24,65s |
| MCP modifié et ancien montage préparatoire | 87/87, aucun skip,12,36s |
| E2E sur produit immuable4a | 80/80 :74 parcours +6 smokes modèles/Projets |
| Géométrie incluse dans ces E2E | 36 cas EN/FR/ES, clair/sombre, six viewports +5 menus ouverts |
| HTTP montage réel UI/MCP | 2/2, aucun skip,23,47s |
| Navigateur connecté, SQL/Auth/accès privé réels | 7/7, aucun skip,64,60s sur4a |
| Stress80 blocs/150 items | 3/3 avant +3/3 après, mêmes fixtures |
| Build final isolé | prébuild, build, lint/types,867/867 pages et postbuild réussis |
| Registre/catalogue, exposition publique, whitespace | réussis |

Les six viewports sont1440×900,390×844,320×844,844×390,667×375 et621×375.
Le navigateur vérifie toute la carte, ses sorties, les collisions et les hit-tests
des commandes à taille écran ; les petits blocs du graphe mobile sont une vue
d’ensemble, pas une prétendue cible tactile44px. Les commandes et l’inspecteur
non zoomés fournissent l’alternative tactile/clavier.

La preuve connectée inclut les douze occurrences dans le dialogue mobile avec
une seule zone de défilement, dernier trim et submit atteignables, puis une vraie
création ordonnée B/A avec réponse perdue/rejeu unique et réouverture sans cache.
Elle contrôle frames natives, AAC, seek, signature renouvelée après403, ownership,
conflit409 conservé sur deux réouvertures, échec503 et vrai ACK avant sortie.
Le serveur sans migration42 renvoie une indisponibilité sans appliquer de DDL.
Les2 tests HTTP sont le décompte exact du dernier fichier rejoué ; ne pas les
confondre avec les agrégats historiques de plusieurs fixtures HTTP.

PostgreSQL17 est créé pour chaque test dans un répertoire unique, vérifié par
version et chemins data/socket avant écriture, socket-only, puis arrêté/nettoyé.
`LC_ALL=C` évite le défaut de démarrage macOS observé précédemment. Aucune URL
Neon ou distante héritée n’est utilisée. Les identités, signatures et octets
privés des tests sont locaux et jetables, pas des identifiants de production.

Build : `/private/tmp/studio-build.HTFEnx`, Git archive de4a, Node22,
environnement allowlist sans secrets. Deux avertissements exhaustive-deps hérités
restent dans WorkspaceAssetLibraryBrowser et WorkspaceRuntimeModals, ainsi que
l’avertissement Edge du SDK Supabase installé. Aucun échec de lint/type.

Preuves détaillées et chronologie des corrections :
[Task5](studio-task5-integration-review.md),
[persistance Task4](studio-task4-integration-review.md).
Captures finales : `output/playwright/studio-final-4a1195/` ; scènes privées et
dialogue12 clips : `output/playwright/studio-connected/`.
Les rapports locaux et captures sont conservés dans la worktree ; les tests
versionnés permettent de les reproduire.

## Performance et limites explicites

Les mesures ne montrent pas un gain uniforme : médiane drag224→268ms,
zoom70→86ms, pan420→176ms, sur trois passages Next dev comparables.
Les150 lecteurs préchargés demeurent ; aucun gain de chargement initial/CWV
ou de performance en production n’est revendiqué. Les chiffres et plages bruts
sont documentés dans le rapport Task5. Les captures seules ne prouvent rien ici.

- `studioMontageCreation` reste **false par défaut**. Son override local est borné
  aux conditions non-production/loopback. `prepare_montage` reste désactivé par
  défaut, read-only et `persisted:false` ; ce n’est pas un projet enregistré.
- La tranche produit crée une timeline persistée, pas un MP4 rendu. Worker,
  stockage et acquisition/auth complète de production ne sont pas qualifiés.
- Export1440p : politique tarifaire héritée à arbitrer ; concurrence financière
  export/autres créateurs non qualifiée. Aucun export payant ou débit exécuté.
- Live Chat demeure fermé sans contrat tarifaire ; sa simulation locale est testée.
- Audio existant visible et conservé, sans montage audio avancé ajouté. Aucun test
  ne prétend qualifier tous codecs/navigateurs ou la sortie d’un haut-parleur physique.
- Les quatre suites historiques de propriétaires globaux explicitement exclues
  pendant composition ne sont pas réintroduites sous une fausse qualification.
  Leurs19 échecs initiaux restent décrits dans `studio-import/interfaces.md`.

## Intégration à valider par les propriétaires

[Manifeste exact137 commits](studio-import/integration-order.json), ordre
first-parent depuisab2cb9fbd jusqu’au produit4a, SHAs complets et décisions.
Les commits de preuve/remise après4a sont documentation-only et se trouvent dans
`git log --first-parent 4a119520a..codex/studio-connected-editor`.
Ne pas exécuter un cherry-pick global sans traiter les interfaces partagées.

- **Ne pas rejouer** le merge de composition3bb6188e0.
- **SKIP équivalents app** :8a74ab753↔1830bf652,4c986b84e↔f55401ad7 ;
  746a0cf49↔9c9bc9ea4 seulement si rencontré hors de cet historique.
- Pré-requis MCP partagé :1c41f3d16→cdb716027→c774f6a6e, gatesfalse et lecteurs
  de publication cohérents. Composer avec le propriétaire MCP Audio, sans activation.
- Pré-requis serveur :20a181c35→87919e9d7→1c9eafa92→7cf6a5b57→de02e5825 et
  `neon/migrations/42_studio_connected_montages.sql`.20a est le commit mixte
  conservé25 fichiers writer+4 QA, pas un commit serveur pur ; sa provenance est tracée.
- b736bd6b8 est un bundle partagé24 chemins : résolution par propriétaires,
  pas remplacement des fichiers app actuels. SFX652a32ef0 et Toolbox431d69775 restent
  également à rapprocher des propriétaires Audio/Toolbox/Billing actuels.
- Les clés de traduction Studio dans les fichiers messages partagés doivent être
  prises par hunks, pas par remplacement global. Ne pas écraser Activity, les
  créateurs hors Studio, les propriétaires bibliothèque/réutilisation ou CSS app.

### Hotspots Audio / Studio à résoudre par hunks

| Contrat | Fichiers partagés sensibles | Règle d’intégration |
| --- | --- | --- |
| SFX autonome652a32ef0 | `frontend/src/lib/audio-generation.ts`, `frontend/src/server/audio/{audio-generate-validation,generate-audio}.ts`, `providers/sound-design.ts`, hooks/helpers de `/app/audio` | Garder les propriétaires Audio actuels ; reprendre uniquement `sfx_only`, endpoint exact et tarif canonique, sans remplacer leur nouvelle UI. |
| Faits média00c0cfa3b | `frontend/server/media/detect-has-audio.ts`, `frontend/src/server/uploads/store-media-upload.ts` | Préserver le probe déjà effectué et sa présence audio mesurée ; aucun second probe ou faux défaut. |
| Identité/transfert4c986b84e,cf525e7df,9d7bb92d4 | Contrats média, transfert compte/projet et validateur URL partagé | SKIP l’équivalent4c déjà intégré ; garder IDs canoniques, tuples job/output et original exact. |
| MCP1c41f3d16,cdb716027,c774f6a6e | `frontend/config/mcp-publication.json`, `frontend/src/server/mcp/{server,http-handler,instructions,tool-input-schemas}.ts`, preflight et preuves de publication | Composer les capacités Studio et MCP Audio, conserver toutes les clés attendues et les gates désactivés. |
| Toolbox431d69775 / bundleb736bd6b8 | Contrats Toolbox, stockage, wallet, authFetch, navigation, messages, dépendances | Reprendre les interfaces additives seulement ; ne pas restaurer d’anciens propriétaires app, Audio ou Billing. |

Le manifeste contient les SHAs complets et l’ordre exhaustif. Ces hotspots ne sont
pas un nouvel ordre alternatif ni une autorisation de remplacer ces fichiers.

Provenance : app qualifiéeef3393c0d, ancien éditeur6165afc34 et ses32 fichiers
suivis+2 nouveaux dans les trois manifestes `studio-import/`. Les34 SHA-256 et
le HEAD source ont été revérifiés inchangés. Aucun reset/commit de source, push,
fusion d’intégration, déploiement, appel payant ou écriture en production.
