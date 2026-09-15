import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';

const evidence = readFileSync('docs/marketing/mcp-directory-submissions.md', 'utf8');
const releaseNote = readFileSync('docs/operations/mcp-main-repository-release-v0.3.3.md', 'utf8');

const checklist = evidence.match(
  /### Task 15 observed external execution checklist — 2026-09-15[\s\S]*?(?=\n### Observed public records)/,
)?.[0] ?? '';

function row(surface: string): string {
  return checklist
    .split('\n')
    .find((line) => line.startsWith(`| ${surface} |`)) ?? '';
}

test('Task 15 checklist advances only externally observed distribution results', () => {
  assert.ok(checklist, 'missing dated Task 15 observed-results checklist');

  const expectedStates = new Map([
    ['Main `camgraphe/MaxVideoAi` GitHub release', 'verified'],
    ['Canonical `camgraphe/maxvideoai-plugin` release', 'verified'],
    ['n8n workflow library', 'submitted'],
    ['GitHub MCP registry discovery', 'unavailable_no_documented_submission'],
    ['MCPBeat owner claim', 'claimed'],
    ['Glama owner claim', 'claimed'],
    ['Docker MCP Catalog', 'blocked_by_license'],
  ]);

  for (const [surface, state] of expectedStates) {
    const currentRow = row(surface);
    assert.ok(currentRow, `missing Task 15 row: ${surface}`);
    assert.match(currentRow, new RegExp('\\| `' + state + '` \\|'));
  }

  for (const surface of [
    'GitHub MCP registry discovery',
    'Docker MCP Catalog',
  ]) {
    assert.doesNotMatch(row(surface), /\| `(?:submitted|claimed|verified)` \|/);
  }
});

test('release preparation preserves the canonical artifact owner and latest-release correction boundary', () => {
  const mainRelease = row('Main `camgraphe/MaxVideoAi` GitHub release');
  const canonicalRelease = row('Canonical `camgraphe/maxvideoai-plugin` release');

  assert.match(mainRelease, /https:\/\/api\.github\.com\/repos\/camgraphe\/MaxVideoAi\/releases\/latest/);
  assert.match(mainRelease, /maxvideoai-plugin-v0\.3\.3/);
  assert.match(mainRelease, /created from the existing tag on 2026-09-14/i);
  assert.match(mainRelease, /public, non-draft, and non-prerelease/i);
  assert.match(mainRelease, /zero uploaded assets/i);
  assert.match(mainRelease, /latest-release API.*resolves to that tag/i);
  assert.match(canonicalRelease, /https:\/\/github\.com\/camgraphe\/maxvideoai-plugin\/releases\/tag\/v0\.3\.3/);
  assert.match(canonicalRelease, /installation artifact owner/i);
  assert.match(canonicalRelease, /one installable ZIP and its SHA-256 checksum/i);
  assert.match(canonicalRelease, /two source archives.*generated automatically by GitHub/i);

  assert.match(releaseNote, /one installable ZIP and its SHA-256\s+checksum remain owned by the canonical plugin release/i);
  assert.match(releaseNote, /two source archives.*generated automatically by GitHub/is);
  assert.match(checklist, /No asset paths were passed/i);
  assert.doesNotMatch(releaseNote, /Controller-only|source-preparation task|gh release create/);
  assert.doesNotMatch(releaseNote, /gh release upload|\.zip\s|\.sha256\s/);
});

