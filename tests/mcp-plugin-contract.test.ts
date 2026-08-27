import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pluginRoot = path.join(root, 'plugins', 'maxvideoai');
const expectedSkillNames = ['generate', 'plan'] as const;
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
  'present_generation',
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

function findCachedPyYamlPath(): string | null {
  const archiveRoot = path.join(homedir(), '.cache', 'uv', 'archive-v0');
  if (!existsSync(archiveRoot)) return null;
  for (const archive of readdirSync(archiveRoot)) {
    const libRoot = path.join(archiveRoot, archive, 'lib');
    if (!existsSync(libRoot)) continue;
    for (const pythonDirectory of readdirSync(libRoot)) {
      const sitePackages = path.join(libRoot, pythonDirectory, 'site-packages');
      if (existsSync(path.join(sitePackages, 'yaml', '__init__.py'))) return sitePackages;
    }
  }
  return null;
}

test('the MaxVideoAI plugin has thin Codex and Claude package adapters', () => {
  assert.equal(path.basename(pluginRoot), 'maxvideoai');

  const codex = json('.codex-plugin/plugin.json');
  const claude = json('.claude-plugin/plugin.json');
  const marketplace = json('.claude-plugin/marketplace.json');
  const packageVersion = read('VERSION').trim();
  for (const manifest of [codex, claude]) {
    assert.equal(manifest.name, 'maxvideoai');
    assert.equal(manifest.version, packageVersion);
    assert.equal(manifest.license, 'BUSL-1.1');
    assert.ok((manifest.keywords as unknown[]).length >= 8);
  }

  const marketplacePlugins = marketplace.plugins as Array<Record<string, unknown>>;
  assert.equal(marketplacePlugins.length, 1);
  assert.equal(marketplacePlugins[0]?.name, 'maxvideoai');
  assert.equal(marketplacePlugins[0]?.source, './');
  assert.equal(marketplacePlugins[0]?.version, undefined);
  assert.equal(marketplacePlugins[0]?.skills, undefined);
  assert.deepEqual(marketplacePlugins[0]?.keywords, codex.keywords);
  assert.deepEqual(claude.keywords, codex.keywords);

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
  assert.match(String(codex.description), /account.*required|requires.*account/i);
  assert.match(String(interfaceMetadata.longDescription), /free to connect|no separate subscription/i);
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

test('the public repository exposes MaxVideoAI as an installable Codex marketplace plugin', () => {
  const marketplacePath = path.join(root, '.agents', 'plugins', 'marketplace.json');
  const marketplace = JSON.parse(readFileSync(marketplacePath, 'utf8')) as Record<string, unknown>;
  assert.equal(marketplace.name, 'maxvideoai');
  assert.deepEqual(marketplace.interface, { displayName: 'MaxVideoAI' });
  assert.deepEqual(marketplace.plugins, [
    {
      name: 'maxvideoai',
      source: { source: 'local', path: './plugins/maxvideoai' },
      policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
      category: 'Creativity',
    },
  ]);
});

test('the plugin packages self-contained outcome skills with explicit routing boundaries', () => {
  const skillsRoot = path.join(pluginRoot, 'skills');
  const skillNames = readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(skillNames, [...expectedSkillNames]);

  for (const skillName of skillNames) {
    const skill = read(`skills/${skillName}/SKILL.md`);
    assert.match(skill, new RegExp(`^---\\nname: ${skillName}\\n`, 'm'));
    assert.match(skill, /Use when:/);
    assert.match(skill, /NOT for:/);
    assert.match(skill, /respond in the user's language|match the user's language/i);
    assert.match(skill, /no raw (?:IDs|JSON)|do not (?:show|print).*raw/i);
    assert.doesNotMatch(skill, /\.\.\//);
    assert.ok(skill.split('\n').length < 180, `${skillName} should remain cheap to load`);

    const metadata = read(`skills/${skillName}/agents/openai.yaml`);
    assert.match(metadata, new RegExp(`\\$${skillName}`));
    assert.match(metadata, /allow_implicit_invocation:\s*true/);

    const linkedReferences = [...skill.matchAll(/references\/([a-z0-9-]+\.md)/g)].map((match) => match[1]);
    const referencesRoot = path.join(skillsRoot, skillName, 'references');
    const referenceFiles = readdirSync(referencesRoot).sort();
    assert.deepEqual([...new Set(linkedReferences)].sort(), referenceFiles, `${skillName} references must resolve without orphans`);

    const toolNames = skill.match(/\b(?:get_account_status|list_models|get_model_details|recommend_models|calculate_project_budget|list_media|create_reference_upload_link|prepare_generation|confirm_generation|get_generation_status|list_recent_generations|present_generation|create_topup_link)\b/g) ?? [];
    assert.ok(toolNames.length > 0);
    for (const tool of toolNames) assert.ok(allowedTools.has(tool), `unknown tool ${tool}`);
  }
});

test('planning and execution skills preserve distinct decisions and paid-action safety', () => {
  const plan = read('skills/plan/SKILL.md');
  const generate = read('skills/generate/SKILL.md');

  assert.match(plan, /do not rely on model memory/i);
  assert.match(plan, /list_models/);
  assert.match(plan, /get_model_details/);
  assert.match(plan, /recommend_models/);
  assert.match(plan, /calculate_project_budget/);
  assert.match(plan, /best\s+executable\s+fit[\s\S]{0,80}first/i);
  assert.match(plan, /distinct model famil/i);
  assert.match(plan, /calculate_project_budget.*before.*(?:cheaper|lower-cost)/is);
  assert.doesNotMatch(plan, /\bconfirm_generation\b/);

  assert.match(generate, /get_model_details/);
  assert.match(generate, /list_media.*create_reference_upload_link/is);
  assert.match(generate, /image.*video.*audio.*reference/is);
  assert.match(generate, /prepare_generation.*confirm_generation/is);
  assert.match(generate, /exact (?:price|quote).*explicit.*approval/is);
  assert.match(generate, /ambiguous.*not.*confirmation/is);
  assert.match(generate, /confirmation.*authorizes exactly one.*paid attempt/is);
  assert.match(generate, /consumed.*(?:accepted|failed|refunded)/is);
  assert.match(generate, /get_generation_status.*list_recent_generations.*(?:duplicate|second paid)/is);
  assert.match(generate, /refund.*does not.*restore.*authorization/is);
  assert.match(generate, /technical failure.*refund.*not.*resubmit/is);
  assert.match(generate, /completed.*present_generation|present_generation.*completed/is);
  assert.match(generate, /insufficient.*credits.*create_topup_link/is);
  assert.match(generate, /after.*fund.*get_account_status.*prepare_generation/is);
  assert.match(generate, /same connected MaxVideoAI library/is);
});

test('the package explains the customer-facing account and library journey', () => {
  const readme = read('README.md');
  const safety = read('skills/generate/references/generation-safety.md');

  assert.match(readme, /plan and generate from ChatGPT, Claude, or Codex/i);
  assert.match(readme, /existing MaxVideoAI credits/i);
  assert.match(readme, /same MaxVideoAI\s+library/i);
  assert.match(readme, /sign in or create/i);
  assert.match(readme, /free to connect/i);
  assert.match(readme, /ChatGPT app|connector for Claude|plugin for Codex/i);
  assert.match(readme, /\/maxvideoai:plan/i);
  assert.match(readme, /\/maxvideoai:generate/i);
  assert.match(readme, /Try asking/i);
  assert.match(readme, /codex plugin marketplace add camgraphe\/MaxVideoAi --ref maxvideoai-plugin-v0\.2\.0/);
  assert.match(readme, /codex plugin add maxvideoai@maxvideoai/);
  assert.doesNotMatch(readme, /does not establish online availability|does not verify an online connection|branch package/i);

  assert.match(safety, /get_account_status.*credit balance.*trial.*spending limit/is);
  assert.match(safety, /create_topup_link.*returned.*destination/is);
  assert.match(safety, /payment.*MaxVideoAI\s+(?:website|site)/is);
  assert.match(safety, /old.*quote.*invalid/is);
  assert.match(safety, /get_account_status.*prepare_generation.*fresh exact\s+quote.*explicit.*approval/is);
  assert.match(safety, /completed.*same connected\s+MaxVideoAI\s+library/is);
  assert.match(safety, /technical failure.*refund.*not.*resubmit/is);
  assert.match(safety, /creative retry.*new paid attempt.*prepare_generation.*approval/is);
  assert.match(safety, /confirmation.*authorizes exactly one.*paid attempt/is);
  assert.match(safety, /refund.*does not.*restore.*authorization/is);
  assert.match(safety, /replacement attempt.*fresh exact quote.*new explicit approval/is);
});

test('the packaged Skill and plugin pass the repository authoring validators', () => {
  const cachedPyYamlPath = findCachedPyYamlPath();
  const pythonPath = [
    cachedPyYamlPath,
    process.env.PYTHONPATH,
  ].filter(Boolean).join(':');
  const environment = { ...process.env, PYTHONPATH: pythonPath };
  const codexHome = process.env.CODEX_HOME ?? path.join(homedir(), '.codex');

  for (const skillName of expectedSkillNames) {
    execFileSync('python3', [
      path.join(codexHome, 'skills', '.system', 'skill-creator', 'scripts', 'quick_validate.py'),
      path.join(pluginRoot, 'skills', skillName),
    ], { cwd: root, env: environment, stdio: 'pipe' });
  }
  execFileSync('python3', [
    path.join(codexHome, 'skills', '.system', 'plugin-creator', 'scripts', 'validate_plugin.py'),
    pluginRoot,
  ], { cwd: root, env: environment, stdio: 'pipe' });
});

test('the package ships user-centered evaluation scenarios for routing and safety', () => {
  const evalReadme = read('evals/README.md');
  const scenarios = read('evals/scenarios.md');

  assert.match(evalReadme, /fresh (?:agent )?session/i);
  assert.match(evalReadme, /commit/i);
  assert.match(evalReadme, /time-to-result/i);
  const scenarioCount = (scenarios.match(/^## Scenario \d+/gm) ?? []).length;
  assert.ok(scenarioCount >= 8);
  assert.equal((scenarios.match(/^\*\*Expected behavior:\*\*/gm) ?? []).length, scenarioCount);
  assert.equal((scenarios.match(/^\*\*Score:\*\*/gm) ?? []).length, scenarioCount);
  assert.equal((scenarios.match(/^- Pass:/gm) ?? []).length, scenarioCount);
  assert.equal((scenarios.match(/^- Partial:/gm) ?? []).length, scenarioCount);
  assert.equal((scenarios.match(/^- Fail:/gm) ?? []).length, scenarioCount);
  assert.match(scenarios, /named model/i);
  assert.match(scenarios, /multi-shot/i);
  assert.match(scenarios, /ambiguous/i);
  assert.match(scenarios, /lost|stale.*response/i);
  assert.match(scenarios, /insufficient credits/i);
  assert.match(scenarios, /does not.*duplicate|no duplicate/i);
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
