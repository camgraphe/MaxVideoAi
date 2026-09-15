# Passe réelle 11 — 14 septembre 2026

Autorisation : refonte générale marketing dans codex/site-redesign, revue et corrections ensuite. D57 prime sur les validations visuelles encore en attente : avancer dans le code avec initiatives utiles. Aucun déploiement.

## Contrats

Conserver routes, slugs, canonicals, hreflang, schémas, sitemaps, indexabilité, consentement et événements analytics. DR 36 : donnée communiquée par Adrien, non auditée. Aucun gain de classement promis. Vidéo au centre ; images et audio accessibles. Références : créer OU importer. App et Connect distincts. EN, FR naturel, ES LATAM. Mobile prioritaire, clavier et reduced motion. Poster initial et politiques médias existants conservés.

## Lot

1. Fondations marketing isolées de l’app : palette ivoire/olive/bronze, typographie, espacements, liens, navigation, pieds de page, micro-interactions progressives.
2. Accueil : ouverture cinématographique, comparaison réelle, app dans appareils, références et création d’images, exemples, assistant distinct, audio, FAQ.
3. Gabarits catalogue/détail modèles, Compare, exemples, outils, tarifs, intégrations, contenus éditoriaux : hiérarchie et composants partagés, interactions et lisibilité mobile.
4. Révision éditoriale des surfaces marketing EN/FR/ES, sans altérer prix, capacités ni noms de modèles.
5. Contrats SEO/media/localisation, lint, build/typecheck, revue navigateur locale et compte rendu des limites.

## Environnement

Dépendances installées avec lockfile gelé. Aperçu Next compilé sur http://localhost:3008/fr (utiliser localhost, cohérent avec le serveur et les réécritures localisées). Pas de DATABASE_URL : données locales/fallback, galerie live et backend non validés. Ne pas connecter la production pour contourner les écritures de bootstrap. État initial capturé dans review/direction-10/qa/before-home.jpg. Les performances du dev ne sont pas des Core Web Vitals de production.


## Résultat de cette passe

- Fondation visuelle commune aux pages marketing : ivoire, olive et bronze, titres et espacements harmonisés, navigation plus claire et accès Assistants. Les liens Blog restent disponibles dans le pied de page. L’app conserve ses styles.
- Accueil réellement intégré : vidéo et exemples existants, comparaison sur notes source, créer ou importer des images, app encadrée dans un ordinateur avec téléphone superposé sur desktop ; téléphone seul sur mobile. Vidéo, image et audio ont des accès distincts. Les assistants occupent un chapitre séparé.
- Comparaison : échelle commune de 0 à 10, deux formes identifiables, explications ouvrables au clavier ; les valeurs nulles ne deviennent pas zéro. Catalogue, pages modèles, tarifs, exemples, outils et intégrations reçoivent la composition commune ; outils alternés sur desktop, empilés sur mobile. Les articles gagnent en lisibilité.
- Mouvement progressif des sections sous le premier écran, survols et interactions natives. Aucun contenu masqué en attendant JavaScript ; préférence de réduction du mouvement respectée. Le média initial et ses dérivés sont conservés.
- Première révision des textes principaux EN/FR/ES et de plusieurs libellés du catalogue. Il ne s’agit pas d’une réécriture exhaustive de chaque article et fiche modèle.

## Vérifications effectuées

- Compilation Next de production et génération des sitemaps : réussies.
- Suite ciblée : 193 tests passés, aucun échec (accueil, lecteurs médias, architecture marketing, SEO, routes, liens, locales et nouveaux composants).
- TypeScript, lint frontend, lint d’exposition, parité i18n et gardes SEO : réussis. `git diff --check` réussi.
- Comparaison HTTP de 30 routes avant/après : mêmes statuts, canonicals, hreflang, robots et types de schémas ; JSON-LD parsable. Le détail est conservé localement dans `review/direction-10/qa/routes-before-after.json`. Cela ne constitue pas un audit exhaustif de chaque URL et de chaque valeur de schéma.
- Contrôle navigateur : accueil desktop/mobile, appareils, catalogue FR, outils ES, comparatif FR et menu mobile (ouverture, fermeture, retour du focus). Pas de débordement horizontal sur les vues contrôlées. Détail des critères du comparatif réellement ouvrable.
- Images app : copies exactes des captures visiteur originales 09, JPEG 1428 × 1015 et 378 × 818, exposées dans `frontend/public/assets/marketing/redesign/`. Interface de démonstration anglaise visible ; état connecté et localisation des captures à préparer pour publication.

## Limites et suite de correction

Pas de base de données connectée : listes dépendant de la base et authentification non validées ; fallback public utilisé. Aucun état de production modifié. Les captures avant/après locales et les contrats médias ne prouvent pas une non-régression des Core Web Vitals : comparaison mesurée dans un environnement représentatif et contrôle Safari/iOS restent requis avant livraison.

La prochaine revue porte sur les compositions et textes en contexte réel, puis les contenus longs FR/ES, les démonstrations app, le raccord OpenClaw/n8n et les mouvements propres à chaque page. Website Move reste un storyboard, aucune vidéo commandée ou fabriquée. La direction reste modifiable et locale. Les maquettes historiques ne représentent plus fidèlement le rendu de l’application.
