import { resolveExampleResolution } from './workspace-example-resolution';
import { parseExampleRecreationSettings } from '@/lib/example-recreation';
import type { SharedVideoPreview } from '@/lib/video-preview-group';
import type { EngineCaps } from '@/types/engines';
import { coerceFormState, getModeCaps } from './workspace-engine-helpers';

/** An explicit comparison must survive source hydration without adapting its advertised settings. */
export function buildExampleRecreationSnapshot(
  video: SharedVideoPreview,
  searchString: string,
  engines: EngineCaps[]
): unknown | null {
  const params = new URLSearchParams(searchString);
  const settings = parseExampleRecreationSettings(params);
  const engine = engines.find((candidate) => candidate.id === params.get('engine'));
  if (!settings || !engine || !engine.modes.includes('t2v')) return null;
  const caps = getModeCaps(engine, 't2v');
  const resolution = resolveExampleResolution(engine, 't2v', settings.resolution);
  // Match the coupled constraint in generate/request-options and fal-request.
  const longLtxFast = ['ltx-2-fast', 'ltx-2-3-fast'].includes(engine.id) && settings.durationSec > 10;
  if (settings.durationSec > engine.maxDurationSec ||
    !resolution || (longLtxFast && resolution !== '1080p') ||
    !(caps?.aspectRatio ?? engine.aspectRatios).includes(settings.aspectRatio) ||
    (settings.audio && !engine.audio) ||
    (!settings.audio && engine.audio && !caps?.audioToggle)) return null;
  const form = coerceFormState(engine, 't2v', {
    engineId: engine.id, mode: 't2v', durationSec: settings.durationSec,
    durationOption: settings.durationSec, resolution,
    aspectRatio: settings.aspectRatio, audio: settings.audio,
    fps: longLtxFast ? 25 : engine.fps?.[0] ?? 24, iterations: 1, extraInputValues: {},
  });
  // Reject unsupported durations/frames instead of silently selecting a different price scenario.
  if (form.durationSec !== settings.durationSec || form.resolution !== resolution ||
    form.aspectRatio !== settings.aspectRatio || form.audio !== settings.audio || (longLtxFast && form.fps !== 25)) return null;
  return {
    schemaVersion: 1, surface: 'video', engineId: engine.id, inputMode: 't2v',
    prompt: video.prompt ?? video.promptExcerpt ?? '', negativePrompt: '',
    core: {
      durationSec: settings.durationSec, durationOption: form.durationOption,
      numFrames: form.numFrames, resolution,
      aspectRatio: settings.aspectRatio, audio: settings.audio, fps: form.fps, iterationCount: 1,
    },
    advanced: {},
    // Comparisons reuse text only. Neither source references nor the visitor's old inputs are inherited.
    refs: { inputs: [], elements: [] },
    meta: { source: 'example-comparison' },
  };
}
