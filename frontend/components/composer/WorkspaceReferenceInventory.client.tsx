'use client';

import { useState, type ReactNode } from 'react';
import { AppGlyph } from '@/components/app/AppGlyph';
import type { AssetFieldConfig, AssetSlotAttachment } from '@/components/AssetDropzone';
import { resolveWorkspaceReferenceFieldTitle, workspaceReferenceCopy } from './workspace-reference-copy';

const collectionIds = new Set(['image_urls', 'video_urls', 'audio_urls', 'reference_image_urls', 'reference_video_urls', 'reference_audio_urls']);
const isCollection = (entry: AssetFieldConfig) => collectionIds.has(entry.field.id) || entry.role === 'reference';
const mediaOrder = (entry: AssetFieldConfig) => entry.field.type === 'image' ? 0 : entry.field.type === 'video' ? 1 : 2;
const sourceOrder = ({ field }: AssetFieldConfig) => field.type === 'video' ? 2
  : /end_image|last_frame/.test(field.id) ? 1 : 0;

/** Role navigation changes presentation only. Draft mutation stays in the rendered field owner. */
export function WorkspaceReferenceInventory({ fields, assets, locale, renderField, sourceFieldId }: {
  fields: AssetFieldConfig[];
  assets: Record<string, (AssetSlotAttachment | null)[]>;
  locale: string;
  renderField: (entry: AssetFieldConfig) => ReactNode;
  sourceFieldId?: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const isReference = (entry: AssetFieldConfig) => entry.field.id !== sourceFieldId && isCollection(entry);
  const references = fields.filter(isReference).sort((a, b) => mediaOrder(a) - mediaOrder(b));
  const sources = fields.filter(entry => !isReference(entry)).sort((a, b) => sourceOrder(a) - sourceOrder(b));
  const orderedFields = [...references, ...sources];
  const selected = fields.find(entry => entry.field.id === activeId)
    ?? orderedFields.find(entry => !entry.disabled)
    ?? orderedFields[0];
  const copy = workspaceReferenceCopy(locale);
  return <>
    {fields.length > 1 ? <div className="app-reference-role-nav" role="group" aria-label={copy.title}>
      {[references, sources].map((group, index) => group.length ? <div className="app-reference-role-row" key={index}>
      {group.map(entry => {
        const kind = entry.field.type === 'audio' ? 'audio' : entry.field.type === 'video' ? 'video' : 'image';
        const isSourceVideo = kind === 'video' && entry.field.id === 'video_url';
        const isKnownCollection = collectionIds.has(entry.field.id);
        const label = isSourceVideo ? locale === 'fr' ? 'Vidéo source' : locale === 'es' ? 'Video fuente' : 'Source video'
          : isKnownCollection ? copy.kinds[kind]
          : resolveWorkspaceReferenceFieldTitle(entry.field, entry.role ?? 'generic', locale);
        const count = (assets[entry.field.id] ?? []).filter(Boolean).length;
        const capacity = entry.field.maxCount;
        return <button key={entry.field.id} type="button" aria-pressed={entry === selected} data-reference-role={entry.field.id} onClick={() => setActiveId(entry.field.id)}
          title={entry.disabledReason ?? undefined}>
          <AppGlyph name={kind} /><span>{label}<small>{count}{capacity && capacity > 0 ? `/${capacity}` : ''}{entry.required && count < (entry.field.minCount ?? 1) ? ` · ${copy.required}` : ''}{entry.disabled ? ' · !' : ''}</small></span>
        </button>;
      })}</div> : null)}
    </div> : null}
    {selected ? renderField(selected) : null}
  </>;
}
