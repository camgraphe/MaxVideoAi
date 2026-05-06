import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  Gauge,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  TimerReset,
  WalletCards,
} from 'lucide-react';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import {
  type CheckoutReportRange,
  type CheckoutReportStatus,
  fetchCheckoutReport,
  normalizeCheckoutReportRange,
} from '@/server/checkout-report';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<{
    range?: string | string[];
  }>;
};

type StatTone = 'blue' | 'green' | 'violet' | 'amber' | 'rose' | 'slate';
type ReportCard = {
  label: string;
  value: string;
  helper: string;
  tone: StatTone;
  icon: typeof ShieldCheck;
};

const RANGE_OPTIONS: Array<{ value: CheckoutReportRange; label: string }> = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
];

const numberFormatter = new Intl.NumberFormat('en-US');
const percentFormatter = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });
const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const STATUS_META: Record<CheckoutReportStatus, { label: string; className: string }> = {
  passed: { label: 'Passed', className: 'border-success-border bg-success-bg text-success' },
  abandoned: { label: 'Abandoned', className: 'border-warning-border bg-warning-bg text-warning' },
  blocked: { label: 'Blocked', className: 'border-error-border bg-error-bg text-error' },
  challenged: { label: 'Challenged', className: 'border-brand/25 bg-brand/10 text-brand' },
  open: { label: 'Open', className: 'border-border bg-surface text-text-secondary' },
  failed: { label: 'Failed', className: 'border-error-border bg-error-bg text-error' },
};

