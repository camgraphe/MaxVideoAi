import { LOCALE_OPTIONS, type AuthMode, type Locale } from './login-copy';

export type LoginQueryValue = string | string[] | undefined;

export function resolveInitialAuthMode(value: LoginQueryValue): AuthMode {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === 'signin' || candidate === 'reset' || candidate === 'signup'
    ? candidate
    : 'signup';
}

export function resolveInitialAuthLocale(
  ...candidates: Array<string | null | undefined>
): Locale {
  for (const candidate of candidates) {
    const normalized = candidate?.trim().slice(0, 2).toLowerCase();
    if (normalized && LOCALE_OPTIONS.includes(normalized as Locale)) {
      return normalized as Locale;
    }
  }
  return 'en';
}
