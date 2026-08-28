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

test('the hub sells the outcome with Claude, ChatGPT, and Codex as equal entry points', async () => {
  const { getMcpPageCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts'
  );
  const copy = getMcpPageCopy('en');
  assert.equal(copy.meta.title, 'MaxVideoAI for Claude, ChatGPT & Codex | AI Video');
  assert.equal(copy.hero.title, 'Turn Claude, ChatGPT or Codex into your AI video producer.');
  assert.match(copy.hero.intro, /brief to rendered video/i);
  assert.match(copy.hero.intro, /prompts and references/i);
  assert.match(copy.hero.intro, /exact price/i);
  assert.deepEqual(copy.hero.actions.map((action) => action.client), ['claude', 'chatgpt', 'codex']);
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
  assert.equal(fr.meta.title, 'MaxVideoAI pour Claude, ChatGPT et Codex | Vidéo IA');
  assert.match(fr.hero.title, /Claude, ChatGPT ou Codex/i);
  assert.match(fr.budget.title, /film complet/i);
  assert.match(JSON.stringify(fr.answers.items), /crédits/i);
  assert.match(JSON.stringify(fr.answers.items), /bibliothèque|galerie/i);
  assert.equal(es.meta.title, 'MaxVideoAI para Claude, ChatGPT y Codex | Vídeo IA');
  assert.match(es.hero.title, /Claude, ChatGPT o Codex/i);
  assert.match(es.budget.title, /película/i);
  assert.match(JSON.stringify(es.answers.items), /créditos/i);
  assert.match(JSON.stringify(es.answers.items), /biblioteca/i);
});

test('the homepage presents Claude, ChatGPT, and Codex in the approved order', async () => {
  const { HomeAssistantWorkflow } = await import(
    '../frontend/components/marketing/home/HomeAssistantWorkflow.tsx'
  );
  for (const locale of ['en', 'fr', 'es'] as const) {
    const html = renderToStaticMarkup(React.createElement(HomeAssistantWorkflow, {
      locale,
      href: locale === 'en' ? '/mcp' : `/${locale}/mcp`,
    }));
    const claudeIndex = html.indexOf('Claude');
    const chatgptIndex = html.indexOf('ChatGPT');
    const codexIndex = html.indexOf('Codex');
    assert.ok(claudeIndex >= 0, `${locale} homepage should name Claude`);
    assert.ok(chatgptIndex > claudeIndex, `${locale} homepage should place ChatGPT after Claude`);
    assert.ok(codexIndex > chatgptIndex, `${locale} homepage should place Codex after ChatGPT`);
  }
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

test('integration copy explains free setup, account creation, credits and current product vocabulary', async () => {
  const { getIntegrationCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy.ts'
  );

  const expectations = {
    en: {
      free: /free to (?:add|connect)|no (?:added|separate) subscription/i,
      account: /sign in or create/i,
      credits: /pay-as-you-go credits/i,
      library: /MaxVideoAI Library/i,
    },
    fr: {
      free: /gratuit|sans abonnement supplémentaire/i,
      account: /connectez-vous ou créez/i,
      credits: /crédits.*à l'usage|crédits.*à la consommation|crédits MaxVideoAI/i,
      library: /bibliothèque MaxVideoAI/i,
    },
    es: {
      free: /gratis|sin suscripción adicional/i,
      account: /inicia sesión o crea/i,
      credits: /créditos.*pago por uso|créditos de MaxVideoAI/i,
      library: /biblioteca de MaxVideoAI|biblioteca MaxVideoAI/i,
    },
  } as const;

  for (const locale of ['en', 'fr', 'es'] as const) {
    const chatgpt = getIntegrationCopy(locale, 'chatgpt');
    const claude = getIntegrationCopy(locale, 'claude');
    const chatgptText = JSON.stringify(chatgpt);
    const claudeText = JSON.stringify(claude);

    assert.match(chatgpt.meta.title, /ChatGPT/i);
    assert.match(chatgpt.hero.title, /ChatGPT/i);
    assert.match(claude.meta.title, /Claude/i);
    assert.match(claude.hero.title, /Claude/i);
    assert.match(chatgptText, expectations[locale].free);
    assert.match(chatgptText, expectations[locale].account);
    assert.match(chatgptText, expectations[locale].credits);
    assert.match(chatgptText, expectations[locale].library);
    assert.match(claudeText, expectations[locale].free);
    assert.match(claudeText, expectations[locale].account);
  }

  assert.match(getIntegrationCopy('en', 'chatgpt').meta.title, /App for ChatGPT/i);
  assert.match(getIntegrationCopy('en', 'claude').meta.title, /Connector for Claude/i);
  assert.match(getIntegrationCopy('en', 'codex').meta.title, /Plugin for Codex/i);
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
      if (locale === 'fr') assert.doesNotMatch(JSON.stringify(copy.setup.hostGuides), /Open connector settings|Add the server|Sign in to MaxVideoAI/i);
      if (locale === 'es') assert.doesNotMatch(JSON.stringify(copy.setup.hostGuides), /Open connector settings|Add the server|Sign in to MaxVideoAI/i);
    }
  }
});

