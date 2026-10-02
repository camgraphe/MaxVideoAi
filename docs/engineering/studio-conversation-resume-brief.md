# Studio conversationnel — brief de reprise du 2 octobre 2026

## Situation actuelle

Le pilote natif sait passer d’un brief ordinaire en anglais à des médias réels, un montage canonique sauvegardé et un MP4 distant récupérable dans le chat. Le film actuel est une ébauche technique de 25 secondes : 5 secondes d’animation, puis 20 secondes d’image fixe ; voix anglaise sur environ 12,4 secondes, fin silencieuse. La qualité artistique d’une promo terminée reste à obtenir.

Changer le modèle de cette tâche Codex ne change pas le réalisateur dans le produit : **GPT-6.1 Sol, raisonnement medium, OpenAI Responses**. Il écrit direction, prompts et narration, lit les capacités disponibles et utilise des actions structurées. Le journal des actions, le brief et les décisions sont durables. Le modèle prépare les devis ; la confirmation financière reste humaine.

## Direction produit conservée

- Chat central immédiatement compréhensible, H1 Studio, visuels autour sur desktop avec place adaptée à leur nombre.
- Sur téléphone : conversation accessible, timeline simple et petit moniteur repliable au-dessus. La timeline pilote la lecture ; pas de panneau vide permanent.
- Contrôles manuels limités et utiles : positionner, trimmer, régler l’audio ; bibliothèques/références/import depuis le + du chat.
- Charbon en dark, Olive en light, via la préférence de l’app.
- Catalogue volontairement borné aux actions réellement exécutables. Complet/par étapes relève de la conversation.
- Studio et MCP réutilisent les propriétaires métier de génération, prix, wallet, médias, montage et export. Session Studio et OAuth MCP gardent leurs autorités propres ; un tronc commun ne constitue pas une publication MCP.

## Ce qui a été qualifié

| Domaine | Preuve |
| --- | --- |
| Image | Un original réel Flare, visible après reload, une charge |
| Animation | Un Wan 3 réel de 5 s, 480p sans son ; une première tentative échouée remboursée, deuxième tentative approuvée réussie |
| Voix | Un MP3 anglais Seed, narration écrite par Sol, lecture et insertion avec durée mesurée |
| Montage | Insertion, trim, déplacement, gain, conflit de révision et reprise ; vidéo/audio ensemble, moniteur repliable |
| Export | Un seul rendu AWS réel : 25 s, 720p, 16:9, 30 fps, H.264/AAC ; récupéré pendant le rendu et après réouverture, lecteur arrivé à la fin |
| Réutilisation | Public ID et provenance corrigés ; l’asset exporté est résoluble avec ses faits mesurés. Pas d’insertion inutile de l’export dans le montage courant |

Le worker pilote **:4** est construit depuis `98345933c`, digest épinglé, contrôles de démarrage hors réseau/Node/FFmpeg/Chromium passés, accès temporaires de build révoqués. Le localhost l’utilise. Le rendu déjà qualifié provenait de **:3** ; aucun deuxième rendu :4 n’a été lancé.

Le socle de tests compte une passe antérieure de **679 tests**, puis **22 contrôles ciblés** pour le dernier correctif, avec TypeScript/lint/exposition. Chromium, Firefox et WebKit ont passé le parcours intégré sur les commits documentés. Mobile = viewports simulés ; les appareils physiques restent à qualifier. Ne pas présenter ces passes comme un nouveau test complet de chaque commit.

## Reprendre dans cet ordre

