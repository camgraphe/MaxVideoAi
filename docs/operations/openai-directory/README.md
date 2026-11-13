# MaxVideoAI — préparation OpenAI

État local au **12 novembre 2026**. **Pas encore soumis.** Cette page remplace l'ancien état d'accueil ; les preuves datées restent conservées dans le [journal de qualification](qualification-2026-11-11/paquet-final-et-scenarios.md) et l'[historique du 11 novembre](historique-etat-2026-11-11.md).

## Où nous en sommes

| Sujet | État établi | Ce qui reste |
| --- | --- | --- |
| Branche marketplace | `codex/openai-directory-20261111` inclut le main vérifié `371ee9eaf`, le runtime commun et les adaptations marketplace. Candidat `e75f95e7b` livré au seul projet Review, build READY et prébuild d'isolation réussis. | Qualifier séparément les capacités nouvelles. La réserve navigateur Header/useId reproduite sur main reste documentée. |
| Modèles et outils | Catalogue hébergé courant : 31 modèles vidéo sans Pika ; historique Pika explicitement non générable. Migrations dédiées appliquées. Audio actuellement `voice_only`, créateurs et passages web inspectés. | Qualifier le worker Audio dédié puis musique/SFX et Builder avant d'annoncer ces nouveaux parcours comme exécutés. |
| Dossier OpenAI | Brouillon antérieur conservé. Candidat **0.3.21 local construit**, 14 fichiers ; tests du paquet et des projections réussis. P1 désormais exécuté sur le serveur aligné. | Synchroniser les scénarios après validation et compléter leur exécution. Aucun nouvel import dans le portail ni soumission. |
| Vidéo reviewer | Kit graphique validé. **Répétition P1 de 47 s** : saisie réelle, import privé et comparaison ; correction d'une illustration stock conservée dans les preuves. Timeline XML à deux pistes préparée pour Premiere, import non vérifié. | Valider l'extrait et refaire une capture continue avec curseur. Les sept autres cas et ATELIER restent proposés ; anciens films conservés en archives. |
| Environnement dédié | Serveur `e75f95e7b`, **19 crons désactivés**, Ads désactivé. Neon dédié refermé à 18:22:39 Madrid : `disabled=true`, `idle`. Après P1 : 6 jobs, 7 reçus, 10 devis inchangés ; solde nul. | Rouvrir seulement le test pour la prochaine séance et prévoir sa disponibilité pendant la revue. Voir le [reçu hébergé](qualification-hebergee-2026-11-12.md). |
| Présentation | Logo, textes et vidéos regroupés dans la page locale de revue. Publicité Maya distincte du walkthrough. | Validation finale du propriétaire avant remplacement des pièces en ligne et avant soumission. |

Les nombres d'outils dépendent du serveur, des flags et de la version installée. Un total différent ne prouve pas à lui seul qu'une capacité manque. La capture finale consignera chaque hôte et le candidat réellement utilisé.

## Travail mené en parallèle

- **Ce chat** : paquet OpenAI, textes, pièces, conducteur de recapture, présentation et réintégration sur la branche marketplace.
- **Chat « Aligner Assistant, MCP et plugin OpenAI sur main »** (`01a1cfd8-92ea-7a10-a5c4-611d9382914b`) : runtime commun, catalogue, audio, personnages, outils et contrats.
- Le candidat intégré a été livré au seul environnement de test avec l'accord du propriétaire. Aucun merge en production ni accès aux bases normales.

## Suite concrète

1. Examiner la répétition P1 ; préparer sa prise finale continue avec curseur et image correcte dès la réponse initiale. La qualification hébergée de ce scénario est faite, avec le détour de correction documenté.
2. Valider les sept autres scénarios et la référence ATELIER, puis les jouer sur le compte dédié. Qualifier en parallèle le worker Audio et les nouvelles capacités avant de les montrer. Toute nouvelle opération payante attend son devis et son accord.
3. Finaliser la vidéo et les pièces, vérifier l'accès du reviewer et la durée du lien de vidéo ; montrer le paquet au propriétaire.
4. Après son accord, soumettre à OpenAI. La publication après acceptation reste distincte.

## Documents utiles

- [Plan de recapture et texte des scénarios](recapture-et-dossier-2026-11-12.md).
- [Qualification hébergée, essai P1 et clôture du test](qualification-hebergee-2026-11-12.md).
- [Réintégration Audio/Builder et adaptations marketplace](integration-runtime-2026-11-12.md).
- [Pièces déjà rassemblées et écarts à solder](pieces-a-finaliser.md) — la note d'actualisation indique les points historiques.
- [Audit des droits et conditions du 11 novembre](droits-et-regles-2026-11-11.md) — conditions standard des services ; pas de demande inventée de six contrats sur mesure.
- [Procédure d'effacement du compte synthétique](fiche-effacement-reviewer.md) — ne pas supprimer le compte de démonstration encore nécessaire aux reviewers.

La documentation OpenAI relue le 12 novembre demande un compte de test utilisable, cinq cas positifs, trois négatifs, une vidéo accessible et des notes de version. Les identifiants restent hors ZIP. Elle n'impose ni code à l'écran ni durée dans cette section. [Source officielle](https://developers.openai.com/plugins/deploy/submission#complete-review-information).
