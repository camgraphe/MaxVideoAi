# Checklist — Kling 4.0 Flash et GPT Image 2.6

5 novembre 2026, Europe/Madrid. Conception : `../../superpowers/specs/2026-11-05-kling-flash-gpt-image-26-design.md`.

`[x]` signifie preuve obtenue dans cette session ; `[ ]` signifie travail à réaliser. Les trois colonnes de qualification à tenir pendant l'implémentation sont **App / Studio / MCP**, séparément pour Flash T2V/I2V/REF2V et les deux modèles image T2I/I2I. Une case « code prêt » ne clôt pas une case « disponible en production ».

## A — Base, contrats et accès

- [x] A01 Identifier les produits : Kling 4.0 Flash, GPT Image 2.6 Flare et Sunburst.
- [x] A02 Lire les guides de lancement et les précédents Kling 4/Nano Banana 2.1, ainsi que les contrats de production.
- [x] A03 Vérifier les deux domaines, le déploiement Git et le SHA de production ; base isolée créée au même commit.
- [x] A04 Distinguer le routage fal de Kling 4 du direct/fallback Kling 3/O3.
- [x] A05 Lire les trois schémas Flash, leurs limites et les prix fournisseur publiés.
- [x] A06 Vérifier en lecture seule la clé OpenAI existante : `/v1/models` 200, deux IDs 2.6 présents ; génération/retouche ensuite qualifiées dans A10.
- [x] A07 Consigner le choix utilisateur : raster création/retouche d'abord ; GIF/SVG/annotations dans le second lot.
- [x] A08 Finaliser les bornes de l'API Images 2.6 (dimensions, nombre de sorties, références, fond, compression, masque) et capturer des fixtures sans secret.
- [x] A09 Vérifier la configuration effective Production/Preview des providers sans exporter de secrets ; déterminer les admissions exactes nouvelles.
- [x] A10 Qualifier l'accès réel à chacun des sept couples modèle/mode par un lot payant approuvé ; conserver les reçus.

## B — Identité, providers et reprise

- [x] B01 Ajouter les trois identités/labels/slugs dans le registre authored et les définitions d'exécution ; préserver Kling 4 et GPT 2.5.
- [x] B02 Ajouter l'adaptateur Flash à trois modes ; limites strictes, références possédées, sujets et budget vidéo de 20 secondes.
- [x] B03 Réutiliser la soumission unique et les reçus de la queue V4, le polling/webhook/cron et la récupération après reload/timeout.
- [x] B04 Refuser les anciens réglages incompatibles Flash avant devis/débit ; ne pas les tronquer ni les envoyer silencieusement.
- [x] B05 Ajouter le provider OpenAI Images direct : clients, requêtes de création/édition, normalisation des résultats/usage et erreurs.
- [x] B06 Traiter durablement les réponses ambiguës, résultats partiels, erreurs de stockage et réservations image ; aucune relance automatique potentiellement doublonnée.
- [x] B07 Étendre les propriétaires d'admission, provenance fournisseur et monitoring pour OpenAI direct ; ne pas exiger fal pour ce chemin.
- [x] B08 Régénérer runtime/catalogue/rosters ensemble ; exécuter `pnpm model:registry:check`.

## C — Tarifs, compte et administration

- [x] C01 Calculer les faits Flash en précision décimale : sortie seule, images/sujets image, entrée vidéo/sujet vidéo et plancher fournisseur.
- [ ] C02 Établir les coûts image 2.6 propres au modèle, taille, qualité, nombre et sources ; ne pas recopier les estimations fal 2.5.
- [ ] C03 Couvrir les contextes admin/public/MCP/Studio, y compris dimensions personnalisées et quantités autorisées.
- [ ] C04 Préparer une matrice commerciale inactive, les arrondis et exemples de prix ; faire valider les montants concrets dans l'admin.
  Flash : 72 previews natives à la révision 2115, avec les lecteurs de production et connexion forcée en lecture seule ; grille +30 % approuvée par l'utilisateur le 5 novembre 2026, pas encore appliquée. La partie image reste en attente. Voir `TARIFF-PROPOSAL.md` et `flash-tariff-preview.json`.
- [ ] C05 Tester devis expiré, changement de réglages/références, révision de tarif, budget insuffisant et confirmations simultanées.
- [x] C06 Vérifier débit unique, récupération, remboursement d'échec terminal et historique immuable avec PostgreSQL jetable.
- [ ] C07 Activer seulement les cellules revues via preview/confirmation native, puis relire tous les scénarios ouverts.
- [ ] C08 Vérifier inventaires admin, labels de modèle/provider, coût estimé versus réel et reçus de génération.

## D — App, bibliothèque, Milo et outils

