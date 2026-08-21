import type { AppLocale } from '@/i18n/locales';

export type ModelExamplesUiCopy = {
  viewAllLabel: string;
  renderLabel: string;
  openLabel: string;
  silentLabel: string;
  audioOnLabel: string;
  audioOffLabel: string;
  noPreviewLabel: string;
  numberedExampleLabel: string;
  emptyTemplate: string;
};

const COPY: Record<AppLocale, ModelExamplesUiCopy> = {
  en: { viewAllLabel: 'View all examples', renderLabel: 'View render', openLabel: 'Open', silentLabel: 'Silent', audioOnLabel: 'Audio on', audioOffLabel: 'Audio off', noPreviewLabel: 'No preview', numberedExampleLabel: 'example', emptyTemplate: 'No {model} examples match this filter yet.' },
  fr: { viewAllLabel: 'Voir tous les exemples', renderLabel: 'Voir le rendu', openLabel: 'Ouvrir', silentLabel: 'Silencieux', audioOnLabel: 'Audio activé', audioOffLabel: 'Audio coupé', noPreviewLabel: 'No preview', numberedExampleLabel: 'exemple', emptyTemplate: 'Aucun exemple {model} ne correspond encore à ce filtre.' },
  es: { viewAllLabel: 'Ver todos los ejemplos', renderLabel: 'Ver resultado', openLabel: 'Abrir', silentLabel: 'Sin audio', audioOnLabel: 'Audio activado', audioOffLabel: 'Audio desactivado', noPreviewLabel: 'No preview', numberedExampleLabel: 'ejemplo', emptyTemplate: 'Todavía no hay ejemplos de {model} para este filtro.' },
};

export function getModelExamplesUiCopy(locale: AppLocale): ModelExamplesUiCopy {
  return COPY[locale];
}

export function formatEmptyExamplesLabel(copy: ModelExamplesUiCopy, modelName: string): string {
  return copy.emptyTemplate.replace('{model}', modelName);
}
