import Image from 'next/image';
import { ChevronRight, PlayCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type {
  BestForDetailCopy,
  ExamplePreviewPick,
} from '../_lib/best-for-detail-config';

export function ExamplesPreview({ picks, copy }: { picks: ExamplePreviewPick[]; copy: BestForDetailCopy }) {
  return (
    <section id="examples" className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary">{copy.examplesTitle}</h2>
          <p className="mt-1 text-sm text-text-secondary">{copy.examplesDescription}</p>
        </div>
        <Link href={{ pathname: '/examples' }} className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brandHover">
          {copy.browseAllExamples}
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {picks.map((pick) => (
          <Link
            key={pick.slug}
            href={{ pathname: '/examples/[model]', params: { model: pick.examplesSlug } }}
            className="group relative min-h-[116px] overflow-hidden rounded-[14px] border border-hairline bg-surface shadow-sm"
          >
            <Image
              src={pick.heroThumbUrl ?? '/assets/placeholders/preview-16x9.png'}
              alt=""
              aria-hidden="true"
              fill
              sizes="(min-width: 1280px) 230px, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition duration-300 group-hover:scale-105"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/42 to-black/8" aria-hidden />
            <span className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/92 via-black/68 to-transparent" aria-hidden />
            <span className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-text-primary shadow-sm">
              <PlayCircle className="h-5 w-5" aria-hidden />
            </span>
            <span className="absolute bottom-3 left-3 right-3 z-10 rounded-[10px] bg-black/42 px-3 py-2 shadow-[0_10px_26px_rgba(0,0,0,0.28)] backdrop-blur-[2px]">
              <span className="block text-sm font-semibold leading-tight text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.65)]">
                {pick.engine?.marketingName ?? pick.slug}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.65)]">
                {pick.criterion}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
