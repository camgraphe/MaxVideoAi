import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pluginRoot = path.join(root, 'plugins', 'maxvideoai');
const allowedTools = new Set([
  'get_account_status',
  'list_models',
  'get_model_details',
  'recommend_models',
  'calculate_project_budget',
  'list_media',
  'create_reference_upload_link',
  'prepare_generation',
  'confirm_generation',
  'get_generation_status',
  'list_recent_generations',
  'create_topup_link',
]);

function read(relativePath: string): string {
  return readFileSync(path.join(pluginRoot, relativePath), 'utf8');
}

function json(relativePath: string): Record<string, unknown> {
  return JSON.parse(read(relativePath)) as Record<string, unknown>;
}

function filesAt(rootPath: string): string[] {
  return readdirSync(rootPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) return filesAt(entryPath);
    return [entryPath];
  });
}

test('the MaxVideoAI plugin has thin Codex and Claude package adapters', () => {
  assert.equal(path.basename(pluginRoot), 'maxvideoai');

  const codex = json('.codex-plugin/plugin.json');
  const claude = json('.claude-plugin/plugin.json');
  for (const manifest of [codex, claude]) {
    assert.equal(manifest.name, 'maxvideoai');
    assert.equal(manifest.version, '0.1.0');
    assert.equal(manifest.license, 'BUSL-1.1');
  }

  assert.equal(codex.skills, './skills/');
  assert.equal(codex.mcpServers, './.mcp.json');
  const mcp = json('.mcp.json');
  assert.deepEqual(mcp, {
    mcpServers: {
      maxvideoai: { type: 'http', url: 'https://api.maxvideoai.com/mcp' },
    },
  });

  const interfaceMetadata = codex.interface as Record<string, unknown>;
  assert.equal(interfaceMetadata.category, 'Creativity');
  assert.equal(interfaceMetadata.brandColor, '#111827');
  assert.equal(interfaceMetadata.privacyPolicyURL, 'https://maxvideoai.com/legal/privacy');
  assert.equal(interfaceMetadata.termsOfServiceURL, 'https://maxvideoai.com/legal/terms');
  assert.equal((interfaceMetadata.defaultPrompt as unknown[]).length, 3);
  assert.equal('screenshots' in interfaceMetadata, false);

  for (const field of ['composerIcon', 'logo', 'logoDark'] as const) {
    const assetPath = interfaceMetadata[field];
    assert.equal(typeof assetPath, 'string', `${field} must be a plugin-local path`);
    assert.match(assetPath as string, /^\.\/assets\/[a-z0-9-]+\.svg$/);
    assert.doesNotMatch(assetPath as string, /\.\./);

    const resolvedAssetPath = path.resolve(pluginRoot, assetPath as string);
    assert.ok(resolvedAssetPath.startsWith(`${path.resolve(pluginRoot, 'assets')}${path.sep}`));
    assert.ok(existsSync(resolvedAssetPath), `${field} asset must exist`);
  }
});

test('the shared skill gives hosts conversational, factual guardrails', () => {
  const skill = read('skills/maxvideoai/SKILL.md');
  const lines = skill.split('\n');
  assert.deepEqual(lines.slice(0, 4), [
    '---',
    'name: maxvideoai',
    'description: Plan, compare, budget, and generate AI video or images through MaxVideoAI from Codex or Claude. Use when a user mentions MaxVideoAI, wants current AI model advice or pricing, needs prompts or references for a generation, or wants to create and follow a MaxVideoAI job.',
    '---',
  ]);
  assert.ok(lines.length < 180);
  assert.match(skill, /references\/budget-planning\.md/);
  assert.match(skill, /references\/generation-safety\.md/);
  assert.match(skill, /ask only.*missing.*materially/i);
  assert.match(skill, /host.*creative/i);
  assert.match(skill, /do not.*model memory/i);
  assert.match(skill, /calculate_project_budget/i);
  assert.match(skill, /prepare_generation.*confirm_generation/is);
  assert.doesNotMatch(skill, /economy|balanced|premium/i);

  const toolNames = skill.match(/\b(?:get_account_status|list_models|get_model_details|recommend_models|calculate_project_budget|list_media|create_reference_upload_link|prepare_generation|confirm_generation|get_generation_status|list_recent_generations|create_topup_link)\b/g) ?? [];
  assert.ok(toolNames.length > 0);
  for (const tool of toolNames) assert.ok(allowedTools.has(tool), `unknown tool ${tool}`);
});

test('the plugin is a local thin package without stale facts or an embedded UI', () => {
  assert.equal(read('LICENSE'), readFileSync(path.join(root, 'LICENSE'), 'utf8'));
  assert.ok(existsSync(path.join(pluginRoot, 'README.md')));
  assert.equal(existsSync(path.join(pluginRoot, '.app.json')), false);
  assert.equal(existsSync(path.join(pluginRoot, 'hooks')), false);
  assert.equal(existsSync(path.join(pluginRoot, 'subagents')), false);

  for (const file of filesAt(pluginRoot)) {
    assert.ok(statSync(file).isFile());
    assert.doesNotMatch(path.extname(file), /^\.(?:tsx?|jsx?|css|html)$/i, file);
    if (path.basename(file) === 'LICENSE') continue;
    const contents = readFileSync(file, 'utf8');
    assert.doesNotMatch(contents, /(?:\$\s*\d|€\s*\d|api[_ -]?key|client[_ -]?secret|bearer\s+\S+|provider credential|localhost|127\.0\.0\.1)/i, file);
    assert.doesNotMatch(contents, /(?:marketplace (?:submission|listing)|publicly available|live in (?:Codex|Claude)|installed and verified)/i, file);
    assert.doesNotMatch(contents, /^\|.*\|$/m, file);
  }
});
