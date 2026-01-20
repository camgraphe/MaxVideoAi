'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { Command, Search } from 'lucide-react';
import { UIIcon } from '@/components/ui/UIIcon';
import type { AdminNavGroup } from '@/lib/admin/navigation';

type AdminCommandPaletteProps = {
  navGroups: AdminNavGroup[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type CommandItem = {
  id: string;
  label: string;
  group: string;
  href?: string;
  action?: () => void;
  keywords?: string[];
};

const JOB_STATUS_COMMANDS: CommandItem[] = [
  { id: 'jobs-failed', label: 'Failed jobs', group: 'Operations', href: '/admin/jobs?status=failed' },
  { id: 'jobs-pending', label: 'Pending jobs', group: 'Operations', href: '/admin/jobs?status=pending' },
];

function buildCommands(navGroups: AdminNavGroup[], router: ReturnType<typeof useRouter>): CommandItem[] {
  const navItems = navGroups.flatMap((group) =>
    group.items.map((item) => ({
      id: item.id,
      label: item.label,
      group: group.label,
      href: item.href,
      keywords: [group.label, item.label],
    }))
  );

  const quick = [
    {
      id: 'go-admin',
      label: 'Admin dashboard',
      group: 'Dashboard',
      href: '/admin',
      keywords: ['hub', 'health', 'overview'],
    },
  ];

  return [...quick, ...JOB_STATUS_COMMANDS, ...navItems].map((item) => ({
    ...item,
    action: item.href ? () => router.push(item.href as string) : item.action,
  }));
}

function parsePrefixQuery(value: string, prefixes: string[]): string | null {
  for (const prefix of prefixes) {
    if (value.startsWith(prefix)) {
      return value.slice(prefix.length).trim();
    }
  }
  return null;
}

export function AdminCommandPalette({ navGroups, open, onOpenChange }: AdminCommandPaletteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previousPathRef = useRef(pathname);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const baseCommands = useMemo(() => buildCommands(navGroups, router), [navGroups, router]);

  const { filtered, dynamic } = useMemo(() => {
    const raw = query.trim();
    const normalized = raw.toLowerCase();
    const nextDynamic: CommandItem[] = [];
    let filterQuery = normalized;

    const userTerm = parsePrefixQuery(normalized, ['user:', 'users:', 'u:']);
    const jobTerm = parsePrefixQuery(normalized, ['job:', 'jobs:', 'j:']);
    const statusTerm = parsePrefixQuery(normalized, ['status:']);

    if (userTerm !== null) {
      filterQuery = userTerm;
      if (userTerm.length) {
        nextDynamic.push({
          id: 'search-users',
          label: `Search users for "${userTerm}"`,
          group: 'Quick search',
          action: () => router.push(`/admin/users?search=${encodeURIComponent(userTerm)}`),
        });
      }
    }

    if (jobTerm !== null) {
      filterQuery = jobTerm;
      if (jobTerm.length) {
        nextDynamic.push({
          id: 'search-jobs',
          label: `Find job "${jobTerm}"`,
          group: 'Quick search',
          action: () => router.push(`/admin/jobs?jobId=${encodeURIComponent(jobTerm)}`),
        });
      }
    }

    if (statusTerm !== null) {
      const status = statusTerm.trim();
      if (status === 'failed' || status === 'pending') {
        nextDynamic.push({
          id: `status-${status}`,
          label: `${status === 'failed' ? 'Failed' : 'Pending'} jobs`,
          group: 'Quick search',
          action: () => router.push(`/admin/jobs?status=${encodeURIComponent(status)}`),
        });
      }
    }

    if (normalized === 'failed' || normalized === 'pending') {
      nextDynamic.push({
        id: `quick-${normalized}`,
        label: `${normalized === 'failed' ? 'Failed' : 'Pending'} jobs`,
        group: 'Quick search',
        action: () => router.push(`/admin/jobs?status=${encodeURIComponent(normalized)}`),
      });
    }

    const filteredCommands = filterQuery
      ? baseCommands.filter((item) => {
          const haystack = `${item.label} ${item.group} ${(item.keywords ?? []).join(' ')}`.toLowerCase();
          return haystack.includes(filterQuery);
        })
      : baseCommands;

    return { filtered: filteredCommands, dynamic: nextDynamic };
  }, [baseCommands, query, router]);

  const results = useMemo(() => {
    const merged = [...dynamic, ...filtered];
    const unique = new Map<string, CommandItem>();
    merged.forEach((item) => unique.set(item.id, item));
    return Array.from(unique.values()).slice(0, 16);
  }, [dynamic, filtered]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
      return;
    }
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    setActiveIndex((index) => (results.length ? Math.min(index, results.length - 1) : 0));
  }, [results.length]);

  useEffect(() => {
    if (previousPathRef.current !== pathname && open) {
      onOpenChange(false);
    }
    previousPathRef.current = pathname;
  }, [pathname, open, onOpenChange]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault();
        onOpenChange(!open);
        return;
      }
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        onOpenChange(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const handleSelect = (item: CommandItem) => {
    onOpenChange(false);
    if (item.action) {
      item.action();
      return;
    }
    if (item.href) {
      router.push(item.href);
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const item = results[activeIndex];
      if (item) {
        handleSelect(item);
      }
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-text-primary/30 backdrop-blur-sm"
        aria-label="Close command palette"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative mx-auto mt-24 w-[min(560px,92vw)] overflow-hidden rounded-card border border-border bg-surface shadow-float"
      >
        <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
          <UIIcon icon={Search} size={16} className="text-text-tertiary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search pages or type user: / job:"
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
          />
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-tertiary">
            <UIIcon icon={Command} size={14} />
            <span>Cmd+K</span>
          </div>
        </div>
        <div className="max-h-[360px] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-3 py-6 text-sm text-text-tertiary">No results found.</div>
          ) : (
            <ul className="space-y-1">
              {results.map((item, index) => {
                const active = index === activeIndex;
                const isCurrent = item.href ? pathname === item.href : false;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item)}
                      className={clsx(
                        'flex w-full items-center justify-between gap-3 rounded-card px-3 py-2 text-left text-sm transition',
                        active ? 'bg-surface-2 text-text-primary' : 'text-text-secondary hover:bg-surface-2',
                        isCurrent && 'text-text-primary'
                      )}
                    >
                      <span>{item.label}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-tertiary">
                        {item.group}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-hairline px-4 py-2 text-[10px] text-text-tertiary">
          <span>Navigate with Up/Down, press Enter</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
