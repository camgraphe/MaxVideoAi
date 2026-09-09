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
| D07 | « Une idée, plusieurs façons de la créer » avec une transformation suivie | Proposition V1 | Voir home-pilot.md |
| D08 | Pas de scrub vidéo lourd par défaut ; essai borné si nécessaire | Recommandation technique | Poids/décodage à mesurer, aucun benchmark réalisé |
| D09 | Priorité de livraison après pilote à recalibrer avec données SEO | Proposition | GSC/analytics non acquis |
| D10 | Inclure au moins une proposition avancée de construction/déconstruction au scroll | Exigence utilisateur | Ajout du 9 septembre pendant le cadrage |
| D11 | « La scène se construit » : plans → angles → vidéo → galerie | Proposition | motion-signature.md ; références repérées, qualification visuelle à faire |
| D12 | Mobile et performance prioritaires, conçus dès le début | Exigence utilisateur | Ajout du 9 septembre pendant le cadrage |
| D13 | Chaque jalon visuel présente mobile et desktop ; effet non retenu s'il dégrade l'usage mobile | Critère proposé | mobile-performance.md |
| D14 | Inclure ImageGen, vidéos MaxVideoAI et pictogrammes propres dans le workflow | Exigence utilisateur, méthode documentée | creative-research.md ; aucune nouvelle génération lancée |
| D15 | Conseil global SEO/GEO, contenu, conversion, acquisition et mesure | Exigence utilisateur, propositions rédigées | conseil-strategique.md et measurement.md |
| D16 | Exploiter les onglets Chrome existants | Première lecture réalisée | GSC/Vercel/Semrush repérés ; métriques Vercel 24 h uniquement |

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
- [ ] Acquérir crawl et données d'acquisition disponibles en lecture seule.
- [ ] Inspecter et qualifier les assets du parcours suivi.
- [ ] Proposer les états visuels détaillés et valider V2.
- [ ] Construire/mesurer le prototype animé, puis valider V3.
- [ ] Intégrer et présenter un lot prêt à livrer pour V4.

## Vérification initiale

Commande : `tsx --tsconfig frontend/tsconfig.json --test tests/home-route-architecture.test.ts tests/models-catalog-architecture.test.ts tests/hreflang-variants.test.ts` depuis le worktree. Exécutable tsx existant du checkout principal utilisé pour ces contrôles. Premier lancement sans tsconfig : résolution des alias échouée ; commande corrigée, 13 tests passent. Node disponible : 23.9.0 ; le projet demande Node 22.x. Utiliser le runtime cible et les dépendances propres au worktree pour la recette d'intégration. Aucun build complet exécuté.

## Prochaine décision à présenter

V1 : faut-il privilégier une création suivie (référence → cadrage → vidéo, recommandé) ou trois intentions indépendantes (film/publicité/image) ? Exposer les avantages et le scénario concret, sans demander à Adrien de choisir une bibliothèque ou chaque animation.
