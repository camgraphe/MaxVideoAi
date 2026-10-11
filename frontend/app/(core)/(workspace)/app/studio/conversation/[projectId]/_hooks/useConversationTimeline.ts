'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {StudioConversationTimeline} from '@/lib/studio/conversation-editing-contract';
import type {ConversationTimelineCommand} from '@/lib/studio/conversation-timeline-editing';
import {retainConversationMediaAccess} from '@/lib/studio/conversation-preview-access';
import type {WorkspaceProjectSettings,WorkspaceTimelineItem} from '../../../_shared/_lib/workspace-types';

export type ConversationTimelineView = {data: StudioConversationTimeline;settings: WorkspaceProjectSettings;items: WorkspaceTimelineItem[]};
export function useConversationTimeline(projectId: string,refreshKey: unknown) {
  const [view,setView] = useState<ConversationTimelineView | null>(null);
  const [legacy,setLegacy] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState<string | null>(null);
  const [editError,setEditError] = useState<string | null>(null);
  const active = useRef(true);
  const pending = useRef(false);
  const epoch = useRef(0);
  const invalidate = useCallback(() => {epoch.current++;},[]);
  const path = `/api/studio/projects/${encodeURIComponent(projectId)}/conversation-timeline`;
  const reads = useMemo(() => ({path,inFlight: 0,renewMediaIds: new Set<string>()}),[path]);
  const refresh = useCallback(async (options?: {renewMediaId?: string}) => {
    if (options?.renewMediaId) reads.renewMediaIds.add(options.renewMediaId);
    reads.inFlight++;
    const request = ++epoch.current;
    try {
      const response = await fetch(reads.path+'?preview=1',{cache: 'no-store'});
      const result = await response.json();
      if (!active.current || request !== epoch.current) return;
      if (result.error === 'STUDIO_CONNECTED_PROJECT_REQUIRED') {setLegacy(true);return;}
      if (!response.ok || !result.ok) throw new Error(result.error ?? 'TIMELINE_UNAVAILABLE');
      // A newer canonical read may supersede this request, but it must still
      // replace every rejected grant. Snapshot before React's deferred updater.
      const renewMediaIds = new Set(reads.renewMediaIds);
      reads.renewMediaIds.clear();
      setLegacy(false);setError(null);setView(previous => ({...result.result,items: retainConversationMediaAccess(previous && previous.data.projectId === result.result.data.projectId ? previous.items : [],result.result.items,Date.now(),renewMediaIds)}));
    } catch (failure) {if (active.current && request === epoch.current) setError(failure instanceof Error ? failure.message : 'TIMELINE_UNAVAILABLE');}
    finally {reads.inFlight--;}
  },[reads]);
  useEffect(() => {active.current = true;void refresh();return () => {active.current = false;invalidate();};},[refresh,refreshKey,invalidate]);
  useEffect(() => {const timer = window.setInterval(() => {if (!pending.current && reads.inFlight === 0 && !document.hidden) void refresh();},20000);return () => window.clearInterval(timer);},[refresh,reads]);
  const edit = useCallback(async (command: ConversationTimelineCommand['edit']) => {
    if (!view || pending.current) return;
    pending.current = true;setBusy(true);setEditError(null);epoch.current++;
    try {
      const response = await fetch(path,{method: 'POST',headers: {'content-type': 'application/json'},body: JSON.stringify({sequenceId: view.data.sequenceId,expectedRevision: view.data.revision,idempotencyKey: crypto.randomUUID(),edit: command})});
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? 'TIMELINE_UNAVAILABLE');
    } catch (failure) {if (active.current) setEditError(failure instanceof Error ? failure.message : 'TIMELINE_UNAVAILABLE');}
    finally {pending.current = false;if (active.current) {setBusy(false);await refresh();}}
  },[path,refresh,view]);
  return {view,legacy,busy,error:editError??error,edit,refresh};
}
