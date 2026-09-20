import React from 'react';
import type { AppLocale } from '@/i18n/locales';
import { serializeJsonLd } from '@/lib/seo/jsonld';

type DocsArticleJsonLdScriptsProps = {
  locale: AppLocale;
  slug: string;
  breadcrumb: unknown;
  article: unknown | null;
  structuredData?: string[];
  includeAuthoredData: boolean;
};

export function DocsArticleJsonLdScripts({ locale, slug, breadcrumb, article, structuredData, includeAuthoredData }: DocsArticleJsonLdScriptsProps) {
  return (
    <>
      <script
        id={`docs-breadcrumb-${locale}-${slug}-jsonld`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumb) }}
      />
      {article ? (
        <script
          id={`docs-article-${locale}-${slug}-jsonld`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(article) }}
        />
      ) : null}
      {includeAuthoredData ? structuredData?.map((json, index) => (
        <script
          key={`docs-jsonld-${slug}-${index}`}
          id={`docs-jsonld-${slug}-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(JSON.parse(json)) }}
        />
      )) : null}
    </>
  );
}
