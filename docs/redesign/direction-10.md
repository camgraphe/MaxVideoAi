# Direction 10 — Motion, with intent

Version active : **D53–D55 / app et Connect distincts** dans `review/direction-10/home-app-connect.png`. La version D52 est conservée dans `home-diversity.png`. Les paragraphes de première composition ci-dessous restent historiques lorsqu’ils mentionnent les sneakers sur l’accueil.

14 septembre 2026. Reprise explicitement demandée par Adrien, puis « ok go » pour préparer le lot visuel. **Proposition à examiner ; aucune direction finale validée.**

## Le lot à juger

Une direction commune pour l’accueil anglais desktop/mobile, la synthèse Compare et un extrait de sa future page, puis le storyboard d’un nouveau Website Move. Les images ImageGen sont des études de composition : leurs pixels ne sont ni des captures du produit ni des preuves supplémentaires de qualité d’un modèle. Les originaux restent dans la revue 09.

Les rôles des références restent ceux du brief : précision et profondeur d’Arrakis, démonstration par tâches de LocalCan, présence des créations de Pryzm. Les captures locales du 10 septembre ont été examinées ; aucun nouvel audit des sites vivants ou de leurs performances n’est revendiqué.

## Parti pris proposé

Le film ouvre la page et apporte ses couleurs ; les contrôles restent calmes. Fond olive presque noir, passage ivoire pour la décision Compare, typographie Geist fine mais lisible, bronze de l’app pour l’action. Une composition ouverte remplace les cadres imbriqués. Les modèles, le prix et la création avec un assistant se comprennent en texte, sans dépendre d’un effet.

| Chapitre | Rôle et contenu EN | Destination propriétaire |
|---|---|---|
| Ouverture | AI video. Pay as you go. / Create a video / Explore examples. Film Prism run dominant, produits en contrepoint. | /app, /examples |
| Modèles + Compare | Choose with evidence. Marques réelles, synthèse de trois critères, détail explicite. | /models, /ai-video-engines, /ai-video-engines/kling-3-pro-vs-seedance-2-5 |
| Références + Connect | Your references. Your next scene. Sources du sac, plan, revue du prix et résultat ; workflow illustré. | /mcp, guides /integrations/claude, /integrations/codex, /integrations/chatgpt |
| Usages / exemples | Made for the way you create. Cinéma, publicité produit et usages sociaux. | /examples et familles existantes |
| Website Move | Make your product page move. Nouvelle étude casque audio, explicitement conceptuelle. | Démonstration dans le chapitre usages ; /mcp pour le parcours assistant |
| PAYG | See the price. Then make the shot. Réglages et revue du prix avant génération, aucun montant illustratif inventé. | /pricing, /pay-as-you-go-ai-video-generator |
| FAQ / navigation | Questions paiement, modèles, références, assistant ; accès aux outils et guides. | Propriétaires existants ; Angle secondaire |

L’ordre est une proposition, pas une obligation SEO de conserver chaque bloc. Aucune URL n’est modifiée. Le catalogue illustré n’est pas présenté comme exhaustif. Les labels des médias conservent le modèle de génération, sans affirmer une vérification commerciale du catalogue au 14 septembre.

## États du mouvement à fabriquer après choix

