# Studio : analyse des médias et montage avec Sol 6.1

Date : 6 octobre 2026. Branche : `codex/studio-media-analysis-design`.
Base inspectée : `ba6bc504e0b22a862a08f2b3e3ff667e86a5f574` (`origin/main`).
Statut : proposition de conception. Aucun changement de comportement, de tarif,
de crédit, de modèle ou de production n'est implémenté par ce document.

## Intention et décision acquise

Studio doit pouvoir conseiller un montage à partir du contenu réel des clips,
puis proposer des coupes et un ordre de plans que le client peut examiner.
Le niveau Sol doit apporter un service supplémentaire mesurable et compréhensible.
Le passage à Sol au moment d'un besoin pertinent contribue à son utilisation,
sans dégrader les usages de Luna qui fonctionnent déjà.

Le propriétaire a choisi dans cette conversation : **Luna conserve la vision
des images ; l'analyse vidéo/audio et le montage avancé sont réservés à Sol 6.1.**
Le découpage technique et le parcours proposés ci-dessous restent à examiner.

Le montage avancé désigne ici des décisions fondées sur le contenu observé :
repérer une action, sélectionner un passage, rapprocher deux plans, éviter une
coupe au milieu d'une phrase. Une opération précise demandée par le client,
comme déplacer un clip à une position donnée, reste une opération simple.

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
| Envoyer quelques posters au prochain tour Sol | Petit périmètre et coût limité | Trois posters début/milieu/fin ne permettent pas de repérer précisément une action ni d'analyser le son | Insuffisant comme promesse de montage avancé |
| Ajouter une analyse explicite et bornée, puis un plan de montage | Preuves horodatées, coût annoncé, reprise indépendante du chat | Nécessite un worker, un contrat de crédits et une validation du plan | **Approche recommandée** |
| Agent autonome qui regarde, monte, rend et recommence | Peut aller vers une boucle créative complète | Coût, latence et récupération plus difficiles ; dépend aussi de l'export réellement activé | Étape ultérieure, après qualification de l'analyse |

## Répartition des capacités

| Demande | Luna | Sol 6.1 |
| --- | --- | --- |
| Comprendre un brief, écrire un prompt, conseiller à partir du texte | Oui | Oui |
| Voir et commenter les images jointes | Oui | Oui |
| Préparer une génération image/vidéo/audio et son devis | Capacités actuelles conservées | Capacités actuelles conservées |
| Lire les métadonnées et la structure de timeline | Oui | Oui |
| Exécuter une coupe, un déplacement ou un gain précisément demandé | Oui | Oui |
| Examiner le contenu d'un clip vidéo | Proposer Sol | Oui, quand le profil d'analyse est qualifié et activé |
| Analyser les dialogues ou le contenu sonore | Proposer Sol | Oui, avec un adaptateur audio séparé qualifié |
| Produire un nouveau plan de montage fondé sur ces analyses | Proposer Sol | Oui, preuves et limites visibles, puis validation du client |
| Appliquer un plan déjà validé | Possible en reprise sans nouvelle analyse | Oui |

Un passage sur Luna ne rend pas les résultats déjà payés illisibles au client.
La restriction porte sur les nouvelles analyses et les nouveaux plans avancés,
pas sur l'accès à ses résultats, le téléchargement ou la reprise d'un plan validé.

## Passage de Luna à Sol dans la conversation

Exemple : « Coupe quand Alex se retourne, puis enchaîne avec Ben ».

1. Sous Luna, le modèle peut appeler un outil non dépensier de recommandation de
   capacité. Il renvoie une demande structurée avec références sélectionnées et
   objectif. Le serveur valide les identités et renvoie une carte dédiée.
2. La carte explique le bénéfice concret : « Pour repérer le retournement dans
   cette vidéo, Studio doit analyser le clip avec Sol 6.1 ». Elle conserve le
   brouillon, les références et l'objectif, et propose de préparer l'analyse.
3. La préparation serveur, sans appel génératif, propose le périmètre et le
   plafond **X crédits maximum** calculé à partir d'une politique versionnée.
   Le client voit quelle partie relève de ses crédits inclus ou achetés.
4. « Analyser avec Sol 6.1 — X crédits maximum » confirme ensemble l'utilisation
   de Sol pour cette opération et ce plafond. Cela n'achète pas de pack et ne
   réactive pas des crédits achetés suspendus ; ces choix gardent leur contrôle explicite.
5. L'analyse produit des observations consultables. Une nouvelle continuation
   Sol utilise ce résultat. Le client peut rester sur Sol ou revenir à Luna.

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

## Plan de montage fondé sur des preuves

Sol peut ensuite comparer les analyses des clips sélectionnés et proposer une
liste de modifications. Le client voit, pour chaque coupe, sa position, son motif,
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
La disponibilité de ce contrôle dépend aussi du chemin de rendu effectivement activé.

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

La surface modèle propose `analysis.prepare`, `analysis.read` et `montage.plan`
uniquement quand les capacités effectives de Sol et du déploiement les autorisent.
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

1. **Vidéo visuelle** : capacités communes, carte Luna → Sol, plafond confirmé,
   worker borné, images horodatées et résultat lisible. Aucun montage automatique.
2. **Son et dialogue** : adaptateur séparé, profils et tarifs qualifiés, provenance
   temporelle. Lancement indépendant du profil visuel.
3. **Montage avancé** : comparaison de quelques clips analysés, plan prévisualisable,
   validation puis application atomique par le propriétaire d'édition existant.
4. **Vérification du rendu** : uniquement après qualification du rendu de preview,
   du coût et de la disponibilité effective du chemin d'export ; boucle bornée.

Chaque étape peut être livrée séparément derrière son activation explicite.
Une indisponibilité d'analyse ne retire pas le chat, la vision des images ou les
edits simples actuels. Les lectures de résultats enregistrés restent possibles.

## Qualification nécessaire avant livraison

- Tests de matrice modèle/service et refus serveur d'une analyse forcée depuis Luna.
  La sélection de Sol, les crédits et le consentement figés doivent être vérifiés.
- Fixtures vidéo avec événement annoté, coupure de scène, mouvement bref entre
  échantillons et source à fps variable : mesure de couverture et erreur temporelle.
- Fixtures audio avec phrase, silence, musique et bruit : distinguer transcription,
  mesure du signal, interprétation et incertitude. Ne pas certifier musique avec
  un test de transcription uniquement.
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

Le présent travail est une conception enregistrée dans une branche séparée.
La prochaine décision est la revue de cette proposition ; le plan d'implémentation
et l'activation financière/production restent des étapes distinctes.
