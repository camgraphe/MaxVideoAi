export function adjacentNonnegativeDouble(value: number, direction: 'next' | 'previous'): number {
  if (!Number.isFinite(value) || value < 0) throw new Error('A finite nonnegative double is required.');
  if (value === 0) return direction === 'next' ? Number.MIN_VALUE : 0;
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  view.setBigUint64(0, view.getBigUint64(0) + (direction === 'next' ? BigInt(1) : -BigInt(1)));
  return view.getFloat64(0);
}
