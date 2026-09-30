# Phase zéro — galeries vidéo, publication et SEO

28 septembre 2026. Direction visuelle retenue par Adrien ; architecture proposée avant modifications produit. Complète et remplace les variantes encore ouvertes du document `2026-09-28-video-discovery-design.md`.

## 1. Décisions prises avec Adrien

- Chaque galerie possède une ouverture éditoriale à quatre emplacements : grande vidéo **16:9**, vidéo **9:16**, deux autres vidéos **16:9** dans des aperçus légèrement recadrés.
- La vedette est toujours horizontale. Aucun moteur d'ouverture à vedette verticale n'est nécessaire.
- La suite accepte tous les formats disponibles. Elle doit rester dense et donner immédiatement envie d'explorer.
- Pagination, petit menu supérieur, gestion des sélections, ajout et module SEO font partie du même chantier.
- La phase zéro précède la refonte produit. Les essais actuels sont isolés et ne modifient ni données ni routes de production.

## 2. Proportions proposées

| Emplacement | Source | Cadre de l'aperçu | Lecture ouverte |
| --- | --- | --- | --- |
| Vedette | 16:9 | 16:9, image entière | Format original |
| Portrait | 9:16 | 9:16, image entière | Format original |
| Paysage secondaire A | 16:9 | 2:1, cadrage ajustable | Format original |
| Paysage secondaire B | 16:9 | 2:1, cadrage ajustable | Format original |

Le cadre 2:1 retire environ 11,1 % de la hauteur totale d'un 16:9, soit environ 5,6 % en haut et en bas avec un cadrage centré. Ce recadrage concerne seulement l'aperçu. L'admin pourra vérifier le sujet et ajuster le point de cadrage ; les médias originaux, téléchargements et données structurées ne changent pas.

Sur ordinateur, les trois colonnes partagent la même hauteur. Les deux petits paysages s'empilent dans la dernière colonne. À 1 384 px disponibles avec des espacements de 10 px, la hauteur est d'environ 411 px : vedette 731 px de large, portrait 231 px, colonne secondaire 401 px. Ces valeurs découlent des proportions, pas d'une mesure du DOM après chargement.

Sur mobile, la vedette occupe la largeur, puis le portrait et les deux petits paysages forment un deuxième bloc. À 362 px disponibles, les quatre médias occupent environ 445 px de hauteur au total. Le titre et la navigation doivent rester compacts pour annoncer la suite sur le premier écran.

Sous le héros : tester des rangées de hauteur proche avec largeurs proportionnelles aux formats originaux. Garder l'ordre éditorial, un seuil de taille lisible et une dernière rangée qui ne grossit pas excessivement. Cette étude de disposition ne doit pas être transplantée telle quelle en production : réserver la géométrie côté serveur/CSS et éviter tout réarrangement après hydratation.

## 3. Héros et pagination : un seul ordre logique

Recommandation : 24 résultats uniques par page, héros compris.

```text
Ordre « Sélection » = [vedette, portrait, paysage A, paysage B]
                     + [catalogue éligible sans ces quatre IDs]

Page 1 : les quatre emplacements + vingt vidéos dessous
Page 2 : résultats 25 à 48, sans répétition du héros
Page 3 : résultats 49 à 72, etc.
```

Le total correspond à cet ensemble éligible dédupliqué. Une limite de réponse API ne définit jamais le total. Recherche, famille, exclusions et publication s'appliquent avant comptage et pagination. Le serveur hydrate uniquement les résultats nécessaires, avec un ordre déterministe et un départage par ID.

Les tris chronologiques affichent le catalogue dans l'ordre demandé, avec les quatre vidéos réintégrées à leur position normale et sans héros imposé. Le changement de tri ou de famille retourne à la page 1. Les pages 2+ gardent titre de famille, total, navigation et vrais liens HTML. Le retour navigateur conserve l'URL et retrouve le contexte.

Les quatre slots sont résolus sur la même version de configuration que le reste de la page. Une réponse paginée ne doit pas mélanger un ancien ensemble de héros avec une nouvelle sélection. Une erreur de lecture reste une erreur avec possibilité de réessayer, pas une liste vide ni un décalage avancé.

