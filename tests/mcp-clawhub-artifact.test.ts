import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { getMcpIntegration } from '../frontend/lib/mcp-integration-registry';

const root = 'distribution/clawhub/maxvideoai';

function read(path: string): string {
  assert.equal(existsSync(path), true, `${path} should exist`);
  return readFileSync(path, 'utf8');
}

test('the ClawHub candidate is a thin credential-free remote MCP guide', () => {
  const skill = read(`${root}/SKILL.md`);
  const safety = read(`${root}/references/safe-generation.md`);
  const ignored = read(`${root}/.clawhubignore`);
  const artifact = `${skill}\n${safety}`;

  assert.match(skill, /^---\nname: maxvideoai\ndescription: .+\n---\n/);
  assert.match(artifact, /https:\/\/api\.maxvideoai\.com\/mcp/);
  for (const boundary of [
    'list_models',
    'calculate_project_budget',
    'prepare_generation',
    'confirm_generation',
    'get_generation_status',
  ]) {
    assert.match(artifact, new RegExp(boundary));
  }
  assert.match(artifact, /explicit approval/i);
  assert.match(artifact, /recover.*accepted job/is);
  assert.doesNotMatch(artifact, /api[_ -]?key|client[_ -]?secret|bearer\s+[a-z0-9]/i);
  assert.doesNotMatch(artifact, /curl\s|npm\s+(?:install|i)|pnpm\s+(?:add|install)|\$\d|\d+ models/i);
  assert.match(ignored, /evidence/);
  assert.match(ignored, /operations/);
  assert.equal(getMcpIntegration('openclaw').store.status, 'listed');
  assert.equal(getMcpIntegration('openclaw').installation.package, 'available');
});

test('the ClawHub listing documents exact files and keeps later publishing owner-controlled', () => {
  const guide = read('docs/operations/mcp-distribution-artifacts.md');
  for (const file of [
    'distribution/clawhub/maxvideoai/SKILL.md',
    'distribution/clawhub/maxvideoai/references/safe-generation.md',
    'distribution/clawhub/maxvideoai/.clawhubignore',
  ]) {
    assert.match(guide, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(guide, /MIT-0/);
  assert.match(guide, /clawhub@0\.23\.3/);
  assert.match(guide, /--dry-run/);
  assert.match(guide, /fileCount: 2/);
  assert.match(guide, /d7cca882cf7561fcc8bc83d3f5c130d060beb132bfab98871ed219ccfbfa79dd/);
  assert.match(guide, /\.clawhubignore[\s\S]*packaging control[\s\S]*not a published payload file/i);
  assert.match(guide, /install.*update.*uninstall/is);
  assert.match(guide, /explicit\s+owner authorization/i);
  assert.match(guide, /https:\/\/clawhub\.ai\/camgraphe\/skills\/maxvideoai/);
  assert.doesNotMatch(guide, /clawhub\.ai\/skills\/skills\/maxvideoai/);
  assert.match(guide, /@camgraphe/);
  assert.match(guide, /scanner\.llm\.clean/);
  assert.match(guide, /skillspector[\s\S]*three heuristic findings/i);
});
