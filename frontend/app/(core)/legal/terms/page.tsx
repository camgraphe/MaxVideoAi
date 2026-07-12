import type { Metadata } from 'next';
import { LegalVersionBadge } from '@/components/legal/LegalVersionBadge';
import { formatLegalDate, getLegalDocument, LEGAL_FALLBACK_VERSIONS } from '@/lib/legal';
import type { AppLocale } from '@/i18n/locales';
import { TermsArticle } from './_components/TermsArticle';
import { HEADER_COPY, METADATA_COPY } from './_lib/terms-page-copy';
import { resolveLocale } from '@/lib/i18n/server';
import { localizePathFromEnglish } from '@/lib/i18n/paths';
import { ObfuscatedEmailLink } from '@/components/marketing/ObfuscatedEmailLink';
import { buildSeoMetadata } from '@/lib/seo/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await resolveLocale()) as AppLocale;
  const metadata = METADATA_COPY[locale] ?? METADATA_COPY.en;
  return buildSeoMetadata({
    locale,
    title: metadata.title,
    description: metadata.description,
    hreflangGroup: 'legalTerms',
    englishPath: '/legal/terms',
    availableLocales: ['en', 'fr', 'es'] as AppLocale[],
    ogType: 'article',
    imageAlt: metadata.imageAlt,
  });
}

export default async function TermsPage() {
  const locale = await resolveLocale();
  const document = await getLegalDocument('terms');
  const version = document?.version ?? LEGAL_FALLBACK_VERSIONS.terms;
  const effective = formatLegalDate(document?.publishedAt ?? `${version}T00:00:00Z`, locale);
  const header = HEADER_COPY[locale] ?? HEADER_COPY.en;
  const subprocessorsHref = localizePathFromEnglish(locale, '/legal/subprocessors');

  return (
    <div className="stack-gap-lg">
      <header className="stack-gap-sm">
        <h1 className="text-xl font-semibold text-text-primary">{header.title}</h1>
        <p className="text-sm text-text-secondary">
          {header.versionLabel}: {version} · {header.effectiveLabel}: {effective ?? version}
        </p>
        <p className="text-sm text-text-secondary">{header.companyLine}</p>
        <p className="text-sm text-text-secondary">
          {header.contactLabel}{' '}
          <ObfuscatedEmailLink
            user="legal"
            domain="maxvideoai.com"
            label="legal@maxvideoai.com"
            placeholder="legal [at] maxvideoai.com"
            unstyled
            className="font-medium"
          />{' '}
          ·{' '}
          <ObfuscatedEmailLink
            user="support"
            domain="maxvideoai.com"
            label="support@maxvideoai.com"
            placeholder="support [at] maxvideoai.com"
            unstyled
            className="font-medium"
          />
        </p>
        <LegalVersionBadge docKey="terms" doc={document} locale={locale} />
      </header>
      <TermsArticle locale={locale} version={version} effective={effective ?? version} subprocessorsHref={subprocessorsHref} />
    </div>
  );
}
