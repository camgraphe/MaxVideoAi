# Studio — faisabilité d'un bot persistant

Observations du 1er octobre 2026 sur le code courant du checkout principal, consulté en lecture seule. Ce document est une étude, pas une architecture approuvée ni une implémentation.

## Conclusion

La proposition est réalisable avec un périmètre limité : discuter un brief, créer une image, l'animer, assembler des clips, les déplacer ou les couper, puis exporter. La difficulté est la fiabilité de cette chaîne et sa reprise, davantage que la possibilité de connecter un modèle aux outils.

Un bot « persistant » n'a pas besoin de laisser un modèle actif en permanence. L'app conserve la conversation et le projet, poursuit les tâches longues côté serveur et rappelle le modèle avec le contexte utile quand une demande ou un résultat arrive.

## Briques déjà présentes

- `frontend/src/server/studio/chat.ts` appelle OpenAI ou Gemini avec des messages texte. Il n'exécute pas encore de tool calling ni de boucle de tâches persistantes.
- `frontend/app/api/studio/_lib/studio-chat-handler.ts` refuse actuellement le chat live avec `STUDIO_CHAT_LIVE_UNAVAILABLE`. Le commentaire explicite l'absence d'un contrat canonique de devis/réservation ; un devis fourni par le client ne suffit pas à autoriser un appel payant.
- Les outils MCP de génération et de suivi de jobs exposent déjà une partie des services nécessaires.
- `frontend/src/server/mcp/tools/prepare-montage.ts` prépare un plan d'édition à partir de 2 à 12 vidéos appartenant à l'utilisateur, disponibles et ordonnées. Ce plan n'est pas un rendu ni un projet sauvegardé.
- `frontend/src/server/mcp/tools/create-studio-montage.ts` et `frontend/src/server/studio/montage-command.ts` disposent d'une commande de création de projet avec validation, transaction et idempotence. `frontend/src/server/studio/feature-access.ts` garde cette création désactivée en production ; le code ne prouve donc pas une disponibilité live.
- `frontend/src/server/studio/repository.ts` conserve les projets, leurs révisions et les séquences/timelines. Les frontières entre projet, assets et exports sont décrites dans `docs/engineering/studio-editor-architecture.md`.

Il faut réutiliser ces services et leurs contrats. Le MCP peut continuer à les exposer aux assistants externes ; un chat embarqué peut appeler les mêmes services par des outils internes. Le MCP ne fournit pas, à lui seul, la mémoire du projet.

## Travail restant

1. Conserver un historique durable de conversation, associé au projet et à l'utilisateur.
2. Garder comme vérité métier le brief, les décisions validées, les identifiants des médias, les coupes et l'ordre des plans dans la base du projet. Le contexte du modèle est une projection de cet état.
3. Définir un petit nombre de commandes typées et validées côté serveur : génération, animation, assemblage, déplacement, coupe et export. Le modèle propose ; le backend contrôle ownership, disponibilité, coût et révision.
4. Reprendre les jobs après fermeture, interruption ou échec, sans doubler une commande ni une dépense. Montrer les états en cours/échec/prêt à partir des événements réels.
5. Préserver le devis et l'approbation des actions payantes, ainsi que l'annulation et les conflits entre une modification directe de la timeline et une action de l'assistant.

Une première boucle réelle doit prouver « créer → monter → corriger → fermer → reprendre » avant de multiplier les modèles et les possibilités de montage.

## Capacités API vérifiées dans les sources officielles

- [Conversation state, OpenAI](https://developers.openai.com/api/docs/guides/conversation-state) : conversation durable réutilisable entre sessions et tâches. Cela ne remplace pas la base du projet.
- [Function calling, OpenAI](https://developers.openai.com/api/docs/guides/function-calling) : le modèle demande un outil, l'application l'exécute et renvoie le résultat.
- [MCP servers, OpenAI](https://developers.openai.com/api/docs/guides/tools-connectors-mcp) : connexion des outils d'un serveur MCP distant à la Responses API.

Ces capacités établissent la faisabilité technique. Elles ne garantissent pas encore la qualité du produit, une autonomie illimitée, ni une durée ou un budget d'implémentation.
