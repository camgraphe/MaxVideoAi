export class GoogleVertexImageError extends Error {
  status: number | null;
  code: string;
  detail: unknown;

  constructor(message: string, options: { status?: number; code?: string; detail?: unknown; cause?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'GoogleVertexImageError';
    this.status = options.status ?? null;
    this.code = options.code ?? 'GOOGLE_VERTEX_IMAGE_ERROR';
    this.detail = options.detail ?? null;
  }
}
