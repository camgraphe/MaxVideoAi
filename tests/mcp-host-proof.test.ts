import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { getMcpHostProof } from '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-host-proof';

test('Claude host proof is localized, historical-price qualified, and host-scoped', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const proof = getMcpHostProof('claude', locale);
    assert.ok(proof);
    assert.equal(proof.host, 'claude');
    assert.equal(proof.assetSrc, '/media/mcp/claude-inline-video-proof.jpg');
    assert.equal(proof.mimeType, 'image/jpeg');
    assert.deepEqual([proof.width, proof.height], [1152, 768]);
    assert.match(proof.eyebrow, /Claude Desktop/);
    assert.match(proof.heading, /Claude/i);
    assert.match(proof.alt, /Claude/i);
    assert.match(proof.caption, /(?:not a current quote|pas.*devis actuel|no.*precio actual)/i);
    assert.match(proof.caption, /(?:library|bibliothèque|biblioteca)/i);
    assert.doesNotMatch(`${proof.heading} ${proof.caption}`, /partnership|partner|approved by|endorsed/i);
    assert.equal(existsSync(`frontend/public${proof.assetSrc}`), true);
  }

  assert.equal(getMcpHostProof('chatgpt', 'en'), null);
  assert.equal(getMcpHostProof('codex', 'en'), null);
  assert.match(getMcpHostProof('claude', 'fr')?.eyebrow ?? '', /Test contrôlé/);
  assert.match(getMcpHostProof('claude', 'es')?.eyebrow ?? '', /Prueba controlada/);
});

test('the host proof contract carries public-safe capture provenance without claiming result proof', () => {
  const source = readFileSync(
    'frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-host-proof.ts',
    'utf8',
  );
  for (const field of [
    'capturedAt',
    'hostVersion',
    'hostLocale',
    'operatingSystem',
    'deploymentId',
    'sourceRevision',
    'resourceUri',
    'evidenceReference',
  ]) {
    assert.match(source, new RegExp(`${field}: string`));
  }
  assert.doesNotMatch(source, /mcpGenerationVerified:\s*true|jobEvidenceReference|auditEvidenceReference/);
});
