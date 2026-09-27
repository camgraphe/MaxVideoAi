import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { buildGalleryRenderFixture } from './helpers/gallery-rail-render-fixture';

const script = buildGalleryRenderFixture();
async function harness(count = 24) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', runScripts: 'outside-only' });
  const win = dom.window;
  const probe = {
    counts: { GalleryRail: 0, GalleryRailCards: 0, GroupedJobCard: 0, GroupedJobCardPreviewGrid: 0 },
    cards: {} as Record<string, { group: { count: number; members: { status: string; progress: number; videoUrl: string }[] }; engine: { brandId?: string } }>,
    actions: [] as { version: number; id: string; action: string }[], pageRequests: 0,
  };
  const observers: { callback: (entries: unknown[]) => void; target?: Element }[] = [];
  Object.assign(win, { IS_REACT_ACT_ENVIRONMENT: true, process: { env: {} }, galleryProbe: probe,
    IntersectionObserver: class {
      entry: typeof observers[number];
      constructor(callback: (entries: unknown[]) => void) { this.entry = { callback }; observers.push(this.entry); }
      observe(target: Element) { this.entry.target = target; }
      disconnect() { this.entry.target = undefined; }
    },
  });
  win.HTMLMediaElement.prototype.pause = () => {};
  win.HTMLMediaElement.prototype.load = () => {};
  win.HTMLMediaElement.prototype.play = async () => {};
  win.eval(await script);
  const fixture = (win as unknown as { galleryFixture: {
    act: (fn: () => void) => void; reset: (count: number) => void; render: () => void;
    select: (id: string) => void; locale: (locale: string) => void; callback: () => void;
    registry: () => void; job: (index: number, patch: Record<string, unknown>) => void;
    append: () => void; addMember: () => void; loading: (value: boolean) => void; unmount: () => void;
  } }).galleryFixture;
  const run = (fn: () => void) => fixture.act(fn);
  run(() => fixture.reset(count));
  return { dom, win, fixture, probe, run, observers,
    clear() { for (const key of Object.keys(probe.counts) as (keyof typeof probe.counts)[]) probe.counts[key] = 0; },
    figures() { return [...win.document.querySelectorAll('figure')]; },
    type() { const input = win.document.querySelector('textarea')!; input.value += 'a'; run(() => input.dispatchEvent(new win.Event('input', { bubbles: true }))); },
    close() { run(() => fixture.unmount()); win.close(); },
  };
}

for (const count of [24, 72]) {
  test(`settled ${count}-card feed skips card work for five owner prompt inputs`, async () => {
    const h = await harness(count);
    try {
      assert.equal(h.figures().length, count);
      for (let i = 0; i < 5; i++) {
        h.clear(); h.type();
        assert.equal(h.probe.counts.GalleryRail, 1, 'the real calling rail still renders');
        assert.equal(h.probe.counts.GalleryRailCards, 0);
        assert.equal(h.probe.counts.GroupedJobCard, 0);
        assert.equal(h.probe.counts.GroupedJobCardPreviewGrid, 0);
      }
      assert.equal(h.win.document.querySelector('textarea')?.value, 'aaaaa');
    } finally { h.close(); }
  });
}

test('selection, locale, registry and replaced callbacks remain current through the rail owner', async () => {
  const h = await harness();
  try {
    const first = h.figures()[0];
    h.run(() => h.fixture.select('group-1'));
    assert.equal(h.figures().filter(node => node.getAttribute('aria-pressed') === 'true').length, 1);
    assert.equal(h.figures()[1].getAttribute('aria-pressed'), 'true');
    h.run(() => h.fixture.locale('fr'));
    assert.equal(h.figures()[0].getAttribute('aria-label'), 'Aperçu');
    h.run(() => h.fixture.locale('es'));
    assert.equal(h.figures()[0].getAttribute('aria-label'), 'Vista previa');
    h.run(() => h.fixture.registry());
    assert.equal(h.probe.cards['group-0'].engine.brandId, 'openai');
    h.run(() => h.figures()[0].dispatchEvent(new h.win.MouseEvent('click', { bubbles: true })));
    h.run(() => h.fixture.callback());
    h.run(() => h.figures()[0].dispatchEvent(new h.win.MouseEvent('click', { bubbles: true })));
    assert.deepEqual(h.probe.actions.map(action => action.version), [0, 1]);
    assert.equal(h.probe.actions[1].action, 'open');
    assert.equal(h.figures()[0], first);
  } finally { h.close(); }
});

