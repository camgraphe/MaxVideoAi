export class UpscaleToolError extends Error {
  status: number;
  code: string;
  detail?: unknown;

  constructor(message: string, options?: { status?: number; code?: string; detail?: unknown }) {
    super(message);
    this.name = 'UpscaleToolError';
    this.status = options?.status ?? 500;
    this.code = options?.code ?? 'upscale_tool_error';
    this.detail = options?.detail;
  }
}
