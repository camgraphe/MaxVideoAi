import { en } from './dictionary-data/en';
import { fr } from './dictionary-data/fr';
import type { Dictionary, Locale } from './dictionary-types';

const dictionaries: Record<Locale, Dictionary> = { en, fr };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries.en;
}

export type { Dictionary, Locale } from './dictionary-types';