| Scène | Entrée | Transition | Arrivée | Mobile / mouvement réduit |
|---|---|---|---|---|
| Ouverture | Titre, deux actions, poster et géométrie immédiatement visibles. | Le cadre cinéma s’élargit légèrement ; les légendes restent fixes. | Film principal et accès aux autres créations stabilisés. | Actions puis poster puis liens complémentaires. Lecture volontaire, aucun scrub obligatoire. |
| Sneaker produit | Composants du film Kling Omni du 21 juin. | Assemblage natif du film, sans simuler une physique interactive. | Chaussure complète lisible ; sortie de scène stable. | Lecture simple à la demande ; pas de défilement bloqué. Le choix d’extrait reste à valider. |
| Références / Connect | Les deux références d’origine sont reconnaissables. | Sources rapprochées du plan ; étape de revue du prix explicitement distincte. | Résultat au premier plan, sources toujours retrouvables. | Étapes dans le flux ou sélection tactile ; état statique complet. |
| Compare | Modèles et chiffres définitifs déjà lisibles. | L’accent de lecture passe au critère choisi ; les valeurs ne comptent pas depuis zéro. | Une différence à la fois, détail et méthode accessibles. | Libellé sur une ligne dédiée si nécessaire ; deux colonnes numériques visibles. |
| Website Move | Casque et texte de la page existent déjà. | Un mouvement de caméra transforme la proximité du produit et ouvre la composition. | Produit entier dans sa page, titre et action immédiatement compréhensibles. | Court film volontaire, composition finale comme poster, pas d’épinglage. |

Ces états sont des storyboards, pas des animations réalisées ou mesurées.

## Compare — le même système en synthèse et en détail

Le comparatif pilote reste Kling 3 Pro / Seedance 2.5. **Ne pas utiliser les sneakers pour illustrer ce duel** : elles viennent de Kling Omni, Happy Horse et Seedance 2.0, et leurs conditions ne constituent pas un benchmark contrôlé.

Source vérifiée dans ce worktree : `data/benchmarks/engine-scores.v1.json`, commit de base `2e32362d8`. Mapping des labels : `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-scorecard.ts`.

| Critère | Champ source | Kling 3 Pro | Seedance 2.5 |
|---|---|---:|---:|
| Prompt adherence | fidelity | 8.6 | 9.1 |
| Visual quality | visualQuality | 8.4 | 9.2 |
| Motion realism | motion | 8.4 | 9.2 |
| Temporal consistency | consistency | 8.0 | 9.0 |
| Controllability | controllability | 8.7 | 9.0 |

Évaluations éditoriales sur 10 ; dates source : 25 avril 2026 pour Kling, 8 août 2026 pour Seedance. Aucune note, moyenne, pondération ou méthode modifiée. Les dates ne sont pas celles d’un nouveau test réalisé aujourd’hui.

Présentation proposée : points appariés sur une même règle 0–10, valeurs exactes en colonnes fixes ; pas d’axe tronqué qui grossit l’écart. Trois critères à l’accueil ; cinq montrés dans l’extrait détaillé, autres informations conservées dans les groupes à développer :
- **Image & motion** : fidélité, qualité visuelle, mouvement, cohérence temporelle, anatomie.
- **Direction & audio** : contrôlabilité, texte, séquençage, audio/lip sync lorsque pertinent.
- **Workflow & cost** : vitesse/stabilité, capacités exactes, paramètres et prix comparables.

Il s’agit d’un regroupement éditorial proposé. La note « pricing » ne remplace pas un prix commercial. Les réglages 1080p/720p signalés en revue 09 restent à auditer avant tout montant ou avantage tarifaire dans la nouvelle UI. Le détail doit afficher les paramètres réellement retenus. Pas de badge « meilleur modèle » déduit de trois valeurs.

## Website Move — proposition « Sound becomes space »

**Sujet nouveau à valider :** casque audio circum-aural graphite, métal cuivre discret et coussinets mats. Produit fictif destiné à une démonstration, sans reprendre une marque réelle. Le casque exploratoire de la planche 08 n’est pas une validation de ce nouveau sujet ni une source finale.

**Mécanisme :** un plan macro révèle la matière d’une oreillette ; la caméra recule et le casque pivote légèrement. Son arceau libère un espace dans lequel la composition de la page devient lisible. La vidéo porte la lumière, les reflets et le mouvement de produit ; le titre et l’action restent du vrai HTML dans l’intégration future.

**Trois états :**
1. **Material** : gros plan du coussinet et du métal, identification du produit et commande de lecture déjà disponibles.
2. **Reveal** : recul/pivot mesuré ; le même casque devient entier, l’espace négatif accueille le titre. Aucune explosion de pièces ni « ordinateur qui s’ouvre ».
3. **Page** : cadrage final stable avec casque, titre « Give your product a presence. » et action ; on comprend que le film enrichit une page utilisable.

