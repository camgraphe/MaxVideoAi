export function getSitemapTimestamp(input?: string | number | Date | null): string {
  if (!input) {
    return new Date().toISOString();
  }
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}
