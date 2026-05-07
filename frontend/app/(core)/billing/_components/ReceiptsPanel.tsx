import { Button } from '@/components/ui/Button';
import type { BillingCopy } from '../_lib/billing-copy';
import type { ReceiptItem, ReceiptsState } from '../_lib/billing-types';
import { formatReceiptSurfaceLabel } from '../_lib/billing-utils';

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
    <section className="mt-5 rounded-card border border-border bg-surface p-4 shadow-card">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onToggleReceipts}
        className="w-full items-start justify-between border border-transparent px-2 py-2 text-left hover:bg-[rgba(69,112,255,0.08)]"
        aria-expanded={!receiptsCollapsed}
      >
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{copy.receipts.title}</h2>
          <p className="text-sm text-text-secondary">{copy.receipts.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 text-text-secondary">
          <span className="text-xs uppercase tracking-wide">{receiptsCollapsed ? copy.receipts.collapsedLabel : copy.receipts.expandedLabel}</span>
          <span
            className={`text-3xl font-semibold leading-none transition-transform ${receiptsCollapsed ? 'rotate-0' : 'rotate-180'} text-text-primary`}
            aria-hidden="true"
          >
            ▾
          </span>
        </div>
      </Button>
      {receipts.error && <p className="text-sm text-state-warning">{receipts.error}</p>}
      <div className="mt-3 stack-gap-sm">
        {visibleReceipts.length === 0 && !receipts.loading && (
          <p className="text-sm text-text-secondary">{copy.receipts.empty}</p>
        )}
        {visibleReceipts.map((receipt) => (
          <ReceiptRow
            key={receipt.id}
            copy={copy}
            dateFormatter={dateFormatter}
            formatMoney={formatMoney}
            receipt={receipt}
          />
        ))}
        {receipts.loading && (
          <p className="text-sm text-text-secondary">{copy.receipts.loading}</p>
        )}
        {!receiptsCollapsed && (
          <div className="flex items-center gap-2">
            {receipts.nextCursor && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onLoadMoreReceipts}
                disabled={receipts.loading}
                className="border-border bg-surface px-3 text-sm hover:bg-bg"
              >
                {receipts.loading ? copy.receipts.loading : copy.receipts.loadMore}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onExportCsv}
              className="ml-auto border-border bg-surface px-3 text-sm hover:bg-bg"
            >
              {copy.receipts.exportCsv}
            </Button>
          </div>
        )}
      </div>
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
  const typeClass =
    receipt.type === 'charge'
      ? 'bg-error-bg text-error'
      : receipt.type === 'refund'
        ? 'bg-sky-100 text-sky-700'
        : 'bg-success-bg text-success';
  const amountClass = signedCents < 0 ? 'text-text-primary' : 'text-success';
  const taxCents = Number(receipt.tax_amount_cents ?? 0);
  const discountCents = Number(receipt.discount_amount_cents ?? 0);
  const hasStripeDocument =
    (receipt.document_type === 'invoice' || receipt.document_type === 'receipt') &&
    typeof receipt.document_url === 'string' &&
    receipt.document_url.length > 0;
  const documentLabel =
    receipt.document_type === 'invoice'
      ? copy.receipts.invoiceLabel
      : receipt.document_type === 'receipt'
        ? copy.receipts.receiptLabel
        : null;
  const documentActionLabel =
    receipt.document_type === 'invoice' ? copy.receipts.viewInvoice : copy.receipts.viewReceipt;
  const shouldShowDocumentRow = hasStripeDocument || receipt.type === 'topup';

  return (
    <article className="stack-gap-sm rounded-card border border-border bg-bg p-4 text-sm text-text-secondary">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-xs text-text-muted" suppressHydrationWarning>
            {dateFormatter.format(new Date(receipt.created_at))}
          </span>
          {receipt.job_id && <span className="text-[11px] text-text-muted">Job {receipt.job_id}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-micro ${typeClass}`}>
            {typeLabel}
          </span>
          {surfaceLabel ? (
            <span className="rounded-full bg-surface-2 px-2 py-1 text-[11px] font-semibold uppercase tracking-micro text-text-secondary">
              {surfaceLabel}
            </span>
          ) : null}
          <span className={`text-base font-semibold ${amountClass}`}>{amountDisplay}</span>
        </div>
      </header>
      {receipt.description && <p className="text-xs text-text-muted">{receipt.description}</p>}
      <dl className="grid gap-1 text-xs sm:text-sm">
        <div className="flex justify-between font-semibold text-text-primary">
          <dt>{copy.receipts.fields.total}</dt>
          <dd>{formatMoney(receipt.amount_cents, receipt.currency)}</dd>
        </div>
        {taxCents > 0 && (
          <div className="flex justify-between text-text-muted">
            <dt>{copy.receipts.fields.tax}</dt>
            <dd>{formatMoney(taxCents, receipt.currency)}</dd>
          </div>
        )}
        {discountCents > 0 && (
          <div className="flex justify-between text-text-muted">
            <dt>{copy.receipts.fields.discount}</dt>
            <dd>{formatMoney(-discountCents, receipt.currency)}</dd>
          </div>
        )}
        {shouldShowDocumentRow && (
          <div className="flex items-center justify-between gap-3 text-text-muted">
            <dt>{copy.receipts.fields.document}</dt>
            <dd>
              {hasStripeDocument ? (
                <span className="inline-flex items-center gap-2">
                  <span>{receipt.document_label ?? documentLabel}</span>
                  <a
                    href={receipt.document_url ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-input border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-brand hover:border-brand hover:bg-surface-2"
                  >
                    {documentActionLabel}
                  </a>
                </span>
              ) : (
                <a
                  href={`mailto:${copy.teams.contactEmail}`}
                  className="text-brand underline-offset-2 hover:underline"
                >
                  {copy.receipts.contactSupport}
                </a>
              )}
            </dd>
          </div>
        )}
      </dl>
    </article>
  );
}
