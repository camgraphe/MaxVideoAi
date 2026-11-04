import type { PayAsYouGoContent } from '../_content/types';

export function PayAsYouGoContents({ chapters, hasFilms }: { chapters: PayAsYouGoContent['common']['chapters']; hasFilms: boolean }) {
  const sections = [
    { id: 'payg-workspace', label: chapters.workspace },
    ...(hasFilms ? [{ id: 'payg-films', label: chapters.films }] : []),
    { id: 'payg-models', label: chapters.models },
    { id: 'compare-price-per-model', label: chapters.prices },
    { id: 'payg-questions', label: chapters.questions },
  ];
  return (
    <nav aria-label={chapters.label} className="border-b border-hairline bg-bg">
      <ol className="container-page mx-auto flex max-w-[1220px] flex-wrap gap-x-4 py-1.5 sm:justify-between">
        {sections.map(({ id, label }, index) => <li key={id}>
          <a href={`#${id}`} className="group inline-flex min-h-11 items-center gap-1.5 rounded-sm text-xs font-semibold text-text-primary hover:text-brand sm:gap-2 sm:text-sm">
            <span aria-hidden className="font-mono text-[10px] font-normal text-brand">0{index + 1}</span>
            <span className="underline-offset-4 group-hover:underline">{label}</span>
          </a>
        </li>)}
      </ol>
    </nav>
  );
}
