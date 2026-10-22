# Import téléphone et sélection d’extrait pour les workflows vidéo-vers-vidéo

Statut : proposition de conception à relire, pas une fonctionnalité livrée.
Contexte : demande du 22 octobre 2026. Le correctif de sérialisation des durées est indépendant de cette proposition.

## Intention et décisions déjà exprimées

Une personne choisit directement une vidéo de son téléphone ou de sa bibliothèque, indique ce qu’elle veut changer et obtient un résultat sans préparer manuellement son fichier dans un autre logiciel. Le parcours doit servir tous les modèles d’édition vidéo disponibles, avec toutes les capacités réellement exécutables de chacun. Un sélecteur de passage doit être partagé, notamment pour choisir quelques secondes dans une vidéo d’une minute.

Conserver l’original importé. Ne pas couper, compresser ni convertir silencieusement la vidéo de l’utilisateur. Une copie de préparation peut être produite par l’application lorsque nécessaire, après présentation du passage retenu et des adaptations. Ce travail ne modifie pas les capacités ni la publication des modèles.

## Résultat de l’essai réel

Un MOV iPhone H.264/AAC de 26,85 Mo, 5,558333 secondes, 25 images/s, BT.709 et rotation de -90 degrés a été importé avec succès, sans transformation, via le helper privé officiel. La référence est ensuite sélectionnable dans le workspace web administrateur. Cela valide cet original et cette voie d’import ; cela ne certifie pas encore le sélecteur natif iOS, Android, HEVC ou Dolby Vision.

L’aperçu montre le sujet à l’endroit. La bibliothèque affiche toutefois les dimensions encodées 3840 × 2160 pour cette vidéo présentée en portrait : les dimensions d’affichage et la rotation doivent être distinguées.

La préparation du tarif dans le workspace affiche « Invalid preflight request ». Reproduction locale du passage du sélecteur de durée à la validation stricte : les valeurs « 5s » et « 10s » de Luma, ainsi que les durées avec suffixe de Gemini Omni, ne sont pas converties en secondes numériques. Les variantes numériques de Kling et Seedance passent. Le correctif de cette branche traite cette frontière partagée sans élargir les paramètres acceptés par le serveur.

Une seconde limite reste indépendante : notre intégration Luma Modify autorise actuellement uniquement des sources vérifiées de 5 ou 10 secondes exactement. Le MOV de 5,558333 secondes ne respecte pas cette politique locale. Aucun appel payant ni rejet par le fournisseur Luma n’a eu lieu.

## Parcours proposé

1. **Importer ou choisir.** Un seul contrôle vidéo permet Téléphone/Fichier ou Bibliothèque. L’import conserve les octets originaux, leur identité, le nom et les métadonnées mesurées. Progression, annulation et reprise d’une opération interrompue restent rattachées au bon compte.
2. **Voir la source.** Afficher un aperçu dans la bonne orientation, la durée réelle, les dimensions affichées et la présence de son. Le format du fichier n’est présenté que s’il nécessite une adaptation.
3. **Choisir le passage.** Un composant partagé affiche le lecteur, une bande de vignettes, deux poignées début/fin, les temps éditables et la durée sélectionnée. Les interactions fonctionnent au toucher, au clavier et au lecteur d’écran. Lire uniquement le passage choisi facilite la vérification.
4. **Appliquer le profil du modèle.** Les durées autorisées, le nombre de sources, la conservation du cadrage et du son et les options avancées proviennent du modèle/mode courant. Un passage trop long reste visible avec une explication et une action pour l’ajuster. Ne pas remettre la sélection à zéro en changeant de modèle.
5. **Préparer si nécessaire.** L’action affiche par exemple « Utiliser 00:12–00:22 · 10 s » et, si besoin, « Une copie compatible sera préparée. Original conservé ». Compression, orientation, codec et cadence sont des adaptations techniques du dérivé ; la coupe est un choix explicite du passage.
6. **Décrire, chiffrer, générer.** Le tarif utilise les faits vérifiés du dérivé réellement envoyé. Un échec de préparation ne déclenche jamais de génération. Une fois le rendu terminé, l’avant/après compare exactement le passage source sélectionné au résultat.

Pour un fichier déjà compatible et une sélection couvrant toute sa durée, garder le chemin original sans réencodage.

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

Proposition V1 : import téléphone jusqu’à 1 Gio et 120 secondes, avec contrôle de quota et concurrence par compte ; le passage envoyé reste limité par le modèle. Cette enveloppe exige des téléchargements et sondages sur disque/en streaming dans un worker, et une validation de charge avant activation. Ne pas relever simplement les constantes des chemins actuels qui chargent les octets en mémoire. Les clients MCP gardent leur enveloppe existante tant que leur transport n’est pas étendu explicitement.

Les faits vérifiés doivent conserver dimensions encodées, rotation/dimensions affichées, durée, cadence rationnelle/variable, codec, espace colorimétrique et audio. Les anciens enregistrements sont qualifiés à la demande sans réécriture globale de la bibliothèque.

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

Cette proposition ne certifie pas un rendu réel et n’autorise aucun appel payant supplémentaire.

