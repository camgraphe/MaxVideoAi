import type { AlibabaModelRoute } from './model-map';

export type AlibabaMediaType =
  | 'first_frame'
  | 'last_frame'
  | 'reference_image'
  | 'reference_video'
  | 'reference_audio'
  | 'file'
  | 'link';

export type AlibabaMedia = {
  type: AlibabaMediaType;
  url: string;
};

export type AlibabaVideoResolution = '480P' | '720P' | '1080P';

export type AlibabaVideoPayload = {
  model: AlibabaModelRoute['model'];
  input: {
    prompt?: string;
    media?: AlibabaMedia[];
  };
  parameters: {
    resolution: AlibabaVideoResolution;
    ratio?: string;
    duration: number;
    audio?: boolean;
    prompt_extend?: boolean;
    watermark: false;
    seed?: number;
  };
};

export type AlibabaTaskOutput = {
  task_id?: string;
  task_status?: string;
  video_url?: string;
  code?: string;
  message?: string;
};

export type AlibabaTaskUsage = {
  duration?: number;
  input_video_duration?: number;
  output_video_duration?: number;
  fps?: number;
  SR?: number;
  ratio?: string;
  video_count?: number;
};

export type AlibabaTaskResponse = {
  request_id?: string;
  output?: AlibabaTaskOutput;
  usage?: AlibabaTaskUsage;
  code?: string;
  message?: string;
};

export type AlibabaReferenceAsset = {
  url: string;
  mimeType?: string | null;
  durationSec?: number | null;
  hasAlpha?: boolean | null;
};
