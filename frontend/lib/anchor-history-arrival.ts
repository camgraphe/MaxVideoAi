type HistoryArrival = { href: string | null };
const arrivals = new WeakMap<Window, HistoryArrival>();

/**
 * Observe history while streamed route components are unmounted. One passive
 * listener lasts for this document; it never writes history or changes scrolling.
 * Mounted owners also consume same-route popstate events to avoid stale arrivals.
 */
export function consumeAnchorHistoryArrival(view: Window): boolean {
  let arrival = arrivals.get(view);
  if (!arrival) {
    arrival = { href: null };
    arrivals.set(view, arrival);
    const state = arrival;
    view.addEventListener('popstate', () => { state.href = view.location.href; }, { capture: true, passive: true });
  }
  const fromHistory = arrival.href === view.location.href;
  arrival.href = null;
  return fromHistory;
}
