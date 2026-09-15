# D91 — Tests débloqués, sitemaps avec données et gain de chargement

15 septembre 2026 — `codex/site-redesign`. Aucun push ou déploiement. Aucune base,
clé, session ou donnée privée de production utilisée. Les derniers choix de design
et de navigation sont conservés.

## Résultat concret

Deux corrections distinctes :

- `fe8955bfe` : résolution des dépendances dans le processus Node de test Studio,
  avec une régression reproductible et un garde-fou hors environnement de test.
- `8425fe10b` : le fond flouté des exemples verticaux réutilise la vignette responsive
  déjà chargée au premier plan. Il ne télécharge plus l’image originale en plus.

Aucune section, lien marketing ou nouvelle option utilisateur ajouté. La vidéo,
son cadrage, les CTA, les routes et le contenu restent ceux validés précédemment.

## Studio/MCP : le blocage de D90 est levé

L’erreur de dépendance AWS était la conséquence d’un comportement de Node 22.23.2 :
après un `statSync` sur un socket Unix, son cache JavaScript de chemins pouvait
renvoyer le lien symbolique au lieu du fichier réel. La recherche des dépendances
transitives pnpm partait alors du mauvais répertoire. Une reproduction minimale
sans Next, SDK ni base constate le même échec ; la résolution native reste correcte.
La documentation officielle explique pourquoi [le chemin réel du module détermine
la recherche de ses dépendances](https://github.com/nodejs/node/blob/main/doc/api/modules.md).
Le défaut précis décrit ici est un constat local, pas une affirmation de correction
ou de reconnaissance en amont.

Le preload `tests/helpers/studio-node-realpath.cjs` emploie la fonction native dans
le seul enfant Next de la fixture. Il refuse un processus ordinaire ou de production.
Aucun contournement dans le code de l’app, aucun test d’autorisation désactivé.

Les quatre fichiers d’intégration passent : **11 tests et sous-scénarios**, dont
connexion par cookie/bearer, refus intercompte, lecture privée signée, expiration,
sauvegarde, conflits de version et refus sans migration. Les médias de ces tests
sont des fixtures locales interceptées, pas des téléchargements de comptes réels.

## Pages et index avec une base locale

Un cluster PostgreSQL 17 jetable, accessible uniquement par socket Unix, reçoit les
**297 cartes déjà publiques** capturées en D89. Schéma réel initialisé explicitement
sur ce cluster uniquement ; aucun branchement vers la base de production. Les dates
sont celles de la capture et ne prétendent pas être les dates de création réelles.
L’ordre éditorial de ce jeu n’est pas une copie certifiée des playlists de production.

Les builds de production D89 et du candidat utilisent exactement ce même jeu :

- **81 routes EN/FR/ES en HTTP 200**, H1 unique, JSON-LD valide ; titres, canonical,
  hreflang et robots conservés avant/après.
- Sitemaps de contenu identiques : EN 385, FR 299, ES 325, modèles 156.
- Index sitemap en HTTP 200 avec six enfants ; les deux sitemaps vidéo en HTTP 200,
  avec **24 URL identiques** dans ce jeu de données. Ce nombre ne remplace pas le
  décompte réel de production.
- Une vidéo du jeu rendue privée et une autre rendue non indexable sont exclues
  des deux sitemaps vidéo : 24 → 22. Les modifications sont ensuite annulées dans
  la base jetable. Aucun média de production n’a été modifié.

Cela lève le blocage « pas de DATABASE_URL » de D90 pour la recette locale. Cela
ne certifie pas les données, les permissions ou les migrations du futur hébergement.

## Performance : gain mesuré sans surcharge visuelle

Lighthouse 12.6.1, Chrome for Testing, builds de production locaux, même jeu public.
Trois essais alternés par version et par appareil avec cache navigateur froid,
puis un passage chaud dans le même navigateur pour chaque version. Les caches
serveur d’images avaient été amorcés par la recette ; aucune mesure serveur froid
ou réseau mobile réel n’est revendiquée. Les essais n’ont pas tourné en parallèle
avec la suite lourde de tests.

Cas vertical rendu sur `/examples/ltx` : exemple LTX 2.3 Fast présent dans la copie
publique. Le héros LTX 2.5 horizontal actuellement montré dans la revue développeur
n’utilise pas ce fond ; il ne faut pas lui attribuer artificiellement ce gain.

| Mesure médiane, navigateur froid | Avant | Après |
| --- | ---: | ---: |
| LCP mobile | 5,03 s | **3,77 s** |
| Score performance mobile | 80 | **88** |
| Données transférées mobile | 643 726 octets | **575 427 octets** |
| TBT mobile | 22 ms | 10,5 ms |
| LCP desktop | 0,98 s | **0,67 s** |
| Score performance desktop | 99 | 100 |
| CLS mobile et desktop | 0 | 0 |

Mobile froid : LCP avant 4,74–5,90 s, après 3,77–3,84 s ; les intervalles ne se
recouvrent pas dans ces essais. Le passage navigateur chaud est stable autour de
1,20 s sur mobile ; son unique essai par version ne permet pas une conclusion
statistique. La requête JPEG originale de 69 467 octets disparaît. La vignette
optimisée du héros est demandée **une seule fois**, pour ses deux usages visuels.

Le rendu conserve l’effet flouté et la géométrie. Les captures Lighthouse avant et
après ont été inspectées. Les contrats de priorité, de poster côté serveur et de
lecture mobile manuelle restent actifs. Le test du fond était rouge avant correction,
puis vert avec l’image responsive partagée.

Un premier contrôle de fusion, avant cette correction, a aussi mesuré l’accueil FR
sur trois paires : score mobile 93/100 des deux côtés et CLS nul. Il ne démontre
pas un gain de la refonte par rapport à main historique.

**Le LCP mobile froid du cas vertical reste supérieur à 2,5 s.** Ces résultats sont
une amélioration de laboratoire, pas une certification Core Web Vitals, ni une mesure
d’INP réel. Le chargement sur réseau mobile réel, Safari/iOS et les données terrain
restent à suivre.

## Validation finale et prochaine étape

Build complet isolé validé après correction du poster. Les tests ciblés du parcours
exemples, de priorité et de chargement sont verts (17 tests). La suite complète
`pnpm test:validate` passe sur le commit `8425fe10b` : 5 535 tests principaux
réussis, un ignoré, puis 11 tests d’intégration réussis, sans échec (code de sortie 0).
Le test ignoré concerne l’alias macOS `/tmp`, non applicable avec le répertoire
temporaire canonique utilisé ici. Lint frontend, contrôle d’exposition et
`git diff --check` passent également. Les 81 contrôles HTTP sont repassés après
la correction du poster.

La prochaine étape de publication exige un environnement de préproduction réellement
configuré : contrôle des migrations et des données, connexion/reconnexion depuis les
clients MCP réels, puis vérification finale du diff contre le dernier main. Les tests
locaux utilisent une authentification de fixture et ne prouvent pas la disponibilité
de chaque interface Claude, ChatGPT, Codex, OpenClaw ou n8n chez un utilisateur réel.

Traces locales non versionnées : `docs/redesign/qa/integration-d91/`, notamment les
comparaisons HTTP/XML, `sitemap-filter.json`, les rapports de performance complets,
les captures, la reproduction Node et les journaux des suites. Les serveurs et le
cluster jetables sont arrêtés à la fin de la recette ; la revue sur 3008 est conservée.