test('compatibility wording stays exact per tested host', async () => {
  const { getIntegrationCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy.ts'
  );
  const { getMcpPageCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts'
  );
  const { getMcpCompatibilityEvidence } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-compatibility.ts'
  );
  const evidence = getMcpCompatibilityEvidence();
  assert.equal(evidence.lastChecked, '2026-08-27');
  assert.equal(evidence.clients.claude.hosts[0]?.status, 'verified');
  assert.equal(evidence.clients.codex.hosts[0]?.status, 'verified');
  assert.equal(evidence.clients.chatgpt.hosts[0]?.status, 'not-run');
  assert.equal(evidence.clients.claude.hosts[1]?.status, 'not-run');

  for (const locale of ['en', 'fr', 'es'] as const) {
    const integrationCopy = JSON.stringify(getIntegrationCopy(locale, 'codex'));
    const hubCopy = JSON.stringify(getMcpPageCopy(locale));
    assert.match(integrationCopy, /Codex CLI 0\.150\.0-alpha\.8/);
    assert.match(hubCopy, /Codex CLI 0\.150\.0-alpha\.8/);
    assert.doesNotMatch(
      `${integrationCopy}\n${hubCopy}`,
      /before launch|avant lancement|antes del lanzamiento/i,
    );
  }
});

test('Codex setup installs the tagged public plugin package before OAuth', async () => {
  const { getIntegrationCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy.ts'
  );

  for (const locale of ['en', 'fr', 'es'] as const) {
    const guide = getIntegrationCopy(locale, 'codex').setup.hostGuides[0];
    assert.ok(guide);
    assert.match(
      `${guide.steps.map((step) => step.body).join(' ')} ${guide.authTrigger ?? ''}`,
      /new (?:conversation|task)|nouvelle (?:conversation|tâche)|nueva (?:conversación|tarea)/i,
    );
    assert.match(
      guide.authTrigger ?? '',
      /OAuth/i,
    );
    assert.equal(
      guide.commands[0],
      'codex plugin marketplace add camgraphe/MaxVideoAi --ref maxvideoai-plugin-v0.2.0',
    );
    assert.equal(guide.commands[1], 'codex plugin add maxvideoai@maxvideoai');
    assert.equal(guide.commands.length, 2);
    assert.match(guide.limitation, /plan.*generate|plan.*génér|plan.*gener/i);
  }
});

test('ChatGPT explains the shared plugin directory and keeps the developer-mode MCP fallback honest', async () => {
  const { getIntegrationCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy.ts'
  );
  const { getMcpPageCopy } = await import(
    '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy.ts'
  );

  const directoryTerms = {
    en: /shared plugin directory/i,
    fr: /répertoire de plugins partagé/i,
    es: /directorio de plugins compartido/i,
  } as const;
  const approvalTerms = {
    en: /public.*approval|approval.*public/i,
    fr: /public.*approbation|approbation.*public/i,
    es: /públic.*aprobación|aprobación.*públic/i,
  } as const;
  const positiveStatusTerms = {
    en: /same plugin.*OAuth|OAuth.*same plugin/i,
    fr: /même plugin.*OAuth|OAuth.*même plugin/i,
    es: /mismo plugin.*OAuth|OAuth.*mismo plugin/i,
  } as const;
  const documentedLabels = {
    en: /documented/i,
    fr: /documenté/i,
    es: /documentado/i,
  } as const;

  for (const locale of ['en', 'fr', 'es'] as const) {
    const guide = getIntegrationCopy(locale, 'chatgpt').setup.hostGuides[0];
    assert.ok(guide);
    assert.match(`${guide.title} ${guide.intro}`, directoryTerms[locale]);
    assert.equal(guide.steps.length, 3);
    assert.equal(guide.steps.every((step) => Boolean(step.proof)), true);
    assert.equal(guide.setupValues[0]?.value, 'https://api.maxvideoai.com/mcp');
    assert.match(guide.setupValues[0]?.label ?? '', /developer|développeur|desarrollador/i);
    assert.match(guide.limitation, approvalTerms[locale]);
    assert.match(guide.authTrigger ?? '', /OAuth/i);
    const compatibility = getIntegrationCopy(locale, 'chatgpt').compatibility;
    const compatibilityStatus = compatibility.statuses[guide.hostId];
    assert.match(compatibility.checkpointLabel, documentedLabels[locale]);
    assert.match(compatibilityStatus, positiveStatusTerms[locale]);
    assert.doesNotMatch(compatibilityStatus, /not yet|has not|aucun|pas encore|todavía no|no se ha/i);
    const hubStatus = getMcpPageCopy(locale).trust.compatibility.statuses[guide.hostId];
    assert.match(hubStatus, positiveStatusTerms[locale]);
    assert.doesNotMatch(hubStatus, /not yet|has not|aucun|pas encore|todavía no|no se ha/i);
  }
});
