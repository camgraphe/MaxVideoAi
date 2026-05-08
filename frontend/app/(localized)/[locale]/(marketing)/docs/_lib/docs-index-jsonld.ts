import type { buildMetadataUrls } from '@/lib/metadataUrls';
import type { DocsContent } from './docs-index-data';

type DocsMetadataUrls = ReturnType<typeof buildMetadataUrls>;
type DocsTocCopy = Record<string, string | undefined>;

type DocsJsonLdOptions = {
  content: DocsContent;
  metadataUrls: DocsMetadataUrls;
  site: string;
  toc: DocsTocCopy;
};

export function buildDocsCollectionJsonLd({ content, metadataUrls, site, toc }: DocsJsonLdOptions) {
  const jsonLdCopy = content.jsonLd ?? {};

  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: jsonLdCopy.collectionName ?? content.meta?.title ?? 'Docs — Onboarding, Brand Safety, Refunds & API Webhooks',
    url: metadataUrls.canonical,
    hasPart: [
      {
        '@type': 'WebPage',
        name: jsonLdCopy.hasPart?.onboarding ?? toc.onboarding ?? 'Onboarding',
        url: `${metadataUrls.canonical}#onboarding`,
      },
      {
        '@type': 'WebPage',
        name: jsonLdCopy.hasPart?.pricing ?? toc.pricing ?? 'Price system',
        url: `${metadataUrls.canonical}#pricing`,
      },
      {
        '@type': 'WebPage',
        name: jsonLdCopy.hasPart?.refunds ?? toc.refunds ?? 'Refunds',
        url: `${metadataUrls.canonical}#refunds`,
      },
      {
        '@type': 'WebPage',
        name: jsonLdCopy.hasPart?.safety ?? toc.safety ?? 'Brand safety',
        url: `${metadataUrls.canonical}#safety`,
      },
      {
        '@type': 'WebPage',
        name: jsonLdCopy.hasPart?.api ?? toc.api ?? 'API references',
        url: `${metadataUrls.canonical}#api`,
      },
      {
        '@type': 'WebPage',
        name: jsonLdCopy.hasPart?.library ?? toc.library ?? 'Library',
        url: `${metadataUrls.canonical}#library`,
      },
    ],
    about: jsonLdCopy.about ?? ['onboarding', 'refund policy', 'brand safety', 'webhooks', 'api references'],
    publisher: {
      '@type': 'Organization',
      name: 'MaxVideo AI',
      url: site,
    },
  };
}

export function buildDocsBreadcrumbJsonLd({ content, metadataUrls, site }: DocsJsonLdOptions) {
  const jsonLdCopy = content.jsonLd ?? {};

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: jsonLdCopy.breadcrumbHome ?? 'Home', item: `${site}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: jsonLdCopy.breadcrumbDocs ?? 'Docs',
        item: metadataUrls.canonical,
      },
    ],
  };
}

export function buildDocsFaqJsonLd({ content }: DocsJsonLdOptions) {
  const jsonLdCopy = content.jsonLd ?? {};

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: (jsonLdCopy.faq ?? []).map((entry: { question: string; answer: string }) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer,
      },
    })),
  };
}
