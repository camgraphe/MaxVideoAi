import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkerPath = path.join(repositoryRoot, 'scripts/check-github-content.mjs');
const fixturesDirectory = path.join(repositoryRoot, 'tests/fixtures/github-content');

function checkFixture(name: string) {
  return spawnSync(process.execPath, [checkerPath, path.join(fixturesDirectory, name)], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
}

test('the plugin README is a proof-led conversion surface with safe compatibility language', () => {
  const readmePath = path.join(repositoryRoot, 'plugins', 'maxvideoai', 'README.md');
  const readme = readFileSync(readmePath, 'utf8');
  const lines = readme.split(/\r?\n/);
  const words = readme.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? [];
  const opening = lines.slice(0, 60).join('\n');
  const definition = readme.split(/\n{2,}/)[1] ?? '';
  const definitionWords = definition.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? [];

  assert.equal(lines[0], '# MaxVideoAI for Claude, ChatGPT or Codex');
  assert.ok(words.length < 1_800, `README must stay under 1,800 words; found ${words.length}`);
  assert.ok(definitionWords.length >= 40 && definitionWords.length <= 60, `opening definition must be 40–60 words; found ${definitionWords.length}`);
  assert.match(definition, /MaxVideoAI is a multi-model AI video production service exposed through a remote MCP server and packaged for agent workflows/i);
  assert.match(opening, /assets\/demos\/readme-proof-hero\.webp/);
  assert.match(opening, /codex plugin marketplace add camgraphe\/MaxVideoAi --ref maxvideoai-plugin-v0\.2\.0/);
  assert.match(opening, /https:\/\/maxvideoai\.com\/docs\/mcp/);
  for (const canonicalUrl of [
    'https://maxvideoai.com/mcp',
    'https://maxvideoai.com/models',
    'https://maxvideoai.com/pricing',
    'https://maxvideoai.com/app/library',
    'https://maxvideoai.com/legal/privacy',
    'https://maxvideoai.com/legal/terms',
    'https://maxvideoai.com/contact',
  ]) {
    assert.match(readme, new RegExp(canonicalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(readme, /assets\/demos\/brief-to-video-workflow\.webp/);
  assert.match(readme, /assets\/demos\/model-choice-and-budget\.webp/);
  assert.match(readme, /assets\/(?:demos\/library-continuity\.webp|screenshots\/maxvideoai-library-continuity-production\.jpg)/);
  assert.match(readme, /image shows[^\n]*(?:selection|product)[^\n]*result[^\n]*not[^\n]*(?:quote|approval|budget)/i);
  assert.doesNotMatch(readme, /Designed for ChatGPT|works with ChatGPT|available in ChatGPT|verified today in Claude and Codex/i);

  const setupGuideOrder = [
    '[Claude](docs/claude.md)',
    '[ChatGPT](docs/chatgpt.md)',
    '[Codex](docs/codex.md)',
  ];
  let previousGuide = -1;
  for (const setupGuide of setupGuideOrder) {
    const currentGuide = opening.indexOf(setupGuide);
    assert.ok(currentGuide > previousGuide, `${setupGuide} must appear in the reviewed host order`);
    previousGuide = currentGuide;
  }

  const result = spawnSync(process.execPath, [checkerPath, readmePath], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
});

test('the ChatGPT guide presents the shared plugin journey with qualified proof and fallback', () => {
  const guide = readFileSync(path.join(repositoryRoot, 'plugins', 'maxvideoai', 'docs', 'chatgpt.md'), 'utf8');
  const officialSources = [
    'https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta',
    'https://help.openai.com/en/articles/11487775-connectors-in-chatgpt',
    'https://help.openai.com/en/articles/20001256-plugins-in-codex',
    'https://maxvideoai.com/docs/mcp',
  ];
  const publicPluginPath = guide.match(/### Public directory plugin\n([\s\S]*?)(?=\n### |\n## )/)?.[1] ?? '';
  const developerFallbackPath = guide.match(/### Direct developer MCP fallback\n([\s\S]*?)(?=\n### |\n## )/)?.[1] ?? '';
  const disconnectPath = guide.match(/## How do I disconnect and revoke access\?\n([\s\S]*?)(?=\n## )/)?.[1] ?? '';

  assert.match(guide, /^# Use MaxVideoAI with ChatGPT\s*$/m);
  assert.match(guide, /ChatGPT and Codex use the same MaxVideoAI plugin and (?:the same )?MCP connection/i);
  assert.match(guide, /install or connect[\s\S]*OAuth on the first use/i);
  assert.match(guide, /public directory availability[\s\S]{0,80}listing is approved/i);
  assert.match(guide, /developer MCP URL fallback[\s\S]*`https:\/\/api\.maxvideoai\.com\/mcp`/i);
  assert.match(
    guide,
    /\[OpenAI: Plugins in ChatGPT and Codex\]\(https:\/\/help\.openai\.com\/en\/articles\/20001256-plugins-in-codex\)/,
  );
  assert.match(publicPluginPath, /\*\*Plugins\*\* in ChatGPT[\s\S]*\*\*Apps\*\* if (?:that is|it is) shown[\s\S]*select MaxVideoAI[\s\S]*\*\*Install plugin\*\* if shown[\s\S]*\*\*Connect\*\* if prompted[\s\S]*complete OAuth/i);
  assert.match(publicPluginPath, /@MaxVideoAI[\s\S]*\+ → More[\s\S]*when (?:those controls|the control) (?:are|is) available/i);
  assert.match(developerFallbackPath, /developer mode[\s\S]*Apps → Create[\s\S]*`https:\/\/api\.maxvideoai\.com\/mcp`[\s\S]*Scan Tools/i);
  assert.match(disconnectPath, /workspace admins[\s\S]*Workspace settings → Plugins/i);
  assert.match(disconnectPath, /users[\s\S]*app connection[\s\S]*connected account[\s\S]*where shown/i);
  assert.match(disconnectPath, /revoke[\s\S]*MaxVideoAI OAuth/i);
  assert.doesNotMatch(disconnectPath, /sync deletion|delete (?:the )?sync|delete synced|destructive removal/i);
  assert.match(guide, /Full MCP beta: Business and Enterprise\/Edu on ChatGPT web[\s\S]*Pro: read\/fetch MCP permissions in developer mode/i);
  assert.match(guide, /!\[Completed MaxVideoAI video continuing from the production workspace into the Library\]\(\.\.\/assets\/demos\/brief-to-video-workflow\.webp\)/);
  assert.match(guide, /MaxVideoAI product proof[\s\S]*workspace[\s\S]*Library[\s\S]*not native ChatGPT host proof/i);
  assert.match(guide, /Install or connect → OAuth on first use → review tools → plan without spending → approve one quoted attempt → recover from the Library/i);
  assert.doesNotMatch(guide, /unverified|not yet recorded|setup guide to validate|not an availability promise/i);
  for (const source of officialSources) {
    assert.match(guide, new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  const result = spawnSync(process.execPath, [checkerPath, path.join(repositoryRoot, 'plugins', 'maxvideoai', 'docs', 'chatgpt.md')], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
});

test('the root README passes the shared editorial-rhythm checker', () => {
  const readmePath = path.join(repositoryRoot, 'README.md');
  const result = spawnSync(process.execPath, [checkerPath, readmePath], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
});

test('all plugin guides exist and preserve the no-Markdown-table safety invariant', () => {
  const docsRoot = path.join(repositoryRoot, 'plugins', 'maxvideoai', 'docs');
  const guideNames = [
    'chatgpt.md',
    'claude.md',
    'codex.md',
    'generic-mcp.md',
    'privacy-and-permissions.md',
    'troubleshooting.md',
    'how-it-works.md',
  ];

  for (const guideName of guideNames) {
    const guidePath = path.join(docsRoot, guideName);
    assert.ok(existsSync(guidePath), `${guideName} must exist`);
    const guide = readFileSync(guidePath, 'utf8');
    assert.doesNotMatch(guide, /^\|.*\|$/m, `${guideName} must not use Markdown tables`);
    assert.match(guide, /## Sources\n[\s\S]*https:\/\//, `${guideName} must cite a live source`);
    const result = spawnSync(process.execPath, [checkerPath, guidePath], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
  }
});

test('accepts a README fixture with concrete proof and an editorial rhythm', () => {
  const result = checkFixture('compliant.md');

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /passes GitHub content checks/i);
});

test('rejects banned commercial language and unsupported superlatives', () => {
  const result = checkFixture('hype.md');

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /banned commercial shortcut.*revolutionary/i);
  assert.match(result.stderr, /unsupported superlative.*best/i);
});

test('rejects non-descriptive image alt text', () => {
  const result = checkFixture('hype.md');

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /descriptive alt text.*demo/i);
  assert.match(result.stderr, /descriptive alt text.*photo/i);
  assert.match(result.stderr, /descriptive alt text.*graphic/i);
  assert.match(result.stderr, /descriptive alt text.*\(empty\)/i);
});

test('does not treat fenced code identifiers as commercial superlatives', () => {
  const result = checkFixture('compliant.md');

  assert.equal(result.status, 0, result.stderr);
});

test('rejects a text wall that exceeds cadence limits', () => {
  const result = checkFixture('text-wall.md');

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /first 60 README lines/i);
  assert.match(result.stderr, /220 consecutive prose words/i);
  assert.match(result.stderr, /two consecutive H2 sections are text-only/i);
});

test('treats a labeled concrete example as a cadence break', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'maxvideoai-content-'));
  const fixturePath = path.join(directory, 'concrete-example.md');
  const prose = Array.from({ length: 150 }, () => 'producer').join(' ');

  try {
    writeFileSync(fixturePath, `# MaxVideoAI\n\n![Finished video returned in a conversation](proof.png)\n\n${prose}\n\nExample: Compare current models for the hero shot before you request a quote.\n\n${prose}\n`, 'utf8');
    const result = spawnSync(process.execPath, [checkerPath, fixturePath], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('counts ordinary blockquoted prose toward the cadence limit', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'maxvideoai-content-'));
  const fixturePath = path.join(directory, 'quoted-text-wall.md');
  const prose = Array.from({ length: 221 }, () => 'producer').join(' ');

  try {
    writeFileSync(fixturePath, `# MaxVideoAI\n\n![Finished video returned in a conversation](proof.png)\n\n> ${prose}\n`, 'utf8');
    const result = spawnSync(process.execPath, [checkerPath, fixturePath], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /220 consecutive prose words/i);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
