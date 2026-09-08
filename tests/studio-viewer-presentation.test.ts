import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from '../frontend/node_modules/react-dom/server';
import { JSDOM } from 'jsdom';
import { DEFAULT_STUDIO_COPY } from '../frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy';

const programControlProps = {
  copy: DEFAULT_STUDIO_COPY.viewer.controls,
  canGoToNextCut: true,
  canGoToPreviousCut: true,
  hasVisiblePlayableLayer: true,
  inTimecode: '00:00:01:00',
  isPlaying: false,
  outTimecode: '00:00:04:00',
  playheadSec: 2,
  playheadTimecode: '00:00:02:00',
  timelineDurationSec: 8,
  timelineDurationTimecode: '00:00:08:00',
  onClearInOut() {},
  onGoToNextCut() {},
  onGoToPreviousCut() {},
  onMarkIn() {},
  onMarkOut() {},
  onSendSnapshotToCanvas() {},
  onTogglePlayback() {},
};

test('program HUD only offers Clear for active marks and keeps Snapshot icon-led', async () => {
  const require = createRequire(import.meta.url);
  const previousCssLoader = require.extensions['.css'];
  const previousReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, writable: true, value: React });
  require.extensions['.css'] = (module) => { module.exports = new Proxy({}, { get: (_, key) => key === '__esModule' ? false : key }); };
  try {
    const { ProgramControls } = await import('../frontend/app/(core)/(workspace)/app/studio/workspace/_components/viewer/ProgramControls');
    const withoutMarks = renderToStaticMarkup(React.createElement(ProgramControls, { ...programControlProps, hasInOutMarks: false }));
    const withMarks = renderToStaticMarkup(React.createElement(ProgramControls, { ...programControlProps, hasInOutMarks: true }));
    assert.doesNotMatch(withoutMarks, />Clear</, 'Clear should not consume HUD space before an In or Out mark exists');
    assert.match(withMarks, />Clear</, 'Clear should become available as soon as a mark exists');
    const snapshotButton = withoutMarks.match(/<button[^>]*aria-label="Send snapshot to canvas"[\s\S]*?<\/button>/)?.[0] ?? '';
    assert.match(snapshotButton, /<svg/, 'Snapshot should lead with the camera icon');
    assert.doesNotMatch(snapshotButton, />Snapshot</, 'Snapshot should not add a persistent text label to the compact HUD');
  } finally {
    if (previousReact) Object.defineProperty(globalThis, 'React', previousReact); else Reflect.deleteProperty(globalThis, 'React');
    if (previousCssLoader) require.extensions['.css'] = previousCssLoader; else delete require.extensions['.css'];
  }
});

test('desktop viewer panels collapse independently and Escape restores the pre-focus layout', async () => {
  const require = createRequire(import.meta.url);
  const previousCssLoader = require.extensions['.css'];
  require.extensions['.css'] = (module) => { module.exports = new Proxy({}, { get: (_, key) => key === '__esModule' ? false : key }); };
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app/studio/workspace', pretendToBeVisual: true });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node,
    KeyboardEvent: dom.window.KeyboardEvent, React, IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const root = createRoot(dom.window.document.getElementById('root')!);
  const { WorkspaceViewerPanelControls } = await import('../frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceViewerPanelControls');
  let panels!: import('../frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceViewerPanels').WorkspaceViewerPanels;
  function Probe() {
    const { useWorkspaceViewerPanels } = require('../frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceViewerPanels') as typeof import('../frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceViewerPanels');
    panels = useWorkspaceViewerPanels(true);
    return React.createElement(React.Fragment, {},
      React.createElement('output', {}, `${panels.mediaVisible}:${panels.inspectorVisible}:${panels.isViewerFocused}`),
      React.createElement(WorkspaceViewerPanelControls, { copy: DEFAULT_STUDIO_COPY.viewer.controls, panels }));
  }
  try {
    await act(async () => root.render(React.createElement(Probe)));
    assert.equal(dom.window.document.querySelector('output')?.textContent, 'true:true:false');
    await act(async () => dom.window.document.querySelector<HTMLButtonElement>('[aria-label="Hide Project media"]')?.click());
    assert.equal(dom.window.document.querySelector('output')?.textContent, 'false:true:false', 'media closes without changing inspector visibility');
    await act(async () => dom.window.document.querySelector<HTMLButtonElement>('[aria-label="Focus viewer"]')?.click());
    assert.equal(dom.window.document.querySelector('output')?.textContent, 'false:false:true', 'viewer focus collapses both desktop panels');
    assert.equal(dom.window.document.querySelectorAll('nav button').length, 1, 'focused viewer keeps only its explicit exit control');
    await act(async () => dom.window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' })));
    assert.equal(dom.window.document.querySelector('output')?.textContent, 'false:true:false', 'Escape restores exactly the layout visible before focus');
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
    if (previousCssLoader) require.extensions['.css'] = previousCssLoader; else delete require.extensions['.css'];
  }
});

test('viewer presentation keeps desktop hit targets reachable without changing mobile drawers', () => {
  const viewerCss = readFileSync(new URL('../frontend/app/(core)/(workspace)/app/studio/workspace/_styles/viewer.module.css', import.meta.url), 'utf8');
  const shellCss = readFileSync(new URL('../frontend/app/(core)/(workspace)/app/studio/workspace/_styles/shell.module.css', import.meta.url), 'utf8');
  const layout = readFileSync(new URL('../frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceEditorLayout.tsx', import.meta.url), 'utf8');
  assert.match(viewerCss, /\.viewerPlaybackControls button\s*\{[\s\S]*?min-width:\s*44px;[\s\S]*?min-height:\s*44px;/, 'program HUD buttons need 44px pointer targets');
  assert.match(shellCss, /@media\s*\(min-width:\s*1121px\)[\s\S]*?\.viewerPanelToggle/, 'desktop collapse controls should not replace mobile panel controls');
  assert.match(layout, /useWorkspaceMobilePanels/, 'existing mobile drawer behavior must remain wired');
  assert.match(layout, /useWorkspaceViewerPanels/, 'desktop presentation state should stay in its focused session-local hook');
});
