# Pages comparatives — D82, 15 septembre 2026

Revue locale : http://localhost:3008/ai-video-engines/minimax-h3-vs-seedance-2-5

Travail dans `codex/site-redesign`. Aucun déploiement, aucune écriture dans la base de production, aucune nouvelle génération.

## Composition retenue

Dernière décision d’Adrien : les vidéos viennent **juste sous les notes globales**, avant la grille détaillée. Le déplacement avant les notes a été annulé à sa demande.

- Titre avec les deux modèles, introduction courte. Le contexte éditorial, le verdict et les conseils propres à chaque paire se déplient sous « Les repères pour choisir ».
- Deux identités avec vrais logos, sélecteurs existants et notes globales. Le calcul des notes est conservé.
- Jusqu’à trois exemples publics de chaque modèle, liens vers les pages exemples. Les galeries sont indépendantes : prompts et réglages différents, aucun test contrôlé revendiqué.
- Aperçu muet au survol ou au focus lorsque les préférences de lecture l’autorisent. Un clic ouvre un lecteur sur la page, avec fermeture et retour du focus ; lecture native manuelle et qualité Original par défaut. Le lien vers le prompt et les réglages reste disponible.
- Grille sur fond charbon : trois critères visibles, tous les autres accessibles dans un panneau dépliable, méthode et synthèse conservées. Les trois lignes ne remplacent pas la note globale.
- Tarifs, caractéristiques dépliables, liens utiles et FAQ. Les conseils redondants ne forment plus quatre cartes après le tableau. Pas de titre « Comparaisons associées » vide lorsqu’il n’existe aucun lien localisé.

Les deux LTX 2.5 n’ont que deux exemples chacun dans la copie locale : deux sont affichés. Un modèle sans exemple ne reçoit jamais les vidéos d’un modèle voisin.

## Médias et architecture

`compare-gallery-loader.ts` lit uniquement une playlist publique `examples-<modelSlug>`. La présentation transmet au client une projection minimale : identité du média, poster, original, aperçu, durée, format et présence audio. Un second filtre vérifie l’identité exacte du modèle, la visibilité publique et les URLs indispensables ; trois résultats uniques au maximum. Les modèles en pré-lancement ne déclenchent pas cette lecture. Une indisponibilité des médias n’empêche pas la comparaison de s’afficher.

`CompareGalleryCard.client.tsx` utilise le cycle d’aperçu existant `useExampleCardPlayback`. `CompareVideoDialog.client.tsx` utilise `PublicVideoPlayer` et `useAccessibleModal`. Les sources originales et les lecteurs partagés restent propriétaires de la qualité et du repli média. Aucun montage natif des six vidéos avant intention de lecture ; posters responsifs lazy, qualité 52 déjà autorisée, géométrie fixe. Le lecteur en fenêtre est chargé à la demande.

Les définitions historiques de vidéos à prompt identique sont conservées dans leur configuration ; elles ne sont plus utilisées par ce gabarit. La politique de publication des modèles et les routes restent inchangées.

Les traductions exactes des capacités récentes (références, durées, audio) sont partagées entre fiches modèles et comparatifs dans `frontend/lib/marketing/spec-capability-copy.ts`. Une valeur inconnue conserve son sens original.

## SEO et langues

Comparaison HTTP avec la production sur six routes :

- MiniMax H3 / Seedance 2.5 EN et FR ;
- LTX 2.5 Fast / Pro ES ;
- Seedance 2.0 / Fast EN ;
- Kling 3 Pro / Seedance 2.5 FR ;
- Seedance 2.0 Mini / Seedance 2.0 ES.

Les six titres SEO, H1, canoniques et ensembles hreflang sont identiques à la production. Les schémas FAQPage, BreadcrumbList et WebPage restent présents et les réponses structurées correspondent au HTML serveur. Les descriptions promettant un test vidéo à prompts identiques ont été corrigées dans les dictionnaires et six fichiers éditoriaux concernés ; dans l’échantillon, seule la description Seedance 2.0 / Fast change. Les autres intentions de comparaison, noms de modèles et URLs sont conservés.

Les galeries ajoutent des liens HTML vers les pages de lecture et les pages exemples. Les détails repliés restent dans le HTML serveur. Aucune nouvelle règle de sitemap, canonical, robots ou redirection n’est introduite. Les redirections vérifiées : paire inversée → canonique avec `order` (308), ancien chemin FR → `/fr/comparatif/…` (307).

Les clips de galerie sont une aide au choix, pas une promesse de résultats vidéo Google sur le comparatif. Les pages de lecture dédiées restent les destinations correspondantes. Références : [Google — SEO vidéo](https://developers.google.com/search/docs/appearance/video), [Google — liens explorables](https://developers.google.com/search/docs/crawling-indexing/links-crawlable).

Aucun gain de positions, de trafic ou de citations IA n’est annoncé. Les descriptions modifiées peuvent faire évoluer les extraits et leur taux de clic. GSC n’a pas été réinterrogé pour ce lot : les chiffres de la passe modèles ne sont pas des chiffres de comparatifs.

## Vérifications

- 52 tests ciblés : filtres des galeries, absence de substitution, architecture, localisation partagée, prix, sélecteurs, latence observée et hreflang.
- TypeScript, lint frontend, lint d’exposition et `git diff --check`.
- 80 liens locaux de l’échantillon en HTTP 200, dont les pages de lecture.
- Contrôles visuels à 390 px et sur desktop : galeries, caractéristiques ouvertes, réponses FAQ et thèmes clair/sombre ; aucun débordement horizontal constaté à 390 px.
- Lecture native en fenêtre validée : vidéo MiniMax H3, état prêt 4, temps de lecture avançant, aucune erreur média. Fermeture et retour sur la comparaison.
- Inversion de la paire vérifiée : H1, ordre des galeries et exemples cohérents.
- Six posters chargés et zéro élément vidéo dans la comparaison avant intention de lecture, y compris après inversion.

Preuves : [balises comparées](qa/compare-seo-2026-09-15.json), [contrôle des liens](qa/compare-links-2026-09-15.json).

## Avant publication

Le serveur actuel est un serveur de développement, avec une copie locale de médias publics. Les durées de réponse incluent compilation et cache : elles ne permettent pas de conclure sur les Core Web Vitals. Comparer les performances mobiles avant/après sur des builds de production équivalents, notamment le nouveau candidat LCP parmi les vignettes, et bloquer toute régression reproductible. Vérifier aussi les playlists réellement disponibles dans l’environnement de préproduction. Cette passe ne constitue pas une autorisation de déploiement.
