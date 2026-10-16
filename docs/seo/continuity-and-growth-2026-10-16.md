# Continuité SEO et priorités de croissance — 16 octobre 2026

## Diagnostic et livraison

Les cinq défauts de [découverte documentés](structural-indexation-audit-2026-10-16.md)
sont des obstacles réels : pagination exclue, liens FR/ES incorrects, destinations
modèles/comparatifs absentes du HTML initial. Leur effet sur le trafic historique
n'est pas quantifié. Ils ne prouvent ni une pénalité ni une désindexation générale.

L'extension de l'audit couvre les **1 263 URL distinctes des six sitemaps**, y
compris blog, documentation, intégrations et vidéos : toutes répondent 200 sans
redirection, avec canonical propre, un H1 et sans `noindex` inattendu dans le HTML
ou `X-Robots-Tag`. [Inventaire HTTP](structural-indexation-2026-10-16/all-sitemap-pages.csv).
Ce contrôle décrit la production avant livraison. Il ne mesure pas l'index Google,
la valeur éditoriale, tous les liens internes possibles ou le classement.

Le nouveau contrôle `seo:public:check`, quotidien et manuel dans GitHub Actions,
rend cette vérification reproductible et suit aussi la pagination native. Les
tests SSR du catalogue et des comparatifs couvrent les liens avant livraison;
les contrats de galerie protègent canonical, exclusions voulues et localisation.
Le guide du registre impose de préserver les réponses utiles des anciennes
versions lors d'un lancement. Aucun changement des URLs publiques n'est nécessaire.

## Sources OUTREACH et fenêtres comparables

Les CSV GSC natifs du dossier `sources/2026-10-15/seo-proof-growth-strategy/recent-native`
couvrent Web, tous pays/appareils, **19 août–15 septembre**, puis **16 septembre–13 octobre**,
deux fenêtres complètes de 28 jours. Le fichier Pages comporte 956 lignes, celui
des requêtes 1 436 : ils ne représentent pas toutes les requêtes, et les agrégations
par page/requête ne s'additionnent pas au total de propriété.
[Huit pages de référence](structural-indexation-2026-10-16/growth-page-baseline.csv)
et [empreintes des sources](structural-indexation-2026-10-16/growth-source-manifest.json).

| Page anglaise | Clics avant → après | Impressions avant → après | Lecture utile |
| --- | ---: | ---: | --- |
| Exemples LTX | 232 → 133 | 5 567 → 3 953 | La position moyenne globale reste 9,99 → 9,98; préserver les intentions 2.3 et distinguer 2.5. |
| Exemples Seedance | 47 → 28 | 2 115 → 944 | La position s'améliore 8,92 → 7,85; la baisse de clics ne suffit pas à diagnostiquer un problème d'indexation. |
| Exemples Kling | 27 → 34 | 1 160 → 1 242 | Conserver ce parcours qui progresse sur cette fenêtre. |
| Exemples Hailuo | 16 → 44 | 1 286 → 701 | Clics en hausse malgré moins d'impressions; ne pas remplacer l'identité historique par H3. |
| Exemples Sora | 10 → 21 | 794 → 683 | La demande historique subsiste malgré le statut produit; garder les alternatives clairement séparées. |
| Modèle Seedance 2.5 | 24 → 60 | 688 → 707 | Renforcer le lien modèle → exemples vérifiés; pas de nouvelle page générique concurrente. |
| Modèle H3 Max | 4 → 19 | 234 → 844 | La découverte des comparatifs publiés mais omis devient utile. |
| Veo Fast vs Lite | 6 → 5 | 1 409 → 2 902 | CTR 0,43 % → 0,17 %, position 7,56 → 7,06 : examiner la réponse à l'intention et le résultat affiché avant de réécrire les métadonnées. |

Le relevé Semrush FR du 8 octobre (date fournisseur 7 octobre, ordinateur) rattache
encore des requêtes à `/fr/modeles/wan-2-5`, `/fr/modeles/ltx-2` et
`/fr/modeles/kling-2-6-pro`. Ce petit échantillon comporte dix lignes et des dates
de crawl anciennes; il renforce la nécessité de conserver les identités, sans
établir leur position actuelle. Le suivi du 15 octobre ne montre que six requêtes,
principalement de marque : ses blancs ne deviennent pas des pertes de rang.
Les limites de l'API actuelle n'effacent pas ces données déjà archivées.

## Ordre de travail durable

1. **Rendre les pages existantes accessibles.** Livrer les corrections, contrôler
   les deux domaines et le HTML public, puis conserver les contrôles quotidiens.
2. **Conserver les acquis à chaque lancement.** Ajouter les nouveaux modèles aux
   sélections issues du registre, garder les accès historiques selon leur statut,
   enrichir la galerie commune sans réécrire tous les prompts pour le dernier modèle.
3. **Enrichir les preuves utiles.** Priorité LTX et Seedance : un exemple doit
   identifier le modèle exact, le mode, le prompt, les réglages et les références
   nécessaires. Réutiliser les médias déjà vérifiés. Le prix courant est distinct
   du coût historique; aucune génération payante ni résultat identique promis.
4. **Travailler les impressions déjà présentes.** Revoir Veo Fast/Lite et les
   comparatifs Omni/Veo avec une association requête → page et une SERP observée.
   Les agrégats seuls ne prouvent pas une cannibalisation. La PR394 a déjà amélioré
   certains scénarios; ne pas présenter ces travaux comme restant à faire.
5. **Mesurer après reprise par Google.** Examiner les mêmes cohortes sur fenêtres
   complètes, première lecture après 2–3 semaines puis décision à 4–6 semaines.
   Séparer impressions, CTR, position et usages produit; ne pas attribuer tout
   changement à cette livraison. Une absence dans un export partiel n'est pas zéro.

La boucle recherchée est : nouvelle preuve réelle → page/version adéquate → liens
vers la famille et les comparatifs → contrôle technique → mesure de demande →
amélioration ciblée. Elle ne dépend pas d'une production automatique de pages
similaires. Aucun nouvel article, média payant, campagne ou soumission externe
n'est lancé par ce lot.

Références de méthode : [liens explorables](https://developers.google.com/search/docs/crawling-indexing/links-crawlable),
[conservation et migration des URLs](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes),
[rôle et limites de robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro).
