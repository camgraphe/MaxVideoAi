import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pluginRoot = path.join(repositoryRoot, 'plugins', 'maxvideoai');
const checkerPath = path.join(repositoryRoot, 'scripts', 'check-github-content.mjs');

const exampleFiles = [
  'examples/README.md',
  'examples/product-launch-plan.md',
  'examples/creator-budget-comparison.md',
  'examples/reference-to-video.md',
  'examples/recover-a-generation.md',
] as const;

const scenarioFiles = exampleFiles.slice(1) as readonly Exclude<(typeof exampleFiles)[number], 'examples/README.md'>[];

const communityFiles = [
  'CODE_OF_CONDUCT.md',
  'CONTRIBUTING.md',
  'SUPPORT.md',
  'SECURITY.md',
  '.github/PULL_REQUEST_TEMPLATE.md',
] as const;

const issueFormFiles = [
  '.github/ISSUE_TEMPLATE/bug-report.yml',
  '.github/ISSUE_TEMPLATE/feature-request.yml',
  '.github/ISSUE_TEMPLATE/compatibility-report.yml',
] as const;

const requiredFiles = [
  ...exampleFiles,
  ...communityFiles,
  ...issueFormFiles,
  '.github/ISSUE_TEMPLATE/config.yml',
] as const;

type FormBodyItem = {
  type?: string;
  id?: string;
  attributes?: Record<string, unknown>;
  validations?: Record<string, unknown>;
};

type IssueForm = {
  name?: string;
  description?: string;
  body?: FormBodyItem[];
};

function read(relativePath: string): string {
  return readFileSync(path.join(pluginRoot, relativePath), 'utf8');
}

function parseYamlFiles(relativePaths: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(relativePaths.map((relativePath) => [relativePath, parseYaml(read(relativePath)) as unknown]));
}

function fieldText(item: FormBodyItem): string {
  return JSON.stringify(item.attributes ?? {});
}

function allMarkdownFiles(rootPath: string): string[] {
  return readdirSync(rootPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) return allMarkdownFiles(entryPath);
    return entryPath.endsWith('.md') ? [entryPath] : [];
  });
}

test('the plugin ships every example and community trust surface', () => {
  for (const relativePath of requiredFiles) {
    assert.ok(existsSync(path.join(pluginRoot, relativePath)), `${relativePath} must exist`);
  }
});

