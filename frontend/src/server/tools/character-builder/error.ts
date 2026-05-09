export class CharacterBuilderError extends Error {
  status: number;
  code: string;
  detail?: unknown;

  constructor(message: string, options?: { status?: number; code?: string; detail?: unknown }) {
    super(message);
    this.name = 'CharacterBuilderError';
    this.status = options?.status ?? 500;
    this.code = options?.code ?? 'character_builder_error';
    this.detail = options?.detail;
  }
}
