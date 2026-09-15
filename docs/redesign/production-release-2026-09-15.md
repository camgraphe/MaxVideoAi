# D93 — Publication de la refonte marketing

## Résultat

La refonte est publiée sur https://maxvideoai.com après autorisation explicite
« ok go on passe en prod ». La PR #298 est fusionnée le 15 septembre 2026 à
08:51:19 UTC. La cible Production Vercel est vérifiée READY après son build.

- PR : https://github.com/camgraphe/MaxVideoAi/pull/298
- Révision contrôlée avant fusion : `37634c614ba85db3ac2b5efdc5466c6b494ab56d`.
- Commit publié : `f60aa0c974769eb9df2849daa225a07fb305cd4d`.
- Déploiement : `dpl_8j6ryLom1qXxJ7bWpW2QNqpNBvGk`.
- URL Vercel : `maxvideoai-dive1be2g-camgraphes-projects.vercel.app`.
- Build dédié à Production, pas une promotion de l’aperçu Preview.
- Worktree `codex/site-redesign` conservé, avancé jusqu’au commit de fusion.

## Vérifications

La CI préfusion est verte sur la révision finale :
https://github.com/camgraphe/MaxVideoAi/actions/runs/34945915086.
La relance du job admin passe sans modifier le code ni les assertions. L’échec
initial correspondait à une échéance de rendu de 10 s, avec réponse HTTP 200
et 13 produits visibles dans la capture d’échec. Le build Vercel Production
compile et génère 881 pages avec succès.

La recette publique vérifie 18 URL : accueil EN/FR/ES, galeries LTX EN/FR/ES,
modèles, comparatif, outils, MCP, robots et sitemaps. Les 14 pages HTML ont
un H1, un canonical de production, des alternates EN/FR/ES/x-default et du
JSON-LD valide. Aucun `noindex` HTTP ou HTML ne bloque ces pages ; robots.txt
autorise leur exploration. La racine sans slash final est normalisée lors de
la comparaison des URL ; elle conserve le canonical existant.

| Sitemap | Entrées avant | Entrées après | URL retirées |
| --- | ---: | ---: | ---: |
| EN | 385 | 385 | 0 |
| FR | 299 | 299 | 0 |
| ES | 325 | 325 | 0 |
| Modèles | 156 | 156 | 0 |
| Pages vidéo | 46 | 46 | 0 |
| Vidéos | 46 | 46 | 0 |

Les URL prioritaires contrôlées (MCP, intégrations, modèles et accueils localisés)
sont présentes dans ces sitemaps. La conservation de couverture ne préjuge pas
des classements futurs.

Contrôles visuels desktop sur le domaine public : accueil FR, FAQ ouverte,
galerie LTX, Character Builder FR, OpenClaw ES et comparatif MiniMax H3 /
Seedance 2.5. Pas d’image chargée cassée ni débordement horizontal détecté sur
ces vues. Le héros de l’accueil et celui de LTX jouent ; le lecteur manuel
issu de LTX atteint la fin du clip (6,12 s) sans erreur média. Un échantillon
Range de la vidéo du héros retourne HTTP 206 avec `video/mp4`.

MCP anonyme : `/mcp` sur l’hôte API retourne HTTP 401 et le challenge attendu ;
la découverte retourne HTTP 200 et identifie `https://api.maxvideoai.com/mcp`.
Aucun changement de flags, d’OAuth ou de migration n’a été exécuté ici.

La première consultation des journaux Vercel, filtrée sur ce déploiement et les
statuts 5xx, ne retourne aucune entrée. C’est un relevé ponctuel, pas une preuve
d’absence de toute erreur ni une surveillance permanente. Les workflows
IndexNow et Lighthouse sur main ont réussi. Quality CI après fusion a également
terminé avec succès, y compris les tests Studio et admin :
https://github.com/camgraphe/MaxVideoAi/actions/runs/34949265141.

## Retour arrière

Référence enregistrée avant fusion :

- Déploiement : `dpl_GhLWvmKa5qV2GcQiWDvtvDc32fwG`.
- Git : `faa71e09899f80ee20cf9b2013c23d77a49d0600`.
- URL : `maxvideoai-aym23mk8r-camgraphes-projects.vercel.app`.

En cas de régression critique, restaurer ce déploiement via le mécanisme de
rollback Vercel et vérifier les domaines. Aucune migration de base n’est à
inverser pour cette publication marketing. Aucun rollback n’a été nécessaire
pendant cette recette.

## Limites et preuves

Pas de génération payante, paiement, téléversement ou action MCP authentifiée
pendant cette recette. Safari/iOS, transactions authentifiées, clients MCP
externes et CWV terrain ne sont pas certifiés par ces contrôles publics.

Les résultats bruts locaux sont dans `docs/redesign/qa/production-d93/`
(répertoire ignoré par Git) : baseline, HTML avant/après, couverture sitemap,
contrôles HTTP, découverte MCP et échantillon média. Aucune valeur de secret
n’a été enregistrée. Cette note est un bilan postpublication conservé dans le
worktree ; elle ne déclenche pas un second déploiement du site.
