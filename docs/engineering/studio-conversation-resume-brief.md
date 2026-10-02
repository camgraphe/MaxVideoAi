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

1. **Qualifier la musique réelle.** La nouvelle clé créée par l’utilisateur dans Chrome a été téléchargée, validée puis installée dans le runtime privé du pilote. Google accepte son authentification OAuth et la lecture du catalogue Lyria retourne 200 ; aucune génération musicale n’a encore été exécutée. Le serveur localhost a redémarré avec la nouvelle clé et le projet existant est intact. Une demande client ordinaire en anglais a conduit Sol à choisir un piano doux et des textures ambiantes, sans voix, et à préparer un devis exact de **0,05 USD / 30 s / Lyria 3 Clip**. Approbation humaine demandée pour une seule tentative et exactement 5 cents de crédit synthétique pilote ; ne pas confirmer avant sa réponse. Garder la rotation des consommateurs production/preview séparée du lancement musical ; l’ancienne clé n’est pas retirée avant leur vérification.
2. **Finir le film de 25 s.** Reprendre le projet existant avec quelques phrases client ordinaires en anglais. Laisser Sol choisir une amélioration artistique et le rythme. Ajouter/mixer une vraie musique, vérifier les plages et volumes, puis exporter avec le worker :4 après le devis applicable. Toute nouvelle génération reçoit une approbation spécifique ; les anciennes approbations sont consommées.
3. **Améliorer le réalisateur à partir du résultat.** Intégrer quelques recettes de réalisation, une fiche de continuité/références, le choix entre vidéo native et montage, et des corrections localisées. Le pilote vidéo automatique est encore limité à Wan 3 / 5 s / 480p / silencieux ; élargir seulement les usages qualifiés.
4. **Ajouter une amélioration visuelle ciblée.** L’audit Astra recommande d’abord de comparer deux montages des mêmes médias, puis des directions visuelles ; retouche d’un passage, univers réutilisables et déclinaisons de campagne viennent ensuite. Ces propositions/maquettes ne sont pas implémentées.
5. **Préparer la bascule.** Réconcilier la branche Pricing via ses propriétaires canoniques (tâche distincte encore en validation au moment de ce brief), fixer prix/plafonds des conversations, qualifier les cas client ciblés et appareils réels, puis préparer preview/migrations/retour arrière. Aucun remplacement de Studio en production ni publication MCP n’a été effectué.

Ne pas relancer une salve générale à chaque changement. Tests ciblés sur la prochaine capacité et revue globale avant la bascule. Ne pas ouvrir en parallèle interviews/podcasts sémantiques, effets avancés ou tout le catalogue pour repousser le jalon du petit film accepté.

## Contrôle Google après reconnexion

Contrôles du 2 octobre vers 19:30–19:55 UTC, sans génération ni modification du déploiement :

- Le déploiement de production Vercel est `READY`, sur `d10ad458743aef68e6e9be12cad9c611f06077b8`. Les crons Google Veo/Omni figurent dans les réponses 200 des journaux récents. Un cron sans job actif ne vérifie pas l’accès au fournisseur.
- La base configurée dans les fichiers locaux de l’application principale, distincte du pilote, contient un Omni direct terminé à 18:50 UTC et un Veo Fast direct terminé à 15:38 UTC ce jour. Aucun échec Google avec message d’authentification identifié dans les sept derniers jours. L’URL de base du déploiement n’a pas pu être relue : ces résultats restent des preuves de la base principale, pas une qualification complète de toutes les routes de production.
- Les clusters d’erreurs Vercel des dernières 24 heures portent sur Fal/Kling : refus de contenu, ratio et timeout. Les requêtes de journaux détaillés ont expiré ; ne pas en déduire une absence exhaustive d’erreurs.
- La console Google confirme que le compte de service est activé et que l’ancienne clé signalée est active. La nouvelle clé créée par l’utilisateur est également active ; son téléchargement reste à récupérer. Vercel masque la valeur de la clé et des flags avec `[SENSITIVE]`, donc leur empreinte exacte et leur valeur effective n’ont pas été qualifiées. Une valeur masquée n’est pas une clé invalide ou absente.
- Veo, images Google et Lyria partagent la configuration Google ; Omni accepte un override puis retombe sur cette configuration. Le remplacement doit couvrir chaque environnement consommateur avant de retirer l’ancienne clé. Garder la bascule Pricing coordonnée avec la mise à jour des credentials, sans publier cette branche Studio pour renouveler une clé.

Conclusion bornée : aucun indice de panne causée par la session de console expirée ; le renouvellement après l’incident demeure nécessaire. Le validateur privé refuse l’ancienne empreinte, un autre compte/projet, un endpoint OAuth inattendu et une clé de signature invalide. Huit cas synthétiques hors réseau sont passés. Aucun appel Google avec l’ancienne clé, aucune dépense média et aucune révocation ont été effectués pendant ce contrôle.

Mise à jour vers 20:17 UTC : le JSON créé dans Chrome correspond exactement à la clé active du bon compte/projet, fichier en permissions 0600, installation privée sauvegardée. Authentification avec la remplaçante réussie et lecture du catalogue Lyria 3 Clip en 200. Le test supplémentaire des permissions projet via Cloud Resource Manager est indisponible (`SERVICE_DISABLED`) : ses résultats sont inconnus, pas des permissions refusées. Aucune API activée, aucun rôle accordé et aucun environnement de production modifié. La génération Lyria et la révocation de l’ancienne clé restent non qualifiées/non effectuées. Le premier téléchargement du navigateur intégré, resté introuvable, n’a pas été installé.

## Coûts observés

Pilote natif après préparation du devis musical : **42 Responses, 117 450 tokens, 0,1731225 USD d’API estimés**. La nouvelle demande musicale représente **2 Responses, 6 765 tokens, 0,0111273 USD estimés** ; aucun doublon, coût inconnu ou réponse non tarifée dans les traces enregistrées. **0,40 USD nets** de médias dans le ledger isolé ; export **0 USD wallet** (un export gratuit consommé). Le devis musical de 0,05 USD reste préparé, sans job ni charge. Le coût CPU/RAM du rendu est estimé séparément à environ 0,006 USD. Stockage, logs, réseau, base, builds, travail Codex et factures restent distincts. Carte/funding API et factures fournisseur non vérifiés. Les valeurs du wallet pilote ne sont pas le solde de production.

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
- Reprise musique hors Git : `google-renewed-access-qualification.json`, `native-music-quote.json` et `native-music-quote-005.png` dans le même répertoire. Le devis est en attente d’approbation et expire à 20:59 UTC ; s’il expire, préparer un nouveau devis avant toute confirmation.
- Scripts/credentials opérationnels sont privés et ignorés dans Git. Ne jamais afficher des fichiers env, secrets, clés JSON, URL signées ou journaux bruts.
