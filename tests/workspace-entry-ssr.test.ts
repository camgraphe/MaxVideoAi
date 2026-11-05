import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { build } from 'esbuild';
import { createElement, type ComponentType } from 'react';
import { renderToPipeableStream } from 'react-dom/server';

test('direct video entry sends one selected preview before the editor loads', async () => {
  const frontend = resolve('frontend');
  const stubs = new Map([
    ['./_hooks/useWorkspaceAppBootstrap', 'export const useWorkspaceAppBootstrap = () => ({});'],
    ['./_components/WorkspaceBootSurface', `
      let pending = true;
      export function WorkspaceBootSurface({initialPreviewGroup}) {
        if (pending) {
          pending = false;
          // The request-bound navigation can suspend during the first render.
          throw new Promise(resolve => setTimeout(resolve, 10));
        }
        return <img alt="" src={initialPreviewGroup.items[0].thumb} />;
      }`],
    ['./AppClient', 'export default function Editor() { return <main>Editor mounted</main>; }'],
  ]);
  const result = await build({
    absWorkingDir: frontend,
    entryPoints: ['./app/(core)/(workspace)/app/WorkspaceEntry.tsx'],
    platform: 'node', format: 'cjs', bundle: true, write: false,
    packages: 'external', tsconfig: resolve(frontend, 'tsconfig.json'), jsx: 'automatic',
    plugins: [{ name: 'workspace-entry-fixture', setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path }) => stubs.has(path) ? { path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: stubs.get(path), loader: 'tsx', resolveDir: frontend }));
    } }],
  });
  type Preview = { items: { thumb: string }[] };
  const module = { exports: {} as { default: ComponentType<{ initialPreviewGroup: Preview }> } };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(
    createRequire(resolve(frontend, 'package.json')), module, module.exports,
  );
  const element = createElement(module.exports.default, { initialPreviewGroup: { items: [{ thumb: '/personal-poster.jpg' }] } });
  const html = await new Promise<string>((done, reject) => {
    const output = new PassThrough();
    let rendered = '';
    output.setEncoding('utf8').on('data', chunk => { rendered += chunk; }).on('end', () => done(rendered));
    const stream = renderToPipeableStream(element, {
      onShellReady: () => stream.pipe(output),
      onError: reject,
    });
  });
  assert.match(html, /<img[^>]+src="\/personal-poster\.jpg"/);
  assert.equal((html.match(/<img\b/g) ?? []).length, 1);
  assert.doesNotMatch(html, /Editor mounted|<template id="B:/, 'the editor must not replace the server-rendered preview');
});
