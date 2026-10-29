# Passation — Milo, refonte des générateurs et actualisation de l’offre

Passation de la pause demandée par Adrien le 29 octobre 2026 pour changer de compte Codex. **Reprise explicitement autorisée ensuite : « OK, on peut reprendre. Je suis sur le nouveau compte. »** Les états ci-dessous décrivent la pause ; consulter le journal et les commits pour la suite. Aucun déploiement ni merge n’est autorisé par cette passation.

## Où reprendre

- Dépôt produit : `/Users/adrienmillot/Desktop/MaxVideoAi V2/.worktrees/prompt-director-composer`.
- Branche : `codex/prompt-director-composer`.
- PR existante, draft : https://github.com/camgraphe/MaxVideoAi/pull/555.
- Prévisualisation locale : http://localhost:3018/app ; `/pricing` ; `/pay-as-you-go-ai-video-generator` ; `/ai-video-prompt-generator`.
- Le chat peut démarrer dans **OUTREACH** : ce n’est pas le code produit. Utiliser explicitement le workdir ci-dessus, lire son AGENTS.md et les guides applicables. Ne pas modifier OUTREACH.
- Dernier commit local : `b491ca8a7` — `fix(pricing): include current models and respect configured availability`.
- Dernier push connu : `d17b161a3` — `feat(marketing): introduce Milo with visual walkthrough and direct assistant entry`.
- `b491ca8a7` n’a pas été poussé. Une seconde partie est encore **non commitée** : la préserver, ne pas remettre la branche à zéro.

## Intention et décisions à conserver

Adrien veut une aide conversationnelle Milo dans les générateurs vidéo/image/audio, distincte de Studio, avec un mode Prompt manuel conservé. Beaucoup de réglages visuels ont déjà été travaillés et validés dans cette PR : ne pas repartir de zéro.

- Interface produit en anglais ; pages marketing EN/FR/ES.
- Milo Lite, Standard, Max partagent le panneau de crédits de Studio. Présenter Milo comme notre assistant ; éviter les noms des LLM et les niveaux techniques de raisonnement dans le marketing et le choix client.
- Pas de chat sans connexion. Lite gratuit sous limites ; crédits d’assistance Standard/Max séparés des générations médias. Ne pas promettre un film monté/exporté automatiquement par Studio.
- Références : images pour Lite ; images, vidéo et audio pour Standard/Max. Le contexte doit comprendre modèle, durée, résolution, format, audio, références et opération.
- Mise en page : mode manuel, conversation compacte avant le premier message, références compactes et nommées Image 1 / Video 1 / Audio 1, contrôle des modèles/variantes visible, réglages de prix visibles. Préserver le lecteur. Le gallery rail a été légèrement réduit avec l’accord d’Adrien.
- Le choix « Barre intégrée », puis « Barre commune », des anciennes propositions visuelles est confirmé. Ces dispositions sont déjà intégrées ; ce n’est pas une nouvelle demande.
- Tout reste dans PR #555. Pas de production à ce stade. Budget média autorisé : 10 USD, **0 USD consommé** pour ce travail marketing.

## Travail déjà livré avant cette passe

Commit `d17b161a3` : page publique Milo `/ai-video-prompt-generator` en trois langues avec illustration interactive, entrée `assistant=milo` sans envoi automatique, liens depuis accueil/Studio/pricing/aide/footer, FAQ et métadonnées, mesure d’acquisition bornée sans contenu de conversation. Une revue indépendante et un build avaient été faits sur cet état.

Lire pour le raccordement Milo, les migrations et la mise en ligne :

- `docs/marketing/milo-launch-delivery-2026-10-29.md`
- `docs/marketing/milo-launch-readiness-2026-10-29.md`

Les migrations 85–89 avaient été vérifiées dans un environnement Neon QA isolé ; la politique de capture/revue liée à la migration 90 reste à traiter dans le parcours de mise en production décrit par ces documents. Ne pas confondre accès API existant et schéma/crédits/conditions de déploiement.

## Demande en cours au moment de la pause

Adrien a repéré Pika 2.2 encore promu sur Pricing alors qu’il est retiré de l’offre active. Il demande de remettre Pricing, Pay as you go et les pages générales au goût du jour, notamment FLUX 3 Max, MiniMax H3, Kling 4.0, Seedance 2.5, Milo et Studio. Les recommandations « cheapest » doivent suivre les devis actuels et les réglages réellement comparés.

