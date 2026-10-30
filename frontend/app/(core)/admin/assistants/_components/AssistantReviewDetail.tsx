import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import type { ReviewItem } from '@/server/admin-assistant-review/contracts';
import { AssistantReview } from './AssistantReview.client';
import { sourceLabels } from './AssistantReviewList';
export function AssistantReviewDetail({ item }: { item?: ReviewItem }) {
  return <div className="space-y-5">
    <AdminPageHeader title={item ? `${sourceLabels[item.source]} · review` : 'Assistant review'} description="Recorded context and human evaluation. Opening this page does not reveal conversation content." actions={<Link prefetch={false} href={item ? '/admin/assistants?' + new URLSearchParams({ source: item.source, userId: item.userId, scopeId: item.scopeId }) : '/admin/assistants'} className="text-sm underline">Back to timeline</Link>} />
    {!item ? <AdminNotice tone="warning">Evidence is unavailable. No content has been revealed.</AdminNotice> : <>
      <dl className="grid gap-3 rounded-xl border border-border p-4 text-sm sm:grid-cols-2">{Object.entries({ Account: item.userId, Context: item.scopeId, Request: item.requestId, State: item.state ?? 'Unknown', Surface: item.surface ?? 'See actions', 'Media model': item.mediaModel ?? 'See actions', 'Assistant model': item.assistantModel ?? 'See usage; external host model unknown', Created: item.createdAt }).map(([key, value]) => <div key={key}><dt className="text-text-muted">{key}</dt><dd className="break-all">{value}</dd></div>)}</dl>
      <AssistantReview key={`${item.source}:${item.userId}:${item.scopeId}:${item.requestId}`} scope={{ source: item.source, userId: item.userId, scopeId: item.scopeId, requestId: item.requestId }} />
    </>}
  </div>;
}
