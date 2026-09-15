# Pages modèles — première passe, 14 septembre 2026

> Historique D80 : la politique de cadrage et les sections de détail sont complétées par [D81](model-pages-seo-review-2026-09-14.md). D81 prime.

Revue locale : http://localhost:3008/fr/modeles/seedance-2-5

## Livré dans le gabarit décision partagé

- Nom du modèle en grand, promesse séparée du détail des capacités, vidéo panoramique sans recadrage du contenu ; mobile 16:9 et lecture manuelle existante conservée.
- Liens secondaires après la vidéo ; capacités réparties selon leur nombre réel, en deux colonnes mobile.
- Tarifs compacts à partir des mêmes scénarios calculés ; aucune modification du calcul ou des montants.
- Navigation de section horizontale et défilable sur mobile, ancrages conservés.
- Sections de choix et Prompt Lab allégées visuellement ; interactions de lecture, onglets, copie et navigation conservées.
- Textes d’introduction Seedance 2.5, Kling 3 Pro et LTX 2.5 Pro repris dans les trois langues. Capacités dans le paragraphe conservées, métadonnées intactes.
- Limites génériques localisées FR/ES ; retrait de la fausse affirmation universelle « pas de seed fixe ». Descriptions comparatives du gabarit décision localisées au lieu du fallback anglais du catalogue.

## Revue locale des médias

Les pages modèles accédaient aux playlists et à la validation d’IDs sans passer par la copie publique locale, d’où des aperçus vides. Ces deux lectures utilisent maintenant le garde existant : développement local, flag explicite, aucune DATABASE_URL, aucun environnement Vercel. Sélection exacte du modèle, sans reprendre la vidéo d’une autre génération. La copie ne reproduit pas l’ordre des playlists par modèle de production. Aucun média publié, aucune base ou configuration de production modifiés.

## Vérifications

53 tests ciblés : architecture modèle, contenu décision, localisation des helpers, aperçu public local, exemples, Prompt Lab, SEO accueil. TypeScript et lint ciblé. Contrôle HTTP des accueils FR/ES et de Seedance FR, Kling EN, LTX ES : 200, H1 unique, canoniques, hreflang et JSON-LD présents. Revue navigateur Seedance desktop/mobile et Kling desktop ; pas de débordement sur Seedance à 390 px.

## Limites de cette passe

C’est une première direction sur le gabarit décision, pas une réécriture éditoriale exhaustive de tous les modèles. Les pages historiques qui utilisent le gabarit par défaut et les pages de préannonce restent distinctes. La suite doit reprendre les textes longs et les exemples de chaque modèle prioritaire, puis la présentation des sections techniques et FAQ. Il faut comparer des builds production équivalents avant de conclure sur les performances : la scène vidéo occupe davantage d’espace, et le mode local auparavant vide ne fournit pas une référence comparable de chargement. Aucun gain Core Web Vitals annoncé.