Plan : `docs/superpowers/plans/2026-10-29-public-offer-refresh.md`.
Journal de travail : `.superpowers/sdd/2026-10-29-public-offer-refresh/progress.md`.
Preuves et copie du diff à la pause : `.superpowers/sdd/2026-10-29-public-offer-refresh/pause-logs/` (ignoré par Git, conservé sur disque).

### Partie 1 commitée : tarifs actuels et disponibilité

Dans `pricing/_lib/currentPricingHubData.ts` et `pricingHubData.ts` :

- Les scénarios compatibles sans ancien tarif numérique reçoivent maintenant une demande de devis canonique. Avant, seuls les anciens prix « exact » déclenchaient le devis ; les nouveaux modèles pouvaient être oubliés.
- Lecture une fois du catalogue configuré, en lecture seule ; retrait des moteurs désactivés avant les devis. Une lecture de catalogue en échec ne ressuscite pas les modèles statiques.
- Conservation de la file bornée à huit, déduplication, projection vidéo seule pour PAYG et absence de repli sur un vieux montant.
- Kling 4 était déjà publié dans l’app et sur sa page modèle, mais pas sur la surface pricing : activation de **publication.pricing seulement** dans le registre auteur et régénération. Pas de changement des gates de génération ni d’un tarif en base.
- Libellés EN/FR/ES « Lowest quoted » avec réglages visibles ; 4K précise que les durées varient.
- Aucun calcul de facturation ni montant en production modifié.

### Partie 2 non commitée : pages et découverte

- PAYG : nouveaux modèles dans les cartes, liens, recherches de prix et six exemples visibles ; modèle représentatif de famille actualisé ; aucun fallback de lien ne doit réintroduire un modèle absent du catalogue courant.
- Ajout de deux cartes sobres Milo et Studio après les étapes de fonctionnement des crédits.
- Textes EN/FR/ES de l’accueil, à propos, catalogue, pricing et footer actualisés ; Pika retiré des promotions générales. Les identités des vidéos historiques, articles/comparaisons et archives restent intactes.
- Hub de comparaison : choix par défaut Seedance 2.5 / Kling 4, raccourcis récents publiés/indexables ; suppression du vieux spotlight de pré-lancement Seedance 2.0.
- `docs/seo/comparison-indexation-matrix-2026-07-08.json` modifié par la validation : nouveaux signaux de liens, pas de changement de classification. Vérifier et inclure s’il est toujours cohérent.
- Tests PAYG/discovery adaptés et nouvelles régressions de présence des modèles et de catalogue vide.

### Corrections issues de la validation complète, non commitées

L’ouverture de Kling sur pricing a révélé un consommateur admin ancien : il cherchait une définition tarifaire proportionnelle inexistante. Correction dans `frontend/server/pricing-admin/canonical-scenarios.ts` et `policy-preview.ts` : un devis legacy en pourcentage reste explicitement non autoritaire pour Kling 4, qui dépend de tarifs clients approuvés ; un changement global de surcharge ne le cible pas. Un ciblage explicite ne doit pas devenir un prix inventé. Deux régressions ont été vues rouges puis vertes.

- `tests/admin-playlist-destinations.test.ts` : fermeture explicite de pricing dans la fixture qui simule le modèle encore fermé.
- `tests/current-price-consumer-parity-postgres.test.ts` : ajout des migrations des tables catalogue au PostgreSQL jetable et vérification qu’un moteur désactivé disparaît même s’il possède un tarif approuvé.
- Filtre explicite d’indexation conservé sur les comparaisons pour respecter le contrat du hub.
- `frontend/components/Composer.tsx` : deux regroupements de paramètres, sans changement de comportement, pour revenir sous la limite de 500 lignes déjà imposée par son test.

## Validation : faits à la pause

Les logs sont copiés dans `pause-logs/` ; les originaux `/tmp/public-offer-*.log` peuvent disparaître après redémarrage.