Le macro n’est pas un écran d’attente : le poster de la composition finale est proposé pour le chargement initial et le mouvement réduit. Le film optionnel déroule ensuite la scène. Sur mobile, titre et action précèdent le film dans le flux. Pas de cadre de navigateur ni de slider avant/après imposés.

**Pourquoi ce sujet :** la courbe donne une transformation de composition lisible ; les matériaux rendent visible l’intérêt d’un film, tout en différenciant Website Move de la sneaker publicitaire et du sac à références.

**Ce qu’il faudra produire si retenu :** design produit cohérent, vue finale/poster, macro d’entrée, séquence courte avec cadrages desktop/mobile, contrôle des reflets et de l’identité, puis préparation et mesures dans le contrat média. La planche illustre cette intention ; aucun film, coût, devis ou résultat de performance n’est présenté comme acquis.

## Sources et limites

- D47–D50 restent prioritaires : refonte de toutes les familles, Compare complet, montre retirée, aucun Short complet ni présentateur parlant.
- Prism run : `28979ee9-180c-49ab-9f0b-573dfa64bfe6`, MiniMax H3 Max.
- Sneaker prioritaire : `job_7c357b63-138b-4d14-8798-c5db4f406894`, Kling 3.0 Omni Pro, source privée conservée dans le compagnon local de la revue 09.
- Sac : `2b7d8e08-fd0f-4232-acc3-4157b2142152`, images et plans utiles C08 ; le voyageur porte déjà le sac dans sa référence. Ne pas raconter une insertion absente des sources.
- Les captures des trois sites sont des références internes. Les logos raster des planches restent à remplacer par les originaux dans toute intégration.
- ImageGen intégré utilisé pour les études de composition ; pas d’appel à une API image payante de secours, pas de dépense MaxVideoAI, pas de publication.
- Aucun changement frontend, aucune performance ou conversion mesurée. SEO/GEO, localisations FR puis es-419, Clarity/GSC/GA4, consentement et Zoho restent dans la recette d’intégration.

Les prompts exacts sont conservés sous `review/direction-10/prompts/`. La revue et les limites visuelles du résultat sont complétées après génération.


## Revue visuelle et défauts résiduels

La planche Compare restitue les dix valeurs relues dans la source et décline les mêmes repères sur mobile. Les positions des points générés ne sont pas assez exactes pour servir de graphique quantitatif ; la revue donne un tableau HTML des valeurs. L’intégration devra calculer les positions et rétablir les logos originaux.

La première planche d’accueil a inventé une scène de sac et mal nommé une référence. Une correction ciblée a été demandée avec les deux références originales et le plan C08 joints. Le premier appel de correction a échoué sur erreur réseau ; relance avec les mêmes instructions et les fichiers conservés dans le worktree.

Website Move exprime le passage détail → objet → page, mais la planche ajoute un timecode `01:14` non demandé et la marque MaxVideoAI sur le casque. Le premier est à ignorer ; la seconde ne doit pas laisser penser que MaxVideoAI vend ce produit. Le concept d’intégration devra distinguer le site fictif de démonstration de la plateforme. Le libellé « Poster already available » est un état futur envisagé, pas une préparation média accomplie.

Le support HTML ne fabrique aucun des effets du site : il permet seulement de parcourir les images à leur résolution native et de consulter les sources. Vérification du support : affichage desktop, table de provenance ouverte à 390 × 844, absence de débordement horizontal à cette largeur. Ce contrôle n’est pas une recette de la future homepage mobile.

### État livré après correction

Après deux erreurs réseau sur la correction élargie, la correction ciblée à trois images a abouti. `home.png` est la version active ; `home-first-pass.png` reste historique. Le bloc sac distingue désormais la référence produit du plan existant. Les deux références originales restent disponibles ensemble dans le support HTML.

