# Studio conversationnel — brief de reprise du 2 octobre 2026

## Situation actuelle

Le pilote natif sait passer d’un brief ordinaire en anglais à des médias réels, un montage canonique sauvegardé et un MP4 distant récupérable dans le chat. Le film actuel est une ébauche technique de 25 secondes : 5 secondes d’animation, puis 20 secondes d’image fixe ; voix anglaise sur environ 12,4 secondes et musique réelle sur les 25 secondes. La qualité artistique d’une promo terminée reste à obtenir. Le premier MP4 exporté précède l’ajout de musique ; le nouveau MP4 du mix se lit jusqu’à sa fin dans le chat, sans erreur de décodage.

**Dernière décision utilisateur : arrêter ce film.** Il reste une preuve technique, pas une promo acceptée ni un jalon artistique à poursuivre. La priorité est de fournir des outils exécutables à l’IA pour qu’elle puisse réaliser un film, sans prescrire sa recette créative. Aucune nouvelle génération ou amélioration de ce film n’est à lancer.

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
| Musique | Un Lyria 3 Clip réel, 30 s mesurées, audio/mp4, une tentative approuvée et une charge de 0,05 USD ; lecture complète dans le chat |
| Montage | Insertion, trim, déplacement, gain, conflit de révision et reprise ; vidéo/audio ensemble, moniteur repliable |
| Mix | Révision 10 sauvegardée : musique à 20 %, voix à 100 %, source musicale limitée aux 25 s du film ; lecture concurrente et reprise après reload vérifiées |
| Export | Deux rendus AWS réels : 25 s, 720p, 16:9, 30 fps, H.264/AAC ; le second contient voix et musique et se lit jusqu’à sa fin dans le chat |
| Réutilisation | Public ID et provenance corrigés ; les deux assets exportés sont résolubles. Les faits du second fichier sont mesurés séparément, en attente de l’hydratation canonique lors d’une insertion |

Le worker pilote **:4** est construit depuis `98345933c`, digest épinglé, contrôles de démarrage hors réseau/Node/FFmpeg/Chromium passés, accès temporaires de build révoqués. Le localhost l’utilise. Le premier rendu provenait de **:3** ; le deuxième rendu avec musique, devis gratuit, a terminé à 20:48 UTC. Une seule tâche **:4**, digest attendu, code de sortie 0, durée d’exécution de 108,608 secondes. FFprobe mesure 750 images vidéo sur 25 s et une piste AAC stéréo de 25,045333 s (fin de paquet audio). Le son est présent entre 13 et 24 s après la narration, moyenne -28,8 dB. Aucun troisième rendu lancé.

Le deuxième export projette un Public ID résoluble et la provenance `metadata.timelineExportId`, sans faux `source_job_id`. Les faits mesurés du fichier sont documentés séparément ; les faits d’asset ne sont hydratés que par le propriétaire existant lors d’une future insertion, pas inventés depuis les paramètres d’export.

La première demande « Add it to the film and keep the voice easy to hear » avait inséré la musique puis atteint la limite de quatre Responses avant de régler son gain. Une courte demande client suivante avait réglé la musique à 20 %. Le deuxième lot corrige désormais cette limite sans augmenter le budget : la quatrième action peut s’exécuter ; la réponse de fin distingue edits terminés et travail restant, sans annoncer un contrôle absent. Les tests couvrent reprise, conflit manuel et contenu tronqué ; le film existant n’a pas été retouché.

Le socle de tests compte une passe antérieure de **679 tests**, puis **22 contrôles ciblés** pour le dernier correctif, avec TypeScript/lint/exposition. Chromium, Firefox et WebKit ont passé le parcours intégré sur les commits documentés. Mobile = viewports simulés ; les appareils physiques restent à qualifier. Ne pas présenter ces passes comme un nouveau test complet de chaque commit.

Un défaut observé pendant le second rendu remplaçait le devis gratuit confirmé par le prix du prochain export et pouvait remplacer le statut de fin par une erreur d’estimation. Le correctif conserve le prix et le montage soumis pendant le rendu, les restaure après reload, puis demande un nouveau prix à l’ouverture d’un nouvel export. Le statut d’export détenu renvoie désormais le montant enregistré, la devise et le type de facturation : ce prix réel prime sur le devis local lors d’une reprise après réponse perdue ou récupération de l’historique. Un devis initial reste identifié séparément lorsque l’envoi est incertain ; le bouton de reprise affiche le devis courant qu’il autorise. Les nouvelles tentatives après échec/annulation montrent leur nouveau devis et utilisent le montage courant, jamais le prix de l’ancien job.

