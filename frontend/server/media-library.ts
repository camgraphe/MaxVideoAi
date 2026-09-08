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
  listRecentOutputPage,
  listStoryboardKlingFirstFrameOutputs,
  upsertJobOutputs,
  upsertLegacyJobOutputs,
} from './media-library/job-outputs';

export {
  deleteLibraryAsset,
  ensureReusableAsset,
  findLibraryAssetByOrigin,
  listLibraryAssets,
  listLibraryAssetPage,
  saveJobOutputToLibrary,
} from './media-library/assets';
