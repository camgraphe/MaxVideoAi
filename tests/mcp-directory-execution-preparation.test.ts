import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const evidence = readFileSync('docs/marketing/mcp-directory-submissions.md', 'utf8');
const releaseNote = readFileSync('docs/operations/mcp-main-repository-release-v0.3.3.md', 'utf8');

const checklist = evidence.match(
  /### Task 15 source-preparation execution checklist — 2026-09-14[\s\S]*?(?=\n### Observed public records)/,
)?.[0] ?? '';

function row(surface: string): string {
  return checklist
    .split('\n')
    .find((line) => line.startsWith(`| ${surface} |`)) ?? '';
}

test('Task 15 checklist keeps every unexecuted external action in a non-completion state', () => {
  assert.ok(checklist, 'missing dated Task 15 source-preparation checklist');

  const expectedStates = new Map([
    ['Main `camgraphe/MaxVideoAi` GitHub release', 'ready_to_execute'],
    ['Canonical `camgraphe/maxvideoai-plugin` release', 'verified'],
    ['n8n workflow library', 'identity_step_required'],
    ['GitHub MCP registry discovery', 'unavailable_no_documented_submission'],
    ['MCPBeat owner claim', 'identity_step_required'],
    ['Glama owner claim', 'identity_step_required'],
    ['Docker MCP Catalog', 'blocked_by_license'],
  ]);

  for (const [surface, state] of expectedStates) {
    const currentRow = row(surface);
    assert.ok(currentRow, `missing Task 15 row: ${surface}`);
    assert.match(currentRow, new RegExp('\\| `' + state + '` \\|'));
  }

  for (const surface of [
    'Main `camgraphe/MaxVideoAi` GitHub release',
    'n8n workflow library',
    'GitHub MCP registry discovery',
    'MCPBeat owner claim',
    'Glama owner claim',
    'Docker MCP Catalog',
  ]) {
    assert.doesNotMatch(row(surface), /\| `(?:submitted|claimed|verified)` \|/);
  }
});

test('release preparation preserves the canonical artifact owner and latest-release correction boundary', () => {
  const mainRelease = row('Main `camgraphe/MaxVideoAi` GitHub release');
  const canonicalRelease = row('Canonical `camgraphe/maxvideoai-plugin` release');

  assert.match(mainRelease, /https:\/\/github\.com\/camgraphe\/MaxVideoAi\/releases\/latest/);
  assert.match(mainRelease, /maxvideoai-plugin-v0\.2\.0/);
  assert.match(mainRelease, /maxvideoai-plugin-v0\.3\.3/);
  assert.match(canonicalRelease, /https:\/\/github\.com\/camgraphe\/maxvideoai-plugin\/releases\/tag\/v0\.3\.3/);
  assert.match(canonicalRelease, /installation artifact owner/i);

  assert.match(releaseNote, /installable archives and their SHA-256\s+checksums remain owned by the canonical plugin release/i);
  assert.match(checklist, /gh release create maxvideoai-plugin-v0\.3\.3/);
  assert.match(checklist, /--verify-tag/);
  assert.match(checklist, /--latest/);
  assert.match(checklist, /Pass no asset paths/i);
  assert.doesNotMatch(releaseNote, /Controller-only|source-preparation task|gh release create/);
  assert.doesNotMatch(releaseNote, /gh release upload|\.zip\s|\.sha256\s/);
});

test('n8n preparation pins all three reviewed candidates without claiming a library submission', () => {
  const candidates = new Map([
    ['distribution/n8n/brief-to-approved-generation.json', '8c26ac349a4d89f59565bbbed9aa94fbcece72a2667d3e1f9728f98d8792ee0a'],
    ['distribution/n8n/campaign-queue.json', '1f84f8abc68c8f9ca8034ec52b7d4d3814311b8ff407f040b8af1e302b44799d'],
    ['distribution/n8n/completion-notification.json', '1c72336bdc40156894817232a56167e4f94ef28ce971f14632aab458fad96eed'],
  ]);

  for (const [path, digest] of candidates) {
    assert.match(checklist, new RegExp(
      '\\| `' + path + '` \\| `' + digest + '` \\| `ready_to_execute` \\|',
    ));
  }

  const n8n = row('n8n workflow library');
  assert.match(n8n, /https:\/\/n8n\.io\/workflows\//);
  assert.match(n8n, /https:\/\/creators\.n8n\.io\//);
  assert.match(n8n, /one workflow submission at a time/i);
  assert.match(n8n, /has no MaxVideoAI submission/i);
  assert.match(checklist, /deterministic self-hosted MCP Client evidence is\s+public and indexable/i);
  assert.match(checklist, /MCP Client Tool invocation[\s\S]{0,180}n8n Cloud[\s\S]{0,220}outside the claim/i);
});

test('GitHub, MCPBeat, Glama, and Docker caveats require observed evidence before promotion', () => {
  const github = row('GitHub MCP registry discovery');
  const mcpbeat = row('MCPBeat owner claim');
  const glama = row('Glama owner claim');
  const docker = row('Docker MCP Catalog');

  assert.match(github, /api\.mcp\.github\.com\/v0\.1\/servers\?search=maxvideoai/);
  assert.match(github, /no third-party submission control/i);
  assert.match(github, /Official MCP Registry record is not substitute evidence/i);

  assert.match(mcpbeat, /https:\/\/mcpbeat\.com\/mcp-servers\/maxvideoai\/maxvideoai\//);
  assert.match(mcpbeat, /identity|sign-in/i);
  assert.match(mcpbeat, /did not always answer/i);
  assert.match(glama, /https:\/\/glama\.ai\/mcp\/connectors\/com\.maxvideoai\/maxvideoai/);
  assert.match(glama, /`Unhealthy`/);
  assert.match(glama, /`Works in Glama`/);

  assert.match(docker, /github\.com\/docker\/mcp-registry\/blob\/main\/CONTRIBUTING\.md/);
  assert.match(docker, /Business Source License 1\.1/);
  assert.match(docker, /Do not fork, create catalog files, open a PR, or relicense/i);
});
