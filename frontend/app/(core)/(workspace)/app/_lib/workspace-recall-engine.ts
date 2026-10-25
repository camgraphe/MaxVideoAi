import { getGenerationModelIdentity } from '@/lib/model-generation-policy';
import type { EngineCaps } from '@/types/engines';
import { getArchivedWorkspaceEngine } from './workspace-archived-engine';
import { matchesEngineToken, normalizeEngineToken } from './workspace-engine-helpers';

export class UnavailableVideoSettingsEngineError extends Error {
  constructor(readonly engineId: string) {
    super('The saved video model is currently unavailable.');
    this.name = 'UnavailableVideoSettingsEngineError';
  }
}

/** Recall identities never follow public-route replacements to a different model. */
export function resolveRecalledWorkspaceEngine(
  savedId: string | null,
  engines: EngineCaps[],
  engineMap: Map<string, EngineCaps>,
): EngineCaps | null {
  const archived = getArchivedWorkspaceEngine(savedId);
  if (archived) return archived;

  const identity = getGenerationModelIdentity(savedId);
  if (identity) {
    const engine = engineMap.get(identity.id) ?? engines.find(candidate => candidate.id === identity.id);
    if (!engine) throw new UnavailableVideoSettingsEngineError(identity.id);
    return engine;
  }

  // Older snapshots without a registered identity keep their compatibility path.
  const token = normalizeEngineToken(savedId);
  return (savedId ? engineMap.get(savedId) : null)
    ?? (token ? engines.find(candidate => matchesEngineToken(candidate, token)) : null)
    ?? engines[0]
    ?? null;
}

export function unavailableVideoSettingsCopy(locale: string): string {
  if (locale === 'fr') {
    return 'Ce modèle est actuellement indisponible. Vos paramètres n’ont pas été modifiés. Choisissez un autre modèle pour continuer.';
  }
  if (locale === 'es') {
    return 'Este modelo no está disponible actualmente. Tus ajustes no se han cambiado. Elige otro modelo para continuar.';
  }
  return 'This model is currently unavailable. Your settings have not been changed. Choose another model to continue.';
}
