import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { McpStoryVisual } from '../frontend/components/marketing/mcp/McpStoryVisual.client';
import { McpIntegrationCards } from '../frontend/components/marketing/mcp/McpIntegrationCards';
import { getMcpPublicIntegrationIds } from '../frontend/lib/mcp-integration-registry';
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
