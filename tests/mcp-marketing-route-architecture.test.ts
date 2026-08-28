import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { NextRequest } from 'next/server';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { middleware } from '../frontend/middleware.ts';
import { isMcpPublicSourcePath } from '../frontend/lib/mcp-publication.ts';

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
  `${mcpRoot}/_lib/mcp-host-proof.ts`,
  `${mcpRoot}/_components/McpPageView.tsx`,
  `${mcpRoot}/_components/McpHeroSection.tsx`,
  `${mcpRoot}/_components/McpClientActions.tsx`,
  `${mcpRoot}/_components/McpProofMedia.tsx`,
  `${mcpRoot}/_components/McpHostProofCard.tsx`,
  `${mcpRoot}/_components/McpWorkflowStrip.tsx`,
  `${mcpRoot}/_components/McpBudgetShortlist.tsx`,
  `${mcpRoot}/_components/McpEvidenceSection.tsx`,
  `${mcpRoot}/_components/McpReferenceWorkflowSection.tsx`,
  `${mcpRoot}/_components/McpAnswerPassagesSection.tsx`,
  `${mcpRoot}/_components/McpTrustSections.tsx`,
  `${mcpRoot}/_components/McpJsonLdScripts.tsx`,
  `${integrationsRoot}/claude/page.tsx`,
  `${integrationsRoot}/chatgpt/page.tsx`,
  `${integrationsRoot}/codex/page.tsx`,
  `${integrationsRoot}/_lib/integration-copy.ts`,
  `${integrationsRoot}/_components/IntegrationPageView.tsx`,
  `${integrationsRoot}/_components/IntegrationHeroSection.tsx`,
  `${integrationsRoot}/_components/IntegrationConversationPreview.tsx`,
  `${integrationsRoot}/_components/IntegrationSetupSection.tsx`,
  `${integrationsRoot}/_components/IntegrationWorkflowSection.tsx`,
  `${integrationsRoot}/_components/IntegrationTroubleshootingSection.tsx`,
  'frontend/app/mcp/page.tsx',
  'frontend/app/integrations/claude/page.tsx',
  'frontend/app/integrations/chatgpt/page.tsx',
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
  assert.match(page, /getMcpHostProof/);
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

