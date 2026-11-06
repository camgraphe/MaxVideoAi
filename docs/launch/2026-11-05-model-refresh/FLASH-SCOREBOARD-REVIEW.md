# Kling 4.0 Flash — grille éditoriale du 6 novembre 2026

La revue complète remplace la mise en attente du lancement. Le propriétaire
`data/benchmarks/engine-scores.v1.json` contient les onze notes Flash ; le dossier
`data/benchmarks/kling-v4-flash-evidence.v1.json` conserve justification, confiance,
sources et limites pour chacune. La mention d'estimation éditoriale existante
accompagne les valeurs dans le benchmark, les comparatifs et le sélecteur App.

| Critère | Note /10 | Confiance |
| --- | ---: | --- |
| Respect du prompt | 8,3 | Moyenne |
| Qualité visuelle | 8,7 | Moyenne |
| Mouvement | 8,1 | Faible |
| Cohérence temporelle | 8,6 | Moyenne |
| Fidélité humaine | 8,3 | Moyenne |
| Lisibilité du texte | 8,2 | Faible |
| Audio et synchronisation | 7,8 | Faible |
| Montage multi-shot | 8,6 | Moyenne |
| Contrôlabilité | 8,0 | Moyenne |
| Vitesse et stabilité | 7,8 | Faible |
| Rapport qualité/prix | 8,8 | Moyenne |

**Global : 8,3/10**, avec la formule existante : moyenne de 8,3, 8,1 et 8,6,
arrondie à une décimale. Les huit autres critères, dont le texte et le prix, ne
changent pas cette formule. Aucun critère de cette grille n'est laissé vide ou à zéro.

## Éléments observés

Les six sorties originales B1/B2/B3/V1/V2/V3, leurs prompts, sources, feuilles
de contact, transcriptions existantes et reçus sont conservés. La revue retient
les écarts : fin de B1 de dos, tir/collapse de B2 insuffisamment établis,
physique du saut de B3 peu documentée, possibles écarts sonores signalés seulement
par l'ASR. L'identité des références I1/V1 est vérifiée dans V2/V3. Une lecture
technique réussie ne devient pas une mesure de mouvement ou de synchronisation.

Un septième rendu natif ciblé a été approuvé à **0,62 USD**, exécuté une fois,
payé et enregistré dans la bibliothèque : T1, 5 s, 720p, 16:9. Les six images
échantillonnées de son premier plan affichent exactement **SECTOR 9 / EVACUATE**.
La coupe est détectée à 2,041667 s ; la dernière image montre la porte fermée.
Le harnais devient rouge au lieu de l'orange demandé et davantage de personnes
restent derrière l'officier. Prompt, devis, job, prix, réglages, hash et observations
sont consignés dans `flash-text-score-sample.json`. Ce test de grandes capitales
fixes ne démontre pas la qualité des petits textes ou d'autres langues.

## Sources externes confrontées aux relevés

- [Tim Simmons, 1er octobre](https://theoreticallymedia.com/blog/kling-4-early-look-gemini-4-argon-ideogram-4-5-eleven-v4/) : essai de première main explicitement Flash, avec améliorations rapportées et écarts d'action/performance. Son interface de bêta n'établit pas les contrôles de l'API fal actuelle.
- [SeedVideo AI, 4 novembre](https://www.seeddance.io/blog/kling-4-0-flash-guide) : huit sorties Flash annoncées, six texte et deux image ; 89 s pour un clip texte de 5 s isolé et un lot de cinq clips texte terminé sous 192 s. Un clip image de 5 s a pris 842 s, délai attribué à la file d'attente amont. Ces mesures restent celles de cette plateforme commerciale.
- [Artificial Analysis texte](https://artificialanalysis.ai/video/leaderboard/text-to-video) et [image](https://artificialanalysis.ai/video/leaderboard/image-to-video), relevés le 6 novembre : aucune ligne Flash dans les tableaux récupérés de 31 et 32 modèles. Aucun Elo n'est inventé.
- [SpicyAPI](https://spicyapi.ai/reviews/kling-4-0-flash/report) : son indice 51/100 repose uniquement sur ses capacités déclarées, avec des dimensions de qualité absentes. Il ne devient pas une note de rendu MaxVideoAI.
- [Megaton Kling 4](https://megaton.ai/evaluations/kling/kling-4/report) : modèle complet, donc exclu des notes Flash.

Les notes croisent ces preuves et les ancres éditoriales existantes, comme le
précédent FLUX 3 Max. Elles ne sont pas une conversion de classement externe.
La seconde revue indépendante a examiné les six feuilles, I1 et T1, puis réduit
plusieurs propositions pour refléter la portée réelle des observations.

## Publication et validation

Le changement utilise le mécanisme existant d'estimation et ne modifie ni les
tarifs ni les capacités. Les dix lignes du comparatif (le prix est séparé), les
onze critères du benchmark, le global du hub et le sélecteur App partagent le
même propriétaire. Les textes EN/FR/ES ne présentent plus Flash comme non noté.

Les tests reproduisent d'abord l'absence de la ligne Flash, puis contrôlent les
valeurs et la mention d'estimation dans les deux ordres des comparatifs et les
trois langues. Ils vérifient aussi l'alignement des lecteurs App/hub/benchmark.
La livraison suit PR, Quality CI, Preview Git exact, fusion et contrôle des deux
domaines. Les reçus de déploiement restent dans la PR de cette correction.

La statistique opérationnelle de latence conserve ses seuils de 30 jobs et cinq
utilisateurs distincts. Une note éditoriale de vitesse ne remplit pas artificiellement
ces statistiques. Ce périmètre ne relance aucun autre rendu payant.
