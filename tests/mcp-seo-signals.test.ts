import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import mcpPublication from '../frontend/config/mcp-publication.json';
import { buildMetadataUrls } from '../frontend/lib/metadataUrls.ts';
import { getMcpPublicationState } from '../frontend/lib/mcp-publication.ts';
import { buildLlmsText } from '../frontend/lib/seo/llms-text.ts';
import { buildRobotsText } from '../frontend/lib/seo/robots-text.ts';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const routeRoot = 'frontend/app/(localized)/[locale]/(marketing)';
const sitemapConfigPath = 'frontend/next-sitemap.config.js';
const answerSectionPath = `${routeRoot}/mcp/_components/McpAnswerPassagesSection.tsx`;
const internalLinksPath = 'frontend/lib/mcp-internal-links.ts';
const gscBaselinePath = 'docs/marketing/mcp-gsc-baseline.md';

const enabledPublication = {
  publicMarketing: true,
  publicIndexing: true,
  transport: true,
  oauth: true,
  discovery: true,
  paidGeneration: true,
  trial: true,
  referenceUploads: true,
};

type SitemapConfig = {
  additionalPaths: (config: SitemapConfig) => Promise<Array<{ loc: string; alternateRefs?: Array<{ href: string; hreflang: string; hrefIsAbsolute?: boolean }> }>>;
  exclude: string[];
  transform: (config: SitemapConfig, path: string) => Promise<unknown>;
};

function loadSitemapConfig(publication: typeof enabledPublication): SitemapConfig {
  const absolutePath = resolve(sitemapConfigPath);
  const source = readFileSync(absolutePath, 'utf8');
  const requireFromConfig = createRequire(absolutePath);
  const moduleRecord: { exports: unknown } = { exports: {} };
  const localRequire = (specifier: string) =>
    specifier === './config/mcp-publication.json' ? publication : requireFromConfig(specifier);
  const wrapper = vm.runInNewContext(
    `(function (require, module, exports, __dirname, process) { ${source}\n})`,
    { console },
    { filename: absolutePath },
  ) as (
    requireFn: (specifier: string) => unknown,
    module: { exports: unknown },
    exports: unknown,
    directory: string,
    processValue: NodeJS.Process,
  ) => void;
  wrapper(localRequire, moduleRecord, moduleRecord.exports, dirname(absolutePath), {
    ...process,
    env: {},
  } as NodeJS.Process);
  return moduleRecord.exports as SitemapConfig;
}

function parseRobotsGroups(source: string) {
  const groups: Array<{ agents: string[]; rules: string[] }> = [];
  let agents: string[] = [];
  let rules: string[] = [];
  const flush = () => {
    if (agents.length) groups.push({ agents, rules });
    agents = [];
    rules = [];
  };
  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (/^User-agent:/i.test(line)) {
      if (rules.length) flush();
      agents.push(line.slice(line.indexOf(':') + 1).trim());
      continue;
    }
    if (agents.length) rules.push(line);
  }
  flush();
  return groups;
}

test('checked-in false publication removes every MCP source page from generated sitemap candidates', async () => {
  const config = loadSitemapConfig(mcpPublication);
  const entries = await config.additionalPaths(config);
  const sourcePages = entries.filter((entry) => /\/(?:mcp|integrations\/(?:chatgpt|claude|codex)|docs\/mcp)$/.test(entry.loc));
  assert.equal(sourcePages.length, 0);

  for (const privatePattern of [
    '/api/*',
    '/oauth',
    '/oauth/*',
    '/account',
    '/account/*',
    '/uploads/*',
    '/app',
    '/app/*',
    '/workspace',
    '/library',
    '/library/*',
    '/media-library/*',
    '/docs/private/*',
  ]) {
    assert.ok(config.exclude.includes(privatePattern), `${privatePattern} should stay excluded from generated sitemaps`);
  }
});

