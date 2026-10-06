# Core Web Vitals : familles de pages et chargements différés

Audit du 6 octobre, validation poursuivie le 7 octobre 2026. Référence avant :
`be12eb4e460f4d21cf169a4b4e758ea594429894`, déploiement
`dpl_CkFrCi9wChLPXoWuBqHVYo2gHMHA`. Les captures historiques restent conservées.

## Ce que Google constate encore

Les points CrUX Vis affichent des fenêtres de 28 jours qui se recouvrent. La
comparaison ci-dessous reprend la précision affichée, sans inventer des données
URL lorsqu'il n'existe qu'une mesure d'origine.

| Périmètre | Appareil | LCP, fin 19 sept. → fin 3 oct. | INP | CLS |
| --- | --- | --- | --- | --- |
| Origine | Mobile | 3 001 → 2 772 ms | 227 → 239 ms | 0,06 → 0,10 |
| Origine | Ordinateur | 2 488 → 2 878 ms | 75 → 81 ms | 0,03 → 0,03 |
| Accueil | Mobile | 2 880 → 2 796 ms | 260 → 259 ms | 0,06 → 0,10 |
| Accueil | Ordinateur | 1 921 → 2 174 ms | 86 → 81 ms | 0,03 → 0,02 |

Search Console, consultée le 6 octobre avec une actualisation au 4 octobre,
affiche sur chaque appareil 0 URL médiocre, 141 à améliorer et 0 bonne. Le nombre
d'URL d'un groupe et son URL représentative ne permettent pas de désigner une
page coupable. Les données d'origine peuvent inclure des visites éligibles de
l'application. Les fenêtres contiennent encore beaucoup de visites antérieures
aux derniers correctifs ; elles ne démontrent pas leur efficacité.

## Priorités par famille

Vercel Speed Insights, 29 septembre 20:00 UTC au 6 octobre 20:00 UTC, production
et déploiements mélangés. Chaque effectif ci-dessous appartient au **LCP** ; il
ne sert pas d'effectif à une autre métrique. Cette population diffère de CrUX.

| Famille | Ordinateur : LCP p75 / n | Mobile : LCP p75 / n |
| --- | --- | --- |
| Accueil | 3 392 ms / 223 | 3 664 ms / 79 |
| Application | 4 300 ms / 189 | 4 388 ms / 56 |
| Modèles | 3 168 ms / 83 | 3 204 ms / 21 |
| Galerie d'une famille | 1 976 ms / 127 | 2 212 ms / 47 |

Le lecteur ouvert depuis la galerie est un problème distinct : l'attribution
desktop de son cadre donne un CLS p75 de 0,1643 sur 13 événements. Le CLS mobile
de l'application reste à 0,1659 sur 30 événements ; ce lot ne prétend pas le
corriger. Les lecteurs `/video/` sont aussi à examiner : LCP desktop 3 892 ms,
91 événements. Les petits groupes et les exports atteignant une limite de
résultats restent des indices, pas des classements exhaustifs.

## Corrections et preuves

### Accueil : démarrer les prix avec les autres lectures

Les prix du hero et les scénarios tarifaires attendaient les exemples avant de
démarrer. Les cinq lectures indépendantes démarrent maintenant ensemble. Les
mêmes prix exacts, exemples, médias et schémas restent rendus côté serveur.
Les phases `hero-pricing` et `demo-pricing` sont désormais visibles dans les
diagnostics bornés, sans requêtes SQL, identifiants de compte ou contenu d'erreur.

| Profil local, trois passages | LCP avant, ms | LCP après, ms | Médiane avant → après |
| --- | --- | --- | --- |
| Ordinateur | 9 388 ; 6 980 ; 15 052 | 8 448 ; 6 392 ; 5 816 | 9 388 → 6 392 |
| Mobile simulé | 7 844 ; 7 508 ; 7 424 | 7 808 ; 6 704 ; 6 572 | 7 508 → 6 704 |

