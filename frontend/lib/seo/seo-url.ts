export function stripOrigin(url: string | null): string {
  if (!url) return 'No target URL';
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}