test('issue forms are valid structured YAML with safe public-report fields', () => {
  const parsed = parseYamlFiles([...issueFormFiles, '.github/ISSUE_TEMPLATE/config.yml']);
  const privacyTerms = /token|password|cookie|authorization code|private (?:url|link|media)|email address|billing|payment data|full (?:private|proprietary) prompt/i;

  for (const relativePath of issueFormFiles) {
    const form = parsed[relativePath] as IssueForm;
    assert.equal(typeof form.name, 'string', `${relativePath} needs a name`);
    assert.equal(typeof form.description, 'string', `${relativePath} needs a description`);
    assert.ok(Array.isArray(form.body) && form.body.length > 0, `${relativePath} needs a body`);

    const fields = form.body.filter((item) => item.type !== 'markdown');
    const ids = fields.map((item) => item.id).filter(Boolean) as string[];
    assert.equal(new Set(ids).size, ids.length, `${relativePath} field IDs must be unique`);
    assert.equal(ids.length, fields.length, `${relativePath} interactive fields need stable IDs`);

    const markdown = form.body.filter((item) => item.type === 'markdown').map(fieldText).join('\n');
    assert.match(markdown, /public/i, `${relativePath} must warn that reports are public`);
    for (const term of ['token', 'email', 'billing', 'private media', 'full proprietary prompts']) {
      assert.match(markdown, new RegExp(term, 'i'), `${relativePath} warning must exclude ${term}`);
    }

    const combined = fields.map((item) => `${item.id ?? ''} ${fieldText(item)}`).join('\n');
    assert.match(combined, /package[^\n]*(?:version|tag)|(?:version|tag)[^\n]*package/i, `${relativePath} needs the package version or tag`);
    assert.match(combined, /host|client/i, `${relativePath} needs host/client details`);
    assert.match(combined, /exact version/i, `${relativePath} needs the exact host/client version`);
    assert.match(combined, /operating system|\bOS\b/i, `${relativePath} needs the operating system`);
    assert.match(combined, /setup|install/i, `${relativePath} needs the setup path`);
    assert.match(combined, /saniti[sz]ed/i, `${relativePath} needs sanitized reproduction or context`);
    assert.match(combined, /expected/i, `${relativePath} needs the expected behavior or outcome`);
    assert.match(combined, /actual|current behavior/i, `${relativePath} needs the actual or current behavior`);

    const conduct = fields.find((item) => /code of conduct/i.test(fieldText(item)));
    assert.ok(conduct, `${relativePath} needs Code of Conduct acknowledgement`);
    assert.equal(conduct?.type, 'checkboxes');
    assert.equal(conduct?.validations?.required, true);

    for (const item of fields) {
      const text = fieldText(item);
      if (!privacyTerms.test(text)) continue;
      assert.match(text, /do not|never|remove|redact|exclude|without|not include/i, `${relativePath}:${item.id} must not solicit sensitive data`);
    }
  }

  const compatibility = parsed['.github/ISSUE_TEMPLATE/compatibility-report.yml'] as IssueForm;
  const compatibilityText = compatibility.body?.map((item) => `${item.id ?? ''} ${fieldText(item)}`).join('\n') ?? '';
  for (const requirement of [
    /account[^\n]*plan category/i,
    /OAuth[^\n]*(?:outcome|result)/i,
    /tool[^\n]*(?:discovery|visible|found)/i,
    /planning[^\n]*(?:result|outcome)/i,
    /exact[^\n]*quote[^\n]*(?:result|outcome)/i,
    /approval[^\n]*optional|optional[^\n]*approval/i,
    /saniti[sz]ed[^\n]*(?:screenshot|evidence)/i,
    /https:\/\/maxvideoai\.com\/docs\/mcp/i,
  ]) assert.match(compatibilityText, requirement);
  assert.doesNotMatch(compatibilityText, /not applicable/i, 'compatibility evidence must retain exact technical fields');

  for (const relativePath of ['.github/ISSUE_TEMPLATE/bug-report.yml', '.github/ISSUE_TEMPLATE/feature-request.yml'] as const) {
    const form = parsed[relativePath] as IssueForm;
    const body = form.body ?? [];
    for (const fieldId of ['host-client-version', 'operating-system']) {
      const text = fieldText(body.find((item) => item.id === fieldId) ?? {});
      assert.match(text, /not applicable[^\n]*documentation\/package only/i, `${relativePath}:${fieldId} needs an honest docs/package-only path`);
    }
    const setupText = fieldText(body.find((item) => item.id === 'setup-method') ?? {});
    assert.match(setupText, /not applicable[^\n]*documentation\/package only/i, `${relativePath}:setup-method needs an honest docs/package-only path`);
  }

  const config = parsed['.github/ISSUE_TEMPLATE/config.yml'] as Record<string, unknown>;
  assert.equal(config.blank_issues_enabled, false);
  const contactLinks = config.contact_links as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(contactLinks));
  const privateSupport = contactLinks.find((link) => /support/i.test(String(link.name)));
  const privateSecurity = contactLinks.find((link) => /security/i.test(String(link.name)));
  assert.equal(privateSupport?.url, 'https://maxvideoai.com/contact');
  assert.equal(privateSecurity?.url, 'https://maxvideoai.com/contact');
  assert.match(String(privateSecurity?.about), /private[^.]*SECURITY\.md[^.]*security@maxvideoai\.com/i);
  assert.doesNotMatch(JSON.stringify(contactLinks), /github\.com\/camgraphe\/MaxVideoAi\/security\/policy|mailto:/i);
});

