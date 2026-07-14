import { FEATURES } from '@/content/feature-flags';
import { getContentEntries, type ContentEntry } from '@/lib/content/markdown';
import type { AppLocale } from '@/i18n/locales';
import type { Dictionary } from '@/lib/i18n/types';
import { getMcpPublicationState, type McpPublicationState } from '@/lib/mcp-publication';

export type DocsContent = Dictionary['docs'];
export type DocsEntry = ContentEntry;
export type DocsSectionId = 'onboarding' | 'pricing' | 'refunds' | 'safety' | 'api';
export type DocsTocId = DocsSectionId | 'library';
export type DocsTocLink = {
  id: DocsTocId;
  label: string;
};
export type DocsSeeAlsoLink = {
  href: string;
  label: string;
};
export type DocsSeeAlsoLinks = Record<string, DocsSeeAlsoLink[] | undefined>;

export const DOCS_SECTION_ORDER = ['onboarding', 'pricing', 'refunds', 'safety', 'api'] as const;

function publicationState(): McpPublicationState {
  return getMcpPublicationState(FEATURES.mcp);
}

export function filterDocsEntriesForPublication<T extends { slug: string }>(
  entries: T[],
  publication: McpPublicationState
): T[] {
  return publication.indexable ? entries : entries.filter((entry) => entry.slug !== 'mcp');
}

export async function getDocsEntries(locale: AppLocale) {
  const localized = await getContentEntries(`content/${locale}/docs`);
  const entries = localized.length > 0 ? localized : await getContentEntries('content/docs');
  return filterDocsEntriesForPublication(entries, publicationState());
}

export function resolveDocsLastUpdated(entries: Array<{ updatedAt?: string; date: string }>): string | null {
  let latestTimestamp = Number.NEGATIVE_INFINITY;

  for (const entry of entries) {
    const source = entry.updatedAt ?? entry.date;
    const timestamp = Date.parse(source);
    if (Number.isFinite(timestamp) && timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
    }
  }

  if (!Number.isFinite(latestTimestamp)) {
    return null;
  }

  return new Date(latestTimestamp).toISOString().slice(0, 10);
}

export function buildDocsTocLinks(content: DocsContent): DocsTocLink[] {
  const sections = content.sections;
  const toc = content.toc ?? {};

  return [
    { id: 'onboarding', label: toc.onboarding ?? sections?.[0]?.title ?? 'Onboarding' },
    { id: 'pricing', label: toc.pricing ?? sections?.[1]?.title ?? 'Price system' },
    { id: 'refunds', label: toc.refunds ?? sections?.[2]?.title ?? 'Refunds' },
    { id: 'safety', label: toc.safety ?? sections?.[3]?.title ?? 'Brand safety' },
    { id: 'api', label: toc.api ?? sections?.[4]?.title ?? 'API references' },
    { id: 'library', label: toc.library ?? content.libraryHeading ?? 'Library' },
  ];
}

export function buildDocsIndexViewModel(
  content: DocsContent,
  docs: DocsEntry[],
  publication: McpPublicationState = publicationState()
) {
  const apiNotice = content.apiNotice ?? {};
  const toc = content.toc ?? {};

  return {
    apiNoticeLabel: FEATURES.docs.apiPublicRefs ? apiNotice.public : apiNotice.private,
    lastUpdatedDate: resolveDocsLastUpdated(docs),
    lastUpdatedLabel: content.lastUpdatedLabel ?? 'Last updated:',
    libraryDocsLive: FEATURES.docs.libraryDocs,
    mcpGuide: publication.indexable ? content.mcpGuide ?? null : null,
    sectionOrder: DOCS_SECTION_ORDER,
    seeAlsoLinks: (content.seeAlso ?? {}) as DocsSeeAlsoLinks,
    toc,
    tocLinks: buildDocsTocLinks(content),
  };
}
