'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { generationTimingView, normalizeGenerationObservation, type GenerationObservation } from '@/lib/generation-observation';

const COPY = {
  en: { submitting: 'Submitting…', queued: 'Queued', processing: 'Processing', finalizing: 'Finalizing delivery', pending: 'Awaiting status', completed: 'Completed', failed: 'Generation failed', elapsed: 'Elapsed', estimate: 'Estimated total', observed: 'Observed average', overdue: 'Taking longer than estimated', degraded: 'Status check unavailable. Retrying…', checked: 'Checked', ago: 'ago' },
  fr: { submitting: 'Envoi…', queued: 'En file d’attente', processing: 'Traitement en cours', finalizing: 'Finalisation du résultat', pending: 'En attente de statut', completed: 'Terminé', failed: 'Échec de la génération', elapsed: 'Écoulé', estimate: 'Total estimé', observed: 'Moyenne observée', overdue: 'Plus long que prévu', degraded: 'Vérification indisponible. Nouvelle tentative…', checked: 'Vérifié il y a', ago: '' },
  es: { submitting: 'Enviando…', queued: 'En cola', processing: 'Procesando', finalizing: 'Finalizando la entrega', pending: 'Esperando estado', completed: 'Completado', failed: 'La generación falló', elapsed: 'Transcurrido', estimate: 'Total estimado', observed: 'Media observada', overdue: 'Está tardando más de lo estimado', degraded: 'Consulta de estado no disponible. Reintentando…', checked: 'Verificado hace', ago: '' },
};
function duration(seconds: number) {
  const rounded = Math.round(seconds);
  return rounded >= 60 ? `${Math.floor(rounded / 60)}m ${rounded % 60}s` : `${rounded}s`;
}

export type GenerationPendingStatusProps = {
  observation?: GenerationObservation;
  startedAt?: number;
  etaSeconds?: number | null;
  etaSource?: 'observed' | 'heuristic';
};

/** Display clock only; status polling stays with the workspace owner. */
export function GenerationPendingStatus({ observation, startedAt, etaSeconds, etaSource }: GenerationPendingStatusProps) {
  const { locale } = useI18n();
  const copy = COPY[locale === 'fr' || locale === 'es' ? locale : 'en'];
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const safe = normalizeGenerationObservation(observation);
  const timing = generationTimingView(now, startedAt, etaSeconds, safe);
  const percentage = safe?.providerPercent?.value;
  return <div className="generation-pending-status flex flex-col gap-1 text-xs" data-generation-stage={safe?.stage ?? 'pending'} data-generation-degraded={timing.degraded || undefined}>
    <strong aria-live="polite">{copy[safe?.stage ?? 'pending']}{percentage != null ? ` · ${Math.round(percentage)}%` : ''}</strong>
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-2" aria-live="off">
      {timing.elapsedSeconds !== null ? <span className="flex flex-col gap-0.5"><span>{copy.elapsed}</span><b className="text-sm tabular-nums">{duration(timing.elapsedSeconds)}</b></span> : null}
      {timing.estimatedSeconds !== null ? <span className="flex flex-col gap-0.5"><span>{etaSource === 'observed' ? copy.observed : copy.estimate}</span><b className="text-sm tabular-nums">≈ {duration(timing.estimatedSeconds)}</b></span> : null}
    </div>
    {timing.overdue ? <span>{copy.overdue}</span> : null}
    {timing.degraded ? <span role="status">{copy.degraded}</span> : null}
    {timing.checkedAgoSeconds !== null ? <span className="text-[11px]" aria-live="off">{copy.checked} {duration(timing.checkedAgoSeconds)} {copy.ago}</span> : null}
  </div>;
}
