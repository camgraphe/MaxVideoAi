'use client';
import { useRef, useState } from 'react';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { reviewIssues, type AssistantReviewDetail, type AssistantReviewScope, type Annotation } from '@/server/admin-assistant-review/contracts';

export function AssistantReview({ scope }: { scope: AssistantReviewScope }) {
  const [detail, setDetail] = useState<AssistantReviewDetail | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  const [verdict, setVerdict] = useState('unreviewed'), [issues, setIssues] = useState<string[]>([]), [note, setNote] = useState('');
  const pending = useRef<{ signature: string; id: string } | null>(null);
  async function send(body: object) {
    const response = await fetch('/api/admin/assistants/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'Admin access is required.' : response.status === 404 ? 'The retained source is no longer available.' : 'Evidence or access auditing is unavailable.');
    return response.json();
  }
  async function reveal() {
    if (busy) return; setBusy(true); setError(''); setSaved(false);
    try { const result = await send({ action: 'reveal', ...scope }); setDetail(result.detail); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Review unavailable.'); }
    finally { setBusy(false); }
  }
  async function annotate() {
    if (busy) return; setBusy(true); setError(''); setSaved(false);
    const body = { ...scope, verdict, issues, note }, signature = JSON.stringify(body);
    if (pending.current?.signature !== signature) pending.current = { signature, id: crypto.randomUUID() };
    try {
      const result = await send({ action: 'annotate', ...body, id: pending.current.id }) as { annotation: Annotation };
      setDetail(current => current ? { ...current, annotations: { ...current.annotations, items: [result.annotation, ...current.annotations.items.filter(item => item.id !== result.annotation.id)].slice(0, 20) } } : null);
      setSaved(true); pending.current = null;
    } catch (failure) { setError(`Review could not be saved. ${failure instanceof Error ? failure.message : ''} Your note is preserved.`); }
    finally { setBusy(false); }
  }
  return <div className="space-y-4">
    <AdminNotice>Content access and reviews are recorded with your admin identity. Customer text is private and untrusted. Links, credentials and hidden reasoning are excluded; redaction does not anonymize arbitrary prose.</AdminNotice>
    {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    {!detail ? <button type="button" disabled={busy} onClick={() => void reveal()} className="rounded border border-border bg-surface px-4 py-3 text-sm disabled:opacity-50">{busy ? 'Recording access…' : 'Reveal recorded content'}</button> : <>
      <button type="button" disabled={busy} onClick={() => { setDetail(null); setNote(''); setIssues([]); setVerdict('unreviewed'); setSaved(false); pending.current = null; }} className="rounded border border-border px-4 py-2 text-sm">Hide content</button>
      <AdminNotice>{detail.limitations.join(' ')} Access: {detail.accessId}.</AdminNotice>
      <AdminSection title="Conversation"><div className="space-y-4 text-sm">
        <div><h3 className="mb-1 font-semibold">User</h3><p className="whitespace-pre-wrap break-words">{detail.message ?? 'No user chat message retained for this source.'}</p></div>
        <div><h3 className="mb-1 font-semibold">Assistant</h3><p className="whitespace-pre-wrap break-words">{detail.reply ?? 'No visible reply retained. MCP host replies are unavailable.'}</p></div>
        {detail.proposal ? <details><summary className="cursor-pointer font-semibold">Suggested prompt</summary><p className="mt-2 whitespace-pre-wrap break-words">{detail.proposal}</p></details> : null}
      </div></AdminSection>
      <AdminSection title="Recorded context and execution"><div className="space-y-3">{detail.evidence.map((entry, index) => <details key={index} className="rounded border border-border p-3"><summary className="cursor-pointer text-sm font-medium">{entry.title}{entry.status === 'unavailable' ? ' · unavailable' : ''}</summary>
        {entry.status === 'unavailable' ? <p className="mt-2 text-sm">This evidence source is unavailable, not empty.</p> : <>{entry.data.truncated || entry.rowsTruncated ? <p className="mt-2 text-sm text-warning">Truncated: only a bounded portion is shown.</p> : null}{entry.data.value === null ? <p className="mt-2 text-sm">No historical snapshot retained.</p> : <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(entry.data.value, null, 2)}</pre>}</>}
      </details>)}</div></AdminSection>
      <AdminSection title="Human review" description="An internal evaluation, separate from the customer's opinion or the technical status.">
        {detail.annotations.status === 'unavailable' ? <AdminNotice tone="warning">Review storage is unavailable.</AdminNotice> : <form onSubmit={event => { event.preventDefault(); void annotate(); }} className="space-y-3">
          <label className="grid gap-1 text-sm">Assessment<select aria-label="Assessment" value={verdict} onChange={event => { setVerdict(event.target.value); setSaved(false); }} className="rounded border border-border bg-bg p-2"><option value="unreviewed">Unreviewed</option><option value="useful">Useful</option><option value="needs_work">Needs work</option></select></label>
          <fieldset className="flex flex-wrap gap-3 text-sm"><legend className="mb-2">Areas to improve</legend>{reviewIssues.map(issue => <label key={issue} className="flex items-center gap-1.5"><input type="checkbox" checked={issues.includes(issue)} onChange={event => { setIssues(current => event.target.checked ? [...current, issue] : current.filter(item => item !== issue)); setSaved(false); }} />{issue.replaceAll('_', ' ')}</label>)}</fieldset>
          <label className="grid gap-1 text-sm">Reviewer note<textarea aria-label="Reviewer note" value={note} onChange={event => { setNote(event.target.value); setSaved(false); }} maxLength={2000} rows={3} className="rounded border border-border bg-bg p-2" /></label>
          <button disabled={busy || saved} type="submit" className="rounded border border-border px-4 py-2 text-sm disabled:opacity-50">{busy ? 'Saving…' : 'Save review'}</button>{saved ? <span role="status" className="ml-3 text-sm">Review saved.</span> : null}
        </form>}
        <ol className="mt-4 space-y-3 text-sm">{detail.annotations.items.map(item => <li key={item.id} className="border-t border-border pt-3"><strong>{item.verdict.replaceAll('_', ' ')}</strong> · {item.issues.join(', ')}<p className="whitespace-pre-wrap break-words">{item.note}</p><small className="text-text-muted">{item.actorId} · {item.createdAt}</small></li>)}</ol>{detail.annotations.truncated ? <p className="text-sm">Only the latest 20 reviews are shown.</p> : null}
      </AdminSection>
    </>}
  </div>;
}
