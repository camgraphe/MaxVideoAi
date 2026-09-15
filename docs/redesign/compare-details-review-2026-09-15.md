# Comparatifs — détails, actions et FAQ (D83)

15 septembre 2026 · worktree `codex/site-redesign` · aperçu local uniquement.

## Retour traité

Les intitulés « Explore all criteria » et « All technical details » ne rendaient pas visible la profondeur du comparatif. Les actions de génération étaient trop discrètes, puis la page devenait une suite de textes.

## Mise en place

- Critères : nombre réellement masqué, nombre affiché/total, exemples des critères supplémentaires et contrôle de dépliage explicite. Pour MiniMax H3/H3 Max : 3 sur 11, puis « Comparer les 8 autres critères ». Le compteur passe à 11 sur 11 à l’ouverture.
- Génération : deux cartes avec vrais logos, boutons pleins « Générer avec [modèle] », destination app avec modèle présélectionné et lien secondaire vers sa fiche. Le garde-fou des modèles non générables reste en place.
- Tarifs : deux cartes par modèle, lignes résolution/prix et accès aux tarifs. Les montants, sources et calculs ne changent pas.
- Caractéristiques : aperçu de trois données issues du tableau existant (durée, résolution, audio ou proportions), puis nombre de caractéristiques et exemples des contrôles à explorer. Le tableau complet reste disponible.
- FAQ : première question orientée choix, avec le verdict éditorial existant lorsqu’il est disponible ; première réponse ouverte ; accordéon HTML natif avec une réponse ouverte à la fois. Questions numérotées et raccourcis vers exemples, notes, prix et caractéristiques. Les FAQ éditoriales spécifiques restent prioritaires. Les réponses restent dans le HTML serveur et alimentent le même JSON-LD.
- Libellés et questions repris en anglais, français et espagnol. Contrastes clairs/sombres dédiés.

L’ordre notes globales → galeries → critères demandé en D82 reste inchangé. Aucun nouveau lecteur, aucune modification des vidéos ou du chargement critique.

## Vérifications

- TypeScript et lint frontend : valides.
- 48 tests ciblés comparatifs/hreflang : réussis, dont deux tests de priorité du verdict et de cohérence FAQ/JSON-LD.
- Vérification d’exposition publique et `git diff --check` : valides.
- Revue navigateur à 390 px et 1280 px : dépliage des critères et du tableau, CTA, cartes tarifaires, FAQ exclusive ; aucun débordement horizontal sur les états mobiles vérifiés. Réponse ouverte contrôlée en thème sombre.
- Trois routes EN/FR/ES comparées aux relevés D82 : HTTP 200 ; title, H1, description, canonical, hreflang et robots identiques. Questions et réponses du schéma FAQ présentes dans le HTML serveur.

Aucun déploiement. La mesure de performance en build production prévue par D82 reste à effectuer avant publication ; cette passe ne revendique pas de gain de classement ou de Core Web Vitals.
