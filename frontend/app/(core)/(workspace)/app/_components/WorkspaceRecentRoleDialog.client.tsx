'use client';

import { useEffect, useRef, useState } from 'react';
import { AppGlyph } from '@/components/app/AppGlyph';
import type { AssetFieldConfig } from '@/components/Composer';
import { recentMediaCopy } from '@/components/library/recent-media-copy';
import { mediaReferenceLabel } from '@/components/library/media-reference-label';
import { MediaActionPanel } from '@/components/library/MediaActionPanel.client';
import type { EngineCaps, EngineInputSchema, Mode } from '@/types/engines';
import { getRecentReferenceIssue } from '../_lib/workspace-recent-media';
import type { ReferenceAsset, UserAsset } from '../_lib/workspace-assets';

export function WorkspaceRecentRoleDialog({ asset, fields, inputAssets, inputSchema, engine, mode, locale, onClose, onInsert, metadataLoading = false, metadataError = false, onMetadataRetry }: {
  asset: UserAsset; fields: AssetFieldConfig[]; inputAssets: Record<string, (ReferenceAsset | null)[]>;
  inputSchema?: EngineInputSchema; engine?: EngineCaps; mode: Mode; locale: string; onClose: () => void;
  metadataLoading?: boolean; metadataError?: boolean; onMetadataRetry?: () => void;
  onInsert: (entry: AssetFieldConfig, slotIndex?: number) => Promise<unknown>;
}) {
  const copy = recentMediaCopy(locale);
  const compatible = fields.filter(({ field }) => field.type === asset.kind);
  const [fieldId, setFieldId] = useState('');
  const [slot, setSlot] = useState('add');
  const [pending, setPending] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const entry = compatible.find(({ field }) => field.id === fieldId) ?? (compatible.length === 1 ? compatible[0] : null);
  const slotIndex = slot === 'add' ? undefined : Number(slot);
  const issue = entry ? getRecentReferenceIssue(asset, entry, inputAssets, inputSchema, mode, slotIndex, engine) : null;
  const disabledReason = entry?.disabled ? entry.disabledReason || copy.noRole : null;
  return <MediaActionPanel title={locale.startsWith('fr') ? 'Utiliser comme référence' : locale.startsWith('es') ? 'Usar como referencia' : 'Use as reference'} asset={asset} locale={locale} onClose={onClose}>
    <div className="app-recent-role-dialog app-media-reference-body">
      {!compatible.length ? <p>{copy.noRole}</p> : <>
        {compatible.length <= 4 ? <fieldset className="app-recent-role-choices"><legend>{copy.role}</legend>
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
          {(inputAssets[entry.field.id] ?? []).some(Boolean) ? <label>{copy.slot}<select value={slot} onChange={(event) => setSlot(event.target.value)}>
            <option value="add">{copy.add}</option>
            {(inputAssets[entry.field.id] ?? []).map((existing, index) => existing ? <option key={index} value={index}>{copy.replace} {index + 1} · {existing.name}</option> : null)}
          </select></label> : null}
        </> : null}
        {metadataLoading ? <p role="status">{copy.preparing}</p> : metadataError ? <div role="alert"><p>{copy.issues.metadata}</p><button type="button" onClick={onMetadataRetry}>{copy.retry}</button></div> : null}
        {disabledReason || (issue && !metadataLoading && !metadataError) ? <p role="status">{disabledReason ?? (issue ? copy.issues[issue] : '')}</p> : null}
        <button type="button" className="app-recent-insert" disabled={!entry || Boolean(disabledReason || issue) || pending || metadataLoading} onClick={async () => {
          if (!entry || entry.disabled || getRecentReferenceIssue(asset, entry, inputAssets, inputSchema, mode, slotIndex, engine)) return;
          setPending(true);
          try { await onInsert(entry, slotIndex); if (mounted.current) onClose(); } finally { if (mounted.current) setPending(false); }
        }}>{pending ? copy.preparing : slot === 'add' ? copy.add : copy.replace}</button>
      </>}
    </div>
  </MediaActionPanel>;
}
