'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {StudioConversationTimeline} from '@/lib/studio/conversation-editing-contract';
import type {ConversationTimelineCommand} from '@/lib/studio/conversation-timeline-editing';
import type {WorkspaceProjectSettings,WorkspaceTimelineItem} from '../../../workspace/_lib/workspace-types';

export type ConversationTimelineView = {data: StudioConversationTimeline;settings: WorkspaceProjectSettings;items: WorkspaceTimelineItem[]};
export function useConversationTimeline(projectId: string,refreshKey: unknown) {
  const [view,setView] = useState<ConversationTimelineView | null>(null);
  const [legacy,setLegacy] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState<string | null>(null);
  const active = useRef(true);
  const pending = useRef(false);
  const epoch = useRef(0);
  const invalidate = useCallback(() => {epoch.current++;},[]);
  const path = `/api/studio/projects/${encodeURIComponent(projectId)}/conversation-timeline`;
  const refresh = useCallback(async () => {
    const request = ++epoch.current;
    try {
      const response = await fetch(path+'?preview=1',{cache: 'no-store'});
      const result = await response.json();
      if (!active.current || request !== epoch.current) return;
      if (result.error === 'STUDIO_CONNECTED_PROJECT_REQUIRED') {setLegacy(true);return;}
      if (!response.ok || !result.ok) throw new Error(result.error ?? 'TIMELINE_UNAVAILABLE');
      setLegacy(false);setView(result.result);
    } catch (failure) {if (active.current && request === epoch.current) setError(failure instanceof Error ? failure.message : 'TIMELINE_UNAVAILABLE');}
  },[path]);
  useEffect(() => {active.current = true;void refresh();return () => {active.current = false;invalidate();};},[refresh,refreshKey,invalidate]);
  useEffect(() => {const timer = window.setInterval(() => {if (!pending.current && !document.hidden) void refresh();},20000);return () => window.clearInterval(timer);},[refresh]);
  const edit = useCallback(async (command: ConversationTimelineCommand['edit']) => {
    if (!view || pending.current) return;
    pending.current = true;setBusy(true);setError(null);epoch.current++;
    try {
      const response = await fetch(path,{method: 'POST',headers: {'content-type': 'application/json'},body: JSON.stringify({sequenceId: view.data.sequenceId,expectedRevision: view.data.revision,idempotencyKey: crypto.randomUUID(),edit: command})});
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? 'TIMELINE_UNAVAILABLE');
    } catch (failure) {if (active.current) setError(failure instanceof Error ? failure.message : 'TIMELINE_UNAVAILABLE');}
    finally {pending.current = false;if (active.current) {setBusy(false);await refresh();}}
  },[path,refresh,view]);
  return {view,legacy,busy,error,edit,refresh};
}
