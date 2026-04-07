'use client';

import Link from 'next/link';
import { type ReactNode, useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { ChevronLeft, ChevronRight, KeyRound, RefreshCw, Search, ShieldCheck, UserRound } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import { AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { Button } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';

type AdminUser = {
  id: string;
  email: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  appMetadata: Record<string, unknown> | null;
  userMetadata: Record<string, unknown> | null;
  factors: number;
  isAdmin: boolean;
};

type UsersResponse = {
  ok: boolean;
  users?: AdminUser[];
  pagination?: {
    page: number;
    perPage: number;
    nextPage: number | null;
    returned: number;
    totalMatches: number | null;
  };
  message?: string;
  error?: string;
};

type UserStatsResponse =
  | {
      ok: true;
      stats: {
        total: number;
        today: number;
        last7: number;
        last30: number;
      };
    }
  | { ok: false; error?: string; message?: string };

const numberFormatter = new Intl.NumberFormat('en-US');

const fetchJson = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return (await res.json()) as T;
};

export default function AdminUsersPage() {
  const router = useRouter();
  const pathname = usePathname() ?? '/admin/users';
  const searchParams = useSearchParams();
  const [isRouting, startTransition] = useTransition();
  const urlQuery = searchParams?.get('search') ?? '';
  const currentPage = normalizePositiveNumber(searchParams?.get('page'), 1);
  const [query, setQuery] = useState(urlQuery);

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  const replaceParams = useCallback((nextSearch: string, nextPage: number) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    const trimmedSearch = nextSearch.trim();

    if (trimmedSearch) {
      params.set('search', trimmedSearch);
    } else {
      params.delete('search');
    }

    if (nextPage > 1) {
      params.set('page', String(nextPage));
    } else {
      params.delete('page');
    }

    const nextQueryString = params.toString();
    const nextHref = nextQueryString ? `${pathname}?${nextQueryString}` : pathname;
    const currentQueryString = searchParams?.toString() ?? '';
    const currentHref = currentQueryString ? `${pathname}?${currentQueryString}` : pathname;

    if (nextHref === currentHref) return;

    startTransition(() => {
      router.replace(nextHref);
    });
  }, [pathname, router, searchParams, startTransition]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery === urlQuery) return undefined;
    const timer = window.setTimeout(() => {
      replaceParams(trimmedQuery, 1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, replaceParams, urlQuery]);

  const requestParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(currentPage));
    params.set('perPage', '25');
    if (urlQuery) {
      params.set('search', urlQuery);
    }
    return params.toString();
  }, [currentPage, urlQuery]);

  const usersUrl = `/api/admin/users?${requestParams}`;
  const { data, error, isLoading, mutate } = useSWR<UsersResponse>(usersUrl, fetchJson);
  const { data: statsData, mutate: mutateStats } = useSWR<UserStatsResponse>('/api/admin/stats/users', fetchJson);

  const unauthorized = error?.message?.includes('Unauthorized') || error?.message?.includes('Forbidden');
  const serviceRoleMissing = data?.ok === false && data.error === 'SERVICE_ROLE_NOT_CONFIGURED';
  const fetchError = data?.ok === false && !serviceRoleMissing ? data.error ?? data.message ?? 'Failed to load users.' : null;
  const statsUnavailable = statsData?.ok === false && statsData.error === 'SERVICE_ROLE_NOT_CONFIGURED';
  const stats = statsData && statsData.ok ? statsData.stats : null;
  const rows = data?.ok ? data.users ?? [] : [];
  const pagination = data?.ok ? data.pagination : undefined;
  const directorySummary = buildDirectorySummary({
    query: urlQuery,
    pagination,
    rows,
  });
  const volumeItems = stats
    ? [
        { label: 'All time', value: formatNumber(stats.total), helper: 'Total members synced' },
        { label: 'Today', value: formatNumber(stats.today), helper: 'New accounts today' },
        { label: 'Last 7 days', value: formatNumber(stats.last7), helper: 'Recent acquisition' },
        { label: 'Last 30 days', value: formatNumber(stats.last30), helper: 'Monthly intake' },
      ]
    : [];

  const handleRefresh = () => {
    void mutate();
    void mutateStats();
  };

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Operations"
        title="Users"
        description="Recherche, triage support et navigation rapide vers les profils membre. La recherche URL fonctionne maintenant réellement sur l’ensemble du répertoire."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-border bg-surface"
            onClick={handleRefresh}
          >
            <UIIcon icon={RefreshCw} size={14} />
            Refresh
          </Button>
        }
      />

      <AdminSection title="User Volume" description="Repères de croissance membres, gardés compacts pour laisser la table prendre le rôle principal.">
        {statsUnavailable ? (
          <AdminNotice tone="warning">
            Supabase service role key is missing. Add <code className="font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code> to display user metrics.
          </AdminNotice>
        ) : stats ? (
          <AdminMetricGrid items={volumeItems} density="compact" columnsClassName="sm:grid-cols-2 xl:grid-cols-4" />
        ) : (
          <AdminEmptyState>Metrics are loading.</AdminEmptyState>
        )}
      </AdminSection>

      <AdminSection
        title="Member Directory"
        description="Search by email or Supabase user ID. The table stays dense and operational instead of card-heavy."
        action={
          <AdminSectionMeta
            title={directorySummary}
            lines={[isRouting || isLoading ? 'Refreshing route state…' : 'Search is URL-driven and linkable.']}
          />
        }
      >
        <div className="space-y-4">
          <DirectoryToolbar
            value={query}
            onChange={setQuery}
            pending={isRouting}
            hasQuery={Boolean(urlQuery)}
            onClear={() => {
              setQuery('');
              replaceParams('', 1);
            }}
          />

          {unauthorized ? (
            <AdminNotice tone="error">Access denied. Sign in with an admin account.</AdminNotice>
          ) : serviceRoleMissing ? (
            <AdminNotice tone="warning">
              Supabase service role key is missing. Add <code className="font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code> to enable admin user listing.
            </AdminNotice>
          ) : error ? (
            <AdminNotice tone="error">{error.message || 'Failed to load users.'}</AdminNotice>
          ) : fetchError ? (
            <AdminNotice tone="error">{fetchError}</AdminNotice>
          ) : null}

          {isLoading ? (
            <AdminEmptyState>Loading members…</AdminEmptyState>
          ) : unauthorized || serviceRoleMissing || error || fetchError ? null : rows.length ? (
            <>
              <UsersTable rows={rows} />
              <DirectoryPagination
                page={currentPage}
                pagination={pagination}
                onPrevious={() => replaceParams(urlQuery, Math.max(1, currentPage - 1))}
                onNext={() => {
                  if (pagination?.nextPage) {
                    replaceParams(urlQuery, pagination.nextPage);
                  }
                }}
              />
            </>
          ) : (
            <AdminEmptyState>
              {urlQuery ? `No users found for "${urlQuery}".` : 'No users found.'}
            </AdminEmptyState>
          )}
        </div>
      </AdminSection>
    </div>
  );
}

