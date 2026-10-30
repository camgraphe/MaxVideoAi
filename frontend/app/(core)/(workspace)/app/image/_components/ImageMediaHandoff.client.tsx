'use client';
import { useState, type ReactNode } from 'react';
import { RecentMediaList } from '@/components/library/RecentMediaList.client';
import { useWorkspaceRecentMedia } from '../../_hooks/useWorkspaceRecentMedia';
import { resolveCurrentRecentAsset } from '../../_lib/workspace-recent-media';
import { PROMPT_ASSISTANCE_PREVIEW } from '@/lib/prompt-assistance/preview-state';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useMediaHandoff } from '@/components/library/useMediaHandoff';
import { MediaActionPanel } from '@/components/library/MediaActionPanel.client';
import { referenceContinuationCopy } from '@/components/library/media-action-copy';
import { recentMediaCopy } from '@/components/library/recent-media-copy';
import type { LibraryAsset, ReferenceSlotValue } from '../_lib/image-workspace-types';

export function ImageMediaHandoff({ slots, limit, onInsert, modelName, children }: {
  modelName?: string;
  children?: (recentMedia: ReactNode, openRecentMedia: () => void) => ReactNode;
  slots: (ReferenceSlotValue | null)[]; limit: number; onInsert: (asset: LibraryAsset, index?: number) => boolean | undefined;
}) {
  const { user } = useRequireAuth({ redirectIfLoggedOut: false });
  const { locale } = useI18n();
  const handoff = useMediaHandoff(user?.id, 'image');
  const [recentRequested, setRecentRequested] = useState(false);
  const feed = useWorkspaceRecentMedia(PROMPT_ASSISTANCE_PREVIEW && recentRequested ? user?.id : null, 'image');
  const openRecentMedia = () => { if (recentRequested) feed.retry(); else setRecentRequested(true); };
  const [selection, setSelection] = useState<{ scope: string; id: string; url: string; modelName?: string } | null>(null);
  const selected = handoff.asset ?? (selection?.modelName === modelName ? resolveCurrentRecentAsset(selection, feed.scope, feed.assets) : null);
  const close = () => { if (handoff.asset) handoff.close(); setSelection(null); };
  const copy = recentMediaCopy(locale);
  const labels = referenceContinuationCopy(locale);
  const [choice, setChoice] = useState('add');
  const [rejected, setRejected] = useState(false);
  const empty = Array.from({ length: limit }).findIndex((_, index) => !slots[index]);
  const index = choice === 'add' ? empty : Number(choice);
  const recentMedia = <RecentMediaList assets={feed.assets} kind="image" kinds={['image']} onKindChange={() => {}}
    onSelect={asset => { if (feed.scope) { setChoice('add'); setRejected(false); setSelection({ scope: feed.scope, id: asset.id, url: asset.url, modelName }); } }}
    loading={feed.loading} refreshing={feed.refreshing} error={feed.error} authenticated={Boolean(user?.id)} onRetry={feed.retry} locale={locale} />;
  return <>{children?.(recentMedia, openRecentMedia)}{selected ? <MediaActionPanel key={selected.id} asset={selected} locale={locale} onClose={close}>
    <div className="app-recent-role-dialog app-media-reference-body">
      {modelName ? <p>{labels.context} <strong>{modelName}</strong></p> : null}
      <label>{copy.slot}<select value={choice} onChange={(event) => setChoice(event.target.value)}>
        <option value="add">{labels.newReference}</option>
        {slots.slice(0, limit).map((slot, position) => slot ? <option key={position} value={position}>{labels.replace} {position + 1}</option> : null)}
      </select></label>
      {limit <= 0 ? <p role="status">{copy.noRole}</p> : index < 0 ? <p role="status">{copy.issues.field_limit}</p> : null}
      {rejected ? <p role="alert">{copy.issues.format}</p> : null}
      <button type="button" className="app-recent-insert" disabled={limit <= 0 || index < 0 || index >= limit} onClick={() => {
        if (!selected || index < 0 || index >= limit) return;
        if (onInsert(selected, index)) close(); else setRejected(true);
      }}>{choice === 'add' ? labels.add : `${labels.replace} ${index + 1}`}</button>
    </div>
  </MediaActionPanel> : null}</>;
}
