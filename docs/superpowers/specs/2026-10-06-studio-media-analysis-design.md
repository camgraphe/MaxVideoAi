# Studio : création, analyse des médias et itération avec Sol 6.1

Date : 6 octobre 2026. Branche : `codex/studio-media-analysis-design`.
Base inspectée : `ba6bc504e0b22a862a08f2b3e3ff667e86a5f574` (`origin/main`).
Statut : proposition de conception. Aucun changement de comportement, de tarif,
de crédit, de modèle ou de production n'est implémenté par ce document.

## Intention et décision acquise

Studio reste un assistant de création : comprendre l'intention, conseiller une
direction, préparer des images ou des vidéos, puis aider le client à améliorer
les résultats. L'analyse du contenu réel complète ce rôle lors d'une demande
d'itération ou d'un besoin d'assemblage ; elle ne transforme pas Sol en monteur
par défaut. Quand un montage est pertinent, il peut proposer des coupes et un
ordre de plans que le client peut examiner.
Le niveau Sol doit apporter un service supplémentaire mesurable et compréhensible.
Le passage à Sol au moment d'un besoin pertinent contribue à son utilisation,
sans dégrader les usages de Luna qui fonctionnent déjà.

Le propriétaire a choisi dans cette conversation : **Luna conserve la vision
des images ; l'analyse vidéo/audio et le montage avancé sont réservés à Sol 6.1.**
Le propriétaire a également précisé que le montage intervient pour répondre à
un besoin réel, notamment une durée supérieure à environ 30 secondes nécessitant
plusieurs clips, et que l'analyse doit aussi servir à comprendre les changements
demandés sur un média déjà généré. Il a ajouté les variantes d'accroche, le logo ou
carton de fin, l'insertion d'une image et la création d'un clip à partir d'une
musique fournie. Ces usages peuvent justifier un montage court et simple ; la
durée n'est pas le seul motif d'assemblage. Il a confirmé l'assemblage de plusieurs
plans pour un film plus long et interdit l'analyse ou le commentaire automatique
d'un résultat livré : l'analyse doit servir une demande du client ou un besoin
concret du travail restant. Le découpage technique et le parcours proposés
ci-dessous restent à examiner.

Le montage avancé désigne ici des décisions fondées sur le contenu observé :
repérer une action, sélectionner un passage, rapprocher deux plans, éviter une
coupe au milieu d'une phrase. Une opération précise demandée par le client,
comme déplacer un clip à une position donnée, reste une opération simple.
Insérer une image ou une musique avec des bornes connues reste aussi simple ;
sélectionner une accroche dans le contenu d'un clip ou adapter les plans à la
structure musicale nécessite les analyses correspondantes.

## Choisir le workflow depuis la demande du client

L'ordre de raisonnement proposé est : intention créative → résultat attendu →
capacités réelles du modèle de génération → opération adaptée. Aucun scénario
ne commence automatiquement par l'ouverture de la timeline ou un plan de montage.
Le choix de Sol donne accès à des outils supplémentaires ; il n'impose ni analyse
ni montage sur la première demande.

| Situation | Réponse attendue |
| --- | --- |
| « Crée une affiche » | Préparer une génération d'image et son devis ; aucune timeline |
| « Crée une vidéo de 10 secondes » | Choisir un modèle/mode compatible et préparer une vidéo ; aucune analyse ou assemblage implicite |
| « Je veux trois plans dans cette vidéo » | Vérifier si une génération à plusieurs plans répond au brief ; plusieurs plans ne signifient pas automatiquement plusieurs clips ou montage |
| « Je veux un film de 45 secondes » | Vérifier la durée réellement réalisable en une génération ou par extension ; si plusieurs clips sont nécessaires, expliquer et proposer leur assemblage |
| « Cette vidéo générée n'a pas le bon mouvement » | Examiner la portion utile si nécessaire, interpréter le changement, puis choisir retouche vidéo, nouvelle génération ou edit de timeline selon les capacités disponibles |
| « Change la lumière de cette image générée » | Réattacher l'image et préparer sa retouche ; la vision image reste disponible à Luna et Sol |
| « Assemble ces clips » | Répondre à la demande explicite de montage, en proposant l'analyse Sol seulement si les choix nécessitent de voir/entendre le contenu |
| « Assemble ces cinq plans dans cet ordre pour faire un film plus long » | Utiliser les sources, durées et bornes connues pour construire la séquence ; aucune analyse des plans ou du film assemblé par défaut |
| Une vidéo demandée vient de terminer sa génération | Livrer le résultat et son statut ; la demande est terminée, sans analyse, critique ou suggestions spontanées issues d'une nouvelle inspection |
| « Analyse cette vidéo que tu viens de générer » | Préparer l'analyse du résultat exact, son objectif et son plafond, puis l'exécuter après confirmation |
| « Fais trois versions avec des hooks différents » | Conserver un corps commun et proposer trois ouvertures distinctes ; réutiliser les médias fournis, ou préparer les devis des ouvertures à créer |
| « Ajoute mon logo / ce carton / cette image à la fin » | Proposer une insertion avec durée et présentation définies ; aucune analyse vidéo si les indications suffisent |
| « Mets cette musique sous la vidéo » | Insérer l'enregistrement fourni sur une piste audio, avec portion et niveau définis ; aucune génération de musique ni analyse sonore implicite |
| « Fais un clip musical sur ce morceau » | Prendre la musique comme base temporelle, proposer une direction visuelle et des plans ; utiliser Sol pour l'analyse musicale nécessaire, puis faire valider montage et éventuelles générations |