Ce laboratoire utilise une compilation de production, une base distante en
lecture seule et le même protocole réseau/CPU avant/après. Les requêtes et la
base varient ; trois passages ne certifient pas un gain de p75 en production.
Le poster LCP, sa géométrie et les captures visuelles restent identiques. Aucun
script tiers de consentement ne charge dans ces profils neufs. Le JavaScript
transféré augmente légèrement, de 319 447 à 320 154 octets : il ne s'agit pas
d'une réduction globale du bundle.

La galerie reste la phase dominante. Un export filtré de logs de production
avant correction contient 74 lectures `home` sur trois heures : il confirme
des attentes des exemples de l'ordre de deux secondes dans de nombreuses
requêtes, tandis que les slots et scores terminent bien plus vite. Ce sont des
durées de chargement serveur, pas des LCP et pas un échantillon de visiteurs.

### Galerie : conserver le cadre du lecteur pendant le chargement

Avant, le cadre desktop passait de `y=243, hauteur=414` à `y=24, hauteur=852`
à l'arrivée des données. Un parcours naturel en production reproduit un CLS
post-ouverture de **0,16044**. Le lecteur compilé corrigé conserve `y=24,
hauteur=852` et ne présente aucun décalage post-ouverture dans le parcours testé.
Le mobile reste à hauteur de viewport avec zéro décalage dans les deux captures.
Escape, restitution du focus et absence de débordement horizontal sont vérifiés.
Le chargement est centré, le contenu long défile dans le cadre, et la page de
lecture autonome conserve son défilement normal.

La comparaison naturelle initiale est production avant / compilation locale
après : elle établit la correction de géométrie, pas un effet réseau comparable.
Un test Chromium utilise aussi le même CSS réel avec plusieurs tailles de
contenu et de viewport, et échoue avec le cadre ancien.

### Consentements : empêcher des téléchargements non autorisés par le choix

Avant, le composant Google Ads était monté sous le seul consentement analytics.
Chrome en production télécharge une seconde bibliothèque Google de 166 241
octets dans le scénario analytics seul. Le composant exige maintenant les deux
catégories ; les visites avec consentement complet gardent leur configuration.

Autre défaut : un cookie d'une ancienne version pouvait monter Clarity avant
la validation, alors que la bannière demandait un nouveau choix. GA/GTM avaient
aussi un chemin se fiant au drapeau localStorage avant cette validation. Les
gates et les chargeurs attendent désormais la version publique, vérifient le
cookie courant et annulent les insertions différées devenues inéligibles.
La bannière expire les effets de l'ancien accord. Une nouvelle acceptation
réactive les tags avec le bon état Google, même si leur queue n'existait pas
encore au clic. Seul l'appel de version en cours est partagé ; une lecture
ultérieure peut observer une nouvelle politique. Le fallback de version existant
reste documenté dans le guide CWV.

Les tests de consentement incluent une réponse de version retenue, un ancien
cookie **et** un drapeau persistant granted, le retrait, la réacceptation, les
routes exclues et la parité navigateur ordinaire/audit. Les captures réseau
Chrome complètent ces tests ; elles ne prouvent pas la réception des événements
par les fournisseurs ni une amélioration de l'INP réel.

Chrome desktop sur la compilation corrigée confirme : aucun tag dans un profil
neuf ou refusé ; GA4 et Clarity pour analytics seul, sans bibliothèque Ads ;
GA4, Clarity et Ads avec les deux catégories. L'ancien cookie accompagné du
drapeau analytics persistant est également testé. La configuration publique
Clarity est activée et `localhost` est ajouté explicitement à ses hôtes permis
pour ce diagnostic local, sans modification du code publié ni des fichiers
d'environnement. Les cinq états sont aussi vérifiés sur mobile simulé. Une
réponse de politique retardée de 10 secondes reproduit environ 389 Ko de tags
avec l'ancien cookie et le code publié avant ; la correction n'en charge aucun,
y compris pendant l'attente. Une nouvelle acceptation analytics seule par le
formulaire mobile active GA4/Clarity avec Ads denied ; seul le POST de persistance
est simulé dans ce parcours local pour éviter une écriture en base.
Les destinations absentes ou explicitement désactivées ne font pas de lecture
de politique propre au chargeur. La première passe locale, sans le flag d'activation Clarity,
est conservée mais ne sert pas à valider ses téléchargements.

