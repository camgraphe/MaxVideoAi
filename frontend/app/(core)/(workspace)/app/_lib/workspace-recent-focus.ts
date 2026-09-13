/** Reveal a recent-media destination below the actual sticky app chrome. */
export function focusWorkspaceRecentTarget(target: HTMLElement | null, scrollTarget = target) {
  if (!target || !scrollTarget) return;
  const view = target.ownerDocument.defaultView;
  if (!view) return;
  const app = target.closest('.app-experience');
  const stickyHeight = ['.app-connected-header', '.app-navigation-activities'].reduce(
    (height, selector) => height + (app?.querySelector(selector)?.getBoundingClientRect().height ?? 0),
    0,
  );
  target.focus({ preventScroll: true });
  view.scrollTo({ top: Math.max(0, view.scrollY + scrollTarget.getBoundingClientRect().top - stickyHeight - 12), behavior: 'instant' });
}
