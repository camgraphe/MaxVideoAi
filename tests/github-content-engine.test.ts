import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pluginRoot = path.join(repositoryRoot, 'plugins', 'maxvideoai');
const calendarPath = path.join(repositoryRoot, 'docs', 'marketing', 'github-editorial-calendar.md');

const calendarFields = [
  'Owner', 'Human search question', 'Agent question', 'Direct answer', 'Proof visual',
  'First-party MaxVideoAI fact or workflow', 'Source URL', 'GitHub surface',
  'Website counterpart', 'Outreach class', 'Canonical backlink', 'CTA',
  'Publication gate', 'Refresh trigger', 'Measurement',
] as const;

const ledgerFields = [
  'Contact or surface', 'Relevance', 'Proposed useful asset', 'Canonical link',
  'Disclosure', 'Status', 'Response', 'Next review',
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
  'Plugin release 0.3.2: current proof, platform guides, and public checksums',
  'Compatibility report: what is verified, what is compatible, and what is not claimed',
] as const;

type Section = { title: string; body: string };

function read(relativePath: string): string {
  return readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
}

function parseSections(markdown: string, heading: RegExp): Section[] {
  const matches = [...markdown.matchAll(heading)];
  return matches.map((match, index) => ({
    title: match[1].trim(),
    body: markdown.slice(match.index! + match[0].length, matches[index + 1]?.index).trim(),
  }));
}

function parseFields(section: string): Map<string, string> {
  const matches = [...section.matchAll(/\*\*([^*:\n]+):\*\*/g)];
  return new Map(matches.map((match, index) => [
    match[1].trim(),
    section.slice(match.index! + match[0].length, matches[index + 1]?.index).trim(),
  ]));
}

function requireNonemptyFields(fields: Map<string, string>, required: readonly string[], label: string): void {
  for (const field of required) {
    const value = fields.get(field);
    assert.ok(value?.replace(/\s+/g, ' ').trim(), `${label} needs a nonempty ${field}`);
  }
}

function parseExactHttpsUrl(urlText: string, label: string): URL {
  const trimmed = urlText.trim();
  assert.match(trimmed, /^https:\/\/\S+[.,;]?$/, `${label} must be exactly one HTTPS URL with optional terminal punctuation`);
  const url = new URL(trimmed.replace(/[.,;]$/, ''));
  assert.equal(url.protocol, 'https:', `${label} must use HTTPS`);
  return url;
}

function assertPlainCanonical(urlText: string, label: string): void {
  const url = parseExactHttpsUrl(urlText, label);
  assert.equal(url.origin, 'https://maxvideoai.com', `${label} must use MaxVideoAI's canonical domain`);
  assert.equal(url.search, '', `${label} must not add unapproved attribution parameters`);
  assert.equal(url.hash, '', `${label} must not add a fragment`);
  assert.ok(
    new Set(['/mcp', '/models', '/pricing', '/docs/mcp', '/app/library']).has(url.pathname),
    `${label} must use an approved Task 16 canonical path`,
  );
}

function assertSourceUrl(urlText: string, label: string): void {
  const url = parseExactHttpsUrl(urlText, label);
  assert.equal(url.search, '', `${label} must not add a query`);
  assert.equal(url.hash, '', `${label} must not add a fragment`);
  if (url.origin === 'https://maxvideoai.com') {
    assert.ok(
      new Set(['/mcp', '/models', '/pricing', '/docs/mcp', '/app/library']).has(url.pathname),
      `${label} must use an approved MaxVideoAI canonical path`,
    );
    return;
  }
  assert.equal(url.origin, 'https://github.com', `${label} must be a first-party MaxVideoAI or repository URL`);
  assert.match(url.pathname, /^\/camgraphe\/MaxVideoAi\/blob\/main\/.+/, `${label} must point to the main MaxVideoAI repository blob`);
}