test('ChatGPT, Claude, and Codex guides are equal thin server orchestrators', () => {
  for (const client of ['chatgpt', 'claude', 'codex'] as const) {
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

  const claudePage = requireFile(`${integrationsRoot}/claude/page.tsx`);
  const chatgptPage = requireFile(`${integrationsRoot}/chatgpt/page.tsx`);
  const codexPage = requireFile(`${integrationsRoot}/codex/page.tsx`);
  assert.match(claudePage, /getMcpHostProof\(['"]claude['"]/);
  assert.match(claudePage, /hostProof=\{hostProof\}/);
  assert.doesNotMatch(chatgptPage, /getMcpHostProof|McpHostProofCard|claude-inline-video-proof/);
  assert.doesNotMatch(codexPage, /getMcpHostProof|McpHostProofCard|claude-inline-video-proof/);

  for (const component of [
    'IntegrationPageView',
    'IntegrationHeroSection',
    'IntegrationConversationPreview',
    'IntegrationSetupSection',
    'IntegrationWorkflowSection',
    'IntegrationTroubleshootingSection',
  ]) {
    const source = requireFile(`${integrationsRoot}/_components/${component}.tsx`);
    assert.doesNotMatch(source, /['"]use client['"]/);
  }
});

test('client setup copy does not contradict the publication status shown above it', async () => {
  const { getIntegrationCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy.ts'
  );
  for (const locale of ['en', 'fr', 'es'] as const) {
    const intro = getIntegrationCopy(locale, 'claude').setup.intro;
    assert.doesNotMatch(intro, /public access remains disabled|accès public reste désactivé|acceso público sigue deshabilitado/i);
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
  assert.deepEqual(routing.pathnames['/integrations/chatgpt'], {
    en: '/integrations/chatgpt',
    fr: '/integrations/chatgpt',
    es: '/integraciones/chatgpt',
  });
  assert.deepEqual(routing.pathnames['/integrations/codex'], {
    en: '/integrations/codex',
    fr: '/integrations/codex',
    es: '/integraciones/codex',
  });
});

test('the MCP publication boundary recognizes exact localized source routes', () => {
  for (const path of [
    '/mcp',
    '/fr/mcp',
    '/es/mcp',
    '/integrations/claude',
    '/integrations/chatgpt',
    '/fr/integrations/codex',
    '/es/integraciones/claude',
    '/docs/mcp',
    '/fr/docs/mcp',
    '/es/docs/mcp',
  ]) {
    assert.equal(isMcpPublicSourcePath(path), true, `${path} should be gate-owned`);
  }
  assert.equal(isMcpPublicSourcePath('/models'), false);
  assert.equal(isMcpPublicSourcePath('/es/integraciones/not-a-client'), false);
});

test('published MCP routes pass the middleware boundary without a gated rewrite', async () => {
  for (const path of [
    '/mcp',
    '/fr/mcp',
    '/es/mcp',
    '/integrations/claude',
    '/integrations/chatgpt',
    '/fr/integrations/codex',
    '/es/integraciones/claude',
    '/es/integraciones/codex',
    '/docs/mcp',
    '/fr/docs/mcp',
    '/es/docs/mcp',
  ]) {
    const response = await middleware(new NextRequest(`https://maxvideoai.com${path}`));
    assert.equal(response.status, 200, `${path} should pass the published middleware boundary`);
    assert.equal(response.headers.get('x-robots-tag'), null);
    assert.doesNotMatch(
      response.headers.get('x-middleware-rewrite') ?? '',
      /__mcp-publication-gated__/,
      `${path} must not rewrite to the publication gate while live`,
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

test('metadata is reciprocal and indexable while publication gates are live', async () => {
  requireFile(`${mcpRoot}/page.tsx`);
  requireFile(`${integrationsRoot}/claude/page.tsx`);
  requireFile(`${integrationsRoot}/chatgpt/page.tsx`);
  requireFile(`${integrationsRoot}/codex/page.tsx`);

  const mcp = await import('../frontend/app/(localized)/[locale]/(marketing)/mcp/page.tsx');
  const claude = await import('../frontend/app/(localized)/[locale]/(marketing)/integrations/claude/page.tsx');
  const chatgpt = await import('../frontend/app/(localized)/[locale]/(marketing)/integrations/chatgpt/page.tsx');
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
      module: chatgpt,
      paths: {
        en: 'https://maxvideoai.com/integrations/chatgpt',
        fr: 'https://maxvideoai.com/fr/integrations/chatgpt',
        es: 'https://maxvideoai.com/es/integraciones/chatgpt',
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
      assert.equal(typeof metadata.robots === 'object' ? metadata.robots?.index : metadata.robots, true);
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
    evidenceKind: string;
    lastChecked: string;
    sourceEvidence: string;
    hosts: Record<string, { status: string; version?: string }>;
  };
  assert.equal(config.evidenceKind, 'hosted-checkpoint');
  assert.equal(config.lastChecked, '2026-08-27');
  assert.equal(config.sourceEvidence, 'docs/operations/mcp-host-compatibility-matrix.md');
  assert.match(requireFile(config.sourceEvidence), new RegExp(config.lastChecked));
  assert.equal('lastVerified' in config, false);
  assert.equal(config.hosts.claudeDesktop?.status, 'verified');
  assert.equal(config.hosts.codexCli?.status, 'verified');
  assert.equal(config.hosts.chatgptWeb?.status, 'not-run');
  assert.equal('chatgptDesktop' in config.hosts, false);
  assert.equal(config.hosts.claudeCode?.status, 'not-run');

  const mcpCopy = requireFile(`${mcpRoot}/_lib/mcp-page-copy.ts`);
  const integrationCopy = requireFile(`${integrationsRoot}/_lib/integration-copy.ts`);
  for (const source of [mcpCopy, integrationCopy]) {
    assert.doesNotMatch(source, /lastVerifiedLabel/);
    assert.doesNotMatch(source, /Hosted read-only[^\n]*passed|hébergé[^\n]*réussi|alojad[^\n]*pasaron/i);
    assert.match(source, /Hosted (?:evidence|checkpoint|capability review)|Compatibility checked/i);
  }
});
