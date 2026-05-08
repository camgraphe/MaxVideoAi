import clsx from 'clsx';
import type { AdminJobAuditRecord, AdminJobOutcome } from '@/server/admin-job-audit';

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Europe/Paris',
});

export function formatCurrency(amountCents: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const parts = Object.fromEntries(
      dateTimeFormatter
        .formatToParts(date)
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value])
    );
    return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
  } catch {
    return value;
  }
}

export function outcomeMeta(outcome: AdminJobOutcome) {
  const base = 'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-micro';
  if (outcome === 'failed_action_required') {
    return {
      label: 'Action required',
      className: clsx(base, 'border-error-border bg-error-bg text-error'),
    };
  }
  if (outcome === 'refunded_failure_resolved') {
    return {
      label: 'Refunded failure',
      className: clsx(base, 'border-info-border bg-info-bg text-info'),
    };
  }
  if (outcome === 'completed') {
    return {
      label: 'Completed',
      className: clsx(base, 'border-success-border bg-success-bg text-success'),
    };
  }
  if (outcome === 'in_progress') {
    return {
      label: 'In progress',
      className: clsx(base, 'border-warning-border bg-warning-bg text-warning'),
    };
  }
  return {
    label: 'Unknown',
    className: clsx(base, 'border-border bg-muted text-text-secondary'),
  };
}

export function technicalStatusBadge(status?: string | null) {
  if (!status) return null;
  const normalized = status.toLowerCase();
  const base = 'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-micro';
  if (normalized === 'completed') {
    return <span className={clsx(base, 'border-success-border bg-success-bg text-success')}>completed</span>;
  }
  if (normalized === 'failed') {
    return <span className={clsx(base, 'border-error-border bg-error-bg text-error')}>failed</span>;
  }
  if (normalized === 'running' || normalized === 'queued' || normalized === 'pending') {
    return <span className={clsx(base, 'border-warning-border bg-warning-bg text-warning')}>{normalized}</span>;
  }
  return <span className={clsx(base, 'border-info-border bg-info-bg text-info')}>{normalized}</span>;
}

export function displayMeta(job: AdminJobAuditRecord) {
  const surface = job.surface ?? 'video';
  if (surface === 'image') {
    return {
      readyLabel: 'Image ready',
      placeholderLabel: 'Placeholder image',
      missingLabel: 'Missing image',
      linkLabel: 'Open image',
    };
  }
  if (surface === 'character') {
    return {
      readyLabel: 'Character ready',
      placeholderLabel: 'Placeholder image',
      missingLabel: 'Missing image',
      linkLabel: 'Open character',
    };
  }
  if (surface === 'angle') {
    return {
      readyLabel: 'Angle ready',
      placeholderLabel: 'Placeholder image',
      missingLabel: 'Missing image',
      linkLabel: 'Open angle',
    };
  }
  return {
    readyLabel: 'Video ready',
    placeholderLabel: 'Placeholder asset',
    missingLabel: 'Missing video',
    linkLabel: 'Open video',
  };
}
