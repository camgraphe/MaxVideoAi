# Qualification par modèle, mode et surface

État du 6 novembre 2026, avant ouverture fonctionnelle. Les PR #620 et #622 sont
déployées sur les deux domaines au commit `f868a026b`. Les trois modèles restent
fermés dans le registre de production. Les 72 tarifs Flash sont appliqués à ×1,30.
Les 2 040 tarifs GPT à ×1,50 ont été confirmés par dix lots natifs puis réconciliés,
révision 4227 ; voir `gpt26-tariff-applied.json`.
L’accès fournisseur n’est pas une preuve d’exécution
payante à travers App, Studio ou MCP.

Le candidat d'ouverture fonctionnelle du 6 novembre ajoute les confirmations
natives simulées : 19 tests image (dont les quatre couples 2.6 × Studio/MCP) et
179 tests vidéo/contrats/tarifs/recovery passent sur PostgreSQL jetable. Les devis
utilisent les montants approuvés ; aucune génération fournisseur supplémentaire.
Voir `FUNCTIONAL-OPENING.md` pour les limites de preuve et les contrôles live
encore nécessaires. Les colonnes « réel » ci-dessous désignent une génération
payante traversant la surface, pas la découverte ou un devis en lecture seule.

| Modèle / mode | Contrat local | API fournisseur | App réel | Studio réel | MCP réel | Tarif | Médias |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Flash / t2v | testé | V1 + B1/B2/B3 obtenus | non exécuté | non exécuté | non exécuté | appliqué, découverte fermée | 4 copies publiques, page fermée |
| Flash / i2v | testé | V2 obtenu | non exécuté | non exécuté | non exécuté | appliqué, découverte fermée | copie publique, page fermée |
| Flash / ref2v | testé | V3 obtenu | non exécuté | non exécuté | non exécuté | appliqué, découverte fermée | copie publique, page fermée |
| Flare 2.6 / t2i | testé | I1 obtenu | non exécuté | non exécuté | non exécuté | appliqué ×1,50, découverte fermée | PNG + WebP publics, page fermée |
| Flare 2.6 / i2i | testé | I3 obtenu | non exécuté | non exécuté | non exécuté | appliqué ×1,50, découverte fermée | PNG + WebP publics, page fermée |
| Sunburst 2.6 / t2i | testé | I2 obtenu | non exécuté | non exécuté | non exécuté | appliqué ×1,50, découverte fermée | PNG + WebP publics, page fermée |
| Sunburst 2.6 / i2i | testé | I4 obtenu | non exécuté | non exécuté | non exécuté | appliqué ×1,50, découverte fermée | PNG + WebP publics, page fermée |

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

Les dix originaux (V1–V3, B1–B3, I1–I4), leurs reçus et éléments de revue sont
conservés dans `Documents/MaxVideoAI/2026-11-05-cinema` et
`Documents/MaxVideoAI/2026-11-05-blockbusters`. Ils ont été importés dans la
bibliothèque privée via le helper officiel. Les six vidéos ont reçu leurs aperçus
privés et ont été adoptées par le propriétaire natif d’import externe, sans débit
MaxVideoAI ni échantillon de latence d’une génération App.

Le second lot, demandé par l’utilisateur, ajoute trois films autonomes de quinze
secondes : B1 « Compartiment 9 », B2 « Le dernier rempart », B3 « Le dernier
passage ». Chaque requête a été soumise une fois. Estimation fournisseur LIST :
4,23 USD, soit 6,033869021 USD cumulés avec le premier lot ; facture inconnue.
Les originaux mesurent 15,041667 s, 1280×720, avec piste audio. Les planches montrent
quatre plans par séquence ; l’ASR local retrouve les dialogues demandés. Cela
n’établit pas à lui seul la qualité de synchronisation labiale ou du mixage.
L’utilisateur a choisi B1 pour le hero et B2 pour le prompt détaillé.

Les six copies marketing utilisent les propriétaires natifs de promotion,
thumbnail et visibilité. Les originaux privés restent inchangés. La collection
`examples-kling-v4-flash` contient B1/B2/B3/V1/V2/V3 dans cet ordre. Elle n’est pas
encore gérée par la curation ; la collection familiale existante n’a pas été
modifiée. Les IDs de famille du pack désignent la destination prévue, pas une
preuve d’insertion déjà réalisée. Aucune page watch éditoriale n’a été inventée.

Les quatre images possèdent une copie originale PNG et un affichage WebP immuable.
Les deux retouches I3/I4 partent de I1 Flare ; la visionneuse montre cette source
à côté de chaque résultat. `public-media-http-evidence.json` vérifie les 26 fichiers
par HEAD 200 et deux petites requêtes Range 206 chacun. Le test navigateur du
composant réel vérifie 12 combinaisons locale/largeur/variante : aucun PNG original
avant ouverture, bonne source partagée, modal et retour du focus. Il ne prétend
pas qualifier toute la page de production ou ses Core Web Vitals.

Le comparatif Flash possède sa copie et ses capacités propres. Aucune note
numérique n’a été copiée de Kling 4 : le dossier à onze critères garde les notes
non évaluées absentes. Les séquences marketing ne constituent pas un benchmark
comparatif contrôlé.

Le cron OpenAI déployé refuse correctement les appels non authentifiés. Les
Request Logs Vercel vérifiés le 5 novembre à 23:38 Madrid montrent les appels
planifiés chaque minute avec HTTP 200, User-Agent `vercel-cron/1.0`, sans cache,
sur le déploiement de production `dpl_EcrT5NtBfUKgbiYYjZr2c91t7PPK` (`b5f4bdd`).
La configuration effective authentifie donc le cron ; aucun secret n'a été lu
ni modifié. La preuve bornée figure dans `openai-cron-auth-evidence.json`.
Cela ne prouve pas qu'un job image réellement interrompu a été récupéré.
