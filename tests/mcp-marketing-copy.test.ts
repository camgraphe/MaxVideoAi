import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getMcpCompatibilityEvidence as readCompatibilityEvidence } from '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-compatibility.ts';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const routeRoot = 'frontend/app/(localized)/[locale]/(marketing)';
const copyPath = `${routeRoot}/mcp/_lib/mcp-page-copy.ts`;
const heroPath = `${routeRoot}/mcp/_components/McpHeroSection.tsx`;
const evidencePath = `${routeRoot}/mcp/_components/McpEvidenceSection.tsx`;
const referencePath = `${routeRoot}/mcp/_components/McpReferenceWorkflowSection.tsx`;
const integrationCopyPath = `${routeRoot}/integrations/_lib/integration-copy.ts`;
const integrationViewPath = `${routeRoot}/integrations/_components/IntegrationPageView.tsx`;

function requireFile(path: string): string {
  assert.equal(existsSync(path), true, `${path} should exist`);
  return readFileSync(path, 'utf8');
}

test('English above-fold acquisition copy matches the approved wording exactly', async () => {
  requireFile(copyPath);
  const { getMcpPageCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts'
  );
  const copy = getMcpPageCopy('en');
  assert.equal(copy.hero.title, 'Turn your brief into the right model, prompt and budget.');
  assert.deepEqual(copy.hero.eyebrows, {
    trial: 'FIRST VIDEO INCLUDED',
    budget: 'LOW-COST MODELS FIRST',
    price: 'PRICE BEFORE YOU GENERATE',
  });
  assert.deepEqual(copy.hero.actions.map((action: { label: string }) => action.label), [
    'Start with Claude',
    'Start with Codex',
  ]);
  assert.deepEqual(copy.workflow.steps, [
    'Describe your video',
    'Compare the best low-cost routes',
    'Confirm price & generate',
  ]);
});

test('French and Spanish use complete natural copy rather than English fallback', async () => {
  requireFile(copyPath);
  const { getMcpPageCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts'
  );
  const fr = getMcpPageCopy('fr');
  const es = getMcpPageCopy('es');
  assert.equal(fr.hero.title, 'Transformez votre brief en modèle, prompt et budget adaptés.');
  assert.deepEqual(fr.workflow.steps, [
    'Décrivez votre vidéo',
    'Comparez les meilleures options économiques',
    'Confirmez le prix et générez',
  ]);
  assert.equal(es.hero.title, 'Convierte tu idea en el modelo, el prompt y el presupuesto adecuados.');
  assert.deepEqual(es.workflow.steps, [
    'Describe tu video',
    'Compara las mejores opciones de bajo costo',
    'Confirma el precio y genera',
  ]);
  assert.notDeepEqual(fr, getMcpPageCopy('en'));
  assert.notDeepEqual(es, getMcpPageCopy('en'));
});

test('metadata carries natural AI video generator intent in every locale', async () => {
  const { getMcpPageCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts'
  );
  assert.match(getMcpPageCopy('en').meta.title, /AI Video Generator/);
  assert.match(getMcpPageCopy('fr').meta.title, /Générateur vidéo IA/);
  assert.match(getMcpPageCopy('es').meta.title, /Generador de video con IA/);
});

test('trial and proof claims disappear when their evidence gates are false', async () => {
  requireFile(copyPath);
  requireFile(heroPath);
  requireFile(evidencePath);
  const { getMcpPageCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts'
  );
  const { McpHeroSection } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpHeroSection.tsx'
  );
  const { McpEvidenceSection } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpEvidenceSection.tsx'
  );
  const copy = getMcpPageCopy('en');
  const publication = {
    renderPublicPage: true,
    connectionAvailable: false,
    indexable: false,
    showTrialClaim: false,
    showPaidGenerationClaim: false,
    showReferenceClaim: false,
  };
  const heroHtml = renderToStaticMarkup(
    React.createElement(McpHeroSection, { copy: copy.hero, proof: null, publication }),
  );
  assert.equal(heroHtml.includes(copy.hero.eyebrows.trial), false);
  assert.equal(heroHtml.includes(copy.hero.eyebrows.budget), true);
  assert.equal(heroHtml.includes(copy.hero.eyebrows.price), true);

  const evidenceHtml = renderToStaticMarkup(
    React.createElement(McpEvidenceSection, { copy: copy.evidence, proof: null }),
  );
  assert.equal(evidenceHtml, '');
  assert.doesNotMatch(evidenceHtml, /<video|badge|caption|Real MaxVideoAI output|Generated through MCP/i);
  assert.match(readFileSync(evidencePath, 'utf8'), /proof\.badge/);
});

