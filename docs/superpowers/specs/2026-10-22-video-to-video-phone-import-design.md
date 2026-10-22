# Import téléphone et sélection d’extrait pour les workflows vidéo-vers-vidéo

Statut : proposition de conception à relire, pas une fonctionnalité livrée.
Contexte : demande du 22 octobre 2026. Le correctif de sérialisation des durées est indépendant de cette proposition.

## Intention et décisions déjà exprimées

Une personne choisit directement une vidéo de son téléphone ou de sa bibliothèque, indique ce qu’elle veut changer et obtient un résultat sans préparer manuellement son fichier dans un autre logiciel. Le parcours doit servir tous les modèles d’édition vidéo disponibles, avec toutes les capacités réellement exécutables de chacun. Un sélecteur de passage doit être partagé, notamment pour choisir quelques secondes dans une vidéo d’une minute.

Conserver l’original admis dans la bibliothèque, dans une enveloppe de stockage explicite. Ne pas couper, compresser ni convertir silencieusement la vidéo de l’utilisateur. Une copie de préparation peut être produite par l’application lorsque nécessaire, après présentation du passage retenu et des adaptations. Les originaux déjà enregistrés en bibliothèque, dont celui de l’essai, gardent leur politique existante. Ce travail ne modifie pas les capacités ni la publication des modèles.

Retour utilisateur sur la proposition : maîtriser le coût cumulé des gros fichiers avant toute hausse du plafond. L’enveloppe initialement proposée de 1 Gio / 120 secondes n’est ni approuvée ni activée ; elle est retirée comme valeur par défaut de la V1.

Après comparaison des usages documentés ci-dessous, la recommandation devient une bibliothèque avec quota : l’utilisateur peut revenir à sa source et choisir un autre passage un autre jour. La purge à 24 h initialement proposée pour tous les nouveaux originaux est retirée. Une expiration courte concerne seulement les fichiers de transit, les imports abandonnés et les copies techniques inutilisées. Cette révision reste une proposition à valider, sans changement de production.

## Usages comparables vérifiés le 22 octobre 2026

| Produit et périmètre | Pratique documentée | Conséquence pour la proposition |
| --- | --- | --- |
| Runway, bibliothèque et Edit Studio | Les imports sont enregistrés dans Assets. Edit Studio conserve une version source accessible et permet de limiter l’édition à une plage temporelle. La page tarifaire affiche notamment 5 Go gratuits et 20 Go en Standard. | Bibliothèque, quota de stockage et plage traitée sont des notions distinctes. |
| Kapwing, stockage du workspace | Quotas de 2 Go gratuits, 100 Go Pro et 500 Go Business ; avertissement à 90 %, nouveaux imports bloqués à 100 %. Les assets sans projet depuis 30 jours peuvent être purgés. | Protéger le coût par quota et nettoyer les assets abandonnés, sans effacer une source utilisée le lendemain de son import. |
| Adobe Firefly, édition vidéo par prompt | L’entrée dédiée accepte MP4/MOV, moins de 200 Mo et 5–20 secondes. | Un plafond de fichier et de durée par outil est une autre limite, indépendante du stockage de bibliothèque. |
| Runway, API d’upload éphémère | Les URI d’upload temporaire sont utilisables pendant 24 h. Cette documentation décrit le transit API, pas la conservation de la bibliothèque utilisateur. | Ne pas déduire une expiration des sources utilisateur à partir de la durée de vie d’une référence technique. |

