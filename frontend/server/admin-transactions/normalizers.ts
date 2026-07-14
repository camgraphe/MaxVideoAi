export function coerceNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function normalizeCurrency(value: string | null | undefined): string {
  return (value ?? 'USD').toUpperCase();
}

export function isRefundablePaymentStatus(value: string | null | undefined): boolean {
  return value === 'paid_wallet';
}
