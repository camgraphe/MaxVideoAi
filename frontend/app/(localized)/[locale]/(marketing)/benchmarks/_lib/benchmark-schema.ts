import type { BenchmarkCopy } from './benchmark-copy';
import { getEditorialProfileAbsoluteUrl, type ResolvedEditorialProfile } from '@/lib/editorial/profile';

export function buildBenchmarkWebPageJsonLd({
  canonicalUrl,
  copy,
  editorialProfile,
  inLanguage,
  modifiedAt,
}: {
  canonicalUrl: string;
  copy: BenchmarkCopy;
  editorialProfile: ResolvedEditorialProfile;
  inLanguage: string;
  modifiedAt: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: copy.meta.title,
    description: copy.meta.description,
    url: canonicalUrl,
    inLanguage,
    dateModified: modifiedAt,
    author: {
      '@type': 'Person',
      name: editorialProfile.name,
      jobTitle: editorialProfile.jobTitle,
      url: getEditorialProfileAbsoluteUrl(editorialProfile),
    },
    publisher: {
      '@type': 'Organization',
      name: 'MaxVideoAI',
      url: 'https://maxvideoai.com',
    },
  };
}

export function buildBenchmarkBreadcrumbJsonLd({
  canonicalUrl,
  copy,
}: {
  canonicalUrl: string;
  copy: BenchmarkCopy;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: copy.hero.title,
        item: canonicalUrl,
      },
    ],
  };
}
