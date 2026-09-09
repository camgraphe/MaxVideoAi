# Décisions et avancement

## Journal

| ID | Décision / proposition | Statut | Fondement |
|---|---|---|---|
| D01 | Priorité aux visuels, fin des boîtes dans les boîtes, moins de texte répétitif, mouvement distinctif | Exigence utilisateur | Conversation du 9 septembre |
| D02 | EN/FR/espagnol LATAM ; préserver SEO/GEO | Exigence utilisateur | Conversation du 9 septembre |
| D03 | Avancer en autonomie avec validations importantes | Exigence utilisateur | Dernière demande |
| D04 | Worktree `.worktrees/site-redesign`, branche `codex/site-redesign`, base distante actualisée | Réalisé | fetch + création le 9 septembre, `bdd544e9f` |
| D05 | Anciens concepts non validés ; palette ouverte | Acté par cadrage | Retour utilisateur demandant un changement d'expérience |
| D06 | Accueil comme pilote d'expérience ; catalogue + fiche comme tests de généralisation | Proposition | Couvre narration et information dense |
| D07 | Transformation suivie idée → référence → image → vidéo | Accord de direction utilisateur ; hiérarchie non finalisée | Retour après le premier dossier ; home-pilot.md |
| D08 | Pas de scrub vidéo lourd par défaut ; essai borné si nécessaire | Recommandation technique | Poids/décodage à mesurer, aucun benchmark réalisé |
| D09 | Priorité de livraison après pilote à recalibrer avec données SEO | Proposition étayée partiellement | Relevés GSC/GA4/Clarity acquis ; funnels et sessions détaillées non audités |
| D10 | Inclure au moins une proposition avancée de construction/déconstruction au scroll | Exigence utilisateur | Ajout du 9 septembre pendant le cadrage |
| D11 | « La scène se construit » : plans → angles → vidéo → galerie | Proposition | motion-signature.md ; références repérées, qualification visuelle à faire |
| D12 | Mobile et performance prioritaires, conçus dès le début | Exigence utilisateur | Ajout du 9 septembre pendant le cadrage |
| D13 | Chaque jalon visuel présente mobile et desktop ; effet non retenu s'il dégrade l'usage mobile | Critère proposé | mobile-performance.md |
| D14 | Inclure ImageGen, vidéos MaxVideoAI et pictogrammes propres dans le workflow | Exigence utilisateur, méthode documentée | creative-research.md ; aucune nouvelle génération lancée |
| D15 | Conseil global SEO/GEO, contenu, conversion, acquisition et mesure | Exigence utilisateur, propositions rédigées | conseil-strategique.md et measurement.md |
| D16 | Exploiter les onglets Chrome existants | Première lecture réalisée | GSC/Vercel/Semrush repérés ; métriques Vercel 24 h uniquement |
| D17 | Donner une vraie place au MCP et au parcours site/projet → assistant → vidéo | Exigence utilisateur ; scénario proposé | product-narrative.md |
| D18 | Adapter la promotion du Studio à sa disponibilité réelle | Proposition : retrait de la promesse principale en phase admin | Flags et politique d'accès inspectés ; product-narrative.md |
| D19 | Soigner logos, modales, lecteurs, filtres et tous les états | Exigence utilisateur ; contrat de détail rédigé | interaction-details.md |
| D20 | Approfondir références, forums et code avant d'intégrer | Recherche élargie réalisée ; qualification partielle | creative-research.md ; pas d'adoption technique |
| D21 | Inclure une page d'exemples dans le pilote | Recommandation issue des premiers relevés GSC | /examples/ltx : 285 clics Web, période 10 août–6 septembre |
| D22 | Intégrer le rapport GSC IA bêta disponible dans le compte | Constat dans Chrome et correction du cadrage initial | measurement.md ; impressions ≠ citations ni conversions |
| D23 | Revue visuelle locale de sept moments, deux effets et six détails | Réalisée ; hiérarchie à valider | review/index.html ; accord utilisateur « ok go » pour approfondir et matérialiser la proposition |
| D24 | Réconcilier l'attribution avant d'évaluer la conversion du reboot | Recommandation issue des données | GA4 : 94,07 % du revenu affiché dans Unassigned |
| D25 | Vérifier performance terrain et plein écran dans la recette du pilote | Priorité d'investigation | Clarity agrégé : LCP 3,5 s / INP 260 ms / CLS 0,13 ; erreur requestfullscreen non localisée |
| D26 | Réutiliser la montre comme preuve existante ; proposer une collection originale distincte | Proposition, aucune nouvelle génération | Médias inspectés et provenance du 6 septembre ; review/README.md |
| D27 | Écarter la montre et le découpage rectangulaire comme base de la nouvelle direction | Réorientation après retour utilisateur | Revue jugée difficile à lire, trop simple ; demande d'objets indépendants, assemblage, rotation, ordinateur qui s'ouvre |
| D28 | Distinguer ordre de page, direction artistique et mouvement ; montrer l'intention avant de demander une validation | Méthode corrigée | Nouvelle planche ImageGen en quatre états et explication en français dans review/direction.html |
| D29 | Terminer un court essai animé de la scène avec vue mobile | Autorisé par « ok », réalisé comme étude locale | review/motion.html ; ne valide pas le sujet ni son intégration |
| D30 | Composer les pages avec visuels d'attente, réserver les emplacements et fabriquer les effets après choix des sections | Exigence de méthode utilisateur | Dernier retour ; page-first-workflow.md. Terminer D29 puis donner priorité à la page complète |
| D31 | Garder l’essai en référence ; réserver le scroll à un récit produit clair, sans activation préalable sur les pages utiles ; envisager un aperçu suivant la souris | Retour utilisateur acquis | Après examen de motion.html ; home-composition.md |
| D32 | Accueil complet avec posters réels, workflow illustré, choix des modèles et FAQ, en FR/EN/es LATAM | Réalisé comme proposition locale ; direction et placements à examiner | review/home.html ; home-composition-validation.md |

