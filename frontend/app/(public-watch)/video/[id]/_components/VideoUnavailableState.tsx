import Link from 'next/link';
import { ButtonLink } from '@/components/ui/Button';

export function VideoUnavailableState({ backHref }: { backHref: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <Link href={backHref} prefetch={false} className="text-xs font-semibold uppercase tracking-micro text-text-secondary hover:text-text-primary">
        Back
      </Link>
      <div className="mt-6 rounded-card border border-border bg-surface px-6 py-10 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-text-primary">Video unavailable</h1>
        <p className="mt-4 text-base text-text-secondary">
          This video is no longer available. It may have been removed or the primary asset is missing.
        </p>
        <div className="mt-6 flex justify-center">
          <ButtonLink href={backHref} size="sm" prefetch={false}>
            Browse examples
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
