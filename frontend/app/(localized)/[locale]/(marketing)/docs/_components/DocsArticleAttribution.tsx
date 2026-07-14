import React from 'react';

import { localeRegions, type AppLocale } from '@/i18n/locales';

type DocsArticleAuthor = {
  name: string;
  aboutHref: string;
};

type DocsArticleAttributionProps = {
  author: DocsArticleAuthor | null;
  date: string;
  locale: AppLocale;
  updatedAt?: string;
};

function formatDate(value: string, locale: AppLocale): string {
  return new Date(value).toLocaleDateString(localeRegions[locale] ?? 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function DocsArticleAttribution({
  author,
  date,
  locale,
  updatedAt,
}: DocsArticleAttributionProps) {
  if (!author) {
    return (
      <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
        {formatDate(date, locale)}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
      <span>
        {locale === 'fr' ? 'Par' : locale === 'es' ? 'Por' : 'By'}{' '}
        <a href={author.aboutHref} className="font-semibold text-text-primary hover:text-brand">
          {author.name}
        </a>
      </span>
      <span aria-hidden="true">·</span>
      <span>
        {locale === 'fr' ? 'Publié le' : locale === 'es' ? 'Publicado el' : 'Published'}{' '}
        {formatDate(date, locale)}
      </span>
      <span aria-hidden="true">·</span>
      <span>
        {locale === 'fr' ? 'Mis à jour le' : locale === 'es' ? 'Actualizado el' : 'Updated'}{' '}
        {formatDate(updatedAt ?? date, locale)}
      </span>
    </div>
  );
}
