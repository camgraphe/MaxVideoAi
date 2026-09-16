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

test('the plugin README covers the current assistant, agent, and automation ecosystem with safe compatibility language', () => {
  const readmePath = path.join(repositoryRoot, 'plugins', 'maxvideoai', 'README.md');
  const readme = readFileSync(readmePath, 'utf8');
  const lines = readme.split(/\r?\n/);
  const words = readme.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? [];
  const opening = lines.slice(0, 60).join('\n');
  const definition = readme.split(/\n{2,}/)[1] ?? '';
  const definitionWords = definition.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? [];

  assert.equal(lines[0], '# MaxVideoAI for assistants, agents, and automations');
  assert.ok(words.length < 1_800, `README must stay under 1,800 words; found ${words.length}`);
  assert.ok(definitionWords.length >= 40 && definitionWords.length <= 60, `opening definition must be 40–60 words; found ${definitionWords.length}`);
  assert.match(definition, /MaxVideoAI is a multi-model AI production service exposed through one remote MCP server/i);
  assert.match(definition, /plan video and image work/i);
  assert.match(opening, /assets\/screenshots\/maxvideoai-assistant-workflow-live\.webp/);
  assert.match(opening, /codex plugin marketplace add camgraphe\/maxvideoai-plugin --ref v\d+\.\d+\.\d+/);
  assert.match(opening, /https:\/\/maxvideoai\.com\/docs\/mcp/);
  for (const canonicalUrl of [
    'https://maxvideoai.com/mcp',
    'https://maxvideoai.com/models',
    'https://maxvideoai.com/pricing',
    'https://maxvideoai.com/tools',
    'https://maxvideoai.com/integrations/openclaw',
    'https://maxvideoai.com/integrations/n8n',
    'https://maxvideoai.com/app/library',
    'https://maxvideoai.com/legal/privacy',
    'https://maxvideoai.com/legal/terms',
    'https://maxvideoai.com/contact',
  ]) {
    assert.match(readme, new RegExp(canonicalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const visual of [
    'assets/screenshots/maxvideoai-workspace-live.webp',
    'assets/screenshots/maxvideoai-examples-gallery-live.webp',
    'assets/screenshots/maxvideoai-engine-scoreboard-live.webp',
    'assets/screenshots/maxvideoai-pricing-comparison-live.webp',
    'assets/screenshots/maxvideoai-tools-workflow-live.webp',
    'assets/screenshots/maxvideoai-library-continuity-production.jpg',
  ]) {
    assert.match(readme, new RegExp(visual.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(readme, /recommendation is a capability match[^\n]*not a guarantee[^\n]*paid quote/i);
  assert.match(readme, /OpenClaw[\s\S]*tested with limits[\s\S]*ClawHub/i);
  assert.match(readme, /n8n[\s\S]*self-hosted[\s\S]*deterministic MCP Client workflow/i);
  assert.match(readme, /Cursor[\s\S]*GitHub Copilot[\s\S]*Gemini CLI[\s\S]*Microsoft Copilot[\s\S]*in preparation/i);
  assert.match(readme, /current live MCP surface[\s\S]*video and image[\s\S]*planning, quoting, generation, recovery/i);
  assert.match(readme, /Audio generation[\s\S]*Studio montage[\s\S]*behind server publication gates[\s\S]*not claimed as live/i);
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

test('release-facing install copy follows VERSION and the focused public repository', () => {
  const pluginRoot = path.join(repositoryRoot, 'plugins', 'maxvideoai');
  const version = readFileSync(path.join(pluginRoot, 'VERSION'), 'utf8').trim();
  const expectedInstallCommand = `codex plugin marketplace add camgraphe/maxvideoai-plugin --ref v${version}`;
  const pluginReadme = readFileSync(path.join(pluginRoot, 'README.md'), 'utf8');
  const codexGuide = readFileSync(path.join(pluginRoot, 'docs', 'codex.md'), 'utf8');
  const sourceReadme = readFileSync(path.join(repositoryRoot, 'README.md'), 'utf8');

  for (const releaseSurface of [pluginReadme, codexGuide]) {
    assert.match(releaseSurface, new RegExp(expectedInstallCommand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(releaseSurface, /camgraphe\/MaxVideoAi --ref maxvideoai-plugin-v/i);
  }

  assert.match(pluginReadme, /\[Public releases\]\(https:\/\/github\.com\/camgraphe\/maxvideoai-plugin\/releases\)/);
  assert.doesNotMatch(pluginReadme, /Checked-in source candidate|Public release:\s*\[v\d/i);
  assert.match(sourceReadme, /\[Plugin releases\]\(https:\/\/github\.com\/camgraphe\/maxvideoai-plugin\/releases\)/);
  assert.doesNotMatch(sourceReadme, /checked-in[^.\n]*candidate|Latest public release:\s*v\d/i);
});

test('the ChatGPT guide keeps direct MCP available without promising an OpenAI directory listing', () => {
  const guide = readFileSync(path.join(repositoryRoot, 'plugins', 'maxvideoai', 'docs', 'chatgpt.md'), 'utf8');
  const officialSources = [
    'https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta',
    'https://help.openai.com/en/articles/11487775-connectors-in-chatgpt',
    'https://help.openai.com/en/articles/20001256-plugins-in-codex',
    'https://maxvideoai.com/docs/mcp',
  ];
  const developerPath = guide.match(/### Direct developer MCP connection\n([\s\S]*?)(?=\n### |\n## )/)?.[1] ?? '';
  const disconnectPath = guide.match(/## How do I disconnect and revoke access\?\n([\s\S]*?)(?=\n## )/)?.[1] ?? '';

  assert.match(guide, /^# Use MaxVideoAI with ChatGPT\s*$/m);
  assert.match(guide, /ChatGPT and Codex use the same MaxVideoAI MCP connection/i);
  assert.match(guide, /connect it in ChatGPT developer mode[\s\S]*OAuth on the first use/i);
  assert.match(guide, /not submitted to the OpenAI directory[\s\S]*current commerce policy/i);
  assert.match(guide, /directory decision[\s\S]*does not disable the live developer-mode setup/i);
  assert.match(
    guide,
    /\[OpenAI: Plugins in ChatGPT and Codex\]\(https:\/\/help\.openai\.com\/en\/articles\/20001256-plugins-in-codex\)/,
  );
  assert.match(developerPath, /developer mode[\s\S]*Apps → Create[\s\S]*`https:\/\/api\.maxvideoai\.com\/mcp`[\s\S]*Scan Tools/i);
  assert.match(disconnectPath, /users manage the app connection[\s\S]*connected account[\s\S]*where shown/i);
  assert.match(disconnectPath, /revoke[\s\S]*MaxVideoAI OAuth/i);
  assert.doesNotMatch(disconnectPath, /sync deletion|delete (?:the )?sync|delete synced|destructive removal/i);
  assert.match(guide, /Full MCP beta: Business and Enterprise\/Edu on ChatGPT web[\s\S]*Pro: read\/fetch MCP permissions in developer mode/i);
  assert.match(guide, /!\[Current MaxVideoAI home page paired with the public MCP result section for Claude\]\(\.\.\/assets\/demos\/brief-to-video-workflow\.webp\)/);
  assert.match(guide, /MaxVideoAI product proof[\s\S]*public home page[\s\S]*saved-to-Library[\s\S]*not native ChatGPT host proof/i);
  assert.match(guide, /Connect direct MCP → OAuth on first use → review tools → plan without spending → approve one quoted attempt → recover from the Library/i);
  assert.doesNotMatch(guide, /after (?:OpenAI )?approval|public listing approval|when it is available in the public directory/i);
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

test('rejects a multiline HTML image without descriptive alt text', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'maxvideoai-content-'));
  const fixturePath = path.join(directory, 'multiline-image.md');

  try {
    writeFileSync(
      fixturePath,
      [
        '# MaxVideoAI',
        '',
        '<img',
        '  src="proof.png"',
        '  alt="screenshot"',
        '>',
        '',
        '```html',
        '<img',
        '  src="example.png"',
        '>',
        '```',
      ].join('\n'),
      'utf8',
    );
    const result = spawnSync(process.execPath, [checkerPath, fixturePath], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /multiline-image\.md:3: every image needs descriptive alt text.*screenshot/i);
    assert.doesNotMatch(result.stderr, /multiline-image\.md:9:/i);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
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