Le repère des 30 secondes signale un possible besoin de plusieurs générations.
Ce n'est ni une limite universelle des modèles ni un déclencheur automatique de
montage. Les durées, modes d'extension et capacités à plusieurs plans se vérifient dans
le catalogue canonique avec le modèle, la version et les paramètres réellement
sélectionnés. Une génération unique adaptée reste possible quand elle satisfait
le brief ; un montage court reste possible s'il est explicitement demandé.
Un hook de quelques secondes, un carton final ou une bande musicale sont des
motifs suffisants : Studio n'attend pas une durée supérieure à 30 secondes.

La simple présence d'un média généré ne déclenche pas une analyse payante.
L'analyse est liée à une question ou un changement pour lequel le contenu observé
apporte une information nécessaire. Une consigne précise déjà suffisante peut
aboutir directement à un prompt ou à une préparation compatible, sans prétendre
avoir inspecté le clip. Une analyse réussie ne déclenche pas automatiquement
`montage.plan` : elle peut aboutir à un conseil, une retouche ou une nouvelle génération.

## Déclenchement de l'analyse et fin d'une demande

**Un résultat généré et livré ne déclenche aucune analyse automatique.** Une
demande de génération satisfaite est terminée. Studio ne dépense pas de tokens
supplémentaires pour regarder le résultat, en faire une critique, proposer des
améliorations ou lancer une comparaison avant/après de sa propre initiative.
Cette règle vaut pour images, vidéos, sons et films assemblés, y compris sous Sol.

Une analyse a deux motifs admissibles : le client demande de l'analyser, ou le
contenu doit être observé pour résoudre une question concrète dans une création,
une modification ou un montage demandé encore en cours. Exemple : repérer le
moment où un personnage se retourne ou les changements musicaux qui doivent
guider les plans. Si le brief, les bornes ou les métadonnées suffisent, Studio
utilise ces informations. Dans tous les cas, le périmètre utile, le plafond de
crédits et la confirmation explicite précèdent le traitement payant.

Une fin de job, son polling ou son événement de livraison ne créent pas un run
d'analyse, une extraction pour inspection, un appel multimodal supplémentaire
ou une continuation destinée à commenter la qualité. Les mesures techniques
nécessaires au statut, aux durées, aux thumbnails et au rendu restent distinctes
de cette analyse de contenu. La reprise d'un travail déjà demandé peut poursuivre
les étapes restantes connues, par exemple assembler des plans, sans ajouter une
étape d'inspection absente du périmètre approuvé.

## Ce que l'intégration fait aujourd'hui

- `conversation-reference-mentions.ts` transmet les images jointes en
  `input_image`, avec `detail: low`. Vidéo/audio ne transmettent que des
  métadonnées. Les références historiques sont des étiquettes, pas des images
  automatiquement renvoyées à chaque tour.
- `conversation-timeline.ts` expose des identités, pistes, positions, durées,
  volumes et bornes source en frames. L'aperçu destiné au client est séparé de
  cette projection et ne donne pas automatiquement des images au modèle.
- `conversation-editing-contract.ts` permet insertion, déplacement, rognage,
  suppression et gain ; le serveur protège révision, propriété et pistes verrouillées.
  Les insertions audio se superposent sur une piste libre sans décaler les visuels
  ni remplacer la voix existante. L'insertion d'image reste une insertion visuelle,
  pas une commande générique de surimpression de logo ou de composition de texte.
- `studio-assistance-director.test.ts` conserve les outils actuels pour Luna.
  Il ne faut donc pas retirer arbitrairement ses outils de création ou d'édition.
- Le directeur dispose au maximum de quatre Responses par message et du
  journal durable avec reprise et facturation idempotentes. Une analyse longue
  ne peut pas être cachée comme une cinquième Response.
- Les crédits Sol, achats de packs, réservations et règlements sont déjà possédés
  par le contrat d'assistance et son ledger. Une sélection de Sol ne réactive
  pas automatiquement l'utilisation de crédits achetés mise en pause.

Les deux modèles acceptent texte et images, et produisent du texte :
[GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol) et
[GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), consultés
le 6 octobre 2026. Le service Sol proposé ajoute extraction, analyse et restitution ;
il ne prétend pas que Sol sait recevoir nativement une vidéo ou du son.

## Trois approches

