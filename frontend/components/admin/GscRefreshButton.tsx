'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { AdminActionButton } from '@/components/admin-system/shell/AdminActionLink';

export function GscRefreshButton({ range }: { range: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    const response = await fetch(`/api/admin/seo/gsc/refresh?range=${encodeURIComponent(range)}`, {
      method: 'POST',
      cache: 'no-store',
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? 'Refresh failed');
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center gap-2">
      <AdminActionButton type="button" onClick={refresh} disabled={isPending}>
        <RefreshCw className={isPending ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        Refresh GSC data
      </AdminActionButton>
      {error ? <span className="max-w-56 text-xs font-medium text-warning">{error}</span> : null}
    </div>
  );
}
