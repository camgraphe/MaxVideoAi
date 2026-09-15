# D90 — Intégration de main et recette locale

Date : 15 septembre 2026. Branche : `codex/site-redesign`. Aucun push, déploiement, accès à la base de production ni migration appliquée en production.

## Résultat

Le travail validé jusqu’à D89 est sauvegardé dans `b7383a7d0`, avec une branche de secours `codex/site-redesign-backup-d89`. `origin/main` au commit `faa71e098` (PR 297) est intégré par le merge local `5ae762017`. Le checkout principal n’a pas été modifié.

Les fondations serveur MCP, OAuth et les migrations récentes sont maintenant présentes dans la branche de refonte. Les registres modèles et intégrations MCP sont identiques à ceux de main. Les décisions visuelles D86–D89 restent prioritaires : aucune section ajoutée, aucun retour aux anciens héros ou menus, aucune modification des lecteurs vidéo ou de la palette dans ce lot.

Les conflits concernaient principalement les vues et textes MCP déjà retravaillés en D86. La présentation approuvée a été conservée ; le contrat d’attribution MCP récent de main, avec son registre et l’autorisation OAuth active, a été retenu. Un import dupliqué par la fusion a été supprimé dans `lib/analytics/journey.ts`.

## Corrections de finition

- Guides OpenClaw FR/ES : titre, introduction, libellé des commandes, adresse MCP et consigne de connexion traduits au lieu d’hériter de l’anglais. Le libellé d’adresse n8n est également localisé. Les commandes exécutables et les limites de compatibilité restent inchangées.
- Documentation technique MCP : précisions OAuth 2.1 et scopes `openid`, `email`, `profile` conservées dans le paragraphe existant ; connexion gratuite et crédits partagés explicités.
- Trois conversions identiques de lignes vidéo vers une Map regroupées avec le mapper existant ; aucune requête ou règle d’accès modifiée par cette consolidation.
- Contrats de tests ajustés aux décisions validées : palette marketing fixe, footer sélectionné, menus actuels, galerie indépendante au lieu d’un faux test à prompt identique, vrais visuels des outils. Les vérifications de publication, routes, exposition et séparation app/marketing restent actives. Aucun seuil d’architecture abaissé.

## Recette

| Contrôle | Résultat et périmètre |
| --- | --- |
| Suite principale de `pnpm test:validate` | 5 532 tests : **5 531 réussis, 0 échec, 1 ignoré**. Le test ignoré concerne l’alias macOS `/tmp` lorsque TMPDIR est déjà canonique (`/private/tmp`). |
| Contrats MCP après dernières traductions | 12 tests réussis. Le contrat vérifie aussi les titres, introductions, consignes et libellés de configuration FR/ES. |
| Build de production isolé | Build complet validé ; compilation, types et contrôles prébuild. Le snapshot ne contient aucune variable ni connexion de production. |
| Lint / exposition / liens internes / diff | Contrôles validés. |
| Routes publiques, build D89 contre build fusionné | **69 routes HTTP 200** EN/FR/ES : H1 unique, JSON-LD valide, titre, canonical, hreflang et robots conservés. |
| Autres routes modèles du même échantillon | **12 routes indisponibles sans DATABASE_URL dans les deux builds**. Elles ne sont pas comptées comme validées en production. Les 12 répondent 200 avec H1 unique et canonical attendu en développement, via la copie publique locale ; cela ne valide pas la connexion aux données de production. |
| Sitemaps de contenu | EN **385**, FR **299**, ES **325**, modèles **156** : ensembles d’URL identiques avant/après, sans doublons. |
| Autres fichiers publics | `robots.txt`, `llms.txt` et `/.well-known/glama.json` répondent 200. |
| Recette visuelle | Hub MCP, panneau OpenClaw ouvert et galerie LTX contrôlés sur desktop ; marges et palette conservées. Les styles sont inchangés depuis D89. Aucune nouvelle mesure mobile/CWV n’est revendiquée dans D90. |

Les tests précédant les contrôles Studio utilisent PostgreSQL 17 jetable, sans port TCP, avec `LC_ALL=C`, `LANG=C` et `TMPDIR=/private/tmp`. Les échecs initiaux liés à PostgreSQL 14 et à la locale du processus ont été résolus dans l’environnement de test.

## Vérifications encore bloquées — pas de feu vert de publication

**Les quatre fichiers d’intégration Studio/MCP (cinq cas) ne passent pas dans cette recette.** Leur serveur Next temporaire échoue avant le contrôle d’authentification avec `Cannot find module '@aws-sdk/middleware-expect-continue'`, chargé depuis `@aws-sdk/client-s3`. Le paquet est installé et se résout depuis Node normalement ; l’erreur apparaît dans le serveur Next du snapshot qui partage les dépendances par liens symboliques. La cause exacte de cette différence de résolution reste à corriger.

Le même contrôle de démarrage a été exécuté contre un snapshot **`origin/main` seul**, avec la même base et les mêmes fixtures locales : même erreur. Ce constat ne prouve pas que ces scénarios métier fonctionnent ; il indique que le blocage n’est pas propre à la refonte. Les tests ne sont ni désactivés ni rendus permissifs. `pnpm test:validate` dans son ensemble reste donc en échec, malgré la réussite de sa suite principale.

Restent également à valider avant publication :

1. Recette authentifiée et reconnexion OAuth sur un environnement de préproduction convenablement configuré, puis contrôles Studio/MCP débloqués.
2. Pages modèles et index/sitemaps vidéo avec une base de préproduction contenant les données nécessaires. Sans base, `sitemap.xml`, `sitemap-video.xml` et `sitemap-video-pages.xml` renvoient 503 : ne pas présenter ce build sans données comme un environnement publiable.
3. Mesures comparables de chargement et Core Web Vitals sur les vrais médias, avec mobile et Safari/iOS. Un build vert et des positions visuelles améliorées ne constituent pas des mesures CWV.
4. Relecture du diff final contre main et vérification du dernier état de main au moment effectif de préparer la publication.

## Traces locales

Les artefacts non versionnés se trouvent dans `docs/redesign/qa/integration-d90/` : comparaison de routes, sitemaps XML et JSON, contrôle modèles en développement et synthèse. Les anciennes sommes de routes qui comptaient les erreurs comme des valeurs égales ont été corrigées : **69 comparaisons valides, pas 81**.

Logs de cette session : `/private/tmp/d90-validation-final.log`, `/private/tmp/d90-locales-final.log`, `/private/tmp/d90-build-locale-final.log`, `/private/tmp/d90-lint-locale-final.log`, `/private/tmp/d90-main-readiness.log`. Ces fichiers temporaires ne remplacent pas une recette CI reproductible.
