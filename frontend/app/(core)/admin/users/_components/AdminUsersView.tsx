'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, KeyRound, RefreshCw, Search, ShieldCheck, UserRound } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminDataTable } from '@/components/admin-system/surfaces/AdminDataTable';
import { Button } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';
import type { AdminUsersController } from '../_hooks/useAdminUsersController';
import {
  formatDateTime,
  formatNumber,
  resolveProvider,
  type AdminUser,
  type UsersResponse,
} from '../_lib/admin-users-data';

export function AdminUsersView({ controller }: { controller: AdminUsersController }) {
  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Operations"
        title="Users"
        description="Find accounts, review activity and manage support."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-border bg-surface"
            onClick={controller.handleRefresh}
          >
            <UIIcon icon={RefreshCw} size={14} />
            Refresh
          </Button>
        }
      />

      <section aria-label="Registration summary" className="border-b border-border pb-4">
        {controller.statsUnavailable ? (
          <p className="text-sm text-text-secondary">Registration totals are unavailable.</p>
        ) : controller.stats ? (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {controller.volumeItems.map((item) => (
              <div key={item.label}>
                <dt className="text-xs text-text-secondary">{item.label}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : <UsersMetricSkeleton />}
        <p className="mt-3 text-xs text-text-muted">Registrations · Today starts at midnight in Europe/Madrid.</p>
      </section>
      <section aria-label="Member directory" className="space-y-4">
          <DirectoryToolbar
            value={controller.query}
            onChange={controller.setQuery}
            pending={controller.isRouting}
            hasQuery={Boolean(controller.urlQuery)}
            onClear={controller.clearSearch}
          />

          <p role="status" className="text-xs text-text-secondary">{controller.isRouting || controller.isLoading ? 'Loading accounts…' : controller.directorySummary}</p>
          <DirectoryNotice controller={controller} />

          {controller.isLoading ? (
            <UsersTableSkeleton />
          ) : controller.unauthorized ||
            controller.serviceRoleMissing ||
            controller.error ||
            controller.fetchError ? null : controller.rows.length ? (
            <>
              <UsersTable rows={controller.rows} />
              <DirectoryPagination
                page={controller.currentPage}
                pagination={controller.pagination}
                onPrevious={controller.previousPage}
                onNext={controller.nextPage}
              />
            </>
          ) : (
            <AdminEmptyState>
              {controller.urlQuery ? `No users found for "${controller.urlQuery}".` : 'No users found.'}
            </AdminEmptyState>
          )}
      </section>
    </div>
  );
}

function DirectoryNotice({ controller }: { controller: AdminUsersController }) {
  if (controller.unauthorized) {
    return <AdminNotice tone="error">Access denied. Sign in with an admin account.</AdminNotice>;
  }

  if (controller.serviceRoleMissing) {
    return (
      <AdminNotice tone="warning">
        Supabase service role key is missing. Add <code className="font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code>{' '}
        to enable admin user listing.
      </AdminNotice>
    );
  }

  if (controller.error) {
    return <AdminNotice tone="error">{controller.error.message || 'Failed to load users.'}</AdminNotice>;
  }

  if (controller.fetchError) {
    return <AdminNotice tone="error">{controller.fetchError}</AdminNotice>;
  }

  return null;
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
    <form onSubmit={(event) => event.preventDefault()} className="flex flex-wrap items-center gap-3">
      <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-border px-3">
        <span className="sr-only">Search users</span>
        <UIIcon icon={Search} size={16} className="text-text-muted" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search by email or Supabase user ID"
          className="w-full min-w-0 bg-transparent text-sm focus:outline-none"
        />
        {pending ? <span className="text-xs text-text-secondary">Updating…</span> : null}
      </label>
      {hasQuery ? <Button type="button" variant="outline" size="sm" onClick={onClear}>Clear search</Button> : null}
    </form>
  );
}

function UsersMetricSkeleton() {
  return <div aria-label="Loading registration totals" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
    {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-14 animate-pulse rounded bg-surface-2" />)}
  </div>;
}

function UsersTableSkeleton() {
  return <div aria-label="Loading accounts" className="divide-y divide-hairline">
    {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-16 animate-pulse bg-surface-2/50" />)}
  </div>;
}

function UsersTable({ rows }: { rows: AdminUser[] }) {
  return (
    <AdminDataTable tone="muted" tableClassName="w-full min-w-[720px]">
      <thead className="bg-surface">
        <tr className="text-xs text-text-secondary">
          <th className="px-4 py-3 font-semibold">Member</th>
          <th className="px-4 py-3 font-semibold">Access</th>
          <th className="px-4 py-3 font-semibold">Created</th>
          <th className="px-4 py-3 font-semibold">Last sign-in</th>
          <th className="px-4 py-3 text-right font-semibold">Open</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((user) => {
          const provider = resolveProvider(user.appMetadata);
          return (
            <tr key={user.id} data-user-id={user.id} className="border-t border-hairline transition hover:bg-bg">
              <td className="px-4 py-3">
                <div className="min-w-0">
                  <Link href={`/admin/users/${user.id}`} className="font-medium text-text-primary hover:text-brand">{user.email ?? 'No email attached'}</Link>
                  <p className="mt-1 max-w-[260px] truncate font-mono text-xs text-text-muted" title={user.id}>{user.id}</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {provider ? `Provider: ${provider}` : 'Provider unavailable'}
                  </p>
                </div>
              </td>
              <td className="px-4 py-3">
                <InlineBadge tone={user.isAdmin ? 'info' : 'default'} icon={ShieldCheck}>
                  {user.isAdmin ? 'Admin' : 'Member'}
                </InlineBadge>
                <div className="mt-1"><InlineBadge tone={user.factors > 0 ? 'success' : 'default'} icon={KeyRound}>
                  {user.factors > 0 ? `${user.factors} MFA` : 'No MFA'}
                </InlineBadge></div>
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
    </AdminDataTable>
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
    <span
      className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-medium ${toneClass}`}
    >
      <UIIcon icon={icon} size={12} />
      {children}
    </span>
  );
}
