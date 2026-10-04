'use client';

import { useState } from 'react';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import type { ReviewDetail, ReviewScope } from '@/server/admin-studio-review/contracts';
import { StudioReviewEvidence } from './StudioReviewEvidence';

export function StudioReviewReveal({ scope }: { scope: ReviewScope }) {
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function reveal() {
    if (loading) return;
    setLoading(true); setError(null);
    try {
      const response = await fetch('/api/admin/studio/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(scope), cache: 'no-store' });
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'Admin access is required.' : response.status === 404 ? 'This retained turn is no longer available.' : 'Evidence or access auditing is unavailable. No content was revealed.');
      const payload = await response.json() as { detail: ReviewDetail };
      setDetail(payload.detail);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Review unavailable.'); }
    finally { setLoading(false); }
  }
  return <div className="space-y-5">
    <AdminNotice>Revealing content records your admin ID, the target turn, and the access time. Only submitted text, the visible saved reply and selected operational facts are shown. Links and credential-shaped content are redacted. No raw export is available.</AdminNotice>
    {error ? <div role="alert"><AdminNotice tone="error">{error}</AdminNotice></div> : null}
    {detail ? <><button type="button" className="rounded border border-border px-4 py-2 text-sm" onClick={() => setDetail(null)}>Hide content</button><StudioReviewEvidence detail={detail} /></> : <button type="button" disabled={loading} onClick={() => void reveal()} className="rounded border border-border bg-surface px-4 py-3 text-sm font-medium disabled:opacity-50">{loading ? 'Recording access…' : 'Reveal recorded content'}</button>}
  </div>;
}
