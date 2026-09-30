# Découvrir, regarder et reprendre les vidéos

Date : 28 septembre 2026. Statut : exploration initiale, pas encore implémentée. La direction retenue et les décisions plus récentes sont dans [la phase zéro](2026-09-28-video-discovery-phase-zero.md) : héros fixe 16:9 + 9:16 + deux 16:9, puis galerie multi-formats ; parcours admin ajout/publication/SEO intégré.

Base de travail : `origin/main` à `b1cc6fb9680b9356961c4a0456004f49f5a101b6`, branche isolée `codex/video-discovery`.

## Intention et périmètre

Faire comprendre en quelques secondes que MaxVideoAI contient une bibliothèque de vidéos à explorer et à réutiliser. La vidéo occupe le premier écran ; le texte sert à choisir, comprendre et créer. Repenser ensemble le hub `/examples`, les pages par famille, les galeries des modèles, les pages vidéo et l'administration des sélections/emplacements.

Demandes d'Adrien : beaucoup moins de texte et d'espace perdu, plusieurs aperçus animés, profondeur du catalogue immédiatement perceptible, accès fiable aux anciennes vidéos, reprise des prompts dans l'app, préservation SEO et Core Web Vitals, administration cohérente avec le rendu public.

## État observé

- La page Wan présente au premier écran un titre, un seul grand exemple et ses actions. La suite du catalogue n'est pas annoncée par un total ou plusieurs autres films visibles. Sur mobile, le premier exemple et ses explications occupent tout l'écran.
- Taille de page actuelle : 60 ; première galerie : 8 vidéos pour le hub, 12 pour une famille ; ajout progressif par groupes de 8. Ces limites de présentation ne sont pas une limite de stockage.
- Le lecteur historique du hub charge au maximum `limit + offset`, puis utilise la longueur du tableau reçu comme total. Sur cette branche de lecture, `hasMore` peut devenir faux alors que la playlist contient davantage de vidéos. Un appel vide ou échoué ne doit pas être interprété comme la fin du catalogue.
- Le chemin de curation présent sur main calcule déjà un total à partir du résultat complet, mais charge les candidats avant de découper la page. Les familles assemblent également les sources complètes. Cette approche doit évoluer pour grandir sans télécharger/hydrater toute la bibliothèque à chaque requête.
- L'admin dispose déjà des modes manuel et « Featured + Automatic », des exclusions, d'un aperçu avant sauvegarde et de contrôles de concurrence. L'aperçu actuel est une liste de prompts. Les bornes de validation sont 2 000 IDs choisis et 5 000 exclus par configuration ; ce ne sont pas des bornes du catalogue automatique.
- Les vérifications API publiques effectuées pendant l'audit ont atteint 120 éléments du hub par décalage. Ce constat daté ne prouve ni une limite de stockage ni le nombre de vidéos Wan.

Preuves visuelles locales : `.reports/video-discovery-2026-09-28/` contient les captures hub, Wan desktop/mobile et page vidéo avant refonte.

## Trois directions présentées

L'ordre ci-dessous correspond à l'ordre d'affichage des images générées dans la conversation.

1. **Atelier vivant** : bibliothèque visuelle dense, films proches les uns des autres, petit titre, total et pagination visibles. Forte lisibilité de la variété dès l'arrivée.
2. **Cinéma explorateur** : grand lecteur, file de films visible, prompt et reprise à portée de main. La file et l'accès à toute la bibliothèque annoncent clairement la suite.
3. **Collections de plans** : découverte par intentions éditoriales, avec plusieurs bandes de films et un accès évident au catalogue complet. Nécessite une vraie propriété éditoriale des collections dans l'admin.

Les images sont des maquettes de direction. Compteurs, titres courts et certaines scènes sont illustratifs. Les associations exactes modèle/film et les statistiques seront issues des données réelles. Les formats réels des vidéos seront conservés dans le lecteur ; aucune maquette ne justifie de déformer ou recadrer irréversiblement les originaux.

## Expérience commune

### Découvrir

