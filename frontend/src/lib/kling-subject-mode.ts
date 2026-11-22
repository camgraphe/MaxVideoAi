import { isKlingV4FalQueueEngineId } from './kling-v4-family';

export function supportsWorkspaceKlingV3Controls(engineId?: string | null) {
  return (
    engineId === 'kling-3-pro' ||
    engineId === 'kling-3-standard' ||
    engineId === 'kling-3-4k' ||
    Boolean(engineId?.startsWith('kling-o3-'))
  );
}

export function workspaceKlingSubjectsActive({
  selectedEngineId,
  supportsKlingV3Controls,
  submissionMode,
}: {
  selectedEngineId: string;
  supportsKlingV3Controls: boolean;
  submissionMode: string;
}) {
  const referenceOrEdit = submissionMode === 'ref2v' || submissionMode === 'v2v';
  if (isKlingV4FalQueueEngineId(selectedEngineId)) return referenceOrEdit;
  if (!supportsKlingV3Controls) return false;
  return selectedEngineId.startsWith('kling-o3-')
    ? referenceOrEdit
    : submissionMode === 'i2v' || submissionMode === 'ref2v';
}
