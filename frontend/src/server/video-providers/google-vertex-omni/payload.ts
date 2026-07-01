import type { GeneratePayload } from '@/lib/fal';
import type { Mode } from '@/types/engines';
import { resolveGoogleVertexOmniModelRoute, type GoogleVertexOmniMode } from './model-map';
import {
  buildOmniReferenceImageInputs,
  buildOmniSourceImageInput,
  buildOmniSourceVideoInput,
  type GoogleVertexOmniMediaInput,
} from './media-input';

type GoogleVertexOmniTask = 'text_to_video' | 'image_to_video' | 'reference_to_video' | 'edit';

export type GoogleVertexOmniPayload = {
  model: string;
  input: Array<Record<string, unknown>>;
  generation_config: {
    video_config: {
      task: GoogleVertexOmniTask;
    };
  };
  response_format: {
    type: 'video';
    aspect_ratio: '16:9' | '9:16';
  };
  background: true;
  store: boolean;
  previous_interaction_id?: string;
};

type BuildGoogleVertexOmniPayloadParams = {
  engineId: string;
  mode: Mode | string;
  prompt: string;
  negativePrompt?: string | null;
  aspectRatio: string | null;
  falPayload: GeneratePayload;
};

const OMNI_TASK_BY_MODE: Record<GoogleVertexOmniMode, GoogleVertexOmniTask> = {
  t2v: 'text_to_video',
  i2v: 'image_to_video',
  ref2v: 'reference_to_video',
  v2v: 'edit',
  retake: 'edit',
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringFromExtra(extra: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = extra[key];
    if (typeof value === 'string' && value.trim().length) return value.trim();
  }
  return null;
}

function booleanFromExtra(extra: Record<string, unknown>, ...keys: string[]): boolean | null {
  for (const key of keys) {
    const value = extra[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
      if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    }
  }
  return null;
}

function normalizeAspectRatio(value: string | null | undefined): '16:9' | '9:16' {
  if (value === '16:9' || value === '9:16') return value;
  throw new Error('Gemini Omni Flash supports only 16:9 and 9:16 aspect ratios.');
}

function appendPromptDirective(lines: string[], label: string, value: string | null) {
  if (value) lines.push(`${label}: ${value}`);
}

function buildPromptText(params: { prompt: string; mode: Mode | string; extra: Record<string, unknown> }): string {
  const lines = [params.prompt.trim()];
  appendPromptDirective(lines, 'Camera direction', stringFromExtra(params.extra, 'prompt_camera_direction', 'promptCameraDirection'));
  appendPromptDirective(lines, 'Sound direction', stringFromExtra(params.extra, 'prompt_audio_direction', 'promptAudioDirection'));
  appendPromptDirective(lines, 'Edit instruction', stringFromExtra(params.extra, 'prompt_edit_instruction', 'promptEditInstruction'));
  return lines.filter(Boolean).join('\n\n');
}

function addMediaInput(input: Array<Record<string, unknown>>, media: GoogleVertexOmniMediaInput | null) {
  if (media) input.push(media);
}

function addMediaInputs(input: Array<Record<string, unknown>>, media: GoogleVertexOmniMediaInput[]) {
  media.forEach((item) => input.push(item));
}

export async function buildGoogleVertexOmniPayload(
  params: BuildGoogleVertexOmniPayloadParams
): Promise<GoogleVertexOmniPayload> {
  const route = resolveGoogleVertexOmniModelRoute(params.engineId);
  const mode = params.mode as GoogleVertexOmniMode;
  const task = OMNI_TASK_BY_MODE[mode];
  if (!task) {
    throw new Error('Gemini Omni Flash does not support the selected mode.');
  }
  if (params.negativePrompt?.trim()) {
    throw new Error('Gemini Omni Flash does not support negative prompt.');
  }
  if (typeof params.falPayload.seed === 'number') {
    throw new Error('Gemini Omni Flash does not support seed.');
  }

  const prompt = params.prompt.trim();
  if (!prompt) {
    throw new Error('Gemini Omni Flash requires a prompt.');
  }

  const extra = asRecord(params.falPayload.extraInputValues);
  const input: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: buildPromptText({ prompt, mode: params.mode, extra }),
    },
  ];

  if (mode === 'i2v') {
    const sourceImage = buildOmniSourceImageInput(params.falPayload);
    if (!sourceImage) throw new Error('Gemini Omni Flash image-to-video requires a source image.');
    addMediaInput(input, sourceImage);
  }

  if (mode === 'ref2v') {
    const references = buildOmniReferenceImageInputs(params.falPayload);
    if (!references.length) throw new Error('Gemini Omni Flash reference-to-video requires reference images.');
    addMediaInputs(input, references);
  }

  if (mode === 'v2v') {
    const sourceVideo = buildOmniSourceVideoInput(params.falPayload);
    if (!sourceVideo) throw new Error('Gemini Omni Flash video edit requires a source video.');
    addMediaInput(input, sourceVideo);
  }

  const previousInteractionId = stringFromExtra(extra, 'previous_interaction_id', 'previousInteractionId');
  if (mode === 'retake' && !previousInteractionId) {
    throw new Error('Gemini Omni Flash refine mode requires a previous interaction id.');
  }

  const payload: GoogleVertexOmniPayload = {
    model: route.providerModel,
    input,
    generation_config: {
      video_config: {
        task,
      },
    },
    response_format: {
      type: 'video',
      aspect_ratio: normalizeAspectRatio(params.aspectRatio ?? params.falPayload.aspectRatio ?? '16:9'),
    },
    background: true,
    store: booleanFromExtra(extra, 'store_interaction', 'storeInteraction') ?? false,
  };

  if (previousInteractionId) {
    payload.previous_interaction_id = previousInteractionId;
  }

  return payload;
}
