export function installGalleryDiagnostic() {
const events = [];
window.__galleryDiagnostic = events;
const record = (type, data) => { if (events.length < 12000) events.push({ t: performance.now(), type, ...data }); };
const selector = '[class*="examples-masonry_card__"]';
const rect = node => {
  if (!(node instanceof Element)) return null;
  const r = node.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
};
const identify = node => {
  if (!(node instanceof Element)) return null;
  const card = node.closest(selector);
  return { tag: node.tagName, className: String(node.className), href: card?.querySelector('a')?.getAttribute('href'), rect: rect(node) };
};
const snapshot = reason => {
  const gallery = document.querySelector('[class*="examples-masonry_gallery__"]');
  const cards = [...document.querySelectorAll(selector)];
  record('geometry', {
    reason, viewport: { innerWidth, innerHeight, clientWidth: document.documentElement?.clientWidth ?? null, scrollWidth: document.documentElement?.scrollWidth ?? null },
    gallery: rect(gallery), videos: document.querySelectorAll('video').length,
    cards: cards.map(card => {
      const style = getComputedStyle(card), parent = getComputedStyle(card.parentElement);
      return { ...identify(card), frame: card.dataset.frame, inline: card.getAttribute('style'),
        parentInline: card.parentElement.getAttribute('style'), parentRect: rect(card.parentElement),
        aspectRatio: style.aspectRatio, width: style.width, height: style.height,
        flex: parent.flex, maxWidth: parent.maxWidth, ratio: parent.getPropertyValue('--video-ratio'),
        imageComplete: card.querySelector('img')?.complete, video: card.querySelector('video') ? {
          paused: card.querySelector('video').paused, width: card.querySelector('video').videoWidth,
          height: card.querySelector('video').videoHeight, readyState: card.querySelector('video').readyState,
        } : null };
    }),
  });
};
new PerformanceObserver(list => {
  for (const entry of list.getEntries()) record('layout-shift', {
    value: entry.value, startTime: entry.startTime, hadRecentInput: entry.hadRecentInput,
    sources: entry.sources.map(source => ({ node: identify(source.node), previousRect: source.previousRect, currentRect: source.currentRect })),
  });
}).observe({ type: 'layout-shift', buffered: true });
const observed = new WeakSet();
const resize = new ResizeObserver(entries => {
  record('resize', { nodes: entries.map(entry => ({ node: identify(entry.target), contentRect: entry.contentRect.toJSON() })) });
  snapshot('resize');
});
const observeCards = () => {
  for (const card of document.querySelectorAll(selector)) for (const node of [card, card.parentElement]) {
    if (!observed.has(node)) { observed.add(node); resize.observe(node); }
  }
};
const mutation = new MutationObserver(records => {
  const relevant = records.filter(r => r.target instanceof Element && (
    r.target.closest('#gallery') || ['HTML', 'BODY', 'LINK', 'STYLE'].includes(r.target.tagName)
  ));
  if (relevant.length) record('mutation', { nodes: relevant.slice(0, 80).map(r => ({
    node: identify(r.target), kind: r.type, attribute: r.attributeName, oldValue: r.oldValue,
    newValue: r.attributeName ? r.target.getAttribute(r.attributeName) : null,
    added: [...r.addedNodes].filter(n => n instanceof Element).map(n => identify(n)),
    removed: [...r.removedNodes].filter(n => n instanceof Element).map(n => identify(n)),
  })) });
  observeCards();
});
mutation.observe(document, { childList: true, subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['style', 'class', 'src', 'sizes'] });
for (const event of ['load', 'loadedmetadata', 'playing', 'pause', 'error']) document.addEventListener(event, e => {
  if (e.target instanceof Element && e.target.closest('#gallery')) record(`media-${event}`, { node: identify(e.target) });
}, true);
document.addEventListener('DOMContentLoaded', () => { observeCards(); snapshot('DOMContentLoaded'); });
document.fonts?.addEventListener('loadingdone', () => { record('fonts-loaded', {}); snapshot('fonts-loaded'); });
const start = performance.now();
const sample = () => {
  snapshot('sample');
  if (performance.now() - start < 14000) setTimeout(sample, performance.now() - start < 5000 ? 100 : 500);
};
setTimeout(sample, 0);
}
