import type { buildMetadataUrls } from '@/lib/metadataUrls';
import type { DocsContent, DocsEntry } from '../_lib/docs-index-data';
import { buildDocsIndexViewModel } from '../_lib/docs-index-data';
import { DocsFeedbackSection } from './DocsFeedbackSection';
import { DocsJsonLdScripts } from './DocsJsonLdScripts';
import { DocsLibrarySection } from './DocsLibrarySection';
import { DocsSectionsGrid } from './DocsSectionsGrid';
import { DocsTocNav } from './DocsTocNav';

type DocsMetadataUrls = ReturnType<typeof buildMetadataUrls>;

type DocsIndexViewProps = {
  content: DocsContent;
  docs: DocsEntry[];
  metadataUrls: DocsMetadataUrls;
  site: string;
};

export function DocsIndexView({ content, docs, metadataUrls, site }: DocsIndexViewProps) {
  const viewModel = buildDocsIndexViewModel(content, docs);

  return (
    <div id="top" className="scroll-smooth">
      <div className="container-page max-w-5xl section">
        <div className="stack-gap-lg">
          <header className="stack-gap-sm">
            <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">{content.hero.title}</h1>
            <p className="sm:max-w-[62ch] text-base leading-relaxed text-text-secondary">
              {content.hero.subtitle}
            </p>
          </header>

          <DocsTocNav title={viewModel.toc.title} tocLinks={viewModel.tocLinks}>
            <DocsSectionsGrid
              apiNoticeLabel={viewModel.apiNoticeLabel}
              content={content}
              sectionOrder={viewModel.sectionOrder}
              seeAlsoLinks={viewModel.seeAlsoLinks}
            />
            <DocsLibrarySection
              content={content}
              docs={docs}
              libraryDocsLive={viewModel.libraryDocsLive}
              seeAlsoLinks={viewModel.seeAlsoLinks}
            />
          </DocsTocNav>

          <DocsFeedbackSection content={content} />
          {viewModel.lastUpdatedDate ? (
            <p className="text-xs text-text-muted">
              {viewModel.lastUpdatedLabel} {viewModel.lastUpdatedDate}
            </p>
          ) : null}
        </div>
        <DocsJsonLdScripts content={content} metadataUrls={metadataUrls} site={site} toc={viewModel.toc} />
      </div>
    </div>
  );
}
