# Character Studio — plan de validation avant ouverture du rendu

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Aucun lancement de sous-agent n'est demandé par ce plan.

**Goal:** Prouver la cohérence des choix, des médias, des prix et des résultats du parcours personnage → look → Recast avant son ouverture aux clients.

**Architecture:** Conserver les propriétaires existants des personnages, des extraits, des devis et du portefeuille. Ajouter les preuves manquantes aux frontières du parcours. Les essais locaux utilisent PostgreSQL jetable et des fournisseurs simulés, puis une qualification fournisseur séparée lorsque l'utilisateur lèvera le report du rendu réel.

**Tech Stack:** Next.js, React, TypeScript, PostgreSQL 17, FFmpeg, tests Node/JSDOM et contrôle du navigateur autorisé.

**Spec:** `docs/engineering/character-studio.md`, `docs/engineering/pricing-engine.md`, `docs/redesign/2026-11-04-character-studio/recast-test-report.md` et décisions utilisateur du 4 novembre 2026.

## Global Constraints

- Même branche `codex/character-studio-v2`. Point de départ `d74abb946`.
- Demande initiale : « on garde le rendu réel pour plus tard ». Précision du 4 novembre : qualifier une preview pour générer avant production et préparer le marketing. Aucun rendu payant ni activation dans les lots 1–2 ; une scène et un devis restent nécessaires avant les essais réels.
- Nouvelles images, nouveaux looks et planches : Nano Banana 2.1. Une image par demande. Les reçus historiques gardent leur montant et leur modèle.
- Nom public : MaxVideoAI Recast. Le fournisseur interne reste traçable en interne.
- Résolutions Recast : 480p, 720p, 1080p. Cadrages : Auto, 9:16, 16:9, 1:1, 3:4, 4:3.
- Passages vidéo/audio indépendants de 15 s maximum. Sortie de 2 à 30 s entières, avec vidéo d'entrée + sortie ≤30 s.
- Suggestion de dialogue à 150 mots/minute, priorité vidéo puis audio, durée manuelle conservée.
- Les tests de cohérence utilisent une grille active déterministe sur PostgreSQL jetable. Recast doit avoir une marge supérieure au modèle direct ; « deux fois le coût fournisseur » reste une proposition. Voir `docs/redesign/2026-11-04-character-studio/preview-and-pricing.md`.
- Aucun montant calculé par le navigateur n'autorise un débit. Aucun montant historique ne devient le tarif d'un nouveau rendu.
- Les migrations applicatives restent dans `neon/migrations`. Aucun bootstrap de schéma dans une requête.
- L'ouverture du navigateur par Codex et son contrôle automatisé sont deux capacités distinctes. Le contrôle était désactivé lors de cette reprise.

## État prouvé et limites

196 tests ciblés ont réussi au dernier commit. Six répétitions locales ont encodé
les extraits et vérifié le tarif public sans créer de job ni de débit. Le test
PostgreSQL Recast couvre déjà les deux extraits, le format 1080p, le propriétaire,
le montant confirmé, le double clic et un seul débit avec un fournisseur simulé.

Ce résultat ne qualifie pas la qualité du rendu IA, une session complète dans un
navigateur après cette reprise, ni toutes les erreurs de paiement à travers Recast.
Les tests génériques de paiement existants sont des briques à réutiliser, pas une
preuve automatique de leur présentation dans ce nouveau parcours.

## Review Focus

1. Un tarif ou une référence change pendant la lecture du devis → nouveau devis obligatoire, aucun ancien montant débité. Tâches 1–2.
2. La confirmation est acceptée mais sa réponse réseau est perdue → retrouver le même job, jamais le relancer. Tâche 2.
3. Fermeture d'onglet, rechargement ou changement de compte → conserver les données durables, expliciter les fichiers locaux à réimporter, ne rien mélanger entre comptes. Tâche 3.
4. Deux références image permutées → le personnage conserve son rôle d'identité et le produit reste un objet distinct. Tâches 1 et 5.
5. Une sortie techniquement valide contredit l'identité, le geste ou le produit promis → ne pas en faire une démo approuvée sur la seule réussite technique du job. Tâche 5.

