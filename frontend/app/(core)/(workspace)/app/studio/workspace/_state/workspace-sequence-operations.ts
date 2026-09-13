import { createWorkspaceSequenceRecord, type WorkspaceSequenceRecord } from './workspace-state';

export type WorkspaceSequenceDeleteResult =
  | {
      ok: true;
      deletedActiveSequence: boolean;
      deletedSequence: WorkspaceSequenceRecord;
      nextActiveSequence: WorkspaceSequenceRecord;
      nextSequences: WorkspaceSequenceRecord[];
    }
  | {
      ok: false;
      reason: 'last_sequence' | 'not_found';
    };

export type WorkspaceSequenceBulkDeleteResult =
  | {
      ok: true;
      deletedActiveSequence: boolean;
      deletedSequences: WorkspaceSequenceRecord[];
      nextActiveSequence: WorkspaceSequenceRecord;
      nextSequences: WorkspaceSequenceRecord[];
    }
  | {
      ok: false;
      reason: 'last_sequence' | 'not_found';
    };

export function createWorkspaceSequenceDuplicate(
  sourceSequence: WorkspaceSequenceRecord,
  nextSequenceId: string
): WorkspaceSequenceRecord {
  return createWorkspaceSequenceRecord({
    ...sourceSequence,
    id: nextSequenceId,
    name: `${sourceSequence.name} copy`,
    createdAt: undefined,
    updatedAt: undefined,
  });
}

export function resolveWorkspaceSequenceDelete(params: {
  activeSequenceId: string;
  sequenceId: string;
  sequences: WorkspaceSequenceRecord[];
}): WorkspaceSequenceDeleteResult {
  const deletedSequence = params.sequences.find((sequence) => sequence.id === params.sequenceId);
  if (!deletedSequence) return { ok: false, reason: 'not_found' };
  if (params.sequences.length <= 1) return { ok: false, reason: 'last_sequence' };

  const deletedIndex = params.sequences.findIndex((sequence) => sequence.id === params.sequenceId);
  const nextSequences = params.sequences.filter((sequence) => sequence.id !== params.sequenceId);
  const nextActiveSequence =
    params.sequenceId === params.activeSequenceId
      ? nextSequences[Math.max(0, Math.min(deletedIndex - 1, nextSequences.length - 1))] ?? nextSequences[0]
      : params.sequences.find((sequence) => sequence.id === params.activeSequenceId) ?? nextSequences[0];

  return {
    ok: true,
    deletedActiveSequence: params.sequenceId === params.activeSequenceId,
    deletedSequence,
    nextActiveSequence,
    nextSequences,
  };
}

export function resolveWorkspaceSequenceBulkDelete(params: {
  activeSequenceId: string;
  sequenceIds: string[];
  sequences: WorkspaceSequenceRecord[];
}): WorkspaceSequenceBulkDeleteResult {
  const deleteIds = new Set(params.sequenceIds);
  const deletedSequences = params.sequences.filter((sequence) => deleteIds.has(sequence.id));
  if (!deletedSequences.length) return { ok: false, reason: 'not_found' };

  const nextSequences = params.sequences.filter((sequence) => !deleteIds.has(sequence.id));
  if (!nextSequences.length) return { ok: false, reason: 'last_sequence' };

  const deletedActiveSequence = deleteIds.has(params.activeSequenceId);
  const activeSequence = params.sequences.find((sequence) => sequence.id === params.activeSequenceId);
  let nextActiveSequence =
    activeSequence && !deletedActiveSequence
      ? activeSequence
      : null;

  if (!nextActiveSequence) {
    const activeIndex = params.sequences.findIndex((sequence) => sequence.id === params.activeSequenceId);
    const previousCandidate = [...params.sequences]
      .slice(0, Math.max(0, activeIndex))
      .reverse()
      .find((sequence) => !deleteIds.has(sequence.id));
    const nextCandidate = params.sequences
      .slice(Math.max(0, activeIndex + 1))
      .find((sequence) => !deleteIds.has(sequence.id));
    nextActiveSequence = previousCandidate ?? nextCandidate ?? nextSequences[0];
  }

  return {
    ok: true,
    deletedActiveSequence,
    deletedSequences,
    nextActiveSequence,
    nextSequences,
  };
}
