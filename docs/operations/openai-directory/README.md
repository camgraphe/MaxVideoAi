# MaxVideoAI — préparation OpenAI

État local au **12 novembre 2026**. **Pas encore soumis.** Cette page remplace l'ancien état d'accueil ; les preuves datées restent conservées dans le [journal de qualification](qualification-2026-11-11/paquet-final-et-scenarios.md) et l'[historique du 11 novembre](historique-etat-2026-11-11.md).

## Où nous en sommes

| Sujet | État établi | Ce qui reste |
| --- | --- | --- |
| Branche marketplace | `codex/openai-directory-20261111` inclut le main vérifié `371ee9eaf` (PR #649), sans conflit ; correctif Pika intégré en `6a7da9849`, contrat de test adapté en `2e0f4e0a8`. 183 tests catalogue/MCP et registre validés au lot précédent ; 31 tests ciblés passent après #649. | Intégrer les prochains commits de la tâche d'alignement, puis vérifier l'ensemble. |
| Modèles et outils | Pika retiré des nouvelles créations et comparaisons actuelles ; accès historique conservé. | Audio/musique/SFX, création Character Studio/looks, Recast et découverte des creator tools : chantier parallèle en cours. |
| Dossier OpenAI | Brouillon 0.3.19 qualifié le 11 novembre ; identité, domaine et OAuth ont été vérifiés alors. Aucune soumission attestée. | Candidat **0.3.20 local construit** : scénario P2 sans Pika et notes de version actualisées, 13 fichiers et empreintes vérifiés. 5 tests du paquet et 216 tests MCP passent (1 skip optionnel). Les résultats du portail ne sont pas revérifiés dans ce lot. |
| Vidéo reviewer | Extrait V5 de 41 s et projet Premiere disponibles : application entière, cadre stable, explications latérales. P1 laptop/comparaison validé pour préparation après alignement, sans génération ; aucune nouvelle prise. | Présenter les sept autres parcours au propriétaire avant capture. Recapturer les parcours actuels après alignement. V3/V4 et la démonstration fixe sont des archives, pas des candidats à soumettre. |
| Environnement dédié | Dernière clôture vérifiée le 12 novembre : serveur dédié `5b75bf990`, base en pause, solde fictif nul, 18 crons désactivés. Le candidat local ajoute le garde-fou Ads après #649. | Avant prochain build dédié, configurer `OPENAI_ADS_CONVERSIONS_DISABLED=1`, sans pixel ni clé Ads ; vérifier aussi la désactivation du nouveau cron de conversions. Aucun paramètre distant modifié. Préparer la qualification puis convenir de la disponibilité pendant revue. |
| Présentation | Logo, textes et vidéos regroupés dans la page locale de revue. Publicité Maya distincte du walkthrough. | Validation finale du propriétaire avant remplacement des pièces en ligne et avant soumission. |

Les nombres d'outils dépendent du serveur, des flags et de la version installée. Un total différent ne prouve pas à lui seul qu'une capacité manque. La capture finale consignera chaque hôte et le candidat réellement utilisé.

## Travail mené en parallèle

- **Ce chat** : paquet OpenAI, textes, pièces, conducteur de recapture, présentation et réintégration sur la branche marketplace.
- **Chat « Aligner Assistant, MCP et plugin OpenAI sur main »** (`01a1cfd8-92ea-7a10-a5c4-611d9382914b`) : runtime commun, catalogue, audio, personnages, outils et contrats.
- Les modifications restent locales jusqu'à la décision de livrer le seul environnement de test. Aucun merge en production ni accès aux bases normales n'est prévu ici.

## Suite concrète

1. Terminer et réintégrer l'alignement technique, puis figer la version à qualifier.
2. Présenter et valider ensemble les scénarios avant toute capture, puis les rejouer sur le compte dédié ; enregistrer les interactions avec curseur visible et conserver leurs résultats réels. Toute nouvelle opération payante attend son devis et son accord.
3. Finaliser la vidéo et les pièces, vérifier l'accès du reviewer et la durée du lien de vidéo ; montrer le paquet au propriétaire.
4. Après son accord, soumettre à OpenAI. La publication après acceptation reste distincte.

## Documents utiles

- [Plan de recapture et texte des scénarios](recapture-et-dossier-2026-11-12.md).
- [Pièces déjà rassemblées et écarts à solder](pieces-a-finaliser.md) — la note d'actualisation indique les points historiques.
- [Audit des droits et conditions du 11 novembre](droits-et-regles-2026-11-11.md) — conditions standard des services ; pas de demande inventée de six contrats sur mesure.
- [Procédure d'effacement du compte synthétique](fiche-effacement-reviewer.md) — ne pas supprimer le compte de démonstration encore nécessaire aux reviewers.

La documentation OpenAI relue le 12 novembre demande un compte de test utilisable, cinq cas positifs, trois négatifs, une vidéo accessible et des notes de version. Les identifiants restent hors ZIP. Elle n'impose ni code à l'écran ni durée dans cette section. [Source officielle](https://developers.openai.com/plugins/deploy/submission#complete-review-information).
