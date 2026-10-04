# Studio — exploration visuelle

Exploration du 1er octobre 2026 sur `codex/studio-conversation-exploration-20261001`, dans un worktree isolé. Aucun changement des routes ou du Studio de production.

## Question étudiée

Peut-on créer et corriger un film avec une conversation centrale, des médias qui apparaissent autour, et une bande de montage immédiatement reconnaissable ?

Cette direction reste une hypothèse de produit. Les images et l'étude interactive servent à la discussion ; elles ne constituent pas un design approuvé ni un Studio fonctionnel. Aucun serveur, chatbot autonome, génération métier ou rendu MP4 n'est implémenté dans ce dossier.

## Retours intégrés

- Intégrer le cadre de l'app : header, navigation compacte nommée, charbon et accents or.
- Garder un H1 Studio discret et des codes de chat évidents.
- Composer les médias avec davantage de finesse ; éviter les grandes photos inclinées, les titres de panneaux et un plan de réalisation chargé.
- Montrer ce que devient l'écran quand la conversation continue.
- Retirer tout sélecteur « complet / par étapes ». L'assistant propose le niveau de délégation dans la conversation quand cela devient utile.
- Garder des actions et modèles éprouvés derrière une interface légère.

## Maquettes proposées

- [Premiers échanges](design/studio-premiers-echanges.png) : premier brief et direction visuelle.
- [Conversation qui continue](design/studio-conversation-continue.png) : plusieurs échanges, aperçu vidéo, correction du deuxième plan, montage rempli.
- [Règles d'interaction](design/interaction-notes.md).
- [Prompts détaillés](design/prompts.md).
- [Étude interactive de recomposition et de montage](design/studio-recomposition.html), fragment affiché dans la conversation Codex.
- [Faisabilité du bot persistant](design/feasibility.md), observations sur le code courant et les capacités des API.

Images générées avec l'outil intégré Image Gen. La version du modèle sous-jacent n'est pas sélectionnable par cet outil ; ne pas attribuer ces images à GPT Image 2.5.

Référence du cadre : `frontend/public/assets/marketing/redesign/app-desktop.jpg`, conforme au guide visuel courant. Les vues de production /app et /app/library ont également été consultées le 1er octobre. Seule la capture publique versionnée a été utilisée pour la génération ; les médias privés visibles dans l'app n'ont pas été envoyés.

Les photographies du parfum et les messages sont des exemples inventés pour la maquette. Ils ne prouvent aucune génération vidéo, opération de montage métier ou facture réelle. L'étude interactive réutilise trois photographies cohérentes générées pour cette exploration, dans `assets/motion/` ; les scénarios de huit ou douze créations ne représentent pas autant d'images distinctes.

## Étude interactive

Sur desktop, quatre médias au maximum entourent un chat dont le champ reste à la même place. Un nouveau média devient principal, les précédents se réduisent et la réserve reste consultable. Épingler un aperçu évite qu'une arrivée le remplace. Sur mobile, les images apparaissent dans leur réponse et s'agrandissent au toucher ; toutes les créations restent accessibles depuis le titre.

Le montage est limité au placement et à la coupe. Les plans ont des largeurs proportionnelles à leur durée. Le déplacement fonctionne par la poignée, le clavier ou les flèches ; les bords permettent de couper sur desktop. Un aperçu et les curseurs début/fin permettent une coupe sur mobile. La timeline défile horizontalement et possède un zoom ; « Annuler » restaure les modifications successives.

La lecture est une animatique de photographies avec une tête de lecture, pas une vidéo rendue. Les plans à créer restent indiqués comme tels. Les messages sont scénarisés : le champ ne contient aucun véritable modèle conversationnel. Les gestes de coupe manipulent uniquement l'état local de la démonstration, avec une précision illustrative de 0,1 s, sans le contrat réel de frames du Studio.

Vérifications navigateur : arrivée et réduction des médias, aperçu épinglé, réserve, vingt-deux messages, relecture sans saut au nouveau message, déplacement par poignée et flèches, coupe desktop et mobile, proportions 15/4/13/10/10 et durée 52 s, annulations successives, lecture jusqu'à sa fin. Vérifications responsive à 320, 390 et 1056 px ; aucun changement des routes de l'app.

## Historique

- `design/concept.png` : première proposition rejetée, trop conventionnelle et trop chargée.
- `design/constellation-precedente.png` : essai plus artistique, avant intégration de la sidebar et retrait des modes.
- `assets/watch-*` : médias publics copiés pour une éventuelle démonstration ; non utilisés par les nouvelles maquettes.

## Limites et prochaine décision

Les maquettes raster précédentes restent des études spatiales. L'étude interactive permet maintenant de discuter les gestes et la continuité du chat, mais ne valide pas la manipulation de vrais médias, les interruptions réseau, les coûts, l'export ou la persistance serveur.

Le prochain choix porte sur la qualité de cette interaction limitée au placement et à la coupe, avant de brancher une boucle réelle et persistante sur les services métier. Aucun élargissement aux effets, aux pistes multiples ou aux réglages de modèles n'est proposé dans cette étude.
