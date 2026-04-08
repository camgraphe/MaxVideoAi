'use client';

import { useEffect, useId, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { UIIcon } from '@/components/ui/UIIcon';

type SearchScope = 'users' | 'jobs';

const scopeOptions: Array<{ value: SearchScope; label: string }> = [
  { value: 'users', label: 'Users' },
  { value: 'jobs', label: 'Jobs' },
];

type TopbarSearchProps = {
  compact?: boolean;
};

export function TopbarSearch({ compact = false }: TopbarSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputId = useId();
  const [scope, setScope] = useState<SearchScope>('users');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const path = pathname ?? '';
    if (path.startsWith('/admin/jobs')) {
      setScope('jobs');
      setQuery(searchParams?.get('jobId') ?? '');
      return;
    }
    if (path.startsWith('/admin/users')) {
      setScope('users');
      setQuery(searchParams?.get('search') ?? '');
      return;
    }
    setScope('users');
  }, [pathname, searchParams]);

  const placeholder = scope === 'jobs' ? 'Job ID' : 'Email or user ID';

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    if (scope === 'jobs') {
      router.push(`/admin/jobs?jobId=${encodeURIComponent(value)}`);
      return;
    }
    router.push(`/admin/users?search=${encodeURIComponent(value)}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={[
        'flex w-full min-w-0 items-center gap-2 rounded-xl border border-border bg-surface shadow-card',
        compact ? 'h-11 px-2.5' : 'h-10 px-2',
      ].join(' ')}
    >
      <label className="sr-only" htmlFor={inputId}>
        Quick search
      </label>
      <select
        value={scope}
        onChange={(event) => setScope(event.target.value as SearchScope)}
        className={[
          'rounded-lg border border-hairline bg-bg font-medium text-text-secondary focus:border-border-hover focus:outline-none',
          compact ? 'h-9 px-2 text-xs' : 'h-8 px-2.5 text-[11px]',
        ].join(' ')}
        aria-label="Search scope"
      >
        {scopeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <div className="h-5 w-px bg-hairline" aria-hidden="true" />
      <UIIcon icon={Search} size={14} className="text-text-muted" />
      <input
        id={inputId}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        className={['w-full min-w-0 bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none', compact ? 'text-[15px]' : 'text-sm'].join(' ')}
        type="search"
      />
      <button
        type="submit"
        className={[
          'inline-flex items-center rounded-lg bg-brand font-medium text-on-brand transition hover:bg-brand-hover',
          compact ? 'h-9 px-3 text-xs' : 'h-8 px-3 text-[11px]',
        ].join(' ')}
      >
        Go
      </button>
    </form>
  );
}
