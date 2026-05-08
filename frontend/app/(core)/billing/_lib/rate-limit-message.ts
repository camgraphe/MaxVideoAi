export function formatRetryAfter(seconds: number): string {
  const normalizedSeconds = Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 60;
  if (normalizedSeconds >= 60 * 60) {
    return `${Math.ceil(normalizedSeconds / (60 * 60))} h`;
  }
  if (normalizedSeconds >= 60) {
    return `${Math.ceil(normalizedSeconds / 60)} min`;
  }
  return `${normalizedSeconds} s`;
}

export function formatRateLimitMessage(template: string, seconds: number): string {
  const retryAfter = formatRetryAfter(seconds);
  return template
    .replace('{time}', retryAfter)
    .replace('{seconds}s', retryAfter)
    .replace('{seconds}', retryAfter);
}