- [x] D01 Sélecteurs de modèles image/vidéo, groupes/variantes/badges et contrôles issus des schémas.
- [x] D02 Flash : texte, image initiale, références et sujets ; aucun Modify/Extend/fin d'image/shot-plan structuré annoncé.
- [x] D03 Images 2.6 : qualité, dimensions, fond et format raster, `complexity`, quantité et références compatibles.
- [ ] D04 Aller-retour complet paramètres → devis → soumission → job → historique → recréation ; snapshots et choix explicites conservés.
- [ ] D05 Préserver les originaux, générer les thumbnails et projections `job_outputs`/`media_assets`/lecteurs historiques applicables.
- [ ] D06 Vérifier Activity, bibliothèque, téléchargement et réemploi image→vidéo ; isolation entre comptes et URLs privées.
- [ ] D07 États vide/chargement/erreur, annulation si applicable, reprise après navigation et rendu responsive.
- [x] D08 Mettre à jour les faits de prompting et suggestions Milo ; test des réglages réellement appliqués.
- [x] D09 Auditer Storyboard/Character Studio/Angle/autres outils : pas de migration implicite de modèle fixe, recette ou forfait.

## E — Studio conversationnel

- [ ] E01 Ajouter seulement les couples modèle/mode qualifiés à la certification conversationnelle partagée.
- [ ] E02 Vérifier découverte, détails, capacité de sélection explicite et disponibilité runtime de chaque nouveau modèle.
- [x] E03 Respecter une sortie image/action et les plafonds de références Studio ; étendre seulement les chemins explicitement nécessaires aux sujets Flash.
- [ ] E04 Préparer/présenter/confirmer le devis exact et conserver réglages/references/identité du modèle jusqu'à l'exécution.
- [ ] E05 Tester édition d'un résultat image, sélection d'assets du projet, retour d'une vidéo Flash et récupération après reload.
- [ ] E06 Vérifier média dans l'étagère et réemploi timeline via les propriétaires existants ; ne pas ouvrir les gates export ni restaurer Canvas.
- [ ] E07 Qualifier comportement et comptabilité via `tests/studio-video-workflows-postgres.test.ts`, contrats image et parcours navigateur applicables.

## F — MCP et assistants connectés

- [ ] F01 Mettre à jour disponibilité provider/credentials/admissions par environnement ; statut réellement exécutable distinct de la simple découverte.
- [ ] F02 Vérifier `list_models`, détails, recommandations et estimation de budget avec identités exactes.
- [x] F03 Propager les options raster/complexité et limites Flash dans les schémas canoniques, normalisation et validation.
- [ ] F04 Tester références privées/importées, ordre/répétitions/sujets et mêmes faits physiques que dans App/Studio.
- [ ] F05 Vérifier prepare/confirm, devis périmé, une tentative, status/recover et restitution des originaux.
- [x] F06 Conserver budgets d'instructions et de descriptions ; faits live dans résultats et contraintes dans schémas.
- [x] F07 Exécuter `pnpm mcp:client:check`, garde de parité des modes et matrices financières/integration concernées. 194 tests client et 70 cas de sélection passent (un contrôle host volontairement distinct) ; lane financière locale complète réussie.
- [ ] F08 Après déploiement, vérifier chaque mode dans le MCP connecté et le client/host effectivement testé ; renouveler la découverte après reconnexion si nécessaire.
- [ ] F09 Actualiser la documentation MCP/plugin/llms concernée sans promettre de capacité non ouverte ; ne pas assimiler code serveur livré et package de plugin installé.

## G — Médias et marketing

- [x] G01 Préparer briefs/prompts originaux par cas : texte, produit/personnage de départ, références vidéo/sujets ; création/retouche de la même image pour les deux variantes.
- [x] G02 Fixer un lot et budget de rendus, puis obtenir les résultats approuvés et les évaluer ; aucun exemple d'une autre version réétiqueté. Revue des images et transcription effectuées ; écoute éditoriale encore requise.
- [x] G03 Conserver modèle, prompt, paramètres, entrées, identifiants fournisseur, originaux, durée/dimensions et usage pour chaque asset. Coût liste estimé consigné ; facture fournisseur non vérifiée.
- [ ] G04 Importer/persister originaux, thumbnails/posters, short previews/renditions applicables ; vérifier HTTP et lecture réelle.
  Les sept originaux ont été importés via le helper officiel dans la bibliothèque privée connectée ; tous sont `ready`, avec thumbnail. Trois aperçus silencieux de 2,5 s sont préparés localement. L'adoption externe Flash, l'attachement des aperçus et la préparation des copies publiques restent à faire.
