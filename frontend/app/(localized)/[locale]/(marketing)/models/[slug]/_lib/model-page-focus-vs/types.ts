import type { AppLocale } from '@/i18n/locales';

export type FocusVsCopy = { title: string; items: string[] };
export type FocusVsLocalizedCopy = Record<AppLocale, FocusVsCopy>;
export type FocusVsPair = {
  slugA: string;
  slugB: string;
  nameA: string;
  nameB: string;
  copyA: FocusVsLocalizedCopy;
  copyB: FocusVsLocalizedCopy;
  onlyFor?: string[];
};

export type FocusVsConfig = {
  title: string;
  ctaLabel: string;
  ctaSlug: string;
  leftTitle: string;
  leftItems: string[];
  rightTitle: string;
  rightItems: string[];
};
