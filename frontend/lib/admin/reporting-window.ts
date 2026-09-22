export const ADMIN_TIME_ZONE = 'Europe/Madrid';
export type AdminReportingPeriod = 'today' | '24h';

/** Resolve the offset at local midnight, including days whose offset changes later. */
export function adminReportingWindow(period: string | undefined, now = new Date()) {
  const selected: AdminReportingPeriod = period === '24h' ? '24h' : 'today';
  let from = new Date(now.getTime() - 86_400_000);
  if (selected === 'today') {
    const format = new Intl.DateTimeFormat('en-CA', { timeZone: ADMIN_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    const parts = (date: Date) => Object.fromEntries(format.formatToParts(date).map(part => [part.type, part.value]));
    const local = parts(now);
    const midnight = Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day));
    let candidate = midnight;
    for (let i = 0; i < 3; i++) {
      const view = parts(new Date(candidate));
      const localCandidate = Date.UTC(Number(view.year), Number(view.month) - 1, Number(view.day), Number(view.hour), Number(view.minute), Number(view.second));
      candidate += midnight - localCandidate;
    }
    from = new Date(candidate);
  }
  return { period: selected, from: from.toISOString(), to: now.toISOString(), timeZone: ADMIN_TIME_ZONE };
}
