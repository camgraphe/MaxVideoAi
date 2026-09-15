# Recette — proposition 03

10 septembre 2026. Revue locale, pas recette de mise en production.

## Contrôles exécutés

- Génération des trois HTML FR / EN / es-419 depuis le propriétaire actuel des cinq vidéos et les questions des dictionnaires.
- Syntaxe des modules de génération et d’interaction : valide.
- Cinq tests du lecteur : succès. Intention de lecture, pause manuelle, visibilité, fenêtres, fallback original, erreurs périmées, profil mobile et déplacement du lecteur entre panneaux.
- Analyse HTML des trois langues : un H1, aucun identifiant dupliqué, sources locales référencées présentes.
- Inventaire anglais : **44 destinations distinctes dans le contenu principal**. Les 40 destinations de départ restent accessibles : 35 dans le principal, quatre modèles secondaires et Startup Fame dans le pied de page.
- Chrome desktop : changement MiniMax → Seedance observé, vidéo active avec rendition desktop et coût correspondant de 1,46 USD ; une seule vidéo montée. Aucun débordement horizontal détecté dans les lectures DOM de l’accueil FR et EN.
- Angle : défilement natif observé 01 → 02 → 04, retour 04 → 02. Choix direct Contrechamp également observé. Les images utilisées sont les quatre sorties réelles du dialogue.
- Mouvement réduit via le bouton de revue : bloc Angle en position relative, hauteur du parcours égale à celle de son contenu (environ 710 px dans la fenêtre testée), vidéo en pause.
- Fenêtre du prix : texte explicatif présent, Échap ferme la fenêtre, focus rendu au bouton d’information.
- Capture Claude : ouverture, affichage et fermeture de la fenêtre d’agrandissement vérifiés.
- Aperçus responsive inspectés visuellement : accueil FR et es LATAM à 320 px, guides FR à 390 px, MCP es LATAM à 768 px. Introduction et typographie corrigées après la première inspection à 320 px.
- Revue des destinations localisées et des textes LATAM ; pas de copie de prix espagnole « costes » ou « vídeos » ajoutée.

## Médias et poids du code

Les fichiers servis utilisent une police locale existante et les médias déjà disponibles. Aucune bibliothèque d’animation ou runtime 3D ajouté.

- CSS : environ 33,6 Ko bruts, 7,8 Ko gzip.
- Interactions : environ 10 Ko bruts, 3,3 Ko gzip.
- Lecteur : environ 4,2 Ko bruts, 1,5 Ko gzip.
- Poster prioritaire MiniMax : copies existantes de 29 196 octets desktop et 12 640 octets mobile.

Ces tailles sont des mesures de fichiers, **pas des mesures de transfert réseau, de LCP ou de performance utilisateur**. Le serveur Python de revue n’est pas le serveur Next.js de production.

## Limites explicites

Les aperçus utilisent une iframe. Les contrôles mobiles ont été examinés visuellement ; le lecteur mobile est couvert par son test unitaire. Cette revue ne constitue pas une session tactile sur appareil réel, un test Safari ou une mesure de réseau mobile.

Aucune nouvelle mesure GSC, Clarity ou GA4 réalisée pendant cette itération visuelle. Aucune affirmation de gain SEO, conversion ou Core Web Vitals. Le prototype est noindex et ne reproduit pas les balises et scripts de production.

La lecture du propriétaire éditorial des coûts ne vérifie pas un reçu de génération ni un devis actualisé. La capture Claude est une preuve publique préexistante ; aucune nouvelle exécution de génération MCP effectuée ici.

Avant intégration : validation artistique, choix éditorial des comparatifs actuels/anciens, reprise des propriétaires React de médias et des URLs responsive Angle, contrôle des balises/routes/locales, consentement et mesure, puis comparaison des performances dans des conditions identiques.

## Captures

Dossier ignoré du checkout principal : `output/redesign-composition-03-2026-09-10/`. Accueil FR à 320 px, guides à 390 px, accueil ES à 320 px, MCP ES à 768 px et scène Angle desktop. Les captures servent à la revue et ne sont pas publiées.
