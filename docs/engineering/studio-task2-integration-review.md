# Studio — socle et interactions séparables du raccord médias

Document historique Task2. Pour l’état complet actuel, les137 commits et les
limites Tasks1–5, consulter [la remise finale](studio-connected-editor-final-review.md).

Remise à la tâche coordinatrice le 8 septembre 2026. Branche source de revue : `codex/studio-connected-editor`. Ce document ne demande ni push ni déploiement. Le runtime médias Task 3 et le montage persisté Task 4 ne sont pas inclus dans cette qualification.

## Ordre des changements

Si le Studio composé n'existe pas encore dans la branche d'intégration, la refonte Task 2 ne peut pas être cherry-pickée seule. Son socle nécessite les propriétaires Studio historiques et les interfaces actuelles adaptées.

| Ordre | Commit | Contenu / décision d'intégration |
| --- | --- | --- |
| 1 | `2975d7e3a` | Import exact des propriétaires Studio, API, export, tests et assets depuis `6165afc34`. |
| 2 | `11dc9213b` | Travaux locaux historiques tracés : certification, connecteurs typés, faits partagés devis/soumission. |
| 3 | `b736bd6b8` | Interfaces communes additives, dépendances, localisation `workspace.studio`, accès/nav Studio, storage/export. Revoir les conflits auprès des propriétaires actuels ; ne pas remplacer leurs évolutions. |
| 4 | `652a32ef0` | SFX standalone MMAudio. **Ne pas appliquer une seconde fois** si le lot Audio a déjà repris son équivalent `13dfec189` ou un descendant qualifié ; vérifier la compatibilité des appels Studio. |
| 5 | `8e98acf4d` | Préflight Studio vers les inputs possédés actuels, SFX et contrats. Retrait explicite de quatre suites globales nouvellement importées qui dépendaient de réécritures historiques hors périmètre. |
| 6 | `74a556b94`, `e101e2840` | Imports React de tests sous Node 22 et référence JPG du starter, avec provenance. |
| 7 | `431d69775` | Contrat Toolbox équivalent à `faf137284` ; ne pas dupliquer si déjà présent. |
| 8 | `e9259e41d` | Readiness E2E fondée sur Projects, plus sur le titre produit retiré. |
| 9 | `0fe59592c` | Refonte appliquée : shell local, création en une activation, sélection, connexions, inspecteur, timeline, lecteurs sur intention, garde du devis Live. |
| 10 | `603f45a4b` | Guides compacts par défaut, sans migration des projets existants. |
| 11 | `957c593b6` | Correctif revu : portée d'Annuler, gestion d'un port plein, focus des lecteurs et Copy réel avec refus explicite. |
| 12 | `8cf596d54` | Qualification responsive des actions : huit combinaisons viewport/thème. |
| 13 | `eb791a266` | Correctifs de composition revus : Mock Chat local, Live Chat fermé sans contrat tarifaire, dimensions 1440p réelles et identité export par compte/clé exacte avec rejeu historique. |

Le merge de composition `3bb6188e0` est propre à cette branche (app fixe `ef3393c0d` + main `ab2cb9fbd`). Il n'est pas une instruction de fusion dans la branche app. Les manifestes `docs/engineering/studio-import/` décrivent les importations et exclusions ; aucune source n'a été modifiée.

## Interfaces médias déjà reprises par la tâche principale

Coordination confirmée le 8 septembre : ne pas réappliquer `8a74ab753` (contrat), `4c986b84e` (uploads/refs/faits) ni l'adaptation Audio `746a0cf49`. Leurs équivalents sont déjà intégrés à la racine dans `1830bf652`, `f55401ad7`, `9c9bc9ea4`. Les changements ultérieurs Studio restent à présenter séparément, notamment `cf525e7df` (transfert compte/projet) et `9d7bb92d4` (validateur URL existant exporté). Le runtime médias n'est pas qualifié par ces seules interfaces.