function DirectoryToolbar({
  value,
  onChange,
  pending,
  hasQuery,
  onClear,
}: {
  value: string;
  onChange: (value: string) => void;
  pending: boolean;
  hasQuery: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <form
        onSubmit={(event) => event.preventDefault()}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border bg-bg/40 px-4 py-3"
      >
        <UIIcon icon={Search} size={16} className="text-text-muted" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search by email or Supabase user ID"
          className="w-full min-w-0 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        {pending ? <span className="text-xs text-text-secondary">Updating…</span> : null}
      </form>

      <div className="flex items-center gap-2">
        {hasQuery ? (
          <Button type="button" variant="outline" size="sm" className="border-border bg-surface" onClick={onClear}>
            Clear search
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function UsersTable({ rows }: { rows: AdminUser[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-bg/40">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-surface">
            <tr className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
              <th className="px-4 py-3 font-semibold">Member</th>
              <th className="px-4 py-3 font-semibold">User ID</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Security</th>
              <th className="px-4 py-3 font-semibold">Created</th>
              <th className="px-4 py-3 font-semibold">Last sign-in</th>
              <th className="px-4 py-3 text-right font-semibold">Open</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((user) => {
              const provider = resolveProvider(user.appMetadata);
              return (
                <tr key={user.id} className="border-t border-hairline transition hover:bg-bg">
                  <td className="px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-text-primary">{user.email ?? 'No email attached'}</p>
                      <p className="mt-1 text-xs text-text-secondary">
                        {provider ? `Provider: ${provider}` : 'Provider unavailable'}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">{user.id}</td>
                  <td className="px-4 py-3">
                    <InlineBadge tone={user.isAdmin ? 'info' : 'default'} icon={ShieldCheck}>
                      {user.isAdmin ? 'Admin' : 'Member'}
                    </InlineBadge>
                  </td>
                  <td className="px-4 py-3">
                    <InlineBadge tone={user.factors > 0 ? 'success' : 'default'} icon={KeyRound}>
                      {user.factors > 0 ? `${user.factors} MFA` : 'No MFA'}
                    </InlineBadge>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{formatDateTime(user.createdAt)}</td>
                  <td className="px-4 py-3 text-text-secondary">{formatDateTime(user.lastSignInAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="inline-flex min-h-[34px] items-center rounded-lg border border-border bg-surface px-3 text-xs font-medium text-text-primary transition hover:bg-surface-hover"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DirectoryPagination({
  page,
  pagination,
  onPrevious,
  onNext,
}: {
  page: number;
  pagination?: UsersResponse['pagination'];
  onPrevious: () => void;
  onNext: () => void;
}) {
  if (!pagination) return null;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-text-secondary">
        Page {page} · {pagination.returned} rows
        {pagination.totalMatches != null ? ` · ${formatNumber(pagination.totalMatches)} matches` : ''}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-border bg-surface"
          disabled={page <= 1}
          onClick={onPrevious}
        >
          <UIIcon icon={ChevronLeft} size={14} />
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-border bg-surface"
          disabled={!pagination.nextPage}
          onClick={onNext}
        >
          Next
          <UIIcon icon={ChevronRight} size={14} />
        </Button>
      </div>
    </div>
  );
}

function InlineBadge({
  tone,
  icon,
  children,
}: {
  tone: 'default' | 'success' | 'info';
  icon: typeof UserRound;
  children: ReactNode;
}) {
  const toneClass =
    tone === 'success'
      ? 'border-success-border bg-success-bg text-success'
      : tone === 'info'
        ? 'border-info-border bg-info-bg text-info'
        : 'border-border bg-surface text-text-secondary';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass}`}>
      <UIIcon icon={icon} size={12} />
      {children}
    </span>
  );
}

function buildDirectorySummary({
  query,
  pagination,
  rows,
}: {
  query: string;
  pagination?: UsersResponse['pagination'];
  rows: AdminUser[];
}) {
  if (query) {
    if (pagination?.totalMatches != null) {
      return `${formatNumber(pagination.totalMatches)} match${pagination.totalMatches > 1 ? 'es' : ''}`;
    }
    return `${formatNumber(rows.length)} result${rows.length > 1 ? 's' : ''}`;
  }

  if (pagination) {
    return `${formatNumber(pagination.returned)} members loaded`;
  }

  return 'Member directory';
}

function normalizePositiveNumber(value: string | null | undefined, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function resolveProvider(appMetadata: Record<string, unknown> | null) {
  if (!appMetadata) return null;
  const provider = appMetadata.provider;
  return typeof provider === 'string' && provider.trim() ? provider : null;
}

function formatNumber(value: number | null | undefined) {
  return value == null ? '—' : numberFormatter.format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}
