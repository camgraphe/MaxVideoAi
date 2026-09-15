# Pilote accueil — scénario proposé

Statut : scénario initial conservé comme référence de contenu. La proposition actuelle est [la composition 01](review/home.html), décrite dans [home-composition.md](home-composition.md). Elle place le MCP après la preuve d’ouverture et remplace le comparatif supposé de sorties identiques par un sélecteur de rendus réels. Le tableau de correspondance avec les sections existantes ci-dessous reste un garde-fou pour la future migration.

Retour d'Adrien : mettre en avant la création à partir d'un site ou projet avec Codex/Claude via MCP ; calibrer le Studio selon sa disponibilité ; placer les logos avec une fonction précise. Voir [récit produit](product-narrative.md). Proposition : remonter la séquence 5 juste après la transformation, puis montrer comparaison et exemples. L'ordre complet reste à juger sur storyboard. Ajouter une page d'exemples au pilote de généralisation à la lumière des premiers relevés GSC.

Complément demandé par Adrien : inclure une proposition de construction/déconstruction au scroll. Le scénario précis et les références sont dans [La scène se construit](motion-signature.md). Ce complément pousse la séquence 2 au-delà d'un simple fondu.

## Fil conducteur recommandé

**Une idée, plusieurs façons de la créer.** Faire ressentir l'étendue du produit à travers une création suivie, puis montrer comment comparer et réutiliser. La démonstration doit provenir d'un véritable parcours MaxVideoAI vérifié ; sa disponibilité est une dépendance à résoudre avant production des assets.

Alternative si la continuité de création ne convainc pas : un accueil organisé autour de trois intentions (film, publicité produit, image éditoriale), chacune révélant ses modèles et outils. Moins narratif, plus direct pour des visiteurs qui savent ce qu'ils veulent. Recommandation : parcours suivi pour la signature, accès direct au catalogue pour les visiteurs pressés.

## Parcours proposé

| Séquence | Ce que voit/fait le visiteur | Texte utile et action | Composition et mouvement |
|---|---|---|---|
| 1 — Résultat | Un rendu réel donne immédiatement le niveau du produit | Titre de travail « Une idée. À vous de lui donner vie. » ; phrase explicite « Créez des vidéos et des images avec plusieurs modèles d'IA. Consultez le prix avant de générer. » ; Créer / Voir les exemples | Média large, page ouverte, pas de panneau autour du lecteur. Titre et poster visibles immédiatement, sans animation d'entrée bloquante. |
| 2 — Transformation | La même création passe de référence à angle choisi puis à vidéo | Trois légendes courtes : Préparez / Cadrez / Animez ; liens vers les fonctions existantes | Sur grand écran, média sticky et étapes qui se succèdent au scroll. Transitions par fondu ou déplacement discret ; défilement natif, remontée cohérente. |
| 3 — Choix du modèle | Deux sorties d'un même brief, si des exemples réellement comparables existent | « Même intention. Deux interprétations. » ; identité, paramètres et coût de chaque résultat ; Comparer | Deux médias alignés, commandes explicites. Aucun comparatif fabriqué à partir d'images sans provenance. Pas besoin d'animer cette section au scroll. |
| 4 — Exploration | Une sélection de rendus mène vers des exemples réutilisables | Un titre, une catégorie, un nom de modèle ; Voir le prompt et les réglages | Galerie ouverte. Preview à l'intention/visibilité via les lecteurs existants ; pas de lecture simultanée de tout le mur. |
| 5 — Entrée dans le produit | Le visiteur comprend qu'il peut créer dans l'app ou depuis un assistant compatible | Ouvrir l'app ; accès aux intégrations existantes, capacités décrites exactement | Composition simple, médias réels de l'interface. Éviter une imitation de chat ou un montage inventé. |
| 6 — Décision et approfondissement | Prix, limites, réponses utiles et prochaine action | Explication courte du paiement à l'usage ; accès tarifs, guides et FAQ pertinente ; Commencer | Surface calme, détails structurés, contenu indexable. Aucune suppression de réponse utile sans destination/documentation. |

Le mouvement principal est limité à la transformation. La galerie apporte une seconde interaction, légère. L'ensemble n'est pas un film imposé au visiteur : navigation et accès au produit restent disponibles.

## Correspondance avec l'accueil existant

