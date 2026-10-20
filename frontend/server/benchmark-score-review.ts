import path from 'node:path';
import { promises as fs } from 'node:fs';
import { getBenchmarkScoreReviewCopy, type BenchmarkScoreReview } from '@/lib/benchmark-score-review';
import type { AppLocale } from '@/i18n/locales';

export type BenchmarkScoreReviewMetadata = {
  reviewStatus?: string;
  evidenceFile?: string;
  reviewSourceUrl?: string;
};

function safeSource(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

export async function loadBenchmarkScoreReview(metadata: BenchmarkScoreReviewMetadata): Promise<BenchmarkScoreReview | null> {
  if (metadata.reviewStatus !== 'editorial-estimated') return null;
  let publicCopy: Partial<Record<AppLocale, string>> = {};
  if (metadata.evidenceFile && /^[a-z0-9][a-z0-9.-]*\.json$/.test(metadata.evidenceFile)) {
    for (const base of [process.cwd(), path.join(process.cwd(), '..')]) {
      try {
        const evidence = JSON.parse(await fs.readFile(path.join(base, 'data', 'benchmarks', metadata.evidenceFile), 'utf8')) as { publicCopy?: Partial<Record<AppLocale, string>> };
        publicCopy = evidence.publicCopy ?? {};
        break;
      } catch {
        // Preserve an explicit estimate disclosure even when evidence is unavailable.
      }
    }
  }
  const disclosure = Object.fromEntries((['en', 'fr', 'es'] as const).map((locale) => [
    locale,
    typeof publicCopy[locale] === 'string' && publicCopy[locale].trim() ? publicCopy[locale] : getBenchmarkScoreReviewCopy(locale).fallback,
  ])) as Record<AppLocale, string>;
  return { status: 'editorial-estimated', disclosure, sourceUrl: safeSource(metadata.reviewSourceUrl) };
}