## Tâche 1 — Contrat des choix et matrice de cohérence des prix

**Fichiers concernés :**
- Créer `tests/character-studio-recast-price-parity-postgres.test.ts`.
- Compléter `tests/character-studio-recast-generation-postgres.test.ts` et `tests/character-studio-recast-request.test.ts`.
- Inspecter `frontend/server/character-studio/recast.ts`, `recast-public-price.ts`, `recast-request.ts` et `frontend/app/api/tools/character-studio/recast/estimate/route.ts`.
- Inspecter les tarifs image via `docs/engineering/pricing-engine.md` et les propriétaires Character Builder existants. Préserver les tests des anciens produits fixes.

**Interfaces :** `prepareRecast(actor, value, deps)` consomme les références possédées et renvoie le devis et les durées mesurées. `confirmRecast(actor, value, generation)` consomme l'identifiant du devis, `confirmed: true`, `amountCents` et `currency: 'USD'`. `readRecastPublicPrice(input)` reste un lecteur sans débit.

- [x] Construire une matrice de 27 scénarios valides : modes `i2v/ref2v/v2v`, trois résolutions, sorties de 2/8/15 s. Pour v2v, utiliser un extrait de 7,5 s dans un original de 25,6 s. Ajouter séparément les limites 15+15, 15+16 refusé et la référence audio 5,25 s sans vidéo.
- [x] Tester sur une même révision de tarif : estimation normalisée = devis serveur pour les mêmes médias mesurés. Affirmer que l'original de 25,6 s et la durée audio ne deviennent pas des secondes vidéo facturées. Ne pas coder en dur le tarif commercial de novembre.
- [x] Tester les six cadrages, ainsi que portrait + produit en inversant l'ordre lexical des identifiants : les rôles envoyés au fournisseur doivent rester ceux choisis. Vérifier la correspondance prompt/références, pas seulement leur présence.
- [x] Vérifier les nouvelles images Nano Banana 2.1 aux résolutions proposées : estimation et réservation portent la même révision et une seule image. Le test des produits historiques continue à réussir.
- [x] Exécuter ces tests avant toute correction. Corriger uniquement les écarts démontrés dans le propriétaire existant, puis relancer les cas concernés.
- [x] Exécuter `node scripts/run-postgres-tests.mjs pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/character-studio-recast-price-parity-postgres.test.ts tests/character-studio-recast-generation-postgres.test.ts tests/character-builder-pricing-postgres.test.ts`. Attendu : zéro échec.
- [x] Commit local des tests et des éventuelles corrections. Si une politique 2× est ensuite choisie, en faire une livraison tarifaire distincte suivant le guide de tarification, avec effet limité à Recast.

**Acceptation :** aucune divergence inexpliquée entre demande normalisée, devis et réservation. Si la préparation modifie une durée mesurée, sa conséquence sur le prix est visible avant confirmation.

## Tâche 2 — Argent et reprise après incident

**Fichiers concernés :**
- Compléter `tests/character-studio-recast-generation-postgres.test.ts`.
- Créer `tests/character-studio-recast-payment-ui.test.ts`.
- Inspecter `frontend/src/components/tools/character-builder/_components/CharacterStudioRecastSubmit.client.tsx` et `_lib/recast-submit.ts`.
- Réutiliser `tests/helpers/mcp-paid-e2e-harness.ts`, `tests/integration/mcp-paid-generation.test.ts`, `frontend/src/server/tools/creator-generation-service.ts` et les propriétaires communs de récupération/remboursement. Ne pas créer un second portefeuille.

**Interfaces :** `prepareRecastQuote(setup, cache, signal): Promise<RecastQuote>` et `confirmRecastQuote(quote): Promise<{jobId,status}>` restent les frontières client. Les tests utilisent un `WalletRecastQuote` et un fournisseur simulé, jamais le mode réel local.

