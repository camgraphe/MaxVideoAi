import type { GeneratePayload } from '@/lib/fal';
import type { Mode } from '@/types/engines';
import { parseGoogleVertexGcsPrefix } from '../google-vertex-gcs';
import { resolveGoogleVertexOmniModelRoute, type GoogleVertexOmniMode } from './model-map';
import {
  buildOmniEndImageInput,
  buildOmniReferenceImageInputs,
  buildOmniSourceImageInput,
  buildOmniSourceVideoInput,
  type GoogleVertexOmniMediaInput,
} from './media-input';

type GoogleVertexOmniTask = 'text_to_video' | 'image_to_video' | 'reference_to_video' | 'edit' | 'extend';

export type GoogleVertexOmniPayload = {
  model: string;
  input: Array<Record<string, unknown>>;
  generation_config: {
    video_config: {
      task: GoogleVertexOmniTask;
    };
  };
  response_format: Array<{
    type: 'video';
    delivery: 'uri';
    gcs_uri: string;
    resolution: '360p' | '720p' | '1080p' | '4k';
    aspect_ratio?: '16:9' | '9:16';
    duration?: `${number}s`;
  }>;
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
  durationSec: number;
  resolution: string;
  outputGcsUri: string;
  falPayload: GeneratePayload;
};

const OMNI_TASK_BY_MODE: Record<GoogleVertexOmniMode, GoogleVertexOmniTask> = {
  t2v: 'text_to_video',
  i2v: 'image_to_video',
  ref2v: 'reference_to_video',
  fl2v: 'image_to_video',
  v2v: 'edit',
  extend: 'extend',
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

function normalizeAspectRatio(value: string | null | undefined): '16:9' | '9:16' {
  if (value === '16:9' || value === '9:16') return value;
  throw new Error('Gemini Omni Flash supports only 16:9 and 9:16 aspect ratios.');
}

function normalizeDuration(value: number): `${number}s` {
  if (!Number.isInteger(value) || value < 3 || value > 10) {
    throw new Error('Gemini Omni Flash supports integer durations from 3 to 10 seconds.');
  }
  return `${value}s`;
}

function normalizeResolution(value: string): '360p' | '720p' | '1080p' | '4k' {
  if (value === '360p' || value === '720p' || value === '1080p' || value === '4k') return value;
  throw new Error('Gemini Omni Flash supports 360p, 720p, 1080p, and 4k output.');
}

function normalizeOutputGcsUri(value: string): string {
  const normalized = value.trim();
  if (!/^gs:\/\/[^/]+\/.+\/$/.test(normalized)) {
    throw new Error('Google Vertex Omni output GCS URI is missing or invalid.');
  }
  return normalized;
}

export function buildGoogleVertexOmniOutputGcsUri(prefix: string, jobId: string): string {
  const parsed = parseGoogleVertexGcsPrefix(prefix);
  if (!parsed) throw new Error('Google Vertex Omni output GCS prefix is missing or invalid.');
  const safeJobId = jobId.trim().replace(/[^a-zA-Z0-9_-]+/g, '-');
  if (!safeJobId) throw new Error('Google Vertex Omni output job id is invalid.');
  return `gs://${parsed.bucket}/${parsed.prefix}omni-outputs/${safeJobId}/`;
}

function appendPromptDirective(lines: string[], label: string, value: string | null) {
  if (value) lines.push(`${label}: ${value}`);
}

function buildPromptText(params: { prompt: string; mode: Mode | string; extra: Record<string, unknown> }): string {
  const prompt = params.prompt.trim();
  const lines =
    params.mode === 'i2v'
      ? [`[# Sources <FIRST_FRAME>@Image1] ${prompt}`, 'Use Image1 as the starting frame.']
      : params.mode === 'fl2v'
        ? [
            `[# Sources <FIRST_FRAME>@Image1 <LAST_FRAME>@Image2] ${prompt}`,
            'Use Image1 as the starting frame and Image2 as the ending frame.',
          ]
      : params.mode === 'ref2v'
        ? [prompt, 'Use the given image(s) as references for video generation. The images should not be used as literal initial frames.']
        : [prompt];
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

  if (mode === 'fl2v') {
    const sourceImage = buildOmniSourceImageInput(params.falPayload);
    const endImage = buildOmniEndImageInput(params.falPayload);
    if (!sourceImage || !endImage) {
      throw new Error('Gemini Omni Flash first/last-frame mode requires both source images.');
    }
    addMediaInput(input, sourceImage);
    addMediaInput(input, endImage);
  }

  if (mode === 'ref2v') {
    const references = buildOmniReferenceImageInputs(params.falPayload);
    if (!references.length) throw new Error('Gemini Omni Flash reference-to-video requires reference images.');
    addMediaInputs(input, references);
  }

  if (mode === 'v2v' || mode === 'extend') {
    const sourceVideo = buildOmniSourceVideoInput(params.falPayload);
    if (!sourceVideo) {
      throw new Error(
        mode === 'extend'
          ? 'Gemini Omni Flash extension requires a source video.'
          : 'Gemini Omni Flash video edit requires a source video.'
      );
    }
    addMediaInput(input, sourceVideo);
  }

  const previousInteractionId = stringFromExtra(extra, 'previous_interaction_id', 'previousInteractionId');
  if (mode === 'retake' && !previousInteractionId) {
    throw new Error('Gemini Omni Flash refine mode requires a previous interaction id.');
  }

  const outputGcsUri = normalizeOutputGcsUri(params.outputGcsUri);
  const resolution = normalizeResolution(params.resolution);
  const responseFormat: GoogleVertexOmniPayload['response_format'] =
    task === 'edit'
      ? [{ type: 'video', delivery: 'uri', gcs_uri: outputGcsUri, resolution }]
      : [
          {
            type: 'video',
            aspect_ratio: normalizeAspectRatio(params.aspectRatio ?? params.falPayload.aspectRatio ?? '16:9'),
            delivery: 'uri',
            gcs_uri: outputGcsUri,
            resolution,
            duration: normalizeDuration(params.durationSec),
          },
        ];

  const payload: GoogleVertexOmniPayload = {
    model: route.providerModel,
    input,
    generation_config: {
      video_config: {
        task,
      },
    },
    response_format: responseFormat,
    background: true,
    store: true,
  };

  if (previousInteractionId) {
    payload.previous_interaction_id = previousInteractionId;
  }

  return payload;
}