test('trial copy discloses the fixed promotional conditions only behind its claim gate', async () => {
  const { getMcpPageCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts'
  );
  const { McpHeroSection } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpHeroSection.tsx'
  );
  const expectations = {
    en: [/eligible verified account/i, /Seedance 2 Mini/, /5 seconds/, /480p/, /promotion/i, /wallet/i, /regular balance/i],
    fr: [/compte admissible et vérifié/i, /Seedance 2 Mini/, /5 secondes/, /480p/, /offre promotionnelle/i, /portefeuille/i, /solde habituel/i],
    es: [/cuenta apta y verificada/i, /Seedance 2 Mini/, /5 segundos/, /480p/, /promoción/i, /cartera/i, /saldo habitual/i],
  } as const;
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = getMcpPageCopy(locale);
    for (const pattern of expectations[locale]) assert.match(copy.hero.trialDisclosure, pattern);
    const liveHtml = renderToStaticMarkup(React.createElement(McpHeroSection, {
      copy: copy.hero,
      proof: null,
      publication: {
        renderPublicPage: true,
        connectionAvailable: true,
        indexable: false,
        showTrialClaim: true,
        showPaidGenerationClaim: false,
        showReferenceClaim: false,
      },
    }));
    const gatedHtml = renderToStaticMarkup(React.createElement(McpHeroSection, {
      copy: copy.hero,
      proof: null,
      publication: {
        renderPublicPage: true,
        connectionAvailable: true,
        indexable: false,
        showTrialClaim: false,
        showPaidGenerationClaim: false,
        showReferenceClaim: false,
      },
    }));
    assert.ok(liveHtml.includes(copy.hero.trialDisclosure));
    assert.equal(gatedHtml.includes(copy.hero.trialDisclosure), false);
  }
});

test('reference copy distinguishes host planning from supported MaxVideoAI inputs', async () => {
  requireFile(copyPath);
  requireFile(referencePath);
  const { getMcpPageCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts'
  );
  const { McpReferenceWorkflowSection } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpReferenceWorkflowSection.tsx'
  );
  const copy = getMcpPageCopy('en');
  const gatedHtml = renderToStaticMarkup(
    React.createElement(McpReferenceWorkflowSection, {
      copy: copy.references,
      showReferenceClaim: false,
    }),
  );
  assert.match(gatedHtml, /help you plan|formulate/i);
  assert.match(gatedHtml, /when the selected model supports it/i);
  assert.doesNotMatch(gatedHtml, /upload through (?:Claude|Codex)|Claude creates|Codex creates/i);
});

test('integration guides cover the full factual setup journey and explicit unpublished state', async () => {
  requireFile(integrationCopyPath);
  requireFile(integrationViewPath);
  const { getIntegrationCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy.ts'
  );
  const { IntegrationPageView } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/integrations/_components/IntegrationPageView.tsx'
  );
  const publication = {
    renderPublicPage: true,
    connectionAvailable: false,
    indexable: false,
    showTrialClaim: false,
    showPaidGenerationClaim: false,
    showReferenceClaim: false,
  };

  for (const locale of ['en', 'fr', 'es'] as const) {
    for (const client of ['claude', 'codex'] as const) {
      const copy = getIntegrationCopy(locale, client);
      const html = renderToStaticMarkup(
        React.createElement(IntegrationPageView, {
          compatibility: getCompatibility(client),
          copy,
          locale,
          publication,
        }),
      );
      for (const section of [
        copy.setup.title,
        copy.workflow.title,
        copy.references.title,
        copy.troubleshooting.title,
        copy.disconnect.title,
      ]) {
        assert.ok(html.includes(section), `${locale}/${client} should render ${section}`);
      }
      assert.ok(html.includes(copy.hero.unavailable));
      assert.match(html, /OAuth/i);
      assert.doesNotMatch(html, /one[- ]click|available in the Codex (?:app|library)|directory listing/i);
    }
  }
});

