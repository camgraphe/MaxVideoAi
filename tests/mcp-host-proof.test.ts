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
    'Microsoft Agent 365',
  ]) {
    assert.match(guide, new RegExp(host));
  }

  assert.match(guide, /one host record at a time/i);
  assert.match(guide, /RFC 9207/);
  assert.match(guide, /remote OAuth[^.]*not supported/i);
  assert.match(guide, /Microsoft certification/i);
  assert.match(guide, /Cursor remains `hidden` with a `tested_with_limits` desktop checkpoint/);
  assert.match(guide, /Microsoft Agent 365 remain `hidden` and\s+`not-run`/);
  assert.match(guide, /Microsoft certification:[^.]*independent from both host checkpoints/i);
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

test('the GitHub Copilot matrix keeps IDE, CLI, and cloud evidence separate and blocked safely', () => {
  const matrix = readFileSync('docs/operations/mcp-host-compatibility-matrix.md', 'utf8');
  const ideRow = matrix.split('\n').find((line) => line.startsWith('| GitHub Copilot in IDEs |')) ?? '';
  const cliRow = matrix.split('\n').find((line) => line.startsWith('| GitHub Copilot CLI |')) ?? '';
  const cloudRow = matrix.split('\n').find((line) => line.startsWith('| GitHub Copilot cloud agent |')) ?? '';

  assert.match(ideRow, /Visual Studio Code 1\.137\.0, build `645f29cc3176500b4b5762ba887cf2a7f0ffdf2c`/);
  assert.match(ideRow, /GitHub Copilot Chat 0\.65\.0.*completions core 1\.378\.1799/);
  assert.match(ideRow, /exact `\$0\.37`.*stopped before `confirm_generation`/);
  assert.match(ideRow, /remains registry `not-run`, hidden, non-indexable, and acquisition-disabled/);

  assert.match(cliRow, /GitHub Copilot CLI 1\.0\.83/);
  assert.match(cliRow, /80a5ded6f1db484b4661af676ea914605ecfbcaf49f6b4bed81e6df16cbd56bd/);
  assert.match(cliRow, /OAuth denial left protected tools unavailable with no job or charge/);
  assert.match(cliRow, /exact `\$0\.34`.*`confirm_generation` ran exactly once/);
  assert.match(cliRow, /cold session recovered.*`list_recent_generations`.*`get_generation_status`.*`present_generation`/);
  assert.match(cliRow, /disconnected the CLI grant.*already-issued access token still completed a protected `get_account_status` call/);
  assert.match(cliRow, /Testing stopped immediately/);
  assert.match(cliRow, /not deployed or hosted-verified/);
  assert.match(cliRow, /remains registry `not-run`/);

  assert.match(cloudRow, /do not currently support remote MCP servers that use OAuth/);
  assert.match(cloudRow, /currently incompatible with the MaxVideoAI OAuth path/);
  for (const row of [ideRow, cliRow, cloudRow]) {
    assert.doesNotMatch(row, /(?:access_token|refresh_token|Bearer\s|localhost:\d+\/callback\?)/i);
  }
});

test('the Gemini CLI matrix pins the stable preflight and keeps promotion blocked', () => {
  const matrix = readFileSync('docs/operations/mcp-host-compatibility-matrix.md', 'utf8');
  const row = matrix.split('\n').find((line) => line.startsWith('| Gemini CLI |')) ?? '';

  assert.match(row, /Gemini CLI 0\.59\.0/);
  assert.match(row, /59dc2cdb098b3000d36e34a185fc873932df4fd9d00900e817f2b19cd349d98b/);
  assert.match(row, /`httpUrl`.*Streamable HTTP/);
  assert.match(row, /`http:\/\/localhost:<OS-assigned port>\/oauth\/callback`/);
  assert.match(row, /PKCE S256.*`state`/);
  assert.match(row, /does not validate.*RFC 9207 `iss`/);
  assert.match(row, /0\.60\.0-preview\.0/);
  assert.match(row, /remains registry `not-run`, hidden, non-indexable, and acquisition-disabled/);
  assert.doesNotMatch(row, /(?:access_token|refresh_token|Bearer\s|localhost:\d+\/oauth\/callback\?)/i);
});