- [x] Tester devis expiré, montant/devise altérés, solde insuffisant et tarif modifié entre préparation et confirmation. Attendu : aucun nouveau job accepté ni débit sur un devis refusé.
- [x] Tester double clic et perte de réponse après acceptation. Attendu : un seul job, un seul appel fournisseur, un seul débit et un lien vers le job récupéré.
- [x] Tester rejet terminal fournisseur, échec de copie du résultat puis récupération, et statut fournisseur momentanément inconnu. Réutiliser les règles existantes : pas de resoumission aveugle, pas de remboursement tant qu'une acceptation reste indéterminée. Si le chemin terminal est remboursable, montant du remboursement = débit, une fois seulement.
- [x] Vérifier dans l'interface les états de ces cas : action de reprise possible, texte compréhensible et aucun bouton permettant de confirmer un devis périmé.
- [x] Exécuter les nouveaux tests et `tests/mcp-paid-generation-postgres.test.ts` avec le lanceur PostgreSQL jetable. Attendu : zéro échec, fournisseurs exclusivement simulés.
- [x] Commit local avec preuve des soldes et du nombre de reçus dans les tests.

**Acceptation :** montant confirmé = montant débité = montant du reçu historique. Une reprise ne crée jamais un second achat involontaire.

## Tâche 3 — Recette de vingt parcours clients complets

**Fichiers concernés :**
- Compléter `tests/character-studio-recast-pricing-ui.test.ts`, `tests/character-studio-library-client.test.ts`, `tests/character-builder-account-lifecycle.test.ts` si un défaut est reproduit.
- Créer `docs/redesign/2026-11-04-character-studio/acceptance-journeys.md` pour les preuves visuelles et les résultats.
- Édition limitée aux composants/hooks responsables du défaut trouvé, sans refonte globale.

**Interfaces :** entrée `/app/tools/character-builder`, bibliothèque sauvegardée, nouveau look, sélection originale envoyée à Recast. Aucun appel réel à la génération n'est requis pour cette recette.

- [ ] Définir 20 cas : cinq personnages/formes d'usage, chacun décliné en parcours normal, correction d'une saisie/import, interruption réseau et retour/rechargement. Couvrir notamment vidéo absente, audio absent, produit, dialogue seul, fichiers longs, mauvais fichier, nom identique et deux comptes.
- [ ] Vérifier la chaîne personnage sauvegardé → nouveau look → Recast → deux passages → prix revu. Tester un rafraîchissement à chaque frontière durable. Ne pas prétendre sauvegarder un `File`/blob local non persistant : expliquer clairement la réimportation si nécessaire.
- [ ] Une fois le contrôle navigateur autorisé, jouer la recette sur bureau et petits écrans, avec clavier, zoom et langues FR/EN/ES. Vérifier bouton Générer accessible, champs lisibles, focus des dialogues et absence de débordement. Tester Chrome et Safari/iPhone, avec appareils réels pour la lecture native avant lancement public.
- [ ] Pour chaque anomalie reproductible, ajouter le test ciblé avant correction, puis rejouer le scénario concerné. Enregistrer résultat, capture, état des données et statut du prix pour chaque cas.
- [ ] Commit local des corrections et du rapport. Ne pas marquer les vérifications navigateur réussies lorsque seul JSDOM a été exécuté.

**Acceptation :** 20 parcours documentés, aucune impasse dans une action principale, aucune perte silencieuse d'une donnée annoncée comme sauvegardée, aucun mélange de comptes.

## Tâche 4 — Preuve de livraison et exploitation en environnement de test

**Fichiers concernés :**
- Compléter `tests/character-studio-recast-generation-postgres.test.ts` et créer `tests/character-studio-recast-result-postgres.test.ts` si la récupération n'est pas couverte par le cas existant.
- Inspecter `frontend/src/server/generations/generation-status.ts`, les projections Activity/bibliothèque existantes et `frontend/server/character-studio/recast-readiness.ts`.
- Compléter `docs/engineering/character-studio.md` avec les états et les procédures de reprise vérifiés.

**Interfaces :** identifiant de job accepté, statut récupérable par son propriétaire, sortie originale téléchargeable, reçu immutable. Garder le nom MaxVideoAI Recast sur les surfaces client et l'identifiant technique du moteur dans les données internes.

