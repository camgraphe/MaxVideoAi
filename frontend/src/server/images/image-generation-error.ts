import type {
  ImageGenerationMode,
  ImageGenerationResponse,
} from '@/types/image-generation';

export class ImageGenerationExecutionError extends Error {
  mode: ImageGenerationMode;
  status: number;
  code: string;
  detail?: unknown;
  extras?: Partial<ImageGenerationResponse>;

  constructor(
    message: string,
    options?: {
      mode?: ImageGenerationMode;
      status?: number;
      code?: string;
      detail?: unknown;
      extras?: Partial<ImageGenerationResponse>;
    }
  ) {
    super(message);
    this.name = 'ImageGenerationExecutionError';
    this.mode = options?.mode ?? 't2i';
    this.status = options?.status ?? 500;
    this.code = options?.code ?? 'image_generation_failed';
    this.detail = options?.detail;
    this.extras = options?.extras;
  }
}

export function failImageGenerationExecution(
  mode: ImageGenerationMode,
  code: string,
  message: string,
  status: number,
  detail?: unknown,
  extras?: Partial<ImageGenerationResponse>
): never {
  throw new ImageGenerationExecutionError(message, { mode, code, status, detail, extras });
}
