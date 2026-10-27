import { Link } from '@/i18n/navigation';
import type { ModelExamplesViewModel } from '../_lib/model-page-examples-view-model';

export function ModelExamplesPostGallery({ content }: { content: ModelExamplesViewModel['postGallery'] }) {
  if (!content) return null;

  return (
    <aside aria-labelledby="post-gallery-title" className="mt-6 border-t border-slate-200/80 pt-5 dark:border-white/10 sm:mt-7 sm:pt-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-8">
        <div className="max-w-3xl">
          <h3 id="post-gallery-title" className="!text-left text-lg font-semibold leading-snug text-slate-950 dark:text-white sm:text-xl">{content.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{content.example}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{content.method}</p>
          <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{content.limitation}</p>
        </div>
        <div className="flex flex-col gap-3 lg:min-w-[220px]">
          <Link href={content.ctaHref} prefetch={false} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brandHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            {content.ctaLabel}
          </Link>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs leading-5 lg:flex-col lg:gap-1.5">
            <Link href={content.exampleHref} prefetch={false} className="font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-brand dark:text-slate-300 dark:decoration-slate-600">{content.exampleLinkLabel}</Link>
            <Link href={content.guideHref} prefetch={false} className="font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-brand dark:text-slate-300 dark:decoration-slate-600">{content.guideLinkLabel}</Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
