import './helpers/server-view-styles';
import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { getMcpEditorialCopy } from '../frontend/components/marketing/mcp/mcp-editorial-copy';
import { getMcpClientActionConfig, getMcpPublicIntegrationIds } from '../frontend/lib/mcp-integration-registry';
import { getIntegrationCopy } from '../frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy';
import { getMcpPageCopy } from '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy';
import { getMcpCompatibilityEvidence } from '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-compatibility';
import { McpPageView } from '../frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpPageView';
import { IntegrationPageView } from '../frontend/app/(localized)/[locale]/(marketing)/integrations/_components/IntegrationPageView';
import { getMcpHostProof } from '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-host-proof';
import { getIntegrationInstallInstruction } from '../frontend/app/(localized)/[locale]/(marketing)/integrations/_content/shared';
(globalThis as typeof globalThis & {React:typeof React}).React=React;
const locales=['en','fr','es'] as const;
const live={renderPublicPage:true,connectionAvailable:true,indexable:true,showTrialClaim:false,showPaidGenerationClaim:true,showReferenceClaim:true};

test('the hub puts the installation, account and six localized guides ahead of creative examples',()=>{
 for(const locale of locales){
  const html=renderToStaticMarkup(React.createElement(McpPageView,{compatibility:getMcpCompatibilityEvidence(),copy:getMcpPageCopy(locale),locale,publication:live}));
  const prefix=locale==='en'?'':`/${locale}`;
  for(const client of getMcpPublicIntegrationIds()) assert.ok(html.includes(`href="${prefix}/${locale==='es'?'integraciones':'integrations'}/${client}"`));
  for(const client of ['cursor','github-copilot','gemini-cli','microsoft-copilot']) assert.ok(!html.includes(`/integrations/${client}"`));
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const hero = doc.querySelector('.hub-opening')!;
  const listing = getMcpClientActionConfig('chatgpt').deepLink!;
  assert.equal(hero.querySelectorAll('a.mcp-button').length, 1);
  assert.equal(hero.querySelector('a.mcp-button')?.getAttribute('href'), listing);
  for (const mode of ['signup','signin']) assert.ok(hero.querySelector(`a[href^="/login?mode=${mode}"]`));
  assert.ok(hero.querySelector('a[href="/billing"]'));
  assert.equal(hero.querySelectorAll('#integrations .hub-tile').length, 6);
  assert.equal(hero.querySelector('[data-client="glama"]')?.getAttribute('href'), `${prefix}/${locale === 'es' ? 'integraciones' : 'integrations'}/glama`);
  assert.ok(hero.querySelector('img[alt*="Maya"]'));
  assert.equal(doc.querySelectorAll('.hub-example').length, 4);
  assert.equal(doc.querySelector('.hub-example video, .hub-example audio'), null);
  const gallery = doc.querySelector('.hub-gallery')!;
  assert.ok(hero.compareDocumentPosition(gallery) & 4);
  const duplicates = [...doc.querySelectorAll('[id]')].map(el=>el.id);
  assert.equal(new Set(duplicates).size,duplicates.length);
  dom.window.close();
  assert.equal((html.match(/<h1\b/g)??[]).length,1);
  assert.equal((html.match(/data-faq-item="true"/g)??[]).length,8);
  assert.match(html,/19591-turn-creative-briefs-into-approved-maxvideoai-generations-with-human-review/);
  assert.doesNotMatch(html,/Pending \/ Under review|no public template listing|aucun modèle de workflow n’est publié|no hay una plantilla publicada|trial included/i);
 }
});
test('each integration has a distinct searchable title and truthful installation context',()=>{
 for(const locale of locales){
  const titles=new Set<string>();
  for(const client of getMcpPublicIntegrationIds()){
   const copy=getIntegrationCopy(locale,client);titles.add(copy.meta.title);
   assert.match(copy.meta.title,/MaxVideoAI/);assert.match(copy.meta.title,/MCP/);
   assert.ok(copy.meta.title.length<75);assert.ok(copy.hero.title.length<80);
   assert.ok(copy.setup.hostGuides.length>0);
   for(const guide of copy.setup.hostGuides)assert.ok(guide.installInstruction.length>40);
   if (client === 'chatgpt' || client === 'codex') {
    assert.match(copy.meta.title, /plugin/i);
    assert.match(copy.compatibility.statuses[client === 'chatgpt' ? 'chatgptWeb' : 'codexCli'] ?? '', /OAuth/);
   } else {
    assert.match(copy.hero.liveStatus,client==='n8n'?/2\.38\.7/:client==='openclaw'?/ClawHub/:/test|prob/i);
   }
  }
  assert.equal(titles.size,5);
 }
});

