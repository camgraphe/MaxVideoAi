export class AngleToolError extends Error {
  status: number;
  code: string;
  detail?: unknown;

  constructor(message: string, options?: { status?: number; code?: string; detail?: unknown }) {
    super(message);
    this.name = 'AngleToolError';
    this.status = options?.status ?? 500;
    this.code = options?.code ?? 'angle_tool_error';
    this.detail = options?.detail;
  }
}