| Approche | Bénéfice | Limite | Décision proposée |
| --- | --- | --- | --- |
| Envoyer quelques posters au prochain tour Sol | Petit périmètre et coût limité | Trois posters début/milieu/fin ne permettent pas de repérer précisément une action ni d'analyser le son | Insuffisant pour interpréter les demandes qui dépendent du mouvement ou du son |
| Ajouter une analyse explicite et bornée, puis choisir l'opération adaptée | Preuves horodatées pour itération ou montage, coût annoncé, reprise indépendante du chat | Nécessite un worker et un contrat de crédits ; un plan de montage exige sa propre validation | **Approche recommandée** |
| Agent autonome qui regarde, monte, rend et recommence | Peut aller vers une boucle créative complète | Coût, latence et récupération plus difficiles ; dépend aussi de l'export réellement activé | Hors périmètre courant ; une éventuelle boucle future exigerait un objectif explicite et un budget borné, jamais une inspection automatique à la livraison |

## Répartition des capacités

| Demande | Luna | Sol 6.1 |
| --- | --- | --- |
| Comprendre un brief, écrire un prompt, conseiller à partir du texte | Oui | Oui |
| Voir et commenter les images jointes | Oui | Oui |
| Réexaminer une image générée pour préparer sa retouche | Oui, avec l'image explicitement jointe | Oui, avec l'image explicitement jointe |
| Préparer une génération image/vidéo/audio et son devis | Capacités actuelles conservées | Capacités actuelles conservées |
| Lire les métadonnées et la structure de timeline | Oui | Oui |
| Exécuter une coupe, un déplacement ou un gain précisément demandé | Oui | Oui |
| Ajouter une image/carton fourni ou une musique avec des bornes connues | Oui, selon les capacités d'édition effectives | Oui, selon les mêmes capacités |
| Proposer des hooks depuis un brief ou assembler des ouvertures déjà choisies | Oui | Oui |
| Choisir une accroche en observant les passages d'une vidéo | Proposer Sol si l'analyse est nécessaire | Oui, avec l'analyse visuelle qualifiée |
| Examiner le contenu d'un clip vidéo | Proposer Sol | Oui, quand le profil d'analyse est qualifié et activé |
| Interpréter un changement demandé sur une vidéo à partir de son contenu | Proposer Sol si l'analyse est nécessaire | Oui ; peut aboutir à retouche, régénération ou montage |
| Analyser les dialogues ou le contenu sonore | Proposer Sol | Oui, avec un adaptateur audio séparé qualifié |
| Concevoir un clip selon le contenu et la structure d'une musique fournie | Proposer Sol pour l'analyse requise | Oui, selon le profil audio et les capacités de montage qualifiés |
| Produire un nouveau plan de montage fondé sur ces analyses | Proposer Sol | Oui, preuves et limites visibles, puis validation du client |
| Appliquer un plan déjà validé | Possible en reprise sans nouvelle analyse | Oui |

Un passage sur Luna ne rend pas les résultats déjà payés illisibles au client.
La restriction porte sur les nouvelles analyses et les nouveaux plans avancés,
pas sur l'accès à ses résultats, le téléchargement ou la reprise d'un plan validé.

## Passage de Luna à Sol dans la conversation

Exemples : « Dans cette vidéo, Alex tourne trop tôt : corrige ce mouvement »
ou « Coupe quand Alex se retourne, puis enchaîne avec Ben », « Choisis le passage
le plus accrocheur » ou « Construis les plans autour de la montée de cette musique ».

1. Sous Luna, le modèle peut appeler un outil non dépensier de recommandation de
   capacité. Il renvoie une demande structurée avec références sélectionnées et
   objectif. Le serveur valide les identités et renvoie une carte dédiée.
2. La carte explique le bénéfice concret : « Pour comprendre le mouvement à
   corriger dans cette vidéo, Studio doit analyser le clip avec Sol 6.1 ». Elle conserve le
   brouillon, les références et l'objectif, et propose de préparer l'analyse.
3. La préparation serveur, sans appel génératif, propose le périmètre et le
   plafond **X crédits maximum** calculé à partir d'une politique versionnée.
   Le client voit quelle partie relève de ses crédits inclus ou achetés.
4. « Analyser avec Sol 6.1 — X crédits maximum » confirme ensemble l'utilisation
   de Sol pour cette opération et ce plafond. Cela n'achète pas de pack et ne
   réactive pas des crédits achetés suspendus ; ces choix gardent leur contrôle explicite.
5. L'analyse produit des observations consultables. Une nouvelle continuation
   Sol utilise ce résultat pour répondre à la demande restante : conseil, prompt,
   préparation de retouche/génération ou plan de montage si nécessaire.
   Le client peut rester sur Sol ou revenir à Luna.

Pas de bascule silencieuse, de relance automatique du message original ni de
demande d'achat pour une tâche que Luna peut déjà effectuer. Le signal pertinent
est la capacité requise, pas la seule présence du mot « vidéo ».
« Génère une vidéo à partir de cette image » reste accessible à Luna.

