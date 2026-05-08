import { FlagPill } from '@/components/FlagPill';
import { Link } from '@/i18n/navigation';
import type { DocsContent, DocsEntry, DocsSeeAlsoLinks } from '../_lib/docs-index-data';
import { DocsSeeAlsoLinks as SeeAlsoLinks } from './DocsSeeAlsoLinks';

type DocsLibrarySectionProps = {
  content: DocsContent;
  docs: DocsEntry[];
  libraryDocsLive: boolean;
  seeAlsoLinks: DocsSeeAlsoLinks;
};

export function DocsLibrarySection({ content, docs, libraryDocsLive, seeAlsoLinks }: DocsLibrarySectionProps) {
  const libraryCopy = content.library ?? {};

  return (
    <section id="library" className="scroll-mt-28">
      <h2 className="flex items-center gap-2 text-xl font-semibold text-text-primary">
        {libraryCopy.heading ?? content.libraryHeading ?? 'Library'}
        <FlagPill
          live={libraryDocsLive}
          liveLabel={libraryCopy.liveLabel ?? 'Live'}
          soonLabel={libraryCopy.comingSoonLabel ?? 'Coming soon'}
        />
        <span className="sr-only">
          {libraryDocsLive ? libraryCopy.liveLabel ?? 'Live' : libraryCopy.comingSoonLabel ?? 'Coming soon'}
        </span>
      </h2>
      <p className="mt-2 text-sm text-text-secondary">
        {libraryDocsLive
          ? libraryCopy.summaryLive ?? 'Browse reusable assets, presets, and reference prompts for your team.'
          : libraryCopy.summarySoon ?? 'Documentation coming soon.'}
      </p>
      {libraryDocsLive && docs.length > 0 ? (
        <ul className="mt-4 stack-gap-sm text-sm text-text-secondary">
          {docs.map((doc) => (
            <li key={doc.slug}>
              <Link
                href={{ pathname: '/docs/[slug]', params: { slug: doc.slug } }}
                className="font-semibold text-brand hover:text-brandHover"
              >
                {doc.title}
              </Link>
              <p className="text-xs text-text-muted">{doc.description}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <SeeAlsoLinks label={content.seeAlsoLabel ?? 'See also:'} links={seeAlsoLinks.library} />
    </section>
  );
}
