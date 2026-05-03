export function hasStoredSupabaseSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const hasStorageSession = Object.keys(window.localStorage ?? {}).some(
      (key) => key.startsWith('sb-') && key.includes('auth-token')
    );
    if (hasStorageSession) return true;
  } catch {
    // Ignore storage access errors and fall back to cookies.
  }
  return /(?:^|;\s*)sb-[^=;]*auth-token=/.test(document.cookie);
}
