# Suite app et Studio en parallèle — 8 septembre 2026

## Point de départ

L'app est qualifiée à `0eb139aa5` sur `codex/app-catalogue-validation` (source `45c45a812`, 4469 tests, build861pages). Le premier chargement d'Activité reste mesuré à17–18s; aucune amélioration de latence n'est revendiquée.

Studio existe sur `codex/maxvideoai-editor`, commit `6165afc34`, dans `/Users/adrienmillot/Desktop/MaxVideoAi V2/.worktrees/maxvideoai-editor-run`. Cette copie contient des changements suivis et deux nouveaux fichiers non commités, notamment certification des modèles et faits de génération partagés entre devis et soumission. Il faut préserver cet état sans écrire dans cette copie. La tâche historique est `EDITOR V1 bis` (`019eb877-1d5d-7a53-ba8c-a544be6eb66e`).

## Fil principal : app

1. Isoler et corriger le délai d'Activité avec des mesures comparables par phase (auth, accès aux données, enrichissement, réponse et affichage). Préserver recherche/filtres, pagination, isolation et sources. Une baisse du nombre de requêtes n'est pas un résultat de latence.
2. Compléter la continuité du brouillon : comparer les devis des modèles dans des conditions équivalentes; présenter les adaptations avant changement; créer une référence dans une autre activité et revenir au rôle/emplacement initial sans perte. Vérifier ce qui est déjà réel avant toute réimplémentation.
3. Qualifier ces parcours, wallet/prix, états réels et mobile, puis intégrer les raccords Studio après revue des contrats communs.

## Fil parallèle : Studio et canevas

Créer une nouvelle tâche et une nouvelle worktree. Partir des sources actuelles de l'éditeur et de l'app qualifiée après inventaire des divergences. Les branches sources et leurs fichiers non commités restent intacts. Les changements locaux récupérés doivent être explicitement listés et tracés dans la nouvelle branche.

Séquence confiée :

1. Inventaire des actions et de la persistance existantes, capacités certifiées, prix, références typées et audio. Plan d'implémentation versionné avant modifications importantes.
2. Refonte réelle des blocs, menus, inspecteur, insertion, connexions et canevas. Conserver la direction sobre MaxVideoAI; emprunter aux jeux vidéo la lisibilité de la sélection, les retours immédiats et les petites animations utiles. Typographie/pictogrammes cohérents, moins de texte et de panneaux imbriqués. Les actions tactiles/au clavier remplacent toujours un geste de dépôt possible. Respecter réduction des animations et performances.
3. Relier la bibliothèque/récents image-vidéo-audio au projet et aux destinations réellement prises en charge (canevas/timeline). Réutiliser IDs et originaux, isoler les comptes, annuler/retirer/remplacer sans perdre les médias ni le projet.
4. Première tranche MCP : ordre explicite des clips vidéo vers une nouvelle timeline persistée. Partager les commandes métier avec l'UI; propriété, idempotence, sauvegarde et coexistence autosave doivent être démontrées. Le `prepare_montage` actuel est un plan non persisté, désactivé par défaut : ne pas le présenter comme un montage enregistré. Audio visible et conservé; pas d'édition audio avancée implicite.
5. Vérification visuelle dans le navigateur (desktop/mobile, clair/sombre), tests pertinents et livrable exécutable dans sa prévisualisation propre, puis revue avant intégration.

## Frontières pour éviter les conflits

- Le fil principal possède les créateurs hors Studio, Activity, les propriétaires de bibliothèque/réutilisation existants et la feuille de style globale de l'app.
- La tâche Studio possède les routes/composants/styles locaux Studio, son adaptateur de médias et la tranche de montage MCP. Elle documente et isole dans un commit distinct tout changement indispensable d'un contrat partagé; pas de remplacement global des composants app ni de copie divergente du registre modèle/devis.
- Le fil Studio utilise un port libre autre que3026 et conserve les branches sources. L'intégration finale est réalisée seulement après revue des deux côtés.
- Pas de push, fusion dans main, déploiement, génération payante ou écriture en production. Essais de persistance sur environnement jetable explicitement identifié; aucune migration automatique contre une URL distante héritée.
- La copie Neon de qualification app expire le10septembre2026 à16:43:50UTC; elle n'est pas une autorisation générale d'écriture pour Studio. Aucun secret ne doit être transféré dans un prompt ou une documentation.

Références : `docs/design/global-app-concept/visual-rules.md`, `integration-contract.md`, `experience-map.md`, `docs/engineering/app-experience.md`, `mcp-montage-preparation.md`, instructions et contrats propres à Studio dans sa branche.
