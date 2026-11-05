# Kling 4.0 Flash et GPT Image 2.6 — conception du lancement

Date : 5 novembre 2026, Europe/Madrid. État : proposition concrète, à relire avant implémentation.

## Résultat attendu

Ajouter Kling 4.0 Flash et les deux modèles image GPT Image 2.6 Flare/Sunburst à MaxVideoAI, avec un lancement complet : génération, devis, bibliothèque, App, Studio conversationnel, MCP, pages publiques et marketing. Suivre les propriétaires et les étapes des lancements Kling 4 et Nano Banana 2.1, plutôt que considérer l'ajout au sélecteur comme la fin du travail.

L'utilisateur a choisi le premier lot image : génération et retouche d'images fixes dans App, Studio et MCP. GIF, SVG et retouches guidées par annotation appartiennent à un second lot. Le contrôle `complexity`, distinct de `quality`, appartient au premier lot des images fixes.

## Approches et décisions

1. **Parité avec la production et lancement image en deux lots — retenu.** Flash réutilise la chaîne fal réellement déployée pour Kling 4. Les images 2.6 utilisent l'API Images d'OpenAI et la clé existante du projet si le test de génération et la configuration de déploiement confirment l'accès. Les formats supplémentaires attendent le second lot choisi par l'utilisateur.
2. **Kling direct en priorité avec secours fal — non retenu pour cette reproduction.** C'est le fonctionnement disponible pour Kling 3/O3, pas pour Kling 4 dans la source de production vérifiée. Construire et qualifier un nouveau transport Kling 4 direct serait une extension distincte, avec son authentification, ses contrats et sa parité de secours.
3. **Toutes les nouveautés image dès le lancement — reporté par l'utilisateur.** GIF/SVG/annotations impliquent des adaptations de stockage, affichage, entrées, bibliothèque et Studio. Aucun de ces formats ne sera annoncé disponible dans le premier lot.

Les noms/identités proposés par l'implémenteur sont `kling-v4-flash`, `gpt-image-2-6-flare`, `gpt-image-2-6-sunburst`, avec les mêmes slugs. Le nom public du modèle vidéo est **Kling 4.0 Flash** : « Fast » était le nom utilisé dans la demande. Aucun alias public fictif n'est nécessaire.

## État vérifié et limites de la preuve

- Les deux domaines `maxvideoai.com` et `api.maxvideoai.com` servent le déploiement Git READY `dpl_7fdiAB89wbJCq6rzDMzhhhtf3vQC`, commit `cd6cc4c77c7c17c352e62e62d2609b52b199f2ee`, branche `main`.
- Cette source route Kling 4 sur fal : `kling/v4/*`. Le registre de transport direct Kling n'inclut que Kling 3/O3. Le lancement historique indique explicitement le choix fal-first du 22 octobre.
- Les trois schémas publics fal Flash ont été lus le 5 novembre : T2V, I2V, Reference-to-Video. Leur publication ne prouve pas l'accès payant du compte à chacun de ces modes.
- Un GET authentifié, sans génération, vers OpenAI `/v1/models` répond 200 avec la clé locale existante et contient les deux IDs 2.6. Cela ne prouve ni une génération réussie, ni la configuration exacte de la clé dans Vercel Production/Preview.
- Aucun tarif client, certificat de mode, média de démonstration, activation ou déploiement n'a été créé dans cette phase de recherche.
- Le MCP live expose les quatre modes Kling 4 et les deux modes de chaque GPT Image 2.5. Studio certifie actuellement Flare 2.5 mais pas Sunburst 2.5 : les deux nouvelles variantes 2.6 nécessitent une validation Studio explicite.

## Contrat Kling Flash du premier lot

