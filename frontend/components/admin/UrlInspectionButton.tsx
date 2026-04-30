'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SearchCheck } from 'lucide-react';
import { AdminActionButton } from '@/components/admin-system/shell/AdminActionLink';
import type { UrlInspectionGroup } from '@/lib/seo/internal-seo-types';

export function UrlInspectionButton({
  range,
  urls,
  group,
  force = false,
  label,
  estimatedCalls,
}: {
  range: string;
  urls?: string[];
  group?: UrlInspectionGroup | 'all';
  force?: boolean;
  label: string;
  estimatedCalls: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  async function inspect() {
    setMessage(null);
    const response = await fetch(`/api/admin/seo/url-inspection/inspect?range=${encodeURIComponent(range)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls, group, force }),
      cache: 'no-store',
    });
    const payload = (await response.json().catch(() => null)) as { inspected?: number; skipped?: number; error?: string } | null;
    if (!response.ok) {
      setMessage(payload?.error ?? 'Inspection failed');
      return;
    }
    setMessage(`${payload?.inspected ?? 0} inspected, ${payload?.skipped ?? 0} skipped`);
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AdminActionButton type="button" onClick={inspect} disabled={isPending || estimatedCalls <= 0}>
        <SearchCheck className={isPending ? 'h-4 w-4 animate-pulse' : 'h-4 w-4'} />
        {label}
      </AdminActionButton>
      <span className="text-xs font-medium text-text-muted">{estimatedCalls} call{estimatedCalls === 1 ? '' : 's'}</span>
      {message ? <span className="max-w-56 text-xs font-medium text-text-secondary">{message}</span> : null}
    </div>
  );
}
