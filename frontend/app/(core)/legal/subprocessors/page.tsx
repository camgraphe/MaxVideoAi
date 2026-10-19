import type { Metadata } from 'next';
import { ObfuscatedEmailLink } from '@/components/marketing/ObfuscatedEmailLink';
import { resolveLocale } from '@/lib/i18n/server';
import type { AppLocale } from '@/i18n/locales';
import { buildSeoMetadata } from '@/lib/seo/metadata';

import { METADATA_COPY, PAGE_COPY, SUBPROCESSORS } from './_lib/subprocessors-copy';

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await resolveLocale()) as AppLocale;
  const metadata = METADATA_COPY[locale] ?? METADATA_COPY.en;
  return buildSeoMetadata({
    locale,
    title: metadata.title,
    description: metadata.description,
    hreflangGroup: 'legalSubprocessors',
    englishPath: '/legal/subprocessors',
    availableLocales: ['en', 'fr', 'es'] as AppLocale[],
    ogType: 'article',
    imageAlt: metadata.imageAlt,
  });
}

export default async function SubprocessorsPage() {
  const locale = (await resolveLocale()) as AppLocale;
  const copy = PAGE_COPY[locale] ?? PAGE_COPY.en;
  const rows = SUBPROCESSORS[locale] ?? SUBPROCESSORS.en;

  return (
    <div className="stack-gap-lg">
      <header className="stack-gap-sm">
        <h1 className="text-xl font-semibold text-text-primary">{copy.title}</h1>
        <p className="text-sm text-text-secondary">{copy.intro}</p>
        <p className="text-sm text-text-secondary">{copy.lastUpdated}</p>
      </header>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-bg-secondary text-left text-xs font-semibold uppercase tracking-wide text-text-secondary">
            <tr>
              <th scope="col" className="px-4 py-3">{copy.columns.provider}</th>
              <th scope="col" className="px-4 py-3">{copy.columns.service}</th>
              <th scope="col" className="px-4 py-3">{copy.columns.data}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {rows.map((entry) => (
              <tr key={entry.provider}>
                <td className="px-4 py-4 font-medium text-text-primary">{entry.provider}</td>
                <td className="px-4 py-4 text-text-secondary">{entry.service}</td>
                <td className="px-4 py-4 text-text-secondary">
                  {entry.data}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-text-secondary">
        {copy.locationNote}{' '}
        <ObfuscatedEmailLink
          user="privacy"
          domain="maxvideoai.com"
          label="privacy@maxvideoai.com"
          placeholder="privacy [at] maxvideoai.com"
        />
        .
      </p>
    </div>
  );
}