| Mode | Entrées et contrôles | Limites spécifiques |
| --- | --- | --- |
| T2V | Prompt obligatoire, durée, résolution, ratio | 3–20 secondes entières ; 720p ; 16:9, 9:16, 1:1, 21:9 |
| I2V | Image de départ obligatoire ; prompt facultatif ; durée, résolution | Pas d'image de fin ; pas de ratio forcé indépendant de la source |
| REF2V | Prompt, images/vidéos/sujets possédés par le compte ; départ facultatif ; durée, résolution, ratio dont auto | 10 images, 5 vidéos, 7 sujets dont au plus 3 sujets vidéo ; vidéos et sujets vidéo : 20 secondes cumulées |

Les limites de taille, dimensions, ratio et cadence des sources sont validées à partir des originaux possédés et des schémas fal. Conserver l'ordre, les répétitions et l'identité des références ; aucune troncature silencieuse. Une image de départ compte dans le plafond d'images. Vérifier le plafond mixte exact avec le contrat et les tests avant publication : ne pas recopier mécaniquement le plafond V4 ou celui de V3.

Ne pas proposer Modify, Extend, image finale, tableaux de keyframes, voix liées ou `multi_prompt` structuré : ils ne sont pas présents dans les trois schémas Flash lus. Un prompt textuel décrivant plusieurs plans reste un prompt ordinaire. Ne pas ajouter de réglage FPS, seed, CFG, negative prompt ou interrupteur audio absent du contrat.

Réutiliser la soumission unique en queue de Kling 4, la persistance immédiate du reçu fournisseur, le polling/webhook/cron, la récupération et la comptabilité. Une réponse ambiguë ne déclenche jamais une seconde génération. Ne pas changer le routage des modèles existants.

## Contrat GPT Image 2.6 du premier lot

- Deux identités distinctes, chacune en `t2i` et `i2i`, avec `gpt-image-2.6-flare` / `gpt-image-2.6-sunburst` comme IDs OpenAI.
- Adaptateur serveur pour `/v1/images/generations` et `/v1/images/edits`. Le provider réel doit être explicite ; aucune dépendance artificielle à une clé fal ni fausse route fal pour ces modèles directs.
- Sorties raster PNG/JPEG/WebP, qualité explicite `low`, `medium`, `high`, `xhigh`, `max`, paramètres compatibles de fond/transparence, dimensions et nombre d'images bornés par le contrat fournisseur et les limites produit. Revalider chaque option avant de l'activer ; ne pas extrapoler la prise en charge depuis 2.5.
- Ajouter `complexity: low|medium|high` au schéma partagé et aux snapshots/détails/devis. Proposition : valeur explicite `high` par défaut, qui correspond au défaut officiel. Un changement de réglage invalide la confirmation précédente même si son prix est identique.
- Garder les limites propres à chaque surface : Studio retourne actuellement une image par action et limite ses références ; il ne doit pas annoncer automatiquement le maximum de l'API.
- Références privées résolues côté serveur, bornées et vérifiées avant devis puis à confirmation. Le masque existant, s'il est proposé, nécessite son contrat et ses validations ; `markup` et les formats du second lot restent refusés.
- Réutiliser le job interne, la réservation, l'idempotence, les résultats partiels, les reçus et le stockage d'originaux. Enregistrer l'usage réel OpenAI sans réécrire le prix client déjà confirmé. Définir le comportement d'une réponse ambiguë et des délais avant ouverture ; ne jamais relancer automatiquement une requête potentiellement acceptée.

L'adaptateur direct est un ajout réel : le dispatcher image actuel admet Vertex et BytePlus, alors que GPT Image 2.5 utilise fal. Un simple changement de nom dans le catalogue ne suffit pas.

## Prix et exploitation