test('n8n evidence pins the reviewed candidates and records only one private pending submission', () => {
  const candidates = new Map([
    ['distribution/n8n/brief-to-approved-generation.json', 'submitted_pending_review'],
    ['distribution/n8n/campaign-queue.json', 'queued_platform_blocked'],
    ['distribution/n8n/completion-notification.json', 'queued_platform_blocked'],
  ]);

  for (const [path, state] of candidates) {
    const candidateRow = checklist
      .split('\n')
      .find((line) => line.startsWith(`| \`${path}\` |`)) ?? '';
    const documentedDigest = candidateRow.match(
      new RegExp('\\| `([a-f0-9]{64})` \\| `' + state + '` \\|$'),
    )?.[1];
    const actualDigest = createHash('sha256').update(readFileSync(path)).digest('hex');

    assert.ok(candidateRow, `missing documented candidate: ${path}`);
    assert.ok(documentedDigest, `missing documented SHA-256: ${path}`);
    assert.equal(documentedDigest, actualDigest, `documented SHA-256 drifted: ${path}`);
    assert.equal(statSync(path).mode & 0o777, 0o644, `candidate mode must remain 100644: ${path}`);
  }

  const n8n = row('n8n workflow library');
  assert.match(n8n, /https:\/\/n8n\.io\/workflows\//);
  assert.match(n8n, /https:\/\/creators\.n8n\.io\//);
  assert.match(n8n, /one-at-a-time sequencing/i);
  assert.match(n8n, /private Creator Portal workflow ID `19591`/i);
  assert.match(n8n, /Turn creative briefs into approved MaxVideoAI generations with human approval/);
  assert.match(n8n, /passed.*AI review/i);
  assert.match(n8n, /`Pending`.*`Under review`/i);
  assert.match(n8n, /3–5 business days/i);
  assert.match(n8n, /Share new template.*disabled/i);
  assert.match(n8n, /no public .*URL exists/i);
  assert.match(n8n, /no personal account data/i);
  assert.match(n8n, /other two.*not submitted.*queued/i);
  assert.doesNotMatch(n8n, /\| `(?:claimed|verified)` \|/);
  assert.match(checklist, /deterministic self-hosted MCP Client evidence is\s+public and indexable/i);
  assert.match(checklist, /MCP Client Tool invocation[\s\S]{0,180}n8n Cloud[\s\S]{0,220}outside the claim/i);
});

test('MCPBeat and Glama claim evidence keeps GitHub, health, and Docker caveats explicit', () => {
  const github = row('GitHub MCP registry discovery');
  const mcpbeat = row('MCPBeat owner claim');
  const glama = row('Glama owner claim');
  const docker = row('Docker MCP Catalog');

  assert.match(github, /api\.mcp\.github\.com\/v0\.1\/servers\?search=maxvideoai/);
  assert.match(github, /no third-party submission control/i);
  assert.match(github, /Official MCP Registry record is not substitute evidence/i);

  assert.match(mcpbeat, /https:\/\/mcpbeat\.com\/mcp-servers\/maxvideoai\/maxvideoai\//);
  assert.match(mcpbeat, /`OWNER CONFIRMED`/);
  assert.match(mcpbeat, /version `0\.3\.3`/i);
  assert.match(mcpbeat, /`ANSWERING`/);
  assert.match(mcpbeat, /96\.9% uptime over the prior week/i);
  assert.match(mcpbeat, /not a MaxVideoAI SLA/i);
  assert.match(mcpbeat, /repository file flow/i);
  assert.match(mcpbeat, /temporary public file was removed/i);
  assert.match(mcpbeat, /add and remove commits remain recoverable/i);
  assert.match(glama, /https:\/\/glama\.ai\/mcp\/connectors\/com\.maxvideoai\/maxvideoai/);
  assert.match(glama, /https:\/\/api\.maxvideoai\.com\/\.well-known\/glama\.json/);
  assert.match(glama, /owner profile was created/i);
  assert.match(glama, /HTTP challenge was selected/i);
  assert.match(glama, /Production returned the exact challenge body/i);
  assert.match(glama, /Ownership verified/i);
  assert.match(glama, /administration page was accessible/i);
  assert.match(glama, /`Unhealthy`/);
  assert.match(glama, /`Works in Glama`/);
  assert.match(glama, /ownership does not prove health/i);

  assert.match(docker, /github\.com\/docker\/mcp-registry\/blob\/main\/CONTRIBUTING\.md/);
  assert.match(docker, /Business Source License 1\.1/);
  assert.match(docker, /Do not fork, create catalog files, open a PR, or relicense/i);
});
