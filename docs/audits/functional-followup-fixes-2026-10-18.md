# Corrections fonctionnelles complémentaires — 18 octobre 2026

Base : `19f716d5827d6af0647d60b695ba5253ed742e14`, branche
`codex/followup-functional-fixes`, worktree isolé. Code applicatif enregistré dans
`903fa9a10` puis `c7e399633`, complétés par le dernier arrêt de revalidation
automatique de collection sur erreur de statut. Ce lot répond aux cinq
constats de l’audit complémentaire A1–A5 du 17 octobre ; il est distinct du lot
déjà livré par la PR #454.

## Corrections

| Constat | Comportement corrigé | Régressions couvertes |
| --- | --- | --- |
| A1 — Storyboard et comptes | Le workspace est remonté par compte confirmé. Les réponses obsolètes et actions secondaires sont invalidées ; historique, références, résultats et stockage ont un propriétaire. | A → B, déconnexion, historique tardif, génération et frame Kling tardives, sauvegarde tardive, import vidéo propre au compte, rafraîchissement du token sans perte du brief. |
| A2 — SQL dans les GET | Les références de personnages et sorties récentes lisent le schéma migré sans bootstrap global. Les autres appelants et mutations conservent leur initialisation existante. | Vrais handlers sur PostgreSQL 17 en lecture seule, filtres et médias identiques, compte étranger exclu, schéma absent en erreur explicite. |
| A3 — Polling | Un timer partagé par compte/job, avec abonnements propres à chaque feed. Nettoyage au dernier départ, arrêt sur état final/401/403/404, cinq erreurs transitoires au maximum avec attente progressive. | Plusieurs feeds, fermeture/réouverture, compte changé pendant une requête, réponse tardive, déduplication, stockage bloqué, reprise par Actualiser ou renouvellement de session. |
| A4 — Uploads Storyboard | Chaque emplacement possède une identité d’upload et un contrôleur d’annulation. Retrait, remplacement et choix bibliothèque invalident l’ancien upload. | Réponses inversées, ancien échec, retrait pendant préparation locale, nouvelle sélection conservée dans la génération suivante. |
| A5 — Suppression admin | Transaction réservée à une connexion, job verrouillé avant les effets et 404 avant toute modification. Le champ thumbnail vidé respecte la contrainte NOT NULL. | Rollback après chaque étape sous concurrence, succès atomique, 404 sans effet, autorisation, autres jobs et écritures financières conservés. |

Le montage attend aussi la résolution initiale de l’authentification avant de
lancer les trois estimations, sans remonter le brouillon lors d’un renouvellement
de session du même compte.

Les étapes suivantes du workflow Storyboard recapturent le token courant du même
compte. Cette précaution conserve les gardes de compte et d’emplacement sans
reposer sur le fallback de cookie du serveur après expiration d’un ancien token.

## Vérification

Les nouveaux tests comportementaux ont d’abord reproduit les défauts avant la
correction. Les tests PostgreSQL utilisent le bootstrap officiel et une base
jetable PG17 ; ils ne se connectent pas à une base héritée de l’environnement.
Les simulations React utilisent les vrais contrôleurs/hooks/adaptateurs et un
transport contrôlé, sans génération payante.

La revue indépendante a également fait ajouter les cas de reprise du polling,
de sessionStorage indisponible et de réouverture pendant une requête en cours.
Tous ses problèmes bloquants sont corrigés et revérifiés. Les tests 401/403/404
utilisent aussi la politique réelle de retry de SWR : une heure simulée conserve
un seul appel de statut et la lecture initiale de collection ; Actualiser permet
ensuite de reprendre. Une erreur de statut ne doit pas démarrer une seconde
boucle de retry sur la collection. Le contrat de liens
d’authentification suit maintenant le composant de modale extrait, sans supprimer
ses assertions ni augmenter la limite de taille du workspace.

