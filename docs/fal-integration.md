# Intégration FAL

Ce document résume le fonctionnement de l'orchestration FAL dans Videohub, les variables à configurer sur Vercel et les règles à suivre pour générer, récupérer et archiver les vidéos en toute sécurité.

## 1. Vue d'ensemble

- Le front (GenerateForm) envoie les paramètres normalisés vers `POST /api/jobs`.
- L'API vérifie le coût, les droits, enrichit les métadonnées (ratios, assets) puis délègue au provider `falProvider`.
- `falProvider` cible par défaut `https://queue.fal.run` pour lancer les jobs, mais accepte désormais des bases personnalisées (`FAL_QUEUE_BASE`, `FAL_API_BASE`).
- Le polling (simulateur + boutons) et le webhook `/api/fal/webhook` partagent la même logique de mapping (`mapFalPollResponse`) pour retrouver le média final.
- À la réception d'un webhook `completed`, le service `archiveJobMedia` rapatrie la vidéo vers le bucket S3/R2 et stocke l'URL d'archive.

## 2. Variables d'environnement

| Variable               | Obligatoire | Description |
|------------------------|-------------|-------------|
| `FAL_KEY`              | ✅          | Clé API FAL recommandée (préfixe `FAL-…`). |
| `FAL_API_KEY`          | ⛔️ (legacy) | Alias de secours si `FAL_KEY` n'est pas défini. |
| `FAL_API_BASE`         | ➕          | Origin REST personnalisée (ex: `https://rest.alpha.fal.ai`). Doit être en HTTPS et finir par `.fal.ai` ou `.fal.run`. |
| `FAL_QUEUE_BASE`       | ➕          | Origin de la Queue API (ex: `https://queue.fal.run`). Même règles de validation. |
| `FAL_TIMEOUT_MS`       | ➕          | Timeout des requêtes FAL (défaut 300 000 ms). |
| `FAL_QUEUE_LOGS_DEFAULT` | ➕        | `1` pour rapatrier les logs queue côté polling. |
| `FAL_WEBHOOK_PATH`     | ➕          | Chemin webhook (défaut `/api/fal/webhook`). |
| `FAL_JWKS_URL`         | ➕          | JWKS Ed25519 pour vérifier les signatures webhook. |

> Astuce Vercel : déclarer toutes ces clés en variables **Server** et redéployer. Le provider met en cache la clé via `getFalCredentials()` mais chaque nouveau déploiement recharge la valeur.

## 3. Lancer un rendu vidéo

1. **Formulaire** : l'utilisateur choisit un preset/model. Les contraintes (`durationSeconds`, `fps`, etc.) proviennent de `src/data/models.ts`.
2. **Validation API** : `POST /api/jobs` contrôle les ratios, normalise durée/fps/cfg via `normalizeDurationSeconds/normalizeNumber`, vérifie les crédits, et crée l'entrée `jobs`.
3. **Délégation provider** : `falProvider.startJob()` construit le payload adapté au pipeline (`payloadBuilders`) et déclenche la Queue API.
4. **Suivi** : `simulateJobLifecycle` effectue des polls périodiques. Les logs queue peuvent être activés via `FAL_QUEUE_LOGS_DEFAULT` ou sur demande.

Bonnes pratiques :
- Toujours fournir les assets requis (`inputImageUrl` pour `veo3-fast`, `cogvideox-5b`). L'API refuse sinon avec `INVALID_PARAMS`.
- Adapter la durée côté preset pour rester dans les plages `constraints.durationSeconds` afin d'éviter les coercions serveur.
- Utiliser `confirm=true` dans la payload si le coût peut dépasser le budget interactif.

## 4. Récupération & archivage

- `falProvider.pollJob()` teste plusieurs endpoints (queue, base REST, fallback `api.fal.ai`/`rest.alpha.fal.ai`) pour maximiser la compatibilité.
- Le mapping `coerceFalVideoResource` supporte désormais `url`, `video_url`, `signed_url`, `download_url`, `file.url`, etc. afin de couvrir toutes les variations de réponse.
- Lorsque le webhook arrive avec `completed`, nous :
  1. mettons à jour le statut/progress/urls dans `jobs`,
  2. archivons le média via `archiveJobMedia`,
  3. conservons un `job_event` pour historiser.

Si aucune URL n'est trouvée, le job reste en `running` et un poll manuel permet de récupérer la sortie dès qu'elle est disponible.

## 5. Gestion des tokens

- `getFalCredentials()` retourne `FAL_KEY` ou à défaut `FAL_API_KEY`. Une erreur est levée si aucune variable n'est définie côté serveur.
- Les clés sont **jamais** envoyées au client : tous les appels passent par l'API Next.
- Pour la rotation :
  - Ajouter la nouvelle clé (`FAL_KEY_NEW`),
  - Déployer, vérifier les jobs,
  - Basculer `FAL_KEY` vers la valeur finale,
  - Revoker l'ancienne clé dans le dashboard FAL.
- Le logging supprime toute trace de clés. En cas de besoin de debug des requêtes, activer temporairement `FAL_QUEUE_LOGS_DEFAULT=1` puis remettre à `0`.

## 6. Checklist Ops (Vercel)

1. Créer un secret Vercel `FAL_KEY` et le rattacher aux environnements **Production** et **Preview**.
2. (Optionnel) Ajouter `FAL_API_BASE` / `FAL_QUEUE_BASE` si l'on cible un cluster spécifique (ex : alpha).
3. Configurer `APP_URL` avec le domaine public pour que le webhook soit accessible.
4. Déclarer le webhook côté FAL vers `https://<domaine>${FAL_WEBHOOK_PATH}`.
5. Tester depuis le dashboard Generate : un job doit passer en `running` < 5 s et se clôturer avec une URL d'archive.

Ce guide doit rester proche du code. Mettez-le à jour si de nouveaux modèles FAL sont ajoutés ou si la signature webhook change.
