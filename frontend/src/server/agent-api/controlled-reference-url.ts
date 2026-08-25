export const MAX_CONTROLLED_REFERENCE_URL_CHARS = 4_096;

const EMBEDDED_WHITESPACE_PATTERN = /\s/u;

export class ControlledReferenceUrlError extends Error {
  constructor() {
    super('A controlled HTTPS reference URL is required.');
    this.name = 'ControlledReferenceUrlError';
  }
}

export function normalizeControlledHttpsReferenceUrl(value: unknown): string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > MAX_CONTROLLED_REFERENCE_URL_CHARS
    || EMBEDDED_WHITESPACE_PATTERN.test(value)
  ) {
    throw new ControlledReferenceUrlError();
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ControlledReferenceUrlError();
  }
  if (
    parsed.protocol !== 'https:'
    || !parsed.hostname
    || parsed.username.length > 0
    || parsed.password.length > 0
    || parsed.hash.length > 0
    || (parsed.port.length > 0 && parsed.port !== '443')
  ) {
    throw new ControlledReferenceUrlError();
  }

  const canonicalUrl = parsed.toString();
  if (canonicalUrl.length > MAX_CONTROLLED_REFERENCE_URL_CHARS) {
    throw new ControlledReferenceUrlError();
  }
  return canonicalUrl;
}
