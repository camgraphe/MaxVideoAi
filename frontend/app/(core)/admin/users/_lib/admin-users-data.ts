export type AdminUser = {
  id: string;
  email: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  appMetadata: Record<string, unknown> | null;
  userMetadata: Record<string, unknown> | null;
  factors: number;
  isAdmin: boolean;
};

export type UsersResponse = {
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

export type UserStatsResponse =
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

export const fetchJson = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return (await res.json()) as T;
};

export function buildDirectorySummary({
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

export function buildUserVolumeItems(stats: Extract<UserStatsResponse, { ok: true }>['stats'] | null) {
  return stats
    ? [
        { label: 'All time', value: formatNumber(stats.total), helper: 'Total members synced' },
        { label: 'Today', value: formatNumber(stats.today), helper: 'New accounts today' },
        { label: 'Last 7 days', value: formatNumber(stats.last7), helper: 'Recent acquisition' },
        { label: 'Last 30 days', value: formatNumber(stats.last30), helper: 'Monthly intake' },
      ]
    : [];
}

export function normalizePositiveNumber(value: string | null | undefined, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function resolveProvider(appMetadata: Record<string, unknown> | null) {
  if (!appMetadata) return null;
  const provider = appMetadata.provider;
  return typeof provider === 'string' && provider.trim() ? provider : null;
}

export function formatNumber(value: number | null | undefined) {
  return value == null ? '—' : numberFormatter.format(value);
}

export function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}
