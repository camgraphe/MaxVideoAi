import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const routeRoot = 'frontend/app/(localized)/[locale]/(marketing)/mcp';
const componentsRoot = `${routeRoot}/_components`;
const integrationComponentsRoot = 'frontend/app/(localized)/[locale]/(marketing)/integrations/_components';

function requireFile(path: string): string {
  assert.equal(existsSync(path), true, `${path} should exist`);
  return readFileSync(path, 'utf8');
}

test('ChatGPT and Claude use official marks through one equal neutral action component', () => {
  const source = requireFile(`${componentsRoot}/McpClientActions.tsx`);
  const integrationHero = requireFile(`${integrationComponentsRoot}/IntegrationHeroSection.tsx`);
  const openAiDark = requireFile('frontend/public/brand/partners/openai/openai-mark-dark.svg');
  const claudeDark = requireFile('frontend/public/brand/partners/anthropic/claude-mark-dark.svg');
  assert.match(source, /\/brand\/partners\/anthropic\/claude-mark-light\.svg/);
  assert.match(source, /\/brand\/partners\/anthropic\/claude-mark-dark\.svg/);
  assert.match(source, /\/brand\/partners\/openai\/openai-mark-light\.svg/);
  assert.match(source, /\/brand\/partners\/openai\/openai-mark-dark\.svg/);
  assert.match(source, /function McpClientAction/);
  assert.match(source, /clients\.map/);
  assert.match(source, /neutral|bg-surface/);
  assert.match(openAiDark, /fill="#FFFFFF"/i);
  assert.match(claudeDark, /fill="#D97757"/i);
  assert.match(source, /bg-white[^"\n]*dark:bg-neutral-900/);
  assert.match(integrationHero, /bg-white[^"\n]*dark:bg-neutral-900/);
  assert.doesNotMatch(source, /bg-white[^"\n]*dark:bg-white/);
  assert.doesNotMatch(integrationHero, /bg-white[^"\n]*dark:bg-white/);
  assert.equal((source.match(/h-6 w-6 object-contain/g) ?? []).length, 2);
  assert.doesNotMatch(source, /preferred|primaryClient|OpenAI['"]/);
});

test('new MCP surfaces remain light-first, restrained, and dark-compatible', () => {
  const visualComponents = [
    'McpPageView.tsx',
    'McpHeroSection.tsx',
    'McpConversationPreview.tsx',
    'McpClientActions.tsx',
    'McpConnectActions.client.tsx',
    'McpProofMedia.tsx',
    'McpHostProofCard.tsx',
    'McpWorkflowStrip.tsx',
    'McpBudgetShortlist.tsx',
    'McpEvidenceSection.tsx',
    'McpReferenceWorkflowSection.tsx',
    'McpTrustSections.tsx',
  ];
  for (const component of visualComponents) {
    const source = requireFile(`${componentsRoot}/${component}`);
    assert.match(source, /bg-(?:bg|surface|white)/, `${component} should use existing light surfaces`);
    assert.match(source, /text-text-(?:primary|secondary|muted)/, `${component} should use existing text tokens`);
    assert.match(source, /border-(?:hairline|white)/, `${component} should retain thin borders`);
    assert.match(source, /dark:/, `${component} should include dark-mode parity`);
    assert.doesNotMatch(source, /ThemeProvider|next-themes/, `${component} must use the existing theme`);
  }
});

test('the hero stays prospect-facing and contains no internal setup vocabulary', () => {
  const source = requireFile(`${componentsRoot}/McpHeroSection.tsx`);
  assert.doesNotMatch(source, /OAuth|scope|endpoint|staging|API key/i);
  assert.match(source, /McpConnectActions/);
  assert.match(source, /showTrialClaim/);
});

test('workflow and live price references support a conversation-led project proposal', async () => {
  requireFile(`${componentsRoot}/McpWorkflowStrip.tsx`);
  requireFile(`${componentsRoot}/McpBudgetShortlist.tsx`);
  requireFile(`${routeRoot}/_lib/mcp-page-copy.ts`);
  const { McpWorkflowStrip } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpWorkflowStrip.tsx'
  );
  const { McpBudgetShortlist } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpBudgetShortlist.tsx'
  );
  const { getMcpPageCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts'
  );
  const copy = getMcpPageCopy('en');
  const workflow = renderToStaticMarkup(React.createElement(McpWorkflowStrip, { copy: copy.workflow }));
  assert.equal((workflow.match(/data-workflow-step=/g) ?? []).length, 3);
  copy.workflow.steps.forEach((step: string) => assert.ok(workflow.includes(step.replace('&', '&amp;'))));

  const options = [
    {
      slot: 'included_trial',
      engineId: 'seedance-2-0-mini',
      modelSlug: 'dreamina-seedance-2-0-mini',
      name: 'Dreamina Seedance 2.0 Mini',
      mode: 't2v',
      durationSeconds: 5,
      resolution: '480p',
      audioState: 'enabled',
      amountCents: null,
      currency: 'USD',
      priceLabel: 'Included',
      scenarioLabel: '5s · 480p · Audio enabled',
      modelHref: '/models/dreamina-seedance-2-0-mini',
      priceSource: 'included_trial',
    },
    {
      slot: 'lowest_paid',
      engineId: 'pika-text-to-video',
      modelSlug: 'pika-text-to-video',
      name: 'Pika Text to Video',
      mode: 't2v',
      durationSeconds: 5,
      resolution: '720p',
      audioState: 'silent',
      amountCents: 26,
      currency: 'USD',
      priceLabel: '$0.26',
      scenarioLabel: '5s · 720p · Silent',
      modelHref: '/models/pika-text-to-video',
      priceSource: 'canonical_public_quote',
    },
  ] as const;
  const budget = renderToStaticMarkup(
    React.createElement(McpBudgetShortlist, { copy: copy.budget, options }),
  );
  assert.equal((budget.match(/data-price-reference=/g) ?? []).length, 2);
  assert.ok(budget.includes('Quality-first proposal'));
  assert.ok(budget.includes('Lower-cost alternatives'));
  assert.ok(budget.includes('not packages or a recommendation'));
  assert.ok(budget.includes('Included'));
  assert.ok(budget.includes('$0.26'));
});

test('proof media is poster-backed, controlled, captioned, and never auto-plays', () => {
  const source = requireFile(`${componentsRoot}/McpProofMedia.tsx`);
  assert.equal(existsSync(`${componentsRoot}/McpProofMedia.client.tsx`), false);
  assert.doesNotMatch(source, /['"]use client['"]/);
  assert.match(source, /<video/);
  assert.match(source, /controls/);
  assert.match(source, /preload="metadata"/);
  assert.match(source, /poster=\{proof\.posterSrc\}/);
  assert.match(source, /kind="captions"/);
  assert.match(source, /src=\{proof\.captionsSrc\}/);
  assert.match(source, /<figcaption/);
  assert.doesNotMatch(source, /autoPlay/);

  const proofContract = requireFile(`${routeRoot}/_lib/mcp-proof.ts`);
  assert.match(proofContract, /captionsSrc: string/);
  assert.match(proofContract, /captionsLocale: AppLocale/);
});

test('Claude host proof is a captioned light-first image, not a simulated video claim', () => {
  const source = requireFile(`${componentsRoot}/McpHostProofCard.tsx`);
  assert.doesNotMatch(source, /['"]use client['"]/);
  assert.match(source, /<figure/);
  assert.match(source, /<Image/);
  assert.match(source, /src=\{proof\.assetSrc\}/);
  assert.match(source, /alt=\{proof\.alt\}/);
  assert.match(source, /<figcaption/);
  assert.match(source, /bg-white/);
  assert.match(source, /dark:/);
  assert.doesNotMatch(source, /<video|autoPlay/);
});

test('integration heroes lead with visual product evidence and link directly to setup', () => {
  const hero = requireFile(`${integrationComponentsRoot}/IntegrationHeroSection.tsx`);
  const view = requireFile(`${integrationComponentsRoot}/IntegrationPageView.tsx`);
  const preview = requireFile(`${integrationComponentsRoot}/IntegrationConversationPreview.tsx`);
  const setup = requireFile(`${integrationComponentsRoot}/IntegrationSetupSection.tsx`);

  assert.match(hero, /hostProof/);
  assert.match(hero, /McpHostProofCard/);
  assert.match(hero, /IntegrationConversationPreview/);
  assert.match(hero, /href="#setup"/);
  assert.match(view, /hostProof=\{hostProof\}/);
  assert.doesNotMatch(view, /hostProof \? \(/);
  assert.match(setup, /id="setup"/);
  assert.match(preview, /<video/);
  assert.match(preview, /controls/);
  assert.match(preview, /preload="metadata"/);
  assert.match(preview, /poster=/);
  assert.doesNotMatch(preview, /autoPlay/);
});

test('verified integration setup steps use small, captioned, real-host captures', async () => {
  const setup = requireFile(`${integrationComponentsRoot}/IntegrationSetupSection.tsx`);
  assert.match(setup, /import Image from ['"]next\/image['"]/);
  assert.match(setup, /step\.proof/);
  assert.match(setup, /<figcaption/);
  assert.match(setup, /loading="lazy"/);

  const { getIntegrationCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy.ts'
  );
  for (const locale of ['en', 'fr', 'es'] as const) {
    const claudeDesktop = getIntegrationCopy(locale, 'claude').setup.hostGuides[0];
    assert.equal(claudeDesktop?.steps.length, 3);
    assert.equal(claudeDesktop?.steps.every((step) => step.proof), true);
    for (const step of claudeDesktop?.steps ?? []) {
      assert.equal(existsSync(`frontend/public${step.proof?.src}`), true);
      assert.match(step.proof?.caption ?? '', /staging|préproduction|preproducción/i);
    }

    const claudeCode = getIntegrationCopy(locale, 'claude').setup.hostGuides[1];
    assert.equal(claudeCode?.steps.some((step) => step.proof), false);
    const chatgpt = getIntegrationCopy(locale, 'chatgpt').setup.hostGuides[0];
    assert.equal(chatgpt?.steps.some((step) => step.proof), false);
  }
});

test('homepage assistant workflow localizes the live catalog label and uses account library language', () => {
  const source = requireFile('frontend/components/marketing/home/HomeAssistantWorkflow.tsx');
  assert.match(source, /catalogLabel/);
  assert.doesNotMatch(source, /> Live catalog</);
  assert.doesNotMatch(source, /galerie MaxVideoAI/);
});

test('the shared hub stays host-neutral before showing the controlled Claude capture', () => {
  const hero = requireFile(`${componentsRoot}/McpHeroSection.tsx`);
  const view = requireFile(`${componentsRoot}/McpPageView.tsx`);
  assert.match(hero, /McpConversationPreview/);
  assert.doesNotMatch(hero, /McpHostProofCard/);
  assert.match(view, /McpHostProofCard/);
  assert.match(view, /hostProof \? \(/);
});

test('client actions point to equally factual localized guides', async () => {
  requireFile(`${routeRoot}/_lib/mcp-page-copy.ts`);
  const { getMcpPageCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts'
  );
  const expectations = {
    en: ['/integrations/chatgpt', '/integrations/claude'],
    fr: ['/fr/integrations/chatgpt', '/fr/integrations/claude'],
    es: ['/es/integraciones/chatgpt', '/es/integraciones/claude'],
  } as const;
  for (const locale of ['en', 'fr', 'es'] as const) {
    assert.deepEqual(
      getMcpPageCopy(locale).hero.actions.map((action: { href: string }) => action.href),
      expectations[locale],
    );
  }
});
