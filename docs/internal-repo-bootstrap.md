# Bootstrapping the Private Repository (`maxvideoai-internal`)

This guide explains how to migrate the sensitive code from the staging folder (`private/`) into the private production repository.

## 1. Create the Private Repo

```
git init --bare /path/to/maxvideoai-internal.git
# or create on GitHub/GitLab and clone locally
```

Clone locally:
```
git clone git@github.com:maxvideoai/maxvideoai-internal.git
cd maxvideoai-internal
```

## 2. Copy Source from Staging Folder

From the public repo root:
```
rsync -av --progress private/ ../maxvideoai-internal/
```

Verify the expected structure (examples):
- `frontend/app/api/**`
- `frontend/app/(workspace)/**`
- `frontend/src/lib/{pricing.ts,fal.ts,fal-catalog.ts,env.ts,wallet.ts,schema.ts,model-roster.ts}`
- `packages/**`
- `db/**`
- `scripts/process-video-gallery.mjs`
- `scripts/serve-video-gallery.mjs`

## 3. Restore git Tracking

```
cd ../maxvideoai-internal
git add .
git commit -m "Initial import of internal modules"
git push origin main
```

## 4. Update Imports in Private Repo

- Ensure internal code references the correct absolute paths (e.g. `@/lib/pricing`).
- Remove or adjust stubs introduced in the public repo.
- Re-enable API routes and workspace pages.

## 5. Configure CI/CD

- Add workflows for lint/test/build (`.github/workflows/internal-ci.yml`).
- Configure secrets (Fal.ai, Stripe, DB).
- Set up deployment targets (Vercel app, Kubernetes, etc.).

## 6. Remove `private/` Staging Folder

Once the migration is completed and verified:
```
rm -rf private/
```

Future changes should be made directly in the private repo; the staging folder is only for initial migration.
