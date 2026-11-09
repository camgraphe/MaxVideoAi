import { query } from '@/lib/db';
import type { LibraryMediaReference } from '@/lib/media-library-organization';
import type { MediaAssetRecord } from '../media-library-records';
import { assetProjection, legacyProjection, outputProjection, legacyKindSql } from './organization-source-sql';
import { unavailableOrganizationSourceUrls, type OrganizationSource } from './organization-sources';
import { LibraryOrganizationError, validateLibraryReference, requireLibraryOwner } from './organization-validation';
import { createLibraryMediaReadAccess, libraryReadRevision } from './read-access';

/** Exact source authorization, deliberately independent of organization proof/visibility.
 * Same source projections and storage fences as mutation discovery, without grouping,
 * alias materialization, schema writes or client-supplied URLs. */
export async function loadLibraryMediaReadAsset(userId: string, reference: unknown) {
  requireLibraryOwner(userId);
  if (!validateLibraryReference(reference) || reference.sourceRevision !== undefined) {
    throw new LibraryOrganizationError('INVALID_READ_REFERENCE');
  }
  const ref: LibraryMediaReference = reference;
  type Row = OrganizationSource & { thumbUrl: string | null; previewUrl: string | null; metadata: Record<string, unknown>; source: MediaAssetRecord['source'] };
  const rows = ref.type === 'asset'
    ? await query<Row>(`SELECT ${assetProjection},m.thumb_url AS "thumbUrl",m.preview_url AS "previewUrl",m.metadata,m.source
        FROM media_assets m WHERE m.user_id=$1 AND m.public_id=$2 AND m.kind=$3`, [userId, ref.assetId, ref.kind])
    : ref.type === 'legacy'
      ? await query<Row>(`SELECT ${legacyProjection},u.metadata->>'thumbUrl' AS "thumbUrl",u.metadata->>'previewUrl' AS "previewUrl",u.metadata,'upload'::text AS source
          FROM user_assets u WHERE u.user_id=$1 AND u.asset_id=$2 AND ${legacyKindSql()}=$3`, [userId, ref.assetId, ref.kind])
      : await query<Row>(`SELECT ${outputProjection},o.thumb_url AS "thumbUrl",o.preview_url AS "previewUrl",o.metadata,'upload'::text AS source
          FROM job_outputs o JOIN app_jobs j ON j.job_id=o.job_id AND j.user_id=$1 AND NOT j.hidden
          WHERE o.user_id=$1 AND o.id=$2 AND o.job_id=$3 AND o.kind=$4`, [userId, ref.outputId, ref.jobId, ref.kind]);
  const row = rows[0];
  if (!row?.available || (await unavailableOrganizationSourceUrls([row], { query }, false)).has(row.url)) {
    throw new LibraryOrganizationError('SOURCE_UNAVAILABLE', 404);
  }
  const asset = { ...row, userId, metadata: row.metadata ?? {} };
  return { asset, reference: ref };
}

export async function renewLibraryMediaReadAccess(userId: string, reference: unknown, revision: unknown) {
  requireLibraryOwner(userId);
  if (typeof revision !== 'string' || !/^ra_[a-f0-9]{64}$/.test(revision)) throw new LibraryOrganizationError('INVALID_READ_REFERENCE');
  const { asset, reference: ref } = await loadLibraryMediaReadAsset(userId, reference);
  if (libraryReadRevision(asset) !== revision) throw new LibraryOrganizationError('SOURCE_VERSION_CHANGED', 409);
  const access = await createLibraryMediaReadAccess(userId, asset, ref);
  if (!access.accessUrl) throw new LibraryOrganizationError('READ_ACCESS_UNAVAILABLE', 404);
  return access;
}
