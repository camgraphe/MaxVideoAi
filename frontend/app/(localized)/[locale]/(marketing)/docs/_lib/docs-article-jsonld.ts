import type { McpPublicationState } from '@/lib/mcp-publication';
import { SITE_BASE_URL } from '@/lib/metadataUrls';

type DocsArticleAuthor = {
  name: string;
  jobTitle: string;
  url: string;
};

type DocsTechArticleInput = {
  author: DocsArticleAuthor;
  canonicalUrl: string;
  description: string;
  docsIndexUrl: string;
  imageUrl?: string;
  inLanguage: string;
  isMcpDoc: boolean;
  keywords?: string[];
  modifiedIso: string;
  overviewLabel: string;
  publication: McpPublicationState;
  publishedIso: string;
  title: string;
};

export function buildDocsTechArticleJsonLd({
  author,
  canonicalUrl,
  description,
  docsIndexUrl,
  imageUrl,
  inLanguage,
  isMcpDoc,
  keywords,
  modifiedIso,
  overviewLabel,
  publication,
  publishedIso,
  title,
}: DocsTechArticleInput): Record<string, unknown> | null {
  if (isMcpDoc && !publication.indexable) {
    return null;
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: title,
    description,
    url: canonicalUrl,
    datePublished: publishedIso,
    dateModified: modifiedIso,
    inLanguage,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
    isPartOf: {
      '@type': 'CollectionPage',
      '@id': docsIndexUrl,
      name: overviewLabel,
    },
    author: {
      '@type': 'Person',
      name: author.name,
      jobTitle: author.jobTitle,
      url: author.url,
    },
    publisher: {
      '@type': 'Organization',
      name: 'MaxVideoAI',
      url: SITE_BASE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_BASE_URL}/favicon-512.png`,
      },
    },
    ...(imageUrl ? { image: imageUrl } : {}),
    ...(keywords?.length ? { keywords } : {}),
  };
}
