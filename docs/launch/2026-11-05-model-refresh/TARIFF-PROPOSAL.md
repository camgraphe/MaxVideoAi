# Proposition tarifaire — non appliquée

La grille Flash a été **approuvée par l'utilisateur le 5 novembre 2026** : coût
fournisseur LIST × 1,30, arrondi final au cent supérieur. Cette décision couvre
les 72 classes ci-dessous. L'application reste conditionnée aux contrôles natifs
de confirmation et de lancement. GPT Image 2.6 sera traité séparément.
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

| Sortie | Vidéo(s) d'entrée | Prix client proposé |
| --- | --- | ---: |
| 5 s | 5 s | 0,82 $ |
| 5 s | 10 s | 1,23 $ |
| 5 s | 20 s | 2,05 $ |
| 10 s | 5 s | 1,64 $ |

`flash-tariff-preview.json` contient les 72 previews natives : 54 montants fixes et
18 classes continues, obtenus en lecture seule avec `NODE_ENV=production`,
révision 2115. Aucun tarif Flash existant n'a été trouvé. Le champ `preview.active`
décrit le système tarifaire global déjà actif, pas une application de la proposition.
Les champs racine `approved:true` et `applied:false` font foi pour ce dossier.
Une future confirmation doit recréer les previews sur la révision courante ; ces
empreintes ne permettent pas d'ignorer le contrôle de péremption.

`flash-tariff-batch.json` est l'import natif exact des mêmes 72 prix, avec
`create_missing`. L'adaptateur de lots conserve les limites, l'historique,
l'empreinte de révision et la confirmation atomique existants. Les tests comparent
chaque prix aux previews approuvées, puis vérifient transaction, reçu, reprise et
absence de modification de Kling 4 sur PostgreSQL jetable et dans le navigateur.
Cette qualification locale ne constitue ni application en production ni mesure
de latence du déploiement distant.

## GPT Image 2.6

La matrice administrative décrit 2 040 scénarios (deux variantes, trois tailles,
cinq qualités, 1–4 sorties, nombre de références exact), sans montant approuvé.
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
références. Aucune formule d'entrée 2.5 ou GPT Image 1 n'est transposée. Il reste à
établir une base de coût 2.6 ou une hypothèse commerciale explicite, puis présenter
les montants exacts dans le flux natif avant ouverture.
