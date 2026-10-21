import type { EngineCaps, EngineInputField } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';

// Provider schema captured 2026-10-21. Publication and execution remain independently closed.
export const KLING_V4_ID = 'kling-v4' as const;
export const KLING_V4_MODES = ['t2v', 'i2v', 'ref2v', 'v2v'] as const;
export const KLING_V4_ENDPOINTS = {
  t2v: 'kling/v4/text-to-video', i2v: 'kling/v4/image-to-video',
  ref2v: 'kling/v4/reference-to-video', v2v: 'kling/v4/video-to-video/edit',
} as const;
export const KLING_V4_DURATIONS = Array.from({ length: 28 }, (_, index) => String(index + 3));
export const KLING_V4_RESOLUTIONS = ['720p', '1080p'] as const;
export const KLING_V4_ASPECT_RATIOS = ['16:9', '9:16', '1:1', '21:9'] as const;
const modes = [...KLING_V4_MODES];
const imageInput: Partial<EngineInputField> = {
  source: 'either', minCount: 0, maxCount: 1, maxSizeMB: 30,
  imageAspectRatio: { min: 0.4, max: 2.5 },
};
const videoInput: Partial<EngineInputField> = {
  source: 'either', minCount: 0, maxCount: 1, maxSizeMB: 300,
  minDurationSec: 3, maxDurationSec: 30,
};
const modeCaps: NonNullable<EngineCaps['modeCaps']> = Object.fromEntries(modes.map(mode => [mode, {
  modes: [mode], duration: { options: KLING_V4_DURATIONS, default: '5' },
  resolution: [...KLING_V4_RESOLUTIONS],
  aspectRatio: mode === 't2v' ? [...KLING_V4_ASPECT_RATIOS]
    : mode === 'ref2v' ? ['auto', ...KLING_V4_ASPECT_RATIOS] : [],
  audioToggle: false,
  notes: mode === 'v2v'
    ? 'Editing follows source framing; the provider can inherit source duration when omitted. No FPS or audio switch is documented.'
    : '3–30 whole seconds. Native audio is described in the prompt. No FPS or audio switch is documented.',
}]));

export const KLING_V4_ENGINE: EngineCaps = {
  id: KLING_V4_ID, label: 'Kling 4.0', provider: 'Kling by Kuaishou', version: '4.0',
  status: 'maintenance', availability: 'paused', latencyTier: 'standard', queueDepth: 0, region: 'global',
  modes, maxDurationSec: 30, resolutions: [...KLING_V4_RESOLUTIONS],
  aspectRatios: [...KLING_V4_ASPECT_RATIOS], fps: [], audio: true,
  upscale4k: false, extend: false, motionControls: false, keyframes: false, params: {},
  inputLimits: { promptMaxChars: 2500, promptMaxCharsSource: 'official', imageMaxMB: 30, videoMaxMB: 300, videoMaxDurationSec: 30 },
  inputSchema: {
    required: [
      { id: 'prompt', type: 'text', label: 'Prompt', modes, requiredInModes: ['v2v'], description: 'Generation accepts a prompt or multi-shot scenes. Video editing requires a prompt.' },
      { ...imageInput, id: 'image_url', engineParam: 'start_image_url', type: 'image', label: 'Opening image', modes: ['i2v', 'ref2v'], requiredInModes: ['i2v'] },
      { ...videoInput, id: 'video_url', type: 'video', label: 'Video to edit', modes: ['v2v'], requiredInModes: ['v2v'], minCount: 1 },
    ],
    optional: [
      { id: 'multi_prompt', type: 'text', label: 'Shot plan', modes: ['t2v', 'i2v', 'ref2v'], description: 'Use a prompt or a shot plan. Each scene has 1–512 prompt characters and 1–30 whole seconds; the scene durations must equal the requested 3–30 seconds. No separate provider scene-count cap is documented.' },
      { ...imageInput, id: 'end_image_url', type: 'image', label: 'Ending image', modes: ['i2v'] },
      { ...imageInput, id: 'image_urls', type: 'image', label: 'Reference images', modes: ['ref2v', 'v2v'], maxCount: 10, description: 'The reference-generation opening image also counts toward the image limit.' },
      { ...videoInput, id: 'video_urls', type: 'video', label: 'Reference videos', modes: ['ref2v'], maxCount: 5, description: 'Reference videos and video elements share a 30-second total limit.' },
      { id: 'duration', type: 'enum', label: 'Duration (seconds)', modes, values: KLING_V4_DURATIONS, default: '5', min: 3, max: 30 },
      { id: 'resolution', type: 'enum', label: 'Resolution', modes, values: [...KLING_V4_RESOLUTIONS], default: '1080p' },
      { id: 'aspect_ratio', type: 'enum', label: 'Aspect ratio', modes: ['t2v'], values: [...KLING_V4_ASPECT_RATIOS], default: '16:9' },
      { id: 'aspect_ratio', type: 'enum', label: 'Aspect ratio', modes: ['ref2v'], values: ['auto', ...KLING_V4_ASPECT_RATIOS], default: '16:9' },
    ],
    referenceBudget: { fieldIds: ['image_url', 'image_urls', 'video_urls'], modes: ['ref2v'], maxTotal: 15, countUniqueUrls: false, maxByType: { image: 10, video: 5 } },
    constraints: { minImageSidePx: 300, maxImageSizeMB: 30, maxVideoSizeMB: 300, maxCombinedVideoDurationSec: 30 },
  },
  // Source rates and input-video billing are owned by the dedicated pricing adapter.
  // An unpublished contract supplies neither a customer tariff nor a price hint.
  updatedAt: '2026-10-21T00:00:00Z', ttlSec: 600,
  providerMeta: { provider: 'kling', modelSlug: KLING_V4_ENDPOINTS.t2v },
  brandId: 'kling', modeCaps,
};

