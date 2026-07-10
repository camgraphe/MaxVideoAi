export function formatReceiptSurfaceLabel(surface?: string | null): string | null {
  switch ((surface ?? '').toLowerCase()) {
    case 'video':
      return 'Video';
    case 'image':
      return 'Image';
    case 'character':
      return 'Character';
    case 'angle':
      return 'Angle';
    case 'upscale':
      return 'Upscale';
    case 'audio':
      return 'Audio';
    default:
      return null;
  }
}

export function parseAmountToCents(value: string): number | null {
  if (!value) return null;
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return null;
  const decimalMatch = /^\+?(\d*)(?:\.(\d*))?$/.exec(normalized);
  if (!decimalMatch || (!decimalMatch[1] && !decimalMatch[2])) return null;

  const wholeDollars = BigInt(decimalMatch[1] || '0');
  const fractionalDigits = decimalMatch[2] ?? '';
  const centDigits = fractionalDigits.padEnd(2, '0').slice(0, 2);
  let amountCents = wholeDollars * BigInt(100) + BigInt(centDigits);
  if ((fractionalDigits[2] ?? '0') >= '5') {
    amountCents += BigInt(1);
  }
  if (amountCents <= BigInt(0) || amountCents > BigInt(Number.MAX_SAFE_INTEGER)) {
    return null;
  }
  return Number(amountCents);
}