Cas reproduits rouges puis verts ; revue indépendante sans blocage restant. Dernière passe `qa:editor` : **689 tests réussis, 1 ignoré**, TypeScript réussi, lint sans erreur avec les sept avertissements d’images antérieurs. Les **23 contrôles ciblés** incluent quatre régressions nouvelles : réponse payante perdue, reprise/session/historique, prix d’une relance après échec et projection de facturation avec isolation du propriétaire. Exposition/diff valides. La première passe avait sélectionné PostgreSQL 14 ; la passe verte utilise explicitement PostgreSQL 17, sans modifier les contrats de version. Aucun algorithme de devis, prélèvement ou worker n’a été changé par ce correctif.

## Reprendre dans cet ordre

1. **Ne pas répéter les dépenses qualifiées.** La tentative musicale approuvée de **0,05 USD / 30 s / Lyria 3 Clip** est terminée ; une seule charge et exactement 5 cents de crédit synthétique pilote. La nouvelle clé Google est qualifiée pour cet appel Lyria réel. Le mix et le second MP4 sont qualifiés ; pas besoin de relancer ces générations ou exports. Garder la rotation des consommateurs production/preview séparée ; l’ancienne clé n’est pas retirée avant leur vérification.
2. **Premier lot d’outils implémenté, 3 octobre.** `model_details` partage les faits du MCP après autorisation et certification Studio. Les outils image/vidéo/voix/musique acceptent des choix explicites et les conservent dans leurs drafts et devis. Les limites du chat et variantes Audio disponibles sont projetées ; les anciennes valeurs restent des défauts compatibles, pas une recette obligatoire. Les recommandations publiques Higgsfield/Runway sont sourcées dans le propriétaire commun de guidance, sans scores inventés ni prix externes.
3. **Compléter le parcours d’actions.** Conserver les commandes communes de médias, montage et devis, corriger les tours d’édition qui s’arrêtent avant l’ajustement demandé et exposer la préparation d’export à la conversation avec confirmation humaine. Le rendu réel fonctionne aujourd’hui via l’interface, mais Sol ne possède pas d’outil d’export. Les pièces jointes audio/vidéo apportent identité et métadonnées ; elles ne prouvent pas une analyse de leur contenu. L’editing et l’audio ne sont pas publiés sur le MCP distant.
4. **Qualifier les capacités, pas la qualité de ce film.** Faire une matrice courte par outil : entrée/référence, paramètres acceptés, devis, exécution, résultat réutilisable et reprise, plus les refus utiles. Anglais principal, adaptateurs session Studio et OAuth MCP vérifiés séparément. Aucun nouveau film payant ni salve générale requis pour cette qualification des contrats.
5. **Préparer la bascule.** Réconcilier la branche Pricing via ses propriétaires canoniques (tâche distincte encore en validation au moment de ce brief), fixer prix/plafonds des conversations, qualifier les cas client ciblés et appareils réels, puis préparer preview/migrations/retour arrière. Aucun remplacement de Studio en production ni publication MCP n’a été effectué.

Ne pas relancer une salve générale à chaque changement. Tests ciblés sur la prochaine capacité et revue globale avant la bascule. Les propositions créatives de l’audit Astra restent des pistes distinctes ; elles ne remplacent pas les outils manquants et ne sont pas la priorité de ce lot fonctionnel.

Le [comparatif des outils Higgsfield, Runway et Replicate](studio-mcp-tool-benchmark-2026-10-02.md) conserve ses sources et son audit initial, puis documente les deux lots implémentés. Détails/préparation/persistance, édition/export via les deux adaptateurs et complétion bornée sont dans la branche. La nouvelle qualification reste contractuelle et locale ; elle n’affirme pas la qualité créative de nouveaux médias ni une ouverture client.

Conserver **6.1 Sol** comme réalisateur de référence et exploiter ses décisions créatives via des outils composables. Les capacités, résultats et sources nourrissent le modèle ; le code ne doit pas réaliser sa stratégie créative à sa place. Les adaptateurs MCP restent utilisables par d’autres modèles et leur progression doit bénéficier au même socle.

Vérification du premier lot : `qa:editor` **723 succès, 1 ignoré**, TypeScript réussi, lint sans erreur avec les sept avertissements d’images antérieurs. La suite MCP ciblée donne **122 succès** ; exposition et whitespace valides. Les nouveaux scénarios sont principalement en anglais. Les tests PostgreSQL 17 jetables prouvent la conservation image/vidéo/voix/musique après interruption de transaction, devis canonique identique Studio/MCP pour une requête équivalente, reprise sans second appel modèle et confirmation idempotente. Revue indépendante sans point important restant. Ces preuves utilisent des fournisseurs simulés ; aucun appel média, export, migration ou publication de production n’a été lancé.