## Ce qui n'est pas justifié par les mesures

Le lien de connexion marketing ne charge pas le client Supabase pour un
visiteur sans indice de session. Les profils neufs inspectés ne montrent pas
ses requêtes privées : retirer ce lien n'a donc pas de gain établi. Les parcours
avec une session active doivent être analysés séparément.

La bannière et l'ouverture de ses préférences ne provoquent pas de CLS dans les
parcours neufs testés sur les deux appareils. L'attribution de bannière dans
les exports terrain ne compte qu'un événement par appareil. Un redesign peut
améliorer l'ergonomie, mais aucun gain de performance majeur n'est établi pour
son apparence actuelle. Le défaut confirmé se trouve dans le démarrage des tags.

## Validation et limites

Build de production, contrôle d'exposition et diff sans erreur ; 73 tests ciblés
réussis, couvrant chargement, lecteur, consentement et intégrité de mesure. Revue
indépendante GPT-6 Sol, sans défaut important restant démontré. Les routes
modèle et galerie représentatives chargent sans erreur navigateur ; leurs LCP
locaux isolés ne sont pas comparés aux p75 terrain.

Le premier passage local complet compte 7 643 tests réussis, 18 échecs et
4 skips. Les 17 échecs liés au mauvais PostgreSQL local réussissent tous après
sélection de PostgreSQL 17. Le dernier échec examine les anciens JSON de
déploiement conservés dans le dossier ignoré `.reports/` et y trouve des anciens
alias : les preuves historiques n'ont pas été supprimées pour rendre le test
vert. Le checkout CI propre doit confirmer ce contrôle. Les skips concernent
deux scénarios de publication/retry, les validateurs Codex non installés et un
rendu local ; le passage complet n'a pas poursuivi les intégrations Studio
isolées après son échec. Les lanes obligatoires de Quality CI restent nécessaires.

Deux passages CI reproduisent aussi une expiration de 30 secondes dans les
scénarios Studio analyse et tâches : les waiters navigateur démarrent avant
environ 24 secondes de compilation du document, puis la compilation des API.
Ces tests fonctionnels préparent maintenant leurs routes du serveur de test
isolé par des GET authentifiés réels, bornés à 90 secondes. Les GET du navigateur
restent attendus sous 30 secondes, leurs statuts et toutes les assertions
d'action, de financement et d'absence de dispatch implicite sont conservés.
Cette préparation de compilation n'est pas une mesure de performance client.

Les preuves brutes avant/après sont conservées localement sous
`.reports/cwv-2026-10-06-families/` dans le checkout Desktop : captures JSON/PNG,
traces réseau, logs serveur, tests et builds. Le bilan terrain initial est dans
`.reports/cwv-2026-10-06-comparison/`. Les mesures locales ne sont pas un téléphone
physique, ne mesurent pas l'INP de la population réelle et ne certifient pas un
retour au vert dans Search Console.

## Suite du travail

1. Vérifier les mêmes parcours sur le déploiement Git validé et conserver son SHA.
2. Filtrer le RUM par ce déploiement, appareil et famille, avec l'effectif propre
   à chaque métrique. Examiner les chargements tardifs et les vrais clics.
3. Décomposer les attentes internes des exemples de l'accueil, puis le rendu
   des modèles et lecteurs. Réduire une attente prouvée tout en conservant
   curation, prix actuels et posters SSR ; aucune mise en cache aveugle des prix.
4. Reproduire les déplacements du composer et de la galerie dans une session
   mobile authentifiée, ainsi que les interactions responsables d'un INP élevé.
5. Relire une fenêtre CrUX explicitement datée et les groupes Search Console.
   Une fenêtre renouvelée sans régression RUM observée aide à confirmer la
   correction ; les 28 jours écoulés seuls ne suffisent pas.

Méthode et contrats : [guide CWV](../../engineering/core-web-vitals.md),
[référence Google de septembre](../2026-09-26/README.md),
[validation CI](../../engineering/ci-validation.md).
