# Lot de qualification et créations originales

Statut : proposition du 5 novembre 2026, aucun appel payant exécuté. Les rendus
retenus serviront aussi au marketing, avec leurs identités et paramètres réels.
Le code est fermé au public pendant cette qualification.

## Direction approuvée pendant la préparation

L'utilisateur a approuvé l'enveloppe de 10 USD pour sept requêtes, sans retry, en
remplaçant la nature morte initialement proposée par de vraies séquences cinéma :
personnages, jeu, dialogues, action et plusieurs plans ; éviter miroirs et transparence.
Le brief opérationnel exact est [cinema-qualification.json](cinema-qualification.json).
Le chat « Créer des scènes cinéma avec LTX » confirme cette exigence de montage et
séquences autonomes ; ses médias ne sont pas réutilisés ni réétiquetés ici.

**La dernière bobine** : une coursière apporte la bobine attendue par un projectionniste.
I1/I2 sont deux interprétations du même photogramme vivant. I3/I4 sont la même
retouche de costume sur I1, pour comparer l'identité et la précision. V1 : le
projectionniste réclame la fin du film (deux plans, « Where's my ending? »). V2 :
la coursière traverse le rideau (deux plans, « Found your ending. »). V3 : remise de
la bobine et mise en marche (trois plans, « Roll it. »). Les coupes sont écrites dans
le prompt Flash, sans champ multi_prompt non pris en charge par son endpoint.
Les images restent 1024² ; la vidéo I2V suit le cadrage de son original. Les autres
vidéos sont demandées en 16:9. Aucune promesse de continuité ou de lip-sync réussis
ne précède la revue des résultats.

Les sept requêtes restent à une sortie chacune : image high/complexity high/PNG,
vidéo 5s/720p. Composants fournisseur connus : environ 1,78072 USD, entrées OpenAI
en plus. La limite opérationnelle de 10 USD n'est pas un plafond garanti par l'API.
Les variantes ont le même prompt et les retouches la même source. Les prix client
ne sont pas approuvés par cette autorisation de production de médias.

La proposition de nature morte ci-dessous est archivée, non exécutable ; seuls les
prompts du JSON révisé font foi.

## Lot proposé : sept requêtes, une tentative chacune

Une sortie par requête. OpenAI : PNG 1024×1024, quality=high,
complexity=high, background=opaque. Flash : 720p, cinq secondes, audio natif,
aucun paramètre de désactivation audio. L'ordre respecte les dépendances.

| ID | Modèle / mode | Entrées | But et prompt | Coût fournisseur documenté |
| --- | --- | --- | --- | --- |
| I1 | GPT Image 2.6 Flare / t2i | Aucune | Photo studio d'un flacon fictif bleu cobalt, étiquette blanche « NORTH », bouchon noir mat, posé sur pierre claire, lumière douce à gauche, fond gris, composition carrée. Texte net, aucune autre inscription. | Sortie : 0,05268 USD ; entrée texte en plus |
| I2 | GPT Image 2.6 Sunburst / t2i | Même prompt I1 | Comparaison à réglages identiques ; garder les deux originaux, sans note anticipée. | Sortie : 0,05268 USD ; entrée texte en plus |
| I3 | GPT Image 2.6 Flare / i2i | Original I1 possédé | Conserver exactement le flacon, son bouchon, son étiquette et son cadrage. Remplacer uniquement le fond gris par un fond terracotta mat. Conserver direction de lumière et ombre. | Sortie : 0,05268 USD ; entrées texte/image en plus |
| I4 | GPT Image 2.6 Sunburst / i2i | Même original I1 | Même instruction I3 : comparaison avec une source identique. | Sortie : 0,05268 USD ; entrées texte/image en plus |
| V1 | Kling 4.0 Flash / t2v | Aucune | Dans un petit atelier en bois, un ruban de papier bleu se déroule sur une table. Travelling latéral lent, lumière du matin, texture du papier visible, froissement doux, plan continu de cinq secondes. | 0,47 USD |
| V2 | Kling 4.0 Flash / i2v | Original I1 possédé | Lent arc de caméra de gauche à droite autour du flacon. Conserver l'étiquette NORTH et la forme du produit ; lumière douce, léger son d'atelier, aucun changement de décor. | 0,47 USD |
| V3 | Kling 4.0 Flash / ref2v | Original V1 mesuré + I1 | Reprendre l'ambiance, le mouvement et la matière de la vidéo ; intégrer le flacon de l'image sur la table. Lent mouvement latéral, étiquette visible, bruit léger du papier, cinq secondes. | 0,063 × (5 + max(durée V1 mesurée, 5)) USD ; environ 0,63 USD si V1=5s |

Composants connus : environ **1,78072 USD**, hors entrées OpenAI, taxes et
écarts de facturation fournisseur. Ce chiffre n'est pas un devis complet.
Proposition d'enveloppe : **10 USD pour ces sept essais**, aucun retry automatique.
Le coût des entrées 2.6 n'a pas de borne documentée exploitable ici : l'enveloppe
est une autorisation opérationnelle, pas une limite technique garantie par l'API.
Relever les usages après chaque réponse et suspendre les demandes suivantes si
le coût devient incertain ou dépasse l'enveloppe. Une réponse ambiguë impose une
récupération et une vérification de compte ; ne jamais envoyer une deuxième requête.
L'approbation de ce lot ne valide ni des prix client ni d'autres rendus.

## Preuve par essai

Avant : SHA, environnement, acteur, modèle/mode, prompt, paramètres normalisés,
identités/mesures des originaux, budget approuvé, heure et clé de corrélation.
Après : une seule soumission, reçu provider, état job/réservation, usage observé,
coût estimé versus facture, URL originale, hash, MIME, taille, dimensions/durée,
audio réel, disponibilité dans la bibliothèque, téléchargement et réemploi.
Les URLs privées restent dans les outils internes, jamais dans cette documentation.

Les sept sorties ne suffisent pas à certifier toutes les qualités, les quantités
multiples, les 16 références ou les sujets vidéo Flash. Ces cas exigent leurs
propres preuves avant une annonce de couverture complète. App, Studio et MCP
restent trois colonnes de qualification distinctes ; une requête API brute ne
valide pas leur parcours de confirmation et de récupération.

## Sélection des médias

Critères I1/I2 : lisibilité de NORTH, silhouette, matériau, ombre et cadrage.
I3/I4 : changement ciblé du fond, préservation de la source, artefacts.
V1 : cohérence temporelle du ruban, mouvement de caméra, son.
V2 : conservation du flacon et du texte dans le mouvement.
V3 : réemploi visible des deux sources, continuité et audio.
Une sortie techniquement valide mais éditorialement faible reste une preuve de
qualification ; elle n'entre pas automatiquement dans la galerie publique.

Après sélection : importer originaux et dérivés via les propriétaires existants,
conserver le prompt exact et l'identité modèle, vérifier les réponses HTTP et la
lecture réelle, puis prévisualiser les collections révisionnées. Ne remplacer
aucun hero ni l'ordre manuel des familles sans sélection explicite.
