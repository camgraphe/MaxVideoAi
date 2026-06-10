import { authFetch } from '@/lib/authFetch';
import {
  coerceWorkspaceProjectSettings,
} from '../_lib/workspace-project-settings';
import {
  createWorkspaceSequenceRecord,
  type WorkspaceSequenceRecord,
} from './workspace-state';

function workspaceSequenceTimelineState(sequence: WorkspaceSequenceRecord): Record<string, unknown> {
  return {
    timelineItems: sequence.timelineItems,
    audioTrackCount: sequence.audioTrackCount,
    hiddenVideoTracks: sequence.hiddenVideoTracks,
    lockedTimelineTracks: sequence.lockedTimelineTracks,
    mutedAudioTracks: sequence.mutedAudioTracks,
    videoTrackCount: sequence.videoTrackCount,
    timelinePanelHeight: sequence.timelinePanelHeight,
    timelineInPointSec: sequence.timelineInPointSec,
    timelineOutPointSec: sequence.timelineOutPointSec,
  };
}

function normalizeStudioSequenceApiRecord(value: unknown): WorkspaceSequenceRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<{
    id: unknown;
    name: unknown;
    settings: unknown;
    timelineState: unknown;
    createdAt: unknown;
    updatedAt: unknown;
  }>;
  if (typeof record.id !== 'string' || typeof record.name !== 'string') return null;
  const timelineState = record.timelineState && typeof record.timelineState === 'object'
    ? record.timelineState as Partial<WorkspaceSequenceRecord>
    : {};
  return createWorkspaceSequenceRecord({
    id: record.id,
    name: record.name,
    timelineItems: Array.isArray(timelineState.timelineItems) ? timelineState.timelineItems : [],
    projectSettings: coerceWorkspaceProjectSettings(record.settings ?? timelineState.projectSettings),
    audioTrackCount: timelineState.audioTrackCount,
    hiddenVideoTracks: timelineState.hiddenVideoTracks,
    lockedTimelineTracks: timelineState.lockedTimelineTracks,
    mutedAudioTracks: timelineState.mutedAudioTracks,
    videoTrackCount: timelineState.videoTrackCount,
    timelinePanelHeight: timelineState.timelinePanelHeight,
    timelineInPointSec: timelineState.timelineInPointSec,
    timelineOutPointSec: timelineState.timelineOutPointSec,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  });
}

export async function readStudioSequencesFromApi(
  projectId: string,
  signal?: AbortSignal
): Promise<WorkspaceSequenceRecord[] | null> {
  try {
    const response = await authFetch(`/api/studio/projects/${encodeURIComponent(projectId)}/sequences`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok || !Array.isArray(payload.sequences)) return null;
    return payload.sequences
      .map(normalizeStudioSequenceApiRecord)
      .filter((sequence: WorkspaceSequenceRecord | null): sequence is WorkspaceSequenceRecord => Boolean(sequence));
  } catch {
    return null;
  }
}

async function upsertStudioSequenceToApi(params: {
  projectId: string;
  sequence: WorkspaceSequenceRecord;
  signal?: AbortSignal;
}): Promise<boolean> {
  try {
    const response = await authFetch(
      `/api/studio/projects/${encodeURIComponent(params.projectId)}/sequences/${encodeURIComponent(params.sequence.id)}`,
      {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sequence: {
            name: params.sequence.name,
            settings: params.sequence.projectSettings,
            timelineState: workspaceSequenceTimelineState(params.sequence),
          },
        }),
        signal: params.signal,
      }
    );
    const payload = await response.json().catch(() => null);
    return response.ok && Boolean(payload?.ok);
  } catch {
    return false;
  }
}

async function deleteStudioSequenceFromApi(params: {
  projectId: string;
  sequenceId: string;
  signal?: AbortSignal;
}): Promise<boolean> {
  try {
    const response = await authFetch(
      `/api/studio/projects/${encodeURIComponent(params.projectId)}/sequences/${encodeURIComponent(params.sequenceId)}`,
      {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
        signal: params.signal,
      }
    );
    const payload = await response.json().catch(() => null);
    return response.ok && Boolean(payload?.ok);
  } catch {
    return false;
  }
}

export async function saveStudioSequencesToApi(params: {
  projectId: string;
  sequences: WorkspaceSequenceRecord[];
  signal?: AbortSignal;
}): Promise<boolean> {
  const desiredSequences = params.sequences.length ? params.sequences : [];
  if (!desiredSequences.length) return false;

  const upsertResults = await Promise.all(
    desiredSequences.map((sequence) => upsertStudioSequenceToApi({
      projectId: params.projectId,
      sequence,
      signal: params.signal,
    }))
  );
  if (upsertResults.some((ok) => !ok)) return false;

  const serverSequences = await readStudioSequencesFromApi(params.projectId, params.signal);
  if (!serverSequences) return false;

  const desiredIds = new Set(desiredSequences.map((sequence) => sequence.id));
  const staleSequences = serverSequences.filter((sequence) => !desiredIds.has(sequence.id));
  const deleteResults = await Promise.all(
    staleSequences.map((sequence) => deleteStudioSequenceFromApi({
      projectId: params.projectId,
      sequenceId: sequence.id,
      signal: params.signal,
    }))
  );
  return deleteResults.every(Boolean);
}
