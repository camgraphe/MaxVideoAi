'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function ModelsCompareHeroToggle({
  label = 'Compare mode',
  className = '',
}: {
  label?: string;
  className?: string;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const compareMode = searchParams.get('compare') === '1';

  const toggleCompare = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (compareMode) {
      params.delete('compare');
    } else {
      params.set('compare', '1');
    }
    const query = params.toString();
    const target = query ? `${pathname}?${query}` : pathname;
    router.push(target, { scroll: false });
  };

  return (
    <button
      type="button"
      onClick={toggleCompare}
      className={`inline-flex items-center rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-micro transition ${
        compareMode
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
          : 'border-hairline bg-surface text-text-secondary hover:border-text-muted hover:text-text-primary'
      } ${className}`}
    >
      {label}
    </button>
  );
}