Documentation et QA auxiliaires, à prendre selon besoin : `998a8e611` (lanceur de preview sans secrets), `332bf4abf` (limite export 512 MiB), `8288609e7` (fixture performance corrigée), `2d566c4d3` (rapport Task 2), `9c5aef823` (mesures avant/après). Le rapport de correctif figure aussi dans `957c593b6`. `8a74ab753` reste le **contrat additif médias**, séparé de tout runtime futur. Les tests DB/auth `df7031c60`, `b9d392faa`, `dcb8eaa4b` préparent les tâches suivantes ; ils ne prouvent pas encore un montage persisté.

## Revue et preuves

Socle `e101e2840` : 413 tests ciblés, QA Studio 388 tests + TypeScript + lint ; revue indépendante approuvée, 83 tests ciblés supplémentaires. Source dirty conservée et hashée (32 fichiers suivis, deux nouveaux).

Task 2 finale `957c593b6` : 397 tests Studio, 12 E2E, TypeScript sans erreur, lint sans erreur/deux warnings hérités, diff-check propre. Revue initiale : deux problèmes concrets (Undo visant timeline après Connections ; focus perdu après Play/Listen). Revue corrective : les deux corrigés, aucun nouveau Critical/Important. Mineur restant : effacer l'alerte Copy à la réouverture d'Actions pour éviter un message périmé.

Revue de composition `eb791a266` : trois findings hérités corrigés, revue indépendante **Approved**, aucun Critical/Important. 93 tests ciblés, un E2E Chat, TypeScript sans erreur. Le run global au milieu de Task3 donne 412/418, six échecs liés aux changements médias non committés : ne pas le présenter comme une qualification globale finale. Vérification indépendante `07b1e3c42` via le runtime `5303c6f8b` : vrai Next exporté depuis Git, auth signée locale, PostgreSQL17 socket-only ; Chat répond401 sans session et503 en cookie/Bearer, sans chemin fournisseur. La fixture ne certifie ni PKCE ni l'infrastructure Supabase de production.

Qualification responsive parent `8cf596d54` : 8/8, 1440×900, 390×844, 320×844, 844×390, clair et sombre, reduced-motion ; actions de sélection/inspection/création dans le viewport, cibles 44 px, retour du focus. Cela ne vérifie pas chaque combinaison modèle/paramètre ni tous les navigateurs.

Mesure stress avant/après documentée dans `studio-connected-editor-verification.md` : 80 blocs, 150 items, mêmes fixtures, un passage Next dev par version. Les requêtes média initiales restent à 150 ; aucun gain de chargement initial/CWV revendiqué. Les couches timeline préchargées restent une dette à qualifier.

## Limites bloquant toute promesse plus large

- Bibliothèque/récents et faits exacts traversant toutes les destinations : Task 3 en cours, pas livré.
- MCP : `prepare_montage` reste désactivé par défaut, read-only, `persisted:false`. Nouveau projet transactionnel et autosave révisionné : Task 4 à implémenter.
- Preview 3032 : authentification anonyme locale et brouillons locaux ; aucune DB ni génération/paiement/stockage configurés. Ce n'est pas une preuve de sauvegarde serveur.
- Export réel, concurrence financière inter-créateurs, worker et stockage distants non qualifiés. Aucun appel payant ou écriture distante.
- Live Chat reste explicitement indisponible faute de contrat canonique de devis/autorisation ; la simulation locale est identifiée comme telle. Les messages et projets historiques restent conservés.
- Tarification export1440p héritée à arbitrer avant activation : multiplicateur1 par défaut contre1.5 pour1080p. Le correctif de dimensions ne modifie pas cette politique commerciale ; aucun export/débit exécuté.
- Allègement final des ports optionnels et texte des cartes à réaliser sans retirer capacités, audio, modèles ou budgets.
- Build complet final et qualification de la composition avec les derniers lots Audio/Toolbox/app restent nécessaires avant intégration finale.

Depuis le recentrage demandé par l'utilisateur, la tâche principale reprend Audio/Toolbox/Billing, dont MCP Audio. Studio conserve la commande de montage vidéo persisté et les adaptateurs de projet, sans deuxième fournisseur, devis ni multiplicateur de marge. Les anciens commits Audio/Toolbox restent consultables via Git ; leurs anciennes worktrees ne sont plus des points d'intégration.