- Titre court et propre à la famille, phrase utile unique et total de résultats calculé sur le même périmètre que la liste.
- Plusieurs films visibles dès l'arrivée. Sur mobile 390 × 844, montrer au moins le début d'un second résultat et un total avant de faire défiler un bloc explicatif.
- Filtres de familles sous forme de liens existants ; tri explicite et conservé dans l'URL. Pas de nouvelle identité de modèle indépendante du registre.
- Cartes dominées par l'image. Petit nom du modèle, durée et titre court vérifié ; pas de paragraphe de prompt systématique sous chaque vidéo.
- Proposition : pages de 24 résultats, rendues côté serveur, avec plage « 1–24 sur N », précédente, suivante et numéros utiles. Pas de dépendance au clic « charger plus » pour accéder aux liens des pages suivantes. Découpage à valider avec mesures et contrats avant remplacement des 60 actuels.
- L'URL conserve famille, tri et page. Retour navigateur vers le même contexte et position. Une erreur de chargement propose Réessayer sans avancer le décalage ni perdre des résultats. Les états vide, indisponible et fin de catalogue sont distincts.

### Regarder et créer

- Chaque film conserve son lien HTML vers la fiche `/video/{slug}`. Le détail s'ouvre avec la vidéo dominante, les actions « Copier le prompt » et « Créer à partir de cet exemple », puis les paramètres.
- Reprendre passe par le contrat `/app?from={jobId}` et le parcours d'authentification existant. Cette action prépare la création ; elle ne lance pas une génération payante.
- Prompt précis, mode réellement utilisé, modèle/version, durée/format/résolution et prix historique daté restent accessibles dans le HTML de la fiche. Le prix historique n'est pas un devis actuel.
- Références privées jamais copiées dans le compte du visiteur. Lorsque des références sont nécessaires, indiquer ce qu'il devra ajouter.
- Réduire les CTA répétés et les grands panneaux de métadonnées. Afficher des films suivants et un retour explicite à la famille/bibliothèque.

### Animer sans saturer

- Conserver des posters SSR responsives et une géométrie fixe. Les premières images déterminent la priorité de chargement ; aucun téléchargement d'original ne sert de substitut automatique à une miniature.
- Prototyper un budget global de trois courts aperçus silencieux visibles sur ordinateur et un sur mobile. Ce sont des hypothèses à mesurer, pas un nombre garanti de flux à lancer sur tous les appareils.
- Démarrer les aperçus après le poster critique, arrêter hors écran et en onglet masqué ; respecter réduction des animations et économie de données. Prévoir une commande de pause des aperçus.
- Le survol, le focus et la lecture volontaire ont la priorité dans le budget. Un lecteur volontaire suspend les aperçus concurrents. Le son exige une action.
- Employer les hooks et les sources préparées existants. Vidéo originale, téléchargement, édition et URL de schéma gardent leurs propriétaires distincts. Pas d'égaliseur décoratif réintroduit.

## Administration proposée

Un écran de destination : **Bibliothèque générale / Famille / Modèle / Emplacement**. La destination sélectionnée affiche son URL publique, son état publié et le total réellement visible.

| Zone | Ce que l'opérateur fait | Résultat visible |
| --- | --- | --- |
| Bibliothèque | Chercher et filtrer les vidéos déjà éligibles, ouvrir le lecteur | Résultats paginés, nombre total, titre/modèle et aperçu suffisamment grands |
| Sélection | Choisir, réordonner, retirer une mise en avant | Ordre explicite, commandes clavier et glisser-déposer |
| Remplissage | Choisir Manuel ou Sélection + automatique | Compteurs distincts : sélection, complément automatique, exclusions |
| Aperçu | Voir le résultat desktop/mobile et naviguer dans ses pages | Même projection et mêmes composants de présentation que la page publique |
| Enregistrement | Vérifier les changements puis sauvegarder | Révision confirmée, brouillon conservé en cas d'erreur ou conflit |

Les nouveaux candidats apparaissent automatiquement uniquement dans les destinations déjà configurées en mode hybride. Une sélection manuelle vide reste vide. Exclure d'une page ne supprime pas la vidéo. Les emplacements de la homepage et les starters conservent leurs contrats tant qu'une adaptation explicite n'est pas implémentée et vérifiée.

Si la direction par collections est retenue, prévoir des noms et descriptions localisés, des vidéos explicitement affectées, un ordre éditorial et un statut de publication. Ne pas inventer automatiquement des catégories à partir des prompts. Éviter la création immédiate de nombreuses routes SEO sans contenu éditorial suffisant.

## Données et architecture cible