## Deuxième lot : outils de montage et export

Le [contrat des cinq outils MCP](mcp-studio-timeline-tools.md) est livré dans la source, avec OAuth/client réel, sorties possédées prêtes, révision/receipts et schémas de résultats. Les gates publics restent fermés. Sol prépare ou observe un export ; la confirmation demeure un bouton humain dans le chat. La préparation sauvegarde le montage et son token privé dans le propriétaire existant, sans lancer de worker. Les routes classiques et les deux adaptateurs partagent maintenant `timeline-exports/orchestration.ts` et les propriétaires de prix, réservation, rendu et livraison.

La suite prouve une préparation/action reprise après interruption sans nouvel appel modèle, un seul job et un seul prélèvement pour deux confirmations simultanées, reprise du prix enregistré après édition, séparation session/OAuth/client, pistes masquées/muettes respectées et renouvellement des accès aux rendus privés. Le bouton conserve l’identité après réponse perdue/invalide et reload. Les fonctionnalités désactivées ne lisent pas les receipts d’export, préservant le parcours image/capacités antérieur. Aucun nouvel appel Sol, fournisseur média, rendu AWS, crédit pilote ou changement de production dans ce lot.

Passe `qa:editor` : **751 réussites, 1 test de rendu opt-in ignoré**, TypeScript et lint valides (sept avertissements d’images préexistants). Les quatre suites MCP ciblées, exposition et whitespace passent. La revue indépendante a identifié le respect des pistes masquées/muettes, corrigé et reproduit rouge puis vert. La qualification navigateur du nouveau devis et l’installation locale sont consignées au checkpoint suivant.

Prochaine étape produit : qualification client et livraison bornée (Batch 3), avec politique de tokens/plafonds, vrais appareils, OAuth distant, rotation des credentials et compatibilité Pricing. Le travail parallèle OpenAI directory modifie des propriétaires communs ; réconcilier explicitement exclusions de publication, admission des comptes et handling de tarifs/expiration, sans écraser leur travail ni ouvrir automatiquement Audio/montage/export.

## Contrôle Google après reconnexion

Contrôles du 2 octobre vers 19:30–19:55 UTC, sans génération ni modification du déploiement :

- Le déploiement de production Vercel est `READY`, sur `d10ad458743aef68e6e9be12cad9c611f06077b8`. Les crons Google Veo/Omni figurent dans les réponses 200 des journaux récents. Un cron sans job actif ne vérifie pas l’accès au fournisseur.
- La base configurée dans les fichiers locaux de l’application principale, distincte du pilote, contient un Omni direct terminé à 18:50 UTC et un Veo Fast direct terminé à 15:38 UTC ce jour. Aucun échec Google avec message d’authentification identifié dans les sept derniers jours. L’URL de base du déploiement n’a pas pu être relue : ces résultats restent des preuves de la base principale, pas une qualification complète de toutes les routes de production.
- Les clusters d’erreurs Vercel des dernières 24 heures portent sur Fal/Kling : refus de contenu, ratio et timeout. Les requêtes de journaux détaillés ont expiré ; ne pas en déduire une absence exhaustive d’erreurs.
- La console Google confirme que le compte de service est activé et que l’ancienne clé signalée est active. La nouvelle clé créée par l’utilisateur est également active ; son téléchargement reste à récupérer. Vercel masque la valeur de la clé et des flags avec `[SENSITIVE]`, donc leur empreinte exacte et leur valeur effective n’ont pas été qualifiées. Une valeur masquée n’est pas une clé invalide ou absente.
- Veo, images Google et Lyria partagent la configuration Google ; Omni accepte un override puis retombe sur cette configuration. Le remplacement doit couvrir chaque environnement consommateur avant de retirer l’ancienne clé. Garder la bascule Pricing coordonnée avec la mise à jour des credentials, sans publier cette branche Studio pour renouveler une clé.

Conclusion bornée : aucun indice de panne causée par la session de console expirée ; le renouvellement après l’incident demeure nécessaire. Le validateur privé refuse l’ancienne empreinte, un autre compte/projet, un endpoint OAuth inattendu et une clé de signature invalide. Huit cas synthétiques hors réseau sont passés. Aucun appel Google avec l’ancienne clé, aucune dépense média et aucune révocation ont été effectués pendant ce contrôle.

