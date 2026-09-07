'use client';

import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { RecentMediaList } from '@/components/library/RecentMediaList.client';
import { recentMediaCopy } from '@/components/library/recent-media-copy';
import type { AssetFieldConfig } from '@/components/Composer';
import type { EngineCaps, EngineInputField, EngineInputSchema, Mode } from '@/types/engines';
import { useWorkspaceRecentMetadata } from '../_hooks/useWorkspaceRecentMetadata';
import { useWorkspaceRecentMedia } from '../_hooks/useWorkspaceRecentMedia';
import { getWorkspaceReferenceFields, type WorkspaceReferenceAvailability } from '../_lib/workspace-reference-fields';
import { getRecentReferenceIssue, RECENT_MEDIA_DRAG_TYPE, resolveCurrentRecentAsset } from '../_lib/workspace-recent-media';
import type { ReferenceAsset, UserAsset } from '../_lib/workspace-assets';
import { WorkspaceRecentRoleDialog } from './WorkspaceRecentRoleDialog.client';

type Selection = { scope: string; id: string; url: string; engineId: string };
export type RecentReferenceDropProps = {
  onDragOverCapture: (event: DragEvent) => void;
  onDropCapture: (event: DragEvent) => void;
};
export function WorkspaceRecentReferences({ userId, locale, engineId, engine, fields, availability, inputSchema, mode, inputAssets, onInsert, children }: {
  userId?: string | null; locale: string; engineId: string; engine?: EngineCaps; fields: AssetFieldConfig[];
  availability: WorkspaceReferenceAvailability; inputSchema?: EngineInputSchema; mode: Mode;
  inputAssets: Record<string, (ReferenceAsset | null)[]>;
  onInsert: (field: EngineInputField, asset: UserAsset, index?: number) => Promise<unknown>;
  children: (surface: { recentMedia: ReactNode; recentDropProps: RecentReferenceDropProps; refreshRecentMedia: () => void }) => ReactNode;
}) {
  const [kind, setKind] = useState<'image' | 'video' | 'audio'>('image');
  const feed = useWorkspaceRecentMedia(userId, kind);
  const [selection, setSelection] = useState<Selection | null>(null);
  const drag = useRef<{ selection: Selection; token: string } | null>(null);
  const copy = recentMediaCopy(locale);
  const eligibleFields = getWorkspaceReferenceFields(fields, availability);
  const selected = selection?.engineId === engineId ? resolveCurrentRecentAsset(selection, feed.scope, feed.assets) : null;
  const metadataNeeded = Boolean(selected && eligibleFields.some((entry) => !entry.disabled && entry.field.type === selected.kind &&
    getRecentReferenceIssue(selected, entry, inputAssets, inputSchema, mode, undefined, engine) === 'metadata'));
  const metadata = useWorkspaceRecentMetadata(selected, userId, metadataNeeded);
  const choose = (asset: UserAsset) => {
    if (feed.scope) setSelection({ scope: feed.scope, id: asset.id, url: asset.url, engineId });
  };
  const currentDrag = () => drag.current?.selection.engineId === engineId
    ? resolveCurrentRecentAsset(drag.current.selection, feed.scope, feed.assets) : null;
  const recentDropProps: RecentReferenceDropProps = {
    onDragOverCapture(event) {
      if (event.dataTransfer.types.includes(RECENT_MEDIA_DRAG_TYPE) && currentDrag()) {
        event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'copy';
      }
    },
    onDropCapture(event) {
      if (!event.dataTransfer.types.includes(RECENT_MEDIA_DRAG_TYPE)) return;
      event.preventDefault(); event.stopPropagation();
      const asset = currentDrag();
      if (asset && drag.current?.token === event.dataTransfer.getData(RECENT_MEDIA_DRAG_TYPE)) choose(asset);
      drag.current = null;
    },
  };
  const recentMedia = <>
    <RecentMediaList assets={feed.assets} kind={kind} onKindChange={(next) => { setKind(next); setSelection(null); drag.current = null; }}
      onSelect={choose} loading={feed.loading} refreshing={feed.refreshing} error={feed.error} authenticated={Boolean(userId)} onRetry={feed.retry} locale={locale}
      onDragStart={(event, asset) => {
        if (!feed.scope) { event.preventDefault(); return; }
        const token = crypto.randomUUID();
        drag.current = { selection: { scope: feed.scope, id: asset.id, url: asset.url, engineId }, token };
        event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData(RECENT_MEDIA_DRAG_TYPE, token);
      }} onDragEnd={() => { drag.current = null; }} />
    <p className="app-recent-drop-hint">{copy.drop}</p>
  </>;
  return <>
    {children({ recentMedia, recentDropProps, refreshRecentMedia: feed.retry })}
    {selected ? <WorkspaceRecentRoleDialog key={`${selection?.scope}:${engineId}:${selected.id}`} asset={metadata.asset ?? selected} fields={eligibleFields} inputAssets={inputAssets}
      inputSchema={inputSchema} engine={engine} mode={mode} locale={locale} metadataLoading={metadata.loading} metadataError={metadata.error} onMetadataRetry={metadata.retry} onClose={() => setSelection(null)}
      onInsert={(entry, index) => onInsert(entry.field, metadata.asset ?? selected, index)} /> : null}
  </>;
}