test('Claude Desktop and Claude Code keep separate evidence-backed setup paths', async () => {
  const { getIntegrationCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy.ts'
  );
  const { getMcpCompatibilityEvidence } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-compatibility.ts'
  );
  const evidence = getMcpCompatibilityEvidence().clients.claude;
  assert.deepEqual(evidence.hosts.map((host: { id: string }) => host.id), ['claudeDesktop', 'claudeCode']);
  assert.deepEqual(evidence.hosts.map((host: { version: string }) => host.version), ['1.20186.1', '2.1.207']);

  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = getIntegrationCopy(locale, 'claude');
    assert.deepEqual(copy.setup.hostGuides.map((guide) => guide.hostId), ['claudeDesktop', 'claudeCode']);
    const code = copy.setup.hostGuides.find((guide) => guide.hostId === 'claudeCode');
    assert.ok(code);
    assert.ok(code.commands.some((command) => command.includes('claude mcp add --transport http')));
    assert.match(code.authTrigger ?? '', /\/mcp/);
    assert.doesNotMatch(copy.compatibility.statuses.claudeCode, /hosted (?:tools?|calls?).*pass/i);
  }
});

test('rendered-but-noindex previews show connection availability without emitting live schema', async () => {
  const { getIntegrationCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy.ts'
  );
  const { IntegrationHeroSection } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/integrations/_components/IntegrationHeroSection.tsx'
  );
  const { getMcpPageCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts'
  );
  const { McpTrustSections } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpTrustSections.tsx'
  );
  const { getMcpCompatibilityEvidence } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-compatibility.ts'
  );
  const { buildMcpWebApplicationJsonLd } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-jsonld.ts'
  );
  const publication = {
    renderPublicPage: true,
    connectionAvailable: true,
    indexable: false,
    showTrialClaim: false,
    showPaidGenerationClaim: false,
    showReferenceClaim: false,
  };
  const integrationCopy = getIntegrationCopy('en', 'codex');
  const integrationHtml = renderToStaticMarkup(
    React.createElement(IntegrationHeroSection, { copy: integrationCopy, publication }),
  );
  const mcpCopy = getMcpPageCopy('en');
  const trustHtml = renderToStaticMarkup(React.createElement(McpTrustSections, {
    compatibility: getMcpCompatibilityEvidence(),
    copy: mcpCopy,
    locale: 'en',
    publication,
  }));
  assert.ok(integrationHtml.includes(integrationCopy.hero.liveStatus));
  assert.equal(integrationHtml.includes(integrationCopy.hero.unavailable), false);
  assert.ok(trustHtml.includes(mcpCopy.trust.availability.liveBody));
  assert.equal(trustHtml.includes(mcpCopy.trust.availability.gatedBody), false);
  assert.equal(buildMcpWebApplicationJsonLd({
    canonicalUrl: 'https://maxvideoai.com/mcp',
    copy: mcpCopy,
    inLanguage: 'en-US',
    publication,
  }), null);
  assert.doesNotMatch(requireFile(`${routeRoot}/integrations/_components/IntegrationHeroSection.tsx`), /publication\.indexable/);
  assert.doesNotMatch(requireFile(`${routeRoot}/mcp/_components/McpTrustSections.tsx`), /publication\.indexable/);
});

test('acquisition copy avoids unsupported and absolute product claims', () => {
  const source = `${requireFile(copyPath)}\n${requireFile(integrationCopyPath)}`;
  assert.doesNotMatch(source, /API key|customer webhook|shared wallet|guaranteed capacity|works with all|one[- ]click/i);
  assert.doesNotMatch(source, /audio (?:never|does not) change(?:s)? (?:the )?price/i);
});

test('localized acquisition copy uses prospect language instead of internal pricing and host terms', async () => {
  const { getMcpPageCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts'
  );
  const en = JSON.stringify(getMcpPageCopy('en'));
  const fr = JSON.stringify(getMcpPageCopy('fr'));
  const es = JSON.stringify(getMcpPageCopy('es'));
  assert.doesNotMatch(en, /canonical price quote|publication-gated|release gate/i);
  assert.doesNotMatch(fr, /devis tarifaire de référence|soumises? à publication/i);
  assert.doesNotMatch(es, /cotización canónica|\bhost\b|revisión de publicación/i);
  assert.match(es, /precio calculado actualmente/i);
  assert.match(es, /cliente|agente/i);
});

function getCompatibility(client: 'claude' | 'codex') {
  // Imported lazily by the test below once the evidence owner is available.
  return compatibilityEvidence.clients[client];
}

const compatibilityEvidence = readCompatibilityEvidence();
