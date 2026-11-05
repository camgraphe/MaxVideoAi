# Qualification par modèle, mode et surface

État du 5 novembre 2026. Code testé n'implique pas disponibilité publique.
Tous les modèles ci-dessous sont fermés dans le registre ; aucun tarif client
nouveau n'a été confirmé en production. Les cases de parcours réel attendent
leur reçu, leur devis et l'original dans la bibliothèque du bon compte.

| Modèle / mode | Contrat local | API fournisseur | App réel | Studio réel | MCP réel | Tarif public | Média public |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Flash / t2v | testé | V1 obtenu | en attente | en attente | en attente | fermé | fermé |
| Flash / i2v | testé | V2 obtenu | en attente | en attente | en attente | fermé | fermé |
| Flash / ref2v | testé | V3 obtenu | en attente | en attente | en attente | fermé | fermé |
| Flare 2.6 / t2i | testé | I1 obtenu | en attente | en attente | en attente | fermé | fermé |
| Flare 2.6 / i2i | testé | I3 obtenu | en attente | en attente | en attente | fermé | fermé |
| Sunburst 2.6 / t2i | testé | I2 obtenu | en attente | en attente | en attente | fermé | fermé |
| Sunburst 2.6 / i2i | testé | I4 obtenu | en attente | en attente | en attente | fermé | fermé |

Les tests locaux couvrent limites, paramètres, refus avant devis, réservations et
reprise via doubles de provider et PostgreSQL jetable. Les fixtures Studio
valident la certification technique ; l'ouverture demeure conditionnée à l'accès,
aux tarifs et à une preuve du parcours. Le MCP client et ses 70 cas de sélection
ont passé leur contrôle ; la découverte sur un host installé est une preuve distincte.

I1 : OpenAI direct Flare, PNG 1024², high/high, une sortie, 279 tokens texte et
1 758 tokens de sortie ; coût liste calculé 0,054135 USD, facture inconnue.
I2 : même prompt via Sunburst, 279 tokens texte et 1 756 tokens de sortie ;
0,054075 USD liste, facture inconnue. Les reçus locaux et les originaux sont
conservés dans le répertoire de production de cette tâche. Aucun utilisateur
MaxVideoAI n'a été débité par ces appels de qualification fournisseur.

Les sept appels approuvés ont maintenant terminé, chacun en une tentative.
`cinema-results.json` consigne prompts, réglages, références, reçus, hashes,
dimensions et usages. Total fournisseur calculé : **1,803869021 USD** à partir
des tarifs liste et usages observés, facture inconnue. Le lot ne constitue pas
une mesure comparative représentative de qualité ou de latence.

I3 et I4 éditent le même original I1 : costume ocre vers rouge sombre, sans
modifier volontairement le personnage, la bobine ou le décor. Les quatre images
ont été examinées. V1/V2/V3 ont respectivement deux, deux et trois plans visibles
dans les planches de revue. Les trois pistes audio existent ; transcription
locale sans texte attendu : « Where's my ending? », « Found your ending. »,
« Roll it. ». Une écoute éditoriale reste nécessaire, notamment pour le fond
sonore de V3 que l'ASR décrit comme musical.

Les vidéos durent 5,041667 s pour une demande de 5 s. V1/V3 sont 1280×720 ;
V2, guidé par l'image carrée I1, est 960×960 avec le paramètre fournisseur 720p.
V3 réemploie les 5,041667 s réelles de V1, soit une estimation liste de
0,632625021 USD ; l'arrondi de la facture fournisseur n'est pas vérifié.

Originaux, galerie autonome et éléments de revue sont conservés hors du dossier
temporaire SDD dans `Documents/MaxVideoAI/2026-11-05-cinema` sur le poste de
production. Les sept originaux ont ensuite été importés dans la bibliothèque
privée du compte connecté par le helper officiel MaxVideoAI. Lecture bornée aux
sept IDs retournés : tous sont `ready`, avec dimensions et thumbnails ; les
vidéos n'ont pas encore de `preview_url` ni de job externe lié. Les trois aperçus
silencieux sont préparés localement. Aucune adoption de job externe, copie
marketing publique ou publication de galerie n'est prétendue réalisée.