## Avancement

- [x] Isoler le chantier depuis origin/main après fetch.
- [x] Lire les instructions et la spécification de refonte de l'app.
- [x] Créer le dossier central et le scénario complet.
- [x] Inventorier les gabarits marketing depuis la base de code.
- [x] Identifier les premières responsabilités de contenu et défauts de langue.
- [x] Préparer les critères de migration/recette et les points de validation.
- [x] Vérifier les contrats ciblés : 13/13 passent.
- [x] Documenter la recherche d'effets avec sources et leur application au produit.
- [x] Préparer le workflow d'assets et les recommandations par métier.
- [x] Inspecter l'instrumentation existante et amorcer la lecture des comptes dans Chrome.
- [ ] Valider V1 : scénario de l'accueil.
- [x] Relever GSC Web et IA sur 28 jours, premiers résultats pages/requêtes/appareils/pays.
- [x] Compléter comparaison Web et pays LATAM ; relever GA4 acquisition et Clarity agrégé.
- [ ] Compléter crawl, funnel GA4, réconciliation de mesure et sessions Clarity détaillées.
- [x] Inspecter les médias publics candidats ; qualifier la montre et les illustrations abstraites.
- [x] Matérialiser storyboard, références et premiers états manipulables dans une revue locale.
- [x] Terminer l’étude 3D puis la conserver comme référence distincte.
- [x] Composer l’accueil complet avec images pertinentes, vue mobile, trois langues et carte des effets.
- [ ] Retenir la composition et les sections avant de produire leurs nouveaux assets.
- [ ] Proposer les états visuels détaillés et valider V2.
- [ ] Construire/mesurer le prototype animé, puis valider V3.
- [ ] Intégrer et présenter un lot prêt à livrer pour V4.

## Vérification initiale

Commande : `tsx --tsconfig frontend/tsconfig.json --test tests/home-route-architecture.test.ts tests/models-catalog-architecture.test.ts tests/hreflang-variants.test.ts` depuis le worktree. Exécutable tsx existant du checkout principal utilisé pour ces contrôles. Premier lancement sans tsconfig : résolution des alias échouée ; commande corrigée, 13 tests passent. Node disponible : 23.9.0 ; le projet demande Node 22.x. Utiliser le runtime cible et les dépendances propres au worktree pour la recette d'intégration. Aucun build complet exécuté.

## Prochaine décision à présenter

Le fil suivi et la méthode « pages avant effets » sont acquis. Prochaine décision : juger la [composition complète de l’accueil](review/home.html), sa hiérarchie et la place du MCP, puis retenir les emplacements où le mouvement explique quelque chose. Les notes sont accessibles via « Voir les effets prévus ». Le cadrage stratégique reste provisoire tant que l'audit des parcours et la collecte complémentaire sont incomplets.

La [revue V1](review/index.html), la [planche illustrée](review/direction.html) et l'[étude 3D](review/motion.html) restent des références historiques. Le sujet de la chaussure n'est pas retenu pour la page. Voir [la méthode actualisée](page-first-workflow.md) et [le compte rendu de composition](home-composition.md).
