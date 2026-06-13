export class BackgroundRemovalToolError extends Error {
  status: number;
  code: string;
  detail?: unknown;

  constructor(message: string, options?: { status?: number; code?: string; detail?: unknown }) {
    super(message);
    this.name = 'BackgroundRemovalToolError';
    this.status = options?.status ?? 500;
    this.code = options?.code ?? 'background_removal_error';
    this.detail = options?.detail;
  }
}
