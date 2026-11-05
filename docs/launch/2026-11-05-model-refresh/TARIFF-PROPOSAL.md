# Tarifs — Flash appliqué, GPT Image 2.6 approuvé à ×1,50

La grille Flash a été **approuvée par l'utilisateur le 5 novembre 2026** : coût
fournisseur LIST × 1,30, arrondi final au cent supérieur. Cette décision couvre
les 72 classes ci-dessous. La confirmation native a été appliquée une fois le 5 novembre à 21:05:47 UTC
(22:05:47 Madrid), après livraison du propriétaire tarifaire. Les 72 cellules
sont présentes à la révision 2187. Le reçu relu en production figure dans
`flash-tariff-applied.json`. La publication du modèle reste fermée ; GPT Image 2.6
sera traité séparément.
Aucun tarif historique ni prix de job n'a été modifié.

## Kling 4.0 Flash

Proposition : coût fournisseur LIST × 1,30, arrondi final au cent supérieur.
Il s'agit d'une majoration de 30 %, pas d'une marge de 30 % sur le chiffre d'affaires.
Tous les prix sont en USD, pour une sortie 720p avec audio natif.

| Durée de sortie | Texte, image initiale, références sans vidéo |
| --- | ---: |
| 3 s | 0,37 $ |
| 5 s | 0,62 $ |
| 10 s | 1,23 $ |
| 15 s | 1,84 $ |
| 20 s | 2,45 $ |

Avec référence vidéo : `ceil(8,19 × (sortie + max(entrée, sortie)))` cents.
L'entrée est la somme précise des vidéos et sujets vidéo réellement transmis,
y compris les répétitions, dans la limite totale de 20 secondes.

| Sortie | Vidéo(s) d'entrée | Prix client approuvé |
| --- | --- | ---: |
| 5 s | 5 s | 0,82 $ |
| 5 s | 10 s | 1,23 $ |
| 5 s | 20 s | 2,05 $ |
| 10 s | 5 s | 1,64 $ |

`flash-tariff-preview.json` contient les 72 previews natives : 54 montants fixes et
18 classes continues, obtenus en lecture seule avec `NODE_ENV=production`,
révision 2115. Aucun tarif Flash existant n'a été trouvé. Le champ `preview.active`
décrit le système tarifaire global déjà actif, pas une application de la proposition.
Les champs racine `approved:true` et `applied:false` décrivent cette preview historique.
Le reçu `flash-tariff-applied.json` établit ensuite la confirmation effective.
La confirmation a recréé sa preview native sur la révision courante ; les
empreintes historiques ne permettent pas d’ignorer le contrôle de péremption.

`flash-tariff-batch.json` est l'import natif exact des mêmes 72 prix, avec
`create_missing`. L'adaptateur de lots conserve les limites, l'historique,
l'empreinte de révision et la confirmation atomique existants. Les tests comparent
chaque prix aux previews approuvées, puis vérifient transaction, reçu, reprise et
absence de modification de Kling 4 sur PostgreSQL jetable et dans le navigateur.
Cette qualification locale est distincte de la confirmation en production,
désormais attestée par le reçu. Elle ne mesure pas la latence de génération.

## GPT Image 2.6

La matrice administrative décrit 2 040 scénarios (deux variantes, trois tailles,
cinq qualités, 1–4 sorties, nombre de références exact). L'utilisateur a approuvé
la formule ci-dessous en demandant un coefficient **1,50** au lieu de 1,30.
L'estimateur officiel qualifie les composants de sortie. Le coût des entrées
texte/image reste variable et n'a pas de plafond documenté établi pour 2.6.

Le lot carré 1024², high/high, a donné :

| Scénario réel | Coût fournisseur LIST calculé |
| --- | ---: |
| Flare création | 0,054135 $ |
| Sunburst création | 0,054075 $ |
| Flare retouche, une image source | 0,061547 $ |
| Sunburst retouche, même source | 0,061487 $ |

Ces observations ne qualifient pas toutes les tailles, qualités, quantités et
références. Aucune formule d'entrée 2.5 ou GPT Image 1 n'est transposée.

Formule commerciale approuvée : coût de sortie estimé + 0,01 USD par image
produite + 0,02 USD par référence par image produite, puis ×1,50 et arrondi du
total au cent supérieur. Les réserves sont des hypothèses commerciales, pas des
bornes fournisseur ; elles ne garantissent pas la marge.

| Qualité, une sortie 1024² | Création | Retouche, une référence |
| --- | ---: | ---: |
| low | 0,06 $ | 0,09 $ |
| medium | 0,09 $ | 0,12 $ |
| high | 0,10 $ | 0,13 $ |
| xhigh | 0,16 $ | 0,19 $ |
| max | 0,34 $ | 0,37 $ |

Les dix imports exacts, leurs empreintes et la décision sont dans `gpt26-tariffs/`.
Les 2 040 montants passent les devis canoniques public/facturation. Le test PG17
applique les dix opérations bornées à 226 classes, conserve les prix vidéo et les
anciens snapshots payés, puis vérifie une reprise sans écriture historique inutile.
Ces preuves locales ne constituent pas une application en production. Celle-ci
exige le candidat déployé qualifié et dix previews/confirmations admin successives.

La documentation OpenAI a été relue le 5 novembre : son calculateur
reste limité à la sortie ; le calculateur vision exclut explicitement les entrées
GPT Image. Aucun nouveau plafond d’entrée 2.6 n’est établi par ces pages.
