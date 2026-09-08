import { ChevronDown, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { BillingCopy } from '../_lib/billing-copy';
import type { ReceiptItem, ReceiptsState } from '../_lib/billing-types';
import { formatReceiptSurfaceLabel } from '../_lib/billing-utils';
import styles from './billing-page.module.css';

type ReceiptsPanelProps = {
  copy: BillingCopy;
  dateFormatter: Intl.DateTimeFormat;
  formatMoney: (amountCents: number, currency: string) => string;
  onExportCsv: () => void;
  onLoadMoreReceipts: () => void;
  onToggleReceipts: () => void;
  receipts: ReceiptsState;
  receiptsCollapsed: boolean;
  visibleReceipts: ReceiptItem[];
};

export function ReceiptsPanel({
  copy,
  dateFormatter,
  formatMoney,
  onExportCsv,
  onLoadMoreReceipts,
  onToggleReceipts,
  receipts,
  receiptsCollapsed,
  visibleReceipts,
}: ReceiptsPanelProps) {
  return (
    <section className={styles.receiptsPanel} aria-labelledby="billing-history-title">
      <header className={styles.receiptsHeader}>
        <div>
          <p className={styles.eyebrow}>{copy.receipts.ledgerLabel}</p>
          <h2 id="billing-history-title">{copy.receipts.title}</h2>
          <p>{copy.receipts.subtitle}</p>
        </div>
        <div>
          {!receiptsCollapsed ? (
            <Button type="button" variant="ghost" size="md" onClick={onExportCsv}>
              <Download size={16} aria-hidden="true" />
              {copy.receipts.exportCsv}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onToggleReceipts}
            aria-expanded={!receiptsCollapsed}
          >
            {receiptsCollapsed ? copy.receipts.collapsedLabel : copy.receipts.expandedLabel}
            <ChevronDown size={16} aria-hidden="true" className={!receiptsCollapsed ? styles.chevronOpen : undefined} />
          </Button>
        </div>
      </header>

      {receipts.error ? <p className={styles.receiptError} role="status">{receipts.error}</p> : null}
      <div className={styles.receiptLedger} aria-busy={receipts.loading}>
        {visibleReceipts.length === 0 && !receipts.loading ? (
          <p className={styles.receiptsEmpty}>{copy.receipts.empty}</p>
        ) : null}
        {visibleReceipts.map((receipt) => (
          <ReceiptRow
            key={receipt.id}
            copy={copy}
            dateFormatter={dateFormatter}
            formatMoney={formatMoney}
            receipt={receipt}
          />
        ))}
        {receipts.loading ? <p className={styles.receiptsLoading}>{copy.receipts.loading}</p> : null}
      </div>

      {!receiptsCollapsed && receipts.nextCursor ? (
        <div className={styles.receiptsFooter}>
          <Button type="button" variant="outline" size="md" onClick={onLoadMoreReceipts} disabled={receipts.loading}>
            {receipts.loading ? copy.receipts.loading : copy.receipts.loadMore}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function ReceiptRow({
  copy,
  dateFormatter,
  formatMoney,
  receipt,
}: {
  copy: BillingCopy;
  dateFormatter: Intl.DateTimeFormat;
  formatMoney: (amountCents: number, currency: string) => string;
  receipt: ReceiptItem;
}) {
  const signedCents = receipt.type === 'charge' ? -receipt.amount_cents : receipt.amount_cents;
  const amountDisplay = formatMoney(signedCents, receipt.currency);
  const typeKey = receipt.type === 'charge' ? 'charge' : receipt.type === 'refund' ? 'refund' : 'topup';
  const typeLabel = copy.receipts.typeLabels[typeKey as keyof typeof copy.receipts.typeLabels] ?? receipt.type;
  const surfaceLabel = formatReceiptSurfaceLabel(receipt.surface);
  const taxCents = Number(receipt.tax_amount_cents ?? 0);
  const discountCents = Number(receipt.discount_amount_cents ?? 0);
  const hasStripeDocument =
    (receipt.document_type === 'invoice' || receipt.document_type === 'receipt') &&
    typeof receipt.document_url === 'string' &&
    receipt.document_url.length > 0;
  const documentLabel = receipt.document_type === 'invoice'
    ? copy.receipts.invoiceLabel
    : receipt.document_type === 'receipt'
      ? copy.receipts.receiptLabel
      : null;
  const documentActionLabel = receipt.document_type === 'invoice' ? copy.receipts.viewInvoice : copy.receipts.viewReceipt;
  const shouldShowDocumentRow = hasStripeDocument || receipt.type === 'topup';

  return (
    <details className={styles.receiptRow} data-type={typeKey}>
      <summary>
        <span className={styles.receiptDate} suppressHydrationWarning>
          {dateFormatter.format(new Date(receipt.created_at))}
        </span>
        <span className={styles.receiptIdentity}>
          <strong>{receipt.description || typeLabel}</strong>
          <small>
            <span data-receipt-type={typeKey}>{typeLabel}</span>
            {surfaceLabel ? <span>{surfaceLabel}</span> : null}
            {receipt.job_id ? <span>Job {receipt.job_id}</span> : null}
          </small>
        </span>
        <span className={styles.receiptAmount} data-positive={signedCents > 0}>{amountDisplay}</span>
        <ChevronDown size={17} className={styles.receiptChevron} aria-hidden="true" />
      </summary>
      <div className={styles.receiptDetails}>
        <dl>
          <div>
            <dt>{copy.receipts.fields.walletMovement}</dt>
            <dd>{amountDisplay}</dd>
          </div>
          {taxCents > 0 ? (
            <div><dt>{copy.receipts.fields.tax}</dt><dd>{formatMoney(taxCents, receipt.currency)}</dd></div>
          ) : null}
          {discountCents > 0 ? (
            <div><dt>{copy.receipts.fields.discount}</dt><dd>{formatMoney(-discountCents, receipt.currency)}</dd></div>
          ) : null}
          {shouldShowDocumentRow ? (
            <div>
              <dt>{copy.receipts.fields.document}</dt>
              <dd>
                {hasStripeDocument ? (
                  <a href={receipt.document_url ?? '#'} target="_blank" rel="noreferrer">
                    <FileText size={15} aria-hidden="true" />
                    {receipt.document_label ?? documentLabel} · {documentActionLabel}
                  </a>
                ) : (
                  <a href={`mailto:${copy.teams.contactEmail}`}>{copy.receipts.contactSupport}</a>
                )}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </details>
  );
}
