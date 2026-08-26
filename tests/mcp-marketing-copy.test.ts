import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const routeRoot = 'frontend/app/(localized)/[locale]/(marketing)';

function requireFile(path: string): string {
  assert.equal(existsSync(path), true, `${path} should exist`);
  return readFileSync(path, 'utf8');
}

test('the hub sells the outcome and keeps ChatGPT and Claude at the same level', async () => {
  const { getMcpPageCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts'
  );
  const copy = getMcpPageCopy('en');
  assert.equal(copy.meta.title, 'AI Video Plugin for ChatGPT & Claude | MaxVideoAI');
  assert.equal(copy.hero.title, 'Turn ChatGPT or Claude into your AI video producer.');
  assert.match(copy.hero.intro, /brief to rendered video/i);
  assert.match(copy.hero.intro, /prompts and references/i);
  assert.match(copy.hero.intro, /exact price/i);
  assert.deepEqual(copy.hero.actions.map((action) => action.client), ['chatgpt', 'claude']);
  assert.deepEqual(copy.workflow.steps, [
    'Develop the brief and references',
    'Compare models and project budgets',
    'Approve the exact price and generate',
  ]);
  assert.doesNotMatch(JSON.stringify(copy), /local implementation|host validation in progress|budget-first shortlist|lowest-cost model/i);
});

test('French and Spanish are complete prospect-facing localizations', async () => {
  const { getMcpPageCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts'
  );
  const fr = getMcpPageCopy('fr');
  const es = getMcpPageCopy('es');
  assert.equal(fr.meta.title, 'Plugin vidéo IA pour ChatGPT et Claude | MaxVideoAI');
  assert.match(fr.hero.title, /ChatGPT ou Claude/i);
  assert.match(fr.budget.title, /film complet/i);
  assert.match(JSON.stringify(fr.answers.items), /crédits/i);
  assert.match(JSON.stringify(fr.answers.items), /bibliothèque|galerie/i);
  assert.equal(es.meta.title, 'Plugin de vídeo con IA para ChatGPT y Claude | MaxVideoAI');
  assert.match(es.hero.title, /ChatGPT o Claude/i);
  assert.match(es.budget.title, /película/i);
  assert.match(JSON.stringify(es.answers.items), /créditos/i);
  assert.match(JSON.stringify(es.answers.items), /biblioteca/i);
});

test('the commercial answer set covers account continuity and the paid boundary', async () => {
  const { getMcpPageCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts'
  );
  for (const locale of ['en', 'fr', 'es'] as const) {
    const copy = getMcpPageCopy(locale);
    assert.deepEqual(Object.keys(copy.answers.items), [
      'integration',
      'price',
      'references',
      'confirmation',
      'credits',
      'library',
      'disconnect',
    ]);
    const text = JSON.stringify(copy);
    assert.match(text, /ChatGPT/i);
    assert.match(text, /Claude/i);
    assert.match(text, /Codex/i);
    assert.match(text, locale === 'fr' ? /image, vidéo ou audio/i : locale === 'es' ? /imagen, vídeo o audio/i : /image, video or audio/i);
    assert.match(text, locale === 'fr' ? /devis exact/i : locale === 'es' ? /precio exacto|cotización exacta/i : /exact (?:price|quote)/i);
  }
});

