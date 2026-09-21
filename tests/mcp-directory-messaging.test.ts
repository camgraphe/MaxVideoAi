import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const geoPath = 'docs/marketing/GEO-ANALYSIS.md';
const distributionPath = 'plugins/maxvideoai/docs/distribution.md';

test('GEO evidence separates observed production copy from corrected branch readiness', () => {
  const geo = readFileSync(geoPath, 'utf8');
  const chatgptRow = geo
    .split('\n')
    .find((line) => line.startsWith('| `/integrations/chatgpt` HTML |')) ?? '';
  const columns = chatgptRow.split('|').map((value) => value.trim());

  assert.match(columns[2] ?? '', /observed.*directory-approval boundary.*developer MCP fallback/i);
  assert.doesNotMatch(columns[2] ?? '', /directory non-submission/i);
  assert.match(columns[3] ?? '', /direct developer-mode.*directory non-submission/i);
});

test('GEO recommendations make direct MCP primary and keep directories policy-blocked', () => {
  const geo = readFileSync(geoPath, 'utf8');
  const currentGuidance = geo.replace(/^\| `\/integrations\/chatgpt` HTML \|.*$/m, '');

  assert.match(geo, /ChatGPT search and app discovery[\s\S]{0,600}direct MCP.*primary live route/is);
  assert.match(geo, /ChatGPT search and app discovery[\s\S]{0,600}(?:do_not_submit|policy_blocked)/is);
  assert.match(geo, /Top 5 Highest-Impact Changes[\s\S]{0,900}direct developer-mode MCP/is);
  assert.match(geo, /Schema Recommendations[\s\S]{0,900}(?:do_not_submit|policy_blocked)/is);
  assert.match(geo, /Content Reformatting Suggestions[\s\S]{0,500}direct MCP/is);
  assert.doesNotMatch(
    currentGuidance,
    /Public-directory approval[^.]*remain outstanding|directory-approval boundary|directory availability conditional on approval|MCP URL remains the developer fallback|MCP as the developer fallback/i,
  );
});

test('distribution guide records live direct setup and the active Official MCP Registry release', () => {
  const distribution = readFileSync(distributionPath, 'utf8');
  const registryRow = distribution.match(
    /- \*\*Official MCP Registry[\s\S]*?(?=\n- \*\*|\n##)/,
  )?.[0] ?? '';

  assert.match(distribution, /Direct ChatGPT configuration[\s\S]{0,900}public.*developer-mode.*MCP/is);
  assert.match(distribution, /exact-host evidence remains\s+`not-run`/i);
  assert.match(distribution, /availability[^.]*does not prove[^.]*host\s+compatibility/i);
  assert.doesNotMatch(distribution, /Do not publish ChatGPT-specific setup/i);

  // Read-only Registry checkpoint recorded in the guide; not the next source version.
  assert.match(registryRow, /active.*`0\.3\.5`/i);
  assert.match(registryRow, /rechecked on \*\*2026-09-21\*\*/);
  assert.match(registryRow, /publication on \*\*2026-09-16\*\*/);
  assert.match(
    registryRow,
    /https:\/\/registry\.modelcontextprotocol\.io\/v0\.1\/servers\?search=com\.maxvideoai%2Fmaxvideoai/,
  );
  assert.doesNotMatch(registryRow, /prepared, not submitted/i);
});
