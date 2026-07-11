import type { AppLocale } from '@/i18n/locales';
import type { BenchmarkCopy } from '../_lib/benchmark-copy';
import type { BenchmarkPageData } from '../_lib/benchmark-page-data';

export function BenchmarkLabView({ copy }: { copy: BenchmarkCopy; data: BenchmarkPageData; locale: AppLocale }) {
  return <main><h1>{copy.hero.title}</h1></main>;
}