test('examples answer producer intents without inventing spend or host proof', () => {
  const expectedAssets: Record<(typeof scenarioFiles)[number], string> = {
    'examples/product-launch-plan.md': '../assets/demos/brief-to-video-workflow.webp',
    'examples/creator-budget-comparison.md': '../assets/demos/model-choice-and-budget.webp',
    'examples/reference-to-video.md': '../assets/screenshots/maxvideoai-workspace-production.jpg',
    'examples/recover-a-generation.md': '../assets/demos/library-continuity.webp',
  };

  for (const relativePath of scenarioFiles) {
    const content = read(relativePath);
    assert.match(content, /## (?:What is the intent|Intent|What are you trying to produce)\??/i, `${relativePath} needs a one-sentence intent`);
    assert.match(content, /\*\*Prompt to copy\*\*:\s*[“"][^”"]{20,}[”"]/i, `${relativePath} needs a copyable prompt`);
    assert.match(content, /expected MaxVideoAI behavior/i);
    assert.match(content, /\$plan|\$generate/);
    assert.match(content, /exact quote/i);
    assert.match(content, /explicit approval/i);
    assert.match(content, /response (?:is )?(?:lost|interrupted|stops)|conversation (?:is )?(?:lost|interrupted|stops)/i);
    assert.match(content, /MaxVideoAI Library/i);
    assert.match(content, /\.\.\/docs\/(?:how-it-works|privacy-and-permissions|troubleshooting)\.md/);
    assert.match(content, /https:\/\/maxvideoai\.com\/docs\/mcp/);
    assert.match(content, new RegExp(`!\\[[^\\]]{12,}\\]\\(${expectedAssets[relativePath].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`));
    assert.match(content, /proves[\s\S]{0,240}does not prove/i, `${relativePath} visual caption needs a precise proof boundary`);
    assert.doesNotMatch(content, /(?:[$€£]\s*\d|\d(?:[.,]\d+)?\s*(?:USD|EUR|GBP|dollars?|euros?|pounds?))/i, `${relativePath} must not freeze currency amounts`);
    assert.doesNotMatch(content, /(?:completed|generated|approved|quoted)[^.\n]{0,60}(?:in|inside|through)\s+(?:Claude|Codex|ChatGPT)/i, `${relativePath} must not invent native host proof`);

    const imageMatches = [...content.matchAll(/!\[[^\]]+\]\(([^)]+)\)/g)];
    assert.ok(imageMatches.length > 0);
    for (const match of imageMatches) {
      const resolved = path.resolve(path.dirname(path.join(pluginRoot, relativePath)), match[1]);
      assert.ok(resolved.startsWith(`${path.resolve(pluginRoot, 'assets')}${path.sep}`));
      assert.ok(existsSync(resolved), `${relativePath} image ${match[1]} must resolve`);
    }
  }

  const launch = read('examples/product-launch-plan.md');
  assert.match(launch, /one launch brief/i);
  assert.match(launch, /multiple shots/i);
  assert.match(launch, /quality-first/i);
  assert.match(launch, /comparable lower-cost/i);
  assert.match(launch, /selected concrete shot/i);
  assert.match(launch, /one-attempt approval/i);
  assert.match(launch, /accepted job/i);
  assert.match(launch, /project budget[^.]*not[^.]*exact quote/i);

  const budget = read('examples/creator-budget-comparison.md');
  assert.match(budget, /How can I compare AI video models and price a project before generating\?/i);
  assert.match(budget, /\$plan[^.]*live model facts[^.]*named budgets[^.]*without spending credits/i);
  assert.match(budget, /only `?\$generate`?[^.]*fresh exact quote/i);
  assert.doesNotMatch(budget, /\b(?:permanently |always )?best\b/i);

  const reference = read('examples/reference-to-video.md');
  assert.match(reference, /private Library selection[^.]*first/i);
  assert.match(reference, /secure upload[^.]*only[^.]*missing/i);
  assert.match(reference, /refresh[^.]*media selection/i);
  assert.match(reference, /(?:validat[^.]*model[^.]*mode|model[^.]*mode[^.]*validat)/i);
  assert.match(reference, /do not[^.]*local path[^.]*base64[^.]*token[^.]*private URL/i);
  for (const sentence of reference.split(/(?<=[.!?])\s+/)) {
    if (!/(?:paste|provide|share|include)[^.]*?(?:local path|base64|raw token|arbitrary private URL)/i.test(sentence)) continue;
    assert.match(sentence, /do not|never/i, 'reference input instructions must reject, not solicit, sensitive transfer material');
  }

  const recovery = read('examples/recover-a-generation.md');
  assert.match(recovery, /after approval[^.]*recover[^.]*accepted|recover[^.]*accepted[^.]*before[^.]*second paid request/i);
  assert.match(recovery, /refund[^.]*closes[^.]*authorization/i);
  assert.match(recovery, /replacement[^.]*fresh quote[^.]*new explicit approval/i);
});

test('community documents route public and private reports safely', () => {
  const conduct = read('CODE_OF_CONDUCT.md');
  assert.match(conduct, /Contributor Covenant[^\n]*2\.1/i);
  assert.match(conduct, /https:\/\/www\.contributor-covenant\.org\/version\/2\/1\/code_of_conduct\//);
  assert.match(conduct, /scope/i);
  assert.match(conduct, /private/i);
  assert.match(conduct, /enforcement/i);
  assert.match(conduct, /support@maxvideoai\.com/i);
  assert.match(conduct, /subject/i);
  assert.match(conduct, /do not[^.]*public/i);
  assert.match(conduct, /CC BY 4\.0|Creative Commons Attribution 4\.0/i);

  const contributing = read('CONTRIBUTING.md');
  assert.match(contributing, /docs|documentation/i);
  assert.match(contributing, /examples/i);
  assert.match(contributing, /compatibility report/i);
  assert.match(contributing, /skill|package metadata/i);
  assert.match(contributing, /deterministic release packaging/i);
  assert.match(contributing, /https:\/\/github\.com\/camgraphe\/MaxVideoAi/);
  assert.match(contributing, /small[^.]*reviewable/i);
  assert.match(contributing, /BUSL-1\.1/i);
  assert.match(contributing, /current[^.]*saniti[sz]ed[^.]*permissioned[^.]*manifest/i);
  assert.doesNotMatch(contributing, /contributor license agreement|\bCLA\b/i);

  const support = read('SUPPORT.md');
  assert.match(support, /setup|usage/i);
  assert.match(support, /(?:bug[^.]*structured issue|structured bug issue)/i);
  assert.match(support, /use the compatibility report/i);
  assert.match(support, /SECURITY\.md[^.]*security@maxvideoai\.com/i);
  assert.match(support, /billing[^.]*account[^.]*private media[^.]*private support/i);
  assert.match(support, /host[^.]*version/i);
  assert.match(support, /operating system|\bOS\b/);
  assert.match(support, /plugin[^.]*version|version[^.]*tag/i);
  assert.match(support, /approximate[^.]*UTC/i);
  assert.match(support, /saniti[sz]ed[^.]*steps/i);
  assert.match(support, /visible[^.]*safe error/i);
  assert.match(support, /do not[^.]*tokens[^.]*passwords[^.]*cookies[^.]*authorization codes/i);
  assert.match(support, /no response-time guarantee|does not promise a response time/i);

  const security = read('SECURITY.md');
  assert.match(security, /security@maxvideoai\.com/);
  assert.match(security, /do not[^.]*public[^.]*vulnerabilit/i);
  assert.match(security, /do not[^.]*sensitive attachment/i);
  assert.match(security, /version[^.]*host[^.]*saniti[sz]ed reproduction[^.]*impact[^.]*safe logs/i);
  assert.match(security, /no credentials[^.]*private media[^.]*payment data/i);
  assert.match(security, /latest published[^.]*supported/i);
  assert.match(security, /SHA-256[^.]*checksums\.json/i);
  assert.doesNotMatch(security, /(?:acknowledge|remediate|response)[^.\n]*within\s+\d+\s+(?:hours?|days?)/i);

  const pullRequest = read('.github/PULL_REQUEST_TEMPLATE.md');
  for (const heading of [
    /outcome/i,
    /scope/i,
    /testing/i,
    /compatibility.*claim/i,
    /paid-action safety/i,
    /visual.*provenance/i,
    /privacy checklist/i,
    /docs.*link updates/i,
  ]) assert.match(pullRequest, heading);
});

test('community Markdown preserves the editorial and no-table contracts', () => {
  for (const markdownPath of allMarkdownFiles(pluginRoot)) {
    assert.doesNotMatch(readFileSync(markdownPath, 'utf8'), /^\|.*\|$/m, `${path.relative(pluginRoot, markdownPath)} must not use Markdown tables`);
  }

  for (const relativePath of [...exampleFiles, ...communityFiles]) {
    const fullPath = path.join(pluginRoot, relativePath);
    assert.ok(statSync(fullPath).isFile());
    const result = spawnSync(process.execPath, [checkerPath, fullPath], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
  }
});
