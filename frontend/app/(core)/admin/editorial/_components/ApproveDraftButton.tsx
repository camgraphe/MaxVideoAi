'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ApproveDraftButton({ articleId, version, digest, disabledReason, publish = false, retryChecks = false, retryPublication = false }: { articleId: string; version: number; digest: string; disabledReason?: string; publish?: boolean; retryChecks?: boolean; retryPublication?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    if (disabledReason || pending) return;
    if (!window.confirm(retryPublication ? 'Resume publication of this version? Completed steps will be verified before continuing.' : retryChecks ? 'Rerun technical checks for this version? Content will not be regenerated.' : publish ? `Approve and publish version ${version} in EN, FR and ES on MaxVideoAI? Publication will start automatically.` : `Approve the content of version ${version}? Editorial approval does not publish the article.`)) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/editorial/${articleId}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version, digest, ...(retryPublication ? {intent: 'retry-publication'} : retryChecks ? { intent: 'retry-checks' } : publish ? { intent: 'publish' } : {}) }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Approval failed');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Approval failed');
    } finally {
      setPending(false);
    }
  }

  return <div className="mt-5"><button type="button" onClick={approve} disabled={pending || Boolean(disabledReason)} className="rounded-md bg-text-primary px-5 py-2.5 text-sm font-semibold text-bg disabled:opacity-50">{pending ? 'Saving…' : retryPublication ? 'Resume publication' : retryChecks ? 'Rerun checks' : publish ? 'Approve and publish' : 'Approve this version'}</button>{disabledReason && <p className="mt-2 text-sm text-text-secondary">{disabledReason}</p>}{error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}</div>;
}
