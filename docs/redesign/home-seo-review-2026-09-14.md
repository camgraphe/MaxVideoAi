# Revue SEO de l’accueil — 14 septembre 2026

La refonte conserve les URL et les principaux signaux d’indexation. Elle est plus démonstrative et plus utile pour choisir un modèle, mais cela ne suffit pas à garantir le maintien des positions. Cette passe corrige les pertes de liens, précise le contenu et laisse **la performance mobile comme condition de publication à mesurer**.

Périmètre : accueils EN `/`, FR `/fr`, ES `/es` ; branche `codex/site-redesign`, comparée au `main` local `ab2cb9fbd` et aux réponses publiques de production. « mail » a été interprété comme `main`. Aucun merge, push, déploiement, changement GSC ou demande d’indexation. Les filtres de consultation GSC ont été manipulés en lecture seule.

## Ce que montrent les données GSC

Consultation directe dans Chrome, propriété `sc-domain:maxvideoai.com`, recherche Web, 13 juin au 12 septembre 2026. Filtre de page : `^https://maxvideoai\.com(/(fr|es))?/?$`. Ces chiffres portent sur la production, jamais sur localhost.

| Accueil | Clics | Impressions |
| --- | ---: | ---: |
| EN | 2 110 | 34 990 |
| FR | 115 | 1 699 |
| ES | 102 | 3 459 |
| Ensemble des trois accueils | 2 327 | 40 148 |

GSC affiche 5,8 % de CTR et 9,9 de position moyenne sur ce filtre. La liste des requêtes n’est pas exhaustive : anonymisation et avertissement de résultats partiels avec filtres. Ne pas additionner les requêtes visibles pour reconstituer les totaux.

Les premières recherches sont surtout liées au nom : `maxvideoai` (300 clics), `maxvideo` (282), `max video ai` (83), `maxvideo ai` (78). Signal hors marque pertinent : `pay as you go ai video generator` (35 clics / 182 impressions), `ai video generator pay as you go` (10 / 33), `ai video generator one time payment` (4 / 34). La requête générique `ai video generator` n’apporte que 4 clics / 169 impressions sur ces accueils. Les volumes FR/ES visibles par requête sont trop faibles pour justifier une stratégie de répétition de mots-clés.

Décision : conserver les titres SEO existants, affirmer « générateur vidéo IA sans abonnement / pay-as-you-go » dans l’accroche visible, expliquer les crédits. Ne pas promettre de génération illimitée ni d’achat à vie pour capter des requêtes mal adaptées. Des recherches manifestement parasites apparaissent aussi : elles ne justifient ni un changement de contenu ni un désaveu automatique de liens.

## Indexation et expérience de page

Inspection GSC des trois URL : **indexées**, Googlebot smartphone, exploration et indexation autorisées, récupération réussie, canonique choisie par Google égale à l’URL inspectée. Dernières explorations affichées : EN 14/09/2026 à 12:29:29, FR 06/09 à 03:00:44, ES 13/09 à 05:48:23 (heures affichées par GSC).

Le rapport CWV mobile, mis à jour le 13/09, présente un groupe de **139 URL à 3,1 s de LCP**, représenté par `https://maxvideoai.com/`. Validation échouée le 03/08. C’est une mesure de groupe, pas le LCP individuel prouvé des trois accueils et encore moins une mesure de la branche.

L’inspection EN ne détecte pas de sitemap référent ; FR/ES affichent une erreur temporaire de traitement sur ce champ. Pourtant les trois accueils sont présents dans leurs sitemaps publics dédiés : 383 URL EN, 297 FR, 323 ES au moment de la lecture. Ne pas confondre ce champ GSC avec une absence réelle dans les fichiers.

## Comparaison production / refonte / corrections

