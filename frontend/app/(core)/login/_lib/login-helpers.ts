import { LOCALE_OPTIONS, type Locale } from './login-copy';

export const DEFAULT_NEXT_PATH = '/generate';
export const NEXT_PATH_PREFIXES = ['/app', '/generate', '/dashboard', '/jobs', '/billing', '/settings', '/admin', '/connect'];
export const PENDING_GOOGLE_LOGIN_STORAGE_KEY = 'mvai.pending-google-login.v1';
export const PENDING_GOOGLE_LOGIN_TTL_MS = 10 * 60 * 1000;

export function detectLocale(): Locale {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.lang?.slice(0, 2).toLowerCase();
    if (attr && LOCALE_OPTIONS.includes(attr as Locale)) {
      return attr as Locale;
    }
    const match = document.cookie.match(/(?:NEXT_LOCALE|mvid_locale)=([a-z]{2})/i);
    if (match && LOCALE_OPTIONS.includes(match[1].toLowerCase() as Locale)) {
      return match[1].toLowerCase() as Locale;
    }
  }
  return 'en';
}

export function formatTemplate(template: string, replacements: Record<string, string>): string {
  return Object.entries(replacements).reduce((text, [key, value]) => text.replace(`{${key}}`, value), template);
}

export function sanitizeNextPath(candidate: string | null | undefined): string {
  if (typeof candidate !== 'string') return DEFAULT_NEXT_PATH;
  const trimmed = candidate.trim();
  if (!trimmed.startsWith('/')) return DEFAULT_NEXT_PATH;
  if (trimmed === '/' || trimmed.startsWith('/login') || trimmed.startsWith('/api') || trimmed.startsWith('/_next')) {
    return DEFAULT_NEXT_PATH;
  }
  const pathname = trimmed.split(/[?#]/)[0] ?? trimmed;
  const isAllowed = NEXT_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return isAllowed ? trimmed : DEFAULT_NEXT_PATH;
}

export function getBrowserAuthRedirectOrigin(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

export function buildAuthCallbackRedirect(origin: string, nextPath: string): string | undefined {
  const trimmed = origin.trim();
  if (!trimmed) return undefined;
  const base = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  return `${base}/auth/callback?next=${encodeURIComponent(sanitizeNextPath(nextPath))}`;
}

export function markPendingGoogleLogin() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      PENDING_GOOGLE_LOGIN_STORAGE_KEY,
      JSON.stringify({ createdAt: Date.now() })
    );
  } catch {
    // ignore storage failures
  }
}

export function clearPendingGoogleLogin() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PENDING_GOOGLE_LOGIN_STORAGE_KEY);
  } catch {
    // ignore storage failures
  }
}

export function consumePendingGoogleLogin(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.sessionStorage.getItem(PENDING_GOOGLE_LOGIN_STORAGE_KEY);
    window.sessionStorage.removeItem(PENDING_GOOGLE_LOGIN_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { createdAt?: number } | null;
    if (!parsed || typeof parsed.createdAt !== 'number') return false;
    return Date.now() - parsed.createdAt <= PENDING_GOOGLE_LOGIN_TTL_MS;
  } catch {
    return false;
  }
}
