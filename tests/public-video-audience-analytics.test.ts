import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createVercelAnalyticsBeforeSend } from '../frontend/lib/analytics/vercel-context';
import { projectPublicVideoAnalyticsPath } from '../frontend/lib/analytics/public-video';
import { buildAnalyticsPageContext } from '../frontend/lib/analytics/page-context';

const approved = { seoStatus: 'approved', indexable: true, canonicalSlug: 'wan-cinematic-flight', canonicalUrl: 'https://maxvideoai.com/video/wan-cinematic-flight' };
test('only approved indexable canonical public slugs become identifiable', () => {
  assert.equal(projectPublicVideoAnalyticsPath(approved), '/video/wan-cinematic-flight');
  for (const change of [{ seoStatus: 'draft' }, { indexable: false }, { canonicalSlug: null }, { canonicalUrl: 'https://evil.test/video/wan-cinematic-flight' }, { canonicalUrl: 'https://maxvideoai.com/video/private-id' }, { canonicalSlug: 'job_123' }]) {
    assert.equal(projectPublicVideoAnalyticsPath({ ...approved, ...change }), null);
  }
  assert.equal(buildAnalyticsPageContext('https://api.maxvideoai.com/app/studio'), null);
});

test('async readers get one qualified view, navigation gets a fresh view, private videos stay masked', () => {
  const dom = new JSDOM('', { url: approved.canonicalUrl });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  try {
    dom.window.localStorage.setItem('mv-consent-analytics', 'granted');
    const send = createVercelAnalyticsBeforeSend();
    const event = { type: 'pageview' as const, url: `${approved.canonicalUrl}?token=secret` };
    assert.equal(send(event), null, 'wait for the reader instead of recording an anonymous placeholder');
    const marker = dom.window.document.createElement('span');
    marker.dataset.videoWatchPath = '/video/wan-cinematic-flight';
    marker.dataset.videoAnalyticsPath = '/video/wan-cinematic-flight';
    dom.window.document.body.append(marker);
    assert.equal(send(event)?.url, approved.canonicalUrl);
    assert.equal(send(event), null, 'automatic and explicit pageview must not double count');
    assert.equal(send({ ...event, type: 'event' })?.url, approved.canonicalUrl, 'plays remain allowed after the view');
    dom.window.localStorage.removeItem('mv-consent-analytics');
    assert.equal(send({ ...event, type: 'event' }), null, 'revoked consent blocks queued custom events at delivery');
    dom.window.history.pushState(null, '', '/video/another-video');
    assert.equal(send({ ...event, url: dom.window.location.href }), null, 'old detail cannot identify the new route');
    marker.remove();
    const next = marker.cloneNode() as HTMLElement;
    next.dataset.videoWatchPath = '/video/another-video';
    next.dataset.videoAnalyticsPath = '';
    dom.window.document.body.append(next);
    assert.equal(send({ ...event, url: dom.window.location.href })?.url, 'https://maxvideoai.com/video/:video');
    next.remove();
    dom.window.history.pushState(null, '', '/video/wan-cinematic-flight');
    dom.window.document.body.append(marker.cloneNode());
    assert.equal(send(event)?.url, approved.canonicalUrl, 'reopening the same video counts a new open');
  } finally {
    dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});

test('legacy ID navigation resolves to the approved slug without losing unapproved aggregate views', () => {
  const dom = new JSDOM('<span data-video-watch-path="/video/editorial-slug" data-video-watch-id-path="/video/job_123" data-video-analytics-path=""></span>', { url: 'https://maxvideoai.com/video/job_123' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  try {
    const event = { type: 'pageview' as const, url: dom.window.location.href };
    assert.equal(createVercelAnalyticsBeforeSend()(event)?.url, 'https://maxvideoai.com/video/:video');
    dom.window.document.querySelector('span')!.dataset.videoAnalyticsPath = '/video/editorial-slug';
    assert.equal(createVercelAnalyticsBeforeSend()(event)?.url, 'https://maxvideoai.com/video/editorial-slug');
  } finally {
    dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});

test('a queued play cannot be attributed to a different video after navigation', () => {
  const dom = new JSDOM('<span data-video-watch-path="/video/second-public-video" data-video-analytics-path="/video/second-public-video"></span>', { url: 'https://maxvideoai.com/video/second-public-video' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  try {
    dom.window.localStorage.setItem('mv-consent-analytics', 'granted');
    const send = createVercelAnalyticsBeforeSend();
    const event = { type: 'event' as const, url: dom.window.location.href,
      payload: { name: 'public_video_play', data: { video_slug: 'first-public-video', surface: 'watch' } } };
    assert.equal(send(event), null);
    assert.ok(send({ ...event, payload: { ...event.payload, data: { ...event.payload.data, video_slug: 'second-public-video' } } }));
  } finally {
    dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
