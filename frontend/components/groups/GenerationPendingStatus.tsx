'use client';

import { useEffect, useState } from 'react';
import { GenerationPendingArtwork } from './GenerationPendingArtwork';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { generationTimingView, normalizeGenerationObservation, type GenerationObservation } from '@/lib/generation-observation';

const COPY = {
  en: { heading: 'Your creation is on its way.', submitting: 'Submitting…', queued: 'Queued', processing: 'Processing', finalizing: 'Finalizing delivery', pending: 'Awaiting status', completed: 'Completed', failed: 'Generation failed', elapsed: 'Elapsed', estimate: 'Estimated total', observed: 'Observed average', overdue: 'Creation time can vary.', degraded: 'Refreshing the status…', checked: 'Last updated', ago: 'ago' },
  fr: { heading: 'On prépare votre création.', submitting: 'Envoi…', queued: 'En file d’attente', processing: 'Traitement en cours', finalizing: 'Finalisation du résultat', pending: 'En attente de statut', completed: 'Terminé', failed: 'Échec de la génération', elapsed: 'Écoulé', estimate: 'Total estimé', observed: 'Moyenne observée', overdue: 'Le temps de création peut varier.', degraded: 'Actualisation du statut en cours…', checked: 'Dernière actualisation il y a', ago: '' },
  es: { heading: 'Estamos preparando tu creación.', submitting: 'Enviando…', queued: 'En cola', processing: 'Procesando', finalizing: 'Finalizando la entrega', pending: 'Esperando estado', completed: 'Completado', failed: 'La generación falló', elapsed: 'Transcurrido', estimate: 'Total estimado', observed: 'Media observada', overdue: 'El tiempo de creación puede variar.', degraded: 'Actualizando el estado…', checked: 'Última actualización hace', ago: '' },
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
  const stage = safe?.stage ?? 'pending';
  const terminal = stage === 'completed' || stage === 'failed';
  return (
    <div className="generation-pending-status" data-generation-stage={stage} data-generation-degraded={timing.degraded || undefined}>
      <div className="generation-pending-artwork"><GenerationPendingArtwork paused={terminal} /></div>
      {!terminal ? <p className="generation-pending-heading">{copy.heading}</p> : null}
      <div className="generation-pending-stage">
        <span className="generation-pending-dot" aria-hidden="true" />
        <strong aria-live="polite">{copy[stage]}{percentage != null ? ` · ${Math.round(percentage)}%` : ''}</strong>
      </div>
      {timing.elapsedSeconds !== null || timing.estimatedSeconds !== null ? (
        <dl className="generation-pending-timing" aria-live="off">
          {timing.elapsedSeconds !== null ? (
            <div><dt>{copy.elapsed}</dt><dd>{duration(timing.elapsedSeconds)}</dd></div>
          ) : null}
          {timing.estimatedSeconds !== null ? (
            <div><dt>{etaSource === 'observed' ? copy.observed : copy.estimate}</dt><dd><span className="generation-pending-approx">≈ </span>{duration(timing.estimatedSeconds)}</dd></div>
          ) : null}
        </dl>
      ) : null}
      <div className="generation-pending-notes">
        {timing.overdue ? <span className="generation-pending-overdue">{copy.overdue}</span> : null}
        {timing.degraded ? <span className="generation-pending-degraded" role="status">{copy.degraded}</span> : null}
        {timing.checkedAgoSeconds !== null ? <span className="generation-pending-checked" aria-live="off">{copy.checked} {duration(timing.checkedAgoSeconds)} {copy.ago}</span> : null}
      </div>
      <style jsx>{`
        .generation-pending-status {
          --pending-accent: var(--overlay-muted, currentColor);
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          max-width: 520px;
          gap: 10px;
          color: inherit;
          text-align: center;
          line-height: 1.35;
        }
        .generation-pending-artwork { width: 120px; height: 72px; flex: none; }
        .generation-pending-stage {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-size: 10px;
          letter-spacing: .09em;
          text-transform: uppercase;
        }
        .generation-pending-stage strong { font-weight: 600; }
        .generation-pending-dot {
          width: 5px;
          height: 5px;
          flex: none;
          border-radius: 50%;
          background: var(--pending-accent);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--pending-accent) 12%, transparent);
        }
        .generation-pending-heading {
          margin: 0;
          max-width: 100%;
          text-wrap: balance;
          font-size: 19px;
          font-weight: 600;
          line-height: 1.2;
          letter-spacing: -.045em;
          color: var(--overlay-ink, inherit);
        }
        .generation-pending-timing {
          display: flex;
          justify-content: center;
          margin: 3px 0 0;
          padding: 12px 4px;

        }
        .generation-pending-timing > div { padding-inline: 20px; }
        .generation-pending-timing > div + div { border-left: 1px solid color-mix(in srgb, currentColor 16%, transparent); }
        dt { font-size: 10px; font-weight: 450; margin-bottom: 5px; }
        dd {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          letter-spacing: -.045em;
          font-variant-numeric: tabular-nums;
          line-height: 1;
          white-space: nowrap;
          color: var(--overlay-ink, inherit);
        }
        .generation-pending-approx { font-size: .9em; }
        .generation-pending-notes { display: flex; flex-direction: column; gap: 4px; max-width: 100%; font-size: 10px; }
        .generation-pending-notes:empty { display: none; }
        .generation-pending-degraded { text-wrap: balance; }
        .generation-pending-overdue { color: var(--pending-accent); }
        .generation-pending-checked { font-size: 9px; opacity: .75; }
        [data-generation-stage='failed'] .generation-pending-dot { background: var(--error, #b54736); }
        @container generation-overlay (min-height: 400px) and (min-width: 600px) {
          .generation-pending-status { gap: 20px; }
          .generation-pending-artwork { width: 180px; height: 96px; margin-bottom: 6px; }
          .generation-pending-stage { font-size: 11px; letter-spacing: .1em; }
          .generation-pending-heading { font-size: 30px; }
          .generation-pending-timing { margin-top: 4px; padding-block: 16px; }
          .generation-pending-timing > div { padding-inline: 32px; min-width: 150px; }
          dt { font-size: 13px; margin-bottom: 9px; }
          dd { font-size: 32px; }
          .generation-pending-notes { font-size: 12px; }
          .generation-pending-checked { font-size: 11px; }
        }
        @container generation-overlay (max-height: 280px) {
          .generation-pending-status { gap: 7px; }
          .generation-pending-artwork { width: 96px; height: 48px; }
          .generation-pending-heading { display: none; }
          .generation-pending-timing { margin: 0; padding-block: 9px; }
          dd { font-size: 20px; }
        }
        @container generation-overlay (max-height: 190px) {
          .generation-pending-status { gap: 4px; }
          .generation-pending-artwork { width: 72px; height: 32px; }
          .generation-pending-timing { padding-block: 6px; }
          .generation-pending-timing > div { padding-inline: 12px; }
          dt { font-size: 9px; margin-bottom: 3px; }
          dd { font-size: 18px; }
        }
        @container generation-overlay (max-height: 130px) {
          .generation-pending-artwork, .generation-pending-notes { display: none; }
          .generation-pending-stage { font-size: 9px; letter-spacing: .03em; }
          .generation-pending-timing > div { padding-inline: 8px; }
          dd { font-size: 16px; }
        }
      `}</style>
    </div>
  );
}