export default async function CheckoutReportPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const selectedRange = normalizeCheckoutReportRange(searchParams?.range);

  if (!process.env.DATABASE_URL) {
    return (
      <div className="space-y-5">
        <HubHeader selectedRange={selectedRange} />
        <Panel title="Checkout guard report">
          <AdminNotice tone="warning">
            Database connection is not configured. Set <code className="font-mono text-xs">DATABASE_URL</code> to enable Checkout
            reporting.
          </AdminNotice>
        </Panel>
      </div>
    );
  }

  const report = await fetchCheckoutReport(selectedRange);
  const cards = buildReportCards(report);
  const conversionRate = report.summary.total ? report.summary.passed / report.summary.total : 0;
  const protectionRate = report.summary.total
    ? (report.summary.blocked + report.summary.challenged) / report.summary.total
    : 0;

  return (
    <div className="space-y-5">
      <HubHeader selectedRange={report.range} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6" aria-label="Checkout guard metrics">
        {cards.map((card) => (
          <MetricCard key={card.label} card={card} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <Panel
          title="Guard split"
          action={<span className="rounded-full border border-border bg-bg px-3 py-1 text-xs font-semibold text-text-secondary">{formatNumber(report.summary.total)} attempts</span>}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <StatusBlock label="Conversion" value={formatPercent(conversionRate)} helper={`${formatNumber(report.summary.passed)} completed top-ups`} tone="green" icon={CheckCircle2} />
            <StatusBlock label="Protected" value={formatPercent(protectionRate)} helper={`${formatNumber(report.summary.blocked + report.summary.challenged)} stopped or challenged`} tone="rose" icon={ShieldAlert} />
            <StatusBlock label="Checkout abandon" value={formatNumber(report.summary.abandoned)} helper="Session created, no wallet top-up after 30 min" tone="amber" icon={TimerReset} />
            <StatusBlock label="Fast pay" value={formatNumber(report.summary.express)} helper={`${formatNumber(report.summary.hosted)} hosted Checkout attempts`} tone="blue" icon={WalletCards} />
          </div>
        </Panel>

        <Panel title="Top reasons">
          {report.reasons.length ? (
            <div className="space-y-3">
              {report.reasons.map((reason) => (
                <ReasonRow key={reason.reason} label={formatReason(reason.reason)} count={reason.count} total={report.summary.total} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">No guard events in this range.</p>
          )}
        </Panel>
      </section>

      <Panel
        title="Recent attempts"
        action={<Link href="/admin/transactions" prefetch={false} className="inline-flex items-center gap-1 text-xs font-semibold text-brand transition hover:text-brand-hover">Transactions <ArrowRight className="h-3.5 w-3.5" /></Link>}
      >
        {report.recent.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full text-left text-sm">
              <thead className="border-b border-hairline text-xs uppercase tracking-micro text-text-muted">
                <tr>
                  <th className="px-3 py-3 font-semibold">Time</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Mode</th>
                  <th className="px-3 py-3 font-semibold">Amount</th>
                  <th className="px-3 py-3 font-semibold">Reason</th>
                  <th className="px-3 py-3 font-semibold">User</th>
                  <th className="px-3 py-3 font-semibold">Session</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {report.recent.map((attempt) => (
                  <tr key={attempt.id} className="align-top text-text-secondary">
                    <td className="px-3 py-3 whitespace-nowrap">{formatDateTime(attempt.createdAt)}</td>
                    <td className="px-3 py-3"><StatusPill status={attempt.status} /></td>
                    <td className="px-3 py-3">{attempt.mode === 'express_checkout' ? 'Fast pay' : 'Hosted'}</td>
                    <td className="px-3 py-3 font-semibold text-text-primary">{formatAmount(attempt.amountCents)}</td>
                    <td className="px-3 py-3">{formatReason(attempt.reason ?? attempt.outcome)}</td>
                    <td className="px-3 py-3 font-mono text-xs">{truncateId(attempt.userId)}</td>
                    <td className="px-3 py-3 font-mono text-xs">{attempt.stripeCheckoutSessionId ? truncateId(attempt.stripeCheckoutSessionId) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">No Checkout attempts in this range.</p>
        )}
      </Panel>
    </div>
  );
}

function HubHeader({ selectedRange }: { selectedRange: CheckoutReportRange }) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-[1.7rem] font-semibold leading-tight text-text-primary sm:text-[2rem]">Checkout guard</h1>
        <p className="mt-1 text-sm leading-6 text-text-secondary">
          Report des sessions wallet Checkout : bloqué, challenge, abandonné et passé.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <RangeSelector current={selectedRange} />
        <Link
          href="/admin/transactions"
          prefetch={false}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CreditCard className="h-4 w-4" />
          Ledger
        </Link>
      </div>
    </header>
  );
}

function RangeSelector({ current }: { current: CheckoutReportRange }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-bg p-1 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      {RANGE_OPTIONS.map((option) => (
        <Link
          key={option.value}
          href={`/admin/checkout-report?range=${option.value}`}
          prefetch={false}
          className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
            current === option.value ? 'bg-slate-950 text-white shadow-sm' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
          }`}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-hairline bg-surface p-4 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function MetricCard({ card }: { card: ReportCard }) {
  const Icon = card.icon;
  return (
    <article className="rounded-xl border border-hairline bg-surface p-4 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{card.label}</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{card.value}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneClass(card.tone)}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-text-secondary">{card.helper}</p>
    </article>
  );
}

function StatusBlock({
  label,
  value,
  helper,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  tone: StatTone;
  icon: typeof ShieldCheck;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-bg p-3">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClass(tone)}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">{label}</p>
          <p className="text-lg font-semibold text-text-primary">{value}</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-text-secondary">{helper}</p>
    </div>
  );
}

function ReasonRow({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? count / total : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="truncate text-sm font-medium text-text-primary">{label}</span>
        <span className="text-xs font-semibold text-text-secondary">{formatNumber(count)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-bg">
        <div className="h-full rounded-full bg-slate-950" style={{ width: `${Math.max(3, Math.round(pct * 100))}%` }} />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: CheckoutReportStatus }) {
  const meta = STATUS_META[status];
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}>{meta.label}</span>;
}

function buildReportCards(report: Awaited<ReturnType<typeof fetchCheckoutReport>>): ReportCard[] {
  return [
    { label: 'Total', value: formatNumber(report.summary.total), helper: `${formatNumber(report.summary.distinctUsers)} users · ${formatNumber(report.summary.distinctIps)} IP hashes`, tone: 'slate', icon: Gauge },
    { label: 'Passed', value: formatNumber(report.summary.passed), helper: 'Top-ups recorded after Checkout', tone: 'green', icon: CheckCircle2 },
    { label: 'Abandoned', value: formatNumber(report.summary.abandoned), helper: 'Session created, no receipt after 30 min', tone: 'amber', icon: Clock3 },
    { label: 'Blocked', value: formatNumber(report.summary.blocked), helper: 'Rate limited or CAPTCHA failed', tone: 'rose', icon: LockKeyhole },
    { label: 'Challenged', value: formatNumber(report.summary.challenged), helper: `${formatNumber(report.summary.captchaPassed)} CAPTCHA passes`, tone: 'violet', icon: ShieldAlert },
    { label: 'Open', value: formatNumber(report.summary.open), helper: 'Recent Checkout sessions still pending', tone: 'blue', icon: WalletCards },
  ];
}

function toneClass(tone: StatTone) {
  switch (tone) {
    case 'green':
      return 'bg-success-bg text-success';
    case 'amber':
      return 'bg-warning-bg text-warning';
    case 'rose':
      return 'bg-error-bg text-error';
    case 'violet':
      return 'bg-brand/10 text-brand';
    case 'blue':
      return 'bg-info-bg text-info';
    case 'slate':
    default:
      return 'bg-bg text-text-secondary';
  }
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatPercent(value: number) {
  return percentFormatter.format(value);
}

function formatAmount(amountCents: number) {
  return currencyFormatter.format(amountCents / 100);
}

function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

function formatReason(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function truncateId(value: string) {
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}
