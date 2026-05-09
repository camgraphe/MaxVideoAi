export class FalGenerationError extends Error {
  status?: number;
  body?: unknown;
  providerJobId?: string;

  constructor(
    message: string,
    options: { status?: number; body?: unknown; providerJobId?: string; cause?: unknown } = {}
  ) {
    super(message);
    this.name = 'FalGenerationError';
    this.status = options.status;
    this.body = options.body;
    this.providerJobId = options.providerJobId;
    if (options.cause) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}
