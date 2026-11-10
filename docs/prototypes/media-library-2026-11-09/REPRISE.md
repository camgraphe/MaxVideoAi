# Reprise — galerie compacte V2

Même tâche Codex, reprise après changement de compte. La proposition reste un
prototype local ; aucun module applicatif ni environnement de production n’est
modifié par cette PR.

- Checkout : `/Users/adrienmillot/.codex/worktrees/media-library-design/MaxVideoAi V2`.
- Branche : `codex/media-library-design` ; PR brouillon https://github.com/camgraphe/MaxVideoAi/pull/639.
- Main intégré : `86b598f88706cd23a685292d5675939e0cd09c8a`, avec la PR 638 fusionnée.
- Démarrage : `node docs/prototypes/media-library-2026-11-09/server.mjs`, port local 4176.
- Stratégie et contrats à préparer : [IDENTIFICATION.md](IDENTIFICATION.md).
- Organisation et connexions : [ORGANISATION.md](ORGANISATION.md).
- Instructions de vérification : [README.md](README.md).

La V2 propose mosaïque, grille et liste ; identifications factuelles et repère
personnel facultatif ; contexte de gestion distinct du panier de références ;
recherche et affichage progressif des collections. Le layout de mosaïque utilise
les dimensions connues pour conserver un défilement stable sur 10 000 médias.
Le chargement suivant et le compteur partagent une seule commande sur mobile.

La demande a été étendue au rôle d’Activité et aux connexions Créer/outils/Studio/MCP.
La maquette conserve les deux entrées : Médias gère les fichiers, Activité est un
journal textuel compact. Les parcours génération → plusieurs résultats → source,
reprise du prompt/modèle, média → référence/outil/Studio, projet d’origine et
absence de résultat en cours/échec sont interactifs, avec données fictives.
Les tests de ces parcours sont dans `activity-journeys.ts`, appelés uniquement
par le script navigateur hébergé.

La première V2 corrigée (`ec07fe3c9`) a passé le workflow
https://github.com/camgraphe/MaxVideoAi/actions/runs/42725120101 : 47 captures,
aucun débordement sur les tailles testées, aucun JS error capturé. Les derniers
ajustements de collections/mobile (`9897fa2dd`) ont passé le workflow
https://github.com/camgraphe/MaxVideoAi/actions/runs/42725923198 : 50 captures,
aucun JS error capturé, début de galerie mobile à 251 px. Le candidat Activité
`47b50060a` a son workflow https://github.com/camgraphe/MaxVideoAi/actions/runs/42728187743 ;
lire son résultat avant de le déclarer validé. Les modifications de documentation
ultérieures n’établissent pas à elles seules la réussite d’un nouveau candidat.
Les anciens résultats V1 ne constituent pas une validation V2.

Le dossier de reprise local contient les pointeurs de candidat, les captures et
les résultats les plus récents :
`/Users/adrienmillot/Documents/MaxVideoAI-investigations/2026-11-09-media-library-design/`.

Les contrôles navigateur automatisés restent en CI hébergée ; utiliser seulement
IAB Codex pour les contrôles interactifs locaux. Ne pas utiliser Chrome, lancer
un navigateur Playwright local, modifier le checkout du chat de livraison ou
le Desktop. Les captures de production sont privées et restent hors du dépôt.
Les nouveautés de recherche/contexte modèle/période/repère sont simulées :
leurs contrats serveur sont décrits, sans être implémentés dans le produit.
