import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';

const root = process.cwd();
function build(out: string, source?: string) {
  return spawnSync(process.execPath, [
    resolve(root, 'scripts/build-maxvideoai-openai-directory.mjs'), '--out', out,
    ...(source ? ['--source', source] : []),
  ], { cwd: root, encoding: 'utf8' });
}
function entries(path: string) {
  const archive = readFileSync(path);
  const files = new Map<string, Buffer>();
  let offset = 0;
  while (archive.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(archive.readUInt16LE(offset + 8), 0);
    const size = archive.readUInt32LE(offset + 18);
    const nameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    const name = archive.subarray(offset + 30, offset + 30 + nameLength).toString('utf8');
    const start = offset + 30 + nameLength + extraLength;
    files.set(name, archive.subarray(start, start + size));
    offset = start + size;
  }
  return files;
}
test('directory builder produces a deterministic portable draft with review cases and self-contained skills, matching the generic source projection without replacing existing archives', (t) => {
  const temporary = mkdtempSync(join(realpathSync(tmpdir()), 'maxvideoai-openai-package-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const first = join(temporary, 'a');
  const second = join(temporary, 'b');
  const result = build(first);
  const archive = join(first, 'maxvideoai-openai-directory-0.3.19.zip');
  assert.ok(existsSync(archive), `directory archive was not built: ${result.stderr}`);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(build(second).status, 0);
  assert.deepEqual(readFileSync(archive), readFileSync(join(second, 'maxvideoai-openai-directory-0.3.19.zip')));
  const files = entries(archive);
  assert.deepEqual([...files.keys()].sort(), [
    'LICENSE', 'assets/logo-mark.svg', 'checksums.json', 'mcp.json', 'plugin.json',
    'scripts/import-reference-files.mjs', 'skills/generate/SKILL.md',
    'skills/generate/agents/openai.yaml', 'skills/generate/references/generation-safety.md',
    'skills/generate/references/reference-inputs.md', 'skills/plan/SKILL.md',
    'skills/plan/agents/openai.yaml', 'skills/plan/references/budget-planning.md',
  ]);
  const manifest = JSON.parse(files.get('plugin.json')!.toString());
  assert.equal(manifest.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  assert.equal(manifest.version, '0.3.19');
  assert.equal(manifest.name, 'maxvideoai-media');
  const openai = manifest.extensions['com.openai'];
  assert.ok(openai.interface.shortDescription.length <= 30);
  assert.equal(openai.interface.supportURL, 'https://maxvideoai.com/contact');
  assert.equal(openai.review.test_cases.positive.length, 5);
  assert.equal(openai.review.test_cases.negative.length, 3);
  assert.equal(openai.review.commerce, false);
  assert.equal('demo_recording_url' in openai.review, false, 'do not fabricate review evidence');
  assert.deepEqual(JSON.parse(files.get('mcp.json')!.toString()), {
    $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
    mcpServers: { maxvideoai: { type: 'streamable-http', url: 'https://openai-mcp.maxvideoai.com/mcp', extensions: { 'com.openai': { auth: { type: 'oauth', client: { mode: 'provided', clientId: '324a5cbd-2929-4ba1-82a6-58083f5ccb33', tokenEndpointAuthMethod: 'client_secret_basic' } } } } } },
  });
  for (const [name, contents] of files) {
    if (name.endsWith('.md')) assert.doesNotMatch(contents.toString(), /create_topup_link|mcp_topup=|\/billing\b/);
    assert.doesNotMatch(contents.toString(), /https:\/\/api\.maxvideoai\.com\/mcp\b/, `${name} must not reconnect the candidate to the direct MCP channel`);
    if (name.endsWith('openai.yaml')) {
      const skill = parse(contents.toString());
      assert.equal(skill.policy.allow_implicit_invocation, true);
      assert.deepEqual(skill.dependencies.tools.map((tool: { type: string; value: string; transport: string; url: string }) => ({
        type: tool.type, value: tool.value, transport: tool.transport, url: tool.url,
      })), [{ type: 'mcp', value: 'maxvideoai', transport: 'streamable_http', url: 'https://openai-mcp.maxvideoai.com/mcp' }]);
    }
  }
  const checksums = JSON.parse(files.get('checksums.json')!.toString());
  for (const [name, contents] of files) {
    if (name !== 'checksums.json') assert.equal(checksums.files[name], createHash('sha256').update(contents).digest('hex'));
  }
  const readiness = JSON.parse(readFileSync(join(first, 'openai-directory-readiness.json'), 'utf8'));
  assert.equal(readiness.readyToSubmit, false);
  assert.equal(readiness.productionActivated, false);
  assert.equal(readiness.requiredRuntimeProfile, 'openai-directory');
  assert.equal(readiness.resourceUrl, 'https://openai-mcp.maxvideoai.com/mcp');
  assert.equal(readiness.requiredRuntimeSwitch, 'MCP_OPENAI_DIRECTORY_ENABLED=true');
  assert.equal(readiness.domainVerified, false);
  assert.equal(readiness.oauthClientConfigured,false);
  assert.equal(readiness.oauthClientDeclared, true);
  assert.equal(readiness.targetCapabilitySwitches.MCP_OPENAI_DIRECTORY_CREATOR_TOOLS_ENABLED,'true');
  assert.equal(readiness.targetCapabilitySwitches.MCP_OPENAI_DIRECTORY_CHARACTER_STUDIO_ENABLED,'true');
  assert.match(files.get('skills/generate/SKILL.md')!.toString(), /prepare_recast.*confirm_recast.*get_recast_status/s);
  assert.doesNotMatch(files.get('skills/generate/SKILL.md')!.toString(), /burn-in is included/);
  assert.match(files.get('skills/generate/SKILL.md')!.toString(), /list_creator_tools.*prepare_creator_tool.*confirm_creator_tool/s);
  assert.equal(readiness.genericSourcePackage.version, '0.3.9');
  assert.equal(readiness.genericSourcePackage.publicationStatus, 'not-attested-by-local-builder');
  assert.equal('releasedPackage' in readiness, false);
  assert.equal(readiness.projectEligibility.residency, 'global');
  assert.equal(readiness.projectEligibility.verified, false);
  const generic = spawnSync(process.execPath, [resolve(root, 'scripts/build-maxvideoai-plugin-release.mjs'), '--out', join(temporary, 'generic')], { cwd: root, encoding: 'utf8' });
  assert.equal(generic.status, 0, generic.stderr);
  assert.deepEqual(readFileSync(join(first, 'maxvideoai-plugin-0.3.9.zip')), readFileSync(join(temporary, 'generic', 'maxvideoai-plugin-0.3.9.zip')));
  const original = readFileSync(archive);
  assert.notEqual(build(first).status, 0, 'never replace an existing archive, even in a builder-owned folder');
  assert.deepEqual(readFileSync(archive), original);
  assert.match(files.get('skills/generate/SKILL.md')!.toString(), /list_audio_capabilities.*prepare_audio_generation/s);
  assert.match(files.get('skills/generate/SKILL.md')!.toString(), /create_studio_montage.*get_studio_timeline.*edit_studio_timeline.*prepare_studio_export/s);
});

test('directory builder preserves an unowned output folder instead of deleting it', (t) => {
  const temporary = mkdtempSync(join(realpathSync(tmpdir()), 'maxvideoai-openai-output-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  writeFileSync(join(temporary, 'keep.txt'), 'preserve user work');
  const result = build(temporary);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not owned|ownership|unexpected|not empty/i);
  assert.equal(readFileSync(join(temporary, 'keep.txt'), 'utf8'), 'preserve user work');
});

test('directory metadata cannot export a private filesystem path', (t) => {
  const temporary = mkdtempSync(join(realpathSync(tmpdir()), 'maxvideoai-openai-private-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const source = join(temporary, 'source');
  cpSync(resolve(root, 'plugins/maxvideoai'), source, { recursive: true });
  const path = join(source, 'openai-directory.json');
  const config = JSON.parse(readFileSync(path, 'utf8'));
  config.interface.longDescription += ' Evidence at /Users/reviewer/private/session.txt';
  writeFileSync(path, JSON.stringify(config));
  const out = join(temporary, 'out');
  const result = build(out, source);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /local absolute path/i);
  assert.equal(existsSync(join(out, 'maxvideoai-openai-directory-0.3.19.zip')), false);
});

test('registered client metadata rejects secrets and does not exempt unrelated private UUIDs', (t) => {
  const temporary = mkdtempSync(join(realpathSync(tmpdir()), 'maxvideoai-openai-oauth-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  for (const kind of ['secret', 'private-id']) {
    const source = join(temporary, kind);
    cpSync(resolve(root, 'plugins/maxvideoai'), source, { recursive: true });
    const path = join(source, 'openai-directory.json');
    const config = JSON.parse(readFileSync(path, 'utf8'));
    if (kind === 'secret') config.oauthClient.clientSecret = 'never-export-this-value';
    else config.interface.longDescription += ` Internal account ${config.oauthClient.clientId}`;
    writeFileSync(path, JSON.stringify(config));
    const out = join(temporary, `out-${kind}`);
    const result = build(out, source);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, kind === 'secret' ? /Invalid public OAuth client/ : /internal UUID/);
    assert.equal(existsSync(join(out, 'maxvideoai-openai-directory-0.3.19.zip')), false);
  }
});

// Regression from the portal's strict compatibility-overlay validation.
test('directory builder rejects unsupported publication fields before writing an archive', (t) => {
  const temporary = mkdtempSync(join(realpathSync(tmpdir()), 'maxvideoai-publication-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const source = join(temporary, 'source');
  cpSync(resolve(root, 'plugins/maxvideoai'), source, { recursive: true });
  const path = join(source, 'openai-directory.json');
  const config = JSON.parse(readFileSync(path, 'utf8'));
  config.publication.releaseNotes = 'Incorrect camelCase spelling rejected by OpenAI';
  writeFileSync(path, JSON.stringify(config));
  const out = join(temporary, 'out');
  const result = build(out, source);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid publication metadata.*release_notes/);
  assert.equal(existsSync(out), false);
});
