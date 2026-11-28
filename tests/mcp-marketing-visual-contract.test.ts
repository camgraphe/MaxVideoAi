import './helpers/server-view-styles';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { McpStoryVisual } from '../frontend/components/marketing/mcp/McpStoryVisual.client';
import { McpIntegrationCards } from '../frontend/components/marketing/mcp/McpIntegrationCards';
import { getMcpPublicIntegrationIds } from '../frontend/lib/mcp-integration-registry';
import { GlamaDirectoryGuide } from '../frontend/app/(localized)/[locale]/(marketing)/integrations/_components/GlamaDirectoryGuide';
import { IntegrationPageView } from '../frontend/app/(localized)/[locale]/(marketing)/integrations/_components/IntegrationPageView';
import { getIntegrationCopy } from '../frontend/app/(localized)/[locale]/(marketing)/integrations/_lib/integration-copy';
import { getMcpCompatibilityEvidence } from '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-compatibility';
import { getMcpHostProof } from '../frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-host-proof';
(globalThis as typeof globalThis & {React:typeof React}).React=React;
const read=(p:string)=>readFileSync(p,'utf8');
test('hero illustration has fixed image geometry, a clear label and no automatic video download',()=>{
 const html=renderToStaticMarkup(React.createElement(McpStoryVisual,{locale:'fr',client:'claude'}));
 assert.match(html,/PARCOURS ILLUSTRÉ/);assert.match(html,/width="1200"/);assert.match(html,/height="615"/);
 assert.doesNotMatch(html,/<video|autoplay|preload="auto"/i);
 assert.equal((html.match(/role="tab"/g)??[]).length,3);assert.equal((html.match(/aria-selected="true"/g)??[]).length,1);
 assert.match(html,/role="tabpanel"/);
});
test('public integrations all have real logos and preparing clients never receive setup links',()=>{
 const html=renderToStaticMarkup(React.createElement(McpIntegrationCards,{locale:'en'}));
 for(const id of getMcpPublicIntegrationIds())assert.ok(html.includes(`data-mcp-integration-mark="${id}"`));
 for(const label of ['Cursor','GitHub Copilot','Gemini CLI','Microsoft Copilot'])assert.ok(html.includes(label));
 assert.equal((html.match(/class="mcp-integration-card"/g)??[]).length,5);
 assert.doesNotMatch(html,/href="\/integrations\/(cursor|gemini|microsoft|github)/);
});
test('motion respects reduced motion, and step controls support keyboard navigation',()=>{
 const css=read('frontend/src/styles/marketing-mcp.css');
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);assert.match(css,/animation:none!important/);
 const component=read('frontend/components/marketing/mcp/McpStoryVisual.client.tsx');
 for(const key of ['ArrowLeft','ArrowRight','Home','End'])assert.ok(component.includes(key));
 assert.doesNotMatch(component,/setInterval|setTimeout|fetch\(/);
});
test('manual endpoint copy reports success only after clipboard resolution',()=>{
 const component=read('frontend/app/(localized)/[locale]/(marketing)/integrations/_components/IntegrationInstallCopy.client.tsx');
 assert.match(component,/await navigator.clipboard.writeText\(value\);\s*setState\(nextState\)/);
 assert.match(component,/setState\('error'\)/);assert.match(component,/role="status"/);assert.match(component,/copy.copyInstructionEnabled/);
});
test('FAQ uses native readable server content and mutually exclusive groups',()=>{
 for(const name of ['mcp/_components/McpFaqResourcesSection.tsx','integrations/_components/IntegrationTroubleshootingSection.tsx']){
  const source=read('frontend/app/(localized)/[locale]/(marketing)/'+name);
  assert.match(source,/<details/);assert.match(source,/name="(?:mcp|integration)-faq"/);assert.doesNotMatch(source,/use client|dangerouslySetInnerHTML/);
 }
});

test('Claude shows the real connector on entry and its dated media proof after setup', () => {
 const publication={renderPublicPage:true,connectionAvailable:true,indexable:true,showTrialClaim:false,showPaidGenerationClaim:true,showReferenceClaim:true};
 const compatibility=getMcpCompatibilityEvidence();
 for(const locale of ['en','fr','es'] as const){
  const html=renderToStaticMarkup(React.createElement(IntegrationPageView,{copy:getIntegrationCopy(locale,'claude'),compatibility:compatibility.clients.claude,locale,publication,hostProof:getMcpHostProof('claude',locale)}));
  assert.equal((html.match(/data-mcp-host-proof=/g)??[]).length,1);
  assert.match(html.slice(0, html.indexOf('</header>')), /claude-connector-list/);
  assert.ok(html.indexOf('id="setup"') < html.indexOf('id="first-video"'));
  assert.ok(html.indexOf('id="first-video"') < html.indexOf('data-mcp-host-proof='));
  assert.ok(html.includes('id="claude-video-result"'));
  assert.doesNotMatch(html.slice(0,html.indexOf('</header>')),/mcp-story-scene/);
 }
 const codex=renderToStaticMarkup(React.createElement(IntegrationPageView,{copy:getIntegrationCopy('en','codex'),compatibility:compatibility.clients.codex,locale:'en',publication,hostProof:getMcpHostProof('claude','en')}));
 assert.doesNotMatch(codex,/data-mcp-host-proof=/);
 const gated=renderToStaticMarkup(React.createElement(IntegrationPageView,{copy:getIntegrationCopy('en','claude'),compatibility:compatibility.clients.claude,locale:'en',publication:{...publication,connectionAvailable:false,showPaidGenerationClaim:false},hostProof:getMcpHostProof('claude','en')}));
 assert.doesNotMatch(gated,/data-integration-entry=|data-mcp-host-proof=/);
});

test('each connector shows its own screenshot and first action before the detailed guide', () => {
  const publication = { renderPublicPage: true, connectionAvailable: true, indexable: true,
    showTrialClaim: false, showPaidGenerationClaim: true, showReferenceClaim: true };
  const screenshots = { chatgpt: 'atelier-chatgpt-workspace', codex: 'codex-installed-skills',
    claude: 'claude-connector-list', openclaw: 'control-mcp', n8n: 'n8n-template-canvas' };
  const compatibility = getMcpCompatibilityEvidence();
  for (const locale of ['en', 'fr', 'es'] as const) {
    for (const client of getMcpPublicIntegrationIds()) {
      const html = renderToStaticMarkup(React.createElement(IntegrationPageView, {
        copy: getIntegrationCopy(locale, client), compatibility: compatibility.clients[client]!, locale, publication,
        hostProof: getMcpHostProof(client, locale),
      }));
      const document = new JSDOM(html).window.document;
      assert.ok(document.querySelector('header figure img')?.getAttribute('src')?.includes(screenshots[client as keyof typeof screenshots]));
      const setup = document.querySelector('#setup')!;
      const prompt = document.querySelector('#first-video')!;
      const advanced = document.querySelector('#advanced-setup')!;
      assert.equal(setup.querySelectorAll('li').length, 3);
      assert.ok(setup.compareDocumentPosition(prompt) & 4);
      assert.ok(prompt.compareDocumentPosition(advanced) & 4);
      if (client === 'n8n') {
        const fallback = document.querySelector('header picture img')!.getAttribute('src')!;
        assert.equal([...document.querySelectorAll('link[rel="preload"]')].some(link => link.getAttribute('href') === fallback), false);
      }
      if (client === 'chatgpt') {
        assert.equal(document.querySelector('header figure img')?.getAttribute('fetchpriority'), 'high');
        const video = document.querySelector<HTMLVideoElement>('#real-result video')!;
        assert.equal(video.getAttribute('preload'), 'none');
        assert.ok(video.hasAttribute('controls'));
        assert.equal(video.hasAttribute('autoplay'), false);
        assert.equal(video.hasAttribute('data-deferred-poster'), true);
        assert.equal(video.hasAttribute('poster'), false);
        assert.match(video.getAttribute('src')!, /atelier-chatgpt-window\.mp4$/);
        assert.equal(video.querySelector('track')?.getAttribute('kind'), 'captions');
      }
    }
    const html = renderToStaticMarkup(React.createElement(GlamaDirectoryGuide, {locale, connectionAvailable: true}));
    const document = new JSDOM(html).window.document;
    const inspector = new URL(document.querySelector('#real-result a')!.getAttribute('href')!);
    assert.equal(inspector.hostname, 'glama.ai');
    assert.equal(inspector.searchParams.get('tool'), 'list_models');
    assert.equal(document.querySelectorAll('[data-mcp-host-proof], video').length, 0);
  }
});
