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

// These consumers share refreshed public-page composites, not the former
// workspace/Library captures. Check their visible alt text and proof caption.
for (const consumer of [
  'examples/creator-budget-comparison.md',
  'examples/recover-a-generation.md',
  'docs/generic-mcp.md',
  'examples/claude-video-production.md',
  'examples/product-launch-plan.md',
]) {
  test(`${consumer} describes the public home/Claude composite without stale workspace proof claims`, () => {
    const document = readFileSync(path.join(repositoryRoot, 'plugins/maxvideoai', consumer), 'utf8');
    const proof = document.match(/!\[([^\]]+)\]\(\.\.\/assets\/demos\/[^)]+\)\s*\n\s*\n([^\n]+)/);
    assert.ok(proof, `${consumer} needs an adjacent proof caption`);
    const [, alt, caption] = proof;
    assert.match(alt, /public.*home page/i, 'alt must describe the actual public homepage');
    assert.match(alt, /Claude.*result|result.*Claude/i);
    assert.match(caption, /public.*home page/i);
    assert.match(caption, /Claude-specific.*(?:result|evidence)/i);
    assert.match(caption, /does not prove/i, 'keep the host-specific proof limit explicit');
    assert.doesNotMatch(`${alt}\n${caption}`, /model selector|proves current MaxVideoAI product selection|same saved video|workspace to Library|completed.*workspace result/i);
    assert.doesNotMatch(caption, /not native Claude host proof|native Claude, Codex, or ChatGPT run|end-to-end generation evidence has not been published/i);
  });
}

function checkFixture(name: string) {
  return spawnSync(process.execPath, [checkerPath, path.join(fixturesDirectory, name)], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
}

test('the plugin README routes readers into the published ChatGPT listing, Codex and Claude', () => {
  const readmePath = path.join(repositoryRoot, 'plugins/maxvideoai/README.md');
  const readme = readFileSync(readmePath, 'utf8');
  const opening = readme.split(/\r?\n/).slice(0, 15).join('\n');
  assert.match(opening, /^# MaxVideoAI for ChatGPT, Codex and MCP$/m);
  assert.match(opening, /\[Install MaxVideoAI in ChatGPT\]\(https:\/\/chatgpt\.com\/plugins\/plugin_asdk_app_6af7c45d28c48191982cf5be6eb7e058\)/);
  assert.match(opening, /\[Set up MaxVideoAI in Codex\]\(#install-in-codex\)/);
  assert.match(opening, /\[Connect Claude via MCP\]\(docs\/claude\.md\)/);
  assert.match(opening, /assets\/campaign\/paper-run\.webp[^>]+data-asset-role="editorial"/);
  assert.match(readme, /exact quote and approve one paid attempt/i);
  assert.match(readme, /custom remote connector for Claude/);
  for (const url of [
    'https://maxvideoai.com/mcp', 'https://maxvideoai.com/models',
    'https://maxvideoai.com/pricing', 'https://maxvideoai.com/tools',
    'https://maxvideoai.com/integrations/openclaw', 'https://maxvideoai.com/integrations/n8n',
    'https://maxvideoai.com/app/library', 'https://maxvideoai.com/legal/privacy',
    'https://maxvideoai.com/legal/terms', 'https://maxvideoai.com/contact',
  ]) assert.ok(readme.includes(url), url);
  assert.doesNotMatch(readme, /not submitted to the OpenAI directory|verified today in Claude and Codex/i);
  const result = spawnSync(process.execPath, [checkerPath, readmePath], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('Codex installation uses the public release tag and links to its checksum', () => {
  const plugin = path.join(repositoryRoot, 'plugins/maxvideoai');
  for (const file of ['README.md', 'docs/codex.md']) {
    const doc = readFileSync(path.join(plugin, file), 'utf8');
    const release = doc.match(/codex plugin marketplace add camgraphe\/maxvideoai-plugin --ref (v\d+\.\d+\.\d+)/)?.[1];
    assert.ok(release, file);
    assert.ok(doc.includes(`https://github.com/camgraphe/maxvideoai-plugin/releases/tag/${release}`), file);
    assert.match(doc, /codex plugin add maxvideoai@maxvideoai/);
    assert.doesNotMatch(doc, /camgraphe\/MaxVideoAi --ref maxvideoai-plugin-v/i);
  }
});

test('the ChatGPT guide prioritizes the published listing and preserves custom MCP and recovery', () => {
  const guide = readFileSync(path.join(repositoryRoot, 'plugins/maxvideoai/docs/chatgpt.md'), 'utf8');
  const listing = guide.indexOf('https://chatgpt.com/plugins/plugin_asdk_app_6af7c45d28c48191982cf5be6eb7e058');
  const custom = guide.indexOf('## Advanced setup for a custom MCP connection');
  assert.ok(listing >= 0 && listing < custom);
  assert.match(guide.slice(custom), /https:\/\/api\.maxvideoai\.com\/mcp[\s\S]*Add custom MCP server[\s\S]*OAuth/);
  assert.match(guide, /ask ChatGPT for the status of the generation you already approved/i);
  assert.match(guide, /disconnect the MaxVideoAI account[\s\S]{0,180}revoke the authorization/i);
  assert.doesNotMatch(guide, /not submitted to the OpenAI directory/i);
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
