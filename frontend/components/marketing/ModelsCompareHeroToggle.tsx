'use client';

import { useEffect, useState } from 'react';
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
  const [localActive, setLocalActive] = useState(compareMode);

  useEffect(() => {
    setLocalActive(compareMode);
  }, [compareMode]);

  useEffect(() => {
    const handler = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      setLocalActive(Boolean(event.detail?.enabled));
    };
    window.addEventListener('models-compare-mode', handler as EventListener);
    return () => window.removeEventListener('models-compare-mode', handler as EventListener);
  }, []);

  const toggleCompare = () => {
    const params = new URLSearchParams(searchParams.toString());
    const next = !localActive;
    setLocalActive(next);
    if (!next) {
      params.delete('compare');
    } else {
      params.set('compare', '1');
    }
    const query = params.toString();
    const target = query ? `${pathname}?${query}` : pathname;
    router.push(target, { scroll: false });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('models-compare-mode', { detail: { enabled: next } }));
    }
  };

  return (
    <button
      type="button"
      onClick={toggleCompare}
      className={`inline-flex items-center rounded-full border px-6 py-3 text-sm font-semibold uppercase tracking-micro transition ${
        localActive
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
          : 'border-hairline bg-surface text-text-secondary hover:border-text-muted hover:text-text-primary'
      } ${className}`}
    >
      {label}
    </button>
  );
}
