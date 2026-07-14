import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { NextRequest } from 'next/server';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { middleware } from '../frontend/middleware.ts';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const routeRoot = 'frontend/app/(localized)/[locale]/(marketing)';
const mcpRoot = `${routeRoot}/mcp`;
const integrationsRoot = `${routeRoot}/integrations`;

const requiredFiles = [
  `${mcpRoot}/page.tsx`,
  `${mcpRoot}/_lib/mcp-page-types.ts`,
  `${mcpRoot}/_lib/mcp-page-copy.ts`,
  `${mcpRoot}/_lib/mcp-jsonld.ts`,
  `${mcpRoot}/_lib/mcp-compatibility.ts`,
  `${mcpRoot}/_components/McpPageView.tsx`,
  `${mcpRoot}/_components/McpHeroSection.tsx`,
  `${mcpRoot}/_components/McpClientActions.tsx`,
  `${mcpRoot}/_components/McpProofMedia.tsx`,
  `${mcpRoot}/_components/McpWorkflowStrip.tsx`,
  `${mcpRoot}/_components/McpBudgetShortlist.tsx`,
  `${mcpRoot}/_components/McpEvidenceSection.tsx`,
  `${mcpRoot}/_components/McpReferenceWorkflowSection.tsx`,
  `${mcpRoot}/_components/McpAnswerPassagesSection.tsx`,
  `${mcpRoot}/_components/McpTrustSections.tsx`,
  `${mcpRoot}/_components/McpJsonLdScripts.tsx`,
  `${integrationsRoot}/claude/page.tsx`,
  `${integrationsRoot}/codex/page.tsx`,
  `${integrationsRoot}/_lib/integration-copy.ts`,
  `${integrationsRoot}/_components/IntegrationPageView.tsx`,
  `${integrationsRoot}/_components/IntegrationHeroSection.tsx`,
  `${integrationsRoot}/_components/IntegrationSetupSection.tsx`,
  `${integrationsRoot}/_components/IntegrationWorkflowSection.tsx`,
  `${integrationsRoot}/_components/IntegrationTroubleshootingSection.tsx`,
  'frontend/app/mcp/page.tsx',
  'frontend/app/integrations/claude/page.tsx',
  'frontend/app/integrations/codex/page.tsx',
  'frontend/config/mcp-compatibility.json',
] as const;

function requireFile(path: string): string {
  assert.equal(existsSync(path), true, `${path} should exist`);
  return readFileSync(path, 'utf8');
}

