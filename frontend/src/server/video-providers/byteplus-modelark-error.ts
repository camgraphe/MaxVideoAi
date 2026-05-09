export class BytePlusModelArkError extends Error {
  status: number | null;
  code: string | null;
  providerMessage: string | null;

  constructor(message: string, options: { status?: number | null; code?: string | null; providerMessage?: string | null } = {}) {
    super(message);
    this.name = 'BytePlusModelArkError';
    this.status = options.status ?? null;
    this.code = options.code ?? null;
    this.providerMessage = options.providerMessage ?? null;
  }
}
