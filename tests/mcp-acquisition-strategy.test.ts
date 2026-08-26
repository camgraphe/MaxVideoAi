import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const marketingRoot = 'frontend/app/(localized)/[locale]/(marketing)';
const copyPath = `${marketingRoot}/mcp/_lib/mcp-page-copy.ts`;
const integrationCopyPath = `${marketingRoot}/integrations/_lib/integration-copy.ts`;

function source(path: string): string {
  assert.equal(existsSync(path), true, `${path} should exist`);
  return readFileSync(path, 'utf8');
}

test('ChatGPT is a first-class localized acquisition route beside Claude and Codex', () => {
  for (const path of [
    `${marketingRoot}/integrations/chatgpt/page.tsx`,
    'frontend/app/integrations/chatgpt/page.tsx',
  ]) source(path);

  const routing = source('frontend/i18n/routing.ts');
  const publication = source('frontend/lib/mcp-publication.ts');
  const sitemap = source('frontend/next-sitemap.config.js');
  const llms = source('frontend/lib/seo/llms-text.ts');

  for (const value of [routing, publication, sitemap, llms]) {
    assert.match(value, /\/integrations\/chatgpt/);
  }
});

test('the commercial copy leads with the outcome and removes stale internal preview language', () => {
  const copy = source(copyPath);
  const integrations = source(integrationCopyPath);

  assert.match(copy, /AI video plugin/i);
  assert.match(copy, /ChatGPT/i);
  assert.match(copy, /Claude/i);
  assert.match(copy, /exact (?:price|quote)/i);
  assert.match(copy, /MaxVideoAI library/i);
  assert.match(copy, /top[ -]?up/i);
  assert.match(copy, /image, video (?:and|or) audio/i);

  for (const internalPhrase of [
    /host validation in progress/i,
    /local implementation verified/i,
    /local MCP preview/i,
    /local contract/i,
    /Task 10/i,
    /lowest-cost model that fits/i,
    /budget-first shortlist/i,
  ]) {
    assert.doesNotMatch(copy, internalPhrase);
    assert.doesNotMatch(integrations, internalPhrase);
  }
});

test('ChatGPT and Claude are the two equal primary actions while Codex remains discoverable', () => {
  const copy = source(copyPath);
  assert.match(copy, /clientActions\('en',[\s\S]*chatgpt:[\s\S]*claude:/);
  assert.match(copy, /integrations, 'chatgpt'/);
  assert.match(copy, /integrations, 'claude'/);
  assert.match(copy, /Codex/);

  const actions = source(`${marketingRoot}/mcp/_components/McpClientActions.tsx`);
  assert.match(actions, /openai-mark-light\.svg/);
  assert.match(actions, /claude-mark-light\.svg/);
  assert.match(actions, /sm:grid-cols-2/);
});

test('public indexation is not blocked by the optional introductory trial', () => {
  const publication = source('frontend/lib/mcp-publication.ts');
  const sitemap = source('frontend/next-sitemap.config.js');
  const returnedState = publication.slice(publication.indexOf('return {'));
  const indexableExpression = returnedState.match(/indexable:\s*([\s\S]*?),\n\s*showTrialClaim/)?.[1] ?? '';

  assert.doesNotMatch(indexableExpression, /\btrial\b/);
  assert.doesNotMatch(sitemap, /const mcpIndexable =[\s\S]{0,220}mcpPublication\.trial/);
  assert.match(publication, /showTrialClaim:\s*trial/);
});

test('the homepage and contextual links own a prospect-facing assistant workflow entry', () => {
  const home = source(`${marketingRoot}/(home)/page.tsx`);
  const sections = source('frontend/components/marketing/home/HomeRedesignSections.tsx');
  const internalLinks = source('frontend/lib/mcp-internal-links.ts');

  assert.match(home, /HomeAssistantWorkflow/);
  assert.match(sections, /HomeAssistantWorkflow/);
  assert.match(internalLinks, /'home'/);
  assert.match(internalLinks, /ChatGPT/);
  assert.match(internalLinks, /Claude/);
});

test('the plugin stays live-catalog driven and documents model-registry maintenance', () => {
  const skill = source('plugins/maxvideoai/skills/maxvideoai/SKILL.md');
  const guide = source('docs/engineering/mcp-architecture.md');

  assert.match(skill, /Do not rely on model memory/);
  assert.match(skill, /list_models/);
  assert.match(skill, /get_model_details/);
  assert.match(guide, /model-registry\.json/);
  assert.match(guide, /pnpm model:registry:check/);
  assert.match(guide, /list_models/);
  assert.match(guide, /no copied catalogue|never copy/i);
});
