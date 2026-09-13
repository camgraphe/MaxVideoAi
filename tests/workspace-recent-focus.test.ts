import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { focusWorkspaceRecentTarget } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-recent-focus';

test('Recents focus and return reveal the destination below measured sticky chrome without intermediate native scrolling', () => {
  const dom = new JSDOM('<div class="app-experience"><header class="app-connected-header"></header><nav class="app-navigation-activities"></nav><div class="app-creation-heading"><button id="opener">Recents</button></div><div id="panel" tabindex="-1"><button>Close</button></div></div>');
  const document = dom.window.document;
  const rect = (element: Element, top: number, height: number) => {
    element.getBoundingClientRect = () => ({ top, height }) as DOMRect;
  };
  rect(document.querySelector('header')!, 0, 68);
  rect(document.querySelector('nav')!, 68, 59);
  const panel = document.getElementById('panel')!;
  const opener = document.getElementById('opener')!;
  const heading = document.querySelector<HTMLElement>('.app-creation-heading')!;
  rect(panel, 1028, 700);
  rect(heading, 180, 44);
  const focusCalls: FocusOptions[] = [];
  panel.focus = (options) => { focusCalls.push(options!); };
  opener.focus = (options) => { focusCalls.push(options!); };
  const scrollCalls: ScrollToOptions[] = [];
  dom.window.scrollTo = ((options: ScrollToOptions) => { scrollCalls.push(options); }) as typeof dom.window.scrollTo;
  try {
    focusWorkspaceRecentTarget(panel);
    assert.deepEqual(focusCalls[0], { preventScroll: true });
    assert.deepEqual(scrollCalls[0], { top: 889, behavior: 'instant' });
    assert.equal(1028 - scrollCalls[0].top!, 139, 'panel Close starts 12px below both sticky bars');
    Object.defineProperty(dom.window, 'scrollY', { value: 889 });
    rect(heading, -709, 44);
    focusWorkspaceRecentTarget(opener, heading);
    assert.deepEqual(focusCalls[1], { preventScroll: true });
    assert.deepEqual(scrollCalls[1], { top: 41, behavior: 'instant' });
    assert.equal(180 - scrollCalls[1].top!, 139, 'return reveals the creation heading, not just the focused button');
    rect(document.querySelector('nav')!, 68, 110);
    focusWorkspaceRecentTarget(panel);
    assert.equal(scrollCalls[2].top, 1727, 'wrapped navigation height is measured rather than assumed');
    focusWorkspaceRecentTarget(null);
    assert.equal(scrollCalls.length, 3);
  } finally {
    dom.window.close();
  }
});
