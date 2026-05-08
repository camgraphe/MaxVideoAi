'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import {
  buildDirectorySummary,
  buildUserVolumeItems,
  fetchJson,
  normalizePositiveNumber,
  type AdminUser,
  type UsersResponse,
  type UserStatsResponse,
} from '../_lib/admin-users-data';

export type AdminUsersController = ReturnType<typeof useAdminUsersController>;

export function useAdminUsersController() {
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

  const replaceParams = useCallback(
    (nextSearch: string, nextPage: number) => {
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
    },
    [pathname, router, searchParams, startTransition]
  );

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
  const rows: AdminUser[] = data?.ok ? data.users ?? [] : [];
  const pagination = data?.ok ? data.pagination : undefined;
  const directorySummary = buildDirectorySummary({
    query: urlQuery,
    pagination,
    rows,
  });
  const volumeItems = buildUserVolumeItems(stats);

  const handleRefresh = () => {
    void mutate();
    void mutateStats();
  };

  const clearSearch = () => {
    setQuery('');
    replaceParams('', 1);
  };

  const previousPage = () => replaceParams(urlQuery, Math.max(1, currentPage - 1));
  const nextPage = () => {
    if (pagination?.nextPage) {
      replaceParams(urlQuery, pagination.nextPage);
    }
  };

  return {
    clearSearch,
    currentPage,
    directorySummary,
    error,
    fetchError,
    handleRefresh,
    isLoading,
    isRouting,
    nextPage,
    pagination,
    previousPage,
    query,
    rows,
    serviceRoleMissing,
    setQuery,
    stats,
    statsUnavailable,
    unauthorized,
    urlQuery,
    volumeItems,
  };
}
