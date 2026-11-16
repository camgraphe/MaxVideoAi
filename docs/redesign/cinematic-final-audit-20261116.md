# Revue finale des pages Seedream 5.5 et Seedance 2.5 Flash

Revue locale du 16 novembre 2026. **Direction et templates validables ; candidat
de production encore à assembler et à vérifier.** Aucun push, merge ou déploiement
n'a été effectué pendant cette revue.

## Ce que les nouvelles pages apportent

| Point | Anciennes pages inspectées | Nouvelles pages |
| --- | --- | --- |
| Compréhension | Seedream 5.0 Pro et Seedance 2.5 présentent surtout les réglages, textes et liens | Une promesse, puis une démonstration pour chaque usage important |
| Preuves | Médias et Prompt Lab présents, mais moins intégrés au parcours | Retouches successives, transparence et détail image ; vrais films Create, transfert de mouvement, Modify, dialogue et science-fiction |
| Passage à Create | CTA généraux et prompts | Panneaux de prompt avec copie, réutilisation et Milo ; modèle et langue conservés |
| Lecture | De nombreux blocs techniques successifs | Alternance visuelle, navigation interne, détails secondaires dans des panneaux accessibles |
| Données utiles | Réglages, limites, prix, FAQ et liens | Données conservées ; tableau de spécifications copiable/exportable avec sa source |
| Découverte | Versions et comparatifs | Versions, comparaison standard/Flash, hub de comparaisons, galerie et pages vidéo |

Les titres poétiques sont accompagnés de descriptions explicites, noms des modèles,
types d'usage, spécifications et FAQ. Le contenu utile est rendu côté serveur : il
ne dépend pas du texte incrusté dans les images. Les panneaux de prompt ne suppriment
pas ce contenu du HTML. Le producteur reste attribué sans prendre la place de
MaxVideoAI dans le titre principal.

Les compromis sont assumés : les prix ne dominent plus le haut de page, certaines
limites demandent une ouverture, et les interactions ajoutent du JavaScript. La
navigation fixe permet d'atteindre ces informations directement. La preuve Extend
reste une illustration de timeline, conformément au choix éditorial ; ce n'est pas
une vidéo d'extension générée et vérifiée. Aucun gain Core Web Vitals n'est revendiqué.

## SEO, GEO et données GSC