| Vérification | Résultat |
| --- | --- |
| Tests ciblés Storyboard, comptes, uploads, stockage, import vidéo, SQL, polling, admin et architecture | 154 réussis, 0 échec, 0 ignoré |
| Contrats de lecture SQL et pagination, dont les nouveaux GET réels sur PG17 | 46 réussis, 0 ignoré |
| Navigateur isolé (`--suite browser`) | 42 réussis, 0 ignoré |
| Tarifs exhaustifs (`--suite tariffs`) | 2 réussis, 0 ignoré ; 26 818 points de contrôle, 7 lectures SQL tarifaires pour l’acceptation complète |
| Studio isolé sur snapshot Git du candidat | 4 réussis, 0 ignoré |
| Test PG17 de montage, avec assertion de rejet attachée avant libération du verrou | 5 réussis, 0 ignoré |
| Admin complet, PostgreSQL jetable et migrations | 26 réussis, 0 échec, 1 ignoré |
| Storyboard dans Chromium, 1440 et 390 pixels, Auth signé local et PostgreSQL jetable | Génération simulée, brief conservé, exactement 3 estimations initiales par viewport, 0 erreur client |
| Construction Next.js complète, précontrôles modèles/SEO/médias inclus | Passe ; 932 pages statiques construites |
| TypeScript | Passe ; également inclus dans la construction complète |
| ESLint frontend | 0 erreur, 6 avertissements préexistants hors des fichiers corrigés |
| Exposition publique et espaces du diff | Passent |

Les deux tests financiers ont terminé sur HEAD stable `c7e399633`. Le dernier
delta applicatif supprime uniquement la revalidation de collection sur erreur de
statut ; il ne modifie aucun calcul, schéma ou chemin financier. Ce delta a sa
revue indépendante, ses trois régressions SWR et une construction complète.

Les journaux et captures locaux sont conservés dans
`output/audits/2026-10-18-followup-fixes/` du checkout Desktop. Les résultats des
partitions se recouvrent avec les tests ciblés ; leurs nombres ne s’additionnent
pas en un total distinct de tests.

Le scénario admin ignoré concerne l’annuaire Supabase et exige une clé service
absente de la fixture locale ; il ne couvre aucun des cinq défauts corrigés.
Les endpoints de télémétrie propres à Vercel sont simulés dans le navigateur
local, ainsi que les devis et la réponse de génération. Auth, rendu React et
lectures de bibliothèque du smoke Storyboard utilisent les vrais chemins locaux.

La première invocation globale a terminé avec 8 772 réussites, 5 échecs et
4 tests ignorés sur 8 781 tests. Les cinq échecs correspondent à deux contrats
mis à jour après extraction, deux reprises de polling exécutées avant leur
correction, et au garde-fou financier qui a détecté un changement de HEAD
pendant sa validation. Cette invocation a échoué ; ses cas sont relancés sur
le code corrigé, avec un commit stable pour les deux tests financiers exhaustifs.

La partition d’intégration a aussi exposé une course dans un test existant de
montage : la promesse pouvait rejeter après COMMIT avant que `assert.rejects`
soit attaché. L’assertion est maintenant installée avant la libération du verrou ;
les contrôles de verrouillage, d’erreur et d’absence de projet partiel sont
conservés. Les scénarios Studio ayant expiré lors des contrôles parallèles passent
en relance isolée. Aucune assertion financière ni limite de timeout n’est réduite.

Commande ciblée reproductible, depuis la racine du worktree :

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test --test-concurrency=4 \
  tests/storyboard-*.test.ts tests/jobs-*.test.ts tests/job-status-*.test.ts \
  tests/admin-video-delete-postgres.test.ts tests/admin-moderation-read-state.test.ts \
  tests/library-read-routes-postgres.test.ts tests/workspace-shared-video-intent-dom.test.ts \
  tests/frontend-api-architecture.test.ts tests/auth-entry-href-contract.test.ts
```

Le nombre 154 inclut les sous-tests. Les suites et commandes restent celles
du guide `docs/engineering/ci-validation.md` ; aucun fournisseur payant n’est appelé.

## Portée et limites

Le gain SQL est une suppression vérifiée de travail d’installation : le GET des
personnages effectue un SELECT ; celui des sorties récentes effectue un SELECT,
ou deux avec enrichissement Kling. L’audit initial mesurait respectivement 89 et
20 appels aux helpers SQL à froid sur schéma déjà installé. Ces nombres ne sont
pas des mesures de TTFB, de LCP ou de performances de comptes en production.

L’annulation navigateur n’annule pas une génération déjà acceptée par le serveur ;
son résultat reste dans l’historique du compte d’origine. Les anciennes clés de
stockage sans propriétaire ne sont pas attribuées à un compte arbitraire. L’API
admin corrigée est distincte de la route de visibilité utilisée par « Make
private » dans l’interface actuelle.

Aucune génération fournisseur, écriture de production ou publication n’est
nécessaire à ces validations. Ce lot prépare les corrections pour revue ; son
déploiement relève du parcours PR/CI prévu dans le guide de livraison.