Le tarif fournisseur Flash publié est de 0,094 USD par seconde pour T2V/I2V et les références sans vidéo. Avec une vidéo de référence, la page fal indique 0,063 USD × [secondes de sortie + max(secondes vidéo d'entrée, secondes de sortie)]. Les sujets vidéo doivent être inclus dans les faits mesurés lorsqu'ils sont facturables. Garder la précision avant arrondi et distinguer coût fournisseur, prix LIST et prix client.

OpenAI publie pour les deux 2.6 les mêmes taux par million de tokens : texte entrant 5 USD, image entrante 8 USD, image sortante 30 USD ; les tarifs de cache sont séparés. **Des taux identiques ne garantissent pas un coût par image identique à 2.5.** Les quantités de tokens dépendent du modèle, de la qualité, de la taille et des entrées. Pas de copie de la matrice fal 2.5 ni de son supplément par référence.

Préparer une matrice inactive via les propriétaires canoniques, avec scénarios, provenance, hypothèses de coût et risques de marge. Le +30 % historique de Kling 4 est un candidat commercial à présenter, pas une approbation transposable de nouveaux montants. Les valeurs exactes seront soumises dans le flux admin preview/confirmation avant activation. Pas de SQL ad hoc ni de revalorisation de jobs historiques.

Les essais payants et la production de médias nécessitent un lot concret : prompts, réglages, nombre maximal de tentatives, devis/prix ou plafond explicite, puis confirmation. Les lectures et tests locaux se poursuivent sans dépense. Un remboursement n'autorise pas une nouvelle tentative.

## Surfaces et propriétaires

| Surface | Travail requis |
| --- | --- |
| Registre et catalogue | Trois identités dans `frontend/config/model-registry.json`, définitions d'exécution, projections générées ; publication par surface et badges cohérents |
| App vidéo/image | Sélection, schémas, devis, validations, références, paramètres sauvegardés, états de chargement/erreur, récupération, recréation depuis l'historique |
| Bibliothèque / Activity | Modèle exact, originaux, vignettes et aperçus adaptés, téléchargement, réemploi image→vidéo, isolation du compte |
| Studio conversationnel | Certification des modes exacts ; découverte/détails, préparation, confirmation, reprise après reload, médias et réemploi dans le projet ; conserver les limites de sortie/références propres à Studio |
| MCP | Disponibilité par provider et environnement ; list/details/recommend/budget/prepare/confirm/status/recover ; schémas, prix et références identiques aux propriétaires partagés |
| Milo / assistance | Guides factuels et application de réglages compatibles ; pas de paramètre inventé, pas de recommandation héritée automatiquement d'une version précédente |
| Outils spécialisés | Auditer Storyboard, Character Studio, Angle et autres consommateurs ; préserver leurs modèles/forfaits dédiés, adapter seulement une sélection réellement ouverte à ces modèles |
| Administration | Prix, inventaires de modèles, reçus fournisseur, remboursements, galerie et collections par modèle, journaux lisibles |
| Marketing/SEO | Trois pages × EN/FR/ES, catalogue, menus, familles, exemples réels, comparaisons ciblées, Pricing, Best-for/PAYG où pertinent, données structurées et découverte machine |

La politique éditoriale `agent-model-editorial-policy.json` est distincte de la publication et de la certification. Chaque nouvelle version commence sans note ni préférence de qualité héritée. Conserver les anciennes pages, médias, paramètres enregistrés, tarifs et identités ; aucune retraite de 2.5 ou de Kling 4 n'est décidée ici.

## Marketing concret

Préparer le positionnement Flash autour des brouillons vidéo en 720p et des trois modes réellement disponibles. Préparer Flare autour de l'itération rapide et Sunburst autour du détail/retouche, en attribuant les promesses fournisseur et en séparant nos mesures futures. Ne pas annoncer de vitesse chiffrée ni de supériorité sans test comparable.

Écrire les neuf contenus localisés avec leurs blocs `decision`, limites, cas d'usage, prompts, FAQ, liens, sources datées et prix canoniques. Comparaisons prioritaires proposées : Kling 4/Flash, Flare 2.6/Sunburst 2.6, 2.6/2.5 quand une mesure permet de guider le choix. Pas de déploiement de dizaines de comparatifs superficiels.

Préparer un petit corpus démonstratif par mode : Flash texte/image/références ; chaque image 2.6 en création et retouche du même sujet, avec mêmes briefs pour comparaison. Les prompts sont des brouillons tant que les rendus n'existent pas. Revue artistique, originaux possédés, coût réel, paramètres et reçus précèdent tout usage marketing. Ajouter aux collections sans effacer ni réordonner les choix existants. Une collection vide ne constitue pas une galerie prête.

Rédiger annonce sur site/blog, texte d'annonce et descriptions sociales réutilisables. L'envoi d'email ou la publication sur des comptes sociaux reste une action distincte nécessitant une instruction explicite. La homepage ne change de vidéo principale qu'après sélection et mesures comparables.

## Ordre de livraison et critères

1. **Contrats et base de production** : faits fournisseurs, accès, schémas, bilan des lancements précédents — recherche réalisée, essais payants à faire.
2. **Candidat privé** : adapters, identité, prix inactifs, App/Studio/MCP et tests, contenus marketing préparés. Garder découverte/exécution publiques fermées tant que les gates ne sont pas remplis.
3. **Qualification réelle** : lots approuvés, résultats et facturation vérifiés pour chaque mode annoncé ; restauration/recovery et isolement des comptes.
4. **Préparation commerciale et médias** : montants exacts confirmés dans l'admin, actifs revus, collections et liens contrôlés. Le pack technique n'est pas une activation commerciale.
5. **Ouverture fonctionnelle** : les trois surfaces App/Studio/MCP ont leurs admissions explicites, leurs devis et leur récupération qualifiés ; captures de découverte live après le déploiement.
6. **Publication marketing** : pages indexables, exemples, familles, comparatifs et liens ouverts avec leurs preuves ; anciennes URLs préservées.
7. **Livraison et observation** : PR GitHub, Quality CI sélectionnée complète, preview du commit exact, `pnpm deployment:check`, merge `main`, déploiement Git, vérification des deux domaines et parcours, monitoring et rollback.

Les deux familles peuvent être livrées par PR cohérente distincte ; un échec fournisseur d'une famille n'autorise pas à certifier l'autre par analogie. Les gates et la checklist restent par modèle/mode/surface.

## Vérification

S'appuyer sur `tests/gpt-image-2-5-integration.test.ts`, `tests/kling-v4-current-contract.test.ts`, `tests/kling-v4-queue-transport.test.ts`, `tests/kling-v4-admission-boundaries.test.ts`, les tests de recovery image, les matrices PostgreSQL Studio/MCP et les contrats du registre/SEO. Ajouter les régressions 2.6/Flash : options interdites, bornes, coût des références, original privé, confirmation périmée, soumission unique et reçu durable.

Exécuter les générateurs/checks du registre, lint frontend/exposure, types et tests ciblés ; puis les lanes CI imposées par `docs/engineering/ci-validation.md`, y compris financier exhaustif si sélectionné. Exercer les parcours dans l'application locale puis la Preview : mobile/desktop, EN/FR/ES, reload, références, devis et récupération. Aucun test local simulé ne sera présenté comme une génération fournisseur réelle.

Rollback par publication/admission ciblée et livraison Git normale. Garder tarifs, jobs acceptés, reçus, originaux et historique ; ne pas arrêter le polling des jobs déjà acceptés et ne pas provoquer de nouvelle soumission.

## Documents de référence

Relecture indépendante du dossier le 5 novembre : aucune question importante restante pour établir le plan d'implémentation. Cette relecture ne vaut ni approbation commerciale, ni qualification fournisseur, ni validation de code non encore écrit.

- `docs/launch/2026-11-05-model-refresh/TASKS.md` : checklist et preuves.
- `docs/launch/2026-11-05-model-refresh/PROVIDER-EVIDENCE.md` : sources et accès observés.
- `docs/launch/kling-v4/{PLAN,HANDOFF,PUBLIC-OPENING-PREPARATION,implementation-map,seo-linking-plan}.md` : étapes historiques, à distinguer de la publication actuelle.
- `docs/operations/nano21-mcp-public-routing-2026-10-27.md` : précédent d'activation MCP distincte.
- `docs/engineering/{model-registry,pricing-engine,studio-editor-architecture,mcp-mode-coverage,mcp-client-experience,media-delivery,ci-validation}.md`.
- `docs/deployment/github-vercel.md`.
