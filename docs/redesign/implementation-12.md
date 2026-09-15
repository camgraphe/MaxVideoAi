# Passe réelle 12 — reconstruction marketing, 14 septembre 2026

## Direction active

D58–D59 priment : la passe 11 était trop proche du site existant et les fonds verts sont rejetés. La nouvelle base emploie du charbon neutre, du blanc cassé et du cuivre discret ; les créations apportent les couleurs. Travail local dans `codex/site-redesign`, sans push, fusion, déploiement ni connexion à la base de production.

## Changements visibles

- **Accueil** : ouverture avec grand titre, actions et film large sur desktop ; sur mobile, actions puis preuve vidéo. Sélecteur de modèles textuel, devis détaillable et quatre films publics présentés dans une galerie asymétrique : cinéma, danse, paysage et animation. Les cinq sources du lecteur initial, son poster critique et les prix calculés restent ceux du catalogue. Correction D60 : compteur modèles/fournisseurs retiré, dix marques affichées avec leurs logos et liens, sans Sora ; cinq colonnes desktop et deux sur mobile.
- **Création dans l’app** : chapitre distinct sur fond charbon, ordinateur et téléphone superposé sur desktop, téléphone seul sur mobile. Créer ou importer une référence est explicite ; accès vidéo, image et audio conservés. Les captures sont les vraies vues visiteur, encore en anglais.
- **Assistants** : chapitre autonome et séquence interactive idée → modèle → prix accepté → résultat. Cette séquence est identifiée comme illustrative, sans faux devis ni fausse génération. La même interaction remplace l’ancienne démonstration de montre sur la page MCP. Claude, ChatGPT et Codex restent les accès principaux ; OpenClaw/n8n sont mentionnés suivant la décision de lancement D54, sans modification des drapeaux de publication.
- **Modèles** : catalogue ouvert par une composition de films, recommandations séparées et navigation par usage. Fiches modèles avec titre et actions alignés à gauche, preuve et informations factuelles mises en valeur.
- **Comparateur** : introduction sombre et sélecteur clair sur desktop, empilement mobile. Deux colonnes lisibles, sélection famille/modèle, scores exacts et lien vers le détail ; les cercles superposés sont retirés. Le détail conserve les notes source, leurs explications et une échelle commune.
- **Tarifs** : hiérarchie éditoriale, principes de paiement présentés comme un récapitulatif, accès direct à la grille. Aucun prix, algorithme ni engagement commercial modifié.
- **Outils** : véritable vue de l’interface en ouverture et sections alternées sur desktop. L’illustration artificiellement floutée d’upscale est retirée.
- **Exemples et journal** : nouvelles ouvertures et composition plus ouverte. La galerie propose les quatre films publics si sa première page non filtrée n’a aucune donnée ; jamais de substitution sur une famille filtrée ou une pagination suivante. Les compteurs du sélecteur de modèles sont localisés avec leur singulier/pluriel ; les explications du comparateur parlent du résultat plutôt que de « page canonique ». Le journal FR/ES emploie des formulations plus naturelles, sans « still », « model hub » ou « sorties » dans ses catégories.
- **Navigation et mouvement** : styles limités au marketing, accès Assistants, menu mobile avec focus restauré à la fermeture, interactions natives et mouvement léger des sections sous le premier écran. Contenu visible sans JavaScript et préférence de réduction du mouvement respectée.

## Provenance des créations

`creative-films.ts` reprend uniquement les sources et posters explicitement publics de `review/reference-film-09/selection.json` : Prism Run, Ripple Dance, Salt Valley et Bouquet. Aucun média privé publié, aucune génération commandée. Ces films sont des lecteurs manuels sous le premier écran, avec couverture responsive et `preload="none"`, utilisant le propriétaire de lecture partagé. Prism Run n’a pas été substitué au média critique de l’accueil : cette substitution demanderait la préparation et la validation des dérivés avant publication.

## Vérification

- 187 tests ciblés réussis, aucun échec : accueil, architecture marketing, navigation/locales, SEO, lecteurs, comparateur, catalogue et assistants. La suite complémentaire MCP/exemples/médias a également passé ses 45 tests ; ces suites se recoupent et ne s’additionnent pas.
- TypeScript, lint frontend, exposition publique, parité des clés FR/ES, gardes SEO/liens publics : réussis.
- Contrôle navigateur desktop et mobile des accueils, catalogue, comparateur, tarifs, outils, galerie, journal, MCP et fiche Seedance 2.5 ES. Aucun débordement horizontal sur les vues mesurées. Menu ES ouvert/fermé, focus revenu à « Abrir menú » ; étape « Le prix » réellement sélectionnable dans le parcours assistant.
- Lecture manuelle de Prism Run vérifiée : passage à une image vidéo lisible et temps de lecture qui avance ; les trois autres lecteurs restent non chargés. Ce contrôle de comportement ne mesure pas les octets transférés ni les Core Web Vitals.
- Première compilation complète de cette passe réussie : 871 pages statiques, génération de sitemap et contrôles des cinq médias critiques/posters. Après les dernières corrections du sélecteur FR/ES, cinq tests ciblés ont été relancés avec succès ; la compilation finale est également réussie.
- Comparaison HTTP de 30 routes EN/FR/ES avec la base capturée avant refonte : mêmes statuts, canonicals, hreflang, robots et types de schémas. Un H1 par route, aucune erreur de parsing JSON-LD. Rapport local : `review/direction-10/qa/routes-pass-12.json`.

## Limites de la revue locale

Pas de `DATABASE_URL` ni de véritables identifiants d’authentification : parcours de génération, compte connecté et données live non validés. Les contenus longs des articles et de toutes les fiches modèles ne sont pas entièrement réécrits ; certaines fiches ES historiques emploient encore « vídeo ». Les preuves app localisées, raccords OpenClaw/n8n, recette Safari/iOS et comparaison de performance avant/après dans un environnement représentatif restent nécessaires avant toute publication. Les contrôles SEO locaux ne prouvent pas un gain de classement et ne couvrent pas chaque URL du site.

Les planches 09/10 et le bilan 11 restent conservés comme historique. La référence à examiner est désormais le vrai site local, pas les images de maquette.

## Corrections de revue — libellés vidéo

Les boutons des créations emploient désormais « Watch the video », « Voir la vidéo » et « Ver el video ». L’aperçu sur le port 3008 passe en mode développement pour appliquer rapidement les corrections successives ; les compilations réussies documentées ci-dessus précèdent ce changement de libellé.

## Correction de revue — menu proche de l’app

D61 : menu marketing transformé en panneau latéral avec tuiles Vidéo/Image/Audio, icônes des rubriques et réglages regroupés. Les liens localisés et sous-menus restent propriétaires de la configuration existante. 25 tests ciblés de navigation réussis, TypeScript et lint ciblé réussis, parité des clés FR/ES vérifiée. Contrôle navigateur à 876 px et 390 px : sous-menu Modèles ouvert, fermeture avec restauration du focus, libellés français et absence de débordement horizontal. Aperçu toujours en mode développement pour la revue.
