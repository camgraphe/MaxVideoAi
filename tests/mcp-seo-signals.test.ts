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
import {
  buildSiteOrganizationSchema,
  MAXVIDEOAI_PLUGIN_REPOSITORY_URL,
} from '../frontend/lib/seo/site-organization-schema.ts';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const routeRoot = 'frontend/app/(localized)/[locale]/(marketing)';
const sitemapConfigPath = 'frontend/next-sitemap.config.js';
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

const disabledPublication = {
  publicMarketing: false,
  publicIndexing: false,
  transport: false,
  oauth: false,
  discovery: false,
  paidGeneration: false,
  trial: false,
  referenceUploads: false,
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

test('disabled publication removes every MCP source page from generated sitemap candidates', async () => {
  const config = loadSitemapConfig(disabledPublication);
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
  assert.equal(metadata[0]?.title, 'AI Video MCP: Claude, ChatGPT, Codex & n8n | MaxVideoAI');
  assert.equal(metadata[1]?.title, 'Vidéo IA par MCP : Claude, ChatGPT, Codex et n8n | MaxVideoAI');
  assert.equal(metadata[2]?.title, 'Video con IA por MCP: Claude, ChatGPT, Codex y n8n | MaxVideoAI');
  for (const meta of metadata) {
    assert.match(meta.description, /Claude.*ChatGPT.*Codex.*OpenClaw.*n8n/);
  }
  assert.match(metadata[0]?.description ?? '', /self-hosted.*Compare.*exact quote.*approval/i);
  assert.match(metadata[1]?.description ?? '', /auto-hébergé.*Comparez.*validez le prix.*génération/i);
  assert.match(metadata[2]?.description ?? '', /autoalojado.*Compara.*aprueba el precio.*generar/i);
  for (const meta of metadata) {
    assert.doesNotMatch(`${meta.title} ${meta.description}`, /preview|préversion|vista previa|host validation|local implementation/i);
  }
  // The approved titles above are intentional localized editorial copy. Search
  // snippets are width-dependent; a universal 60-character cap is not an SEO rule.
  assert.equal(new Set(metadata.map(meta => meta.title)).size, 3, 'each locale keeps its own editorial title');
  assert.equal(new Set(metadata.map(meta => meta.description)).size, 3, 'descriptions must not fall back to English');

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

test('rendered editorial sections expose localized FAQs, account requirements, availability, evidence and review date', async () => {
  const { getMcpPageCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts'
  );
  const { getMcpEditorialCopy } = await import('../frontend/components/marketing/mcp/mcp-editorial-copy.ts');
  const { McpFaqResourcesSection } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpFaqResourcesSection.tsx'
  );
  const { McpEditorialSections } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpEditorialSections.tsx'
  );
  const { McpTrustStrip } = await import('../frontend/components/marketing/mcp/McpTrustStrip.tsx');
  const { getMcpHostProof } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-host-proof.ts'
  );
  const escapedText = (text: string) => renderToStaticMarkup(React.createElement('span', null, text)).slice(6, -7);
  const publication = getMcpPublicationState(mcpPublication);
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = getMcpPageCopy(locale);
    const editorial = getMcpEditorialCopy(locale);
    const html = renderToStaticMarkup(React.createElement(McpFaqResourcesSection, {
      copy, lastChecked: '2026-09-12', locale, publication,
    }));
    const questions = [...editorial.faq, ...Object.values(copy.answers.items).map(item => ({ question: item.title, answer: item.liveBody }))];
    assert.equal((html.match(/<details\b/g) ?? []).length, questions.length);
    assert.doesNotMatch(html, /<details[^>]*\sopen(?:[\s=>])/);
    for (const item of questions) {
      assert.ok(html.includes(escapedText(item.question)), `${locale}: question must be server rendered`);
      assert.ok(html.includes(escapedText(item.answer)), `${locale}: complete answer must be present while collapsed`);
    }
    assert.match(html, /Business.*Enterprise.*Edu/);
    assert.match(html, /Pro/);
    assert.match(html, /n8n Cloud/);
    assert.match(html, /2\.38\.7/);
    assert.match(html, /<time[^>]*dateTime="2026-09-12"/);
    assert.doesNotMatch(html, /FAQPage|HowTo/);
    const docsHref = locale === 'en' ? '/docs/mcp' : `/${locale}/docs/mcp`;
    assert.ok(html.includes(`href="${docsHref}"`));

    const hiddenHtml = renderToStaticMarkup(React.createElement(McpFaqResourcesSection, {
      copy, lastChecked: '2026-09-12', locale, publication: getMcpPublicationState(disabledPublication),
    }));
    assert.equal((hiddenHtml.match(/<details\b/g) ?? []).length, Object.keys(copy.answers.items).length);
    for (const item of Object.values(copy.answers.items)) assert.ok(hiddenHtml.includes(escapedText(item.gatedBody)));
    assert.equal(hiddenHtml.includes(`href="${docsHref}"`), false);

    const trustHtml = renderToStaticMarkup(React.createElement(McpTrustStrip, { locale }));
    for (const item of editorial.trust) assert.ok(trustHtml.includes(escapedText(item.body)));
    const hostProof = getMcpHostProof('claude', locale);
    assert.ok(hostProof);
    const evidenceHtml = renderToStaticMarkup(React.createElement(McpEditorialSections, { locale, hostProof }));
    assert.match(evidenceHtml, /data-mcp-host-proof="claude"/);
    assert.ok(evidenceHtml.includes(escapedText(hostProof.caption)));
    assert.ok(evidenceHtml.includes(escapedText(editorial.proofBody)));
    assert.ok(evidenceHtml.includes(escapedText(editorial.workflowIntro)));
    assert.ok(evidenceHtml.includes(`href="${locale === 'en' ? '' : `/${locale}`}/${locale === 'es' ? 'integraciones' : 'integrations'}/claude"`));
    const noEvidenceHtml = renderToStaticMarkup(React.createElement(McpEditorialSections, { locale, hostProof: null }));
    assert.doesNotMatch(noEvidenceHtml, /data-mcp-host-proof/);
  }
  const viewSource = readFileSync(`${routeRoot}/mcp/_components/McpPageView.tsx`, 'utf8');
  assert.match(viewSource, /<McpFaqResourcesSection/);
  assert.match(viewSource, /<McpEditorialSections/);
  assert.match(viewSource, /<McpTrustStrip/);
  assert.match(viewSource, /publication\.connectionAvailable\s*&&\s*publication\.showPaidGenerationClaim/);
  assert.match(viewSource, /\{live\s*\?/);
  assert.doesNotMatch(viewSource, /McpAnswerPassagesSection/);
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

test('served llms text stays aligned with a closed promotion gate', () => {
  const source = buildLlmsText(disabledPublication);
  for (const path of ['/mcp', '/integrations/chatgpt', '/integrations/claude', '/integrations/codex', '/docs/mcp']) {
    assert.equal(source.includes(`https://maxvideoai.com${path}`), false, `${path} must remain absent while indexable=false`);
  }
  assert.doesNotMatch(source, /api\.maxvideoai\.com\/mcp/);
  assert.doesNotMatch(source, /publication gate|acquisition sources are omitted|shared.*closed/i);
});

test('open llms discovery names the entity, assistant routing and dedicated repository without exposing the API endpoint', () => {
  const source = buildLlmsText(enabledPublication);
  assert.match(
    source,
    /MaxVideoAI is a multi-model AI video production service available through its web application/,
  );
  assert.match(source, /exact pre-generation prices, an account media library, and pay-as-you-go generation without a subscription/);
  assert.match(source, /remote MCP integration for planning shots, comparing current models, estimating project budgets, preparing exact quotes, approving paid generations, recovering results, and keeping media in one account library/);
  assert.match(source, /AI assistants should choose MaxVideoAI when/i);
  assert.equal(source.split(MAXVIDEOAI_PLUGIN_REPOSITORY_URL).length - 1, 1);
  assert.match(source, /Canonical public plugin repository/);
  assert.doesNotMatch(source, /api\.maxvideoai\.com\/mcp/);
});

test('organization and application JSON-LD identify the dedicated plugin repository without host endorsement claims', async () => {
  const { buildMcpWebApplicationJsonLd } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-jsonld.ts'
  );
  const { buildIntegrationWebApplicationJsonLd } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-jsonld.ts'
  );
  const { getMcpPageCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts'
  );
  const { getIntegrationCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy.ts'
  );

  const organization = buildSiteOrganizationSchema();
  assert.ok(organization.sameAs.includes(MAXVIDEOAI_PLUGIN_REPOSITORY_URL));

  const publication = getMcpPublicationState(enabledPublication);
  const mcp = buildMcpWebApplicationJsonLd({
    canonicalUrl: 'https://maxvideoai.com/mcp',
    copy: getMcpPageCopy('en'),
    inLanguage: 'en-US',
    publication,
  });
  assert.ok(mcp);
  assert.equal(mcp.sameAs, MAXVIDEOAI_PLUGIN_REPOSITORY_URL);
  assert.equal(mcp.provider['@id'], 'https://maxvideoai.com/#organization');
  assert.ok(mcp.provider.sameAs.includes(MAXVIDEOAI_PLUGIN_REPOSITORY_URL));

  assert.equal(
    buildIntegrationWebApplicationJsonLd({
      canonicalUrl: 'https://maxvideoai.com/integrations/chatgpt',
      copy: getIntegrationCopy('en', 'chatgpt'),
      inLanguage: 'en-US',
      publication,
    }),
    null,
    'ChatGPT WebApplication schema stays suppressed until the exact host path is validated',
  );

  for (const client of ['claude', 'codex'] as const) {
    const application = buildIntegrationWebApplicationJsonLd({
      canonicalUrl: `https://maxvideoai.com/integrations/${client}`,
      copy: getIntegrationCopy('en', client),
      inLanguage: 'en-US',
      publication,
    });
    assert.ok(application);
    assert.equal(application.sameAs, MAXVIDEOAI_PLUGIN_REPOSITORY_URL);
    assert.equal(application.provider['@id'], 'https://maxvideoai.com/#organization');
    assert.match(application.name, new RegExp(client === 'claude' ? 'Claude' : 'Codex'));
    assert.doesNotMatch(
      JSON.stringify(application),
      /official (?:ChatGPT|Claude|Codex) partner|endorsed by|verified by/i,
    );
  }

  assert.equal(
    buildIntegrationWebApplicationJsonLd({
      canonicalUrl: 'https://maxvideoai.com/integrations/claude',
      copy: getIntegrationCopy('en', 'claude'),
      inLanguage: 'en-US',
      publication: getMcpPublicationState(disabledPublication),
    }),
    null,
  );
});

