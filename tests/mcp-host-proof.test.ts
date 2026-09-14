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
  assert.equal(getMcpHostProof('openclaw', 'en'), null);
  assert.equal(getMcpHostProof('n8n', 'en'), null);
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

test('the owned MCP proof asset is allowed by the Next image loader', () => {
  const config = readFileSync('frontend/next.config.js', 'utf8');
  assert.match(config, /pathname:\s*['"]\/media\/mcp\/\*\*['"]/);
});

test('the registry guide locks later hosts behind separate evidence gates', () => {
  const guide = readFileSync('docs/engineering/mcp-integration-registry.md', 'utf8');

  assert.match(guide, /## Later-host promotion sequence/);
  for (const host of [
    'Cursor',
    'GitHub Copilot IDE',
    'GitHub Copilot CLI',
    'GitHub Copilot cloud agent',
    'Gemini CLI',
    'Microsoft Copilot Studio',
    'Microsoft Agents 365',
  ]) {
    assert.match(guide, new RegExp(host));
  }

  assert.match(guide, /one host record at a time/i);
  assert.match(guide, /RFC 9207/);
  assert.match(guide, /remote OAuth[^.]*not supported/i);
  assert.match(guide, /enterprise certification/i);
  assert.match(guide, /Cursor remains `hidden` with a `tested_with_limits` desktop checkpoint/);
  assert.match(guide, /Microsoft Agents 365 remain `hidden` and\s+`not-run`/);
});

test('the Cursor matrix records manual, OAuth, agent-tool, and deep-link evidence separately', () => {
  const matrix = readFileSync('docs/operations/mcp-host-compatibility-matrix.md', 'utf8');
  const row = matrix.split('\n').find((line) => line.startsWith('| Cursor |')) ?? '';

  assert.match(row, /Tested-with-limits checkpoint/);
  assert.match(row, /Cursor 3\.20\.17, build `0c32194e3fb5ffaced9fb36430b860ec301e1fc0`/);
  assert.match(row, /macOS 26\.6\.2 arm64/);
  assert.match(row, /a3cf86050ea4c322b8a63fa840f35a54318c46da9b33281c2b223a17e473c738/);
  assert.match(row, /dedicated user-data directory, extensions directory, and project/);
  assert.match(row, /CLI `--add-mcp` path wrote.*did not surface/is);
  assert.match(row, /project `\.cursor\/mcp\.json` path independently created the server/);
  assert.match(row, /15 tools plus 6 resources/);
  assert.match(row, /Cursor Grok 4\.6 Medium/);
  assert.match(row, /`get_account_status`.*`list_models`.*`get_model_details`.*`recommend_models`.*`calculate_project_budget`.*`prepare_generation`/);
  assert.match(row, /exact quote were both `\$0\.34`/);
  assert.match(row, /stopped before `confirm_generation`/);
  assert.match(row, /logout returned the server to `Needs Authentication`/);
  assert.match(row, /fresh browser OAuth restored `Connected`/);
  assert.match(row, /`cursor:\/\/anysphere\.cursor-deeplink\/mcp\/install`/);
  assert.match(row, /prefilled as Remote HTTPS with the exact production endpoint/);
  assert.match(row, /install was cancelled, and no duplicate server was retained/);
  assert.match(row, /moves only to `tested_with_limits`/);
  assert.match(row, /marketing integration remains hidden/);
  assert.doesNotMatch(row, /(?:access_token|refresh_token|Bearer\s|localhost:\d+\/callback\?)/i);
});

test('the OpenClaw matrix records a sanitized tested-with-limits checkpoint', () => {
  const matrix = readFileSync('docs/operations/mcp-host-compatibility-matrix.md', 'utf8');
  const row = matrix.split('\n').find((line) => line.startsWith('| OpenClaw Gateway |')) ?? '';

  assert.match(row, /Tested-with-limits checkpoint/);
  assert.match(row, /OpenClaw 2026\.9\.4, commit `3a9d69d`/);
  assert.match(row, /macOS 26\.6\.2/);
  assert.match(row, /Streamable HTTP/);
  assert.match(row, /3b98acb659a339b944784256ec4c594531767d90b0dbc16a5caa7dc88eb7c0ca/);
  assert.match(row, /digest was captured after the initial lifecycle/);
  assert.match(row, /does not prove the bytes used during that lifecycle/);
  assert.match(row, /Denial left protected tools unavailable with no job or wallet mutation/);
  assert.match(row, /user also interrupted a login before browser approval/);
  assert.match(row, /token store count remained zero/);
  assert.match(row, /confirmed exactly once and completed/);
  assert.match(row, /cold\/lost-context session recovered the same accepted job through `list_recent_generations`, `get_generation_status`, and `present_generation` without a second `confirm_generation` or other paid call/);
  assert.match(row, /library fallback/);
  assert.match(row, /newest OpenClaw grant was disconnected/);
  assert.match(row, /reported authorization required, kept protected tools unavailable, and exited nonzero/);
  assert.match(row, /Fresh browser OAuth restored protected-tool discovery with exit 0/);
  assert.match(row, /account connection list returned to five OpenClaw entries/);
  assert.match(row, /No paid call or generation occurred during this revoke\/access-loss\/reconnect check/);
  assert.match(row, /older disabled production server entry with expired access and an existing refresh credential/);
  assert.match(row, /read-only capability probe exposed protected tools, updated the token store, and advanced expiry, demonstrating automatic refresh/);
  assert.match(row, /restored to disabled without a tool invocation, paid call, or generation/);
  assert.match(row, /deterministic local fault-injection on the exact installed OpenClaw build/);
  assert.match(row, /real MaxVideoAI HTTP handler with disposable PostgreSQL and a fake provider/);
  assert.match(row, /issued exactly one confirmation request/);
  assert.match(row, /one provider call, one job, one charge, and zero refunds/);
  assert.match(row, /not a live-provider or production-network interruption/);
  assert.match(row, /installed `@camgraphe\/maxvideoai` version `1\.0\.0` from ClawHub/);
  assert.match(row, /archive SHA-256 `5b47ee7a585136dd7d02a2bc50e85d5552b8b6be6de0fe22ab983eb0e0303564`/);
  assert.match(row, /eligible, model-visible, and linked to `@camgraphe`/);
  assert.match(row, /OAuth probe exposed all 15 protected MaxVideoAI capabilities/);
  assert.match(row, /agent tool invocation remains unverified/);
  assert.match(row, /credentials were cleared, the protected probe returned authorization required/);
  assert.match(row, /profile residue was moved to the Trash/);
  assert.doesNotMatch(row, /ClawHub install\/update\/uninstall remain unverified/);
  assert.doesNotMatch(row, /literal ambiguous interrupted `confirm_generation` transport response[^.]*remain unverified/);
  assert.match(row, /remain unverified/);
  assert.doesNotMatch(row, /(?:access_token|refresh_token|Bearer\s|https?:\/\/[^ )`]*\/[^ )`]*\?)/i);
});

test('the n8n matrix records deterministic and agent-tool evidence separately', () => {
  const matrix = readFileSync('docs/operations/mcp-host-compatibility-matrix.md', 'utf8');
  const clientRow = matrix.split('\n').find((line) => line.startsWith('| n8n MCP Client |')) ?? '';
  const toolRow = matrix.split('\n').find((line) => line.startsWith('| n8n MCP Client Tool |')) ?? '';

  assert.match(clientRow, /Tested-with-limits checkpoint/);
  assert.match(clientRow, /n8n 2\.38\.7/);
  assert.match(clientRow, /macOS 26\.6\.2.*arm64/);
  assert.match(clientRow, /loopback-only/);
  assert.match(clientRow, /\$0\.12.*Seedance 1\.5 Pro/);
  assert.match(clientRow, /confirmed exactly once/);
  assert.match(clientRow, /get_generation_status.*list_recent_generations.*present_generation/);
  assert.match(clientRow, /revoked.*Authentication required/is);
  assert.match(clientRow, /container and volume were removed/);
  assert.doesNotMatch(clientRow, /(?:access_token|refresh_token|Bearer\s)/i);

  assert.match(toolRow, /Tested-with-limits checkpoint/);
  assert.match(toolRow, /MCP Client Tool 1\.4/);
  assert.match(toolRow, /five selected.*planning tools/i);
  assert.match(toolRow, /prepare_generation.*confirm_generation.*excluded/);
  assert.match(toolRow, /Chat Model.*not configured/i);
  assert.match(toolRow, /agent-mediated tool invocation remains unverified/i);
  assert.doesNotMatch(toolRow, /(?:access_token|refresh_token|Bearer\s)/i);
});
