'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, KeyRound, RefreshCw, Search, ShieldCheck, UserRound } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import { AdminDataTable } from '@/components/admin-system/surfaces/AdminDataTable';
import { AdminFilterBar } from '@/components/admin-system/surfaces/AdminFilterBar';
import { AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
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
        description="Recherche, triage support et navigation rapide vers les profils membre. La recherche URL fonctionne maintenant réellement sur l’ensemble du répertoire."
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

      <AdminSection
        title="User Volume"
        description="Repères de croissance membres, gardés compacts pour laisser la table prendre le rôle principal."
      >
        {controller.statsUnavailable ? (
          <AdminNotice tone="warning">
            Supabase service role key is missing. Add{' '}
            <code className="font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code> to display user metrics.
          </AdminNotice>
        ) : controller.stats ? (
          <AdminMetricGrid
            items={controller.volumeItems}
            density="compact"
            columnsClassName="sm:grid-cols-2 xl:grid-cols-4"
          />
        ) : (
          <UsersMetricSkeleton />
        )}
      </AdminSection>

      <AdminSection
        title="Member Directory"
        description="Search by email or Supabase user ID. The table stays dense and operational instead of card-heavy."
        action={
          <AdminSectionMeta
            title={controller.directorySummary}
            lines={[
              controller.isRouting || controller.isLoading
                ? 'Refreshing route state…'
                : 'Search is URL-driven and linkable.',
            ]}
          />
        }
      >
        <div className="space-y-4">
          <DirectoryToolbar
            value={controller.query}
            onChange={controller.setQuery}
            pending={controller.isRouting}
            hasQuery={Boolean(controller.urlQuery)}
            onClear={controller.clearSearch}
          />

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
        </div>
      </AdminSection>
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
        Supabase service role key is missing. Add{' '}
        <code className="font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code> to enable admin user listing.
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
    <AdminFilterBar
      onSubmit={(event) => event.preventDefault()}
      className="p-3"
      fieldsClassName="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
      actions={
        hasQuery ? (
          <Button type="button" variant="outline" size="sm" className="border-border bg-surface" onClick={onClear}>
            Clear search
          </Button>
        ) : null
      }
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <UIIcon icon={Search} size={16} className="text-text-muted" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search by email or Supabase user ID"
          className="w-full min-w-0 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        {pending ? <span className="text-xs text-text-secondary">Updating…</span> : null}
      </div>
    </AdminFilterBar>
  );
}

function UsersMetricSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-hairline bg-bg/40 px-4 py-4">
          <div className="h-3 w-20 animate-pulse rounded-full bg-surface-2" />
          <div className="mt-4 h-9 w-20 animate-pulse rounded-full bg-surface-2" />
          <div className="mt-3 h-3 w-28 animate-pulse rounded-full bg-surface-2" />
        </div>
      ))}
    </div>
  );
}

function UsersTableSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl border border-hairline bg-bg/35 p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_180px_180px]">
        <div className="h-12 animate-pulse rounded-2xl bg-surface-2" />
        <div className="h-12 animate-pulse rounded-2xl bg-surface-2" />
        <div className="h-12 animate-pulse rounded-2xl bg-surface-2" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
        <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(220px,1fr)_140px_140px_140px_140px_90px] gap-3 border-b border-hairline px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-text-muted">
          <div>Member</div>
          <div>User ID</div>
          <div>Role</div>
          <div>Security</div>
          <div>Created</div>
          <div>Last sign-in</div>
          <div className="text-right">Open</div>
        </div>
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-[minmax(0,1.3fr)_minmax(220px,1fr)_140px_140px_140px_140px_90px] items-center gap-3 border-b border-hairline px-4 py-3 last:border-b-0"
          >
            <div className="space-y-2">
              <div className="h-4 w-32 animate-pulse rounded-full bg-surface-2" />
              <div className="h-3 w-24 animate-pulse rounded-full bg-surface-2" />
            </div>
            <div className="h-3 w-full animate-pulse rounded-full bg-surface-2" />
            <div className="h-8 w-20 animate-pulse rounded-full bg-surface-2" />
            <div className="h-8 w-20 animate-pulse rounded-full bg-surface-2" />
            <div className="h-3 w-24 animate-pulse rounded-full bg-surface-2" />
            <div className="h-3 w-24 animate-pulse rounded-full bg-surface-2" />
            <div className="ml-auto h-8 w-16 animate-pulse rounded-lg bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

function UsersTable({ rows }: { rows: AdminUser[] }) {
  return (
    <AdminDataTable tone="muted" tableClassName="w-full min-w-[980px]">
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
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass}`}>
      <UIIcon icon={icon} size={12} />
      {children}
    </span>
  );
}
