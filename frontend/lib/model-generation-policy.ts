import { resolveRuntimeEngineInput, getRuntimeModelByCanonicalSlug, listRuntimeModels } from '@/config/model-runtime';

/** Resolve identity without following public-route replacements to a different model. */
export function getGenerationModelIdentity(id: string | null | undefined) {
  const key = id?.trim().toLowerCase();
  if (!key) return null;
  return resolveRuntimeEngineInput(key) ?? getRuntimeModelByCanonicalSlug(key)
    ?? listRuntimeModels().find(model => model.aliases.publicSlugs.some(alias => alias.toLowerCase() === key)) ?? null;
}

/** Historical identities remain readable, but must never start a new paid job. */
export function isArchivedGenerationModel(id: string | null | undefined): boolean {
  const model = getGenerationModelIdentity(id);
  return model?.lifecycle === 'deep_legacy' || model?.lifecycle === 'retired';
}

export function archivedGenerationMessage(locale: string): string {
  if (locale === 'fr') return 'Ce modèle n’est plus disponible. Choisissez un autre modèle avant de générer. Vos vidéos existantes restent dans votre bibliothèque.';
  if (locale === 'es') return 'Este modelo ya no está disponible. Elige otro modelo antes de generar. Tus vídeos existentes permanecen en tu biblioteca.';
  return 'This model is no longer available. Choose another model before generating. Your existing videos remain in your library.';
}