- `public-offer-discovery-final.log` : **143/143 passent**, treize fichiers incluant les huit suites PAYG permanentes et les régressions discovery.
- `public-offer-task1.log` : **14/14** pricing/file/PAYG.
- `public-offer-policy.log` : **8/8 PostgreSQL** pricing-policy, après mise à jour des nombres de devis.
- `public-offer-regression-final.log` : **73/73 passent**, admin pricing, curation, comparaison et architecture Composer.
- `public-offer-regression-fixes.log` : **74/75** ; le seul échec était la surcharge globale Kling, corrigée et verte dans le log final ci-dessus. Les **deux tests PostgreSQL de parité consommateurs passent** dans ce log.
- TypeScript passé (`public-offer-tsc-final.log` vide), mais **avant les dernières corrections admin** : relancer.
- Lint : **0 erreur, 7 avertissements préexistants**, également avant dernières corrections admin.
- Registre, exposition publique et audit architecture passés ; relancer les contrôles pertinents sur l’état final.
- `pnpm test:validate` complet a trouvé les problèmes mentionnés puis a été **arrêté à la demande de pause** avant sa fin. Son log n’est **pas vert**. Les tests navigateur Studio y refusaient les fichiers `.env` présents dans le worktree de développement. Les relancer dans une copie propre sans secrets, pas en supprimant les `.env` de l’app locale.
- Aucun nouveau build complet, aucune revue finale indépendante de cette passe, aucun push des changements récents.
- Ne pas annoncer « tout est prêt à déployer ».

## Vérification visuelle effectuée

- Pricing local : Pika absent des lignes actives ; FLUX 3 Max, MiniMax H3, Kling 4.0 et Seedance 2.5 présents.
- À cette capture, meilleurs devis affichés : FLUX 3 Draft pour 5s/720p ; Kling 3 Standard pour 10s/1080p et 10s/1080p+audio. Ce sont des observations locales, pas des promesses de prix ou de qualité.
- PAYG local affiche nouveaux modèles et cartes Milo/Studio. Hero vérifié sur desktop et largeur 390px sans débordement horizontal ; viewport réinitialisé.
- Kling 4 et H3 affichaient « Live quote » sur certains scénarios locaux. Ne pas remplacer par un montant statique. Vérifier au besoin l’existence des tarifs approuvés dans l’environnement approprié, sans activer ni écrire en production.
- Les smokes complets FR/ES et les sections plus basses en mobile restent à finir.
- Des clés de traduction historiques inutilisées `aiVideoEngines.hero/sections/comparison` parlent encore de Pika/Sora ; la page actuelle utilise son propriétaire `_lib/ai-video-engines-copy-*` et seulement `aiVideoEngines.meta` dans messages. Ne pas attribuer une clé morte à un affichage actif sans vérifier. Les labels des anciennes vidéos et archives ne doivent pas être renommés.

## Prochaine reprise conseillée

1. Lire AGENTS.md du produit, le plan, cette passation et le diff courant. Ne pas refaire le raccordement Milo ou la disposition déjà validés.
2. Vérifier les derniers changements admin/fixtures et relancer TypeScript + tests ciblés nécessaires.
3. Terminer les smokes EN/FR/ES, mobile et les liens ; garder des captures utiles.
4. Committer les changements restants dans la même branche. L’untracked `output/marketing-media/` est apparu pendant la validation : inspecter avant toute inclusion, ne pas le supprimer aveuglément.
5. Build et validation dans une copie propre sans `.env` pour préserver le serveur local. Méthode précédente : `git archive HEAD` dans un dossier temporaire, symlinks des `node_modules` racine et frontend, puis `pnpm --prefix frontend build`. Ne pas lancer de build qui écrase le `.next` utilisé sur 3018.
6. Le skill `superpowers:executing-plans` appliqué demande **une revue finale avec contexte neuf**. Aucune n’a encore été lancée pour cette passe. La base de cette passe est `d17b161a3` ; les changements antérieurs de la PR ont déjà leurs rapports de revue.
7. Corriger les problèmes matériels, mettre à jour la documentation de qualification et la description de PR, pousser la branche et vérifier CI/preview. Ne pas merger ni déployer sans nouvelle instruction.

## Arrêt propre

Le processus de validation complet et ses descendants ont été arrêtés pour respecter la pause. Les tests ciblés étaient terminés. Le serveur de développement 3018 et les fichiers de travail sont conservés. Aucun achat média, message externe, merge ou déploiement n’a été effectué pendant cette passe.
