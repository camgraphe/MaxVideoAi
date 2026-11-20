'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppGlyph } from '@/components/app/AppGlyph';
import type { AssetFieldConfig } from '@/components/Composer';
import { recentMediaCopy } from '@/components/library/recent-media-copy';
import { mediaReferenceLabel } from '@/components/library/media-reference-label';
import { MediaActionPanel } from '@/components/library/MediaActionPanel.client';
import { getMediaInputEligibility } from '@/lib/media-input-eligibility';
import { mediaInputEligibilityMessage } from '@/components/library/media-input-eligibility-copy';
import { videoExtensionCopy } from '@/lib/video-extension';
import { videoModifyCopy } from '@/lib/video-source-workflow';
import type { VideoContinuationMode } from '@/lib/video-continuation';
import type { EngineCaps, EngineInputSchema, Mode } from '@/types/engines';
import { getRecentReferenceIssue } from '../_lib/workspace-recent-media';
import type { ReferenceAsset, UserAsset } from '../_lib/workspace-assets';

export function WorkspaceRecentRoleDialog({ userId, asset, fields, inputAssets, inputSchema, engine, mode, workflowIntent, sourceWorkflow, locale, onClose, onInsert, metadataLoading = false, metadataError = false, onMetadataRetry }: {
  userId?: string | null;
  /** Null means inferred Create; submission mode can change during a successful insertion. */
  workflowIntent?: Mode | null;
  sourceWorkflow?: VideoContinuationMode;
  asset: UserAsset; fields: AssetFieldConfig[]; inputAssets: Record<string, (ReferenceAsset | null)[]>;
  inputSchema?: EngineInputSchema; engine?: EngineCaps; mode: Mode; locale: string; onClose: () => void;
  metadataLoading?: boolean; metadataError?: boolean; onMetadataRetry?: () => void;
  onInsert: (entry: AssetFieldConfig, slotIndex?: number, isCurrent?: () => boolean) => Promise<unknown>;
}) {
  const copy = recentMediaCopy(locale);
  const compatible = fields.filter(({ field }) => field.type === asset.kind);
  const [fieldId, setFieldId] = useState('');
  const [slot, setSlot] = useState('add');
  const scope = JSON.stringify([userId, asset.id, asset.assetId, asset.ref, asset.kind, asset.url, asset.jobId, asset.sourceOutputId, engine?.id, workflowIntent === undefined ? mode : workflowIntent, fieldId, slot]);
  const context = useRef({ scope, revision: 0 });
  if (context.current.scope !== scope) context.current = { scope, revision: context.current.revision + 1 };
  const revision = context.current.revision;
  const [action, setAction] = useState<{ revision: number; pending: boolean; error?: string } | null>(null);
  const pending = action?.revision === revision && action.pending;
  const failure = action?.revision === revision ? action.error : null;
  const inFlight = useRef<number | null>(null);
  const automaticAttempt = useRef<number | null>(null);
  const mounted = useRef(true);
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const entry = compatible.find(({ field }) => field.id === fieldId) ?? (compatible.length === 1 ? compatible[0] : null);
  const currentSourceIndex = sourceWorkflow && entry ? (inputAssets[entry.field.id] ?? []).findIndex(Boolean) : -1;
  const slotIndex = currentSourceIndex >= 0 ? currentSourceIndex : slot === 'add' ? undefined : Number(slot);
  const issue = entry ? getRecentReferenceIssue(asset, entry, inputAssets, inputSchema, mode, slotIndex, engine) : null;
  const disabledReason = entry?.disabled ? entry.disabledReason || copy.noRole : null;
  const eligibility = entry ? getMediaInputEligibility({ asset, field: entry.field, engine, mode }) : null;
  const eligibilityMessage = eligibility ? mediaInputEligibilityMessage(eligibility, locale) : null;
  const insert = useCallback(async () => {
    if (!entry || entry.disabled || issue || metadataLoading || inFlight.current === revision) return;
    const isCurrent = () => mounted.current && context.current.revision === revision;
    inFlight.current = revision;
    setAction({ revision, pending: true });
    try {
      const result = await onInsert(entry, slotIndex, isCurrent);
      if (!isCurrent()) return;
      if (result === false || typeof result === 'string') setAction({ revision, pending: false, error: typeof result === 'string' && result.trim() ? result : copy.insertError });
      else onClose();
    } catch {
      if (isCurrent()) setAction({ revision, pending: false, error: copy.insertError });
    } finally {
      if (inFlight.current === revision) inFlight.current = null;
      if (isCurrent()) setAction(current => current?.revision === revision ? { ...current, pending: false } : current);
    }
  }, [copy.insertError, entry, issue, metadataLoading, onClose, onInsert, revision, slotIndex]);
  const canAttachSource = Boolean(sourceWorkflow && currentSourceIndex < 0 && !disabledReason
    && !issue && !metadataLoading && !metadataError && eligibility?.status === 'usable');
  useEffect(() => {
    if (!canAttachSource || automaticAttempt.current === revision) return;
    automaticAttempt.current = revision;
    void insert();
  }, [canAttachSource, insert, revision]);
  if ((canAttachSource && !failure) || (sourceWorkflow && pending && automaticAttempt.current === revision)) {
    return <p role="status" className="sr-only">{copy.preparing}</p>;
  }
  const title = sourceWorkflow === 'extend' ? videoExtensionCopy(locale).source : sourceWorkflow === 'v2v' ? videoModifyCopy(locale).source
    : locale.startsWith('fr') ? 'Utiliser comme référence' : locale.startsWith('es') ? 'Usar como referencia' : 'Use as reference';
  return <MediaActionPanel title={title} asset={asset} locale={locale} onClose={onClose}>
    <div className="app-recent-role-dialog app-media-reference-body">
      {!compatible.length ? <p>{copy.noRole}</p> : <>
        {sourceWorkflow ? null : compatible.length <= 4 ? <fieldset className="app-recent-role-choices"><legend>{copy.role}</legend>
          {compatible.map((candidate) => <button type="button" key={candidate.field.id} aria-pressed={entry?.field.id === candidate.field.id}
            onClick={() => { setFieldId(candidate.field.id); setSlot('add'); }}>
            <AppGlyph name="reference" /><span>{mediaReferenceLabel(candidate, locale, engine)}{candidate.required ? ` · ${copy.required}` : ''}</span>
          </button>)}
        </fieldset> : <label>{copy.role}<select value={entry?.field.id ?? ''} onChange={(event) => { setFieldId(event.target.value); setSlot('add'); }}>
          <option value="" disabled>{copy.role}</option>
          {compatible.map((candidate) => <option key={candidate.field.id} value={candidate.field.id}>{mediaReferenceLabel(candidate, locale, engine)}{candidate.required ? ` · ${copy.required}` : ''}</option>)}
        </select></label>}
        {entry ? <>
          <p>{mediaReferenceLabel(entry, locale, engine)} · {copy[asset.kind]}{entry.required ? ` · ${copy.required}` : ''}{entry.field.maxCount ? ` · max. ${entry.field.maxCount}` : ''}</p>
          {entry.field.description ? <p>{entry.field.description}</p> : null}
          {currentSourceIndex >= 0 ? <p>{copy.replace} · {inputAssets[entry.field.id]?.[currentSourceIndex]?.name}</p> : (inputAssets[entry.field.id] ?? []).some(Boolean) ? <label>{copy.slot}<select value={slot} onChange={(event) => setSlot(event.target.value)}>
            <option value="add">{copy.add}</option>
            {(inputAssets[entry.field.id] ?? []).map((existing, index) => existing ? <option key={index} value={index}>{copy.replace} {index + 1} · {existing.name}</option> : null)}
          </select></label> : null}
        </> : null}
        {metadataLoading ? <p role="status">{copy.preparing}</p> : metadataError ? <div role="alert"><p>{copy.issues.metadata}</p><button type="button" onClick={onMetadataRetry}>{copy.retry}</button></div> : null}
        {disabledReason || (!metadataLoading && (issue || eligibilityMessage)) ? <p role="status">{disabledReason ?? (issue ? eligibilityMessage ?? copy.issues[issue] : eligibilityMessage)}</p> : null}
        {failure ? <p role="alert">{failure}</p> : null}
        <button type="button" className="app-recent-insert" disabled={!entry || Boolean(disabledReason || issue) || pending || metadataLoading} onClick={() => void insert()}>
          {pending ? copy.preparing : slotIndex === undefined ? copy.add : copy.replace}
        </button>
      </>}
    </div>
  </MediaActionPanel>;
}
