import enMessages from '@/messages/en.json';
import esMessages from '@/messages/es.json';
import frMessages from '@/messages/fr.json';

export type AuthMode = 'signin' | 'signup' | 'reset';

export const AUTH_COPY = {
  en: enMessages.auth,
  fr: frMessages.auth,
  es: esMessages.auth,
} as const;

export type Locale = keyof typeof AUTH_COPY;
export type AuthCopy = (typeof AUTH_COPY)[Locale];

export const LOCALE_OPTIONS: Locale[] = ['en', 'fr', 'es'];
