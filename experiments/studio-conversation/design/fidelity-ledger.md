# Fidélité du prototype Studio

Référence acceptée : `studio-premiers-echanges.png`, 1672×941, et l’étude `studio-recomposition.html`. Capture réelle du prototype : `qa/studio-desktop-1672.png`, obtenue par screenshot de l’aperçu Codex à 1672×941. Référence et capture ont été ouvertes avec view_image dans la même passe de QA. Captures mobile : 390×844 et 320×740. L’override de viewport est temporaire.

| Point | Comparaison réelle | Décision |
|---|---|---|
| Cadre de l’app | Barre MaxVideoAI, sidebar nommée, Studio sélectionné, compte en bas | Conservé ; logo typographique de prototype et badge local à la place des connexions providers |
| Couleurs | Fond charbon et accent or ; surfaces discrètes, faible contraste décoratif | Conservé ; pistes audio légèrement teintées pour distinguer voix/ambiance |
| Chat central | Colonne centrale stable, composer arrondi en bas, ajout à gauche, envoi or à droite | Conservé ; historique défile sans déplacer le composer |
| H1 et tagline | H1 Studio visible ; « Une idée. Un film. » sur l’état initial | H1 réduit pour la hiérarchie app ; tagline défile avec la conversation avancée |
| Médias autour | Deux visuels à gauche, un principal et un secondaire à droite | Conservé ; composition déterministe, maximum quatre, sélection/pins et bibliothèque pour le reste |
| Photographies | Même famille cobalt/verre/mer/lin | Vrais assets séparés issus de l’étude précédente ; variation geste et cadrages propres aux sources, aucun screenshot de UI utilisé comme média |
| Montage | Bande inférieure, vignettes, lecture, curseur or et temps | Conservé ; ajout de vraie coupe, ordre, zoom, undo/redo et export, voix/ambiance mesurées plutôt qu’une waveform décorative |
| Moniteur | Aucun lecteur envahissant permanent dans le mockup | Petite surface au clic, à la place du principal sur desktop ; dock réduit sur mobile |
| Audio et rendus | Absent de la référence initiale | Extension explicitement demandée : lecteurs dans les messages, MP4/MP3 et téléchargement |
| Mobile | Pas de référence raster mobile | Chat seul, résultats inline, montage horizontal, coupe dans des contrôles larges, moniteur fermable |

La capture desktop montre la conversation arrivée au rendu final : la tagline initiale et les premières bulles sont au-dessus dans l’historique. C’est l’état à vérifier pour une conversation qui continue, pas une modification de la copy initiale. Copy du brief parfum conservée ; texte de l’assistant adapté aux actions réelles et à la simulation annoncée. Lucide et police système sur toutes les surfaces.

Contrôles vérifiés dans IAB : brief → trois animations → sélection moniteur → coupe au clavier → déplacement → lecture réelle (video readyState 4 et currentTime qui avance) → génération voix → lecture audio native → insertion voix/ambiance → export avec lecteur prêt. Mobile : 390 et 320, historique jusqu’au rendu, composer visible, défilement de timeline, fermeture des réglages/moniteur. Les entrées bibliothèque, paramètres et projets sont des surfaces locales fonctionnelles. Les transitions respectent reduced motion ; aucun placement aléatoire permanent.

Écarts intentionnels : démo signalée, H1/controls plus compacts, paramètres dans un dialogue, pas de bascule permanent complet/par étapes, pas d’auth/connexions décoratives, pistes audio nécessaires et rendu dans le chat. La fidélité porte sur le vocabulaire, la composition et les interactions acceptées, pas sur une reproduction pixel à pixel d’un unique état raster.
