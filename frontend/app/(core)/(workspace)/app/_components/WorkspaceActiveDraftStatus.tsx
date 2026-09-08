'use client';
import type { useWorkspaceDraftHydration } from '../_hooks/useWorkspaceDraftHydration';
const copy = {
  en: {
    incomplete: 'References are still being prepared. Your last complete draft is kept.',
    invalid: 'This draft could not be saved. Your previous draft is kept.',
    oversized: 'This draft is too large to save. Your previous draft is kept.',
    retired: 'The saved model is unavailable. Its draft is kept in Configurations.',
    memory: 'Draft kept for this open tab only. Reloading may lose changes.',
    recovery: 'Previous draft available.',
    recover: 'Configurations',
    replace: 'Use current draft',
  },
  fr: {
    incomplete: 'Les références sont en préparation. Le dernier brouillon complet est conservé.',
    invalid: 'Impossible d’enregistrer ce brouillon. Le précédent est conservé.',
    oversized: 'Ce brouillon est trop volumineux. Le précédent est conservé.',
    retired: 'Le modèle enregistré est indisponible. Son brouillon reste dans Configurations.',
    memory:
      'Brouillon conservé dans cet onglet uniquement. Un rechargement peut perdre les modifications.',
    recovery: 'Brouillon précédent disponible.',
    recover: 'Configurations',
    replace: 'Utiliser ce brouillon',
  },
  es: {
    incomplete: 'Las referencias se están preparando. Se conserva el último borrador completo.',
    invalid: 'No se pudo guardar este borrador. Se conserva el anterior.',
    oversized: 'El borrador es demasiado grande. Se conserva el anterior.',
    retired: 'El modelo guardado no está disponible. Su borrador sigue en Configuraciones.',
    memory: 'Borrador guardado solo en esta pestaña. Recargar puede perder cambios.',
    recovery: 'Borrador anterior disponible.',
    recover: 'Configuraciones',
    replace: 'Usar este borrador',
  },
};
export function WorkspaceActiveDraftStatus({
  draft,
  locale,
  openRecovery,
}: {
  draft: ReturnType<typeof useWorkspaceDraftHydration>;
  locale: string;
  openRecovery: () => void;
}) {
  const c = copy[locale.startsWith('fr') ? 'fr' : locale.startsWith('es') ? 'es' : 'en'];
  if (!draft.error && !draft.memoryOnly && !draft.recoverySetup) return null;
  return (
    <span
      className="inline-flex flex-wrap items-center gap-2 text-xs text-text-secondary"
      role="status"
    >
      <span>
        {draft.error && draft.error !== 'unavailable'
          ? c[draft.error]
          : draft.memoryOnly
            ? c.memory
            : c.recovery}
      </span>
      {draft.recoverySetup ? (
        <button type="button" className="underline" onClick={openRecovery}>
          {c.recover}
        </button>
      ) : null}
      {draft.error === 'invalid' || draft.error === 'oversized' || draft.error === 'retired' ? (
        <button type="button" className="underline" onClick={draft.discardRejected}>
          {c.replace}
        </button>
      ) : null}
    </span>
  );
}
