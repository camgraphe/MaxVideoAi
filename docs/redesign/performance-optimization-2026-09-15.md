# D95 — Optimisations mesurées après publication

Le 15 septembre 2026, Adrien demande d’optimiser ce qui peut l’être avant
d’attendre les données terrain. Le design validé, les animations et les routes
SEO restent la référence. Aucun nouveau contenu marketing ni achat.

## Périmètre

- Character Builder : planche publique responsive via Next Image, priorité
  explicite sur la vue initiale. Même image, même cadre, portrait sur sélection.
- MCP : priorité explicite du visuel principal, images secondaires toujours lazy.
- CSS accueil, modèles et comparatifs importé par les pages concernées plutôt
  que par tout le marketing. Aucune règle CSS modifiée.
- Menu marketing connecté : les traductions du compte vivent dans le petit
  dictionnaire client `nav`. FR et ES ne retombent plus sur les libellés anglais
  de `workspace`, absent de ce payload. CTA branché sur `nav.cta` existant.
- Tarifs MiniMax H3 : quatre clés techniques visibles, également présentes
  dans le HTML de production avant D95, remplacées par les durées, résolutions
  et entrées correspondantes en EN/FR/ES. Les montants et réglages ne changent
  pas. Un test couvre les libellés des presets de tout le catalogue exécutable.

## Comparaison reproductible

Référence : `c75b816c8`, dont le frontend est celui de production `f60aa0c97`.
Candidat : même archive Git + diff D95. Deux builds de production isolés,
ports 3031/3032, sans base ni identifiants de production. Lighthouse **12.6.1**,
même Chromium et machine, ordre avant/après alterné. 24 mesures : trois visites
mobiles à navigateur neuf et une desktop par version sur trois routes.
Les caches navigateurs sont froids ; le serveur et son optimiseur peuvent être
chauds après le premier passage. Les résultats ne sont pas comparables en
valeur absolue à PageSpeed ni aux mesures réseau de production D94.

| Route | LCP mobile médian avant → après | Étendue avant → après | Poids initial médian avant → après |
| --- | --- | --- | --- |
| Accueil FR | 3,162 → 3,164 s | 3,028–3,162 → 3,015–3,164 s | 538 469 → 531 950 octets |
| Character Builder EN | 3,160 → 2,938 s | 3,087–3,165 → 2,937–2,940 s | 695 281 → 569 979 octets |
| MCP FR | 3,088 → 3,012 s | 3,088–3,168 → 3,010–3,087 s | 586 746 → 573 784 octets |

Character Builder : **−125 302 octets (−18 %)**, LCP médian **−222 ms**.
MCP : gain de poids certain, petit gain de LCP à confirmer sur le terrain.
Accueil : LCP stable, environ 6,5 Ko économisés. CSS transféré : 69 254 →
57 649 octets sur Character/MCP, 69 254 → 64 093 sur l’accueil.
CLS nul sur les 24 mesures. TBT mobile médian 10,5–15 ms avant, 11–14 ms après.
Desktop, un passage par version : LCP accueil 0,749 → 0,741 s ; Character
0,693 → 0,668 s ; MCP 0,677 → 0,689 s. Ce petit écart MCP ne démontre pas une
régression reproductible.

Rapports bruts et captures locaux ignorés par Git :
`docs/redesign/qa/optimization-d95/performance/`. La première synthèse JSON
contient une clé `version` écrasée par la version Lighthouse ; les noms de
fichiers et ports identifient sans ambiguïté les variantes.

Douze mesures complémentaires avec cache navigateur conservé après une visite
de préparation : 100/100 et CLS 0 dans tous les cas. LCP mobile avant → après :
accueil 987 → 986 ms, Character 994 → 1 032 ms, MCP 985 → 992 ms ; desktop
263 → 263 ms, 264 → 261 ms, 292 → 291 ms. Un passage par cas : pas de conclusion
statistique à tirer de ces petits écarts. Rapports dans `performance-warm/`.

## Validation et limites

51 tests ciblés passent ; tests rouges puis verts sur les trois corrections.
La couverture tarifaire et ses contrats associés ajoutent 46 tests réussis ;
le nouveau test reproduit les douze libellés manquants avant correction.
Deux builds complets, lint frontend, exposition publique, parité i18n et
contrôles SEO/liens passent. L’accueil desktop conserve exactement les
dimensions, polices et couleurs calculées de ses sections avant/après.
Planche et sélection du portrait contrôlées sur mobile ; étapes MCP et image
responsive vérifiées à 390 px, sans débordement horizontal.

Les builds isolés n’ont pas de base : les pages modèles complètes nécessitent
une revue hébergée. Le chemin local FR de Character Builder boucle également
sur la référence ; le benchmark utilise son chemin EN. Cela ne valide ni ne
modifie le routage de production. La revue hébergée et la publication seront
consignées après les checks de la PR.

Cette passe ne valide pas l’INP terrain. Les CWV mobiles historiques restent
non validés ; CrUX agrège 28 jours, largement antérieurs à la refonte. La
prochaine décision de fond doit s’appuyer sur les nouvelles visites et
interactions réelles, sans poursuivre des réécritures spéculatives.
