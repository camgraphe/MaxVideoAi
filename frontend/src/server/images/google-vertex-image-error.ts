export class GoogleVertexImageError extends Error {
  status: number | null;
  code: string;
  detail: unknown;
  /** Nano21 image POST evidence; auth/reference transport is not an image submission. */
  submissionState?: 'not_submitted' | 'uncertain' | 'definitive';

  constructor(message: string, options: { status?: number; code?: string; detail?: unknown; cause?: unknown;
    submissionState?: 'not_submitted' | 'uncertain' | 'definitive' } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'GoogleVertexImageError';
    this.status = options.status ?? null;
    this.code = options.code ?? 'GOOGLE_VERTEX_IMAGE_ERROR';
    this.detail = options.detail ?? null;
    this.submissionState = options.submissionState;
  }
}