test('ChatGPT and Codex show localized directory setup, first request and the manual alternative in that order', () => {
 const evidence = getMcpCompatibilityEvidence();
 const listing = getMcpClientActionConfig('chatgpt');
 assert.ok(listing.deepLinkEnabled && listing.deepLink);
 for (const locale of locales) {
  for (const client of ['chatgpt', 'codex'] as const) {
   const html = renderToStaticMarkup(React.createElement(IntegrationPageView, {
    compatibility: evidence.clients[client]!, copy: getIntegrationCopy(locale, client), locale, publication: live,
   }));
   const document = new JSDOM(html).window.document;
   const native = document.querySelector('#setup');
   const workflow = document.querySelector('.mcp-integration-workflow');
   const advanced = document.querySelector('#advanced-setup');
   assert.ok(native && workflow && advanced);
   assert.equal(native.querySelector('a')?.getAttribute('href'), listing.deepLink);
   const setup = native.textContent ?? '';
   assert.match(setup, /maxvideoai\.com/);
   assert.match(setup, /top up|recharges|recarga/i);
   assert.match(setup, /create an account|créez votre compte|crea tu cuenta/i);
   assert.match(setup, client === 'codex' ? /Sources → Use plugins/ : /@MaxVideoAI/);
   assert.ok(native.compareDocumentPosition(workflow) & 4);
   assert.ok(workflow.compareDocumentPosition(advanced) & 4);
   assert.equal(advanced.querySelector('details')?.open, false);
   assert.match(advanced.textContent ?? '', client === 'codex'
    ? /codex plugin marketplace add camgraphe\/maxvideoai-plugin --ref v0\.3\.8.*codex plugin add maxvideoai@maxvideoai/s
    : /api\.maxvideoai\.com\/mcp/);
   const disabled = renderToStaticMarkup(React.createElement(IntegrationPageView, {
    compatibility: evidence.clients[client]!, copy: getIntegrationCopy(locale, client), locale,
    publication: {...live, connectionAvailable: false, showPaidGenerationClaim: false},
   }));
   assert.doesNotMatch(disabled, /id="directory-setup-title"|id="advanced-setup"/);
   assert.match(disabled, /id="setup"/);
  }
 }
});
test('host eligibility is visible and automation never becomes a generic one-click install',()=>{
 const evidence=getMcpCompatibilityEvidence();
 for(const locale of locales){
  const n8n=getIntegrationCopy(locale,'n8n');
  assert.equal(n8n.setup.installAction.copyInstructionEnabled,false);
  const html=renderToStaticMarkup(React.createElement(IntegrationPageView,{copy:n8n,compatibility:evidence.clients.n8n!,locale,publication:live}));
  assert.doesNotMatch(html,/data-copy-install-instructions/);
  assert.match(html,/data-copy-endpoint/);
  assert.match(html,/19591-turn-creative-briefs-into-approved-maxvideoai-generations-with-human-review/);
  assert.doesNotMatch(html,/Pending \/ Under review|no public n8n library listing/i);
  assert.match(n8n.troubleshooting.items[0].answer,/approved|approuvé|aprobada/);
  assert.doesNotMatch(html,/awaiting n8n review|en cours de revue|en revisión/);
  const faq=getMcpEditorialCopy(locale).faq.map(item=>item.answer).join(' ');
  assert.match(faq,/ChatGPT.*Codex/);assert.match(faq,/Sources → Use plugins/);assert.match(faq,/2\.38\.7/);assert.match(faq,/Cloud/);assert.match(faq,/19591/);assert.match(faq,/manual|manuelle/i);
  assert.doesNotMatch(faq,/awaiting n8n review|en cours de revue|en revisión/);
  for (const answer of [n8n.troubleshooting.items[0].answer, getMcpEditorialCopy(locale).faq[2].answer]) {
    assert.match(answer,/approved|approuvé|aprobada/);
    assert.match(answer,/OAuth/);
    assert.match(answer,/2\.38\.7/);
    assert.match(answer,/fresh quote|devis frais|cotización nueva/);
    assert.match(answer,/human approval|accord humain|aprobación humana/);
    assert.match(answer,/Cloud.*AI Agent/);
    assert.match(answer,/not been validated|n’ont pas été validés|no se han validado/);
  }
 }
});
test('gated views do not show paid workflow, historical proof or price examples',()=>{
 const html=renderToStaticMarkup(React.createElement(McpPageView,{compatibility:getMcpCompatibilityEvidence(),copy:getMcpPageCopy('en'),locale:'en',publication:{...live,connectionAvailable:false,indexable:false,showPaidGenerationClaim:false,showReferenceClaim:false},hostProof:getMcpHostProof('claude','en')}));
 assert.doesNotMatch(html,/data-mcp-host-proof|mcp-story-scene|data-assistant-first-request|mcp-price-context/);
});
test('capability answers identify Studio subtitles in the plugin and qualify other MCP clients',()=>{
 for(const locale of locales){const answer=getMcpEditorialCopy(locale).faq[3].answer;assert.match(answer,/image|imágenes/);assert.match(answer,/voice-over|voix off|voz en off/i);assert.match(answer,/Studio.*(?:subtitle|sous-titr|subtitule)/i);assert.match(answer,/other MCP clients|autres clients MCP|otros clientes MCP/i);}
});
test('historical Claude evidence stays separate from the illustrated workflow',()=>{
 for(const locale of locales){const proof=getMcpHostProof('claude',locale);assert.ok(proof);assert.match(proof.caption,/not a current quote|pas.*devis actuel|no.*precio actual/);assert.ok(getMcpEditorialCopy(locale).visualLabel);}
});