test('trial and real proof claims remain independently gated', async () => {
  requireFile(`${routeRoot}/mcp/_components/McpHeroSection.tsx`);
  const { getMcpPageCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts'
  );
  const { McpHeroSection } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpHeroSection.tsx'
  );
  const copy = getMcpPageCopy('en');
  const base = {
    renderPublicPage: true,
    connectionAvailable: false,
    indexable: false,
    showPaidGenerationClaim: false,
    showReferenceClaim: false,
  };
  const withoutTrial = renderToStaticMarkup(React.createElement(McpHeroSection, {
    copy: copy.hero,
    evidenceCopy: copy.evidence,
    locale: 'en',
    proof: null,
    publication: { ...base, showTrialClaim: false },
  }));
  const withTrial = renderToStaticMarkup(React.createElement(McpHeroSection, {
    copy: copy.hero,
    evidenceCopy: copy.evidence,
    locale: 'en',
    proof: null,
    publication: { ...base, showTrialClaim: true },
  }));
  assert.equal(withoutTrial.includes(copy.hero.trialDisclosure), false);
  assert.ok(withTrial.includes(copy.hero.trialDisclosure));
  assert.match(copy.hero.trialDisclosure, /eligible verified account/i);
  assert.match(copy.hero.trialDisclosure, /Seedance 2 Mini/i);
  assert.match(copy.hero.trialDisclosure, /regular MaxVideoAI credit balance/i);
  assert.match(withoutTrial, /Example conversation/i);
  assert.doesNotMatch(withoutTrial, /Generated through MCP|Verified result/i);
  assert.doesNotMatch(
    withoutTrial,
    /production access (?:opens?|will open)|final (?:launch )?checks|until direct production/i,
  );
});

test('integration heroes sell the workflow without displaying a pre-launch limitation card', async () => {
  const { getIntegrationCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy.ts'
  );
  const { IntegrationHeroSection } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/integrations/_components/IntegrationHeroSection.tsx'
  );
  const copy = getIntegrationCopy('en', 'chatgpt');
  const base = {
    renderPublicPage: true,
    connectionAvailable: false,
    indexable: false,
    showPaidGenerationClaim: false,
    showTrialClaim: false,
    showReferenceClaim: false,
  };
  const preview = renderToStaticMarkup(React.createElement(IntegrationHeroSection, {
    copy,
    publication: base,
  }));
  const live = renderToStaticMarkup(React.createElement(IntegrationHeroSection, {
    copy,
    publication: { ...base, connectionAvailable: true },
  }));

  assert.doesNotMatch(preview, /final launch checks|production access will open/i);
  assert.equal(preview.includes(copy.hero.unavailable), false);
  assert.equal(live.includes(copy.hero.liveStatus), true);
});

test('references keep the assistant creative while MaxVideoAI validates live support', async () => {
  const { getMcpPageCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts'
  );
  const copy = getMcpPageCopy('en').references;
  assert.match(copy.intro, /image, video or audio/i);
  assert.match(copy.planningBody, /assistant remains free to be creative/i);
  assert.match(copy.liveBody, /same connected MaxVideoAI library/i);
  assert.match(copy.intro, /model actually supports/i);
});

test('three client guides cover installation, OAuth, credits, recovery and disconnect', async () => {
  const { getIntegrationCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy.ts'
  );
  for (const locale of ['en', 'fr', 'es'] as const) {
    for (const client of ['chatgpt', 'claude', 'codex'] as const) {
      const copy = getIntegrationCopy(locale, client);
      assert.equal(copy.client, client);
      assert.ok(copy.setup.hostGuides.length > 0);
      const text = JSON.stringify(copy);
      assert.match(text, /OAuth/i);
      assert.match(text, locale === 'fr' ? /crédits/i : locale === 'es' ? /créditos/i : /credits/i);
      assert.match(text, locale === 'fr' ? /bibliothèque|galerie/i : locale === 'es' ? /biblioteca/i : /library/i);
      assert.match(text, locale === 'fr' ? /déconnect|révoqu/i : locale === 'es' ? /desconect|revoc/i : /disconnect|revoke/i);
      assert.doesNotMatch(text, /local implementation verified|host validation in progress/i);
    }
  }
});

test('compatibility wording stays exact per tested host', async () => {
  const { getMcpCompatibilityEvidence } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-compatibility.ts'
  );
  const evidence = getMcpCompatibilityEvidence();
  assert.equal(evidence.lastChecked, '2026-08-26');
  assert.equal(evidence.clients.claude.hosts[0]?.status, 'verified');
  assert.equal(evidence.clients.codex.hosts[0]?.status, 'verified');
  assert.equal(evidence.clients.chatgpt.hosts[0]?.status, 'not-run');
  assert.equal(evidence.clients.claude.hosts[1]?.status, 'not-run');
});
