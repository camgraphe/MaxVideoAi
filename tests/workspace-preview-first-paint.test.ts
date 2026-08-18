import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import { WorkspacePreviewColumn } from '../frontend/components/groups/WorkspacePreviewColumn.tsx';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test('workspace preview width constraints are present in the first rendered markup', () => {
  const markup = renderToStaticMarkup(
    React.createElement(
      WorkspacePreviewColumn,
      null,
      React.createElement('div', { 'data-preview-child': true })
    )
  );

  assert.match(markup, /data-workspace-preview-column="true"/);
  assert.match(markup, /--workspace-preview-fluid-width/);
  assert.match(markup, /width:min\(100%,max\(1\.778px,var\(--workspace-preview-fluid-width\)\),583\.111px\)/);
  assert.match(markup, /data-preview-child="true"/);
});