test('enabled publication fixture emits 15 localized owners with exact absolute EN FR ES hreflang URLs', async () => {
  const config = loadSitemapConfig(enabledPublication);
  const entries = await config.additionalPaths(config);
  const byLoc = new Map(entries.map((entry) => [entry.loc, entry]));
  const expected = {
    'https://maxvideoai.com/mcp': {
      en: 'https://maxvideoai.com/mcp',
      fr: 'https://maxvideoai.com/fr/mcp',
      es: 'https://maxvideoai.com/es/mcp',
    },
    'https://maxvideoai.com/integrations/chatgpt': {
      en: 'https://maxvideoai.com/integrations/chatgpt',
      fr: 'https://maxvideoai.com/fr/integrations/chatgpt',
      es: 'https://maxvideoai.com/es/integraciones/chatgpt',
    },
    'https://maxvideoai.com/integrations/claude': {
      en: 'https://maxvideoai.com/integrations/claude',
      fr: 'https://maxvideoai.com/fr/integrations/claude',
      es: 'https://maxvideoai.com/es/integraciones/claude',
    },
    'https://maxvideoai.com/integrations/codex': {
      en: 'https://maxvideoai.com/integrations/codex',
      fr: 'https://maxvideoai.com/fr/integrations/codex',
      es: 'https://maxvideoai.com/es/integraciones/codex',
    },
    'https://maxvideoai.com/docs/mcp': {
      en: 'https://maxvideoai.com/docs/mcp',
      fr: 'https://maxvideoai.com/fr/docs/mcp',
      es: 'https://maxvideoai.com/es/docs/mcp',
    },
  } as const;

  assert.equal(
    entries.filter((entry) => Object.values(expected).some((locales) => Object.values(locales).includes(entry.loc as never))).length,
    15,
    'each localized MCP intent owner should be emitted exactly once',
  );
  for (const [canonical, locales] of Object.entries(expected)) {
    const entry = byLoc.get(canonical);
    assert.ok(entry, `${canonical} should be emitted by the enabled fixture`);
    const alternates = Object.fromEntries((entry.alternateRefs ?? []).map((item) => [item.hreflang, item.href]));
    assert.deepEqual(alternates, { ...locales, 'x-default': locales.en });
    assert.ok(entry.alternateRefs?.every((item) => item.hrefIsAbsolute === true));
  }
  assert.equal(entries.some((entry) => entry.loc.includes('api.maxvideoai.com/mcp')), false);
});

test('MCP metadata matches the approved intent and canonical locale routes', async () => {
  const { getMcpPageCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts'
  );
  const metadata = (['en', 'fr', 'es'] as const).map((locale) => getMcpPageCopy(locale).meta);
  assert.equal(metadata[0]?.title, 'AI Video Plugin for ChatGPT & Claude | MaxVideoAI');
  assert.equal(metadata[1]?.title, 'Plugin vidéo IA pour ChatGPT et Claude | MaxVideoAI');
  assert.equal(metadata[2]?.title, 'Plugin de vídeo con IA para ChatGPT y Claude | MaxVideoAI');
  assert.match(metadata[0]?.description ?? '', /ChatGPT.*Claude.*Codex.*prompts.*references.*budgets.*exact price.*generation/i);
  assert.match(metadata[1]?.description ?? '', /ChatGPT.*Claude.*Codex.*prompts.*références.*budgets.*prix exact.*génération/i);
  assert.match(metadata[2]?.description ?? '', /ChatGPT.*Claude.*Codex.*prompts.*referencias.*presupuestos.*precio exacto.*generación/i);
  for (const meta of metadata) {
    assert.doesNotMatch(`${meta.title} ${meta.description}`, /preview|préversion|vista previa|host validation|local implementation/i);
  }
  assert.ok(
    (['en', 'fr', 'es'] as const).every((locale) => [...getMcpPageCopy(locale).meta.title].length <= 60),
    'localized MCP titles should remain within the 60-character search-result target'
  );

  assert.deepEqual(buildMetadataUrls('en', undefined, { englishPath: '/mcp' }).canonical, 'https://maxvideoai.com/mcp');
  assert.deepEqual(buildMetadataUrls('fr', undefined, { englishPath: '/mcp' }).canonical, 'https://maxvideoai.com/fr/mcp');
  assert.deepEqual(buildMetadataUrls('es', undefined, { englishPath: '/mcp' }).canonical, 'https://maxvideoai.com/es/mcp');
  assert.deepEqual(buildMetadataUrls('es', undefined, { englishPath: '/integrations/claude' }).languages, {
    en: 'https://maxvideoai.com/integrations/claude',
    fr: 'https://maxvideoai.com/fr/integrations/claude',
    es: 'https://maxvideoai.com/es/integraciones/claude',
    'x-default': 'https://maxvideoai.com/integrations/claude',
  });
});

test('SSR answer passages cover the integration, price, references, confirmation, disconnect, and evidence date', async () => {
  assert.equal(existsSync(answerSectionPath), true, `${answerSectionPath} should exist`);
  const { getMcpPageCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts'
  );
  const { McpAnswerPassagesSection } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpAnswerPassagesSection.tsx'
  );
  const copy = getMcpPageCopy('en');
  const publication = getMcpPublicationState(mcpPublication);
  const html = renderToStaticMarkup(
    React.createElement(McpAnswerPassagesSection, {
      copy: copy.answers,
      lastChecked: '2026-08-26',
      locale: 'en',
      publication,
    }),
  );
  for (const item of Object.values(copy.answers.items)) {
    assert.ok(html.includes(item.title));
    assert.ok(html.includes(item.gatedBody));
  }
  assert.match(html, /<time[^>]*dateTime="2026-08-26"/);
  assert.match(html, /current models, real capabilities, budgets, exact pricing/i);
  assert.match(html, /project planning and model comparisons are free/i);
  assert.match(html, /review the exact request and price/i);
  assert.match(html, /remove MaxVideoAI from the assistant/i);
  assert.match(html, /top-up/i);
  assert.match(html, /same account library/i);
  assert.doesNotMatch(html, /FAQPage|HowTo/);

  const viewSource = readFileSync(`${routeRoot}/mcp/_components/McpPageView.tsx`, 'utf8');
  assert.match(viewSource, /McpAnswerPassagesSection/);
});

