'use client';

import { useId, useRef, useState } from 'react';
import { AssetDropzone } from '@/components/AssetDropzone';
import { AppGlyph } from '@/components/app/AppGlyph';
import { useI18n } from '@/lib/i18n/I18nProvider';
import type { ComposerProps } from './composer-types';
import { getWorkspaceReferenceSummary, isWorkspaceFrameField } from './workspace-reference-layout';
import { workspaceReferenceCopy } from './workspace-reference-copy';

type Props = Pick<ComposerProps, 'engine' | 'caps' | 'assetFields' | 'assets' | 'onAssetAdd' | 'onAssetRemove' | 'onNotice' | 'onOpenLibrary' | 'onAssetUrlSelect'> & { referenceWarning: string };

/** Inline inventory deliberately leaves the owned library dialog as the only modal. */
export function WorkspaceReferenceSection({ assetFields, assets, engine, caps, onAssetAdd, onAssetRemove, onNotice, onOpenLibrary, onAssetUrlSelect, referenceWarning }: Props) {
  const { locale } = useI18n();
  const copy = workspaceReferenceCopy(locale);
  const [expanded, setExpanded] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inventoryId = useId();
  const count = assetFields.reduce((sum, { field }) => sum + (assets[field.id] ?? []).filter(Boolean).length, 0);
  const kinds = [...new Set(assetFields.filter((entry) => !isWorkspaceFrameField(entry)).map(({ field }) => field.type))];
  const fields = expanded ? assetFields.map((entry) => ({ entry, visibleCount: Infinity })) : getWorkspaceReferenceSummary(assetFields, assets);
  const close = () => { setExpanded(false); triggerRef.current?.focus(); };
  const renderField = ({ entry, visibleCount }: typeof fields[number]) => <AssetDropzone key={entry.field.id}
    {...entry} density="workspace" workspaceAssetLimit={visibleCount} workspaceShowDetails={expanded} engine={engine} caps={caps}
    assets={assets[entry.field.id] ?? []} onSelect={onAssetAdd} onRemove={onAssetRemove}
    onError={onNotice} onOpenLibrary={onOpenLibrary} onUrlSelect={onAssetUrlSelect} referenceWarning={referenceWarning}
  />;
  return (
    <section className="app-workspace-references" aria-label={copy.title} onKeyDown={(event) => {
      if (event.key === 'Escape' && expanded) { event.stopPropagation(); close(); }
    }}>
      <div className="app-reference-heading">
        <span><AppGlyph name="reference" />{copy.title}{count ? ` · ${count}` : ''}</span>
        <button ref={triggerRef} type="button" aria-expanded={expanded} aria-controls={inventoryId} onClick={() => expanded ? close() : setExpanded(true)}>
          {expanded ? copy.close : count ? copy.manage : copy.add}
        </button>
      </div>
      {kinds.length ? <div className="app-reference-kinds">{kinds.map((kind) => <span key={kind}><AppGlyph name={kind === 'audio' ? 'audio' : kind === 'video' ? 'video' : 'image'} />{copy.kinds[kind === 'audio' ? 'audio' : kind === 'video' ? 'video' : 'image']}</span>)}</div> : null}
      <div id={inventoryId} className={expanded ? 'app-reference-inventory' : 'app-reference-summary'}>
        {fields.some(({ entry }) => isWorkspaceFrameField(entry)) ? <div className="app-reference-frames">{fields.filter(({ entry }) => isWorkspaceFrameField(entry)).map(renderField)}</div> : null}
        <div className="app-reference-collections">{fields.filter(({ entry }) => !isWorkspaceFrameField(entry)).map(renderField)}</div>
      </div>
    </section>
  );
}
