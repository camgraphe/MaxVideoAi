import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { createMockWorkspaceOutput } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-generation';
import { createStarterWorkspaceTemplate } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-templates';

test('mock video generation returns a playable file shipped by the Studio public bundle', () => {
  const template = createStarterWorkspaceTemplate('guided-product-ad');
  const shotNode = template.nodes.find((node) => node.data.kind === 'shot' && node.data.shot);
  assert.ok(shotNode?.data.shot);

  const result = createMockWorkspaceOutput({
    shotNode,
    settings: shotNode.data.shot,
    capability: null,
    nodes: template.nodes,
    edges: template.edges,
  });

  assert.equal(result.output.kind, 'video');
  assert.ok(result.output.url?.startsWith('/'));
  assert.equal(
    existsSync(join(process.cwd(), 'frontend/public', result.output.url.slice(1))),
    true,
    `mock output ${result.output.url} must resolve to a tracked Studio demo instead of a 404`
  );
});
