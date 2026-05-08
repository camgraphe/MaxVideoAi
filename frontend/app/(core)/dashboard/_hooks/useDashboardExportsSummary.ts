'use client';

import { useEffect, useState } from 'react';
import { authFetch } from '@/lib/authFetch';

export function useDashboardExportsSummary({
  authLoading,
  hasStoredForm,
}: {
  authLoading: boolean;
  hasStoredForm: boolean;
}) {
  const [exportsSummary, setExportsSummary] = useState<{ total: number } | null>(null);

  useEffect(() => {
    if (authLoading || hasStoredForm || exportsSummary) return;
    let mounted = true;
    authFetch('/api/user/exports/summary')
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = (await response.json().catch(() => null)) as { total?: number } | null;
        if (!mounted || !payload) return null;
        setExportsSummary({ total: Number(payload.total ?? 0) });
        return null;
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [authLoading, hasStoredForm, exportsSummary]);

  return exportsSummary;
}
