import 'server-only';

import generatedProjection from './model-launch-assets.generated.json' with { type: 'json' };
import {
  projectAcceptedDurableModelAssets,
  type ModelLaunchAssetProjection,
} from './model-launch-assets-validation';

export {
  buildP0LaunchProjectionsFromSource,
  checkP0LaunchProjectionFreshness,
  createMissingModelLaunchAssetProjection,
  createMissingModelLaunchReadinessProjection,
  createModelLaunchReadinessProjection,
  isAcceptedDurableModelAsset,
  parseAcceptedDurableModelAsset,
  projectAcceptedDurableModelAssets,
  validateP0VideoExamplePackDocument,
  type AcceptedDurableModelAsset,
  type ModelLaunchAssetProjection,
} from './model-launch-assets-validation';

export const MODEL_LAUNCH_ASSET_PROJECTION = generatedProjection as ModelLaunchAssetProjection;
export const ACCEPTED_DURABLE_MODEL_ASSETS = Object.freeze(
  projectAcceptedDurableModelAssets(MODEL_LAUNCH_ASSET_PROJECTION),
);
