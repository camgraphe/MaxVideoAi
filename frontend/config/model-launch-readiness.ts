import generatedProjection from './model-launch-readiness.generated.json' with { type: 'json' };
import { parseModelLaunchReadinessProjection } from './model-launch-readiness-schema';

export {
  findModelLaunchReadiness,
  hasModelLaunchReadiness,
  P0_VIDEO_EXAMPLE_MODEL_IDS,
  type ModelLaunchReadinessEntry,
  type ModelLaunchReadinessProjection,
  type ModelLaunchWaveReadinessProjection,
  type P0VideoExampleModelId,
} from './model-launch-readiness-schema';

// Client-safe generated readiness only: no jobs, library IDs, review state,
// prompts, source metadata, or media URLs from the Task 12 evidence pack.
export const MODEL_LAUNCH_READINESS_PROJECTION = parseModelLaunchReadinessProjection(generatedProjection);
export const MODEL_LAUNCH_READY_MODELS = Object.freeze(
  MODEL_LAUNCH_READINESS_PROJECTION.waves.flatMap(({ models }) => models),
);
