export type ReportPeriod = { from: string; to: string; includeAdmin: boolean };
const day = 86_400_000;
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);

export function routingPeriod(params: URLSearchParams, now = new Date()): ReportPeriod | null {
  for (const key of ['from', 'to', 'internal']) if (params.getAll(key).length > 1) return null;
  const from = params.get('from'),
    to = params.get('to'),
    internal = params.get('internal');
  if ((from === null) !== (to === null) || (internal !== null && internal !== '1' && internal !== '0'))
    return null;
  const today = iso(now.getTime());
  const start = from ?? iso(Date.parse(today) - 29 * day),
    end = to ?? today;
  function valid(value: string) {
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !value.startsWith('0000') &&
      Number.isFinite(Date.parse(value)) &&
      iso(Date.parse(value)) === value
    );
  }
  if (!valid(start) || !valid(end) || start > end || end > today || Date.parse(end) - Date.parse(start) > 30 * day)
    return null;
  return { from: start, to: end, includeAdmin: internal === '1' };
}

export function previousMonth(now = new Date()) {
  const first = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  return { from: iso(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)), to: iso(first - day) };
}
