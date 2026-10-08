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
  if (!view) return readError ? wrap(<p role="status" className="text-xs text-text-muted">{locale.startsWith('fr') ? 'Statut Draft indisponible.' : 'Draft status unavailable.'}</p>) : null;
  const fr = locale.startsWith('fr');
  const failureCopy = fr ? {
    title: 'Le Draft a échoué.',
    unknown: 'Seedance n’a pas pu terminer ce Draft. La raison précise n’est pas disponible.',
    retry: 'Modifiez votre prompt, puis lancez un nouveau Draft.',
    review: 'Revoir la demande',
  } : locale.startsWith('es') ? {
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
    pending: fr ? 'Draft en cours…' : 'Draft rendering…', ready: fr ? 'Draft 480p prêt' : 'Draft 480p ready',
    expired: fr ? 'Délai de finalisation expiré. Le Draft reste disponible.' : 'Finalization window expired. Your Draft is still available.',
    finalizing: fr ? 'Final 1080p en cours…' : 'Final 1080p rendering…', finalized: fr ? 'Final 1080p prêt · Draft conservé' : 'Final 1080p ready · Draft retained',
    failed: failureCopy.title, unavailable: fr ? 'Finalisation indisponible ou en vérification.' : 'Finalization unavailable or under review.',
  };
  return wrap(<section aria-label={fr ? 'Finalisation du Draft' : 'Draft finalization'} className="my-2 space-y-2 rounded-input border border-hairline p-3 text-xs" aria-live="polite">
    <p className="font-semibold text-text-primary">{labels[view.eligibility]}</p>
    {failureMessage ? <>
      <p role="alert" className="text-text-muted">{failureMessage}</p>
      <p className="text-text-primary">{failureCopy.retry}</p>
    </> : null}
    {view.eligibility === 'ready' && view.expiresAt ? <p className="text-text-muted">{fr ? 'Finalisable jusqu’au' : 'Finalize before'} {new Date(view.expiresAt).toLocaleString(locale)}.</p> : null}
    {view.eligibility === 'ready' && !action.confirming ? <Button size="sm" disabled={action.pending || action.uncertain} onClick={() => void action.requestFinal()}>{fr ? 'Finaliser en 1080p · supplément' : 'Finalize in 1080p · extra charge'}</Button> : null}
    {action.confirming ? <div className="space-y-2 border-t border-hairline pt-2">
      <p>{fr ? 'Durée, format et audio conservés. Deux rendus distincts.' : 'Duration, ratio and audio retained. Two separate renders.'}</p>
      <dl className="space-y-1 tabular-nums">
        <div className="flex justify-between gap-3"><dt>{fr ? 'Draft déjà payé' : 'Draft already paid'}</dt><dd>{format(view.draft.amountCents, view.draft.currency)}</dd></div>
        <div className="flex justify-between gap-3"><dt>{fr ? 'Final 1080p · supplément' : 'Final 1080p · extra charge'}</dt><dd>+ {format(finalCents)}</dd></div>
        <div className="flex justify-between gap-3 font-semibold"><dt>{fr ? 'Total des deux étapes' : 'Both steps total'}</dt><dd>{format(total)}</dd></div>
      </dl>
      <div className="flex flex-wrap gap-2"><Button size="sm" disabled={action.pending || finalCents === null} onClick={() => void action.confirm()}>{action.pending ? (fr ? 'Chargement…' : 'Loading…') : `${fr ? 'Lancer le final' : 'Render final'} · ${format(finalCents)}`}</Button>
        <Button size="sm" variant="outline" disabled={action.pending} onClick={action.cancel}>{fr ? 'Garder le Draft' : 'Keep Draft'}</Button></div>
    </div> : null}
    {action.error ? <p role="alert">{action.error}</p> : null}
    {action.uncertain ? <p role="status">{fr ? 'Envoi en vérification. Consultez le rendu avant tout nouvel essai.' : 'Submission under review. Check the render before trying again.'}</p> : null}
    <div className="flex flex-wrap gap-3">
      <a onClick={navigate} href={`/app?job=${encodeURIComponent(view.draft.jobId)}`}>{view.eligibility === 'failed' ? failureCopy.review : fr ? 'Revoir le Draft 480p' : 'View Draft 480p'}</a>
      {view.final ? <a onClick={navigate} href={`/app?job=${encodeURIComponent(view.final.jobId)}`}>{fr ? 'Voir le final 1080p' : 'View final 1080p'}</a> : null}
    </div>
  </section>);
}
