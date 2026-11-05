import type { AppLocale } from '@/i18n/locales';
import { MODEL_FAMILIES, type ModelFamilyDefinition } from '@/config/model-families';
import { normalizeFamilyExamplesPageConfig } from '@/config/model-publication';
import { isRuntimeModelPublicCurrent, listRuntimeModels, type RuntimeModelEntry } from '@/config/model-runtime';
import { EN_KLING_V4_ADDITION, EN_KLING_V4_FLASH_ADDITION, EN_MODEL_DATA } from '@/lib/examples/modelLandingData.en';
import { ES_KLING_V4_ADDITION, ES_KLING_V4_FLASH_ADDITION, ES_MODEL_DATA } from '@/lib/examples/modelLandingData.es';
import { FR_KLING_V4_ADDITION, FR_KLING_V4_FLASH_ADDITION, FR_MODEL_DATA } from '@/lib/examples/modelLandingData.fr';
import type { CanonicalExampleModelSlug, LocalizedModelDescriptor } from '@/lib/examples/modelLandingTypes';

export function getLocalizedModelData(
  locale: AppLocale,
  families: readonly ModelFamilyDefinition[] = MODEL_FAMILIES,
  models: readonly RuntimeModelEntry[] = listRuntimeModels(),
): Partial<Record<CanonicalExampleModelSlug, LocalizedModelDescriptor>> {
  const data = locale === 'fr' ? FR_MODEL_DATA : locale === 'es' ? ES_MODEL_DATA : EN_MODEL_DATA;
  const kling = data.kling;
  const examples = normalizeFamilyExamplesPageConfig(families.find((family) => family.id === 'kling')?.examplesPage);
  if (!kling || examples.stage === 'hidden') return data;
  const additions = [
    { id: 'kling-v4', copy: locale === 'fr' ? FR_KLING_V4_ADDITION : locale === 'es' ? ES_KLING_V4_ADDITION : EN_KLING_V4_ADDITION },
    { id: 'kling-v4-flash', copy: locale === 'fr' ? FR_KLING_V4_FLASH_ADDITION : locale === 'es' ? ES_KLING_V4_FLASH_ADDITION : EN_KLING_V4_FLASH_ADDITION },
  ].filter(({ id }) => {
    const model = models.find((entry) => entry.id === id);
    return isRuntimeModelPublicCurrent(model) && model?.publication.examples.includeInFamilyCopy &&
      examples.publishedModelSlugs.includes(model.slug);
  }).map(({ copy }) => copy);
  if (!additions.length) return data;
  return {
    ...data,
    kling: {
      ...kling,
      summary: [...additions.map((addition) => addition.summary), kling.summary].filter(Boolean).join(' '),
      promptPatterns: [kling.promptPatterns, ...additions.map((addition) => addition.promptPatterns)].join(' '),
      strengthsLimits: [kling.strengthsLimits, ...additions.map((addition) => addition.strengthsLimits)].join(' '),
      faq: [...kling.faq, ...additions.flatMap((addition) => addition.faq)],
    },
  };
}