Conserver `/examples`, `/examples/{famille}` et `?page=N`, avec canonical propre à chaque page indexable. La proposition de passer de 60 à 24 modifie le découpage des listes, pas les URL des vidéos ; les anciennes pages encore demandées hors plage doivent suivre la politique de normalisation actuelle, revue explicitement dans les tests SEO.

## 4. Petit menu supérieur

- Une seule barre courte pour les familles, avec ordre stable et sélection visuellement claire. Éviter de déplacer la famille active dans la liste à chaque navigation.
- Liens vers les routes existantes, donc partageables et explorables. Le clic sur Wan ouvre la galerie Wan, pas une copie locale du filtre.
- Familles principales visibles, accès « Tous les modèles » aux autres. Sur mobile, placer toutes les familles masquées dans ce menu : aucune destination ne doit disparaître au point de rupture.
- Total et tri proches de la galerie. Les compteurs doivent provenir d'agrégats complets ; les comptes actuellement calculés à partir des résultats chargés ne sont pas une source suffisante.
- Le menu doit fonctionner au clavier, indiquer l'élément actif et rester disponible sans prendre une deuxième grande bande de texte.

## 5. Cartographie admin vérifiée

| Aujourd'hui | Responsabilité existante | Friction à résoudre |
| --- | --- | --- |
| `/admin/moderation` | Publication/visibilité des vidéos, aperçu, affectations de playlists, envoi vers Video SEO | On peut quitter le contexte de la vidéo en passant à l'étape suivante |
| `/admin/video-seo` | Candidats, édition de la fiche, slug canonique, miniature, QA et inclusion calculée au sitemap | Ajout par ID séparé, nombreuses informations, destinations de galerie peu intégrées |
| `/admin/playlists` | Destinations, ordre manuel, sélection + automatique, exclusions, aperçu et sauvegarde | Aperçu textuel, pas de quatre emplacements typés, différence entre affectation historique et curation |
| `/admin/seo` | Accès à Google Search Console et à la publication vidéo | Le reporting GSC a déjà été retiré de l'app ; ne pas recréer ce cockpit |

Propriétaires actuels à conserver : `server/video-seo-editorial.ts` pour les métadonnées éditoriales ; `server/video-seo.ts` et les services sitemap pour l'éligibilité SEO ; `server/playlists/curation-service.ts` et `curation-store.ts` pour la sélection et ses sauvegardes transactionnelles ; la publication média garde ses contrôles d'accès existants.

## 6. Parcours admin cible

Une bibliothèque d'administration permet de retrouver une vidéo une fois, puis d'ouvrir sa fiche avec trois sections :

1. **Vidéo et publication** : lecteur, miniature, format réel, modèle/version, prompt et état de visibilité.
2. **Fiche et SEO** : titre court, titre SEO, description, canonical protégé et aperçu de la page ; champs avancés repliés, blocages concrets regroupés.
3. **Présence dans les galeries** : destinations concernées, place dans le héros ou la suite, exclusions, et aperçu public desktop/mobile.

L'entrée **Ajouter une vidéo** part d'une génération existante sélectionnée visuellement ou de son ID/lien reconnu. Elle conserve son ID tout au long du parcours. Réutiliser le candidat SEO s'il existe, plutôt que créer un doublon. Préremplir les liens modèle/famille à partir du registre ; ne pas demander de ressaisir manuellement des slugs que l'application connaît déjà.

L'écran **Galeries** reste utile pour composer une page entière. Il montre quatre emplacements nommés et typés, la suite manuelle/automatique, les exclusions et le rendu paginé. Le choix d'une vidéo utilise le même sélecteur que la bibliothèque, filtré sur le format et la destination autorisés.

Les anciens points d'entrée restent accessibles pendant la transition et ouvrent la même fiche avec la bonne vidéo sélectionnée. Le regroupement de l'interface ne justifie pas de mélanger les propriétaires de données.

### États distincts à rendre compréhensibles

- **Publique sur le site** : état de publication réel de la vidéo.
- **Présente dans ces galeries** : projection des sélections et exclusions.
- **Fiche SEO en brouillon / à compléter / approuvée** : état éditorial.
- **Éligible / présente au sitemap vidéo** : résultat du contrôle technique et éditorial.