Mise à jour vers 20:17 UTC : le JSON créé dans Chrome correspond exactement à la clé active du bon compte/projet, fichier en permissions 0600, installation privée sauvegardée. Authentification avec la remplaçante réussie et lecture du catalogue Lyria 3 Clip en 200. Le test supplémentaire des permissions projet via Cloud Resource Manager est indisponible (`SERVICE_DISABLED`) : ses résultats sont inconnus, pas des permissions refusées. Aucune API activée, aucun rôle accordé et aucun environnement de production modifié. Le premier téléchargement du navigateur intégré, resté introuvable, n’a pas été installé.

Mise à jour vers 20:41 UTC : une génération Lyria 3 Clip réelle avec cette remplaçante a réussi, sortie mesurée à 30 s, lecture native complète et ajout au montage vérifiés. Cela qualifie Lyria dans le pilote ; les consommateurs production/preview et les autres routes Google ne sont pas qualifiés avec la remplaçante. L’ancienne clé reste active, aucune révocation effectuée.

## Coûts observés

Pilote natif après direction musicale, insertion et réglage du mix : **49 Responses, 143 201 tokens, 0,2076995 USD d’API estimés**. Ces trois demandes musicales représentent **9 Responses, 32 516 tokens, 0,0457043 USD estimés** ; aucun doublon, coût inconnu ou réponse non tarifée dans les traces enregistrées. **0,45 USD nets** de médias dans le ledger isolé, dont la nouvelle musique à 0,05 USD ; crédit synthétique total de 0,45 USD et wallet à zéro. Deux exports **0 USD wallet**, terminés. Total observé médias + API du réalisateur : environ **0,658 USD**, hors infrastructure. Le coût CPU/RAM du premier rendu est estimé séparément à environ 0,006 USD ; le second a duré 108,608 s, facture non vérifiée. Stockage, logs, réseau, base, builds, travail Codex et factures restent distincts. Carte/funding API et factures fournisseur non vérifiés. Les valeurs du wallet pilote ne sont pas le solde de production.

## Où reprendre

- Worktree : `/Users/adrienmillot/.codex/worktrees/studio-conversation-exploration/MaxVideoAi V2`
- Branche : `codex/studio-conversation-exploration-20261001`
- Snapshot localhost qualifié : `7038a4b85`, incluant la reprise du prix d’export ; worker : `98345933c`. Le premier lot d’outils est désormais dans la branche source et testé en local ; ce nouveau code n’est pas encore installé dans le snapshot localhost. Le comparatif conserve son audit initial et décrit le lot séparément.
- Projet : `http://localhost:3000/app/studio/conversation/project_4a87acc7-9f5f-498c-97d9-875034c8ad21`
- Timeline : révision 10 ; compte/DB/storage pilote isolés. Serveur localhost vérifié actif au moment du brief.
- IMPORTANT : ce dépôt partage une configuration Git `core.worktree`. Exécuter les commandes Git dans ce worktree avec `env GIT_WORK_TREE="$PWD"`. Ne pas modifier la configuration partagée ni le checkout Desktop/les changements Pricing.
- Références : [readiness](studio-conversation-pilot-readiness.md), [environnement et preuves](studio-conversation-pilot-environment.md), [intégration et propriétaires](studio-conversation-integration.md), [plan](../superpowers/plans/2026-10-02-studio-conversation-delivery.md).
- Audit Astra hors Git : `/Users/adrienmillot/.codex/visualizations/2026/10/02/studio-mcp-audit-astra/rapport.md`, `recettes-proposees.md` ; exploration produit : `/Users/adrienmillot/.codex/visualizations/2026/10/02/maxvideoai-product-concepts/proposition-produit.md`.
- Preuves natives hors Git : `/Users/adrienmillot/.codex/visualizations/2026/10/02/studio-native-pilot/qualification-20261002-final.json` et MP4 `native-roughcut-25s-rendered.mp4`.
- Preuves musique hors Git : `native-music-qualification.json`, `native-music-chat-playback.json`, `native-music-timeline.json`, `native-music-reload-concurrent-playback.json`, `native-music-film-playback-end.json`, `native-music-usage.json` dans le même répertoire. Le devis musical est consommé ; une seule tentative réussie, aucune relance nécessaire.
- Nouvel export musical : `tlx_923c1751de2290563b8bb1ac14eb1cb87f5c2cd396658459f009624e1e775fff`, Draft gratuit, 25 s / 720p / 16:9 / 30 fps. Fichier `native-music-roughcut-25s.mp4`, preuves `native-music-export-file-facts.json`, `native-music-export-chat-playback.json`, `native-music-export-asset.json` ; capture du devis `native-music-export-free-quote.png`.
- Scripts/credentials opérationnels sont privés et ignorés dans Git. Ne jamais afficher des fichiers env, secrets, clés JSON, URL signées ou journaux bruts.