| Sujet | Constat | Décision et résultat |
| --- | --- | --- |
| URL, canonique, hreflang | Identiques à la production en EN/FR/ES ; `x-default` vers EN | Conservés. Aucun changement de routage ou de sitemap |
| Titres et descriptions SEO | Identiques à `main` et à la production | Conservés pour ne pas multiplier les variables |
| H1 | Production centrée sur le choix d’un modèle ; refonte centrée sur la création | Composition validée conservée. Accroche visible précise désormais le type de produit et le paiement à l’usage |
| Bloc « Bases » | Définition générique, trois modes sans liens, langue déduite du texte | Remplacé par « Quel est votre point de départ ? », trois définitions utiles et trois liens. Langue explicite |
| FAQ | 8 thèmes pertinents mais réponses génériques, comparaisons non étayées, formulations traduites, absence de liens | Réponses EN/FR/ES réécrites, 8 thèmes conservés, lien contextuel par réponse, création/import d’image et limites par modèle explicités |
| Paiement | Risque de confondre échec technique et résultat décevant | Distinction précisée ; devis final dans l’app, pas de promesse de prix universel |
| Liens internes | 9 destinations du corps de l’ancien accueil avaient disparu : 6 comparatifs, exemples Grok/Flux, modèle Flux 3 | Sélection renouvelée à la demande d’Adrien : Kling 3 Pro / Seedance 2.5, Seedance 2.5 / Wan 3, LTX 2.5 Fast / Pro, partagée avec le footer. Liens Grok/Flux rétablis. Les anciennes routes sont conservées, pas leur promotion systématique |
| Liens d’action | Liens app utiles à la conversion mais routes privées, non destinées au référencement | Conservés, complétés par des destinations marketing publiques. Les liens app ne remplacent pas les pages de modèles et d’exemples |
| Structure des titres | Chapitre comparatif autonome en H3 | Passé en H2, même taille visuelle |
| Données structurées | WebApplication/ItemList injectés après hydratation ; offre fixe de 10 USD pouvant être comprise comme prix de l’application | JSON-LD serveur échappé ; prix forfaitaire retiré. Le catalogue et la démo restent les sources de tarifs explicites |
| FAQPage | Présent dans l’ancien site | Conservé cohérent avec les réponses visibles pour compatibilité, sans attente de résultat enrichi Google |
| Médias / performance | Héros et démonstrations plus présents ; risque de charge et d’animations | Cette passe SEO n’ajoute aucun média, préchargement ni lecteur ; contrats de chargement conservés. Mesure comparative en build production encore requise |

Avant cette passe, le corps principal comptait environ 1 306 / 1 402 / 1 435 mots (EN/FR/ES), contre 1 600 / 1 750 / 1 799 en production. Au relevé intermédiaire, avant renouvellement des liens : environ 1 455 / 1 525 / 1 551. C’est un indicateur de contenu extrait, comprenant les réponses dépliables, **pas un objectif de densité ou une mesure de qualité SEO**. La réduction des répétitions est acceptable tant que les intentions et destinations utiles restent couvertes.

## Que faire du bloc « Bases » ?

Il n’a pas besoin d’exister sous cette forme pour « protéger le SEO ». Ce qui compte ici est de comprendre les entrées possibles et de trouver les modèles compatibles. La petite section devient donc une orientation : texte → exemples et prompts ; image → guide image-vers-vidéo ; clip → catalogue et capacités. Les termes restent aussi expliqués dans la FAQ. Aucun besoin d’ajouter un pavé répétitif ou une nouvelle grande section.

## FAQ et résultats enrichis

