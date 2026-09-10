# Migration, architecture et critères de sortie


La continuité SEO/GEO guide la migration et permet de corriger l’existant. Appliquer le [principe directeur](README.md#principe-directeur--continuité-seo-et-amélioration-réelle) : changements réversibles à faible impact identifié dans le travail courant, revue ciblée pour les modifications significatives de trafic, d’intention, d’URL ou d’indexabilité. Ne pas figer les textes, sections ou liens par simple ressemblance avec l’ancien site.

## Ordre de réalisation

1. Conception : inventaire, scénario, sources médias, validations V1 et V2.
2. Prototype isolé : accueil complet animé, mobile, puis catalogue et fiche représentative ; validation V3.
3. Intégration : composants nécessaires aux pilotes, contenus EN/FR/ES-LATAM et tests appropriés.
4. Généralisation : modèles et variantes, exemples/outils, comparaison/tarifs, éditorial/intégrations/institutionnel.
5. Recette et livraison par lots avec bilan après déploiement.

L'ordre des lots après les pilotes sera ajusté avec les données d'acquisition. Le chantier de conception ne doit pas devenir une branche accumulant des mois de code. Après validation, préparer des branches/PRs limitées depuis la base mise à jour, sans emporter les travaux d'autres tâches.

## Propriétaires conservés

- `frontend/app` : routes, métadonnées et orchestration ; sections colocalisées ou partagées si réutilisation réelle.
- Home : `HomeRedesignSections` et composants associés ; builders route-local et `home-jsonld.ts` distincts.
- Catalogue : `ModelsCatalogPage`, `_components`, `_lib` et galerie partagée.
- Modèle : respecter l'AGENTS du dossier `[slug]` ; contenu exact-locale et branches prélaunch/retrait distinctes.
- `model-registry.json` : identité et publication des modèles ; aucune édition manuelle des projections.
- Moteur de prix : coût et devis ; aucune valeur inventée pour remplir une maquette.
- Sources publiques et pipeline de renditions : préparation/lecture des médias ; pas de lecteur ad hoc par page.
- Styles marketing isolés : ne pas changer tous les tokens racine pour obtenir une couleur sur le site public.

Lire les guides [architecture](../engineering/page-architecture.md), [médias](../engineering/media-delivery.md), [registre](../engineering/model-registry.md) et [prix](../engineering/pricing-engine.md) avant de toucher leurs responsabilités.

## Outils

Conserver Next.js/React et le système i18n. Pour le mouvement : CSS pour les transitions simples ; choisir une bibliothèque après un essai borné si la séquence nécessite une orchestration. Aucune dépendance Motion/GSAP dédiée n'a été repérée dans le package frontend lors du cadrage ; Remotion y est présent pour d'autres usages et ne justifie pas de l'utiliser pour le scroll.

Navigateur pour preuves et QA ; Figma facultatif pour revue de composants ; génération visuelle pour exploration uniquement tant que provenance et production ne sont pas qualifiées. Pas de nouveau CMS ou moteur d'état comme effet secondaire de la refonte.

## Référence avant modification

Pour chaque URL touchée : statut HTTP et destination, indexabilité, title/description, canonical, alternates, H1/sections utiles, JSON-LD, liens internes, langue, capture desktop/mobile, contenu média sélectionné et interactions. Relever sitemap/robots et URLs dynamiques par les sources appropriées ; l'inventaire de fichiers ne remplace pas le crawl.

Conserver une référence de code et des conditions de mesure datées. Identifier les pages à trafic élevé avant toute fusion/suppression. Ne pas confondre tests locaux et données terrain.

## Matrice de validation

| Axe | Conditions de sortie |
|---|---|
| Identité | Page entière reconnaissable et liée au produit ; aucun encadrement décoratif imbriqué sans justification |
| Information | Promesse, démonstration et prochaine action compréhensibles ; aucune donnée utile supprimée sans décision |
| Mouvement | Scroll natif, retour vers le haut cohérent, reduced motion, clavier, pause vidéo hors écran |
| Mobile | 320/390 px : pas de débordement global, commandes lisibles ; séquence alternative conçue |
| Langues | EN/FR/ES-LATAM relus en contexte ; pas de fallback anglais involontaire |
| SEO | URLs conservées par défaut ; canonical/hreflang/schémas/liens contrôlés ; changements éditoriaux tracés |
| Performance | Avant/après mêmes réseau/cache/viewport, plusieurs passages ; LCP/CLS/INP terrain si disponible et traces d'interactions labo ; absence de régression reproductible non expliquée |
| Médias | Poster prioritaire, géométrie stable ; pas de téléchargement simultané de plusieurs vidéos lourdes avant intention ; provenance et fallback exact-original conservés |
| Fonctionnel | Navigation, filtres, comparaison, ouverture d'exemples et entrées app testés ; aucune génération payante requise pour la recette visuelle |

Les budgets chiffrés de transfert et de mouvement seront définis après la référence. Ne pas annoncer un gain de performance avant mesure. Cible de conception : aucune animation bloquant le premier contenu ; démonstration lourde différée après celui-ci.

## Contrôles techniques

Contrats ciblés selon les fichiers touchés : home-route, models-catalog, model-page-layout/copy, navigation-surfaces, pricing-page, hreflang-variants, localized-fallback-seo, fr-seo-localization, homepage-lcp, home-default-route-performance et examples-lcp. Exécuter lint, exposition publique, vérification des diffs et build au moment approprié à l'intégration. Installer les dépendances du worktree avec le gestionnaire et lockfile du projet avant de revendiquer une validation complète.

Si affichage médias modifié, appliquer les gates de préparation posters/renditions prescrites par le guide. Ne pas réduire les contrats d'architecture pour faire passer une nouvelle composition.

## Livraison et retour arrière

PR par famille ou responsabilité cohérente, avec captures, routes/langues testées, changements de contenu et mesure comparable. V4 présente le lot réellement prêt. Déployer avec possibilité de revenir au commit précédent ; éviter tout changement destructif de données ou d'URLs dans un lot purement visuel.

Après livraison : vérifier erreurs, navigation, indexabilité et performances immédiatement, puis examiner l'évolution du trafic sur une fenêtre comparable tenant compte des effets saisonniers. Une baisse n'est pas automatiquement causée par le design ; établir la cause avant modification corrective.
