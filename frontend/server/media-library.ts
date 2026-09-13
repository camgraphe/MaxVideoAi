export {
  buildMediaAssetInsert,
  mapLegacyJobRowToOutputs,
  normalizeMediaAssetSource,
  resolveLibraryAssetDedupeKey,
  resolveLibraryAssetOriginDedupeKey,
  resolveLibraryAssetIdentity,
} from './media-library-records';

export type {
  JobOutputRecord,
  LegacyJobMediaRow,
  MediaAssetInsert,
  MediaAssetRecord,
  MediaAssetSource,
  MediaKind,
} from './media-library-records';

export {
  applyOutputsToJobPayload,
  listJobOutputsByJobIds,
  listRecentOutputs,
  listStoryboardKlingFirstFrameOutputs,
  upsertJobOutputs,
  upsertLegacyJobOutputs,
} from './media-library/job-outputs';

export {
  ensureReusableAsset,
  listLibraryAssets,
  saveJobOutputToLibrary,
} from './media-library/assets';

export { deleteLibraryAsset } from './media-library/asset-deletion';