La documentation Google actuelle annonce le retrait des résultats enrichis FAQ à partir du 7 mai 2026 ; la documentation dédiée a été retirée en juin. Les anciennes recommandations du skill (limitation santé/gouvernement) sont donc dépassées sur ce point. Les questions restent pertinentes pour les visiteurs et le contenu de la page, sans promesse de gain liée au balisage. Source : [historique officiel Google Search Central](https://developers.google.com/search/updates#may-2026).

Les liens contextuels utilisent de vrais éléments `a` avec des ancres descriptives. Les réponses restent dans le HTML serveur même fermées. Référence : [bonnes pratiques de liens Google](https://developers.google.com/search/docs/crawling-indexing/links-crawlable). La FAQ ne devient pas une liste de slogans « meilleur », ni un classement de modèles non démontré.

## Vérifications réalisées

- Réponses HTTP 200 des six accueils (3 production, 3 localhost) ; un seul H1 ; titres SEO, canoniques, alternates EN/FR/ES/x-default et Open Graph contrôlés.
- 46 destinations marketing FR du corps des deux versions vérifiées en production : HTTP 200 sans changement de destination. Les trois nouveaux comparatifs ont aussi été vérifiés en EN/FR/ES : neuf réponses HTTP 200 sans redirection. Le guide PAYG est déjà existant.
- Décision finale : ne pas rétablir les six comparatifs historiques sur l’accueil pour la seule continuité du maillage. Trois comparatifs actuels et publiés les remplacent, également dans le footer. Les anciennes pages ne sont ni supprimées ni redirigées. Le carrousel ne propose un modèle que si sa note et sa page de comparaison avec Kling sont disponibles ; LTX 2.5 reste promu via Fast / Pro, sa paire avec Kling n’étant pas publiée. Les légendes des vidéos conservent le modèle qui les a réellement générées.
- HTML initial : WebApplication, FAQPage, ItemList, Organization, WebSite ; aucun faux prix forfaitaire ; réponses FAQ concordantes avec le balisage.
- 64 tests ciblés passent : SEO accueil, navigation, architecture, schémas, exemples, contenu différé, LCP contractuel, route par défaut et hreflang. TypeScript, lint ciblé et diff check passent.
- Revue navigateur FR desktop/mobile : dépliage FAQ, lien Tarifs vers `/fr/tarifs`, orientation en trois liens, absence de débordement à 390 px. Les destinations dynamiques image-vers-vidéo utilisent les paramètres de route pour éviter une URL FR/ES avec le chemin anglais.
- Captures de données locales sous `docs/redesign/qa/home-seo-before.json`, `home-seo-after.json`, `home-link-status.json` (dossier de QA ignoré par Git).

## Conditions avant publication et suivi

1. **Performance :** comparer l’ancien et le nouvel accueil dans des builds production équivalents, même appareil/réseau, cache froid/chaud et plusieurs passages. Contrôler LCP, INP/interaction réelle, CLS, volume transféré avant interaction et lecture mobile. Un serveur Next en développement ne permet pas de conclure à une amélioration. Ne pas publier une régression reproductible du chargement initial.
2. **Préproduction :** conserver une preview non indexable ; au lancement, vérifier que le blocage de preview n’est pas repris sur la production. Recontrôler les 3 URL publiques, canoniques, hreflang, HTML/JSON-LD, liens et sitemaps sur le véritable hôte publié.
3. **Données périssables :** revalider les modèles publiés, comparatifs, prix de la démo et disponibilité des médias au moment de lancer. Aucun modèle retiré ne doit être réintroduit pour conserver un lien historique.
4. **Suivi GSC :** noter la date de publication ; comparer clics, impressions, CTR et pages par langue et par familles marque / paiement à l’usage / génération. Revoir à 7, 14 et 28 jours, en tenant compte des variations de demande et des faibles volumes FR/ES. Suivre le groupe CWV sur sa fenêtre de données terrain, pas dès le lendemain.

La refonte peut améliorer la compréhension, l’accès aux modèles et la conversion. Ces bénéfices sont plausibles et testables, pas un gain de positions garanti. Le DR 36 mentionné par Adrien n’a pas été remesuré ici et ne protège pas d’une régression d’indexation ou de performance. Google combine plusieurs signaux ; [l’expérience de page ne se résume pas à une seule note](https://developers.google.com/search/docs/appearance/page-experience).

### Dernière correction après revue visuelle

Les éléments dépliables du chapitre sombre (méthode des notes et liste des comparatifs) héritaient d’un fond clair global : fond désormais transparent et texte clair conservé. Sélection des comparatifs commune accueil/footer, noms dérivés du catalogue, publication testée. Le lien de découverte Seedance mène à la 2.5 ; les crédits des anciens exemples vidéo restent exacts.
