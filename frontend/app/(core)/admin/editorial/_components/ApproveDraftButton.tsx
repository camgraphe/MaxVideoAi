'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ApproveDraftButton({ articleId, version, digest }: { articleId: string; version: number; digest: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    if (!window.confirm(`Approve draft version ${version} (${digest.slice(0, 12)}…)? This records editorial approval and does not publish it.`)) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/editorial/${articleId}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version, digest }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Approval failed');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Approval failed');
    } finally {
      setPending(false);
    }
  }

  return <div className="mt-5"><button type="button" onClick={approve} disabled={pending} className="rounded-full bg-text-primary px-5 py-2.5 text-sm font-semibold text-bg disabled:opacity-50">{pending ? 'Approving…' : 'Approve this exact version'}</button>{error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}</div>;
}
