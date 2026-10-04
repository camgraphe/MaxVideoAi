# Studio : évaluation réelle de Sol — 1 octobre 2026

## Décision

Conserver GPT‑6.1 Sol comme directeur du pilote. La compréhension des commandes et des corrections est suffisante sur ce premier corpus. Cela ne qualifie pas encore un réalisateur autonome : qualité artistique, longs projets, transcription, montage sémantique et fournisseurs média restent à évaluer.

Ne pas ajouter de panneaux à l’interface. Le prochain lot est le raccord authentifié aux actions MaxVideoAI et aux devis dans le chat, décrit dans `docs/engineering/studio-conversation-integration.md`.

## Méthode

`prototype/evaluation/run-live.ts` utilise le véritable adaptateur Responses et les services du prototype. Chaque exécution crée son propre dossier sous `.data/evaluations/`, sans lire ou modifier les projets du serveur ouvert, le compte ou la base de production. Les appels Sol sont payants sur la clé API configurée ; aucun fournisseur média payant n’est appelé. Le runner ne fait pas partie des tests hors ligne.

Les sources sont les visuels/vidéo du prototype. Les deux audios de positionnement sont des sinusoïdes, donc ce test ne qualifie pas la compréhension d’un podcast ni sa qualité sonore. Le parcours complet synthétise réellement la phrase française avec Thomas, anime l’image et rend le MP4 avec FFmpeg. Animation et voix sont volontairement retardées de 12 secondes chacune pour empêcher une réussite liée uniquement à la rapidité des fixtures.

Les critères vérifient l’état persisté, les frames et le média mesuré, pas seulement une réponse affirmant la réussite. Les critères de texte restent indicatifs et les réponses ont été relues. Un passage unique par scénario ne mesure ni taux de succès statistique ni variabilité du modèle.

## Résultats de la passe finale

| Scénario | Résultat | Appels Sol | Temps total |
| --- | --- | ---: | ---: |
| Brief libre, direction courte, vertical 15 s, sans média | Réglages corrects, proposition conservée, aucune génération | 2 | 13,1 s |
| Coupe source 1–5 s, ordre, voix à 3 s/40 %, undo puis redo | Toutes les éditions exactes à 24 fps | 10, sur quatre messages | 45,3 s |
| Image entière dans un film vertical | `contain`, coupe/ordre préservés | 2 | 9,4 s |
| Podcast avec parole et ambiance existantes | Deux pistes dès 0 s, ambiance 20 %, aucun export anticipé | 4 | 19,4 s |
| « Repère bonjour dans l’interview/audio » sans accès au contenu | Limite expliquée, aucune analyse/coupe inventée | 1 | 7,9 s |
| Huit références, la sixième contient une montre | Objet correctement décrit dans la sixième image | 1 | 5,2 s |
| Recherche bibliothèque, adoption et coupe à 3 s | Provenance conservée, source identique octet pour octet | 5 | 27,2 s |
| Une demande image → animation → voix → montage → MP4 | Une animation, une voix, deux clips, un MP4 prêt | 9 | 60,1 s |

**8/8 scénarios passent.** 34 appels Responses, 104 019 tokens d’entrée dont 6 317 en cache, 1 824 de sortie dont 87 de raisonnement ; total 105 843. Médiane d’un appel : 4,5 s. Le parcours complet comprend les 24 s de retard volontaire du worker. Ces tokens sont un relevé API, pas un prix client ni un devis MaxVideoAI.

Le parcours complet appelle successivement génération, attente, génération, attente, insertion, insertion, rendu, attente, puis réponse finale. La mesure ffprobe confirme une vidéo avec audio de quatre secondes. Le bot n’a pas besoin d’un second message pour insérer les sorties prêtes.

Le rapport brut, ses prompts/réponses, IDs API et projets restent privés dans le dossier de données de l’exécution. La consommation d’un tour est également conservée dans son journal serveur ; ce relevé n’est pas un ledger de facturation cumulatif.

## Corrections et limites

- Défaut réel corrigé : huit références étaient acceptées, seulement quatre étaient transmises au modèle. Elles sont maintenant toutes transmises, avec une limite totale de 24 Mo d’aperçus et 8 Mo par aperçu ; un dépassement refuse le message avant sauvegarde.
- `studio_wait` attend l’état du worker, sans nouveaux appels au modèle pour sonder la tâche. Il est partagé avec le MCP local et borné à 60 s. Expiration, annulation et échec ne relancent aucune génération. Un traitement dépassant cette limite nécessite une demande ultérieure ; les fournisseurs de production nécessiteront un orchestrateur durable.
- Une édition manuelle pendant l’attente bloque les générations suivantes, éditions et rendus automatiques de ce tour, même si le modèle fournit ensuite la nouvelle révision. Une nouvelle construction ne peut donc pas contourner cet arrêt. Les médias restent disponibles.
- La première passe avait un échec bibliothèque causé par un poster de fixture nommé `UUID-poster.jpg`, hors contrat du copieur local. Le runner a été corrigé pour produire le même nom `UUID.jpg` que les vrais imports ; aucun assouplissement du lecteur de bibliothèque n’a été ajouté.
- 46 tests hors ligne et le build TypeScript/Vite passent. Ils couvrent aussi reprise, idempotence, conflits et exports ; ces tests à API contrôlée ne remplacent pas les appels réels ci-dessus.

## Prochaine qualification

Faire un pilote limité à une création d’image, une animation vidéo, une voix et un rendu, puis élargir après preuves. Mesurer résultat artistique et fidélité produit à partir d’originaux réels, ainsi que latence, coût par création terminée, annulations, prix devenus obsolètes et reprise de jobs. Pour interviews/podcasts, ajouter une transcription horodatée avant toute coupe sémantique. Garder le choix de création complète/par étapes dans la conversation.