test('MCP acquisition routes have focused server-rendered owners', () => {
  for (const path of requiredFiles) requireFile(path);

  const page = requireFile(`${mcpRoot}/page.tsx`);
  assert.match(page, /buildSeoMetadata/);
  assert.match(page, /englishPath:\s*['"]\/mcp['"]/);
  assert.match(page, /getMcpPublicationState/);
  assert.match(page, /FEATURES\.mcp/);
  assert.match(page, /buildMcpBudgetOptions/);
  assert.match(page, /getMcpProof/);
  assert.match(page, /notFound\(\)/);
  assert.match(page, /McpPageView/);
  assert.match(page, /McpJsonLdScripts/);
  assert.doesNotMatch(page, /['"]use client['"]/);
  assert.ok(page.split('\n').length <= 250, `MCP page should stay below 250 lines, got ${page.split('\n').length}`);

  const view = requireFile(`${mcpRoot}/_components/McpPageView.tsx`);
  for (const owner of [
    'McpHeroSection',
    'McpWorkflowStrip',
    'McpBudgetShortlist',
    'McpReferenceWorkflowSection',
    'McpAnswerPassagesSection',
    'McpTrustSections',
  ]) {
    assert.match(view, new RegExp(owner));
  }
  assert.doesNotMatch(view, /['"]use client['"]/);
});

test('Claude and Codex guides are equal thin server orchestrators', () => {
  for (const client of ['claude', 'codex'] as const) {
    const page = requireFile(`${integrationsRoot}/${client}/page.tsx`);
    assert.match(page, /buildSeoMetadata/);
    assert.match(page, new RegExp(`englishPath:\\s*['"]\\/integrations\\/${client}['"]`));
    assert.match(page, /getIntegrationCopy/);
    assert.match(page, /getMcpPublicationState/);
    assert.match(page, /notFound\(\)/);
    assert.match(page, /IntegrationPageView/);
    assert.doesNotMatch(page, /['"]use client['"]/);
    assert.ok(page.split('\n').length <= 250, `${client} page should stay below 250 lines`);
  }

  for (const component of [
    'IntegrationPageView',
    'IntegrationHeroSection',
    'IntegrationSetupSection',
    'IntegrationWorkflowSection',
    'IntegrationTroubleshootingSection',
  ]) {
    const source = requireFile(`${integrationsRoot}/_components/${component}.tsx`);
    assert.doesNotMatch(source, /['"]use client['"]/);
  }
});

test('localized routing owns the exact MCP and integration route contract', async () => {
  requireFile('frontend/config/localized-slugs.json');
  requireFile('frontend/i18n/routing.ts');
  const slugs = JSON.parse(readFileSync('frontend/config/localized-slugs.json', 'utf8')) as Record<
    string,
    Record<'en' | 'fr' | 'es', string>
  >;
  assert.deepEqual(slugs.mcp, { en: 'mcp', fr: 'mcp', es: 'mcp' });
  assert.deepEqual(slugs.integrations, {
    en: 'integrations',
    fr: 'integrations',
    es: 'integraciones',
  });

  const { routing } = await import('../frontend/i18n/routing.ts');
  assert.deepEqual(routing.pathnames['/mcp'], { en: '/mcp', fr: '/mcp', es: '/mcp' });
  assert.deepEqual(routing.pathnames['/integrations/claude'], {
    en: '/integrations/claude',
    fr: '/integrations/claude',
    es: '/integraciones/claude',
  });
  assert.deepEqual(routing.pathnames['/integrations/codex'], {
    en: '/integrations/codex',
    fr: '/integrations/codex',
    es: '/integraciones/codex',
  });
});

test('real middleware resolves exact MCP routes without redirects or not-found rewrites', async () => {
  for (const path of [
    '/mcp',
    '/fr/mcp',
    '/es/mcp',
    '/integrations/claude',
    '/fr/integrations/codex',
    '/es/integraciones/claude',
  ]) {
    const response = await middleware(new NextRequest(`https://maxvideoai.com${path}`));
    assert.equal(response.status, 200, `${path} should resolve through middleware`);
    assert.equal(response.headers.get('location'), null, `${path} should not redirect`);
    assert.doesNotMatch(
      response.headers.get('x-middleware-rewrite') ?? '',
      /(?:^|\/)404(?:$|\?)/,
      `${path} should not rewrite to not found`,
    );
  }
});

test('route views preserve the single marketing-layout main landmark in server output', async () => {
  const marketingLayout = requireFile('frontend/app/(localized)/[locale]/(marketing)/layout.tsx');
  assert.equal((marketingLayout.match(/<main\b/g) ?? []).length, 1);

  const { McpPageView } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpPageView.tsx'
  );
  const { getMcpPageCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts'
  );
  const { getMcpCompatibilityEvidence } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-compatibility.ts'
  );
  const { IntegrationPageView } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/integrations/_components/IntegrationPageView.tsx'
  );
  const { getIntegrationCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy.ts'
  );
  const publication = {
    renderPublicPage: true,
    connectionAvailable: false,
    indexable: false,
    showTrialClaim: false,
    showPaidGenerationClaim: false,
    showReferenceClaim: false,
  };
  const compatibility = getMcpCompatibilityEvidence();
  const mcpHtml = renderToStaticMarkup(
    React.createElement(McpPageView, {
      budgetOptions: [],
      compatibility,
      copy: getMcpPageCopy('en'),
      locale: 'en',
      proof: null,
      publication,
    }),
  );
  const integrationHtml = renderToStaticMarkup(
    React.createElement(IntegrationPageView, {
      compatibility: compatibility.clients.codex,
      copy: getIntegrationCopy('en', 'codex'),
      locale: 'en',
      publication,
    }),
  );
  assert.doesNotMatch(mcpHtml, /<main\b/);
  assert.doesNotMatch(integrationHtml, /<main\b/);
});

test('metadata is reciprocal but fails closed while publication gates are false', async () => {
  requireFile(`${mcpRoot}/page.tsx`);
  requireFile(`${integrationsRoot}/claude/page.tsx`);
  requireFile(`${integrationsRoot}/codex/page.tsx`);

  const mcp = await import('../frontend/app/(localized)/[locale]/(marketing)/mcp/page.tsx');
  const claude = await import('../frontend/app/(localized)/[locale]/(marketing)/integrations/claude/page.tsx');
  const codex = await import('../frontend/app/(localized)/[locale]/(marketing)/integrations/codex/page.tsx');
  const cases = [
    {
      module: mcp,
      paths: {
        en: 'https://maxvideoai.com/mcp',
        fr: 'https://maxvideoai.com/fr/mcp',
        es: 'https://maxvideoai.com/es/mcp',
      },
    },
    {
      module: claude,
      paths: {
        en: 'https://maxvideoai.com/integrations/claude',
        fr: 'https://maxvideoai.com/fr/integrations/claude',
        es: 'https://maxvideoai.com/es/integraciones/claude',
      },
    },
    {
      module: codex,
      paths: {
        en: 'https://maxvideoai.com/integrations/codex',
        fr: 'https://maxvideoai.com/fr/integrations/codex',
        es: 'https://maxvideoai.com/es/integraciones/codex',
      },
    },
  ] as const;

  for (const route of cases) {
    for (const locale of ['en', 'fr', 'es'] as const) {
      const metadata = await route.module.generateMetadata({ params: Promise.resolve({ locale }) });
      assert.equal(metadata.alternates?.canonical, route.paths[locale]);
      assert.deepEqual(metadata.alternates?.languages, {
        en: route.paths.en,
        fr: route.paths.fr,
        es: route.paths.es,
        'x-default': route.paths.en,
      });
      assert.equal(typeof metadata.robots === 'object' ? metadata.robots?.index : metadata.robots, false);
    }
  }
});

test('MCP schema builders fail closed and emit only factual live schema types', async () => {
  requireFile(`${mcpRoot}/_lib/mcp-jsonld.ts`);
  requireFile(`${mcpRoot}/_lib/mcp-page-copy.ts`);
  const { buildMcpBreadcrumbJsonLd, buildMcpWebApplicationJsonLd } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-jsonld.ts'
  );
  const { getMcpPageCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts'
  );
  const copy = getMcpPageCopy('en');
  const gated = {
    renderPublicPage: true,
    connectionAvailable: true,
    indexable: false,
    showTrialClaim: false,
    showPaidGenerationClaim: false,
    showReferenceClaim: false,
  };
  const live = {
    renderPublicPage: true,
    connectionAvailable: true,
    indexable: true,
    showTrialClaim: true,
    showPaidGenerationClaim: true,
    showReferenceClaim: true,
  };
  assert.equal(
    buildMcpWebApplicationJsonLd({
      canonicalUrl: 'https://maxvideoai.com/mcp',
      copy,
      inLanguage: 'en-US',
      publication: gated,
    }),
    null,
  );
  const application = buildMcpWebApplicationJsonLd({
    canonicalUrl: 'https://maxvideoai.com/mcp',
    copy,
    inLanguage: 'en-US',
    publication: live,
  });
  const breadcrumb = buildMcpBreadcrumbJsonLd({ canonicalUrl: 'https://maxvideoai.com/mcp', copy, locale: 'en' });
  assert.equal(application?.['@type'], 'WebApplication');
  assert.equal(application && 'operatingSystem' in application, false);
  assert.equal(breadcrumb['@type'], 'BreadcrumbList');
  const schemas = JSON.stringify([application, breadcrumb]);
  assert.doesNotMatch(schemas, /AggregateRating|Offer|FAQPage|HowTo/);

  for (const [locale, home] of [
    ['en', 'https://maxvideoai.com'],
    ['fr', 'https://maxvideoai.com/fr'],
    ['es', 'https://maxvideoai.com/es'],
  ] as const) {
    const localized = buildMcpBreadcrumbJsonLd({
      canonicalUrl: `https://maxvideoai.com${locale === 'en' ? '' : `/${locale}`}/mcp`,
      copy: getMcpPageCopy(locale),
      locale,
    });
    assert.equal(localized.itemListElement[0]?.item, home);
  }
});

test('visible compatibility dates are sourced from the recorded evidence config', () => {
  const config = JSON.parse(requireFile('frontend/config/mcp-compatibility.json')) as {
    lastVerified: string;
    sourceEvidence: string;
    hosts: Record<string, { version: string }>;
  };
  assert.match(config.lastVerified, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(config.sourceEvidence, 'docs/operations/mcp-host-compatibility-matrix.md');
  assert.match(requireFile(config.sourceEvidence), new RegExp(`Last verified: ${config.lastVerified}`));
  assert.equal(config.hosts.claudeDesktop?.version, '1.20186.1');
  assert.equal(config.hosts.claudeCode?.version, '2.1.207');
  assert.equal(config.hosts.codexCli?.version, '0.144.1');
});