export const KLING_V4_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [{
  id: KLING_V4_ID, marketingName: 'Kling 4.0', cardTitle: 'Kling 4.0', provider: 'Kling by Kuaishou',
  brandId: 'kling', versionLabel: '4.0', availability: 'paused', logoPolicy: 'logoAllowed',
  engine: KLING_V4_ENGINE,
  modes: modes.map(mode => ({ mode, falModelId: KLING_V4_ENDPOINTS[mode], ui: modeCaps[mode]! })),
  defaultFalModelId: KLING_V4_ENDPOINTS.t2v,
  seo: { title: 'Kling 4.0 — video direction, references and audio | MaxVideoAI',
    description: 'Explore the documented Kling 4.0 video controls, 3–30-second scenes, reference inputs, native audio and video editing.', canonicalPath: '/models/kling-v4' },
  // Original writing draft from films.json (ignition); never presented as a rendered example.
  prompts: [{ title: 'Ignition — prepared prompt', mode: 't2v', prompt: "An adult romantic film scene in a small motorcycle repair shop at closing time. A sharp-faced woman in her fifties, with tied brown hair and one broad white streak, wears open blue coveralls over a dark vest. Her customer is a man in his sixties with an aquiline nose, carefully combed gray hair and a camel coat too elegant for the workshop. She reconnects one accessible cable on his old motorcycle, wipes her hands and turns toward the bench. He checks that she is looking away, then quietly disconnects the very same cable. In the reflection of the shop window, she sees what he has done. Let her look at him for a moment before he notices. She returns, reconnects the cable and holds his gaze. Without scolding him, she takes two plain helmets from the shelf, offers one to him and keeps the other. She says softly in English, \"You could just ask.\" His practiced composure gives way to an embarrassed, relieved smile. She smiles back. End with the two helmets between them and the invitation understood. Warm late-afternoon light, tangible grease and worn leather, restrained performances. Follow the cable only long enough to explain his excuse; give the discovery and final exchange more room. Sound: workshop ambience, the connector, cloth, helmets and her natural voice. A few quiet notes of original guitar may enter after his smile. No additional dialogue or text." }],
}];