1. **Éligibilité et ordre partagés** : la projection public/admin réutilise les règles existantes : vidéo terminée, publique, indexable, source lisible, modèle autorisé, aucun asset/output correspondant supprimé. Exclusions avant ordre avant pagination. Conserver la distinction `null` historique / `[]` configuré vide.
2. **Requête bornée** : calculer le total sur le périmètre complet éligible et ne récupérer/hydrater que la page demandée. Un tri déterministe inclut l'ID comme départage. Dédupliquer l'assemblage famille avant le comptage.
3. **Compatibilité** : reproduire l'ordre hérité et les modes manuel/hybride, sans migration implicite des destinations. Le mode automatique ne doit pas être limité au nombre de mises en avant.
4. **Données minimales** : le catalogue transporte les informations nécessaires à la carte ; le prompt complet et les détails restent dans la fiche. Garder une seule politique de cache et de revalidation documentée pour total et liste.
5. **Propriétaires** : SQL/éligibilité sous `frontend/server`, adaptation des routes dans `examples/_lib`, sections dans `examples/_components`, carte et orchestration des aperçus dans les composants média partagés. Les routes restent des orchestrateurs.
6. **Admin** : recherche paginée côté serveur, aperçu borné avec total, sauvegarde transactionnelle et empreinte/révision existantes. Ne pas casser la validation d'un aperçu simplement parce qu'il n'affiche qu'une page.

## SEO et acquisition à préserver

L'export GSC local, du 26 août au 22 septembre 2026, confirme : LTX 211 clics / 5 742 impressions ; Seedance 41 / 1 895 ; Wan 32 / 768 ; Kling 29 / 1 168. Source : dossier OUTREACH, `sources/2026-09-24/wave3/gsc-web-pages.csv`. Ce sont des données historiques, pas des prévisions de résultat.

- Conserver les URL des familles et les slugs vidéo, les redirections d'anciens IDs, les versions localisées et les chemins de reprise dans l'app.
- Vérifier canonical, hreflang, liens HTML, JSON-LD, indexabilité et sitemaps sur hub/famille/fiche et pages 2+. Chaque page paginée indexable doit avoir sa propre URL canonique ; traiter séparément les tris/filtres non destinés à l'index.
- La fiche vidéo reste une page où regarder la vidéo est l'objet principal. Les originaux restent les sources de données structurées selon les contrats média.
- Garder le contenu éditorial utile après la galerie ou en détails accessibles ; ne pas supprimer les informations recherchées pour gagner seulement de l'espace.
- Ne pas réétiqueter le workflow de la vidéo « giant duck » à partir de son seul prompt : vérifier le job réel avant toute correction de mode.

Références : [pagination Google](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading) ; [bonnes pratiques vidéo Google](https://developers.google.com/search/docs/appearance/video). Ces règles ne garantissent pas un gain de positionnement.

## Vérification et livraison

Coordination confirmée avec « Auditer les Core Web Vitals » : cette tâche possède exemples/galeries/modèles/lecteurs publics/admin associé ; l'autre tâche réserve INP mobile/auth/workspace. Ports 3197 et 3198 et aperçu utilisateur 53696 à préserver.

- Données : fixtures PostgreSQL > 120 vidéos, limites de pages, égalités d'ordre, déduplication famille, exclus/privés/supprimés, curation vide, manuel/hybride et compatibilité historique. Vérifier total identique entre public et aperçu admin et coût borné de l'hydratation.
- Interface : page 2 directe, début/fin, erreur et reprise, filtres puis retour, navigation clavier, mobile, lecture complète, copie prompt et reprise après connexion ; ne déclencher aucune génération lors des vérifications.
- Contrats : examples route/gallery/opening/acquisition, admin curation, modèle, lecteurs publics, SEO/sitemaps et projections média hors ligne. Mettre à jour les assertions d'ancienne structure seulement avec les comportements remplacés documentés.
- Performance : même serveur préparé, mêmes films, mêmes routes et dimensions ; mesures alternées avant/après, froid/chaud, desktop/mobile390. Rapporter plusieurs essais, LCP/CLS, interactions et poids média séparément. Bloquer les régressions reproductibles, distinguer laboratoire et données terrain. Préserver les acquis PR358/360/361.
- Les captures actuelles sont une référence visuelle, pas une mesure CWV. Aucune amélioration de vitesse, conversion ou SEO n'est encore démontrée.
- Branche propre issue de main, revue et CI, puis procédure Git/Vercel du dépôt. Aucun déploiement depuis le checkout Desktop contenant des travaux en cours.

## Décision attendue

Choix de la direction visuelle, ou mélange précis. Ce choix fixe le premier écran et la progression de découverte ; l'administration, la pagination fiable, la reprise des prompts, les protections SEO et les mesures de performance font partie du périmètre dans tous les cas.