- [ ] G05 Créer les collections exactes dans l'admin et prévisualiser leur galerie effective ; préserver ordre et choix existants des familles.
- [x] G06 Écrire les trois pages modèle EN/FR/ES, blocs `decision.modelSlug`, limites, prompts, FAQ, sources et CTA réels.
- [ ] G07 Mettre à jour menus, catalogue, familles/intro/FAQ, variantes et badges New sans déplacer les liens existants hors des limites.
- [ ] G08 Préparer comparaisons ciblées (Kling 4/Flash, Flare/Sunburst 2.6, 2.6/2.5 si pertinent) avec prix exacts et preuves ; aucune note inventée.
- [ ] G09 Mettre à jour Pricing, cas PAYG/Best-for pertinents, maillage interne, docs machine/LLM et aides à la sélection.
- [ ] G10 Vérifier canonical, hreflang, JSON-LD/Offers, slugs localisés, sitemap, redirections historiques et absence de liens vers modes fermés.
- [ ] G11 Exécuter `pnpm model:launch-assets:check` ; préparation/publication des renditions si un hero homepage est sélectionné, avec preuves CWV avant/après.
- [x] G12 Préparer article/annonce du site et brouillons sociaux/email/descriptions vidéo ; publier sur les canaux externes seulement sur instruction explicite.
- [ ] G13 Enregistrer date réelle de lancement et échéance éditoriale de révision du badge New ; suivi usage/erreurs/coûts/SEO sans inventer de volumes de recherche.

## H — Livraison et clôture

- [x] H01 Tenir un ledger par modèle/mode/surface : code, tests locaux, accès fournisseur, tarif, média, preview, production.
- [ ] H02 Exécuter tests ciblés, types, lint/exposure, diff-check et parcours locaux ; corriger les problèmes reproduits.
- [x] H03 Ouvrir les PR cohérentes avec description du périmètre final ; conserver les gates de publication jusqu'à qualification. PR #620 en brouillon.
- [ ] H04 Valider Quality CI sur le dernier candidat et toutes ses lanes sélectionnées, puis le Git Preview exact et le contrôle d'alignement.
  Quality CI `42092543108` passe entièrement sur `0367ce6fa` : contrôles rapides, base/médias, deux shards navigateur et financier exhaustif. L'extension d'import marketing doit également passer sur son propre dernier commit.
  Les Previews Git `c88db0060`/`0367ce6fa` et un redéploiement exact `0367ce6fa` ont échoué avant le build avec `Resource provisioning timed out`, sans logs de build. Aucun contournement de livraison en production.
- [ ] H05 Rafraîchir main et vérifier `pnpm deployment:check` avant merge ; coordonner les livraisons concurrentes.
- [ ] H06 Livrer par merge main → Vercel Git ; vérifier READY et SHA des deux domaines.
- [ ] H07 Faire les smoke tests live App/Studio/MCP, prix et pages localisées ; différencier lectures et générations payantes approuvées.
- [ ] H08 Vérifier erreurs/coûts/jobs en cours et conserver la recette de rollback ciblé sans supprimer les jobs, originaux ou tarifs historiques.
- [ ] H09 Rapporter PR, commits, déploiement, médias, tarif et limites résiduelles. Ne déclarer le lancement terminé que pour les surfaces réellement ouvertes.

## Lot suivant choisi par l'utilisateur

- [ ] L2-01 SVG : contrat de génération seul, stockage/MIME, aperçu raster, téléchargement vectoriel, règles d'édition et limites Studio/MCP.
- [ ] L2-02 GIF animé : contrat, durée/cadence, aperçu/animation, bibliothèque et compatibilité timeline/export.
- [ ] L2-03 Annotation `markup` : calque PNG transparent lié à la première image, dimensions et ownership, incompatibilités masque/prompt_rewriter, interactions App/Studio/MCP.
- [ ] L2-04 Prix, tests, qualification, marketing et activation propres à ces nouvelles sorties ; aucune annonce prématurée dans le lot 1.

## État du candidat après implémentation

Les coches de code ci-dessus ne constituent pas une ouverture publique. Les trois
modèles restent fermés sur toutes les publications du registre. Les deux providers
et le stockage sont présents en Preview/Production (inventaire des noms uniquement,
aucune valeur de secret copiée). Les preuves par couple et par surface sont suivies
dans `QUALIFICATION-MATRIX.md`.

Le 5 novembre, l'utilisateur a approuvé sept rendus avec une enveloppe de 10 USD,
sans retry, et demandé une direction cinéma avec action, dialogue et plusieurs
plans, sans miroirs ni transparence. `cinema-qualification.json` remplace le brief
de nature morte ; les prix client restent à valider séparément.

La préparation tarifaire comporte 72 scénarios Flash et 2 040 cellules image
inactives. Les trois tailles raster initiales sont bornées ; les dimensions
personnalisées ne sont pas ouvertes dans ce lot. Les tokens de sortie 2.6 ont un
estimateur documenté, mais aucune borne fiable d'entrée image n'est déduite de
GPT 1 ou 2.5. Les prix fournisseur et les prix client restent distincts.
