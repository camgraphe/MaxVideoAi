import { getBaseEngineIncludingHidden } from '@/lib/engines';
import { isArchivedGenerationModel, getGenerationModelIdentity } from '@/lib/model-generation-policy';

/** Keep historical settings editable without silently submitting them to another model. */
export function getArchivedWorkspaceEngine(id: string | null | undefined) {
  if (!id || !isArchivedGenerationModel(id)) return null;
  return getBaseEngineIncludingHidden(getGenerationModelIdentity(id)?.id ?? id) ?? null;
}