La planche Compare détaillée prime sur les axes séparés encore présents dans le raster de l’accueil : le raccord graphique est explicitement à reporter dans la prochaine maquette. La FAQ desktop omise par ImageGen et le libellé « Assistant support » dans les exemples mobile restent également à corriger (cible : « Cinematic scenes »). Ces limites sont visibles dans la revue, sans les masquer comme détails déjà implémentés.

Le lot est sauvegardé dans le worktree et les prompts exacts sont conservés. Aucun commit, push ou déploiement réalisé dans cette reprise.

## Révision D52 — étendue créative et rythme desktop

Le nouveau raster remplace les sneakers et les répétitions du sac par la danse (`ripple-dance`), le personnage animé (`bouquet`), le récit au terminal (`last-bus`) et le paysage (`salt-valley`). La course reste le plan principal. Tous viennent de la sélection 09 : les modèles et formats d’origine n’ont pas changé. Le bus reste une petite vignette de récit, pas un grand hero ; le lapin reste un média carré, sans revendication 9:16. Ces cadres ne deviennent pas un benchmark entre modèles.

Le sac apparaît seulement dans Références / Connect ; le casque seulement dans Website Move. PAYG se termine en texte. Sur desktop, références et casque placent l’image à gauche ; la galerie met son titre au-dessus. L’objectif est un rythme de lecture plus composé, sans gain d’efficacité chiffré revendiqué.

ImageGen a d’abord altéré Visual quality de Kling en 8.6 et nommé les marques mobiles comme des usages. Une correction ciblée a rétabli 8.4 et Kling / Seedance / MiniMax. Les valeurs source ne sont jamais éditées. Le système Compare détaillé reste la cible de la géométrie et du futur raccord ; FAQ desktop encore à ajouter dans la prochaine maquette. Les deux prompts exacts sont conservés.

## Révision D53–D55 — montrer le produit et séparer son canal d’accès

Références répond à « que puis-je créer à partir de mes images ? », avec action `Create in MaxVideoAI` vers `/app`. Le chapitre inclut désormais une vue réelle du workspace desktop/mobile et un petit exemple sac → résultat séparé de la scène présente dans l’interface. Connect répond à « depuis où puis-je utiliser MaxVideoAI ? », avec action `Choose your assistant` vers `/mcp`, après la galerie. Il montre un court brief de film, le choix du modèle, l’approbation du prix puis la génération ; aucune capture fictive de conversation.

OpenClaw et n8n sont traités comme disponibles dans la cible graphique sur instruction explicite d’Adrien. Observation actuelle du hub public (14 septembre) : encore en validation preview. Claude, ChatGPT et Codex sont présentés disponibles. L’hypothèse future reste à vérifier avant mise en ligne, sans la confondre avec les capacités validées aujourd’hui.

Les captures exactes de `/app` (1440 × 1024 et 390 × 844) sont en mode visiteur : choix de modèle, exemple vidéo, références désactivées et prompt sont visibles. Elles ne prouvent pas une génération du sac. Les captures sont fournies dans la revue sans retouche ; la représentation ImageGen réserve l’emplacement mais ne doit pas devenir la source des pixels de l’interface. Préparer un vrai état connecté avant publication, notamment pour éviter les mentions de connexion, prix indisponible et exemples non alignés.

La FAQ a disparu du raster malgré le brief ; conserver sa nécessité desktop/mobile. Pas de nouvelle application construite dans ce lot : revue locale, captures et planches uniquement. Aucun changement définitif du site en ligne.


### D56 — Bloc app recomposé

La composition D55 est rejetée. Voir `review/direction-10/app-devices.png` : ordinateur horizontal dominant, téléphone superposé à droite, texte indépendant à gauche. Aucun sac sous les appareils. Proposition isolée non validée ; harmoniser la typographie et dessiner le mobile (téléphone seul). Les captures source sont des JPEG natifs : desktop 1428 × 1015, mobile 378 × 818, pour des viewports demandés de 1440 × 1024 et 390 × 844.
