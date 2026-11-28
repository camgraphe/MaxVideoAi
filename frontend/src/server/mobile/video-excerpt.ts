import { z } from 'zod';
import { prepareVideoExcerpt } from '@/server/video-excerpts/prepare';
import { VideoExcerptError } from '@/server/video-excerpts/media';
import { resolveStudioMedia } from '@/server/studio/media-resolver';
import { validateLibraryPickerCandidates } from '@/server/media-library/picker-validation';
import { createUploadedMediaReadAccess } from '@/server/media-library/upload-read-access';
import { readMobileModels } from './catalog';
import { MobileHttpError } from './errors';
import { mobileSourceEvidence, verifyEvidence } from './reference-visibility';

const inputSchema = z
  .object({
    assetId: z.string().regex(/^ma_[a-f0-9]{32}$/),
    mode: z.enum(['v2v', 'extend']),
    engineId: z.string().trim().min(1).max(128),
    fieldId: z.string().trim().min(1).max(128),
    range: z
      .object({ startSec: z.number().finite().nonnegative(), endSec: z.number().finite().positive() })
      .strict()
      .refine((r) => r.endSec > r.startSec),
  })
  .strict();

export async function prepareMobileVideoExcerpt(
  userId: string,
  value: unknown,
  deps = {
    models: readMobileModels,
    prepare: prepareVideoExcerpt,
    resolve: resolveStudioMedia,
    evidence: mobileSourceEvidence,
    validate: validateLibraryPickerCandidates,
    grant: createUploadedMediaReadAccess,
  },
) {
  const input = inputSchema.safeParse(value);
  if (!input.success)
    throw new MobileHttpError('PARAMETER_INVALID', 422, 'Choose a valid video and section.');
  const { assetId, engineId, mode, fieldId, range } = input.data;
  const [model] = await deps.models({ id: engineId, surface: 'video' });
  const field = model?.modes.find((item) => item.mode === mode)?.sourceVideo;
  if (!field?.canPrepareExcerpt || field.fieldId !== fieldId)
    throw new MobileHttpError('ENGINE_UNAVAILABLE', 409, 'This model cannot prepare that source field.');
  const source = { type: 'asset' as const, assetId, kind: 'video' as const };
  const evidence = await deps.evidence(userId, [assetId]);
  // The shared encoder reauthorizes before and after persistence. Check library trash and
  // source ancestry on the same passes, including generated outputs promoted to assets.
  const resolve: typeof resolveStudioMedia = async (owner, ref, ...options) => {
    try {
      verifyEvidence(evidence, await deps.evidence(owner, [assetId]));
    } catch {
      throw new VideoExcerptError('SOURCE_CHANGED', 'The source video changed. Choose it again.');
    }
    return deps.resolve(owner, ref, ...options);
  };
  try {
    const prepared = await deps.prepare(userId, { source, engineId, mode, fieldId, range }, { resolve });
    const asset = prepared.asset;
    if (
      !asset.ref ||
      asset.ref.type !== 'asset' ||
      asset.ref.kind !== 'video' ||
      !asset.assetId ||
      asset.ref.assetId !== asset.assetId ||
      asset.assetId === assetId
    )
      throw new VideoExcerptError('PREPARATION_FAILED', 'The prepared video could not be verified.');
    const [selected] = await deps.validate(userId, {
      candidates: [{ reference: asset.ref, originalUrl: asset.url }],
    });
    if (!selected?.key || !selected.sourceRevision || selected.error || selected.state?.trashedAt)
      throw new VideoExcerptError('SOURCE_CHANGED', 'The prepared video changed.');
    const access = await deps.grant(userId, {
      assetId: asset.assetId,
      legacyAssetId: asset.id,
      kind: 'video',
      url: asset.url,
    });
    if (
      access.readAccessOwnerId !== userId ||
      !access.accessUrl ||
      !access.readAccessRevision ||
      !access.readAccessExpiresAt
    )
      throw new VideoExcerptError('PREPARATION_FAILED', 'The private prepared video is unavailable.');
    return {
      original: prepared.original,
      range: prepared.range,
      asset: {
        ...access,
        kind: 'video',
        name: asset.name,
        source: 'upload',
        url: asset.url,
        mime: asset.mime,
        width: asset.width,
        height: asset.height,
        size: asset.size,
        durationSec: asset.durationSec,
        libraryRef: { ...asset.ref, sourceRevision: selected.sourceRevision },
        sourceRevision: selected.sourceRevision,
        organization: { key: selected.key, trashedAt: null },
      },
    };
  } catch (error) {
    if (!(error instanceof VideoExcerptError)) throw error;
    const status = {
      AUTH_REQUIRED: 401,
      PARAMETER_INVALID: 422,
      ENGINE_UNAVAILABLE: 409,
      SOURCE_UNAVAILABLE: 404,
      SOURCE_CHANGED: 409,
      PREPARATION_LIMIT: 422,
      PREPARATION_BUSY: 429,
      PREPARATION_FAILED: 500,
    }[error.code];
    throw new MobileHttpError(error.code, status, error.message);
  }
}
