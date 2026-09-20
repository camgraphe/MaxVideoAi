import React from 'react';
import type { AppLocale } from '@/i18n/locales';
import { serializeJsonLd } from '@/lib/seo/jsonld';

type BlogPostJsonLdScriptsProps = {
  locale: AppLocale;
  slug: string;
  breadcrumb: unknown;
  article: unknown;
  structuredData?: string[];
};

export function BlogPostJsonLdScripts({ locale, slug, breadcrumb, article, structuredData }: BlogPostJsonLdScriptsProps) {
  return (
    <>
      <script
        id={`breadcrumb-${locale}-${slug}-jsonld`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumb) }}
      />
      <script
        id={`article-${locale}-${slug}-jsonld`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(article) }}
      />
      {structuredData?.map((json, index) => (
        <script
          key={`faq-jsonld-${slug}-${index}`}
          id={`faq-jsonld-${slug}-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(JSON.parse(json)) }}
        />
      ))}
    </>
  );
}
