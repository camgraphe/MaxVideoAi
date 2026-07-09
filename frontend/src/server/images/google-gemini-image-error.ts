export class GoogleGeminiImageError extends Error {
  code?: string;
  status?: number;
  detail?: unknown;

  constructor(message: string, options: { code?: string; status?: number; detail?: unknown; cause?: unknown } = {}) {
    super(message);
    this.name = 'GoogleGeminiImageError';
    this.code = options.code;
    this.status = options.status;
    this.detail = options.detail;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}
