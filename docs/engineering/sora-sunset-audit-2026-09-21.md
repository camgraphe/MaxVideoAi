# Audit du retrait de Sora — 21 septembre 2026

## Décision recommandée

Fermer dès maintenant les nouvelles générations Sora 2 et Sora 2 Pro, puis conserver leurs pages comme archives explicites avec des alternatives. Terminer et sécuriser les générations déjà acceptées. Ne pas attendre le 24 septembre pour déployer la fermeture.

Ce document est un audit et un plan de sortie. Aucun réglage de production, registre modèle, contenu public ou compte client n'a été modifié. Aucune génération payante n'a été lancée. État local inspecté : `f5a074a1b`, branche `codex/seo-geo-machine-audit-20260921` ; fichiers non suivis préexistants conservés.

## Faits externes vérifiés

- OpenAI annonce la suppression de Videos API, `sora-2`, `sora-2-pro` et des snapshots associés le **24 septembre 2026**, sans remplaçant recommandé : [dépréciations officielles](https://developers.openai.com/api/docs/deprecations#2026-03-24-sora-2-video-generation-models-and-videos-api).
- La fermeture de l'application et du site Sora remonte au 26 avril 2026 ; elle est distincte de l'échéance API : [centre d'aide OpenAI](https://help.openai.com/en/articles/20001152-what-to-know-about-the-sora-discontinuation).
- **fal.ai confirme la même date sur les quatre endpoints effectivement déclarés dans MaxVideoAI**, avec un avertissement de dépréciation : [Standard texte](https://fal.ai/models/fal-ai/sora-2/text-to-video), [Standard image](https://fal.ai/models/fal-ai/sora-2/image-to-video), [Pro texte](https://fal.ai/models/fal-ai/sora-2/text-to-video/pro), [Pro image](https://fal.ai/models/fal-ai/sora-2/image-to-video/pro).
- Les sources consultées n'indiquent pas l'heure ni le fuseau de coupure. Aucun maintien via fal.ai après cette date n'est établi. Un ancien article de lancement ou un playground encore visible ne constitue pas une garantie d'exécution.

« Fire.ai » a été interprété comme fal.ai, ce qui correspond au fournisseur trouvé dans le code. Les informations d'export et suppression des données de l'application Sora ne prouvent pas une suppression des vidéos stockées par MaxVideoAI ou fal.ai ; vérifier séparément leur persistance.

## Constats MaxVideoAI

| Surface | État constaté | Conséquence |
| --- | --- | --- |
| Registre | Les deux modèles sont `legacy`, avec application, pricing, pages, comparaisons, exemples et sitemap publiés ; `examples.current=false`, aucun successeur. | `legacy` ne coupe pas l'exécution. |
| Fournisseur | Les quatre endpoints fal ci-dessus sont déclarés dans `frontend/src/config/fal-engines/sora.ts`. | Les deux modèles et les deux modes sont concernés. |
| MCP | Découverte générale et recommandations excluent déjà Sora. La consultation exacte indique encore `generationEnabled=true` ; préparation et confirmation restent possibles selon la configuration runtime. | Préserver la protection existante, fermer aussi le choix explicite. |
| Pages publiques | Requêtes HTTP directes du 21 septembre : `/models/sora-2`, `/fr/modeles/sora-2`, `/es/modelos/sora-2-pro` répondent 200, avec canonical correct et liens `/app?engine=sora-…`, y compris recréation. Aucune date de fermeture recherchée n'est présente. | Risque de promettre une génération bientôt impossible. |
| Texte pour assistants | `/llms.txt` répond 200 et ne contient pas « sora » lors du contrôle direct. | Pas de fuite Sora constatée sur cette surface précise. |
| Comparaisons | 46 paires uniques déclarées dans les `publishedPairIds` du registre impliquent Sora ; présence aussi dans `compare-hub.json` et `compare-config.json`. | Inventaire de relations, pas 46 URL effectivement indexées prouvées. Réviser CTA, recommandations et sélection des paires. |
| Marketing et contenu | Mentions dans home, PAYG, workflows, MCP marketing, dictionnaires EN/FR/ES, galeries, fiches d'autres modèles et articles « accès sans invitation ». | Une modification du registre ne réécrit pas les textes éditoriaux. |
| Historique et médias | Adaptateur, webhooks et persistance servent aussi la récupération des travaux antérieurs. | Garder les identités et lecteurs historiques ; ne pas supprimer massivement « sora ». |

### Propriétaires techniques et points sensibles

- `frontend/config/model-registry.json:2387` et `:2463` : seules sources de politique pour les deux modèles. Suivre `docs/engineering/model-registry.md` ; régénérer les projections, ne pas les éditer.
- `frontend/src/lib/engines.ts:40` : filtre application à partir de `surfaces.app.enabled`. `frontend/app/api/generate/_lib/route-context.ts:222` résout le moteur public ; l'accès caché y est réservé à d'autres familles/private engines. Le retrait de publication doit donc fermer le chemin public Sora, à vérifier par tests.
- `frontend/src/server/agent-api/model-catalog.ts:173` : `deep_legacy` garde les détails historiques exacts mais exclut l'exécution. `prepare-generation.ts:428` et `confirm-generation.ts:357` relisent les moteurs éligibles ; la confirmation vérifie encore cette éligibilité avant consommation d'un devis préparé. Tester explicitement un devis Sora antérieur au retrait.
- `tests/mcp-model-recommendations.test.ts:86` affirme actuellement que Sora reste exécutable sur choix exact. Ce contrat doit évoluer avec le retrait. `tests/mcp-model-catalog.test.ts:236` suppose également sa présence dans le catalogue de génération.
- `frontend/src/server/engine-configuration-projection.ts:144` : le verrou opérationnel est `engine_overrides.active=false`. Les simples valeurs `status=maintenance` ou `availability=paused` ne constituent pas ce filtre. L'override est un secours immédiat ; la politique durable doit rester dans le registre.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx:182` : le fallback des cartes d'un moteur désactivé reprend potentiellement un CTA authored. Les contenus Sora contiennent des liens vers l'application ; vérifier et remplacer ces liens, sans supposer que le flag application suffit.
- `frontend/components/marketing/home/HomeConversionSections.tsx:352` et les dictionnaires contiennent encore des promesses commerciales Sora. La liste `EXAMPLE_ENGINE_PRIORITY` contient aussi Sora, mais sa présence dans cette liste ne prouve pas son affichage dans les cinq vidéos du hero.
- `frontend/server/fal-webhook-handler.ts` conserve les traitements de copie/persistance et les échecs de copie des sorties. Ne pas fermer ces voies en même temps que les soumissions.

## Stratégies comparées

| Option | Avantage | Limite | Avis |
| --- | --- | --- | --- |
| Attendre la coupure fournisseur | Quelques jours d'accès supplémentaires | Heure inconnue, devis et jobs en cours, déploiement de dernière minute | Déconseillé |
| `deep_legacy`, génération et prix désactivés, pages d'archive utiles | Compatible avec les contrats existants, conserve URL et historique, alternatives explicites | Nécessite de reprendre CTA, prose, offres structurées et galeries | **Recommandé immédiatement** |
| `retired` avec remplacement et 301 | Mécanisme de retraite existant | Oblige à choisir un modèle courant comme destination ; aucune équivalence universelle à Sora | Seulement après décision éditoriale et données de trafic |
| Suppression brute des modèles/fichiers | Apparence de nettoyage | Risque pour historique, récupération, médias et liens | À éviter |

Le registre actuel exige une destination `replacement` pour `retired`. Employer `deep_legacy` comme état technique d'archive n'empêche pas d'afficher clairement « Sora n'est plus disponible à la génération ». Garder `successorId=null` tant qu'aucun successeur unique n'est choisi. Une URL d'archive utile peut rester indexable avec canonical stable ; cette recommandation n'est pas fondée sur des chiffres GSC, non consultés pendant cet audit.

## Plan d'exécution proposé

### 1. Fermeture et message utilisateur — dès le 21 septembre

1. Passer les deux identités en `deep_legacy`, `publication.app.published=false`, `publication.pricing.published=false`, maintenir `examples.current=false`, nettoyer les rangs/labels de publication selon la validation du registre. Conserver les IDs, alias et définitions nécessaires à l'historique.
2. Régénérer runtime, catalogue et rosters avec les commandes officielles. Un déploiement doit porter registre et projections ensemble.
3. En cas d'attente du déploiement, utiliser l'override admin `active=false` pour les deux identités comme fermeture opérationnelle explicite. Cette action n'a pas été effectuée par l'audit.
4. Afficher en EN/FR/ES : arrêt fournisseur le 24 septembre, nouvelles générations fermées par MaxVideoAI, accès aux résultats existants, lien vers le choix d'un modèle compatible. Remplacer tous les CTA de génération Sora et prix présentés comme achetables.
5. Pour les anciens liens, favoris, données navigateur, projets Studio et recréations : expliquer l'indisponibilité et demander le choix d'un autre modèle. Conserver prompt et références lorsque compatibles ; recalculer les options et le devis. Ne jamais remplacer silencieusement le moteur d'une commande payante.
6. Préserver l'idempotence : répéter une confirmation déjà acceptée doit retrouver son job, sans créer ni débiter une nouvelle génération.

### 2. Marketing, SEO et découverte — avant le 23 septembre

1. Conserver les pages modèles comme archives factuelles et localisées, avec alternatives disponibles. Retirer toute offre achetable ou affirmation de disponibilité dans JSON-LD, metadata et FAQ.
2. Retirer Sora des mises en avant commerciales, prix, sélecteurs exécutables et propositions automatiques. Conserver les comparaisons historiques seulement si elles sont clairement contextualisées et ne poussent plus à générer avec Sora.
3. Réviser les articles « sans invitation », guides de prompts, pages exemples, liens des autres modèles, surfaces MCP et exports de contenu. Préserver l'attribution Sora des vidéos réellement créées avec ce modèle.
4. Vérifier canonical, hreflang, sitemap et anciennes URL EN/FR/ES. Ne pas ajouter de redirections manuelles hors registre. Un retrait du sitemap seul ne retire pas une page de l'index.
5. Si une modification touche réellement le média critique du hero, appliquer le guide média et ses contrôles de performance ; aucune réencodage/remplacement massif n'est nécessaire à ce retrait.

### 3. Travaux existants et médias — avant la coupure

1. Inventorier en lecture seule les jobs Sora en attente/en cours, leurs réservations et remboursements, ainsi que les comptes concernés. Les volumes ne sont pas connus dans cet audit.
2. Vérifier les originaux et références stockés dans `app_jobs`, `job_outputs`, `media_assets` et les éventuelles projections `user_assets`. Distinguer stockage durable MaxVideoAI, URL fal et URL temporaires OpenAI.
3. Copier uniquement les résultats dépendant encore d'un fournisseur quand nécessaire, avec périmètre explicite et contrôle de propriété. Vérifier originaux, posters, téléchargement et lecture. Ne pas confondre derivative de lecture et original téléchargeable.
4. Continuer polling/webhooks des jobs acceptés ; traiter les échecs et remboursements par les mécanismes idempotents existants. Ne pas marquer arbitrairement tous les jobs Sora comme échoués.
5. Au 24 septembre, vérifier zéro nouvelle soumission Sora, pas de débit sur refus, récupération des anciens résultats et état des jobs résiduels. Aucun suivi automatique n'a été créé.

## Choix d'alternatives

Orientation précisée par l'utilisateur pendant l'audit : **Seedance 2.5, MiniMax H3 et Wan 3**. « Sidance » et « One 3 » sont interprétés comme Seedance et Wan. Ces trois identités sont déjà `current`, publiées dans l'application et dans les prix du registre local. Leurs pages publiques MaxVideoAI et leurs pages fournisseur ont été consultées.

| Alternative prioritaire | Orientation proposée pour la page de sortie | Vérification avant génération |
| --- | --- | --- |
| [Seedance 2.5](https://maxvideoai.com/models/seedance-2-5) | Premier choix à examiner pour les plans longs et les projets utilisant plusieurs références ; le moteur local déclare jusqu'à 30 secondes. | Mode, références admises, durée/résolution du routage effectif et devis. |
| [MiniMax H3](https://maxvideoai.com/models/minimax-h3) | Autre choix principal pour génération depuis texte, image ou références avec audio ; le moteur local déclare jusqu'à 15 secondes. | Capacités par mode, résolution et devis ; conserver la distinction H3 / H3 Max. |
| [Wan 3](https://maxvideoai.com/models/wan-3) | Troisième option pour texte/image/références et les parcours qui nécessitent édition ou extension, présents dans sa définition locale. | Mode réellement disponible en production et contraintes des entrées ; ne pas présenter Wan 3 Prime comme identique. |

Sources fournisseur : [Seedance 2.5](https://fal.ai/models/bytedance/seedance-2.5/text-to-video), [MiniMax H3](https://fal.ai/minimax-h3), [Wan 3](https://fal.ai/wan-3). Ces modèles ne sont pas des remplaçants officiels OpenAI. La consultation des pages fournisseur ne certifie pas la disponibilité du compte/routage MaxVideoAI. L'ordre ci-dessus est une orientation éditoriale, pas un classement qualitatif mesuré. Aucun benchmark ni classement de prix n'a été réalisé ici ; ne pas qualifier Wan 3 de « moins cher » sans comparaison de devis identiques.

Sur les archives Sora, proposer les trois choix avec un bouton « Choisir ce modèle » puis une configuration et un nouveau devis. Pour une demande précise, filtrer selon mode, durée, résolution, audio et références réellement exécutables ; un autre modèle courant peut être préférable si aucun des trois ne satisfait la demande. Utiliser la recommandation MCP et un nouveau devis plutôt qu'un remplacement global de Sora par un ID fixe. Garder les URL Sora comme archives et `successorId=null` : cette sélection de trois alternatives n'établit pas un successeur unique.

## Validation et limites

Vérifications de l’audit initial, avant implémentation :

- `pnpm model:registry:check` : succès ; 55 modèles, 2 tombstones, projections cohérentes.
- `tsx --tsconfig frontend/tsconfig.json --test tests/mcp-model-recommendations.test.ts tests/model-page-publication.test.ts` : **20 tests réussis**. Ils confirment l'état actuel, pas une fermeture déjà implémentée.
- HTTP public : trois routes localisées et `llms.txt`, contrôles décrits plus haut.

Contrôles à ajouter/exécuter lors de l'implémentation : génération et preflight refusés sans appel fournisseur ni débit pour les deux modèles ; détails MCP historiques avec `generationEnabled=false` ; préparation refusée ; devis antérieur refusé à confirmation ; confirmation déjà acceptée récupérable ; absence de CTA Sora exécutable, y compris prompting/recréation/Studio ; historique et téléchargements conservés ; validation des alias sans soumission vers un autre modèle ; tests registre/publication, lint, exposition, build et smoke tests EN/FR/ES.

Non vérifiés : réglages privés de production, disponibilité réelle par génération, état des jobs/portefeuilles, durabilité de chaque média, trafic et conversions Sora, heure de coupure fournisseur. Il n'est donc pas établi que chaque compte peut encore générer aujourd'hui, ni que toutes les vidéos existantes sont déjà archivées durablement.

## Implémentation après accord utilisateur

La fermeture anticipée est implémentée localement. Elle prendra effet en production au déploiement de ce changement, et non par un minuteur le 24 septembre. Aucune génération payante ni écriture de données de production n’a été exécutée pour cette intervention.

- Sora 2 et Pro sont `deep_legacy`, absents des sélecteurs et prix actifs. Les API normales et trusted refusent une nouvelle génération avant facturation ou appel fournisseur. MCP invalide les devis encore préparés ; une confirmation déjà acceptée reste récupérable.
- L’atelier conserve une ancienne sélection Sora avec un message demandant de choisir un autre modèle. Studio ne remplace pas ses capacités par celles du premier modèle disponible. Les jobs, références média et mappings de polling/webhook restent inchangés.
- Six pages modèle EN/FR/ES deviennent des archives, sans offre Product ni CTA Sora. Elles proposent Seedance 2.5, MiniMax H3 et Wan 3, avec les liens locaux vers les exemples et la bibliothèque. Les URL et comparaisons historiques restent publiées.
- Les contrôles des comparateurs respectent la fermeture ; leurs recommandations excluent les archives. Les promesses d’accès, prix actifs, FAQ d’accueil et articles d’accès Sora ont été corrigés. Les tutoriels et exemples conservés sont signalés comme historiques.
- Les fixtures financières historiques restent intactes. Le contrôle public applique explicitement le retrait de 22 lignes achetables et la suppression des deux offres Sora ; les audits hors ligne conservent les scénarios historiques.

Validation sur un checkout isolé des changements de connexion présents en parallèle : **5 688 tests de la suite principale réussis**, build de production réussi, 539 tests Studio réussis, registre/projections, lint, exposition, i18n, SEO et baseline publique des prix conformes. Après une dernière correction de formulation des FAQ comparatives, 34 tests comparateurs réussis. Les tests d’intégration Studio supplémentaires nécessitent un commit local et l’absence de fichier d’environnement ; leur résultat sera consigné séparément.

Les contrôles HTTP locaux couvrent les six archives (200, canonical, hreflang, trois alternatives, lien exemples localisé, aucune offre Product) et deux comparatifs Sora (200, aucun lien de génération Sora). La revue indépendante a fait corriger les CTAs des showdowns, un garde de comparaison, le fallback Studio et les liens localisés vers les exemples.

Le build initial du checkout partagé passait ; un second build a rencontré un fichier généré Next.js manquant pendant l’activité parallèle de serveurs. Le build isolé passe. Un test de connexion échoue dans le checkout partagé en raison des changements d’authentification hors de ce périmètre ; il passe dans le snapshot Sora isolé. Ces changements parallèles n’ont pas été modifiés.

Limites opérationnelles : **non déployé**. Avant la coupure fournisseur, vérifier en production l’état des jobs résiduels et la durabilité de leurs originaux ; ce changement préserve les lecteurs et données existants mais ne certifie pas individuellement les objets stockés. Aucun monitoring récurrent n’a été créé.
