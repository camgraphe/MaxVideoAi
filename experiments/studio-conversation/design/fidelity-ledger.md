# Fidélité du prototype Studio

Référence acceptée : `studio-premiers-echanges.png`, 1672×941, et l’étude `studio-recomposition.html`. Capture réelle du prototype : `qa/studio-desktop-1672.png`, obtenue par screenshot de l’aperçu Codex à 1672×941. Référence et capture ont été ouvertes avec view_image dans la même passe de QA. Captures mobile : 390×844 et 320×740. L’override de viewport est temporaire.

| Point | Comparaison réelle | Décision |
|---|---|---|
| Cadre de l’app | Barre MaxVideoAI, sidebar nommée, Studio sélectionné, compte en bas | Conservé ; logo typographique de prototype et badge local à la place des connexions providers |
| Couleurs | Fond neutre Charbon/champagne par défaut ; variantes Minuit/glacier, Porcelaine/terre cuite et Olive/or | Variantes demandées après la dominante verte ; choix mémorisé, composition et photographies conservées, pistes voix/ambiance distinctes |
| Chat central | Colonne centrale stable, composer arrondi en bas, ajout à gauche, envoi or à droite | Conservé ; historique défile sans déplacer le composer |
| H1 et tagline | H1 Studio visible ; « Une idée. Un film. » sur l’état initial | H1 réduit pour la hiérarchie app ; tagline défile avec la conversation avancée |
| Médias autour | Deux visuels à gauche, un principal et un secondaire à droite | Conservé ; composition déterministe, maximum quatre, sélection/pins et bibliothèque pour le reste |
| Photographies | Même famille cobalt/verre/mer/lin | Vrais assets séparés issus de l’étude précédente ; variation geste et cadrages propres aux sources, aucun screenshot de UI utilisé comme média |
| Montage | Bande inférieure, vignettes, lecture, curseur or et temps | Conservé ; ajout de vraie coupe, ordre, zoom, undo/redo et export, voix/ambiance mesurées plutôt qu’une waveform décorative |
| Moniteur | Aucun lecteur envahissant permanent dans le mockup ; nouvelle demande de repli au-dessus du montage | Bande repliable entre canevas/chat et timeline ; les quatre visuels desktop restent présents, la saisie mobile reste au-dessus |
| Audio et rendus | Absent de la référence initiale | Extension explicitement demandée : lecteurs dans les messages, MP4/MP3 et téléchargement |
| Mobile | Pas de référence raster mobile | Chat seul, résultats inline, montage horizontal, coupe dans des contrôles larges, moniteur fermable |

La capture desktop montre la conversation arrivée au rendu final : la tagline initiale et les premières bulles sont au-dessus dans l’historique. C’est l’état à vérifier pour une conversation qui continue, pas une modification de la copy initiale. Copy du brief parfum conservée ; texte de l’assistant adapté aux actions réelles et à la simulation annoncée. Lucide et police système sur toutes les surfaces.

Contrôles vérifiés dans IAB : brief → trois animations → sélection moniteur → coupe au clavier → déplacement → lecture réelle (video readyState 4 et currentTime qui avance) → génération voix → lecture audio native → insertion voix/ambiance → export avec lecteur prêt. Mobile : 390 et 320, historique jusqu’au rendu, composer visible, défilement de timeline, fermeture des réglages/moniteur. Les entrées bibliothèque, paramètres et projets sont des surfaces locales fonctionnelles. Les transitions respectent reduced motion ; aucun placement aléatoire permanent.

Écarts intentionnels : démo signalée, H1/controls plus compacts, paramètres dans un dialogue, pas de bascule permanent complet/par étapes, pas d’auth/connexions décoratives, pistes audio nécessaires et rendu dans le chat. La fidélité porte sur le vocabulaire, la composition et les interactions acceptées, pas sur une reproduction pixel à pixel d’un unique état raster.

Validation finale après corrections de revue : 22 tests et build passés, serveur redémarré avec reprise du projet puis nouveau MP4 réel prêt. Captures 1672×941, 390×844 et 320×740 renouvelées ; largeur du document égale à 390/320, composer visible. `qa/studio-desktop-chat-audio.png` montre le dialogue et la voix relue dans son message (durée réelle 3.992608 s, readyState 4) ; l’autre capture desktop montre les rendus. Référence et preuve chat/audio ouvertes ensemble. Override viewport réinitialisé, onglet gardé comme résultat.

Retouche du 1er octobre après le retour sur la hiérarchie : le moniteur appartient désormais à la zone de montage et libère entièrement sa place au repli. Il ne remplace plus le principal et ne flotte plus sur le chat. Sur téléphone, sa petite bande précède immédiatement la timeline ; toucher la saisie le replie. Repli, réouverture, lecture native interrompue, coupe d’une frame et glissement tactile vérifiés dans IAB ; document à 390/320 px sans débordement. Les captures initiales `qa/` documentent l’état précédent ; les preuves de cette retouche sont dans les visualisations Codex hors dépôt.