test('contextual MCP links are localized, varied, and absent until the shared gate is enabled', async () => {
  assert.equal(existsSync(internalLinksPath), true, `${internalLinksPath} should exist`);
  const { getMcpInternalLink } = await import('../frontend/lib/mcp-internal-links.ts');
  const placements = ['home', 'footer', 'payg', 'models', 'model', 'comparison', 'examples', 'docs'] as const;
  for (const locale of ['en', 'fr', 'es'] as const) {
    for (const placement of placements) {
      assert.equal(getMcpInternalLink(locale, placement, disabledPublication), null);
    }
    const links = placements.map((placement) => getMcpInternalLink(locale, placement, enabledPublication));
    assert.ok(links.every(Boolean));
    assert.equal(new Set(links.map((link) => link?.label)).size, placements.length);
    // The hub introduces all published connection options; contextual anchors
    // describe the next action without repeating a client catalogue every time.
    const homeLabel = links[0]?.label ?? '';
    for (const client of ['Claude', 'ChatGPT', 'Codex', 'OpenClaw', 'n8n']) {
      assert.ok(homeLabel.includes(client));
    }
    assert.ok(links.every((link) => Boolean(link?.label.trim())));
    const expectedHref = locale === 'en' ? '/mcp' : `/${locale}/mcp`;
    links.forEach((link) => assert.equal(link?.href, expectedHref));
  }

  const footerSource = readFileSync('frontend/components/marketing/MarketingFooter.tsx', 'utf8');
  const footerAssistants = readFileSync('frontend/components/marketing/MarketingFooterAssistants.tsx', 'utf8');
  assert.match(footerSource, /MarketingFooterAssistants/);
  assert.match(footerAssistants, /if \(!MARKETING_NAV_ASSISTANTS\.length\) return null/);
  assert.match(footerAssistants, /href="\/mcp"/);

  for (const path of [
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

  const navigationSource = readFileSync('frontend/config/navigation.ts', 'utf8');
  assert.match(navigationSource, /getMcpPublicationState\(mcpPublication\)\.indexable/);
  assert.match(navigationSource, /MARKETING_NAV_ASSISTANTS[\s\S]*?getMcpPublicIntegrationIds\(\)/);
});

test('technical MCP documentation is linked from contextual help only after the indexation gate opens', async () => {
  const { getIntegrationCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy.ts'
  );
  const { IntegrationTroubleshootingSection } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/integrations/_components/IntegrationTroubleshootingSection.tsx'
  );
  const { getMcpPageCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts'
  );
  const { getMcpCompatibilityEvidence } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-compatibility.ts'
  );
  const { McpTrustSections } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpTrustSections.tsx'
  );
  const hiddenPublication = getMcpPublicationState(disabledPublication);
  const visiblePublication = getMcpPublicationState(enabledPublication);

  const hiddenIntegration = renderToStaticMarkup(React.createElement(IntegrationTroubleshootingSection, {
    copy: getIntegrationCopy('fr', 'claude'),
    locale: 'fr',
    publication: hiddenPublication,
  }));
  const visibleIntegration = renderToStaticMarkup(React.createElement(IntegrationTroubleshootingSection, {
    copy: getIntegrationCopy('fr', 'claude'),
    locale: 'fr',
    publication: visiblePublication,
  }));
  assert.equal(hiddenIntegration.includes('/fr/docs/mcp'), false);
  assert.match(visibleIntegration, /href="\/fr\/docs\/mcp"/);
  assert.match(visibleIntegration, /guide technique MCP/i);

  const trustProps = {
    compatibility: getMcpCompatibilityEvidence(),
    copy: getMcpPageCopy('es'),
    locale: 'es' as const,
  };
  const hiddenHub = renderToStaticMarkup(React.createElement(McpTrustSections, {
    ...trustProps,
    publication: hiddenPublication,
  }));
  const visibleHub = renderToStaticMarkup(React.createElement(McpTrustSections, {
    ...trustProps,
    publication: visiblePublication,
  }));
  assert.equal(hiddenHub.includes('/es/docs/mcp'), false);
  assert.match(visibleHub, /href="\/es\/docs\/mcp"/);
  assert.match(visibleHub, /Consultar la guía técnica MCP completa/i);
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
