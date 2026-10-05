import type {WorkspaceTimelineItem} from '@/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-types';

/** Polling canonical edits must not reload a still-valid mounted private decoder. */
export function retainConversationMediaAccess(previous: WorkspaceTimelineItem[],fresh: WorkspaceTimelineItem[],nowMs: number,forceRenewItemId?: string): WorkspaceTimelineItem[] {
  const byId = new Map(previous.map(item => [item.id,item]));
  return fresh.map(item => {
    const old = byId.get(item.id);
    if (!old || item.id === forceRenewItemId || item.mediaAccessError || !item.mediaAccessRequired
      || old.mediaAccessRequired !== item.mediaAccessRequired || old.mediaUrl !== item.mediaUrl
      || JSON.stringify(old.ref) !== JSON.stringify(item.ref) || !old.mediaAccessUrl
      || !old.mediaAccessExpiresAt || Date.parse(old.mediaAccessExpiresAt) <= nowMs+30000
      || !Number.isFinite(Date.parse(old.mediaAccessExpiresAt))) return item;
    return {...item,mediaAccessUrl: old.mediaAccessUrl,mediaAccessExpiresAt: old.mediaAccessExpiresAt};
  });
}

/** One automatic signed-URL renewal per clip and explicit monitor opening. */
export function consumeConversationMediaRenewal(item: WorkspaceTimelineItem,attempted: Set<string>): boolean {
  if (!item.mediaAccessRequired || !item.mediaAccessExpiresAt || item.mediaAccessError || attempted.has(item.id)) return false;
  attempted.add(item.id);
  return true;
}
