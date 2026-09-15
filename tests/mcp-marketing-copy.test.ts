import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getMcpEditorialCopy } from '../frontend/components/marketing/mcp/mcp-editorial-copy';
import { getMcpPublicIntegrationIds } from '../frontend/lib/mcp-integration-registry';
import { getIntegrationCopy } from '../frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy';
import { getMcpPageCopy } from '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-page-copy';
import { getMcpCompatibilityEvidence } from '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-compatibility';
import { McpPageView } from '../frontend/app/(localized)/[locale]/(marketing)/mcp/_components/McpPageView';
import { IntegrationPageView } from '../frontend/app/(localized)/[locale]/(marketing)/integrations/_components/IntegrationPageView';
import { getMcpHostProof } from '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-host-proof';
(globalThis as typeof globalThis & {React:typeof React}).React=React;
const locales=['en','fr','es'] as const;
const live={renderPublicPage:true,connectionAvailable:true,indexable:true,showTrialClaim:false,showPaidGenerationClaim:true,showReferenceClaim:true};

test('the hub exposes five localized setup routes and four unlinked preparation labels',()=>{
 for(const locale of locales){
  const html=renderToStaticMarkup(React.createElement(McpPageView,{compatibility:getMcpCompatibilityEvidence(),copy:getMcpPageCopy(locale),locale,publication:live}));
  const prefix=locale==='en'?'':`/${locale}`;
  for(const client of getMcpPublicIntegrationIds()) assert.ok(html.includes(`href="${prefix}/${locale==='es'?'integraciones':'integrations'}/${client}"`));
  for(const client of ['cursor','github-copilot','gemini-cli','microsoft-copilot']) assert.ok(!html.includes(`/integrations/${client}"`));
  assert.equal((html.match(/<h1\b/g)??[]).length,1);
  assert.equal((html.match(/data-faq-item="true"/g)??[]).length,8);
  assert.doesNotMatch(html,/19591|Pending \/ Under review|trial included/i);
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
   assert.match(copy.hero.liveStatus,client==='chatgpt'?/Business.*Enterprise.*Edu/:client==='n8n'?/2\.38\.7/:client==='openclaw'?/ClawHub/:/test|prob/i);
  }
  assert.equal(titles.size,5);
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
  assert.doesNotMatch(html,/19591|Pending \/ Under review/);
  const faq=getMcpEditorialCopy(locale).faq.map(item=>item.answer).join(' ');
  assert.match(faq,/Business.*Enterprise.*Edu/);assert.match(faq,/Pro/);assert.match(faq,/2\.38\.7/);assert.match(faq,/Cloud/);
 }
});
test('gated views do not show paid workflow, historical proof or price examples',()=>{
 const html=renderToStaticMarkup(React.createElement(McpPageView,{compatibility:getMcpCompatibilityEvidence(),copy:getMcpPageCopy('en'),locale:'en',publication:{...live,connectionAvailable:false,indexable:false,showPaidGenerationClaim:false,showReferenceClaim:false},hostProof:getMcpHostProof('claude','en')}));
 assert.doesNotMatch(html,/data-mcp-host-proof|mcp-story-scene|data-assistant-first-request|mcp-price-context/);
});
test('capability answers distinguish image generation from gated standalone audio and montage',()=>{
 for(const locale of locales){const answer=getMcpEditorialCopy(locale).faq[3].answer;assert.match(answer,/image|imágenes/);assert.match(answer,/audio/);assert.match(answer,/not publicly available|ne sont pas disponibles|no están disponibles/);}
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