Sources : [Runway Assets](https://help.runwayml.com/hc/en-us/articles/4408611980563-Managing-assets), [Edit Studio](https://help.runwayml.com/hc/en-us/articles/51683104370451-Creating-with-Edit-Studio), [tarifs Runway](https://runway.com/pricing), [stockage Kapwing](https://www.kapwing.com/help/cloud-storage-policy/), [édition Firefly](https://www.adobe.com/uk/products/firefly/features/ai-video-editor.html), [entrées API Runway](https://docs.dev.runwayml.com/assets/inputs/).

Ce relevé décrit les interfaces et politiques publiées, pas leurs architectures internes ni une norme universelle. Les quotas concurrents ne sont pas repris automatiquement dans MaxVideoAI : leur financement par abonnement diffère de notre offre et doit être chiffré séparément.

## Résultat de l’essai réel

Un MOV iPhone H.264/AAC de 26,85 Mo, 5,558333 secondes, 25 images/s, BT.709 et rotation de -90 degrés a été importé avec succès, sans transformation, via le helper privé officiel. La référence est ensuite sélectionnable dans le workspace web administrateur. Cela valide cet original et cette voie d’import ; cela ne certifie pas encore le sélecteur natif iOS, Android, HEVC ou Dolby Vision.

L’aperçu montre le sujet à l’endroit. La bibliothèque affiche toutefois les dimensions encodées 3840 × 2160 pour cette vidéo présentée en portrait : les dimensions d’affichage et la rotation doivent être distinguées.

La préparation du tarif dans le workspace affiche « Invalid preflight request ». Reproduction locale du passage du sélecteur de durée à la validation stricte : les valeurs « 5s » et « 10s » de Luma, ainsi que les durées avec suffixe de Gemini Omni, ne sont pas converties en secondes numériques. Les variantes numériques de Kling et Seedance passent. Le correctif de cette branche traite cette frontière partagée sans élargir les paramètres acceptés par le serveur.

Une seconde limite reste indépendante : notre intégration Luma Modify autorise actuellement uniquement des sources vérifiées de 5 ou 10 secondes exactement. Le MOV de 5,558333 secondes ne respecte pas cette politique locale. Aucun appel payant ni rejet par le fournisseur Luma n’a eu lieu.

## Parcours proposé

1. **Importer ou choisir.** Un seul contrôle vidéo permet Téléphone/Fichier ou Bibliothèque. Pour un nouveau fichier, afficher le poids et vérifier la place disponible avant le transfert ; l’aperçu local peut s’ouvrir sans attendre lorsque le navigateur sait le lire. L’import réussi ajoute l’original à la bibliothèque. Le transfert conserve ses octets, son identité, le nom et les métadonnées mesurées. Progression, annulation et reprise d’une opération interrompue restent rattachées au bon compte.
2. **Voir la source.** Afficher un aperçu dans la bonne orientation, la durée réelle, les dimensions affichées et la présence de son. Le format du fichier n’est présenté que s’il nécessite une adaptation.
3. **Choisir le passage.** Un composant partagé affiche le lecteur, une bande de vignettes, deux poignées début/fin, les temps éditables et la durée sélectionnée. Les interactions fonctionnent au toucher, au clavier et au lecteur d’écran. Lire uniquement le passage choisi facilite la vérification.
4. **Appliquer le profil du modèle.** Les durées autorisées, le nombre de sources, la conservation du cadrage et du son et les options avancées proviennent du modèle/mode courant. Un passage trop long reste visible avec une explication et une action pour l’ajuster. Ne pas remettre la sélection à zéro en changeant de modèle.
5. **Préparer si nécessaire.** L’action affiche par exemple « Utiliser 00:12–00:22 · 10 s » et, si besoin, « Une copie compatible sera préparée. Original conservé ». Compression, orientation, codec et cadence sont des adaptations techniques du dérivé ; la coupe est un choix explicite du passage.
6. **Décrire, chiffrer, générer.** Le tarif utilise les faits vérifiés du dérivé réellement envoyé. Un échec de préparation ne déclenche jamais de génération. Une fois le rendu terminé, l’avant/après compare exactement le passage source sélectionné au résultat.

Pour un fichier déjà compatible et une sélection couvrant toute sa durée, réutiliser les octets sans réencodage ni duplication. Si le transport utilise un espace temporaire, promouvoir l’original vérifié hors de cet espace avant de déclarer l’import terminé et de le rendre sélectionnable.

## Ce qui est partagé et ce qui appartient au modèle

| Commun | Propre au modèle et au mode |
| --- | --- |
| Import privé, progression, annulation | Formats, limites de poids et durée de source |
| Aperçu, orientation, métadonnées réelles | Durée de sortie libre, fixe ou héritée de la source |
| Sélection début/fin et lecture du passage | Conservation ou modification du format d’image |
| Préparation d’une copie, état et récupération | Références, images guides, images clés et leur nombre |
| Erreurs compréhensibles et devis vérifié | Force de transformation, pose, profondeur et contrôles exposés |
| Comparaison source/résultat et provenance | Politique audio, HDR/EXR et conditions d’accès |

Le socle commun ne réduit pas les modèles au plus petit ensemble d’options partagé. Une fonction indisponible dans l’environnement courant ne doit pas être présentée comme exécutable. Les fonctionnalités réservées aux admins restent réservées aux admins.

Le même sélectionneur pourra servir les références vidéo, extensions et autres outils lorsqu’ils ont réellement besoin d’un passage ; leur sémantique propre ne doit pas être convertie artificiellement en mode Modify.

## Architecture proposée

### Contrat de capacités

Projeter les règles des définitions de modèles et de leurs contrats d’exécution existants dans un profil de préparation par modèle, mode et champ source. Réutiliser les propriétaires existants de schéma, de contraintes média et de disponibilité. Ne pas créer un second catalogue de modèles.

Distinguer explicitement :
- limites d’import de la plateforme ;
- limites de la vidéo source chez le fournisseur ;
- politique de durée de sortie ;
- classes tarifaires disponibles ;
- contraintes du dérivé et adaptations possibles.

Les limites Luma de 5/10 secondes sont aujourd’hui une politique MaxVideoAI liée aux classes de prix. Le fournisseur documente un plafond de source de 18 secondes. Toute extension aux durées fractionnaires nécessite une règle fournisseur de facturation vérifiée et son intégration tarifaire ; le sélecteur ne doit pas inventer d’arrondi.

### Import et faits média

Conserver `frontend/lib/client-video-upload.ts` comme propriétaire du transport navigateur. Le transport multipart existe déjà ; ne pas le dupliquer pour Luma. La limite d’import par défaut actuelle de 50 Mio et la qualification des originaux plafonnée à 100 Mio ne suffisent pas à promettre l’import de toutes les vidéos 4K d’une minute.

Conserver les plafonds actuels tant que le pilote admin n’a pas mesuré le coût complet, les codecs et la charge. L’objectif reste de sélectionner un passage dans une vidéo d’une minute ; l’extension du plafond doit être bornée par les budgets décrits ci-dessous, pas par la seule capacité du transport. Les fichiers plus lourds exigent des téléchargements et sondages sur disque/en streaming dans un worker. Ne pas relever simplement les constantes des chemins actuels qui chargent les octets en mémoire. Les clients MCP gardent leur enveloppe existante tant que leur transport n’est pas étendu explicitement.

Les faits vérifiés doivent conserver dimensions encodées, rotation/dimensions affichées, durée, cadence rationnelle/variable, codec, espace colorimétrique et audio. Les anciens enregistrements sont qualifiés à la demande sans réécriture globale de la bibliothèque.

### Coût, quotas et conservation proposés

Le stockage actuel est Amazon S3, conformément à `docs/data-platform.md` et `frontend/server/storage.ts`. Le relevé de production du 19 octobre indique `us-east-1` et aucune règle de lifecycle du bucket à cette date ; il ne prouve pas la configuration actuelle ni l’absence de toute purge applicative. Les garanties ci-dessous restent à implémenter et à vérifier.

Le tarif public S3 Standard `us-east-1`, vérifié le 22 octobre 2026 dans le catalogue AWS publié le 15 octobre, est de 0,023 USD/Gio-mois pour les 50 premiers Tio, puis 0,022 USD/Gio-mois jusqu’à 500 Tio. Comparaison illustrative pour un stock conservé pendant un mois complet :

| Stock | Volume facturable | Stockage seul par mois |
| --- | --- | --- |
| 10 000 originaux de 1 Gio | 10 000 Gio | 230 USD |
| 10 000 extraits de 30 Mio | 292,97 Gio | 6,74 USD |

30 Mio est une hypothèse de calcul, pas une taille garantie ni une limite commune aux modèles. Ces montants excluent requêtes, transferts, calcul, rendus, autres copies et taxes. La deuxième ligne représente uniquement les extraits : avec une bibliothèque conservant les originaux, son coût s’ajoute à celui des sources au lieu de le remplacer. Le quota borne ce cumul. À titre d’échelle, une enveloppe remplie de 20 Gio représente 0,46 USD par mois de stockage au premier palier, sans les autres coûts ; ce n’est pas encore un quota commercial choisi pour MaxVideoAI.

Politique proposée pour les **nouveaux imports du parcours Modify** :

- **Original en bibliothèque.** Une fois l’import admis, garder la source privée et réutilisable sous le quota et la politique de conservation de bibliothèque annoncés. Aucun effacement automatique à 24 h d’un import réussi. Le fichier sur le téléphone reste intact. L’utilisateur peut revenir choisir un autre passage sans renvoyer la vidéo ; l’interface permet de voir et gérer l’espace occupé.
- **Conservation utile et bornée.** Compter les sources, les extraits retenus, les résultats et leurs dérivés stockés dans l’enveloppe appropriée ; le résultat suit la politique de bibliothèque existante. Réutiliser les copies identiques au sein du compte et conserver le lien de provenance. Ne pas multiplier les copies pour chaque changement de modèle. Un dépassement ne supprime pas automatiquement des sources ou des projets existants ; proposer de libérer de l’espace ou d’augmenter le quota selon l’offre. Aucun changement rétroactif de conservation sur la bibliothèque actuelle.
- **Quotas vérifiés avant de recevoir les octets.** Réserver atomiquement le poids de l’original dans le quota de bibliothèque, le volume de transit et l’enveloppe nécessaire au dérivé, par compte et globalement ; mesurer et réconcilier les octets réels. Additionner les imports concurrents, parties multipart et dérivés. Refuser le transfert ou la préparation en dépassement, avec une action compréhensible ; aucune facturation supplémentaire automatique. Des limites absentes ou invalides ferment l’accès aux imports lourds. Les plafonds commerciaux nécessitent les mesures du pilote avant ouverture publique.
- **Budget de traitement distinct.** Borner les octets importés par jour, le nombre de préparations, leur durée de calcul, leur concurrence et leurs relances. Réutiliser une préparation identique au sein du même compte. Une limite de stockage ne protège pas contre des milliers de conversions successives. Les qualités HDR et formats lourds restent propres aux modèles ; un dépassement de quota ne doit pas entraîner une dégradation silencieuse.
- **Purge effective et filet de sécurité.** Nettoyer les imports abandonnés, erreurs, parties incomplètes et dérivés techniques non retenus. Pour ces seuls fichiers de transit, proposer une purge applicative à 24 h et une expiration S3 à deux jours, plus l’abandon des multipart incomplets après un jour. Borner les opérations de transit pour qu’elles terminent ou échouent avant cette échéance. Vérifier les règles et les octets réellement supprimés ; traiter aussi les versions non courantes si le versioning est activé. Ne jamais appliquer cette expiration aux originaux de bibliothèque, aux extraits retenus ou aux résultats. Tout asset admis doit avoir quitté le périmètre temporaire avant l’expiration.
- **Mesurer puis couper l’admission.** Suivre coût par import abouti/abandonné, stockage temporaire/durable, trafic, calcul et erreurs de purge. Réutiliser le suivi de coûts S3 existant pour rapprochement, avec des compteurs immédiats pour les quotas : les alertes de facturation différées ne constituent pas un plafond. En cas de budget atteint, bloquer les nouveaux travaux concernés sans supprimer les médias déjà conservés.

L’aperçu local peut éviter un transfert abandonné avant validation, mais ne garantit pas une coupe locale fiable de tous les MOV/HEVC. Le parcours principal importe la source complète sous quota, puis prépare le passage côté serveur si nécessaire. Préférer une préparation près du bucket, en vérifiant son coût réel, pour éviter des transferts répétés de l’original vers un service externe ; envoyer ensuite au modèle uniquement l’extrait vérifié. Le pilote doit mesurer cette voie avant toute promesse de plafond élevé.

### Composant et état de sélection

Placer le sélecteur réutilisable sous `frontend/components/media/` ; règles temporelles pures sous `frontend/lib/` ; orchestration du workspace dans un hook dédié. `AppClient.tsx` reste un orchestrateur.

La sélection est liée à l’identité et à la version de l’original, pas uniquement à son URL. Conserver début/fin en temps source, sans arrondi implicite à la seconde. Montrer la durée effectivement réalisable lorsque le modèle exige un nombre de frames précis. Les images clés sont recalculées par rapport au passage préparé et à sa cadence réelle ; ne pas réutiliser directement un index absolu de la vidéo entière.

Les anciennes sélections issues de la bibliothèque restent utilisables. Retirer la source, changer de compte ou remplacer la vidéo invalide les préparations en cours et les devis associés.

### Préparation serveur

Créer une opération de préparation asynchrone distincte d’une génération et d’un export Studio payant. Réutiliser les primitives de stockage, d’accès propriétaire, de jobs et FFmpeg après vérification de leurs contrats, sans réutiliser leur facturation par accident.

Entrée : référence propriétaire de l’original, bornes du passage et profil de préparation versionné. Le serveur recharge les faits, valide les bornes et les capacités puis prépare la copie. Une clé idempotente liée au compte, à l’original, au passage et au profil évite les doublons.

Sortie : un dérivé privé avec faits mesurés, statut et lien de provenance vers l’original. Vérifier les octets obtenus avant de rendre le dérivé sélectionnable. Une relance récupère l’opération existante ; elle ne génère pas une nouvelle vidéo payante.

Réencodage uniquement si nécessaire : orientation physique correcte, codec/conteneur supporté, taille et cadence compatibles, conversion HDR vers SDR seulement si le profil l’exige et en l’annonçant. Préserver le son quand le modèle le permet ; annoncer séparément ce qui sera envoyé et ce qui sera produit. Un simple remux ne suffit pas à garantir une coupe exacte.

## Validation et livraison

Premier lot, indépendant : correction de la sérialisation des durées du workspace, vérifiée sur les valeurs réelles de plusieurs modèles et contre la frontière stricte de préflight. Garder les unités inconnues invalides et Auto inchangé.

Deuxième lot : contrat de capacités et sélecteur partagé, puis préparation serveur et intégration de bout en bout derrière un accès admin. Conserver le devis indisponible tant que le média exact n’est pas prêt.

Tests d’acceptation :
- original inchangé ; deux passages d’une même source donnent deux dérivés identifiables ;
- vidéo de 60 secondes : sélection au milieu et en fin, toucher/clavier, lecture bornée ;
- iPhone MOV avec rotation, MP4 Android, H.264, HEVC, cadence variable, vidéo muette, piste audio, HDR/SDR ;
- comportement explicite pour fichier corrompu, codec non supporté et dépassement de quota ;
- réservations de quota sous imports concurrents, abandon multipart, relances idempotentes et arrêt de l’admission au budget ;
- source importée encore disponible après 24 h pour choisir un autre passage ; expiration des seuls fichiers de transit sans perte des extraits, résultats ou originaux de bibliothèque ; purge vérifiée des octets et reprise après échec de nettoyage ;
- copie exacte de 5/10 secondes lorsque le profil l’exige, sans confiance dans une durée déclarée par le navigateur ;
- matrice des modèles/modes v2v du catalogue effectif, avec options particulières conservées ;
- changement de modèle, source ou compte pendant import/préparation ; aucun rattachement tardif incorrect ;
- validation du dérivé envoyé, prix calculé sur ce même média, aucune modification silencieuse du passage ;
- un essai réel iOS Safari et Android Chrome avant de déclarer le parcours téléphone validé ;
- un seul essai fournisseur approuvé après devis, récupération du résultat et comparaison visuelle.

## Références de travail

- [Guide média](../../engineering/media-delivery.md)
- [Limites et intégration Luma du premier essai](../../operations/2026-10-22-luma-modify-canary.md)
- [Luma Agents — Video editing](https://docs.agents.lumalabs.ai/guides/videos/editing/)
- [Luma Agents — Pricing](https://docs.agents.lumalabs.ai/guides/pricing/)
- [Amazon S3 — Tarifs](https://aws.amazon.com/s3/pricing/)
- [Amazon S3 — Catalogue tarifaire us-east-1](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/us-east-1/index.json)
- [Amazon S3 — Lifecycle](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html)
- [Relevé de configuration du 19 octobre](../../operations/data-transparency-2026-10-19.md)

Cette proposition ne certifie pas un rendu réel et n’autorise aucun appel payant supplémentaire.

