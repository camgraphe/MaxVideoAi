import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const harnessPath = 'tests/helpers/mcp-paid-e2e-harness.ts';

test('P11 pricing proof uses production membership and pricing owners', () => {
  const source = readFileSync(harnessPath, 'utf8');

  assert.doesNotMatch(source, /resolveMembershipPricing:\s*async\s*\(\)\s*=>\s*membership/u);
  assert.doesNotMatch(source, /priceGeneration:\s*sharedWebPrice/u);
  assert.match(source, /getUserMembershipStatus\(params\.userId\)/u);
  assert.match(source, /assertPersistedPriceParity/u);
});

test('P11 wallet proof calls the MCP account tool and three independent ledger queries', () => {
  const source = readFileSync(harnessPath, 'utf8');
  const start = source.indexOf('export async function assertWalletParity');
  assert.notEqual(start, -1, 'missing independent wallet parity owner');
  const nextExport = source.indexOf('\nexport ', start + 1);
  const body = source.slice(start, nextExport === -1 ? source.length : nextExport);

  assert.match(body, /name:\s*'get_account_status'/u);
  assert.equal(body.match(/pool\.query/gu)?.length, 3);
  for (const type of ['topup', 'charge', 'refund']) {
    assert.match(body, new RegExp(`type = '${type}'`, 'u'));
  }
});

test('operational staging proof remains isolated from the active production publication', () => {
  const script = readFileSync('scripts/deploy-mcp-staging-vercel.sh', 'utf8');
  const runbook = readFileSync('docs/operations/mcp-staging-deployment.md', 'utf8');
  const publication = JSON.parse(
    readFileSync('frontend/config/mcp-publication.json', 'utf8'),
  ) as Record<string, boolean>;

  assert.deepEqual(publication, {
    publicMarketing: true,
    publicIndexing: true,
    transport: true,
    oauth: true,
    discovery: true,
    paidGeneration: true,
    trial: false,
    referenceUploads: true,
  });
  assert.match(script, /capture_production_baseline "\$ARTIFACTS\/production-before"/);
  assert.match(script, /capture_production_baseline "\$ARTIFACTS\/production-after"/);
  assert.match(script, /diff -u "\$ARTIFACTS\/production-before\.project\.json"/);
  assert.match(script, /diff -u "\$ARTIFACTS\/production-before\.domains\.json"/);
  assert.match(script, /diff -u "\$ARTIFACTS\/production-before\.protection\.sorted\.json"/);
  assert.doesNotMatch(script, /(?:deploy|promote)[^\n]*\$PRODUCTION_PROJECT/);
  assert.doesNotMatch(script, /env (?:add|rm|pull)/);
  assert.match(runbook, /do not substitute (?:a )?production credential/i);
  assert.match(runbook, /production[\s\S]{0,160}(?:read-only|unchanged)/i);
});
