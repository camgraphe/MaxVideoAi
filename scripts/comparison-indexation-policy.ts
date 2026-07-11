export type ComparisonLocale = 'en' | 'fr' | 'es';

export type ComparisonIndexationClass =
  | 'keep'
  | 'enrich'
  | 'review'
  | 'noindex_candidate';

export type ComparisonPolicyInput = {
  locale: ComparisonLocale;
  clicks: number;
  impressions: number;
  position: number;
  hasLocalizedOverride: boolean;
  isStrategic: boolean;
};

export type ComparisonGscRow = {
  url: string;
  locale: ComparisonLocale;
  slug: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type ComparisonMatrixRow = ComparisonGscRow & {
  hasGscRow: boolean;
  gscSourceUrls: string[];
  hasLocalizedOverride: boolean;
  strategicSignals: string[];
  classification: ComparisonIndexationClass;
  rationale: string[];
};

export type ComparisonMatrixInput = {
  publishedSlugs: string[];
  gscRows: ComparisonGscRow[];
  localizedOverrideSlugs: Record<ComparisonLocale, ReadonlySet<string>>;
  strategicSignalsBySlug: ReadonlyMap<string, readonly string[]>;
  baseUrl?: string;
};

export function classifyComparison(
  input: ComparisonPolicyInput,
): ComparisonIndexationClass {
  if (
    input.clicks > 0 ||
    input.impressions >= 500 ||
    input.hasLocalizedOverride ||
    (input.locale === 'en' && input.isStrategic)
  ) {
    return 'keep';
  }

  if (input.impressions >= 100) return 'enrich';
  if (
    input.impressions >= 30 ||
    (input.impressions > 0 && input.position > 0 && input.position <= 10) ||
    input.isStrategic
  ) {
    return 'review';
  }

  return 'noindex_candidate';
}

export function buildComparisonIndexationMatrix(
  input: ComparisonMatrixInput,
): ComparisonMatrixRow[] {
  const baseUrl = (input.baseUrl ?? 'https://maxvideoai.com').replace(/\/$/, '');
  const locales: ComparisonLocale[] = ['en', 'fr', 'es'];
  const localePaths: Record<ComparisonLocale, string> = {
    en: '/ai-video-engines',
    fr: '/fr/comparatif',
    es: '/es/comparativa',
  };
  const metricsRowsByKey = new Map<string, ComparisonGscRow[]>();
  input.gscRows.forEach((row) => {
    const key = `${row.locale}:${row.slug}`;
    const current = metricsRowsByKey.get(key) ?? [];
    current.push(row);
    metricsRowsByKey.set(key, current);
  });

  return locales.flatMap((locale) =>
    Array.from(new Set(input.publishedSlugs))
      .sort((a, b) => a.localeCompare(b, 'en'))
      .map((slug) => {
        const metricsRows = metricsRowsByKey.get(`${locale}:${slug}`) ?? [];
        const clicks = metricsRows.reduce((sum, row) => sum + row.clicks, 0);
        const impressions = metricsRows.reduce((sum, row) => sum + row.impressions, 0);
        const ctr = impressions > 0 ? Math.round((clicks / impressions) * 1_000) / 10 : 0;
        const weightedPosition = metricsRows.reduce(
          (sum, row) => sum + row.position * row.impressions,
          0,
        );
        const position =
          impressions > 0
            ? Math.round((weightedPosition / impressions) * 10) / 10
            : metricsRows[0]?.position ?? 0;
        const strategicSignals = Array.from(
          new Set(input.strategicSignalsBySlug.get(slug) ?? []),
        ).sort((a, b) => a.localeCompare(b, 'en'));
        const hasLocalizedOverride = input.localizedOverrideSlugs[locale].has(slug);
        const isStrategic = strategicSignals.length > 0;
        const classification = classifyComparison({
          locale,
          clicks,
          impressions,
          position,
          hasLocalizedOverride,
          isStrategic,
        });
        const rationale: string[] = [];

        if (clicks > 0) rationale.push('gsc_clicks');
        if (impressions >= 500) rationale.push('gsc_high_impressions');
        if (hasLocalizedOverride) rationale.push('localized_editorial_override');
        if (locale === 'en' && isStrategic) rationale.push('english_strategic_surface');
        if (classification === 'enrich') rationale.push('gsc_enrichment_opportunity');
        if (classification === 'review' && impressions >= 30) {
          rationale.push('gsc_review_opportunity');
        }
        if (
          classification === 'review' &&
          impressions < 30 &&
          position > 0 &&
          position <= 10
        ) {
          rationale.push('gsc_top_10_review');
        }
        if (classification === 'review' && locale !== 'en' && isStrategic) {
          rationale.push('strategic_localization_review');
        }
        if (classification === 'noindex_candidate') {
          rationale.push(
            metricsRows.length > 0
              ? 'low_demand_outside_top_10'
              : 'no_gsc_row_or_editorial_signal',
          );
        }

        return {
          url: `${baseUrl}${localePaths[locale]}/${slug}`,
          locale,
          slug,
          clicks,
          impressions,
          ctr,
          position,
          hasGscRow: metricsRows.length > 0,
          gscSourceUrls: metricsRows.map((row) => row.url).sort((a, b) => a.localeCompare(b)),
          hasLocalizedOverride,
          strategicSignals,
          classification,
          rationale,
        };
      }),
  );
}
