'use client';

import { Link } from '@/i18n/navigation';

export function ModelsCompareHeroToggle({
  label = 'Compare mode',
  className = '',
}: {
  label?: string;
  className?: string;
}) {
  const compareSlug = ['sora-2', 'kling-2-6-pro'].sort().join('-vs-');
  const compareHref = {
    pathname: '/ai-video-engines/[slug]',
    params: { slug: compareSlug },
    query: { order: 'sora-2' },
  } as const;

  return (
    <Link
      href={compareHref}
      className={`inline-flex items-center rounded-full border border-hairline bg-surface px-6 py-3 text-sm font-semibold uppercase tracking-micro text-text-secondary transition hover:border-text-muted hover:text-text-primary ${className}`}
    >
      {label}
    </Link>
  );
}
