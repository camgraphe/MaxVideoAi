'use client';

import { useState, type ReactNode } from 'react';
import { AppGlyph } from '@/components/app/AppGlyph';
import type { AssetFieldConfig, AssetSlotAttachment } from '@/components/AssetDropzone';
import { workspaceReferenceCopy } from './workspace-reference-copy';

/** Role navigation changes presentation only. Draft mutation stays in the rendered field owner. */
export function WorkspaceReferenceInventory({ fields, assets, locale, renderField }: {
  fields: AssetFieldConfig[];
  assets: Record<string, (AssetSlotAttachment | null)[]>;
  locale: string;
  renderField: (entry: AssetFieldConfig) => ReactNode;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const selected = fields.find(entry => entry.field.id === activeId)
    ?? fields.find(entry => entry.field.type === 'image' && !entry.disabled)
    ?? fields.find(entry => !entry.disabled)
    ?? fields[0];
  const copy = workspaceReferenceCopy(locale);
  return <>
    {fields.length > 1 ? <div className="app-reference-role-nav" role="group" aria-label={copy.title}>
      {fields.map(entry => {
        const kind = entry.field.type === 'audio' ? 'audio' : entry.field.type === 'video' ? 'video' : 'image';
        const isSourceVideo = kind === 'video' && entry.field.id === 'video_url';
        const label = isSourceVideo ? locale === 'fr' ? 'Vidéo source' : locale === 'es' ? 'Video fuente' : 'Source video' : copy.kinds[kind];
        const count = (assets[entry.field.id] ?? []).filter(Boolean).length;
        const capacity = entry.field.maxCount;
        return <button key={entry.field.id} type="button" aria-pressed={entry === selected} data-reference-role={entry.field.id} onClick={() => setActiveId(entry.field.id)}
          title={entry.disabledReason ?? undefined}>
          <AppGlyph name={kind} /><span>{label}<small>{count}{capacity && capacity > 0 ? `/${capacity}` : ''}{entry.required && count < (entry.field.minCount ?? 1) ? ` · ${copy.required}` : ''}{entry.disabled ? ' · !' : ''}</small></span>
        </button>;
      })}
    </div> : null}
    {selected ? renderField(selected) : null}
  </>;
}