Source : `frontend/app/(localized)/[locale]/(marketing)/(home)/page.tsx`, base `bdd544e9f`.

| Sections actuelles | Destination proposée | À préserver |
|---|---|---|
| HomeHero | Séquence 1 | Entrées génération/exemples, poster prioritaire, preuve réelle et coût vérifiable |
| ReferenceWorkflow + AiVideoToolbox | Séquence 2 | Bénéfices, fonctions et liens exacts ; le catalogue d'outils reste accessible |
| ShotTypeEngineSelector | Entrée de sélection à intégrer aux séquences 3/4 | Liens vers les guides par usage, sans disparition silencieuse |
| ComparisonPreview | Séquence 3 | Comparaisons existantes et identités des modèles |
| RealExamplesPreview | Séquence 4 | Provenance, prompts et réutilisation |
| HomeAssistantWorkflow | Séquence 5 | Liens réels Claude/ChatGPT/Codex et limites des capacités |
| TransparentPricingBlock | Séquence 6 | Sémantique des prix, destination tarifs |
| WorkflowSeoSummary + HomeFaq | Séquence 6 et liens d'approfondissement | Réponses utiles, termes explicites, schémas cohérents avec le visible |

Il s'agit d'une recomposition, pas d'une autorisation de supprimer ces sections et leur contenu en bloc. Un relevé paragraphe par paragraphe précède la migration.

## Grammaire anti-boîtes

- Zéro conteneur décoratif global autour d'un autre conteneur décoratif global.
- Une bordure peut délimiter un champ, un lecteur ou une sélection ; pas chaque paragraphe.
- Les titres, l'alignement et l'espace séparent les sections.
- Une ligne de métadonnées accompagne le média ; pas cinq petits badges pour cinq mots.
- Les visuels prouvent une fonction ; un média purement décoratif doit justifier son coût.
- Les caractéristiques restent lisibles sans hover. Aucun prix essentiel caché dans une animation.
- Les grandes surfaces de lecture peuvent être claires ; les tons et accents restent à proposer à V2.

## Contrat mobile et mouvement

Premier écran : promesse courte, actions, poster. Conserver l'ordre génération/exemples → média → liens secondaires imposé par les contrats existants.

La séquence sticky desktop devient des étapes verticales simples sur mobile, avec posters et lecture volontaire. Pas de plusieurs écrans vides pour simuler un effet desktop. À 320/390 px : aucun contrôle coupé, aucune dépendance au survol, pas de scroll horizontal global.

Avec réduction du mouvement : les mêmes contenus restent accessibles, étapes statiques, pas d'interpolation imposée. Le scroll garde son comportement natif. En cas d'échec vidéo : poster et accès au détail conservés. Pause quand hors écran. La préférence audio est respectée.

Un scrub vidéo image par image n'est pas retenu par défaut : décodage, seek, poids et comportement mobile doivent être éprouvés dans un essai borné. Commencer par animer le cadre et les transitions de médias ; comparer avec le scrub seulement s'il apporte une valeur visible.

## Assets : sélection et preuves à réunir

Sources disponibles à inspecter : `frontend/config/public-video-sources.json`, manifeste des renditions, sélection du hero dans les builders home, contenus et démos des outils Angle/Character Builder. Les IDs `seedance-2-5-model-demo` et `minimax-h3-model-demo` existent dans le registre, mais leur existence ne prouve ni leur adéquation artistique ni une continuité entre étapes.

Pour chaque asset retenu : sujet, modèle et version, mode, paramètres, prompt publiable, original, poster, derivative, droits, coût documenté, résultat de contrôle HTTP/Range. Statuts : candidat → vu → provenance vérifiée → approuvé visuellement → prêt pour affichage.

Une chaîne référence/angle/vidéo doit montrer le même sujet et un parcours réellement reproductible. Si elle manque, préparer le brief et le coût de production avant toute nouvelle génération payante. Les concepts précédents ne remplissent pas ce rôle.

## Validation V1

Le fil de création suivie a reçu un accord de direction : ne pas redemander de choisir entre ce fil et trois intentions. Finaliser maintenant la place du MCP, le scénario démontré et la hiérarchie de page. Palette, médias définitifs et bibliothèque d'animation restent ouverts. Après V1 : références visuelles et états clés, puis validation V2 avant construction du prototype.
