import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { installGalleryDiagnostic } from './instrumentation.mjs';

test('periodic observations survive execution before the HTML element exists', () => {
  const timers = [];
  const window = {};
  const sandbox = {
    window, innerWidth: 1350, innerHeight: 940,
    document: { documentElement: null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} },
    performance: { now: () => 0 }, Element: class {},
    PerformanceObserver: class { observe() {} }, ResizeObserver: class { observe() {} },
    MutationObserver: class { observe() {} }, setTimeout: fn => { timers.push(fn); },
  };
  runInNewContext(`(${installGalleryDiagnostic.toString()})()`, sandbox);
  assert.equal(timers.length, 1);
  timers.shift()();
  assert.equal(timers.length, 1, 'sampling must schedule the next observation');
  assert.equal(window.__galleryDiagnostic[0].type, 'geometry');
  assert.equal(window.__galleryDiagnostic[0].viewport.clientWidth, null);
});
