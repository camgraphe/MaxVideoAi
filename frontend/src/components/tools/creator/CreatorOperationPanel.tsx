'use client';
import Link from 'next/link';
import { creatorWorkspaceCopy } from './creator-workspace-copy';
import type { useCreatorOperation } from './useCreatorOperation';
import styles from './creator-workspace.module.css';
export function CreatorOperationPanel({ locale, operation, onPrepare, disabled, action }: {
  locale: string; operation: ReturnType<typeof useCreatorOperation>; onPrepare(): void; disabled?: boolean; action?: string;
}) {
  const copy = creatorWorkspaceCopy(locale), quote = operation.quote;
  const money = (amountCents: number, currency: string) => new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amountCents / 100);
  return <div className={styles.settings}>
    {operation.error ? <p className={styles.error} role="alert">{operation.error === 'SUBTITLE_SEQUENCE_CHANGED' ? copy.sequenceChanged : operation.error === 'SUBTITLE_MIX_TRANSITION_UNSUPPORTED' ? copy.mixTransition : operation.error === 'PARAMETER_INVALID' ? copy.validation : operation.error === 'REFERENCE_INVALID' ? copy.sourceError : operation.error === 'INSUFFICIENT_FUNDS' ? copy.funds : operation.error === 'STATUS_UNAVAILABLE' ? copy.error : copy.unavailable}</p> : null}
    {operation.running ? <div role="status"><p>{operation.needsAttention ? copy.verifying : copy.working}</p><p className={styles.notice}>{copy.pending}</p><button type="button" onClick={operation.retry}>{copy.check}</button></div> : null}
    {quote && (!operation.running || operation.needsConfirmation) ? <div className={styles.quote}>
      <p>{copy.quoted}</p>
      {quote.breakdown ? <dl><div><dt>{copy.mixPreparation}</dt><dd>{money(quote.breakdown.mixPreparation.amountCents,quote.breakdown.mixPreparation.currency)}</dd></div><div><dt>{copy.transcription}</dt><dd>{money(quote.breakdown.transcription.amountCents,quote.breakdown.transcription.currency)}</dd></div></dl> : null}
      <strong>{money(quote.price.amountCents, quote.price.currency)}</strong>
      {operation.exportEstimate ? <p>{copy.exportEstimate}: {money(operation.exportEstimate.amountCents, operation.exportEstimate.currency)}. {copy.estimateHint}</p> : null}
      {quote.topupRequired ? <Link href="/app/billing" prefetch={false}>{copy.funds}</Link> : null}
      {operation.expired ? <><p role="status">{copy.expiredQuote}</p>{operation.needsConfirmation ? <button type="button" onClick={operation.discardExpired}>{copy.newResult}</button> : null}</> : <button type="button" className={styles.primary} disabled={disabled || operation.busy || quote.topupRequired} onClick={() => void operation.confirm()}>{operation.busy ? copy.loading : operation.needsConfirmation ? copy.retryConfirm : copy.confirm}</button>}
    </div> : null}
    {!operation.running && (!quote || operation.expired) ? <button type="button" className={styles.primary} disabled={disabled || operation.busy} onClick={onPrepare}>{operation.busy ? copy.loading : action ?? copy.quote}</button> : null}
  </div>;
}
