import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGalleryFixture } from './helpers/gallery-rail-fixture';
import { JSDOM } from 'jsdom';


test('a newer video finishing before an older render keeps its card and DOM position', async () => {
  const script = await buildGalleryFixture();
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', runScripts: 'outside-only' });
  const win = dom.window as unknown as Window & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
    galleryFixture: { act: (fn: () => void) => void; render: () => void; completeNewer: () => void; refresh: () => void; reset: (type?: string) => void; unmount: () => void };
  };
  win.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.HTMLMediaElement.prototype.pause = () => {};
  dom.window.eval(script);
  const fixture = win.galleryFixture;
  const cards = () => Array.from(dom.window.document.querySelectorAll('figure[aria-label="Preview"]'));
  try {
    fixture.act(fixture.render);
    const [newer, older] = cards();
    assert.equal(cards().length, 2);
    assert.match(newer.parentElement!.parentElement!.textContent!, /5s/);
    fixture.act(fixture.completeNewer);
    assert.ok(cards()[0] === newer, 'finishing the newest render must not move its card below older pending renders');
    assert.ok(cards()[1] === older, 'the older card must not move or remount');
    fixture.act(fixture.refresh);
    assert.ok(cards()[0] === newer);
    assert.ok(cards()[1] === older);
  } finally {
    fixture.act(fixture.unmount);
    dom.window.close();
  }
});
