import { Link } from '@/i18n/navigation';
import type { DocsContent } from '../_lib/docs-index-data';

type DocsFeedbackSectionProps = {
  content: DocsContent;
};

export function DocsFeedbackSection({ content }: DocsFeedbackSectionProps) {
  const feedbackCopy = content.feedback ?? {};

  return (
    <section aria-labelledby="docs-feedback">
      <h3 id="docs-feedback" className="sr-only">
        {feedbackCopy.srTitle ?? 'Feedback'}
      </h3>
      <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text-muted">{feedbackCopy.prompt ?? 'Was this page helpful?'}</p>
        <div className="flex items-center gap-2">
          <Link href="/contact" className="rounded-md border border-hairline px-3 py-1.5 text-sm hover:shadow-sm">
            {feedbackCopy.yes ?? 'Yes'}
          </Link>
          <a
            href="mailto:support@maxvideoai.com"
            className="rounded-md border border-hairline px-3 py-1.5 text-sm hover:shadow-sm"
          >
            {feedbackCopy.no ?? 'No'}
          </a>
          <a href="#top" className="ml-2 text-sm underline underline-offset-2">
            {feedbackCopy.backToTop ?? 'Back to top'}
          </a>
        </div>
      </div>
    </section>
  );
}