- [ ] Faire parcourir au même job simulé les états accepté/en cours/terminé/échec. Vérifier sa présence cohérente dans Activity, bibliothèque, téléchargement et transactions.
- [ ] Utiliser un résultat vidéo synthétique réellement lisible. Comparer durée et dimensions mesurées à la configuration du job, en tenant compte du contrat de cadrage. Un statut fournisseur « terminé » ne suffit pas à déclarer un média accessible.
- [ ] Tester média temporairement indisponible, recharge de page et retour après expiration de session. Le propriétaire retrouve le même job et le reçu initial, sans nouveau rendu.
- [ ] Définir les mesures d'exploitation : échec import/découpe, écart estimation/devis, confirmations refusées, temps de génération, jobs bloqués, récupération et remboursements. Corréler par job/devis sans journaliser secrets ou URL signée.
- [ ] Exécuter tests ciblés, TypeScript, lint et contrôle d'exposition, puis commit local. Consigner les contrôles visuels encore non effectués.

**Acceptation :** un dossier de preuve relie chaque demande à ses médias, au montant confirmé, au statut final, au fichier disponible et au reçu.

## Tâche 5 — Qualification réelle et lancement, explicitement différés

**Fichiers/références :** `docs/redesign/2026-11-04-character-studio/six-films-recast.json`, `docs/engineering/character-studio.md`, `docs/engineering/media-delivery.md`, `docs/deployment/github-vercel.md`.

**Interfaces :** portraits originaux issus de Character Builder, véritables prises de mouvement sélectionnées, image produit séparée, voix/beat si retenu, devis exact revu avant chaque essai.

- [ ] Attendre la levée explicite du report du rendu réel. Raccorder alors un environnement qualifié avec stockage privé HTTPS, fournisseur de test et migrations requises. Ne pas récupérer des secrets de production pour contourner un manque de configuration.
- [ ] Présenter les prises, le passage exact, le portrait, l'objet éventuel, le dialogue, la durée et la résolution des cinq démos restantes avant de demander l'accord sur les devis. Le pilote Basil reste conservé. Les prises de mouvement manquantes doivent être sélectionnées avant de promettre les films.
- [ ] Après autorisation, lancer une tentative par concept selon les devis acceptés. Contrôler identité, reproduction du mouvement, lisibilité du produit, dialogue/synchronisation, cadrage, durée et qualité du fichier final. Documenter les limites observées avant toute affirmation marketing.
- [ ] En cas de défaut, qualifier sa cause (parcours, paramètres, référence, modèle) et revoir le concept. Aucune répétition payante automatique.
- [ ] Avant ouverture publique, revue de la branche, intégration de `main`, PR et Quality CI selon le guide de déploiement. Activation progressive avec arrêt possible et surveillance des erreurs/coûts. Aucune fusion ou publication n'est autorisée par la simple rédaction de ce plan.

**Acceptation :** cinq résultats jugés utilisables pour leurs cas d'usage, promesses produit compatibles avec les résultats observés, comptabilité cohérente et livraison suivant le circuit normal.

## Ordre proposé

Commencer par 1 puis 2, pendant que le rendu réel reste fermé. Jouer 3 et 4 sur la
base de test. L'étape 5 reste différée. Les tâches portent sur les preuves manquantes,
pas sur un nouveau tour de décoration de l'interface. Ce fichier est un plan,
aucune de ses cases n'est présentée comme déjà exécutée.

## Exécution des lots 1–2 (4 novembre 2026)

119 tests ciblés réussis ; matrice de 37 tests rejouée après assertion du snapshot immuable.
TypeScript, lint (0 erreur, 7 avertissements préexistants), exposition et diff passent.
Tests supplémentaires : `character-studio-nano21-price-postgres`, `character-studio-recast-payment-postgres`,
et fixture commune `helpers/character-recast-harness`. Compte rendu détaillé dans le rapport Recast.
Les lots 3–5 restent ouverts ; aucune preview distante ni génération fournisseur activée.
