const MAX_TRIAL_OUTPUT_URL_LENGTH = 2_048;

export function isUsableTrialOutputUrl(value: unknown): value is string {
  if (typeof value !== 'string'
    || value.length < 1
    || value.length > MAX_TRIAL_OUTPUT_URL_LENGTH
    || value !== value.trim()
    || /\s/u.test(value)) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:'
      && parsed.username === ''
      && parsed.password === ''
      && parsed.hostname.length > 0
      && parsed.origin !== 'null';
  } catch {
    return false;
  }
}
