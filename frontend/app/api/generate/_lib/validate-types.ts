export type ValidationError = {
  code: string;
  message: string;
  field?: string;
  allowed?: Array<string | number>;
  value?: unknown;
};

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: ValidationError };