Le modèle peut reconnaître la demande sémantique ; le serveur impose les droits
sur les outils nouveaux. Un détecteur par mots-clés seul ne fait pas autorité.
Le masquage des outils sur Luna est doublé d'un contrôle à leur exécution,
fondé sur le modèle et le financement figés du nouveau run, pas sur une préférence
client modifiable. Les anciennes opérations simples ne peuvent pas être classées
« avancées » uniquement parce qu'une suite de coupes est longue.

Un message Luna ayant déjà exécuté des actions ne doit pas être réémis sous Sol.
On clôt sa partie connue selon la récupération actuelle, puis on crée un nouveau
run explicite lié à l'objectif restant. Une consommation inconnue demeure bloquée
jusqu'à sa résolution ; sélectionner Sol ne contourne pas ce verrou.

## Analyse vidéo : observer un clip, puis approfondir une zone

L'analyse est un travail asynchrone distinct du message de chat.
Le serveur résout une référence typée appartenant au compte et mesure la source.
Le worker extrait des images horodatées depuis l'original ou sa portion sélectionnée,
et transmet ces images à Sol avec la question du client.

Un premier passage combine échantillonnage régulier et candidats de changements
de plans. Il décrit la couverture effectivement inspectée. Si l'événement est
entre deux observations, le résultat indique un intervalle d'incertitude ; un
raffinement sur cet intervalle exige un nouveau plafond approuvé.
Douze images d'une minute ne prouvent pas une inspection de toutes les frames.

Chaque observation distingue : faits mesurés, observation du modèle, recommandation
artistique et incertitude. Le résultat conserve les temps source, les indices des
images, le profil et l'identité de la source. Les noms des personnages ne sont
attribués que depuis les indications du client, pas déduits de leur apparence.

Proposition de bornes pour le premier pilote : un clip ou une portion de 60 secondes,
au plus 12 images, au plus 100 MiB de source téléchargée, un décodage de 60 secondes
maximum. Un dépassement propose une portion plus courte au lieu de tronquer en silence.
Ces bornes sont des hypothèses de lancement à qualifier, pas des performances promises.
Le niveau de détail image est inscrit dans le profil et son devis ; une analyse
de texte fin peut nécessiter un profil plus coûteux, annoncé avant son exécution.

Les keyframes actuelles début/milieu/fin peuvent aider à la sélection initiale.
`ensureJobKeyframes` produit cependant des copies avec un contrat de publication
différent ; il ne doit pas servir de stockage public aux nouvelles analyses privées.

## Itérer sur un résultat généré

Le client peut sélectionner un média de ce projet ou de sa bibliothèque et demander
une modification. Le journal conserve le résultat exact sélectionné, sa source,
son identité de génération et le changement souhaité. Un résultat de génération
n'est pas considéré comme visuellement inspecté uniquement parce que son prompt
est présent dans l'historique. La référence doit être résolue et, si nécessaire,
analysée sous la même propriété de compte que les médias importés.

Pour une image, les capacités actuelles de vision/retouche sont conservées sur
les deux assistants. Pour une vidéo, Sol examine la portion qui permet de comprendre
la demande, avec son plafond confirmé. L'objectif est de relier les observations
au changement demandé et de préserver ce que le client veut conserver.

La proposition distingue les actions possibles : modifier le prompt pour refaire
une génération, utiliser un mode de retouche vidéo compatible, prolonger le clip,
ou modifier son placement/sa durée dans la timeline. Leur disponibilité est vérifiée
dans le catalogue et les contrats canoniques, sans inventer une conservation exacte
des visages, mouvements ou éléments qu'un modèle génératif ne garantit pas.

Exemple : « Le personnage ne regarde pas la caméra ; garde la scène et corrige
son regard ». Cette demande appelle une interprétation du résultat puis une
préparation compatible, pas un assemblage de clips. « Supprime les deux premières
secondes » peut appeler directement une coupe précisément demandée. « Garde le
moment où il regarde la caméra » nécessite de repérer ce moment si aucun timecode
fiable n'a été donné. Le besoin d'analyse et le besoin de montage sont deux décisions.

Les nouvelles générations/retouches gardent leur devis et confirmation actuels.
Le résultat précédent reste accessible. On peut comparer avant/après sur les
critères du client lorsqu'il le demande ; aucune analyse automatique de tous les
résultats ni boucle de régénération payante implicite.

## Montage simple : accroches, images et fin de film

Le montage répond aussi à des demandes de déclinaison et d'habillage, même pour
un film de quelques secondes. Une opération suffisamment définie utilise les
commandes simples disponibles sur Luna et Sol. Elle ne devient pas avancée du
seul fait que plusieurs clips sont concernés ou que le client demande trois versions.

