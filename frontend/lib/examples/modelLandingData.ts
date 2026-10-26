import type { AppLocale } from '@/i18n/locales';
import { MODEL_FAMILIES, type ModelFamilyDefinition } from '@/config/model-families';
import { normalizeFamilyExamplesPageConfig } from '@/config/model-publication';
import { isRuntimeModelPublicCurrent, listRuntimeModels, type RuntimeModelEntry } from '@/config/model-runtime';
import { EN_KLING_V4_ADDITION, EN_MODEL_DATA } from '@/lib/examples/modelLandingData.en';
import { ES_KLING_V4_ADDITION, ES_MODEL_DATA } from '@/lib/examples/modelLandingData.es';
import { FR_KLING_V4_ADDITION, FR_MODEL_DATA } from '@/lib/examples/modelLandingData.fr';
import type { CanonicalExampleModelSlug, LocalizedModelDescriptor } from '@/lib/examples/modelLandingTypes';

export function getLocalizedModelData(
  locale: AppLocale,
  families: readonly ModelFamilyDefinition[] = MODEL_FAMILIES,
  models: readonly RuntimeModelEntry[] = listRuntimeModels(),
): Partial<Record<CanonicalExampleModelSlug, LocalizedModelDescriptor>> {
  const data = locale === 'fr' ? FR_MODEL_DATA : locale === 'es' ? ES_MODEL_DATA : EN_MODEL_DATA;
  const kling = data.kling;
  const model = models.find((entry) => entry.id === 'kling-v4');
  const examples = normalizeFamilyExamplesPageConfig(families.find((family) => family.id === 'kling')?.examplesPage);
  if (!kling || !isRuntimeModelPublicCurrent(model) || !model?.publication.examples.includeInFamilyCopy ||
      examples.stage === 'hidden' || !examples.publishedModelSlugs.includes(model.slug)) return data;
  const addition = locale === 'fr' ? FR_KLING_V4_ADDITION : locale === 'es' ? ES_KLING_V4_ADDITION : EN_KLING_V4_ADDITION;
  return {
    ...data,
    kling: {
      ...kling,
      summary: [addition.summary, kling.summary].filter(Boolean).join(' '),
      promptPatterns: `${kling.promptPatterns} ${addition.promptPatterns}`,
      strengthsLimits: `${kling.strengthsLimits} ${addition.strengthsLimits}`,
      faq: [...kling.faq, ...addition.faq],
    },
  };
}
