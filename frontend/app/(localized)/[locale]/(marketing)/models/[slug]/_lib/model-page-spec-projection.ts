import type { FalEngineEntry } from '@/config/falEngines';
import type { AppLocale } from '@/i18n/locales';
import { buildSpecValues, formatImageResolutions, isPending, isUnsupported, normalizeMaxResolution, resolveSpecRowDefs, resolveSpecRowLabel, type KeySpecRow } from './model-page-specs';
import type { buildModelPagePriceProjection } from './model-page-pricing';

/** Current labels alone may populate commercial specs; critical specs omit prices. */
export function buildModelPageSpecProjection({ engine, locale, isImageEngine, showPriceInSpecs, keySpecs, projection }: {
  engine: FalEngineEntry; locale: AppLocale; isImageEngine: boolean; showPriceInSpecs: boolean;
  keySpecs?: Record<string, unknown>;
  projection?: Awaited<ReturnType<typeof buildModelPagePriceProjection>>;
}) {
  const { pricePerSecondLabel = null, pricePerImageLabel = null, priceRows = [] } = projection ?? {};
  const keySpecValues = buildSpecValues(engine, keySpecs, {
    pricePerSecond: pricePerSecondLabel,
    pricePerImage: pricePerImageLabel,
  });
  // Image rows describe supported tiers; the benchmark maximum remains a separate hero fact.
  const imageTierOptions = isImageEngine && engine.engine.resolutions.some(value => /^\d+(?:\.\d+)?\s*k$/i.test(String(value).trim()))
    ? formatImageResolutions(engine.engine) : null;
  const rowDefs = resolveSpecRowDefs(locale, isImageEngine);
  const pricePerSecondRowLabel = resolveSpecRowLabel(locale, 'pricePerSecond', false);
  const pricePerImageRowLabel = resolveSpecRowLabel(locale, 'pricePerImage', true);
  const keySpecDefs = rowDefs.filter((row) => row.key !== (isImageEngine ? 'pricePerImage' : 'pricePerSecond'));
  const fallbackPriceRows: KeySpecRow[] = (!showPriceInSpecs || !projection)
    ? []
    : priceRows.length
    ? []
    : isImageEngine
      ? keySpecValues?.pricePerImage && !isUnsupported(keySpecValues.pricePerImage)
        ? [
            {
              id: 'pricePerImage',
              key: 'pricePerImage',
              label: pricePerImageRowLabel,
              value: keySpecValues.pricePerImage,
            },
          ]
        : []
      : keySpecValues?.pricePerSecond && !isUnsupported(keySpecValues.pricePerSecond)
      ? [
          {
            id: 'pricePerSecond',
            key: 'pricePerSecond',
            label: pricePerSecondRowLabel,
            value: keySpecValues.pricePerSecond,
          },
        ]
      : [];
  const keySpecRows: KeySpecRow[] = keySpecValues
    ? [
        ...(priceRows.length ? priceRows : fallbackPriceRows),
        ...keySpecDefs
          .map(({ key, label }) => ({
            id: key,
            key,
            label,
            value:
              key === 'maxResolution'
                ? isImageEngine
                  ? imageTierOptions ?? keySpecValues[key]
                  : normalizeMaxResolution(keySpecValues[key])
                : keySpecValues[key],
          }))
          .filter((row) => !isPending(row.value) && !isUnsupported(row.value)),
      ]
    : [];

  return { keySpecValues, keySpecRows, pricePerSecondLabel, pricePerImageLabel };
}
