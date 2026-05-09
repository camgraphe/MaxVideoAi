import { query } from '@/lib/db';
import { normalizeString, type MediaKind } from '../media-library-records';

export async function resolveReusableAssetThumbUrl(params: {
  userId: string;
  kind: MediaKind;
  normalizedUrl: string;
  thumbUrl?: string | null;
  sourceJobId?: string | null;
  sourceOutputId?: string | null;
}): Promise<string | null> {
  const directThumbUrl = normalizeString(params.thumbUrl);
  if (directThumbUrl) return directThumbUrl;
  if (!params.sourceJobId && !params.sourceOutputId) return null;

  const rows = await query<{ thumb_url: string | null }>(
    `SELECT thumb_url
       FROM job_outputs
      WHERE user_id = $1
        AND kind = $2
        AND status <> 'deleted'
        AND thumb_url IS NOT NULL
        AND (
          ($3::text IS NOT NULL AND id = $3::text)
          OR (
            $4::text IS NOT NULL
            AND job_id = $4::text
            AND (url = $5::text OR storage_url = $5::text)
          )
        )
      ORDER BY
        CASE
          WHEN $3::text IS NOT NULL AND id = $3::text THEN 0
          WHEN url = $5::text THEN 1
          WHEN storage_url = $5::text THEN 2
          ELSE 3
        END,
        position ASC,
        created_at DESC
      LIMIT 1`,
    [
      params.userId,
      params.kind,
      params.sourceOutputId ?? null,
      params.sourceJobId ?? null,
      params.normalizedUrl,
    ]
  );

  return normalizeString(rows[0]?.thumb_url) ?? null;
}

export async function resolveReusableAssetPreviewUrl(params: {
  userId: string;
  kind: MediaKind;
  normalizedUrl: string;
  previewUrl?: string | null;
  sourceJobId?: string | null;
  sourceOutputId?: string | null;
}): Promise<string | null> {
  if (params.kind !== 'video') return null;
  const directPreviewUrl = normalizeString(params.previewUrl);
  if (directPreviewUrl) return directPreviewUrl;
  if (!params.sourceJobId && !params.sourceOutputId) return null;

  const rows = await query<{ preview_url: string | null }>(
    `SELECT preview_url
       FROM job_outputs
      WHERE user_id = $1
        AND kind = 'video'
        AND status <> 'deleted'
        AND preview_url IS NOT NULL
        AND (
          ($2::text IS NOT NULL AND id = $2::text)
          OR (
            $3::text IS NOT NULL
            AND job_id = $3::text
            AND (url = $4::text OR storage_url = $4::text)
          )
        )
      ORDER BY
        CASE
          WHEN $2::text IS NOT NULL AND id = $2::text THEN 0
          WHEN url = $4::text THEN 1
          WHEN storage_url = $4::text THEN 2
          ELSE 3
        END,
        position ASC,
        created_at DESC
      LIMIT 1`,
    [
      params.userId,
      params.sourceOutputId ?? null,
      params.sourceJobId ?? null,
      params.normalizedUrl,
    ]
  );

  return normalizeString(rows[0]?.preview_url) ?? null;
}
