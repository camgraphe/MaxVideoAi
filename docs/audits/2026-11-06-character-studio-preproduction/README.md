# Character Studio — décision avant production

Audit du **6 novembre 2026, 00:58 Europe/Madrid**. Candidat : `codex/character-studio-v2`, commit `c1bc6d0623ab34ad1868b6a71718b0d04adecf30`, [PR 619](https://github.com/camgraphe/MaxVideoAi/pull/619).

**Décision : poursuivre en preview. Les contrôles financiers, SEO et CI passent, mais l’intégration complète à MCP/Studio et la préparation de production ne sont pas terminées.** Aucun déploiement, changement de production ou rendu payant n’a été effectué pendant cet audit. Les seuls ajouts sont ce dossier de preuves, des médias synthétiques de test et une insertion gratuite dans une timeline de la base de test.

Preview Git immuable vérifiée READY : <https://maxvideoai-etzqid8op-camgraphes-projects.vercel.app>, déploiement `dpl_FQunBhAQ3FpNSEumY2mpCEVbHch3`. Les tests navigateur authentifiés utilisent son alias `character-studio-test`, ouvert à côté dans Codex. La base et le stockage test restent distincts de la production.

## Ce qui bloque une livraison complète

| Priorité | Constat actuel | Condition pour lever le blocage |
| --- | --- | --- |
| P1 | Le candidat est en avance de 40 commits et en retard de **7 commits sur main** (`f868a026…`). | Incorporer le main courant puis qualifier le nouveau commit. Une simulation `git merge-tree` réussit sans conflit ; aucun merge n’a été effectué. |
| P1 | Inventaire Neon production en lecture seule : tables des migrations **93–95 absentes** et **aucune règle précise Recast**. | Migration explicite et configuration commerciale ×2 dans l’environnement cible avant exposition du produit ; vérification devis/débit/page tarifs après installation. |
| P2, bloquant pour la promesse MCP/Studio complète | Le bouton Character → Studio est masqué pour les véritables identifiants de résultats ; ni MCP ni Studio ne sait sélectionner un personnage/look enregistré par son identité ni préparer le produit Recast avec son tarif dédié. | Corriger le passage résultat → média propriétaire, brancher la bibliothèque de personnages et les adaptateurs Recast sur les propriétaires existants. Conserver les scopes OAuth/projet/session et le consentement au devis. |
| P2, bloquant pour les films marketing demandés | Production : ni playlist `character-studio-recast`, ni copie marketing des deux ID relus. Le publisher actuel travaille dans sa propre base. | Préparer une publication inter-environnements bornée aux deux copies indépendantes et leur placement. Ne pas copier jobs, comptes ou portefeuille de test. Sans cette étape, images de secours sur Home/landing/blog et absence du bloc films dans Explorer. |
| Qualification finale | Pas de nouveau rendu réel sur ce candidat avec la tarification ×2 ; pas de nouvelle comparaison Core Web Vitals ni de test physique iOS/Android. | Après corrections, essai réel limité et chiffré soumis à validation ; vérification polling, stockage, rendu, reçu et visibilité ; mesures avant/après comparables et tests tactiles. |

Les migrations et le tarif manquants sont des prérequis de livraison, pas une panne actuelle de la production. L’audit ne les a pas appliqués.

## Résultats frais

| Domaine | Résultat | Limite de preuve |
| --- | --- | --- |
| Quality CI | **Tous les contrôles requis réussis** sur le SHA audité : fast, intégration DB/médias, deux lots navigateur, exhaustive financial cutovers et gate Quality CI. [Run 42128806072](https://github.com/camgraphe/MaxVideoAi/actions/runs/42128806072). | Le prochain commit intégrant main doit passer sa propre CI. Le contrôle externe planifié est volontairement ignoré dans ce run. |
| Finances/admin/bibliothèque | **86 tests passés**, dont 68 sur PostgreSQL 17 jetable : doublons, solde insuffisant, expiration, changement de tarif, réponses perdues, remboursement unique, isolation comptes, historique admin. | Fournisseur et parties du stockage simulés ; aucun nouveau paiement fournisseur. |
| Descriptions/New/changement de compte | **48 tests passés** : effacement des champs libres et cachés, persistance du brouillon neuf, réouverture sans ancien job, réponses tardives et séparation entre comptes. | Tests DOM/composants et état persisté ; pas une nouvelle campagne manuelle de 20 utilisateurs. |
| Passages et prix UI | **12 tests passés**, dont préparation FFmpeg des passages ; parcours réel de sélection et devis reproduit dans le navigateur. | Arrêt avant confirmation payante. |
| MCP/Studio partagé | **212 tests ciblés passés** ; `mcp:client:check` : 194 passés, 1 ignoré (validateurs d’authoring absents), puis 70 fixtures et 39 règles réussies. Une reproduction DOM supplémentaire confirme le bouton Studio manquant. | Les suites valident les fonctions présentes, pas les adaptateurs Character/Recast absents ni la découverte dans un hôte MCP réel. |
| SEO/marketing | **76 tests passés**, gardes SEO et médias réussies ; **21 pages EN/FR/ES en HTTP 200**, canonicals, hreflang, JSON-LD, sitemaps et chemins historiques contrôlés. | Pas de garantie de classement/indexation ; GSC/Outreach est un baseline daté, pas une extraction en direct. |

Ces lots se recouvrent : leurs nombres ne doivent pas être additionnés pour annoncer un total de tests distincts.

## Parcours navigateur, étape par étape

Captures originales : `output/character-studio-v2/preproduction-2026-11-06/`. Les fichiers illustrent les observations du présent audit, pas une maquette.

1. **Entrée Recast — utilisable.** L’estimation apparaît sans avoir tout rempli : 6 s / 720p / sans vidéo source = **1,68 USD**. Les deux prérequis manquants sont explicités et cliquables. Generate reste inactif jusqu’à leur satisfaction. Capture [01](../../../output/character-studio-v2/preproduction-2026-11-06/01-recast-readiness.png).
2. **Passage vidéo — conforme.** Fichier synthétique de 20 s, sélection **5,25–12,75 s**, soit **7,50 s**. L’interface propose 8 s de sortie. Capture [02](../../../output/character-studio-v2/preproduction-2026-11-06/02-video-passage.png).
3. **Passage audio — indépendant et conforme.** Autre fichier de 20 s, sélection **10,00–15,25 s**, soit **5,25 s**. L’audio ne remplace pas les bornes vidéo. Capture [03](../../../output/character-studio-v2/preproduction-2026-11-06/03-audio-passage.png).
4. **Personnage et devis — conformes jusqu’à confirmation.** Vesper Velours / identité d’origine choisi dans la bibliothèque. Le POST de préparation contient les deux plages distinctes et 8 s de sortie ; réponse 200 : source 7,5 s, audio 5,25 s, **4,34 USD en 720p**. Passer en 1080p invalide le devis précédent, puis un nouveau devis exact indique **8,68 USD**. Aucun bouton de confirmation payante n’a été cliqué. Capture [04](../../../output/character-studio-v2/preproduction-2026-11-06/04-exact-price.png), preuve normalisée `browser-excerpt-quote.json`.
5. **Historique — présent ; continuation à améliorer.** My videos mène à `/app`, où Dixie et Vesper apparaissent avec leurs coûts historiques **5,46 / 5,10 USD**. Ces anciens reçus ne sont pas réécrits au nouveau coefficient. Le menu propose les transformations vidéo mais pas de passage direct Studio dans ce dialogue. Captures [05](../../../output/character-studio-v2/preproduction-2026-11-06/05-recast-history.png) et [06](../../../output/character-studio-v2/preproduction-2026-11-06/06-recast-destinations.png).
6. **Studio via Media — fonctionne pour un média existant.** Add media → Library → `basil-look.png` → Add to timeline : image insérée sur 5 s, puis retrouvée après rechargement. Solde affiché inchangé ; aucun message Milo/génération/export lancé. Projet test `project_84a9ae28-42fe-4fff-ae8f-3dc7578c4c65`. Cela valide l’import générique, pas la sélection d’un personnage et de ses looks par leur identité. Capture [07](../../../output/character-studio-v2/preproduction-2026-11-06/07-studio-persisted.png).
7. **Mobile 390 × 844 — guidage initial conforme.** Prix et Generate restent visibles ; « Add a direction or a passage » amène le focus au champ manquant, sans débordement horizontal visible. Le footer occupe une part importante de la hauteur : clavier virtuel et sélection de passages sur vrais téléphones restent à qualifier. Viewport remis à sa taille normale. Capture [08](../../../output/character-studio-v2/preproduction-2026-11-06/08-mobile-required-fields.png).

Le rechargement de Recast a effacé la préparation non confirmée, et non déclenché une génération. Les fichiers synthétiques chargés pendant l’audit ne sont pas des contenus marketing. Le projet Studio de test est conservé pour reproduction.

## Prix observés et cohérence commerciale

| Scénario | 720p | 1080p | Preuve |
| --- | ---: | ---: | --- |
| 6 s générées, aucune vidéo source | 1,68 USD | 3,36 USD | Page tarifs et estimateur de preview |
| 8 s générées + 7,5 s vidéo source + 5,25 s audio de référence | 4,34 USD | 8,68 USD | Deux devis exacts préparés dans le navigateur |
| 15 s générées + 15 s vidéo source | 8,40 USD | 16,80 USD | Page tarifs et tests du propriétaire de facturation |

Le coefficient Recast ×2 porte sur le coût fournisseur de la vidéo source et de la vidéo générée, avec arrondi monétaire. L’audio de référence ne s’ajoute pas aux secondes vidéo facturées. Marge brute nominale : **50 % avant frais et charges d’exploitation**, sans prétendre certifier une facture fournisseur. Le tarif natif des images Nano Banana 2.1 reste un produit distinct. Les contrats images vérifient aussi devis, réservation et reçu 1K/2K/4K ; ce rapport ne présente pas leur fixture comme un inventaire actuel du tarif de production.

## SEO : conserver l’acquis sans promettre l’absence de fluctuation

- URL des articles et landings conservées ; langues, maillage, sitemaps et schémas contrôlés. Le `noindex` de preview est attendu ; il ne doit pas être transposé par erreur aux pages publiques de production.
- **Six descriptions et trois titres de guides de fiche changent réellement.** Les trois titres des guides de cohérence restent conservés. Consigner le changement et sa date dans Outreach / `SEO-EXP-002` ; vérifier accès/recrawl à J+7 et comparer 28 jours complets au même périmètre.
- Les deux copies vidéo de preview répondent anonymement en 200/206 Range. Leur poids est d’environ 17,8 et 34,1 Mo : conserver posters, géométrie et lecture manuelle `preload="none"`. L’audit n’établit pas de gain LCP/CLS/INP ni la lecture complète/son sur chaque appareil.
- Pour les fonctions IA de Google, les principes SEO existants restent applicables ; aucun schéma spécial ni `llms.txt` supplémentaire n’est requis ([documentation officielle](https://developers.google.com/search/docs/appearance/ai-features)). Cela ne certifie pas le comportement de tous les LLM ni leur trafic futur.

## Prochaine séquence de travail

1. **Aligner la branche sur main et corriger les trois intégrations.** Résolution des résultats Character vers Media/Studio ; bibliothèque personnages/looks accessible aux consommateurs autorisés ; Recast dédié dans MCP/Studio avec le même devis commercial. Garder les autres modèles et leurs tarifs indépendants.
2. **Rejouer la matrice gratuite sur le nouveau commit.** Identité/look/fiche → Recast → historique → Studio ; New et réouverture ; deux comptes ; références produit ; extraits décalés ; formats/résolutions ; changement de devis ; paiements simulés. Vérifier découverte et récupération dans une session MCP réelle. CI complète requise sur ce SHA.
3. **Qualifier les médias et l’exploitation.** Premier Play/seeking/son sur ordinateur et mobiles, pas de téléchargement MP4 avant Play ; mesures comparables de performance ; protocole de publication de Dixie/Vesper ; migrations 93–95, réglage admin ×2, stockage privé, flags fournisseur et poller préparés pour la cible, sans les appliquer implicitement.
4. **Faire une recette réelle limitée dans la preview finale.** Présenter scène, passages et devis exact, puis seulement après validation lancer le rendu. Fermer/réouvrir, vérifier un seul débit, résultat durable, bon compte et retour Studio ; image/look/fiche qualifiés séparément. Les anciens rendus ne certifient pas les dernières modifications.
5. **Livrer uniquement avec toutes les preuves.** Branche isolée → PR → Quality CI → merge main → Vercel Git. `deployment:check` avant merge, puis vérifier `maxvideoai.com` et `api.maxvideoai.com` au SHA fusionné. Installer les prérequis avant exposition ; observer erreurs, devis, reçus et visibilité. En repli, arrêter les nouvelles commandes tout en conservant polling/historique des jobs acceptés ; ne pas supprimer les tables ni relancer aveuglément une commande ambiguë.

## Rapports spécialisés

- [Finances, admin, inventaire production et runbook](financial-release.md)
- [MCP/Studio : comportement existant, trois écarts et correctifs minimaux](mcp-studio.md)
- [SEO, marketing, médias et baseline Outreach](seo-marketing.md)

Limites : ce tour couvre les responsabilités modifiées et leurs contrats, pas un audit de sécurité exhaustif de toute l’application, une certification WCAG, un pentest, une garantie de qualité générative ni une mesure actuelle des classements Google. Aucune production n’a été modifiée.
