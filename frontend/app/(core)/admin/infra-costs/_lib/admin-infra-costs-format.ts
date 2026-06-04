import type { InfraCostAlertLevel } from '@/server/infra-costs';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const compactCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 1,
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatUsd(value: number, options: { compact?: boolean } = {}): string {
  return (options.compact ? compactCurrencyFormatter : currencyFormatter).format(value);
}

export function formatNumber(value: number, options: { integer?: boolean } = {}): string {
  return (options.integer ? integerFormatter : numberFormatter).format(value);
}

export function formatGb(value: number): string {
  return `${formatNumber(value)} GB`;
}

export function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return dateTimeFormatter.format(parsed);
}

export function formatPercent(value: number): string {
  return percentFormatter.format(value);
}

export function formatAlertLevel(level: InfraCostAlertLevel): string {
  if (level === 'critical') return 'Critical';
  if (level === 'warning') return 'Warning';
  return 'Normal';
}

export function alertTone(level: InfraCostAlertLevel): 'success' | 'warning' | 'error' | 'default' {
  if (level === 'critical') return 'error';
  if (level === 'warning') return 'warning';
  if (level === 'ok') return 'success';
  return 'default';
}

export function truncateId(value: string): string {
  if (value.length <= 18) return value;
  return `${value.slice(0, 9)}...${value.slice(-6)}`;
}
