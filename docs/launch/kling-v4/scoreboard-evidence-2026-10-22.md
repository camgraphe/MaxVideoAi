# Kling V4 — dossier de notation par critère

État au **22 octobre 2026** : préparation terminée, **aucune note publiée**. Les onze critères du scoreboard existant sont couverts dans [`data/benchmarks/kling-v4-evidence.v1.json`](../../../data/benchmarks/kling-v4-evidence.v1.json), chacun avec ses sources, ce que celles-ci établissent et les observations précises encore nécessaires. Le fichier n'est pas consommé par l'interface. Aucune ligne vide, note zéro, valeur empruntée à Kling 3 ou placeholder public n'est ajouté.

## Résultat de la recherche

Les tableaux audio [Artificial Analysis T2V v2.1](https://artificialanalysis.ai/video/leaderboard/text-to-video) et [I2V v1.1](https://artificialanalysis.ai/video/leaderboard/image-to-video), consultés le 22 octobre, ne contiennent pas de ligne Kling V4/4.0 parmi leurs 29 et 24 modèles. Les deux tableaux [Arena T2V](https://arena.ai/leaderboard/video/text-to-video) et [I2V](https://arena.ai/leaderboard/video/image-to-video) affichent chacun 48 lignes et une date de données du 21 septembre ; aucun Kling V4 n'y figure. Ce relevé ne prétend pas couvrir toutes les évaluations privées ou tous les filtres. Une future position Elo devra rester un contexte de préférence globale, sans conversion en notes par critère.

Le [compte rendu de Johnson Sheng](https://kling.ai/blog/Kling4-Hands-On-Review-JohnsonSheng?tab=video-creation), publié le 2 octobre par Kling, est un témoignage de créateur invité sur la bêta complète : action et continuité d'accessoire rapportées, avec une réserve sur une action finale. Il ne fournit pas de journal exhaustif des essais. Nous avons lu ce texte, sans inspecter les vidéos et leur son ; il ne devient donc pas une observation MaxVideoAI. Le [test de Tim Simmons du 1er octobre](https://theoreticallymedia.com/blog/kling-4-early-look-gemini-4-argon-ideogram-4-5-eleven-v4/) porte explicitement sur **Flash**, ce qui l'exclut de la notation du modèle complet.

La [présentation fal](https://fal.ai/kling-4) précise que ses démonstrations viennent de Kling et ne sont pas des résultats de l'API fal. Les quatre [contrats capturés et hachés](provider-refresh-2026-10-22.md) décrivent les paramètres acceptés en préparation ; ils n'établissent ni la qualité d'un résultat ni sa fiabilité. Les annonces de la plateforme Kling ne remplacent pas le contrat propre à fal : pas de déduction de qualité à partir de « 4 », du 1080p, d'une liste de références ou d'un champ multi-shot.

## Grille prête pour les originaux

La méthode reste [`benchmark-methodology.v1.json`](../../../data/benchmarks/benchmark-methodology.v1.json), version 1.1.0, avec ses huit prompts anglais existants. Les notes futures utilisent ses ancres 0–10 ; la moyenne globale conserve **fidélité + mouvement + cohérence**, arrondie à une décimale. Pour cette nouvelle entrée, les trois doivent être effectivement évalués avant publication d'une moyenne.

| Critère existant | Observation à consigner avant notation |
| --- | --- |
| Respect du prompt | Exigences déclarées avant le rendu ; actions réalisées, omises, inversées ou inventées, avec timecodes. |
| Qualité visuelle | Original à sa résolution réelle ; détail, matières, lumière, contours et artefacts dans le mouvement. |
| Réalisme du mouvement | Contacts, inertie, accélérations, direction et caméra sur toute l'action, y compris la fin. |
| Cohérence temporelle | Identités, vêtements, objets et géométrie avant/après les occultations et chaque coupe. |
| Fidélité humaine | Visages, mains, membres et interactions réellement visibles ; une main cachée n'est pas une réussite. |
| Lisibilité du texte | Comparaison caractère par caractère avec le texte demandé et stabilité pendant son exposition. |
| Audio et synchronisation | Bande-son originale, texte réellement prononcé, bouche visible, dérive mesurée lorsque possible. |
| Montage multi-shot | Tableau de plans exécuté, durées et coupes constatées ; continuité et ordre dans le fichier fournisseur non remonté. |
| Contrôlabilité | Résultats séparés pour caméra, première/dernière image, références et édition ; une option acceptée ne prouve pas son effet. |
| Vitesse et stabilité | Journal complet des tentatives et étapes horodatées. Une importation fal n'est pas une génération livrée par l'application. |
| Rapport qualité/prix | Devis client actif, coût réellement facturé, essais refusés et secondes utilisables ; le tarif normal +30 % préparé reste distinct. |

Le JSON précise pour chaque ligne les IDs du prompt pack, les sources, les pièces manquantes et la méthode d'observation. Il contient également les exigences de provenance à conserver : endpoint exact, identifiant fournisseur, prompt, paramètres, références ordonnées, original et hash, métadonnées réelles, coûts, évaluateur et second avis.

## Réutilisation du film et passage à la publication

1. Récupérer les **originaux complets**, leurs prompts et toutes les tentatives du film, y compris celles écartées. Le montage YouTube et les héros sélectionnés restent des démonstrations éditoriales ; ils ne remplacent pas les originaux pour évaluer le modèle.
2. Relier chaque scène aux critères qu'elle rend réellement observables. Si le film ne contient pas de texte lisible ou de bouche parlant à l'image, ces critères restent sans note. Les autres observations peuvent former une appréciation éditoriale explicitement limitée.
3. Pour une série contrôlée, réutiliser les huit prompts du propriétaire existant et enregistrer paramètres, répétitions et exclusions avant exécution. **Ce dossier n'autorise aucune dépense ni génération supplémentaire.** Les paramètres 720p/1080p, les modes et les versions ne doivent pas être mélangés comme s'ils étaient équivalents.
4. Visionner à vitesse normale avec le son, examiner ensuite les passages suspects, consigner les timecodes et faire relire. Justifier les notes avec les ancres existantes ; conserver les désaccords et ne pas fabriquer de précision. Agréger les répétitions d'un même prompt avant la moyenne des prompts pour ne pas surpondérer une scène.
5. Écrire les seules notes défendables dans `data/benchmarks/engine-scores.v1.json`, avec la date et le dossier de preuves. Une estimation fondée sur des scènes non contrôlées reçoit la mention éditoriale déjà gérée par le produit. Les critères non observés restent non publiés ; aucune moyenne partielle ne doit présenter Kling V4 comme entièrement évalué.
6. Conserver le propriétaire de latence existant : fenêtre de 30 jours, au moins 30 travaux terminés et 5 utilisateurs distincts. Un petit lot admin peut documenter une qualification, pas satisfaire artificiellement ce seuil ni fournir un P90 représentatif.

Le prix suit [la préparation commerciale](pricing-plan.md) et son calcul canonique. Aucun score de valeur ne découle automatiquement du tarif affiché. Aucun fichier de registry, navigation, cartes marketing, tarif actif ou média n'est modifié par ce dossier.
