import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import type { ReviewTurn } from '@/server/admin-studio-review/contracts';
import { StudioReviewReveal } from './StudioReviewReveal.client';
import { reviewProgressLabel, reviewStateLabel } from './StudioReviewStatus';

export function AdminStudioDetail({ turn, unavailable = false }: { turn?: ReviewTurn; unavailable?: boolean }) {
  return <div className="space-y-6">
    <AdminPageHeader title="Studio turn review" description="A bounded view of retained operational evidence. It cannot reconstruct the full historical model context." actions={<Link prefetch={false} href="/admin/studio" className="text-sm underline">All Studio turns</Link>} />
    {unavailable || !turn ? <AdminNotice tone="warning">Turn evidence is unavailable. No conversation content has been revealed.</AdminNotice> : <>
      <dl className="grid gap-3 rounded-xl border border-border bg-surface p-5 text-sm sm:grid-cols-2">{Object.entries({ Account: turn.userId, Project: turn.projectId, Turn: turn.requestId, 'Stored state': reviewStateLabel(turn.state), 'Request progress': reviewProgressLabel(turn), 'Created (UTC)': turn.createdAt, 'Model attempts': turn.attempts }).map(([label, value]) => <div key={label}><dt className="text-text-muted">{label}</dt><dd className="break-all">{value}</dd></div>)}</dl>
      <AdminNotice>Ready means a visible reply was saved. Preparation outcomes require reviewing the recorded actions and any quote.</AdminNotice>
      <StudioReviewReveal scope={{ userId: turn.userId, projectId: turn.projectId, requestId: turn.requestId }} />
    </>}
  </div>;
}
