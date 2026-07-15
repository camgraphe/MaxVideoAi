import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import compareConfig from '../frontend/config/compare-config.json';
import compareHubConfig from '../frontend/config/compare-hub.json';
import {
  buildCanonicalCompareSlug,
  canonicalizePublishedCompareSlug,
  getHubComparisonSlugsForSitemap,
} from '../frontend/lib/compare-hub/data.ts';
import { getComparePageOverride } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides.ts';
import gscSnapshot from '../docs/seo/gsc-comparison-performance-2026-07-08.json';
import {
  buildComparisonIndexationMatrix,
  type ComparisonGscRow,
  type ComparisonIndexationClass,
  type ComparisonLocale,
  type ComparisonMatrixRow,
} from './comparison-indexation-policy.ts';

const JSON_OUTPUT = 'docs/seo/comparison-indexation-matrix-2026-07-08.json';
const MARKDOWN_OUTPUT = 'docs/seo/comparison-indexation-matrix-2026-07-08.md';
const CLASSIFICATIONS: ComparisonIndexationClass[] = [
  'keep',
  'enrich',
  'review',
  'noindex_candidate',
];
const LOCALES: ComparisonLocale[] = ['en', 'fr', 'es'];

type PairSeed = { left: string; right: string };
type StrategicCompareConfig = {
  trophyComparisons?: string[];
  scoreboardOnlyComparisons?: string[];
  bestForPages?: Array<{ relatedComparisons?: string[] }>;
  relatedComparisons?: Record<string, string[]>;
  showdowns?: Record<string, unknown>;
};
type StrategicHubConfig = {
  popularComparisons?: PairSeed[];
  useCaseBuckets?: Array<{ pairs?: PairSeed[] }>;
  opponentOverrides?: Record<string, string[]>;
};

export type ComparisonIndexationDocument = {
  schemaVersion: 1;
  generatedAt: string;
  source: {
    property: string;
    searchType: string;
    range: { start: string; end: string };
    exportedAt: string;
    rawPageRows: number;
    comparisonRows: number;
    gscRows: number;
  };
  policy: {
    keep: string[];
    enrich: string[];
    review: string[];
    noindexCandidate: string[];
    safety: string;
  };
  summary: {
    publishedSlugs: number;
    totalUrls: number;
    withGscRows: number;
    withoutGscRows: number;
    withClicks: number;
    gscRowsOutsidePublishedSet: number;
    gscRowsOutsidePublishedSetWithClicks: number;
    byLocale: Record<ComparisonLocale, number>;
    byClassification: Record<ComparisonIndexationClass, number>;
  };
  rows: ComparisonMatrixRow[];
  legacyGscRows: ComparisonGscRow[];
};

type ComparisonIndexationArtifacts = {
  document: ComparisonIndexationDocument;
  markdown: string;
};

function addStrategicSignal(
  signals: Map<string, Set<string>>,
  published: ReadonlySet<string>,
  slug: string,
  signal: string,
) {
  const canonical = canonicalizePublishedCompareSlug(slug);
  if (!published.has(canonical)) return;
  const current = signals.get(canonical) ?? new Set<string>();
  current.add(signal);
  signals.set(canonical, current);
}

function addPairSeedSignal(
  signals: Map<string, Set<string>>,
  published: ReadonlySet<string>,
  pair: PairSeed,
  signal: string,
) {
  addStrategicSignal(
    signals,
    published,
    buildCanonicalCompareSlug(pair.left, pair.right),
    signal,
  );
}

export function collectStrategicComparisonSignals(
  publishedSlugs: string[],
): Map<string, readonly string[]> {
  const published = new Set(publishedSlugs);
  const signals = new Map<string, Set<string>>();
  const editorial = compareConfig as StrategicCompareConfig;
  const hub = compareHubConfig as StrategicHubConfig;

  editorial.trophyComparisons?.forEach((slug) =>
    addStrategicSignal(signals, published, slug, 'trophy'),
  );
  editorial.scoreboardOnlyComparisons?.forEach((slug) =>
    addStrategicSignal(signals, published, slug, 'scoreboard'),
  );
  editorial.bestForPages?.forEach((page) =>
    page.relatedComparisons?.forEach((slug) =>
      addStrategicSignal(signals, published, slug, 'best_for_related'),
    ),
  );
  Object.entries(editorial.relatedComparisons ?? {}).forEach(([slug, related]) => {
    addStrategicSignal(signals, published, slug, 'related_graph');
    related.forEach((relatedSlug) =>
      addStrategicSignal(signals, published, relatedSlug, 'related_graph'),
    );
  });
  Object.keys(editorial.showdowns ?? {}).forEach((slug) =>
    addStrategicSignal(signals, published, slug, 'showdown'),
  );
  hub.popularComparisons?.forEach((pair) =>
    addPairSeedSignal(signals, published, pair, 'popular'),
  );
  hub.useCaseBuckets?.forEach((bucket) =>
    bucket.pairs?.forEach((pair) =>
      addPairSeedSignal(signals, published, pair, 'use_case_bucket'),
    ),
  );
  Object.entries(hub.opponentOverrides ?? {}).forEach(([left, opponents]) =>
    opponents.forEach((right) =>
      addPairSeedSignal(signals, published, { left, right }, 'opponent_override'),
    ),
  );

  return new Map(
    Array.from(signals, ([slug, values]) => [
      slug,
      Array.from(values).sort((a, b) => a.localeCompare(b, 'en')),
    ]),
  );
}

