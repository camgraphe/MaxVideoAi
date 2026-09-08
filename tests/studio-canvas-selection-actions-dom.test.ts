import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { DEFAULT_STUDIO_COPY } from '../frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy';
import type { WorkspaceGraphNode } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';

function graphNode(id: string): WorkspaceGraphNode {
  return { id, type: 'note', position: { x: 0, y: 0 }, data: { kind: 'note', title: id } };
}

function renderedText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (!Array.isArray(value)) return '';
  return value.map(renderedText).join('');
}

test('WorkspaceCanvas remounts selection feedback when the selected node set changes', () => {
  const canvas = readFileSync(resolve('frontend/app/(core)/(workspace)/app/studio/workspace/_components/WorkspaceCanvas.client.tsx'), 'utf8');
  assert.match(canvas, /<CanvasSelectionActions\s+key=\{JSON\.stringify\(selectedNodeIds\.slice\(\)\.sort\(\)\)\}/);
});

test('copy feedback belongs to the current selection and the latest attempt', async () => {
  const require = createRequire(import.meta.url);
  const previousCssLoader = require.extensions['.css'];
  require.extensions['.css'] = (module) => { module.exports = {}; };
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, writable: true, value: React });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: {
      addEventListener() {},
      cancelAnimationFrame() {},
      removeEventListener() {},
      requestAnimationFrame(callback: FrameRequestCallback) { callback(0); return 1; },
    },
  });
  const attempts: Array<ReturnType<typeof Promise.withResolvers<boolean>>> = [];
  const onCopy = () => {
    const attempt = Promise.withResolvers<boolean>();
    attempts.push(attempt);
    return attempt.promise;
  };
  let renderer: TestRenderer.ReactTestRenderer | null = null;
  try {
    const { CanvasSelectionActions } = await import('../frontend/app/(core)/(workspace)/app/studio/workspace/_components/canvas/CanvasSelectionActions');
    const render = async (ids: string[]) => {
      const element = React.createElement(CanvasSelectionActions, {
        key: JSON.stringify(ids.slice().sort()),
        nodes: ids.map(graphNode),
        copy: DEFAULT_STUDIO_COPY.canvas.nodes,
        onSettings() {}, onConnections() {}, onCopy, onDelete() {},
      });
      await act(async () => {
        if (renderer) renderer.update(element);
        else renderer = TestRenderer.create(element);
      });
    };
    const copy = async () => {
      const trigger = renderer!.root.findAllByType('button').find(({ props }) => props['aria-haspopup'] === 'menu')!;
      await act(async () => trigger.props.onClick());
      const item = renderer!.root.findAllByType('button')
        .find(({ props }) => props.role === 'menuitem' && renderedText(props.children) === DEFAULT_STUDIO_COPY.canvas.nodes.copySelection)!;
      await act(async () => item.props.onClick());
    };
    const alerts = () => renderer!.root.findAll(({ props }) => props.role === 'alert');

    await render(['a|b']);
    await copy();
    const delimiterAttempt = attempts.at(-1)!;
    await render(['a', 'b']);
    await act(async () => delimiterAttempt.resolve(false));
    assert.equal(alerts().length, 0, 'injectively distinct selection sets cannot share late feedback');

    await render(['A']);
    await copy();
    const firstSelectionAttempt = attempts.at(-1)!;
    await render(['B']);
    await act(async () => firstSelectionAttempt.resolve(false));
    assert.equal(alerts().length, 0, 'late A failure cannot pollute B');

    await copy();
    const olderAttempt = attempts.at(-1)!;
    await copy();
    const newerAttempt = attempts.at(-1)!;
    await act(async () => newerAttempt.resolve(true));
    await act(async () => olderAttempt.resolve(false));
    assert.equal(alerts().length, 0, 'older B failure cannot overwrite newer success');

    await copy();
    const rejectedAttempt = attempts.at(-1)!;
    let rejection: unknown;
    try {
      await act(async () => rejectedAttempt.reject(new Error('clipboard denied')));
    } catch (error) {
      rejection = error;
    }
    assert.equal(rejection, undefined, 'clipboard rejection is absorbed by the feedback owner');
    assert.match(renderedText(alerts()[0]?.props.children), /Copy blocked/);
    const trigger = renderer!.root.findAllByType('button').find(({ props }) => props['aria-haspopup'] === 'menu')!;
    await act(async () => trigger.props.onClick());
    assert.equal(alerts().length, 0, 'reopening Actions clears feedback');

    await render([]);
    await render(['B']);
    assert.equal(alerts().length, 0, 'clearing selection resets feedback');
  } finally {
    if (renderer) await act(async () => renderer?.unmount());
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (previousReact) Object.defineProperty(globalThis, 'React', previousReact);
    else Reflect.deleteProperty(globalThis, 'React');
    if (previousCssLoader) require.extensions['.css'] = previousCssLoader;
    else delete require.extensions['.css'];
  }
});
