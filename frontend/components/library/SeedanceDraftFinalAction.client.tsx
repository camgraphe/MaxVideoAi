'use client';
import { Button } from '@/components/ui/Button';
import { useSeedanceWorkflowAccount, type SeedanceWorkflowAccount } from '@/hooks/useSeedanceWorkflowAccount';
import { useSeedanceWorkflowView } from '@/hooks/useSeedanceWorkflowView';
import { useSeedanceFinalization } from '@/hooks/useSeedanceFinalization';
import { getKnownGenerationFailureMessage } from '@/lib/generation-failure-messages';
import { appendConfirmedWalletRefund } from '@/lib/seedance-failure-messages';

export function SeedanceDraftFinalAction({ jobId, locale = 'en', account: suppliedAccount, onNavigate, asAside = false }: {
  jobId: string; locale?: string; account?: SeedanceWorkflowAccount | null; onNavigate?: (href: string) => void; asAside?: boolean;
}) {
  const session = useSeedanceWorkflowAccount();
  const account = suppliedAccount === undefined ? session : suppliedAccount;
  const { data: view, mutate, error: readError } = useSeedanceWorkflowView(jobId, account);
  const action = useSeedanceFinalization({ view: view ?? null, account, onAccepted: () => { void mutate(); } });
  const wrap = (content: React.ReactNode) => asAside ? <aside className="app-media-panel-actions">{content}</aside> : content;
  const fr = locale.startsWith('fr');
  const es = locale.startsWith('es');
  if (!view) return readError ? wrap(<p role="status" className="text-xs text-text-muted">{fr ? 'Statut Draft indisponible.' : es ? 'Estado del Draft no disponible.' : 'Draft status unavailable.'}</p>) : null;
  const selectedResolution = action.resolution === '4k' ? '4K' : '1080p';
  const deliveredResolution = view.final?.resolution === '4k' ? '4K' : '1080p';
  const failureCopy = fr ? {
    title: 'Le Draft a échoué.',
    unknown: 'Seedance n’a pas pu terminer ce Draft. La raison précise n’est pas disponible.',
    retry: 'Modifiez votre prompt, puis lancez un nouveau Draft.',
    review: 'Revoir la demande',
  } : es ? {
    title: 'El Draft ha fallado.',
    unknown: 'Seedance no ha podido terminar este Draft. El motivo exacto no está disponible.',
    retry: 'Modifica tu prompt y después inicia un nuevo Draft.',
    review: 'Revisar la solicitud',
  } : {
    title: 'Draft failed.',
    unknown: 'Seedance could not finish this Draft. The exact reason is unavailable.',
    retry: 'Edit your prompt, then start a new Draft.',
    review: 'Review the request',
  };
  const failureMessage = view.eligibility === 'failed' ? appendConfirmedWalletRefund(
    getKnownGenerationFailureMessage({ message: view.draft.message, locale }) ?? failureCopy.unknown,
    { paymentStatus: view.draft.paymentStatus, amountCents: view.draft.amountCents, currency: view.draft.currency, locale },
  ) : null;
  const navigate: React.MouseEventHandler<HTMLAnchorElement> = event => {
    if (!onNavigate || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); onNavigate(event.currentTarget.getAttribute('href')!);
  };
  const format = (cents: number | null, currency = 'USD') => cents === null ? '—' : new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
  const finalCents = action.quote?.pricing?.totalCents ?? null;
  const total = finalCents !== null && view.draft.amountCents !== null ? finalCents + view.draft.amountCents : null;
  const labels = {
    pending: fr ? 'Draft en cours…' : es ? 'Draft en proceso…' : 'Draft rendering…', ready: fr ? 'Draft 480p prêt' : es ? 'Draft 480p listo' : 'Draft 480p ready',
    expired: fr ? 'Délai de finalisation expiré. Le Draft reste disponible.' : es ? 'El plazo de finalización ha caducado. El Draft sigue disponible.' : 'Finalization window expired. Your Draft is still available.',
    finalizing: fr ? `Final ${deliveredResolution} en cours…` : es ? `Final ${deliveredResolution} en proceso…` : `Final ${deliveredResolution} rendering…`, finalized: fr ? `Final ${deliveredResolution} prêt · Draft conservé` : es ? `Final ${deliveredResolution} listo · Draft conservado` : `Final ${deliveredResolution} ready · Draft retained`,
    failed: failureCopy.title, unavailable: fr ? 'Finalisation indisponible ou en vérification.' : es ? 'Finalización no disponible o en verificación.' : 'Finalization unavailable or under review.',
  };
  return wrap(<section aria-label={fr ? 'Finalisation du Draft' : es ? 'Finalización del Draft' : 'Draft finalization'} className="my-2 space-y-2 rounded-input border border-hairline p-3 text-xs" aria-live="polite">
    <p className="font-semibold text-text-primary">{labels[view.eligibility]}</p>
    {failureMessage ? <>
      <p role="alert" className="text-text-muted">{failureMessage}</p>
      <p className="text-text-primary">{failureCopy.retry}</p>
    </> : null}
    {view.eligibility === 'ready' && view.expiresAt ? <p className="text-text-muted">{fr ? 'Finalisable jusqu’au' : es ? 'Finalizar antes de' : 'Finalize before'} {new Date(view.expiresAt).toLocaleString(locale)}.</p> : null}
    {view.eligibility === 'ready' ? <label className="flex flex-wrap items-center gap-2">
      <span>{fr ? 'Résolution finale' : es ? 'Resolución final' : 'Final resolution'}</span>
      <select value={action.resolution} disabled={action.pending || action.uncertain} onChange={event => action.selectResolution(event.target.value)} className="rounded-input border border-hairline bg-surface px-2 py-1 text-text-primary">
        <option value="1080p">1080p · 10 bits</option><option value="4k">4K · 10 bits</option>
      </select>
    </label> : null}
    {view.eligibility === 'ready' && !action.confirming ? <Button size="sm" disabled={action.pending || action.uncertain} onClick={() => void action.requestFinal()}>{fr ? `Finaliser en ${selectedResolution} · supplément` : es ? `Finalizar en ${selectedResolution} · cargo adicional` : `Finalize in ${selectedResolution} · extra charge`}</Button> : null}
    {action.confirming ? <div className="space-y-2 border-t border-hairline pt-2">
      <p>{fr ? 'Durée, format et audio conservés. Deux rendus distincts.' : es ? 'Se conservan la duración, el formato y el audio. Dos vídeos distintos.' : 'Duration, ratio and audio retained. Two separate renders.'}</p>
      <dl className="space-y-1 tabular-nums">
        <div className="flex justify-between gap-3"><dt>{fr ? 'Draft déjà payé' : es ? 'Draft ya pagado' : 'Draft already paid'}</dt><dd>{format(view.draft.amountCents, view.draft.currency)}</dd></div>
        <div className="flex justify-between gap-3"><dt>{fr ? `Final ${selectedResolution} · supplément` : es ? `Final ${selectedResolution} · cargo adicional` : `Final ${selectedResolution} · extra charge`}</dt><dd>+ {format(finalCents)}</dd></div>
        <div className="flex justify-between gap-3 font-semibold"><dt>{fr ? 'Total des deux étapes' : es ? 'Total de las dos etapas' : 'Both steps total'}</dt><dd>{format(total)}</dd></div>
      </dl>
      <div className="flex flex-wrap gap-2"><Button size="sm" disabled={action.pending || finalCents === null} onClick={() => void action.confirm()}>{action.pending ? (fr ? 'Chargement…' : es ? 'Cargando…' : 'Loading…') : `${fr ? 'Lancer le final' : es ? 'Generar el final' : 'Render final'} · ${format(finalCents)}`}</Button>
        <Button size="sm" variant="outline" disabled={action.pending} onClick={action.cancel}>{fr ? 'Garder le Draft' : es ? 'Conservar el Draft' : 'Keep Draft'}</Button></div>
    </div> : null}
    {action.error ? <p role="alert">{action.error}</p> : null}
    {action.uncertain ? <p role="status">{fr ? 'Envoi en vérification. Consultez le rendu avant tout nouvel essai.' : es ? 'Envío en verificación. Revisa el resultado antes de volver a intentarlo.' : 'Submission under review. Check the render before trying again.'}</p> : null}
    <div className="flex flex-wrap gap-3">
      <a onClick={navigate} href={`/app?job=${encodeURIComponent(view.draft.jobId)}`}>{view.eligibility === 'failed' ? failureCopy.review : fr ? 'Revoir le Draft 480p' : es ? 'Ver el Draft 480p' : 'View Draft 480p'}</a>
      {view.final ? <a onClick={navigate} href={`/app?job=${encodeURIComponent(view.final.jobId)}`}>{fr ? `Voir le final ${deliveredResolution}` : es ? `Ver el final ${deliveredResolution}` : `View final ${deliveredResolution}`}</a> : null}
    </div>
  </section>);
}
