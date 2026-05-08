import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalVersionBadge } from '@/components/legal/LegalVersionBadge';
import { formatLegalDate, getLegalDocument } from '@/lib/legal';
import type { AppLocale } from '@/i18n/locales';
import { PrivacyArticle } from './_components/PrivacyArticle';
import { HEADER_COPY, METADATA_COPY } from './_lib/privacy-page-copy';
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
    hreflangGroup: 'legalPrivacy',
    englishPath: '/legal/privacy',
    availableLocales: ['en', 'fr', 'es'] as AppLocale[],
    ogType: 'article',
    imageAlt: metadata.imageAlt,
  });
}

export default async function PrivacyPage() {
  const locale = await resolveLocale();
  const document = await getLegalDocument('privacy');
  const version = document?.version ?? '2025-10-26';
  const effective = formatLegalDate(document?.publishedAt ?? `${version}T00:00:00Z`, locale);
  const header = HEADER_COPY[locale] ?? HEADER_COPY.en;
  const links = {
    mentionsHref: localizePathFromEnglish(locale, '/legal/mentions'),
    subprocessorsHref: localizePathFromEnglish(locale, '/legal/subprocessors'),
    cookiesHref: localizePathFromEnglish(locale, '/legal/cookies-list'),
  };

  return (
    <div className="stack-gap-lg">
      <header className="stack-gap-sm">
        <h1 className="text-xl font-semibold text-text-primary">{header.title}</h1>
        <p className="text-sm text-text-secondary">
          {header.versionLabel}: {version} · {header.effectiveLabel}: {effective ?? version}
        </p>
        <p className="text-sm text-text-secondary">
          {locale === 'en' ? (
            <>
              Controller: MaxVideoAI (sole proprietorship in formation, France). Registered office: see{' '}
              <Link href={links.mentionsHref} className="text-brand underline hover:text-brandHover">
                legal mentions
              </Link>
              .
            </>
          ) : locale === 'fr' ? (
            <>
              Responsable de traitement : MaxVideoAI (entreprise individuelle en France). Adresse : voir{' '}
              <Link href={links.mentionsHref} className="text-brand underline hover:text-brandHover">
                Mentions légales
              </Link>
              .
            </>
          ) : (
            <>
              Responsable: MaxVideoAI (empresa individual en Francia). Dirección: consulta las{' '}
              <Link href={links.mentionsHref} className="text-brand underline hover:text-brandHover">
                menciones legales
              </Link>
              .
            </>
          )}
        </p>
        <p className="text-sm text-text-secondary">
          {header.contactLabel}{' '}
          <ObfuscatedEmailLink
            user="privacy"
            domain="maxvideoai.com"
            label="privacy@maxvideoai.com"
            placeholder="privacy [at] maxvideoai.com"
            unstyled
            className="font-medium"
          />{' '}
          ·{' '}
          <ObfuscatedEmailLink
            user="legal"
            domain="maxvideoai.com"
            label="legal@maxvideoai.com"
            placeholder="legal [at] maxvideoai.com"
            unstyled
            className="font-medium"
          />
        </p>
        <LegalVersionBadge docKey="privacy" doc={document} locale={locale} />
      </header>
      <PrivacyArticle locale={locale} version={version} effective={effective ?? version} links={links} />
    </div>
  );
}
