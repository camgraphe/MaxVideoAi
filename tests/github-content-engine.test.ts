import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pluginRoot = path.join(repositoryRoot, 'plugins', 'maxvideoai');

const requiredFiles = [
  'docs/marketing/github-editorial-calendar.md',
  'docs/marketing/github-outreach-ledger.md',
  'docs/marketing/github-release-template.md',
  'docs/marketing/github-content-brief-template.md',
  'plugins/maxvideoai/examples/compare-ai-video-models.md',
  'plugins/maxvideoai/examples/price-a-video-project.md',
  'plugins/maxvideoai/examples/claude-video-production.md',
  'plugins/maxvideoai/examples/codex-video-production.md',
] as const;

const namedLaunchUnits = [
  'AI video production inside ChatGPT, Claude, and Codex',
  'One brief, three model routes: quality, control, and cost',
  'How to price an AI video project before generating',
  'Claude workflow: brief → plan → exact quote → approval → result',
  'Codex workflow: install → compare → budget → generate → recover',
  'What “price before generation” protects',
  'Recover a finished generation after the conversation is interrupted',
  'Use reference images and video without losing account continuity',
  'Current AI video model decision report, backed by MaxVideoAI catalog data',
  'A real multi-shot campaign budget breakdown',
  'Plugin release 0.3.0: current proof, platform guides, and public checksums',
  'Compatibility report: what is verified, what is compatible, and what is not claimed',
] as const;

const calendarFields = [
  'Owner',
  'Human search question',
  'Agent question',
  'Direct answer',
  'Proof visual',
  'First-party MaxVideoAI fact or workflow',
  'Source URL',
  'GitHub surface',
  'Website counterpart',
  'Outreach class',
  'Canonical backlink',
  'CTA',
  'Publication gate',
  'Refresh trigger',
  'Measurement',
] as const;

function read(relativePath: string): string {
  return readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
}

function assertUnsafeOutreachIsProhibited(ledger: string): void {
  assert.match(
    ledger,
    /Do not buy links, exchange links at scale, submit bulk forms, automate unsolicited messages/i,
    'the ledger must make its prohibited outreach practices explicit',
  );

  const unsafeImperatives = [
    /(?:^|[.!?]\s+)(?:we\s+)?(?:buy|purchase|pay for)\s+(?:bulk\s+)?(?:backlinks?|links?)\b/im,
    /(?:^|[.!?]\s+)(?:we\s+)?exchange links at scale\b/im,
    /(?:^|[.!?]\s+)(?:we\s+)?submit bulk forms\b/im,
    /(?:^|[.!?]\s+)(?:we\s+)?automate unsolicited messages\b/im,
  ];
  for (const unsafeImperative of unsafeImperatives) {
    assert.doesNotMatch(ledger, unsafeImperative, 'the ledger must not advocate an unsafe outreach practice');
  }
}

