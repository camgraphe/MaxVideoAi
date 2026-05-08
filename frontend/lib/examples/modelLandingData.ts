import type { AppLocale } from '@/i18n/locales';
import { EN_MODEL_DATA } from '@/lib/examples/modelLandingData.en';
import { ES_MODEL_DATA } from '@/lib/examples/modelLandingData.es';
import { FR_MODEL_DATA } from '@/lib/examples/modelLandingData.fr';
import type { CanonicalExampleModelSlug, LocalizedModelDescriptor } from '@/lib/examples/modelLandingTypes';

export function getLocalizedModelData(
  locale: AppLocale
): Partial<Record<CanonicalExampleModelSlug, LocalizedModelDescriptor>> {
  if (locale === 'fr') return FR_MODEL_DATA;
  if (locale === 'es') return ES_MODEL_DATA;
  return EN_MODEL_DATA;
}