test('AI search crawlers can read public content while training crawlers and private surfaces remain blocked', () => {
  const groups = parseRobotsGroups(buildRobotsText('public'));
  const groupFor = (agent: string) => groups.find((group) => group.agents.includes(agent));
  const privateRules = ['Disallow: /api/', 'Disallow: /oauth', 'Disallow: /account', 'Disallow: /uploads', 'Disallow: /library'];

  for (const agent of ['OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User']) {
    const group = groupFor(agent);
    assert.ok(group, `${agent} should have an explicit answer/search crawler policy`);
    assert.ok(group.rules.includes('Allow: /'), `${agent} should be allowed on public content`);
    for (const rule of privateRules) assert.ok(group.rules.includes(rule), `${agent} should retain ${rule}`);
  }
  for (const agent of ['GPTBot', 'ClaudeBot', 'anthropic-ai', 'CCBot']) {
    const group = groupFor(agent);
    assert.ok(group, `${agent} should have an explicit training-crawler policy`);
    assert.ok(group.rules.includes('Disallow: /'), `${agent} should be blocked from training crawl`);
  }
});

test('served llms text stays aligned with the false promotion gate', () => {
  const source = buildLlmsText(mcpPublication);
  for (const path of ['/mcp', '/integrations/chatgpt', '/integrations/claude', '/integrations/codex', '/docs/mcp']) {
    assert.equal(source.includes(`https://maxvideoai.com${path}`), false, `${path} must remain absent while indexable=false`);
  }
  assert.doesNotMatch(source, /api\.maxvideoai\.com\/mcp/);
  assert.match(source, /MCP acquisition sources are omitted because the shared publication gate is closed\./);
});

test('contextual MCP links are localized, varied, and absent until the shared gate is enabled', async () => {
  assert.equal(existsSync(internalLinksPath), true, `${internalLinksPath} should exist`);
  const { getMcpInternalLink } = await import('../frontend/lib/mcp-internal-links.ts');
  const placements = ['home', 'footer', 'payg', 'models', 'model', 'comparison', 'examples', 'docs'] as const;
  for (const locale of ['en', 'fr', 'es'] as const) {
    for (const placement of placements) {
      assert.equal(getMcpInternalLink(locale, placement, mcpPublication), null);
    }
    const links = placements.map((placement) => getMcpInternalLink(locale, placement, enabledPublication));
    assert.ok(links.every(Boolean));
    assert.equal(new Set(links.map((link) => link?.label)).size, placements.length);
    const expectedHref = locale === 'en' ? '/mcp' : `/${locale}/mcp`;
    links.forEach((link) => assert.equal(link?.href, expectedHref));
  }

  for (const path of [
    'frontend/components/marketing/MarketingFooter.tsx',
    `${routeRoot}/(home)/page.tsx`,
    `${routeRoot}/pay-as-you-go-ai-video-generator/_lib/payg-page-data.ts`,
    `${routeRoot}/models/_components/ModelsCatalogPricingLimitsSection.tsx`,
    `${routeRoot}/models/[slug]/_components/ModelPrepLinksSection.tsx`,
    `${routeRoot}/ai-video-engines/[slug]/_components/CompareRelatedSection.tsx`,
    `${routeRoot}/examples/_components/examples-route-sections.tsx`,
    `${routeRoot}/docs/_components/DocsIndexView.tsx`,
  ]) {
    assert.match(readFileSync(path, 'utf8'), /getMcpInternalLink/, `${path} should consume the shared gate-aware link`);
  }
  const docsIndexSource = readFileSync(`${routeRoot}/docs/_lib/docs-index-data.ts`, 'utf8');
  assert.match(docsIndexSource, /mcpGuide:\s*publication\.indexable\s*\?/);
});

test('GSC baseline records the measured scope, limitations, query groups, and non-overlapping intent owners', () => {
  assert.equal(existsSync(gscBaselinePath), true, `${gscBaselinePath} should exist`);
  const source = readFileSync(gscBaselinePath, 'utf8');
  for (const pattern of [
    /sc-domain:maxvideoai\.com/,
    /2026-08-26/,
    /May 25[–-]Aug 24, 2026/,
    /Search type:\s*Web/i,
    /6,314 clicks/,
    /491,440 impressions/,
    /1\.3%/,
    /10\.2/,
    /27,759 impressions/,
    /homepage accounted for 4,835/i,
    /Earlier query-group capture/i,
    /\(price\|pricing\|cost\|cheap\|cheapest\|budget\|affordable\)/,
    /\(best\)/,
    /Claude/,
    /Codex/,
    /MCP/,
    /prompt/,
    /reference\|references\|référence\|références\|referencia\|referencias/,
    /filtered totals[\s\S]{0,80}partial/i,
    /primary intent owner/i,
    /\/pay-as-you-go-ai-video-generator/,
    /\/docs\/mcp/,
  ]) assert.match(source, pattern);
});
