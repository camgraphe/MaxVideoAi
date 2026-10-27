'use client';
import { useState } from 'react';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminActionButton } from '@/components/admin-system/shell/AdminActionLink';
import { useTariffBatch } from '../_hooks/useTariffBatch';
import { TariffBatchReview } from './TariffBatchReview.client';

const field = 'rounded-lg border border-border bg-surface p-2 text-sm text-text-primary';
export function TariffBatchPanel() {
  const controller = useTariffBatch();
  const [open, setOpen] = useState(false), [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState('all'), [resolution, setResolution] = useState('all');
  const [intent, setIntent] = useState<'create_missing' | 'replace_selected'>('create_missing');
  const [input, setInput] = useState('recipe'), [multiplier, setMultiplier] = useState('1.50');
  const [reason, setReason] = useState(''), [importText, setImportText] = useState(''), [parseError, setParseError] = useState<string | null>(null);
  const { operation, options, busy, pending } = controller;
  const visible = options.classes.filter(row => (mode === 'all' || row.selector.mode === mode) && (resolution === 'all' || row.selector.resolution === resolution));
  const locked = busy || pending;
  const edit = (action: () => void) => { if (locked) return; controller.reset(); setParseError(null); action(); };
  if (!options.enabled && !controller.recoveryId && !controller.error) return null;
  const preview = () => {
    setParseError(null);
    if (input === 'explicit') {
      try { void controller.preview(JSON.parse(importText)); } catch { setParseError('Enter a valid exact batch JSON document.'); }
    } else void controller.preview({ schemaVersion: 1, modelId: 'kling-v4', intent, reason,
      pricing: { kind: 'list_multiplier', multiplier }, selections: options.classes.filter(row => selected.includes(row.key)).map(row => ({ selector: row.selector })) });
  };
  return <AdminSection title="Batch price changes" description="Prepare one reviewed group of exact customer prices.">
    <details open={open || Boolean(controller.recoveryId)} onToggle={event => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer py-2 font-semibold">Tariff batches</summary>
      <div className="min-w-0 space-y-4 pt-3">
        {(controller.error || parseError) && <AdminNotice tone="error">{parseError ?? controller.error}</AdminNotice>}
        {pending && <AdminNotice tone="warning">Confirmation outcome pending. Read the saved operation or reconcile it before starting another batch.</AdminNotice>}
        {operation && <p role="status" className="font-semibold">{controller.uncertain ? 'Outcome unknown' : ({ previewed: 'Preview ready', accepted: 'Outcome pending', committed: 'Committed', not_applied: 'Not applied' }[operation.status])}</p>}
        {operation?.status === 'committed' && operation.refreshStatus === 'pending' && <AdminNotice tone="warning">
          {operation.refreshError ?? 'Prices committed. Public page refresh is pending.'}
          <AdminActionButton disabled={busy} onClick={() => void controller.refreshPages()}>Retry page refresh</AdminActionButton>
        </AdminNotice>}
        {operation?.failure && <AdminNotice tone="warning">{operation.failure}</AdminNotice>}
        {operation?.operationalWarnings?.map(warning => <AdminNotice key={warning} tone="warning">{warning}</AdminNotice>)}
        {controller.recoveryId && <div className="flex flex-wrap gap-2">
          <AdminActionButton disabled={busy} onClick={() => void controller.lookup()}>Check operation status</AdminActionButton>
          {pending && <AdminActionButton disabled={busy} onClick={() => void controller.lookup(undefined, true)}>Reconcile operation</AdminActionButton>}
          {!pending && <AdminActionButton disabled={busy} onClick={() => { controller.reset(); setSelected([]); }}>New batch</AdminActionButton>}
        </div>}
        {options.enabled && !pending && (!operation || (operation.status === 'previewed' && operation.plan.intent !== 'rollback')) && <fieldset disabled={locked} className="min-w-0 space-y-4">
          <legend className="font-semibold">Kling 4 · USD</legend>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-sm">Price input<select aria-label="Price input" className={field} value={input} onChange={e => edit(() => setInput(e.target.value))}><option value="recipe">Freeze LIST multiplier</option><option value="explicit">Import exact JSON</option></select></label>
            {input === 'recipe' && <><label className="flex flex-col gap-1 text-sm">Intent<select aria-label="Intent" className={field} value={intent} onChange={e => edit(() => setIntent(e.target.value as typeof intent))}><option value="create_missing">Create missing; preserve conforming</option><option value="replace_selected">Replace selected existing prices</option></select></label>
              <label className="flex flex-col gap-1 text-sm">LIST multiplier<input className={`${field} w-28`} value={multiplier} inputMode="decimal" onChange={e => edit(() => setMultiplier(e.target.value))} /></label></>}
          </div>
          {input === 'explicit' ? <label className="block text-sm">Exact batch JSON<textarea className={`${field} mt-1 min-h-40 w-full font-mono`} value={importText} onChange={e => edit(() => setImportText(e.target.value))} placeholder={'{"schemaVersion":1,"modelId":"kling-v4","intent":"replace_selected","reason":"Reviewed prices","pricing":{"kind":"explicit"},"selections":[{"selector":{...},"price":{"kind":"fixed","customerCents":118}}]}'} /></label> : <>
            <p className="text-sm text-text-secondary">The multiplier compiles into literal fixed or continuous prices. Final customer totals round up to the cent. Supplier reference is LIST, not an observed invoice.</p>
            <label className="block text-sm">Reason for change<input className={`${field} mt-1 w-full`} value={reason} maxLength={500} onChange={e => edit(() => setReason(e.target.value))} /></label>
            <div className="flex flex-wrap gap-2"><label className="text-sm">Mode<select aria-label="Mode" className={`${field} ml-2`} value={mode} onChange={e => edit(() => setMode(e.target.value))}>{['all', 't2v', 'i2v', 'ref2v', 'v2v'].map(value => <option key={value}>{value}</option>)}</select></label>
              <label className="text-sm">Resolution<select aria-label="Resolution" className={`${field} ml-2`} value={resolution} onChange={e => edit(() => setResolution(e.target.value))}>{['all', '720p', '1080p'].map(value => <option key={value}>{value}</option>)}</select></label></div>
            <div className="flex flex-wrap gap-2"><AdminActionButton onClick={() => edit(() => setSelected(options.classes.map(c => c.key)))}>Select all 226 classes</AdminActionButton>
              <AdminActionButton onClick={() => edit(() => setSelected([...new Set([...selected, ...visible.map(c => c.key)])]))}>Select visible classes</AdminActionButton>
              <AdminActionButton onClick={() => edit(() => setSelected([]))}>Clear selection</AdminActionButton><span className="self-center text-sm">{selected.length} selected</span></div>
            <div className="grid max-h-56 gap-1 overflow-y-auto rounded-lg border border-border p-2 sm:grid-cols-2 xl:grid-cols-3">{visible.map(row => <label key={row.key} className="flex items-start gap-2 rounded p-1 text-xs"><input type="checkbox" checked={selected.includes(row.key)} onChange={e => edit(() => setSelected(e.target.checked ? [...selected, row.key] : selected.filter(key => key !== row.key)))} />
              {row.selector.mode} · {row.selector.resolution} · {row.selector.durationSec}s · {row.selector.billingInputType === 'video_input' ? 'video input' : 'no video'}</label>)}</div>
          </>}
          <AdminActionButton disabled={locked || (input === 'recipe' ? !selected.length || reason.trim().length < 3 : !importText.trim())} onClick={preview}>Preview batch</AdminActionButton>
        </fieldset>}
        {operation && <TariffBatchReview operation={operation} />}
        {operation?.status === 'previewed' && !pending && <div className="space-y-2">
          {controller.expired && <AdminNotice tone="warning">Preview expired. Prepare a fresh preview before confirming.</AdminNotice>}
          <AdminActionButton disabled={busy || controller.expired || Boolean(operation.plan.counts.conflict) || !options.enabled} onClick={() => void controller.confirm()}>Confirm batch</AdminActionButton>
          <p className="text-xs text-text-secondary">Confirmation applies the complete reviewed batch atomically. Any conflict or changed revision requires a new preview.</p>
        </div>}
        {operation?.status === 'committed' && operation.receipt?.changes.some(c => c.before) && <AdminActionButton disabled={locked || !options.enabled} onClick={() => void controller.preview({
          schemaVersion: 1, modelId: 'kling-v4', intent: 'rollback', reason: `Restore prices before batch ${operation.id}`,
          sourceOperationId: operation.id, selectors: operation.receipt!.changes.filter(c => c.before).map(c => c.after.selector),
        })}>Preview rollback</AdminActionButton>}
        <details><summary className="cursor-pointer text-sm">Recent operations</summary><p className="my-2 text-xs text-text-secondary">Your latest 50 operations. Open a committed operation to inspect its receipt and prepare a rollback. Active creations cannot be removed.</p>
          <ul className="space-y-2">{options.operations.map(item => <li key={item.id}><button type="button" className="break-all text-left text-sm underline" disabled={locked} onClick={() => void controller.lookup(item.id)}>{item.createdAt} · {item.status} · {item.plan.reason}</button></li>)}</ul></details>
      </div>
    </details>
  </AdminSection>;
}