Le bénéfice attendu tient au contenu concret, à ses preuves, aux liens internes et
à la clarté des informations, pas à un balisage « GEO » spécial. Google indique que
les bonnes pratiques SEO habituelles s'appliquent à ses fonctionnalités IA et ne
requiert pas de schéma spécifique :
[documentation Google](https://developers.google.com/search/docs/appearance/ai-features).
Ni classement, ni citation par un assistant, ni résultat enrichi FAQ ne sont garantis.

Export GSC natif du 16 novembre, recherche Web, trois derniers mois :

| Page existante | Clics | Impressions | CTR | Position moyenne |
| --- | ---: | ---: | ---: | ---: |
| Seedance 2.5 | 152 | 3 473 | 4,38 % | 23,65 |
| Exemples Seedance | 109 | 4 266 | 2,56 % | 8,33 |
| Seedream 5.0 Pro | 75 | 1 841 | 4,07 % | 21,87 |
| Seedance 2.0 vs Fast | 42 | 5 676 | 0,74 % | 7,19 |

Source locale : `OUTREACH/sources/2026-11-16/gsc-indexation-trend/native/performance-daily/Pages.csv`
et `Filtres.csv`. Ces données justifient de conserver les exemples, versions et
comparatifs. Elles ne mesurent pas le nouveau design, encore inédit en production.
Après publication, suivre séparément les deux URL, leurs requêtes, les clics vers
Create/Milo, les réutilisations et le chargement mobile, avec une période comparable.

Les vérifications fournisseur ont porté sur les guides officiels
[Seedream 5.5](https://docs.byteplus.com/en/docs/modelark/seedream-5-5),
[sa présentation](https://seed.bytedance.com/en/seedream5_5) et
[Seedance 2.5 / Flash](https://ai.byteplus.com/ark/region:ap-southeast-1/docs/seedance-2-5-prompt-guide).
Cette passe compare les anciennes pages du site ; elle ne constitue pas un nouveau
benchmark exhaustif des concurrents ni une mesure contrôlée de qualité des modèles.

## Corrections réalisées pendant la revue

- Médias vidéo enregistrés par modèle dans un propriétaire dédié. Les composants
  Create/Modify/focus ne chargent plus directement les fichiers Flash.
- Recette du guide de prompt dérivée de son visuel, sans ID de démonstration Flash
  codé en dur dans le composant.
- Un à trois workflows uniques possibles ; chacun exige sa propre preuve visible.
  Un futur modèle Create seul n'hérite donc pas de promesses Modify/Extend.
- Langue conservée pour les huit actions galerie de chaque version EN/FR/ES.
- Accès compact au hub de comparaisons ajouté à Flash, sans nouvelle section.
- Guide d'intégration des prochains modèles et tests d'isolation ajoutés.

Le nouveau template reste activé uniquement pour les deux pilotes. Les autres
modèles conservent leur composition et leurs règles existantes. Un futur modèle
demande toujours ses propres contenus, médias, capacités et recettes validés.

## Contrôles effectués

- Six routes localisées : HTTP 200, un H1, destinations internes et recettes
  cohérentes, aucun avertissement de langue après correction.
- 114 liens de recette résolvent un vrai preset du bon modèle ; les tests de
  restauration préservent les brouillons et interdisent la soumission automatique.
- 22 parcours par ancres en 1280 px et 390 px : titres visibles sous la navigation,
  aucun débordement de page ; quatre panneaux de prompt ouverts/fermés au clavier
  avec restitution du focus.
- Destinations de prix, variantes, comparaison, galerie et vidéos locales : 200.
  Les trois sources externes ont également été consultées.
- Canonical, hreflang et JSON-LD contrôlés. Les schémas Product/Offer et les prix
  commerciaux réels restent à vérifier sur la Preview connectée : cette revue
  locale n'utilise pas la base applicative et ne les invente pas.
- Aucune requête MP4 initiale sur les deux pages ; lecteurs manuels et posters
  conservés. La galerie utilise une courte preview silencieuse pour l'aperçu
  incident, et l'original seulement lors de la lecture demandée.
- 29 tests ciblés + 93 tests de régression passés ; TypeScript, lint sans erreur
  (sept avertissements existants), exposition, registre et projections de lancement
  valides. Ce n'est pas le résultat de Quality CI du futur commit commun.
- Anciennes pages Seedream 5.0 Pro et Seedance 2.5 revues en HTTP ; tests de
  composition, publication et contenu historique conservés.

Résultats reproductibles et captures : `evidence/20261116-final-audit/`.
Le contrôle galerie précédent reste dans `evidence/20261116-gallery/`.

## Ce qui empêche de déclarer une mise en production immédiate

1. **Galerie publique.** Les quatre films ont leurs assets privés et leurs dry-runs
   d'adoption réussis. Il faut encore intégrer le contrat BytePlus, appliquer les
   imports exacts puis la curation/publication autorisée. Les IDs `review-flash-*`
   du serveur local ne sont pas des pages vidéo de production.
2. **Candidat commun.** Cette branche contient les changements de design non
   commités et était 23 commits devant / 18 derrière `origin/main` après fetch.
   Il faut assembler pages et intégrations, résoudre les écarts, puis passer la
   Quality CI obligatoire sur le commit final.
3. **Preview réelle.** Vérifier tarifs, devis, disponibilité modèle, authentification,
   continuité vers Create/Milo et médias publics (HTTP/Range/première lecture), puis
   les deux domaines après le déploiement Git autorisé. Les avertissements de header
   et l'endpoint cookies en erreur dans la revue sans base doivent y être recontrôlés.

Le canal OpenAI Review reste gelé jusqu'au 5 décembre : aucun paquet, runtime,
OAuth ou environnement Review n'a été modifié. Voir le
[dossier de préparation](./cinematic-release-preparation-20261116.md) pour les
propriétaires et étapes de livraison.