Assembler plusieurs plans pour faire un film plus long est un cas principal.
Studio utilise l'ordre demandé, les sources exactes, les durées mesurées et les
bornes approuvées. Des plans préparés pour un storyboard peuvent ainsi être
assemblés sans être tous analysés après génération. Le nombre de plans ou la
durée finale ne déclenchent pas une analyse. Si une décision dépend réellement
du contenu, par exemple choisir des raccords sur une action, seule la portion
nécessaire fait l'objet d'une proposition d'analyse distincte. La livraison du
film ne déclenche pas ensuite une critique automatique du montage.

Pour des hooks différents, Studio précise ce qui varie : plan d'ouverture,
durée, texte visible ou formulation de l'accroche. Il conserve le corps et la fin
que le client veut réutiliser. Une accroche textuelle ou une nouvelle direction
peut être proposée depuis le brief ; rechercher le moment visuellement le plus
efficace dans une vidéo appelle l'analyse Sol. Chaque proposition de variante
indique les médias réutilisés et ceux à créer. Les nouvelles générations gardent
leurs devis et confirmations ; le nombre de versions ne multiplie pas implicitement
les appels payants.

Les variantes validées doivent pouvoir être comparées et conservées séparément,
avec une identité propre et un lien au film de base. Un éventuel contrat de
duplication de séquence appartient au propriétaire canonique des montages connectés ;
les anciens endpoints privés retirés ne sont pas réactivés. La création d'une
variante ne doit pas écraser le montage original.

Pour une image ou un carton final fourni, le plan précise sa référence exacte,
son emplacement, sa durée, le cadrage et le comportement de la musique à la fin.
Un logo fourni est réutilisé depuis son fichier, sans régénération qui en changerait
les formes ou les lettres. Un carton à composer peut nécessiter un fond, ce logo
et un texte exact. Une telle composition doit avoir un contrat déterministe qualifié
pour l'aperçu et le rendu ; elle ne doit pas être présentée comme déjà réalisable
par la seule commande d'insertion. Une surimpression sur la vidéo nécessite de
même une capacité explicite de composition. Une image plein cadre déjà prête
peut utiliser le chemin d'insertion actuel.

## Analyse audio : outil spécialisé, restitution par Sol

