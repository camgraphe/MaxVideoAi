'use client';

export function AdminDynamicToolPriceField({ value, disabled, onChange }: {
  value?: string; disabled: boolean; onChange: (value: string) => void;
}) {
  if (value === undefined) return null;
  const multiplier = Number(value);
  const margin = Number.isFinite(multiplier) && multiplier >= 1 ? ((1 - 1 / multiplier) * 100).toFixed(1) : null;
  return <label className="space-y-1 text-xs text-text-secondary">
    <span className="block">Customer coefficient × supplier estimate</span>
    <input aria-label="Dynamic tool price coefficient" type="number" min={1} max={1000} step={0.1} value={value}
      disabled={disabled} onChange={event => onChange(event.target.value)}
      className="w-36 rounded-md border border-[#cbb9ff] bg-surface px-3 py-2 text-sm text-text-primary" />
    <span className="block">{margin == null ? 'Enter a coefficient between 1 and 1000.' : `≈ ${margin}% gross margin before rounding, minimum and fees.`}</span>
  </label>;
}