function markdownLinks(markdown: string): string[] {
  return [...markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
}

const requiredOutreachProhibition = 'Do not buy links, exchange links at scale, submit bulk forms, automate unsolicited messages';
const unsafeOutreachTactics = /\b(?:(?:buy|bought|purchase|purchased)\s+(?:links?|backlinks?)(?:\s+placement)?|paid\s+(?:for\s+)?(?:links?|backlinks?)(?:\s+placement)?|(?:exchange\s+)?(?:links?|backlinks?)\s+at\s+scale|(?:scaled|bulk|mass)\s+reciprocal\s+(?:links?|backlinks?|outreach)|reciprocal\s+(?:links?|backlinks?|outreach)\s+(?:at\s+scale|in\s+bulk)|submit\s+bulk\s+forms|automat(?:e|ed|ing)\s+(?:(?:cold|unsolicited|bulk)\s+)?(?:dms?|direct\s+messages|messages?|outreach|campaigns?|sequences?|sequencing))\b/i;

function assertNoUnsafeOutreachAdvocacy(text: string, label: string): void {
  const withoutAllowedPolicy = text.replace(requiredOutreachProhibition, '');
  assert.doesNotMatch(withoutAllowedPolicy, unsafeOutreachTactics, `${label} must not advocate unsafe outreach tactics`);
}

function assertUnsafeOutreachPolicy(ledger: string): void {
  assert.match(
    ledger,
    new RegExp(requiredOutreachProhibition, 'i'),
    'the ledger must explicitly prohibit unsafe outreach tactics',
  );
  assertNoUnsafeOutreachAdvocacy(ledger, 'the outreach ledger');
}

test('GitHub content engine parses every proof-led calendar unit and release draft gate', () => {
  const calendar = read('docs/marketing/github-editorial-calendar.md');
  const manifest = JSON.parse(read('docs/marketing/github-asset-manifest.json')) as { assets: Array<{ path: string; kind: string; state: string }> };
  const manifestAssets = new Map(manifest.assets.map((asset) => [asset.path, asset]));
  const weeks = parseSections(calendar, /^## Week \d+:\s*(.+)$/gm);
  assert.equal(weeks.length, 8, 'the calendar needs eight publication weeks');

  const units: Section[] = [];
  for (const week of weeks) {
    const weekUnits = parseSections(week.body, /^### (?:Unit|Follow-up) \d+:\s*(.+)$/gm);
    assert.equal(weekUnits.length, 2, `${week.title} needs exactly two substantive units`);
    const rhythms = weekUnits.map((unit) => parseFields(unit.body).get('Rhythm'));
    assert.equal(rhythms.filter((rhythm) => rhythm?.startsWith('Outcome/proof')).length, 1, `${week.title} needs one outcome/proof unit`);
    assert.equal(rhythms.filter((rhythm) => rhythm?.startsWith('Decision/trust')).length, 1, `${week.title} needs one decision/trust unit`);
    units.push(...weekUnits);
  }

  assert.equal(units.length, 16, 'twelve named units plus four evidence refreshes fill the calendar');
  for (const title of namedLaunchUnits) assert.ok(units.some((unit) => unit.title === title), `missing launch unit: ${title}`);

  for (const unit of units) {
    const fields = parseFields(unit.body);
    requireNonemptyFields(fields, calendarFields, unit.title);
    assertPlainCanonical(fields.get('Canonical backlink')!, `${unit.title} canonical backlink`);
    assertPlainCanonical(fields.get('Website counterpart')!, `${unit.title} website counterpart`);
    assertSourceUrl(fields.get('Source URL')!, `${unit.title} source URL`);

    const image = /!\[[^\]]{12,}\]\(([^)]+)\)/.exec(unit.body);
    assert.ok(image, `${unit.title} needs a descriptive proof image`);
    const resolvedAsset = path.resolve(path.dirname(calendarPath), image![1]);
    assert.ok(resolvedAsset.startsWith(`${repositoryRoot}${path.sep}`), `${unit.title} proof image must remain inside the repository`);
    assert.ok(existsSync(resolvedAsset), `${unit.title} proof image must exist`);
    const relativeAsset = path.relative(repositoryRoot, resolvedAsset).split(path.sep).join('/');
    const manifestAsset = manifestAssets.get(relativeAsset);
    assert.ok(manifestAsset, `${unit.title} proof image must be declared in github-asset-manifest.json`);
    assert.equal(manifestAsset!.kind, 'product_proof', `${unit.title} proof image must be product proof`);
    assert.equal(manifestAsset!.state, 'publishable_proof', `${unit.title} proof image must be publishable proof`);

    const adjacentBoundary = unit.body.slice((image!.index ?? 0) + image![0].length, (image!.index ?? 0) + image![0].length + 750);
    assert.match(
      adjacentBoundary,
      /does not prove|not\s+(?:a|an|native|host|pricing|price|quote|approval|evidence|benchmark|release|released)|is not evidence/i,
      `${unit.title} needs an adjacent negative proof boundary`,
    );

    const releaseVersion = /\b(?:release|version)\s+(\d+\.\d+\.\d+)\b/i.exec(unit.title)?.[1];
    if (releaseVersion && releaseVersion !== read('plugins/maxvideoai/VERSION').trim()) {
      assert.match(fields.get('Status')!, /^draft_not_publishable\.?$/, `${unit.title} must be explicitly non-publishable`);
      assert.match(fields.get('Direct answer')!, /no\s+0\.3\.0\s+release, source tag, built checksum, or install proof is claimed/i);
      assert.match(fields.get('Publication gate')!, /VERSION[\s\S]*CHANGELOG[\s\S]*local and public source tag[\s\S]*built checksum evidence[\s\S]*current visual[\s\S]*clean install/i);
      assert.doesNotMatch(fields.get('GitHub surface')!, /GitHub Release|published release/i, `${unit.title} must not claim a published release`);
      assert.doesNotMatch(fields.get('Source URL')!, /\/releases\b/i, `${unit.title} must not point at an unmade release`);
    }
  }

  const releaseTemplate = read('docs/marketing/github-release-template.md');
  for (const heading of ['Outcome', 'What changed', 'Who benefits', 'Current visual', 'Install or update', 'Compatibility', 'Safety boundary', 'Full changelog']) {
    assert.match(releaseTemplate, new RegExp(`^## ${heading}`, 'mi'), `release template needs ${heading}`);
  }
  assert.match(releaseTemplate, /\[current-release-visual-path\]/, 'release template must use a current-version visual placeholder');
  assert.doesNotMatch(releaseTemplate, /release-0\.3\.0/i, 'release template must not freeze a future version asset');
  assert.match(releaseTemplate, /codex plugin/i, 'release template needs an install/update command');
});

test('GitHub content engine parses contextual outreach rows without unsafe solicitation or attribution', () => {
  const ledger = read('docs/marketing/github-outreach-ledger.md');
  assertUnsafeOutreachPolicy(ledger);
  const entries = parseSections(ledger, /^## Entry:\s*(.+)$/gm);
  assert.equal(entries.length, 6, 'the ledger needs each permitted contextual-value class');

  for (const entry of entries) {
    const fields = parseFields(entry.body);
    requireNonemptyFields(fields, ledgerFields, entry.title);
    assertPlainCanonical(fields.get('Canonical link')!, `${entry.title} canonical link`);
    assert.match(
      fields.get('Contact or surface')!,
      /public[\s\S]*(?:professional|maintainer|editor|registry|contribution)|(?:professional|maintainer|editor|registry|contribution)[\s\S]*public/i,
      `${entry.title} must remain a public-professional context`,
    );
    assert.doesNotMatch(
      entry.body,
      /\b(?:send|share|provide|paste|include|collect|request)\b[^.\n]{0,120}\b(?:personal (?:email|data)|phone|private (?:media|url)|token|password|billing|payment data)\b/i,
      `${entry.title} must not solicit personal or private data`,
    );
    assertNoUnsafeOutreachAdvocacy(entry.body, entry.title);
  }
});

test('content-engine adversarial helpers reject unsafe outreach and URL escape routes', () => {
  assert.doesNotThrow(() => assertUnsafeOutreachPolicy(`${requiredOutreachProhibition}.`));
  assert.throws(() => assertNoUnsafeOutreachAdvocacy('Offer to buy backlinks for placement.', 'adversarial outreach'), /unsafe outreach tactics/i);
  assert.throws(() => assertNoUnsafeOutreachAdvocacy('We bought backlinks after a review.', 'adversarial outreach'), /unsafe outreach tactics/i);
  assert.throws(() => assertNoUnsafeOutreachAdvocacy('They purchased backlink placement.', 'adversarial outreach'), /unsafe outreach tactics/i);
  assert.throws(() => assertNoUnsafeOutreachAdvocacy('Use paid backlink placement.', 'adversarial outreach'), /unsafe outreach tactics/i);
  assert.throws(() => assertNoUnsafeOutreachAdvocacy('Automate cold DMs after a review.', 'adversarial outreach'), /unsafe outreach tactics/i);
  assert.throws(() => assertNoUnsafeOutreachAdvocacy('Use automated cold outreach.', 'adversarial outreach'), /unsafe outreach tactics/i);
  assert.throws(() => assertNoUnsafeOutreachAdvocacy('Automate cold campaigns.', 'adversarial outreach'), /unsafe outreach tactics/i);
  assert.throws(() => assertNoUnsafeOutreachAdvocacy('Use automated unsolicited sequencing.', 'adversarial outreach'), /unsafe outreach tactics/i);

  assert.doesNotThrow(() => assertPlainCanonical('https://maxvideoai.com/models.', 'valid canonical'));
  assert.throws(() => assertPlainCanonical('https://maxvideoai.com/models https://maxvideoai.com/pricing', 'two URLs'), /exactly one HTTPS URL/i);
  assert.throws(() => assertPlainCanonical('https://maxvideoai.com/models?utm_source=unapproved', 'query bypass'), /must not add unapproved attribution parameters/i);
  assert.throws(() => assertPlainCanonical('https://maxvideoai.com/models#pricing', 'fragment bypass'), /must not add a fragment/i);
  assert.throws(() => assertPlainCanonical('https://maxvideoai.com/models for producers', 'trailing prose'), /exactly one HTTPS URL/i);
  assert.throws(() => assertSourceUrl('not-a-url', 'invalid source'), /exactly one HTTPS URL/i);
  assert.throws(() => assertSourceUrl('https://github.com/camgraphe/MaxVideoAi/blob/main/README.md https://maxvideoai.com/mcp', 'two source URLs'), /exactly one HTTPS URL/i);
});

test('new workflow examples are actionable and host guides keep contextual link mappings', () => {
  const examples = [
    'compare-ai-video-models.md',
    'price-a-video-project.md',
    'claude-video-production.md',
    'codex-video-production.md',
  ] as const;
  const sharedExamples = ['compare-ai-video-models.md', 'price-a-video-project.md'];

  for (const example of examples) {
    const content = read(path.join('plugins/maxvideoai', 'examples', example));
    assert.match(content, /^# .+\n\n\*\*Short answer:\*\*/m, `${example} needs a direct answer opening`);
    assert.match(content, /!\[[^\]]{12,}\]\(\.\.\/assets\/demos\//, `${example} needs a current MaxVideoAI proof visual`);
    assert.match(content, /exact quote/i, `${example} needs the exact-quote boundary`);
    assert.match(content, /explicit approval/i, `${example} needs the approval boundary`);
    assert.match(content, /MaxVideoAI Library/i, `${example} needs recovery continuity`);
    assert.match(content, /https:\/\/maxvideoai\.com\/(?:mcp|models|pricing|docs\/mcp)/i, `${example} needs a canonical next action`);
    assert.match(content, /does not prove|not native/i, `${example} must qualify visual or host evidence`);
    assert.doesNotMatch(content, /(?:[$€£]\s*\d|\d(?:[.,]\d+)?\s*(?:USD|EUR|GBP|dollars?|euros?|pounds?))/i, `${example} must not freeze a price`);
  }

  for (const surface of ['README.md', 'examples/README.md'] as const) {
    const links = markdownLinks(readFileSync(path.join(pluginRoot, surface), 'utf8'));
    for (const example of examples) assert.ok(links.some((link) => link.endsWith(example)), `${surface} must retain ${example}`);
  }

  const hostExampleLinks: Record<string, readonly string[]> = {
    'docs/chatgpt.md': sharedExamples,
    'docs/claude.md': [...sharedExamples, 'claude-video-production.md'],
    'docs/codex.md': [...sharedExamples, 'codex-video-production.md'],
  };
  for (const [guide, expected] of Object.entries(hostExampleLinks)) {
    const links = markdownLinks(readFileSync(path.join(pluginRoot, guide), 'utf8'));
    const actual = links.filter((link) => link.startsWith('../examples/')).map((link) => path.posix.basename(link)).sort();
    assert.deepEqual(actual, [...expected].sort(), `${guide} must link only its own host example and shared comparison/pricing examples`);
  }
  assert.ok(
    markdownLinks(readFileSync(path.join(pluginRoot, 'docs/chatgpt.md'), 'utf8')).includes('#how-do-i-verify-without-spending-credits'),
    'the ChatGPT guide must link its own host-specific validation example',
  );
});