function countByClassification(rows: ComparisonMatrixRow[]) {
  return Object.fromEntries(
    CLASSIFICATIONS.map((classification) => [
      classification,
      rows.filter((row) => row.classification === classification).length,
    ]),
  ) as Record<ComparisonIndexationClass, number>;
}

function escapeTableCell(value: string) {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function rowTable(rows: ComparisonMatrixRow[], limit: number) {
  const selected = rows.slice(0, limit);
  if (!selected.length) return '_Aucune URL._';
  return [
    '| Locale | Comparatif | Clics | Impressions | Position | Signaux |',
    '| --- | --- | ---: | ---: | ---: | --- |',
    ...selected.map((row) => {
      const cells = [
        row.locale,
        `[${escapeTableCell(row.slug)}](${row.url})`,
        String(row.clicks),
        String(row.impressions),
        String(row.position || '—'),
        escapeTableCell(
          [
            row.hasLocalizedOverride ? 'override localise' : '',
            ...row.strategicSignals,
            ...row.rationale,
          ]
            .filter(Boolean)
            .join(', '),
        ) || '—',
      ];
      return `| ${cells.join(' | ')} |`;
    }),
  ].join('\n');
}

function legacyRowTable(rows: ComparisonGscRow[]) {
  if (!rows.length) return '_Aucune URL._';
  return [
    '| Locale | URL GSC | Clics | Impressions | Position |',
    '| --- | --- | ---: | ---: | ---: |',
    ...rows.map(
      (row) =>
        `| ${row.locale} | [${escapeTableCell(row.slug)}](${row.url}) | ${row.clicks} | ${row.impressions} | ${row.position || '—'} |`,
    ),
  ].join('\n');
}

function buildMarkdown(document: ComparisonIndexationDocument) {
  const rowsByDemand = [...document.rows].sort(
    (a, b) => b.clicks - a.clicks || b.impressions - a.impressions || a.url.localeCompare(b.url),
  );
  const noindexCandidates = document.rows
    .filter((row) => row.classification === 'noindex_candidate')
    .sort(
      (a, b) =>
        Number(a.hasGscRow) - Number(b.hasGscRow) ||
        a.impressions - b.impressions ||
        a.url.localeCompare(b.url),
    );
  const classes = document.summary.byClassification;
  const veoAliasRows = document.legacyGscRows.filter((row) =>
    row.slug.includes('veo-3-1-first-last'),
  ).length;
  const happyHorseLegacyRows = document.legacyGscRows.filter(
    (row) => row.slug === 'happy-horse-1-0-vs-sora-2-pro',
  ).length;

  return `# Matrice d'indexation des comparatifs — GSC au ${document.source.range.end}

Source : Google Search Console, propriété \`${document.source.property}\`, recherche ${document.source.searchType}, période du ${document.source.range.start} au ${document.source.range.end}.

> Aucun noindex n'est applique automatiquement par cette matrice. \`noindex_candidate\` signifie uniquement qu'une URL doit être validée manuellement avant consolidation, retrait du sitemap ou ajout éventuel d'une directive.

## Résumé

| Mesure | Total |
| --- | ---: |
| Slugs publiés | ${document.summary.publishedSlugs} |
| URLs localisées auditées | ${document.summary.totalUrls} |
| URLs présentes dans l'export GSC | ${document.summary.withGscRows} |
| URLs sans ligne GSC dans les ${document.source.rawPageRows} premières pages | ${document.summary.withoutGscRows} |
| URLs avec au moins un clic | ${document.summary.withClicks} |
| Lignes GSC hors du périmètre publié | ${document.summary.gscRowsOutsidePublishedSet} |
| Lignes hors périmètre avec clics | ${document.summary.gscRowsOutsidePublishedSetWithClicks} |
| Keep | ${classes.keep} |
| Enrich | ${classes.enrich} |
| Review | ${classes.review} |
| Noindex candidate | ${classes.noindex_candidate} |

## Règles conservatrices

- **Keep** : au moins 1 clic, au moins 500 impressions, override éditorial localisé, ou page anglaise présente sur une surface stratégique.
- **Enrich** : 100 à 499 impressions sans signal prioritaire ; améliorer le contenu et le CTR avant toute consolidation.
- **Review** : 30 à 99 impressions, position moyenne dans le top 10 avec une demande observée, ou version FR/ES d'un comparatif stratégique sans preuve locale suffisante.
- **Noindex candidate** : moins de 30 impressions, hors top 10 ou absente de l'export GSC, aucun clic, aucun override localisé et aucun signal stratégique. Validation manuelle obligatoire.

## Pages à conserver en priorité

${rowTable(rowsByDemand.filter((row) => row.classification === 'keep'), 30)}

## Pages à enrichir

${rowTable(rowsByDemand.filter((row) => row.classification === 'enrich'), 30)}

## Pages à revoir

${rowTable(rowsByDemand.filter((row) => row.classification === 'review'), 30)}

## Premier lot de candidates à valider manuellement

Ce lot commence par les URLs absentes de l'export GSC, puis par celles avec le moins d'impressions. Il ne constitue pas une instruction de mise en noindex.

${rowTable(noindexCandidates, 50)}

## URLs GSC hors du périmètre publié

Ces anciennes URLs ou variantes ne font pas partie des 292 slugs actuellement publiés. Celles qui ont des clics doivent être vérifiées en priorité pour décider entre republication, redirection 301 pertinente ou maintien temporaire.

- ${veoAliasRows} anciennes variantes Veo \`first-last\` sont déjà normalisées par une redirection permanente vers les comparatifs Veo 3.1 canoniques.
- Les ${happyHorseLegacyRows} URLs localisées Happy Horse 1.0 vs Sora 2 Pro passent désormais par une redirection permanente vers le comparatif publié Happy Horse 1.1 vs Sora 2 Pro dans cette branche.

${legacyRowTable(document.legacyGscRows)}

L'inventaire exhaustif des ${document.summary.totalUrls} URLs se trouve dans \`${JSON_OUTPUT}\`.
`;
}

export function generateComparisonIndexationArtifacts(): ComparisonIndexationArtifacts {
  const publishedSlugs = getHubComparisonSlugsForSitemap();
  const strategicSignalsBySlug = collectStrategicComparisonSignals(publishedSlugs);
  const localizedOverrideSlugs = Object.fromEntries(
    LOCALES.map((locale) => [
      locale,
      new Set(publishedSlugs.filter((slug) => getComparePageOverride(locale, slug) !== undefined)),
    ]),
  ) as Record<ComparisonLocale, ReadonlySet<string>>;
  const gscRows = gscSnapshot.rows as ComparisonGscRow[];
  const publishedSlugSet = new Set(publishedSlugs);
  const legacyGscRows = gscRows
    .filter((row) => !publishedSlugSet.has(row.slug))
    .sort(
      (a, b) => b.clicks - a.clicks || b.impressions - a.impressions || a.url.localeCompare(b.url),
    );
  const rows = buildComparisonIndexationMatrix({
    publishedSlugs,
    gscRows,
    localizedOverrideSlugs,
    strategicSignalsBySlug,
  });
  const byLocale = Object.fromEntries(
    LOCALES.map((locale) => [locale, rows.filter((row) => row.locale === locale).length]),
  ) as Record<ComparisonLocale, number>;
  const document: ComparisonIndexationDocument = {
    schemaVersion: 1,
    generatedAt: gscSnapshot.exportedAt,
    source: {
      property: gscSnapshot.property,
      searchType: gscSnapshot.searchType,
      range: gscSnapshot.range,
      exportedAt: gscSnapshot.exportedAt,
      rawPageRows: gscSnapshot.rawPageRows,
      comparisonRows: gscSnapshot.comparisonRows,
      gscRows: gscRows.length,
    },
    policy: {
      keep: [
        'clicks > 0',
        'impressions >= 500',
        'localized editorial override',
        'English URL on a strategic comparison surface',
      ],
      enrich: ['100 <= impressions < 500 without a keep signal'],
      review: [
        '30 <= impressions < 100 without a keep signal',
        '0 < impressions < 30 with average position <= 10',
        'FR/ES strategic URL without local proof',
      ],
      noindexCandidate: [
        'impressions < 30',
        'average position > 10 or no GSC row',
        'clicks = 0',
        'no localized editorial override',
        'no strategic comparison signal',
      ],
      safety: 'Recommendation only; no sitemap, robots, canonical, or noindex change is applied.',
    },
    summary: {
      publishedSlugs: publishedSlugs.length,
      totalUrls: rows.length,
      withGscRows: rows.filter((row) => row.hasGscRow).length,
      withoutGscRows: rows.filter((row) => !row.hasGscRow).length,
      withClicks: rows.filter((row) => row.clicks > 0).length,
      gscRowsOutsidePublishedSet: legacyGscRows.length,
      gscRowsOutsidePublishedSetWithClicks: legacyGscRows.filter((row) => row.clicks > 0).length,
      byLocale,
      byClassification: countByClassification(rows),
    },
    rows,
    legacyGscRows,
  };

  return { document, markdown: buildMarkdown(document) };
}

export function writeComparisonIndexationArtifacts() {
  const artifacts = generateComparisonIndexationArtifacts();
  writeFileSync(JSON_OUTPUT, `${JSON.stringify(artifacts.document, null, 2)}\n`, 'utf8');
  writeFileSync(MARKDOWN_OUTPUT, artifacts.markdown, 'utf8');
  return artifacts.document.summary;
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) {
  const summary = writeComparisonIndexationArtifacts();
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}
