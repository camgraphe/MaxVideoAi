export class BytePlusSeedreamError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: unknown;

  constructor(message: string, options: { code: string; status?: number; detail?: unknown }) {
    super(message);
    this.name = 'BytePlusSeedreamError';
    this.code = options.code;
    this.status = options.status ?? 500;
    this.detail = options.detail ?? null;
  }
}