Sol orchestre l'analyse et exploite ses résultats. Il ne reçoit pas des octets
audio dans une requête Responses incompatible.
La documentation décrit une entrée audio dans Chat Completions via un modèle audio :
[guide officiel](https://developers.openai.com/api/docs/guides/audio-chat-completions),
[GPT-Audio-1.5](https://developers.openai.com/api/docs/models/gpt-audio-1.5).
Ce dernier est un candidat d'adaptateur à qualifier, pas un choix de production activé.

Le profil initial audio examine des fenêtres courtes dont les bornes source sont
mesurées. Il peut restituer dialogue transcrit, parole/musique/ambiance et descriptions
sonores, avec provenance et couverture. Les silences et niveaux sont des mesures
du signal ; les descriptions et transcriptions restent des sorties du modèle.
Le dialogue transcrit seul ne permet pas de conclure sur la qualité de la musique.

Les positions d'événements déduites dans une fenêtre sont approximatives jusqu'à
validation. La synchronisation à la frame, l'identification des personnes par leur
voix et les coupes sur chaque beat ne font pas partie de la promesse initiale.
Le profil audio ne s'active qu'après qualification de la couverture, du coût,
des compteurs fournisseur et de la précision temporelle. L'interface reflète le
profil réellement disponible, sans proposer « audio » si seul le visuel fonctionne.

## Musique fournie : piste audio et clip musical

Un fichier audio sélectionné ou importé devient une référence détenue par le
compte, avec sa durée et ses propriétés mesurées. « Mets cette musique dans la
timeline » réutilise cet enregistrement. Cette demande ne prépare ni une nouvelle
musique ni une continuation générative du morceau. Studio distingue la pose
d'une bande sonore, réalisable avec des bornes connues, de l'écoute nécessaire
pour proposer un montage musical.

Le placement simple définit début dans la séquence, portion source, durée et gain.
Il préserve les visuels et les autres pistes. Remplacer le son d'origine, le baisser
ou couper un morceau trop long constitue une décision explicite du brief ou du plan.
Une boucle, un fondu ou un mixage dynamique ne sont proposés comme exécutables
qu'après qualification de leur contrat partagé entre édition, aperçu et rendu.

Pour « crée un clip sur cette musique », le morceau guide la durée et la direction
artistique. Studio conserve son identité et ses bornes comme base temporelle et
fait apparaître le film à construire autour. Il propose une durée cohérente avec
la demande : morceau entier ou extrait convenu. Les durées d'insertion par défaut
qui bornent une musique à un film déjà présent ne doivent pas tronquer silencieusement
une musique censée définir la durée du nouveau clip.

Sol peut analyser les passages nécessaires pour décrire ambiance, énergie,
paroles et changements de structure, puis proposer les intentions de plans et leurs
durées. Le découpage indique quelles positions viennent de mesures du signal,
quelles transitions sont suggérées par le modèle et lesquelles restent approximatives.
Le résultat peut d'abord suivre de grandes sections musicales. Des coupes précisément
sur les beats nécessitent un profil supplémentaire de détection temporelle qualifié,
une conversion correcte vers les frames de séquence et un contrôle du rendu.
Une description générale du morceau ne constitue pas une preuve de synchronisation.

Le client peut fournir ses clips/images ou demander de créer les visuels manquants.
Studio privilégie la réutilisation des sources choisies et prépare les générations
nécessaires selon le catalogue réel, éventuellement à plusieurs plans. Le storyboard,
le budget des générations et le plan de montage restent examinables avant lancement.
Le montage préserve les portions de musique approuvées ; il ne remplace pas le
morceau par une musique générée au motif de simplifier la création.

Un morceau long est analysé par portions avec couverture et plafond annoncés.
Le pilote audio borné ne doit pas prétendre avoir écouté l'ensemble d'un titre
sur la base d'un seul extrait. Les analyses déjà acquises sont réutilisables ;
les étapes supplémentaires restent explicites. Le téléchargement d'un MP4 musical
assemblé dépend du chemin d'export réellement activé et de son devis confirmé.

## Plan de montage fondé sur des preuves

Quand les choix d'un assemblage, d'une variante ou d'un clip musical dépendent
du contenu observé, Sol peut comparer les analyses des sources sélectionnées et
proposer une liste de modifications. Les opérations simples suffisamment définies
gardent leur chemin direct. Une analyse destinée à une retouche ne lance pas ce plan par défaut.
Le client voit, pour chaque coupe, sa position, son motif,
les observations utilisées et la portion du clip qu'il peut prévisualiser.

Le plan porte la révision de séquence, les identités des clips, les empreintes
source, les analyses utilisées et la version des règles de conversion temporelle.
Les temps source sont convertis avec `sourceInFrame`, la position du clip et le fps
de séquence, en réutilisant les helpers de timeline. Il faut distinguer le temps
dans le fichier et le temps dans le film ; ne pas convertir directement un timecode
du fichier en position de timeline. Le fps variable conserve ses temps de présentation.

« Appliquer ce montage » est une confirmation distincte de l'analyse.
La mise à jour utilise le propriétaire canonique d'édition, dans une transaction
atomique pour le plan, avec les protections existantes sur audio lié, sources et
pistes verrouillées. Une édition manuelle concurrente invalide le plan sans être écrasée.
Une répétition de la confirmation retourne le résultat enregistré sans refaire les edits.

L'analyse ne déclenche ni génération de nouveaux médias ni export.
Les devis et confirmations de ces opérations conservent leur propriétaire actuel.
Un futur contrôle du film monté devra analyser un rendu de prévisualisation réellement
calculé ; analyser séparément ses sources ne prouve pas le résultat de leurs transitions.
Ce contrôle est uniquement demandé par le client ou nécessaire à un objectif
explicite encore en cours, avec son plafond confirmé. Il ne devient pas une étape
automatique après chaque montage. Sa disponibilité dépend aussi du chemin de rendu
effectivement activé.

## Contrats et propriétaires proposés

| Propriétaire | Responsabilité |
| --- | --- |
| Contrat pur de capacités Studio | Matrice modèle/service, projections UI et outils ; aucune règle dispersée dans les composants |
| `frontend/src/server/studio/media-analysis/` | Préparation, droits, runs, résultats, orchestration, reprises et projections sûres |
| Worker d'analyse dédié | Téléchargement borné, extraction, analyse fournisseur, stockage privé des preuves ; hors du thread de requête de chat |
| Adaptateurs d'analyse visuelle/audio | Formats natifs, limites, versions et preuve d'usage propres au fournisseur |
| Propriétaire des crédits Studio | Allocation et règlement de tous les consommateurs de crédits, y compris analyses ; verrou de compte partagé |
| Route-local hooks/components | Carte de passage à Sol, plafond, état du run et inspection du plan ; `page.tsx` reste orchestrateur |
| Propriétaire canonique de timeline | Application atomique et révisionnée du plan confirmé |
| Contrats canoniques de composition et variantes | Images/cartons, éventuels overlays, copies de montage et audio ; cohérence édition/aperçu/rendu, capacités qualifiées avant exposition |

La surface modèle propose `analysis.prepare`, `analysis.read` et `montage.plan`
uniquement quand les capacités effectives de Sol et du déploiement les autorisent.
Toute préparation d'analyse est liée à une demande et à l'objectif restant,
avec son motif, les références utiles et son périmètre ; un simple événement
« génération terminée » ne constitue pas une autorisation d'analyse.
L'outil de confirmation financière reste réservé au client.
Les routes de préparation/confirmation/status sont authentifiées, bornées,
protégées contre CSRF et liées au compte/projet. Un GET ne crée ni grant, ni crédit,
ni schéma, ni run et ne déclenche aucun traitement.

Une analyse fige : compte/projet, référence, empreinte de source, intervalle,
objectif normalisé, profil/version, modèle, tarif, plafond, consentement et identité
idempotente. États distincts : préparé, confirmé, en attente, en cours, réussi,
partiel, échec connu, consommation inconnue. Un résultat partiel reste lisible et
ne peut pas être présenté comme une analyse complète.

Les preuves privées résident sous des clés propres au compte ; URL signées et
octets d'entrée ne sont pas stockés dans les résultats d'outils, journaux financiers
ou payloads de commandes. L'entrée multimodale du fournisseur est hydratée à partir
des preuves autorisées juste avant comptage/dispatch, et cette même entrée est
utilisée pour les deux. Il faut appliquer cette règle aussi à la sortie suivante
du directeur, pas seulement au worker.

Les cache keys comprennent propriétaire, source, intervalle, objectif et profil.
Réutiliser une analyse du même compte ne refacture pas l'analyse ; un nouveau
raisonnement Sol peut consommer ses propres crédits annoncés. Remplacer la source
invalide les preuves. Aucune analyse privée n'alimente un cache public intercomptes.
Les dérivés privés ont une rétention proposée de 30 jours, explicitée au client ;
une suppression de projet retire ses preuves mais conserve les pièces financières.

## Coûts, crédits et récupération

La facturation porte sur le service exécuté, pas seulement sur le nom Sol.
Une politique nouvelle, explicitement approuvée avant activation, doit couvrir :
extraction/stockage, appels visuels Sol, adaptateur audio et éventuelle synthèse.
Le plafond couvre la totalité du run. La synthèse finale est soit incluse dans ce
plafond avec un appel réservé, soit proposée ensuite avec son propre plafond affiché ;
la proposition retenue est de l'inclure. Pas de tarification numérique inventée
dans ce document : coûts et marge seront calculés sur des runs mesurés.

Les lots de crédits existants restent la seule source des soldes inclus/achetés.
Allocation gratuite en premier, achats en FIFO, pas de réactivation ni recharge
automatique. Les appels auxiliaires audio ne peuvent pas être réglés comme des
tokens Sol avec son tarif. L'interface annonce un service Sol avec un outil audio,
et le reçu interne conserve les fournisseurs et tarifs réels.

Les allocations actuelles référencent `studio_assistance_calls` : on ne peut pas
leur ajouter un faux appel Responses pour faire rentrer un job audio dans la table.
Une migration explicite doit ajouter une identité de consommation d'analyse et
son journal d'allocations relié aux mêmes lots. Le propriétaire de crédit commun
doit totaliser réservations, règlements, releases, exposition sponsorisée et
résolutions des deux consommateurs sous les mêmes verrous. Ne pas créer un deuxième
portefeuille. Les politiques et règlements historiques restent immuables.

Préparer un plafond ne réserve pas. Confirmer réserve avant toute opération
d'analyse coûteuse. Chaque dispatch fournisseur a une identité et une preuve
durables avant son départ. Les résultats connus sont sauvegardés avant règlement
et repris sans nouveau dispatch. Un timeout sans preuve d'usage est « inconnu »,
pas zéro ; sa réservation ne peut pas être libérée ni son appel relancé automatiquement.
Les frais d'un worker doivent aussi avoir une méthode de mesure/estimation versionnée.

Le changement de mois ne déplace pas une réservation vers le mois suivant.
Une restriction de compte est vérifiée à nouveau avant un nouveau dispatch ; elle
n'empêche pas de régler ou lire les résultats déjà acquis. Un stock de crédits
achetés ne contourne pas une campagne sponsorisée indisponible si la règle actuelle
de consommation gratuite prioritaire s'applique.

## Ordre de réalisation proposé

1. **Usages simples et variantes** : guider les insertions image/audio et accroches
   avec les commandes existantes ; qualifier séparément les copies de montage,
   cartons composés ou overlays manquants. Pas d'analyse imposée ni de génération implicite.
2. **Vidéo visuelle** : capacités communes, carte Luna → Sol, plafond confirmé,
   worker borné, images horodatées et résultat lisible, d'abord pour interpréter
   une demande d'itération sur un résultat. Aucun montage automatique.
3. **Son, dialogue et musique** : adaptateur séparé, profils et tarifs qualifiés,
   provenance temporelle ; clip guidé par les sections musicales puis qualification
   distincte d'une synchronisation précise. Lancement indépendant du profil visuel.
4. **Montage avancé** : comparaison de quelques clips analysés ou plan musical,
   prévisualisation, validation puis application atomique par le propriétaire d'édition existant.
5. **Vérification du rendu à la demande** : après qualification du rendu de preview,
   du coût et de la disponibilité effective du chemin d'export ; objectif explicite,
   plafond confirmé et aucune inspection systématique après livraison.

Chaque étape peut être livrée séparément derrière son activation explicite.
Une indisponibilité d'analyse ne retire pas le chat, la vision des images ou les
edits simples actuels. Les lectures de résultats enregistrés restent possibles.

## Qualification nécessaire avant livraison

- Tests de matrice modèle/service et refus serveur d'une analyse forcée depuis Luna.
  La sélection de Sol, les crédits et le consentement figés doivent être vérifiés.
- Tests de choix de workflow : image, vidéo courte, génération à plusieurs plans,
  demande supérieure à 30 secondes compatible/incompatible avec une génération
  unique, retouche d'un résultat et montage explicitement demandé. Vérifier que
  Sol ne force ni timeline, ni analyse, ni montage sur une demande de création simple.
- Génération livrée sans demande d'analyse : aucun run d'analyse, extraction
  d'inspection, appel de vision/audio ou appel supplémentaire pour une critique.
  Vérifier aussi le polling répété, l'événement de completion dupliqué et la reprise.
  Une demande explicite ultérieure prépare l'analyse du résultat exact et confirme
  son plafond ; aucune analyse rétroactive de tous les résultats du projet.
- Assemblage long de plusieurs plans dans un ordre et des bornes connus : montage
  direct, sans analyse de chaque plan ni du résultat final. L'analyse reste une
  étape distincte seulement lorsqu'une question de contenu la nécessite et que
  son coût a été confirmé. Les crédits ne financent aucune auto-évaluation finale.
- Cas de montage court : hook alternatif, trois variantes avec corps commun,
  image ou logo final et carton fourni. Vérifier réutilisation exacte, durée,
  cadrage, conservation de l'original et absence de génération/analyses implicites.
  Carton composé ou overlay non qualifié : capacité indisponible annoncée honnêtement.
- Musique fournie : insertion sur piste libre sans ripple ni suppression des voix,
  portion source et gain exacts, limite de pistes et conflit de révision. Clip musical
  sur séquence vide ou courte : durée issue du brief/morceau, aucune troncature par
  défaut et aucune génération de musique de substitution.
- Tests de suivi de résultat : référence réelle conservée, prompt historique
  distinct du contenu observé, analyse bornée au changement demandé, retouche ou
  régénération compatible proposée sans déclencher un plan de montage implicite.
- Fixtures vidéo avec événement annoté, coupure de scène, mouvement bref entre
  échantillons et source à fps variable : mesure de couverture et erreur temporelle.
- Fixtures audio avec phrase, silence, musique et bruit : distinguer transcription,
  mesure du signal, interprétation et incertitude. Ne pas certifier musique avec
  un test de transcription uniquement.
- Clip musical : fixtures avec sections/accents annotés, couverture de tout l'extrait
  retenu, positions source/frames et comparaison du rendu avec la musique d'origine.
  Distinguer transitions artistiques et beats mesurés ; pas de promesse de synchronisation
  précise avant qualification ni de lancement des visuels manquants sans devis confirmé.
- PostgreSQL jetable : double confirmation, concurrence chat/analyse, limite des
  lots, changement de mois, restriction, réponse perdue, usage inconnu, règlement
  et remboursement exactement une fois. Ne pas utiliser la base de production.
- Tests de projection : aucune URL privée, clé de stockage ou donnée audio dans
  les résultats sûrs ; fichier étranger/ref remplacée refusés avant appel payant.
- Contrats existants de récupération assistance, timeline, médias et générations
  conservés ; mise à jour des guides d'architecture et de crédits avec l'implémentation.
- Browser : passage à Sol, refus/reprise, retour Luna, accès aux résultats, choix
  des crédits, validation du plan, conflit avec edit manuel, clavier et mobile.
- Comparaison mesurée Luna/Sol sur mêmes briefs et médias, en distinguant la qualité
  de raisonnement et la présence des outils d'analyse. Aucune promesse universelle
  de meilleure créativité simplement parce que Sol est choisi.
- Pilote opt-in avec coûts fournisseur, crédits client, latence p50/p95 et qualité
  d'annotations ; seuils de lancement fixés sur ces mesures avant activation.

## Sources internes à préserver

- `docs/engineering/studio-editor-architecture.md`
- `docs/engineering/studio-assistance-economics.md`
- `docs/engineering/studio-conversation-audio.md`
- `docs/engineering/media-delivery.md`
- `docs/engineering/read-route-schema-bootstrap.md`
- `frontend/src/server/studio/conversation-reference-mentions.ts`
- `frontend/src/server/studio/conversation-director.ts`
- `frontend/src/server/studio/conversation-run-repository.ts`
- `frontend/src/server/studio/conversation-timeline.ts`
- `frontend/lib/studio/conversation-editing-contract.ts`
- `frontend/src/lib/studio/assistance-contract.ts`
- `tests/studio-media-conversation.test.ts`
- `tests/studio-assistance-director.test.ts`
- `tests/studio-conversation-editing-run-postgres.test.ts`
- `tests/maxvideoai-editor-timeline-audio-layering.test.ts`

Le présent travail est une conception enregistrée dans une branche séparée.
La prochaine décision est la revue de cette proposition ; le plan d'implémentation
et l'activation financière/production restent des étapes distinctes.