« Présente au sitemap » ne prouve pas l'indexation par Google. Renommer l'intitulé actuel « Indexed Watch Pages » pour refléter la donnée effectivement connue. La consultation GSC reste le lien externe existant.

Publier une vidéo privée reste une action explicite. Affecter une vidéo à un slot, préparer un candidat SEO et approuver une fiche n'impliquent pas silencieusement les autres opérations. Après une opération partielle ou échouée, afficher l'étape effectivement enregistrée et garder le brouillon restant.

## 7. Données des emplacements

Recommandation : une configuration explicite de quatre IDs par destination, rattachée à la curation existante, avec les points de cadrage des deux aperçus secondaires. Ne pas inférer durablement les quatre rôles depuis les quatre premières lignes d'une playlist historique.

- IDs uniques ; une vidéo ne peut pas être sélectionnée et exclue simultanément.
- Vidéos terminées, publiques, indexables, sources accessibles, sans output/asset supprimé ; modèle/famille compatibles.
- Format contrôlé à partir des dimensions connues de l'output, avec l'aspect déclaré comme repli documenté. Les sources approchantes telles que 159:91 doivent avoir une tolérance explicite et testée ; les formats inconnus ne sont pas supposés corrects pour un slot.
- Modes manuel et hybride, ordre existant, exclusions et vide configuré restent autoritaires. Une mise en avant doit appartenir au périmètre de la sélection ; elle ne rend pas une vidéo privée visible et ne réintroduit pas une exclusion.
- Étendre ensemble brouillon, aperçu, empreinte de révision et sauvegarde transactionnelle. Éviter deux écritures indépendantes « ordre » puis « héros ».
- Migration additive et activation par destination, sans réécrire automatiquement les anciennes sélections. La homepage et les starters gardent leurs contrats propres jusqu'à adaptation explicite.

### Si les quatre formats ne sont pas disponibles

L'admin indique précisément l'emplacement manquant. Le héros complet s'active quand les quatre slots sont valides. La page publique conserve entre-temps une galerie normale et utilisable ; elle ne montre ni trou, ni doublon, ni vidéo d'une autre famille pour remplir le cadre. Une vidéo devenue privée ou supprimée est retirée immédiatement par l'éligibilité, même si un ancien choix admin la référence encore.

## 8. Ménage prévu et garde-fous concrets

- Mutualiser recherche/sélection d'une vidéo, aperçu et accès à sa fiche entre les trois écrans.
- Remplacer les sélecteurs de playlists historiques pour une destination gérée par la curation ; conserver un chemin compatible pour les destinations non migrées.
- Réduire les champs et actions redondants ; garder les paramètres avancés et les explications de blocage accessibles.
- Rendre tous les changements de destination, sauvegarde, annulation et retour à la vidéo explicites. Préserver les protections contre perte de brouillon et les conflits de révision.
- Supprimer uniquement les composants/chemins rendus inutiles après vérification des imports, routes directes et contrats. Conserver les données historiques et les exclusions SEO empêchant un ancien fallback de republier une page.
- Protéger les slugs déjà publiés et leurs redirections, les métadonnées localisées, originaux et contrats d'authentification/reprise dans l'app.

## 9. Séquence de réalisation proposée

1. **Contrat de données** : fixtures historiques/curation, total exact, pagination SQL bornée, droits/éligibilité, déduplication et slots typés. Prouver que 120+ vidéos et les pages profondes sont accessibles.
2. **Admin cohérent** : fiche partagée, ajout contextualisé, sélection des quatre slots et aperçu réel ; conserver les sauvegardes et contrôles SEO existants.
3. **Pages publiques** : héros fixe, suite multi-formats, menu compact, URLs paginées et fiche de lecture/réutilisation.
4. **Chargement et validation** : poster critique SSR, lectures visibles limitées, chargement des aperçus courts, pause hors écran ; comparaison CWV avant/après avec la tâche dédiée, desktop/mobile, froid/chaud.
5. **Nettoyage et intégration** : supprimer les doublons devenus inutiles, mettre à jour les guides/contrats, revue, CI et procédure Git/Vercel sur une branche propre issue de main.

