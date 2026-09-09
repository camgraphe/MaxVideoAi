'use client';
import { useState } from 'react';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useMediaHandoff } from '@/components/library/useMediaHandoff';
import { MediaActionPanel } from '@/components/library/MediaActionPanel.client';
import { referenceContinuationCopy } from '@/components/library/media-action-copy';
import { recentMediaCopy } from '@/components/library/recent-media-copy';
import type { LibraryAsset, ReferenceSlotValue } from '../_lib/image-workspace-types';

export function ImageMediaHandoff({ slots, limit, onInsert, modelName }: {
  modelName?: string;
  slots: (ReferenceSlotValue | null)[]; limit: number; onInsert: (asset: LibraryAsset, index?: number) => boolean | undefined;
}) {
  const { user } = useRequireAuth({ redirectIfLoggedOut: false });
  const { locale } = useI18n();
  const handoff = useMediaHandoff(user?.id, 'image');
  const copy = recentMediaCopy(locale);
  const labels = referenceContinuationCopy(locale);
  const [choice, setChoice] = useState('add');
  const [rejected, setRejected] = useState(false);
  const empty = Array.from({ length: limit }).findIndex((_, index) => !slots[index]);
  const index = choice === 'add' ? empty : Number(choice);
  if (!handoff.asset) return null;
  return <MediaActionPanel asset={handoff.asset} locale={locale} onClose={handoff.close}>
    <div className="app-recent-role-dialog app-media-reference-body">
      {modelName ? <p>{labels.context} <strong>{modelName}</strong></p> : null}
      <label>{copy.slot}<select value={choice} onChange={(event) => setChoice(event.target.value)}>
        <option value="add">{labels.newReference}</option>
        {slots.slice(0, limit).map((slot, position) => slot ? <option key={position} value={position}>{labels.replace} {position + 1}</option> : null)}
      </select></label>
      {limit <= 0 ? <p role="status">{copy.noRole}</p> : index < 0 ? <p role="status">{copy.issues.field_limit}</p> : null}
      {rejected ? <p role="alert">{copy.issues.format}</p> : null}
      <button type="button" className="app-recent-insert" disabled={limit <= 0 || index < 0 || index >= limit} onClick={() => {
        if (!handoff.asset || index < 0 || index >= limit) return;
        if (onInsert(handoff.asset, index)) handoff.close(); else setRejected(true);
      }}>{choice === 'add' ? labels.add : `${labels.replace} ${index + 1}`}</button>
    </div>
  </MediaActionPanel>;
}