1. **Débloquer la musique.** Le pilote n’a pas de clé Google renouvelée. L’onglet Google attend la reconnexion interactive de l’utilisateur. La clé précédemment signalée n’est pas réutilisée. Renouveler/coordonner ses consommateurs, installer la remplaçante dans le runtime privé, vérifier l’accès ; puis préparer un devis musical exact, sans confirmation automatique.
2. **Finir le film de 25 s.** Reprendre le projet existant avec quelques phrases client ordinaires en anglais. Laisser Sol choisir une amélioration artistique et le rythme. Ajouter/mixer une vraie musique, vérifier les plages et volumes, puis exporter avec le worker :4 après le devis applicable. Toute nouvelle génération reçoit une approbation spécifique ; les anciennes approbations sont consommées.
3. **Améliorer le réalisateur à partir du résultat.** Intégrer quelques recettes de réalisation, une fiche de continuité/références, le choix entre vidéo native et montage, et des corrections localisées. Le pilote vidéo automatique est encore limité à Wan 3 / 5 s / 480p / silencieux ; élargir seulement les usages qualifiés.
4. **Ajouter une amélioration visuelle ciblée.** L’audit Astra recommande d’abord de comparer deux montages des mêmes médias, puis des directions visuelles ; retouche d’un passage, univers réutilisables et déclinaisons de campagne viennent ensuite. Ces propositions/maquettes ne sont pas implémentées.
5. **Préparer la bascule.** Réconcilier la branche Pricing via ses propriétaires canoniques (tâche distincte encore en validation au moment de ce brief), fixer prix/plafonds des conversations, qualifier les cas client ciblés et appareils réels, puis préparer preview/migrations/retour arrière. Aucun remplacement de Studio en production ni publication MCP n’a été effectué.

Ne pas relancer une salve générale à chaque changement. Tests ciblés sur la prochaine capacité et revue globale avant la bascule. Ne pas ouvrir en parallèle interviews/podcasts sémantiques, effets avancés ou tout le catalogue pour repousser le jalon du petit film accepté.

## Coûts observés

Pilote natif : **40 Responses, 110 685 tokens, 0,1619952 USD d’API estimés** ; **0,40 USD nets** de médias dans le ledger isolé ; export **0 USD wallet** (un export gratuit consommé). Le coût CPU/RAM du rendu est estimé séparément à environ 0,006 USD. Stockage, logs, réseau, base, builds, travail Codex et factures restent distincts. Carte/funding API et factures fournisseur non vérifiés. Les valeurs du wallet pilote ne sont pas le solde de production.

## Où reprendre

- Worktree : `/Users/adrienmillot/.codex/worktrees/studio-conversation-exploration/MaxVideoAi V2`
- Branche : `codex/studio-conversation-exploration-20261001`
- Code frontend/worker : `98345933c` ; dernière documentation avant ce brief : `12a2c8835`.
- Projet : `http://localhost:3000/app/studio/conversation/project_4a87acc7-9f5f-498c-97d9-875034c8ad21`
- Timeline : révision 7 ; compte/DB/storage pilote isolés. Serveur localhost vérifié actif au moment du brief.
- IMPORTANT : ce dépôt partage une configuration Git `core.worktree`. Exécuter les commandes Git dans ce worktree avec `env GIT_WORK_TREE="$PWD"`. Ne pas modifier la configuration partagée ni le checkout Desktop/les changements Pricing.
- Références : [readiness](studio-conversation-pilot-readiness.md), [environnement et preuves](studio-conversation-pilot-environment.md), [intégration et propriétaires](studio-conversation-integration.md), [plan](../superpowers/plans/2026-10-02-studio-conversation-delivery.md).
- Audit Astra hors Git : `/Users/adrienmillot/.codex/visualizations/2026/10/02/studio-mcp-audit-astra/rapport.md`, `recettes-proposees.md` ; exploration produit : `/Users/adrienmillot/.codex/visualizations/2026/10/02/maxvideoai-product-concepts/proposition-produit.md`.
- Preuves natives hors Git : `/Users/adrienmillot/.codex/visualizations/2026/10/02/studio-native-pilot/qualification-20261002-final.json` et MP4 `native-roughcut-25s-rendered.mp4`.
- Scripts/credentials opérationnels sont privés et ignorés dans Git. Ne jamais afficher des fichiers env, secrets, clés JSON, URL signées ou journaux bruts.
