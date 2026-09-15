# Mobile et performance — conditions de conception

Statut : exigences prioritaires confirmées par Adrien le 9 septembre ; critères proposés pour la recette. Aucune mesure de performance du nouveau concept n'existe encore.

## Le mobile est un pilote à part entière

Concevoir chaque séquence simultanément à 390 px et sur desktop ; vérifier 320 px comme contrainte supplémentaire. La version tactile porte la même idée créative, avec une interaction adaptée. Elle ne doit pas être une réduction du desktop ni une page dépouillée de sa démonstration.

L'accueil, le catalogue et la fiche sont présentés dans leurs deux versions à V2 et V3. Une validation desktop ne valide pas automatiquement le mobile.

## Traitement concret des points faibles

| Surface | Règle proposée | Vérification |
|---|---|---|
| Hero | Promesse courte, actions puis poster. Aucun grand vide lié au scroll, aucune attente d'animation avant lecture | Capture au premier rendu, réseau ralenti, texte FR/ES réel |
| Catalogue | Catégorie et recherche accessibles tôt ; filtres secondaires dans un panneau nommé ; cartes assez larges pour identité/prix/action | Comparer aux captures initiales où les filtres occupent presque un écran ; tester titre long et résultats vides |
| Navigation | Contrôles tactiles nommés, menu simple, focus et fermeture fiables | Parcours au pouce et clavier, orientation, retour navigateur |
| Effet signature | Composition tactile : plans qui s'assemblent dans une section courte, puis lecteur volontaire ; étapes consultables directement | Aucun scroll capturé ; pas de distance artificielle de plusieurs écrans ; retour vers le haut correct |
| Comparaison | Empilement ou bascule explicite entre rendus avec contexte maintenu | Ne pas réduire deux tableaux/vidéos desktop jusqu'à les rendre illisibles |
| Vidéo | Poster stable, bouton lecture accessible, son volontaire, pause hors visibilité | iOS Safari et Android Chrome ; reprise après onglet masqué |
| Langues | Hauteur naturelle, libellés non tronqués, labels accessibles traduits | EN, FR, ES-LATAM ; zoom texte |

Viser des cibles tactiles de 44 × 44 px pour les actions principales, un texte courant autour de 16 px et aucun défilement horizontal global. Ces valeurs sont des objectifs de design à tester, pas une certification d'accessibilité.

## Budget de performance

Objectifs CWV de référence : LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 au 75e percentile lorsque des données terrain représentatives sont disponibles. Ne pas présenter une mesure Lighthouse comme un INP terrain ni une garantie d'atteinte sur tous les appareils.

Avant le prototype : enregistrer une référence sur les pages actuelles avec viewport, navigateur, profil réseau/CPU et état de cache. Après : répéter les mêmes conditions au moins trois fois, conserver résultats et traces, examiner médiane et dispersion. Si le résultat varie trop, augmenter l'échantillon avant de conclure.

Le budget de kilo-octets/JS/GPU est à fixer après cette référence et l'essai d'animation. Conditions initiales indépendantes de ce chiffre :

- Pas de moteur 3D ou de séquence lourde requis pour rendre titre, CTA et poster.
- Pas de préchargement de toutes les vidéos ; médias secondaires différés et lecteurs existants conservés.
- Réserver les dimensions des images, lecteurs et blocs pour éviter les sauts.
- Une seule scène lourde active ; arrêter le travail hors écran et quand l'onglet est masqué.
- Préférer transforms/opacity ; éviter les recalculs de mise en page continus au scroll.
- En l'absence de WebGL ou avec réduction du mouvement : même contenu/action, posters et étapes fixes.
- Prévoir le comportement sans vidéo chargée et en réseau lent ; pas d'écran vide en attendant l'effet.

## Recette minimale du prototype

1. 320 px, 390 px, tablette et desktop : lecture, navigation, filtres, comparaison et liens.
2. Émulation réseau/CPU reproductible ; puis appareil réel si disponible. Indiquer explicitement quand ce dernier manque.
3. Aller/retour de scroll, changement d'orientation, retour de navigation, onglet masqué, reduced motion.
4. Vidéo/image en échec et contexte GPU indisponible : vérifier le repli.
5. Avant/après : poster/LCP, stabilité/CLS, traces des interactions, volume transféré avant lecture et première lecture.
6. SEO : contenu sémantique et liens accessibles sans accomplir l'animation.

V3 échoue si le concept n'est beau que sur desktop, rend les actions difficiles sur téléphone, ou introduit une régression reproductible non résolue. Le compte rendu doit dire ce qui a été mesuré, sur quel appareil, et les limites restantes.
