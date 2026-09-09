/** Validate before passing a continuation to URL/NextResponse (which normalize slashes). */
export function safeInternalReturnTarget(candidate: string | null | undefined, fallback = '/app'): string {
  const value = candidate?.trim() ?? '';
  if (!value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const base = 'https://continuation.invalid';
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