test('GitHub content engine defines a proof-led eight-week publication contract', () => {
  for (const relativePath of requiredFiles) {
    assert.ok(existsSync(path.join(repositoryRoot, relativePath)), `${relativePath} must exist`);
  }

  const calendar = read('docs/marketing/github-editorial-calendar.md');
  for (const title of namedLaunchUnits) assert.match(calendar, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  const weeks = [...calendar.matchAll(/^## Week \d+:/gm)];
  assert.equal(weeks.length, 8, 'the calendar needs eight publication weeks');
  for (const week of weeks) {
    const weekText = calendar.slice(week.index, calendar.indexOf('\n## Week ', (week.index ?? 0) + 1) || undefined);
    assert.equal((weekText.match(/^### (?:Unit|Follow-up) \d+:/gm) ?? []).length, 2, `${week[0]} needs two substantive units`);
    assert.match(weekText, /Outcome\/proof/i, `${week[0]} needs an outcome/proof unit`);
    assert.match(weekText, /Decision\/trust/i, `${week[0]} needs a decision/trust unit`);
  }

  const unitHeadings = [...calendar.matchAll(/^### (?:Unit|Follow-up) \d+:/gm)];
  const units = unitHeadings.map((heading, index) => calendar.slice(heading.index, unitHeadings[index + 1]?.index));
  assert.equal(units.length, 16, 'twelve launch units plus four substantive evidence follow-ups fill the eight-week rhythm');
  for (const unit of units) {
    const unitText = unit;
    for (const field of calendarFields) assert.match(unitText, new RegExp(`\\*\\*${field}:\\*\\*`, 'i'), `${unitText.slice(0, 80)} needs ${field}`);
    assert.match(unitText, /!\[[^\]]{12,}\]\([^\n)]+\)/, 'each unit needs a useful proof visual');
    assert.match(unitText, /https:\/\/maxvideoai\.com\//, 'each unit needs a contextual canonical backlink');
  }

  const releaseTemplate = read('docs/marketing/github-release-template.md');
  for (const field of ['Outcome', 'What changed', 'Who benefits', 'Current visual', 'Install or update', 'Compatibility', 'Safety boundary', 'Full changelog']) {
    assert.match(releaseTemplate, new RegExp(`^## ${field}`, 'mi'), `release template needs ${field}`);
  }
  assert.match(releaseTemplate, /codex plugin/i, 'release template needs an install/update command');

  const ledger = read('docs/marketing/github-outreach-ledger.md');
  for (const field of ['Contact or surface', 'Relevance', 'Proposed useful asset', 'Canonical link', 'Disclosure', 'Status', 'Response', 'Next review']) {
    assert.match(ledger, new RegExp(field, 'i'), `outreach ledger needs ${field}`);
  }
  for (const outreachClass of [/official or maintained registry/i, /curated MCP list/i, /AI-video resource page/i, /technical newsletter/i, /creator workflow/i, /benchmark citation/i]) {
    assert.match(ledger, outreachClass, 'outreach ledger needs every permitted contextual-value class');
  }
  assert.match(ledger, /public professional contact/i);
  assertUnsafeOutreachIsProhibited(ledger);

  const briefTemplate = read('docs/marketing/github-content-brief-template.md');
  for (const field of calendarFields) assert.match(briefTemplate, new RegExp(field, 'i'), `content brief template needs ${field}`);
  assert.match(briefTemplate, /visual.*before.*prose|proof.*before.*prose/i);
});

test('new workflow examples are actionable, qualified, and linked from the acquisition surfaces', () => {
  const examples = [
    'examples/compare-ai-video-models.md',
    'examples/price-a-video-project.md',
    'examples/claude-video-production.md',
    'examples/codex-video-production.md',
  ] as const;

  for (const relativePath of examples) {
    const content = read(path.join('plugins/maxvideoai', relativePath));
    assert.match(content, /^# .+\n\n\*\*Short answer:\*\*/m, `${relativePath} needs a direct answer opening`);
    assert.match(content, /!\[[^\]]{12,}\]\(\.\.\/assets\/demos\//, `${relativePath} needs a current MaxVideoAI proof visual`);
    assert.match(content, /exact quote/i, `${relativePath} needs the exact-quote boundary`);
    assert.match(content, /explicit approval/i, `${relativePath} needs the approval boundary`);
    assert.match(content, /MaxVideoAI Library/i, `${relativePath} needs recovery continuity`);
    assert.match(content, /https:\/\/maxvideoai\.com\/(?:mcp|models|pricing|docs\/mcp)/i, `${relativePath} needs a canonical next action`);
    assert.match(content, /does not prove|not native/i, `${relativePath} must qualify its visual or host evidence`);
    assert.doesNotMatch(content, /(?:[$€£]\s*\d|\d(?:[.,]\d+)?\s*(?:USD|EUR|GBP|dollars?|euros?|pounds?))/i, `${relativePath} must not freeze a price`);
  }

  const acquisitionSurfaces = [
    'README.md',
    'docs/chatgpt.md',
    'docs/claude.md',
    'docs/codex.md',
    'examples/README.md',
  ] as const;
  for (const relativePath of acquisitionSurfaces) {
    const content = read(path.join('plugins/maxvideoai', relativePath));
    for (const example of examples) assert.match(content, new RegExp(example.split('/').at(-1)?.replace('.', '\\.') ?? ''), `${relativePath} must link ${example}`);
  }
});