Tests indispensables : publication privée→publique→privée ; retrait d'un slot devenu inéligible ; absence de 9:16 ; sélection vide ; mode manuel/hybride ; même vidéo présente dans plusieurs playlists sources ; pages 1/2/dernière ; changement de tri/famille ; erreur réseau sans saut ; retour navigateur ; save concurrent ; candidat SEO existant ; canonical verrouillé ; retrait SEO sans suppression du média ; sitemap réel ; lecture originale et reprise après connexion.

## 10. Étude locale disponible

`http://127.0.0.1:3206/` : prototype de proportions utilisant un instantané public de 120 vidéos, avec quatre slots fixes, suite multi-formats, pagination locale et lecteur au format original. Sources dans `.reports/video-discovery-2026-09-28/format-lab/`.

Les tests géométriques couvrent sept largeurs pour le héros, les cinq pages du jeu de données, les galeries entièrement verticales/horizontales, l'ordre, l'absence de doublons et de chevauchements. Ce prototype sert à la phase zéro. Il ne démontre ni la performance du futur rendu Next.js, ni la pagination SQL, ni le fonctionnement du futur admin.

## Ajustements utilisateur après la phase zéro

- Tous les modèles découvrables sont accessibles dans le menu en pleine largeur ; navigation horizontale sur mobile.
- Aucun prix sur les cartes de galerie. Coût enregistré et prix comparatifs uniquement dans l’ouverture de la vidéo.
- Pas de compteur de catalogue en haut, ni « vidéos publiques » / « sélection de démonstration ». Navigation paginée explicite.
- Pop-up soigné : vidéo, coût enregistré, paramètres, prompt copiable, références publiques, liens modèle et reprise dans l’app.
- Jusqu’à trois alternatives compatibles sous le lecteur, avec prix canonique selon un scénario déclaré ; différences de durée/résolution explicites.
- L’URL watch individuelle, le lecteur au premier plan et les métadonnées serveur restent la destination SEO.

## Précisions finales sur le lecteur et la comparaison — 28 septembre

- Direction choisie : les deux maquettes sombres d’origine, avec les couleurs et la typographie actuelles de l’app. Paysage avec informations à droite ; portrait avec vidéo entière au centre. Les essais crème sont abandonnés. Respecter les dimensions réelles du média, sans étirement.
- « Prix à réglages identiques » affiche une seule configuration explicite, commune aux tarifs présentés. Aucun tarif de 10 s ne peut servir de comparaison implicite pour un exemple de 22 ou 30 s. Si le modèle ne prend pas en charge cette configuration, il n’est pas proposé. Jusqu’à trois alternatives exécutables, sans forcer leur nombre.
- Le coût historique de l’exemple reste séparé des estimations actuelles. Pour les anciennes sources dont les entrées complètes ne sont pas publiques, la comparaison est explicitement une reprise du prompt en texte-vers-vidéo sans référence. Ne pas prétendre récupérer des références absentes ou privées.
- « Créer ma version » prépare le formulaire ; il ne lance pas de génération. Le choix d’un modèle dans le comparatif transporte la configuration annoncée et conserve le prompt complet. La reprise du job original ne doit pas écraser ce choix.
- Remplacer « Ouvrir la fiche complète » par « Voir la page de cette vidéo ». Cette page autonome conserve son rôle SEO et ses URLs ; le lecteur rapide ajoute la navigation précédente/suivante sans supprimer la watchpage.

## User revision: comparison coverage

The later user decision supersedes the exact-settings-only policy: offer three distinct models with canonical prices. Preserve source duration first; use the closest executable format/resolution/audio and, only when needed to fill the proposals, duration. Each proposal displays its full settings and highlights adaptations; its app link carries exactly that quoted configuration. Unknown source configuration is not presented as known. Price-service failures remain explicit.

## Catalog completeness correction

The general gallery's default feed includes independently published family/model media, not only the old hub playlist. Explicit global curation remains authoritative; explicit family curation suppresses its inherited model feeds. Existing hub membership remains independent, so family exclusions do not remove a video selected directly in the hub. Public-source eligibility, registry discovery policy and ID deduplication apply before the SQL count/limit. Local visual review must capture every family independently and reproduce the full default public catalog, rather than classify a limited 120-card hub sample.
