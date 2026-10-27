export class GoogleVertexImageError extends Error {
  status: number | null;
  code: string;
  detail: unknown;
  /** Nano21 image POST evidence; auth/reference transport is not an image submission. */
  submissionState?: 'not_submitted' | 'uncertain' | 'definitive';
  /** Bounded printable evidence from parsed JSON; never an unparsed response body. */
  responseId: string | null;

  constructor(message: string, options: { status?: number; code?: string; detail?: unknown; cause?: unknown;
    submissionState?: 'not_submitted' | 'uncertain' | 'definitive'; responseId?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'GoogleVertexImageError';
    this.status = options.status ?? null;
    this.code = options.code ?? 'GOOGLE_VERTEX_IMAGE_ERROR';
    this.detail = options.detail ?? null;
    this.submissionState = options.submissionState;
    this.responseId = typeof options.responseId === 'string' && /^[\x21-\x7e]{1,512}$/.test(options.responseId)
      ? options.responseId : null;
  }
}