test('job progress, completion, new pages, members and loading still reach existing cards', async () => {
  const h = await harness();
  try {
    const first = h.figures()[0];
    h.run(() => h.fixture.job(0, { status: 'pending', progress: 25, videoUrl: null, message: 'IN_PROGRESS' }));
    assert.equal(h.probe.cards['group-0'].group.members[0].status, 'pending');
    h.run(() => h.fixture.job(0, { progress: 65 }));
    assert.equal(h.probe.cards['group-0'].group.members[0].progress, 65);
    h.run(() => h.fixture.job(0, { status: 'completed', videoUrl: 'https://fixture.invalid/replaced.mp4' }));
    assert.equal(h.probe.cards['group-0'].group.members[0].status, 'completed');
    assert.equal(h.probe.cards['group-0'].group.members[0].videoUrl, 'https://fixture.invalid/replaced.mp4');
    const sentinel = h.observers.find(observer => observer.target?.classList.contains('app-gallery-rail-sentinel'))!;
    assert.ok(sentinel);
    h.run(() => sentinel.callback([{ isIntersecting: true, boundingClientRect: { y: 20 }, intersectionRatio: 1 }]));
    assert.equal(h.probe.pageRequests, 1);
    h.run(() => h.fixture.loading(true));
    assert.equal(h.win.document.querySelectorAll('.skeleton').length, 2);
    h.run(() => h.fixture.loading(false));
    assert.equal(h.win.document.querySelectorAll('.skeleton').length, 0);
    h.run(() => h.fixture.append());
    assert.equal(h.figures().length, 25);
    h.run(() => h.fixture.addMember());
    assert.equal(h.probe.cards['group-0'].group.count, 2);
    assert.equal(h.figures()[0], first);
    assert.match(first.parentElement!.textContent!, /×2/);
  } finally { h.close(); }
});

test('scrollbar updates skip cards while local card focus and menus remain interactive', async () => {
  const h = await harness();
  try {
    const scroller = h.win.document.querySelector<HTMLElement>('.app-gallery-rail-grid')!;
    Object.defineProperties(scroller, { scrollHeight: { value: 1500 }, clientHeight: { value: 500 } });
    h.run(() => h.win.dispatchEvent(new h.win.Event('resize')));
    h.clear(); scroller.scrollTop = 250;
    h.run(() => scroller.dispatchEvent(new h.win.Event('scroll')));
    assert.ok(h.probe.counts.GalleryRail > 0);
    assert.equal(h.probe.counts.GroupedJobCard, 0);
    assert.ok(h.win.document.querySelector('[style*="translateY(113px)"]'), 'scrollbar moves to the new scroll position');
    const button = h.win.document.querySelector<HTMLButtonElement>('button[aria-label="Reuse"]')!;
    h.run(() => button.click());
    assert.equal(button.getAttribute('aria-expanded'), 'true');
    h.type();
    assert.equal(button.getAttribute('aria-expanded'), 'true', 'unrelated owner input preserves an open menu');
    h.run(() => h.win.document.dispatchEvent(new h.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(button.getAttribute('aria-expanded'), 'false');
    h.clear(); h.run(() => (h.figures()[0] as HTMLElement).focus());
    assert.ok(h.probe.counts.GroupedJobCard > 0, 'card local focus state still renders below the memo boundary');
  } finally { h.close(); }
});