test('localized host setup titles and introductions do not inherit the English guide', () => {
  for (const client of getMcpPublicIntegrationIds()) {
    const en = getIntegrationCopy('en', client).setup.hostGuides;
    for (const locale of ['fr', 'es'] as const) {
      const translated = getIntegrationCopy(locale, client).setup.hostGuides;
      for (const guide of translated) {
        const original = en.find(item => item.hostId === guide.hostId);
        assert.ok(original, `${client}/${guide.hostId}`);
        assert.notEqual(guide.title, original.title, `${locale}/${client} setup title`);
        assert.notEqual(guide.intro, original.intro, `${locale}/${client} setup introduction`);
        for (const field of ['commandLabel', 'authTrigger'] as const) {
          if (original[field]) assert.notEqual(guide[field], original[field], `${locale}/${client} ${field}`);
        }
        for (const [index, value] of guide.setupValues.entries()) {
          assert.notEqual(value.label, original.setupValues[index]?.label, `${locale}/${client} setup value label`);
        }
      }
    }
  }
});

test('installation requests name the production server and the correct setup mechanism for each host', () => {
  for (const locale of locales) {
    const chatgpt = getIntegrationInstallInstruction(locale, 'chatgptWeb');
    const claude = getIntegrationInstallInstruction(locale, 'claudeWeb');
    const code = getIntegrationInstallInstruction(locale, 'claudeCode');
    const openclaw = getIntegrationInstallInstruction(locale, 'openclawGateway');
    for (const instruction of [chatgpt, claude, code, openclaw]) {
      assert.match(instruction, /https:\/\/api\.maxvideoai\.com\/mcp/);
      assert.match(instruction, /https:\/\/maxvideoai\.com\//);
      assert.match(instruction, /get_account_status.*list_models/s);
      assert.match(instruction, /Staging/);
    }
    assert.match(chatgpt, /OAuth/);
    assert.doesNotMatch(chatgpt, /claude mcp|openclaw mcp|codex plugin/);
    assert.match(claude, /(?:Customize.*Connectors|Personnalisation.*Connecteurs)/);
    assert.match(code, /claude mcp add --transport http maxvideoai/);
    assert.match(code, /\/mcp/);
    assert.match(openclaw, /openclaw mcp login maxvideoai/);
    assert.match(getIntegrationInstallInstruction(locale, 'codexCli'), /codex plugin marketplace add/);
    assert.match(getIntegrationInstallInstruction(locale, 'n8nMcpClient'), /OAuth2/);
  }
});

test('Claude setup guidance covers plan requirements and authentication review with separate Web and Desktop evidence', () => {
  for (const locale of locales) {
    const copy = getIntegrationCopy(locale, 'claude');
    const guide = copy.setup.hostGuides.find(item => item.hostId === 'claudeWeb')!;
    const steps = guide.steps.map(item => item.body).join(' ');
    assert.match(steps, /Pro.*Max/);
    assert.match(steps, /Team.*Enterprise/);
    assert.match(steps, /(?:Continue|Continuer).*OAuth/);
    assert.match(steps, /Custom.*Web/);
    assert.match(guide.installInstruction, /Pro.*Max/);
    assert.match(guide.installInstruction, /(?:Continue|Continuer).*OAuth/);
    assert.doesNotMatch(steps + guide.installInstruction, /Use Claude’s published identity|Use Claude's published identity/);
    assert.match(copy.compatibility.statuses.claudeDesktop ?? '', /1\.37937\.1/);
  }
});
