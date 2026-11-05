/** Sanitized provider evidence only: never include a raw body, prompt, URL or key. */
export class OpenAIImageError extends Error {
  readonly status: number;
  readonly code: string;
  readonly submissionState: 'not_submitted' | 'uncertain' | 'definitive';
  readonly requestId: string | null;
  constructor(message: string, options: { status?: number; code?: string; submissionState?: 'not_submitted' | 'uncertain' | 'definitive'; requestId?: unknown } = {}) {
    super(message);
    this.name = 'OpenAIImageError';
    this.status = options.status ?? 502;
    this.code = options.code ?? 'OPENAI_IMAGE_ERROR';
    this.submissionState = options.submissionState ?? 'not_submitted';
    this.requestId = typeof options.requestId === 'string' && /^[a-zA-Z0-9_-]{1,200}$/u.test(options.requestId) ? options.requestId : null;
  }
}