test('the Microsoft enterprise matrix keeps Copilot Studio and Agent 365 separate and blocked', () => {
  const matrix = readFileSync('docs/operations/mcp-host-compatibility-matrix.md', 'utf8');
  const directory = readFileSync('docs/marketing/mcp-directory-submissions.md', 'utf8');
  const studioRow = matrix.split('\n').find((line) => line.startsWith('| Microsoft Copilot Studio |')) ?? '';
  const agentRow = matrix.split('\n').find((line) => line.startsWith('| Microsoft Agent 365 |')) ?? '';
  const certificationRow = directory
    .split('\n')
    .find((line) => line.startsWith('| Microsoft MCP certification |')) ?? '';

  assert.match(studioRow, /Streamable HTTP only/);
  assert.match(studioRow, /dynamic discovery and DCR/);
  assert.match(studioRow, /callback URI is generated.*must be copied exactly/);
  assert.match(studioRow, /Power Platform data policies/);
  assert.match(studioRow, /remains registry `not-run`, hidden, non-indexable, and acquisition-disabled/);

  assert.match(agentRow, /BYO remote-MCP path remains preview/);
  assert.match(agentRow, /Agent 365 CLI 1\.1\.165-preview/);
  assert.match(agentRow, /ExternalOAuth.*static client ID and secret/);
  assert.match(agentRow, /AI Admin or Global Admin.*tenant-wide consent/);
  assert.match(agentRow, /up to 30 minutes/);
  assert.match(agentRow, /does not support republishing or deleting/);
  assert.match(agentRow, /Defender Advanced Hunting/);
  assert.match(agentRow, /remains registry `not-run`, hidden, non-indexable, and acquisition-disabled/);

  assert.match(certificationRow, /Apps and Agents for M365 and Copilot/);
  assert.match(certificationRow, /manifest.*tool file.*`intro\.md`.*Azure Key Vault/);
  assert.match(certificationRow, /no Partner Center offer/i);
  for (const row of [studioRow, agentRow, certificationRow]) {
    assert.doesNotMatch(row, /(?:client_secret|access_token|refresh_token|Bearer\s|callback\?code=)/i);
  }
});

test('the Claude Code and ChatGPT web preflight pins current host paths without upgrading evidence', () => {
  const matrix = readFileSync('docs/operations/mcp-host-compatibility-matrix.md', 'utf8');
  const checklist = readFileSync(
    'docs/superpowers/plans/2026-09-12-mcp-ecosystem-rollout-checklist.md',
    'utf8',
  );
  const chatgptRow =
    matrix.split('\n').find((line) => line.startsWith('| ChatGPT web custom app / full MCP |')) ?? '';
  const claudeCodeRow = matrix.split('\n').find((line) => line.startsWith('| Claude Code |')) ?? '';

  assert.match(chatgptRow, /developer mode/);
  assert.match(chatgptRow, /Streamable HTTP/);
  assert.match(chatgptRow, /CIMD.*DCR.*PKCE S256/);
  assert.match(chatgptRow, /direct developer connection.*public plugin submission/i);
  assert.match(chatgptRow, /remains `not-run`/);

  assert.match(claudeCodeRow, /stable 2\.1\.236/);
  assert.match(claudeCodeRow, /signed manifest.*SHA-256/);
  assert.match(claudeCodeRow, /Streamable HTTP/);
  assert.match(claudeCodeRow, /`http:\/\/localhost:<random port>\/callback`/);
  assert.match(claudeCodeRow, /DCR.*CIMD/);
  assert.match(claudeCodeRow, /tool approval/);
  assert.match(claudeCodeRow, /remains `not-run`/);
  assert.doesNotMatch(checklist, /Claude Code[\s\S]*?PKCE callbacks/);

  for (const row of [chatgptRow, claudeCodeRow]) {
    assert.doesNotMatch(row, /(?:access_token|refresh_token|Bearer\s|callback\?code=)/i);
  }
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

test('the OpenClaw private-reference attempt stays blocked without overstating cleanup evidence', () => {
  const checklist = readFileSync(
    'docs/superpowers/plans/2026-09-12-mcp-ecosystem-rollout-checklist.md',
    'utf8',
  );
  const taskTwo = checklist.split('### Task 3:')[0]?.split('### Task 2:').at(-1) ?? '';

  assert.match(taskTwo, /staging OAuth completed/i);
  assert.match(taskTwo, /`create_reference_upload_link` and `list_media`/);
  assert.match(
    taskTwo,
    /- \[ \] Exercise one bounded private-reference import path and clean up the disposable media\./,
  );
  assert.match(taskTwo, /no upload\s+session, media asset,\s+job, quote, charge, or generation/i);
  assert.match(taskTwo, /migration 43.*not.*attested.*production/is);
  assert.match(taskTwo, /production was not used for this\s+test/i);
  assert.match(taskTwo, /physical staging cleanup[\s\S]{0,100}operator credential/i);
  assert.match(taskTwo, /private-reference lifecycle remains unverified/i);
  assert.doesNotMatch(taskTwo, /(?:access_token|refresh_token|Bearer\s|callback\?code=|request_id)/i);
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

  assert.match(toolRow, /Not-run configuration checkpoint/);
  assert.match(toolRow, /MCP Client Tool 1\.4/);
  assert.match(toolRow, /five selected.*planning tools/i);
  assert.match(toolRow, /prepare_generation.*confirm_generation.*excluded/);
  assert.match(toolRow, /Chat Model.*not configured/i);
  assert.match(toolRow, /agent-mediated tool invocation remains unverified/i);
  assert.doesNotMatch(toolRow, /(?:access_token|refresh_token|Bearer\s)/i);
});
