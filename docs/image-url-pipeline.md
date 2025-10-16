# Image URL Pipeline

This document tracks the new asset pipeline introduced in October 2025.

## Overview

Video engines (Sora, Veo, Luma, Pika, Minimax, Kling, etc.) now receive public image URLs instead of inline base64 payloads. Images are uploaded to our Supabase Storage bucket, and `/api/generate` forwards validated URLs to Fal.

```
Client Dropzone → `/api/uploads/image` → Supabase Storage (user-assets bucket)
                               ↓
                         user_assets table
                               ↓
                    `/api/generate` → Fal queue
```

## Environment variables

| Key | Description |
| --- | --- |
| `SUPABASE_ASSETS_BUCKET` | Public bucket for user assets (default `user-assets`). |
| `ASSET_MAX_IMAGE_MB` | Max upload size enforced by the upload route (default 25 MB). |
| `ASSET_HOST_ALLOWLIST` | Optional comma-separated list of additional trusted hosts. |
| `FAL_USE_UPLOAD` | Feature flag. When `true`, falls back to Fal storage uploads (default `false`). |

Ensure the Supabase service role key is present (`SUPABASE_SERVICE_ROLE_KEY`) and the bucket is configured as public.

## API additions

- `POST /api/uploads/image`
  - Accepts `multipart/form-data` with a `file` field.
  - Returns `{ id, url, width, height, size, mime }`.
  - Records the asset in the `user_assets` table.

- `GET /api/user-assets`
  - Authenticated endpoint returning the latest uploaded/generated images for the user.

- `/api/generate`
  - Accepts `imageUrl` and `referenceImages[]` alongside `inputs[]` (each entry includes a `url`).
  - Validates hosts against an allowlist and performs HEAD probes when necessary.
  - No longer calls `fal.storage.upload()`.

## Database

New table created by `ensureAssetSchema()`:

```sql
CREATE TABLE user_assets (
  id BIGSERIAL PRIMARY KEY,
  asset_id TEXT UNIQUE,
  user_id TEXT,
  url TEXT NOT NULL,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  size_bytes BIGINT,
  source TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Frontend workflow

- Dropzone uploads immediately to `/api/uploads/image`.
- Composer keeps track of upload status; generation blocks until all references are ready.
- The new asset picker dialog lets users reuse images stored in `user_assets` (including future Nano Banan outputs).

## Security

- Only HTTPS URLs from the allowlist are forwarded to Fal.
- Optional HEAD probe validates MIME type and size (fast timeout, cached client-side).
- UI clarifies accepted formats and size limits per engine.

Keep this document updated as we add Nano Banan integration (image generation) and expand the asset picker (multi-select, tagging).
