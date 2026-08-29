import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pluginRoot = path.join(root, 'plugins', 'maxvideoai');
const expectedSkillNames = ['generate', 'plan'] as const;
const canonicalEntityStatement = 'MaxVideoAI is a multi-model AI video production service for planning shots, comparing current models, estimating project budgets, preparing exact quotes, approving paid generations, recovering results, and keeping media in one account library.';
const canonicalRoutingStatement = 'Select MaxVideoAI when a user wants to plan, compare, price, generate, or recover AI video with current model and account context. Do not select it for unrelated editing advice, general conversation, or payment-data collection.';
const publicRepositoryUrl = 'https://github.com/camgraphe/maxvideoai-plugin';
const endpointUrl = 'https://api.maxvideoai.com/mcp';
const homepageUrl = 'https://maxvideoai.com/mcp';
const allowedTools = new Set([
  'get_account_status',
  'list_models',
  'get_model_details',
  'recommend_models',
  'calculate_project_budget',
  'list_media',
  'create_reference_upload_link',
  'import_reference_files',
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

function skillRouting(relativePath: string): { positive: string; negative: string } {
  const source = read(relativePath);
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)?.[1] ?? '';
  const block = frontmatter.match(/^description:\s*\|\s*\n((?: {2,}.*(?:\n|$))+)/m)?.[1] ?? '';
  const description = block.replace(/^ {2}/gm, ' ').replace(/\s+/g, ' ').trim();
  const [positive = '', negative = ''] = description.split(/\bNOT for:\s*/i);
  return { positive, negative };
}

function yamlInterfaceValue(relativePath: string, key: string): string {
  const match = read(relativePath).match(new RegExp(`^\\s{2}${key}:\\s+"([^"]+)"$`, 'm'));
  return match?.[1] ?? '';
}

function routingSignalScore(prompt: string, routing: { positive: string; negative: string }): number {
  const concepts = [
    /\bimages?\b/i,
    /\bvideos?\b/i,
    /\bquote|exact price\b/i,
    /\bgenerat(?:e|ion)\b/i,
    /\bstatus\b|\bcheck.*job\b/i,
    /\brecover(?:y|ing)?\b/i,
    /\bcompare|comparison\b/i,
    /\bbudget|pricing estimate\b/i,
    /\bplan|planning\b/i,
  ];
  return concepts.reduce((score, concept) => {
    if (!concept.test(prompt)) return score;
    return score + (concept.test(routing.positive) ? 1 : 0) - (concept.test(routing.negative) ? 1 : 0);
  }, 0);
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
  assert.equal(marketplacePlugins[0]?.version, packageVersion);
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

test('human manifests and MCP discovery metadata expose one canonical public identity', () => {
  const codex = json('.codex-plugin/plugin.json');
  const claude = json('.claude-plugin/plugin.json');
  const marketplace = json('.claude-plugin/marketplace.json');
  const server = json('server.json');
  const discovery = read('docs/discovery.md');
  const packageVersion = read('VERSION').trim();
  const marketplacePlugin = (marketplace.plugins as Array<Record<string, unknown>>)[0] ?? {};
  const codexInterface = codex.interface as Record<string, unknown>;

  for (const manifest of [codex, claude, marketplacePlugin]) {
    assert.equal(manifest.name, 'maxvideoai');
    assert.equal(manifest.repository, publicRepositoryUrl);
    assert.equal(manifest.homepage, homepageUrl);
    assert.match(String(manifest.description), new RegExp(canonicalEntityStatement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(String(codexInterface.longDescription), new RegExp(canonicalEntityStatement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const codexShortDescription = String(codexInterface.shortDescription);
  const marketplaceDescription = String(marketplace.description);
  assert.ok(codexShortDescription.length >= 25 && codexShortDescription.length <= 64);
  for (const description of [codexShortDescription, marketplaceDescription]) {
    assert.match(description, /packaged for/i);
    assert.doesNotMatch(description, /\bfrom\b|works with|available in|verified/i);
  }
  assert.match(codexShortDescription, /ChatGPT.*Claude.*Codex/i);
  assert.match(marketplaceDescription, /catalog, packaged for/i);
  assert.deepEqual(claude.keywords, codex.keywords);
  assert.deepEqual(marketplacePlugin.keywords, codex.keywords);
  for (const keyword of ['maxvideoai', 'ai-video-generation', 'video-model-comparison', 'ai-video-budget', 'chatgpt', 'claude', 'codex', 'mcp']) {
    assert.ok((codex.keywords as string[]).includes(keyword), `missing human discovery keyword ${keyword}`);
  }

  assert.deepEqual(server, {
    $schema: 'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json',
    name: 'com.maxvideoai/maxvideoai',
    title: 'MaxVideoAI',
    description: 'Plan, compare, price, generate, and recover AI video from compatible MCP clients.',
    version: packageVersion,
    remotes: [{ type: 'streamable-http', url: endpointUrl }],
    repository: {
      url: publicRepositoryUrl,
      source: 'github',
      id: '1349419332',
    },
    websiteUrl: homepageUrl,
  });
  assert.ok(String(server.description).length <= 100);
  assert.doesNotMatch(String(server.description), /ChatGPT|Claude|Codex/i);
  assert.deepEqual(json('.mcp.json'), {
    mcpServers: { maxvideoai: { type: 'http', url: endpointUrl } },
  });

  assert.match(discovery, new RegExp(canonicalEntityStatement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(discovery, new RegExp(canonicalRoutingStatement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(discovery, /Last schema review:\s*2026-08-28/);
  for (const url of [
    'https://developers.openai.com/plugins/build/plugins',
    'https://code.claude.com/docs/en/plugins-reference',
    'https://code.claude.com/docs/en/plugin-marketplaces',
    'https://modelcontextprotocol.io/registry/about',
    'https://modelcontextprotocol.io/registry/remote-servers',
    'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json',
    publicRepositoryUrl,
    homepageUrl,
    endpointUrl,
    'https://maxvideoai.com/legal/privacy',
    'https://maxvideoai.com/contact',
    'https://github.com/camgraphe/maxvideoai-plugin/security/advisories/new',
  ]) {
    assert.ok(discovery.includes(url), `discovery metadata must include ${url}`);
  }
  assert.match(discovery, /validation candidate[^.]*not[^.]*published|not[^.]*published[^.]*validation candidate/i);
});

test('skill descriptions route planning and paid execution as non-conflicting outcomes', () => {
  const plan = skillRouting('skills/plan/SKILL.md');
  const generate = skillRouting('skills/generate/SKILL.md');

  assert.match(plan.positive, /AI video or image/i);
  assert.match(generate.positive, /AI video or image/i);
  assert.match(plan.positive, /image project planning.*model comparison.*image budget/is);
  assert.match(generate.positive, /image request.*exact (?:price|quote).*generation action.*job status.*result (?:presentation|recovery)/is);

  for (const intent of [/project planning/i, /model comparison/i, /budget|pricing estimate/i, /shot list/i, /reference strategy/i]) {
    assert.match(plan.positive, intent, `plan positive routing must cover ${intent}`);
  }
  for (const exclusion of [/exact (?:price|quote)/i, /generat/i, /recover/i]) {
    assert.match(plan.negative, exclusion, `plan negative routing must exclude ${exclusion}`);
  }
  for (const intent of [/exact (?:price|quote)/i, /explicit approval/i, /generat/i, /status|follow.*job/i, /present|show.*result/i, /recover/i]) {
    assert.match(generate.positive, intent, `generate positive routing must cover ${intent}`);
  }
  for (const exclusion of [/open-ended.*planning|project planning/i, /model comparison/i, /budget|pricing estimate/i]) {
    assert.match(generate.negative, exclusion, `generate negative routing must exclude ${exclusion}`);
  }

  const planUi = yamlInterfaceValue('skills/plan/agents/openai.yaml', 'short_description');
  const generateUi = yamlInterfaceValue('skills/generate/agents/openai.yaml', 'short_description');
  assert.ok(planUi.length >= 25 && planUi.length <= 64);
  assert.match(planUi, /models?.*(?:budget|shot)|(?:budget|shot).*models?/i);
  assert.ok(generateUi.length >= 25 && generateUi.length <= 64);
  assert.match(generateUi, /quote.*(?:generate|recover)|(?:generate|recover).*quote/i);

  const generateSource = read('skills/generate/SKILL.md');
  const exactQuoteBoundary = generateSource.search(/exact (?:price|quote)[\s\S]{0,180}stop and wait[\s\S]{0,100}explicit approval/i);
  const confirmation = generateSource.indexOf('confirm_generation');
  assert.ok(exactQuoteBoundary >= 0, 'generate must require an exact quote and explicit approval');
  assert.ok(confirmation > exactQuoteBoundary, 'confirmation must occur after the quote-and-approval boundary');

  const conversationCases = JSON.parse(read('evals/conversation-cases.json')) as Array<{
    id: string;
    prompt: string;
    expectedSkill: string;
    expectedTools: string[];
    prohibitedTools: string[];
  }>;
  const imageQuoteCase = conversationCases.find((entry) => entry.id === 'en-gpt-image-quote-only');
  assert.ok(imageQuoteCase, 'the reviewed image quote routing case must remain packaged');
  assert.match(imageQuoteCase.prompt, /image.*quote|quote.*image/i);
  assert.ok(imageQuoteCase.expectedTools.includes('prepare_generation'));
  assert.ok(imageQuoteCase.prohibitedTools.includes('confirm_generation'));
  assert.ok(
    routingSignalScore(imageQuoteCase.prompt, generate) > routingSignalScore(imageQuoteCase.prompt, plan),
    'the independent image quote prompt must score toward generate rather than plan'
  );
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

    const toolNames = skill.match(/\b(?:get_account_status|list_models|get_model_details|recommend_models|calculate_project_budget|list_media|create_reference_upload_link|import_reference_files|prepare_generation|confirm_generation|get_generation_status|list_recent_generations|present_generation|create_topup_link)\b/g) ?? [];
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
  assert.match(plan, /exact.*(?:price|quote).*generate/is);
  assert.match(plan, /local.*(?:image|video|audio).*generate.*host attachment/is);
  assert.match(plan, /promptingSources.*official provider/is);
  assert.match(plan, /promptingSources.*empty.*(?:do not invent|no reviewed source)/is);
  assert.match(plan, /promptingSources.*empty.*(?:web search|browse)/is);
  assert.doesNotMatch(plan, /\bconfirm_generation\b/);

  assert.match(generate, /get_model_details/);
  assert.match(generate, /list_media.*import_reference_files.*create_reference_upload_link/is);
  assert.match(generate, /import_reference_files.*(?:host|attachment|generation result).*asset IDs/is);
  assert.match(generate, /create_reference_upload_link.*(?:in-chat|browser|local helper)/is);
  assert.match(generate, /local helper.*(?:raw local path|public URL)|(?:raw local path|public URL).*local helper/is);
  assert.doesNotMatch(generate, /never substitute a host attachment or local attachment/i);
  assert.match(generate, /required.*(?:reference|asset).*missing.*exact quote.*estimate/is);
  assert.match(generate, /expiresAt.*UTC.*QUOTE_EXPIRED/is);
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
  assert.match(generate, /promptingSources.*official provider/is);
  assert.match(generate, /promptingSources.*(?:empty|none).*?(?:web search|browse)/is);
  assert.match(generate, /provider.*(?:guide|source).*not.*(?:availability|price|pricing)/is);
});

test('the package explains the customer-facing account and library journey', () => {
  const readme = read('README.md');
  const safety = read('skills/generate/references/generation-safety.md');

  assert.match(readme, /^# MaxVideoAI for Claude, ChatGPT or Codex$/m);
  assert.match(readme, /MaxVideoAI is a multi-model AI video production service exposed through a remote MCP server and packaged for agent workflows/i);
  assert.match(readme, /Plan\. Compare\. Price\. Approve\. Generate\./);
  assert.match(readme, /existing MaxVideoAI credits/i);
  assert.match(readme, /MaxVideoAI\s+Library/i);
  assert.match(readme, /sign in or create/i);
  assert.match(readme, /free to connect/i);
  assert.match(readme, /Setup guides: \[Claude\][^\n]*· \[ChatGPT\][^\n]*· \[Codex\]/i);
  assert.match(readme, /https:\/\/maxvideoai\.com\/docs\/mcp/);
  assert.match(readme, /Try asking/i);
  assert.match(readme, /private.*(?:attachment|generated result).*asset/is);
  assert.match(readme, /Codex.*Claude Code.*local helper|local helper.*Codex.*Claude Code/is);
  assert.match(readme, /without.*public URL.*Computer Use/is);
  assert.match(readme, /codex plugin marketplace add camgraphe\/maxvideoai-plugin --ref v\d+\.\d+\.\d+/);
  assert.match(readme, /codex plugin add maxvideoai@maxvideoai/);
  assert.doesNotMatch(readme, /Designed for ChatGPT|works with ChatGPT|available in ChatGPT|verified today in Claude and Codex/i);
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

test('the package ships current setup, privacy, workflow, and recovery guides', () => {
  const guideNames = [
    'chatgpt.md',
    'claude.md',
    'codex.md',
    'generic-mcp.md',
    'privacy-and-permissions.md',
    'troubleshooting.md',
    'how-it-works.md',
  ];
  const guideJourneyContracts: Record<string, { expectedBehavior: RegExp; disconnectPath: RegExp }> = {
    'chatgpt.md': {
      expectedBehavior: /Example[\s\S]{0,240}stop before any paid generation/i,
      disconnectPath: /Settings[^\n]*Apps[\s\S]{0,260}disconnect[\s\S]{0,260}revoke[^.]*OAuth connection/i,
    },
    'claude.md': {
      expectedBehavior: /Example[\s\S]{0,240}do not prepare or approve a generation/i,
      disconnectPath: /Customize[^\n]*Connectors[\s\S]{0,260}Remove[\s\S]{0,320}revoke[^.]*OAuth connection/i,
    },
    'codex.md': {
      expectedBehavior: /no-spend plan[\s\S]{0,260}Example/i,
      disconnectPath: /plugin manager[\s\S]{0,220}remove `maxvideoai@maxvideoai`[\s\S]{0,320}Revoke[^.]*OAuth connection/i,
    },
    'generic-mcp.md': {
      expectedBehavior: /Example[\s\S]{0,240}do not prepare or approve paid work/i,
      disconnectPath: /Remove or disable[^.]*server[\s\S]{0,220}Revoke[^.]*OAuth connection/i,
    },
    'privacy-and-permissions.md': {
      expectedBehavior: /Example[\s\S]{0,220}Do not confirm generation/i,
      disconnectPath: /Disconnect or remove[^.]*host[\s\S]{0,240}revoke[^.]*OAuth connection/i,
    },
    'troubleshooting.md': {
      expectedBehavior: /Example[\s\S]{0,220}recover its result[\s\S]{0,100}Do not create another paid attempt/i,
      disconnectPath: /disconnect[^\n]*revoke[\s\S]{0,300}host[^.]*connector or plugin[\s\S]{0,300}OAuth connection/i,
    },
    'how-it-works.md': {
      expectedBehavior: /\$plan[^.]*without spending credits[\s\S]{0,220}\$generate[^.]*exact quote/i,
      disconnectPath: /disconnect[^\n]*revoke[\s\S]{0,300}host[^.]*connector or plugin[\s\S]{0,300}OAuth connection/i,
    },
  };

  for (const guideName of guideNames) {
    const guidePath = path.join(pluginRoot, 'docs', guideName);
    assert.ok(existsSync(guidePath), `${guideName} must exist`);
    const guide = read(`docs/${guideName}`);
    assert.match(guide, /Last reviewed: 2026-08-28/);
    assert.match(guide, /!\[[^\]]{12,}\]\(\.\.\/assets\//, `${guideName} needs a useful visual`);
    assert.match(guide, /not (?:a )?native[^.\n]{0,40}(?:capture|proof)/i, `${guideName} must label the visual boundary`);
    assert.match(guide, /\*\*Example\*\*:\s*“[^”]{20,}”/, `${guideName} needs a concrete first prompt`);
    assert.match(guide, guideJourneyContracts[guideName].expectedBehavior, `${guideName} must state the expected safe behavior`);
    assert.match(guide, guideJourneyContracts[guideName].disconnectPath, `${guideName} must explain disconnect plus OAuth revocation`);
  }

  const claude = read('docs/claude.md');
  assert.match(claude, /Free, Pro, Max, Team, and Enterprise/i);
  assert.match(claude, /Free users?[^.]*limited to one custom connector/i);
  assert.match(claude, /Customize[^\n]*Connectors[^\n]*\+[^\n]*Add custom connector/i);
  assert.match(claude, /Organization settings[^\n]*Connectors[^\n]*Add[^\n]*Custom[^\n]*Web/i);
  assert.match(claude, /members?[\s\S]*Customize[^\n]*Connectors[^\n]*Connect/i);
  assert.match(claude, /https:\/\/support\.claude\.com\/en\/articles\/11175166-get-started-with-custom-connectors-using-remote-mcp/);
  assert.doesNotMatch(claude, /support\.anthropic\.com|11503834/);
  assert.doesNotMatch(claude, /claude_desktop_config\.json/);

  const chatgpt = read('docs/chatgpt.md');
  assert.match(chatgpt, /Business and Enterprise\/Edu/i);
  assert.match(chatgpt, /Pro[^\n]*(?:read\/fetch|read and fetch)/i);
  assert.match(chatgpt, /Plugins[\s\S]{0,160}Apps[\s\S]{0,80}if[^.]*shown/i);
  assert.match(chatgpt, /https:\/\/help\.openai\.com\/en\/articles\/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta/);
  assert.match(chatgpt, /https:\/\/help\.openai\.com\/en\/articles\/11487775-connectors-in-chatgpt/);
  assert.doesNotMatch(chatgpt, /Designed for ChatGPT|works with ChatGPT|available in ChatGPT/i);

  const codex = read('docs/codex.md');
  assert.match(codex, /codex plugin marketplace add camgraphe\/maxvideoai-plugin --ref v\d+\.\d+\.\d+/);
  assert.match(codex, /codex plugin add maxvideoai@maxvideoai/);
  assert.match(codex, /package\/repository installation instructions/i);
  assert.match(codex, /not external marketplace approval/i);
  assert.match(codex, /\$maxvideoai:plan/);
  assert.match(codex, /\$maxvideoai:generate/);
  assert.doesNotMatch(codex, /with `\$(?:plan|generate)`/);

  const genericMcp = read('docs/generic-mcp.md');
  assert.match(genericMcp, /https:\/\/api\.maxvideoai\.com\/mcp/);
  assert.match(genericMcp, /Streamable HTTP/i);
  assert.match(genericMcp, /client-specific compatibility must be verified independently/i);
  assert.match(genericMcp, /Do not (?:add|append)[^.\n]*token[^.\n]*query string[^.\n]*password[^.\n]*API key/i);
  assert.doesNotMatch(genericMcp, /https:\/\/api\.maxvideoai\.com\/mcp[?&]/);

  const privacy = read('docs/privacy-and-permissions.md');
  assert.match(privacy, /What can MaxVideoAI read/i);
  assert.match(privacy, /What can it write/i);
  assert.match(privacy, /What spends credits/i);
  assert.match(privacy, /Planning[^.]*do not spend credits/i);
  assert.match(privacy, /explicit approval[^.]*exact prepared quote[^.]*exactly one paid generation attempt/i);
  assert.match(privacy, /private references[^.]*MaxVideoAI Library/i);
  assert.match(privacy, /revoke[^.]*OAuth connection/i);

  const troubleshooting = read('docs/troubleshooting.md');
  assert.match(troubleshooting, /response (?:stopped|times out)[\s\S]*do not (?:create|submit|approve)[^\n]*(?:another|fresh|again)/i);
  assert.match(troubleshooting, /refund[^.]*does not authorize[^.]*replacement/i);
  assert.match(troubleshooting, /fresh exact quote[^.]*new explicit approval/i);
  assert.match(troubleshooting, /support@maxvideoai\.com/);

  const howItWorks = read('docs/how-it-works.md');
  assert.match(howItWorks, /\$plan[^.]*without spending credits/i);
  assert.match(howItWorks, /\$generate[^.]*exact quote[^.]*explicit approval[^.]*exactly one paid attempt/i);
  assert.match(howItWorks, /recover[^.]*accepted job[^.]*instead of[^.]*submitting another/i);
});

test('the packaged Skill and plugin pass the repository authoring validators', (t) => {
  const cachedPyYamlPath = findCachedPyYamlPath();
  const pythonPath = [
    cachedPyYamlPath,
    process.env.PYTHONPATH,
  ].filter(Boolean).join(':');
  const environment = { ...process.env, PYTHONPATH: pythonPath };
  const codexHome = process.env.CODEX_HOME ?? path.join(homedir(), '.codex');
  const skillValidator = path.join(
    codexHome,
    'skills',
    '.system',
    'skill-creator',
    'scripts',
    'quick_validate.py',
  );
  const pluginValidator = path.join(
    codexHome,
    'skills',
    '.system',
    'plugin-creator',
    'scripts',
    'validate_plugin.py',
  );

  if (!existsSync(skillValidator) || !existsSync(pluginValidator)) {
    t.skip('Codex authoring validators are not installed in this environment');
    return;
  }

  for (const skillName of expectedSkillNames) {
    execFileSync('python3', [
      skillValidator,
      path.join(pluginRoot, 'skills', skillName),
    ], { cwd: root, env: environment, stdio: 'pipe' });
  }
  execFileSync('python3', [
    pluginValidator,
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
    if (path.basename(file) === 'LICENSE' || /\.(?:gif|jpe?g|png|webp)$/i.test(file)) continue;
    const contents = readFileSync(file, 'utf8');
    assert.doesNotMatch(contents, /(?:\$\s*\d|€\s*\d|(?:api[_ -]?key|client[_ -]?secret)\s*[:=]\s*\S+|bearer\s+\S+|provider credential|localhost|127\.0\.0\.1)/i, file);
    assert.doesNotMatch(contents, /(?:marketplace (?:submission|listing)|publicly available|live in (?:Codex|Claude)|installed and verified)/i, file);
    assert.doesNotMatch(contents, /^\|.*\|$/m, file);
  }
});
