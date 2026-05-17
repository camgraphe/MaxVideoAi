import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/page.tsx');
const copyPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/_lib/ai-video-engines-copy.ts');
const copyTypesPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/_lib/ai-video-engines-copy-types.ts');
const copyEnPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/_lib/ai-video-engines-copy-en.ts');
const copyFrPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/_lib/ai-video-engines-copy-fr.ts');
const copyEsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/_lib/ai-video-engines-copy-es.ts');
const scoresPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/_lib/ai-video-engines-scores.ts');
const enMessagesPath = join(root, 'frontend/messages/en.json');
const frMessagesPath = join(root, 'frontend/messages/fr.json');
const esMessagesPath = join(root, 'frontend/messages/es.json');

const pageSource = readFileSync(pagePath, 'utf8');
const copySource = readFileSync(copyPath, 'utf8');
const copyTypesSource = readFileSync(copyTypesPath, 'utf8');
const copyEnSource = readFileSync(copyEnPath, 'utf8');
const copyFrSource = readFileSync(copyFrPath, 'utf8');
const copyEsSource = readFileSync(copyEsPath, 'utf8');
const scoresSource = readFileSync(scoresPath, 'utf8');
const enMessages = JSON.parse(readFileSync(enMessagesPath, 'utf8')) as {
  aiVideoEngines: { meta: { title: string; description: string } };
};
const frMessages = JSON.parse(readFileSync(frMessagesPath, 'utf8')) as {
  aiVideoEngines: { meta: { title: string; description: string } };
};
const esMessages = JSON.parse(readFileSync(esMessagesPath, 'utf8')) as {
  aiVideoEngines: { meta: { title: string; description: string } };
};

test('ai video engines hub keeps page.tsx focused on route orchestration', () => {
  assert.ok(existsSync(copyPath), 'localized hub copy should live in a route-local copy module');
  assert.ok(existsSync(scoresPath), 'score loading should live in a route-local server helper');
  assert.match(pageSource, /from '\.\/_lib\/ai-video-engines-copy'/);
  assert.match(pageSource, /from '\.\/_lib\/ai-video-engines-scores'/);

  const lineCount = pageSource.split('\n').length;
  assert.ok(lineCount <= 430, `ai-video-engines page.tsx should stay below 430 lines, got ${lineCount}`);

  for (const owner of ['const HUB_COPY', 'type HubCopy', 'type EngineScoreRow', 'function computeOverallFromScore']) {
    assert.doesNotMatch(pageSource, new RegExp(owner), `${owner} should not be owned by the hub page`);
  }
});

test('ai video engines route-local modules expose copy and score contracts', () => {
  assert.ok(existsSync(copyTypesPath), 'hub copy types should live in a focused route-local module');
  assert.ok(existsSync(copyEnPath), 'English hub copy should live in a focused route-local module');
  assert.ok(existsSync(copyFrPath), 'French hub copy should live in a focused route-local module');
  assert.ok(existsSync(copyEsPath), 'Spanish hub copy should live in a focused route-local module');
  assert.match(copySource, /export type \{ BestForCtaCopy, HubCopy, HubFaqEntry \}/);
  assert.match(copySource, /from '\.\/ai-video-engines-copy-en'/);
  assert.match(copySource, /from '\.\/ai-video-engines-copy-fr'/);
  assert.match(copySource, /from '\.\/ai-video-engines-copy-es'/);
  assert.doesNotMatch(copySource, /const HUB_COPY: Record<AppLocale, HubCopy>/);
  assert.doesNotMatch(copySource, /Compare AI video engines|Comparatifs de modèles vidéo IA|Comparar motores de video con IA/);
  assert.ok(copySource.split('\n').length <= 80, `ai video engines copy facade should stay below 80 lines, got ${copySource.split('\n').length}`);
  assert.match(copyTypesSource, /export type HubCopy/);
  assert.match(copyTypesSource, /export type BestForCtaCopy/);
  assert.match(copyEnSource, /export const EN_HUB_COPY: HubCopy/);
  assert.match(copyFrSource, /export const FR_HUB_COPY: HubCopy/);
  assert.match(copyEsSource, /export const ES_HUB_COPY: HubCopy/);
  assert.match(copySource, /export function getHubCopy/);
  assert.match(copySource, /export function getBestForCta/);
  assert.match(scoresSource, /type EngineScoreRow/);
  assert.match(scoresSource, /function computeOverallFromScore/);
  assert.match(scoresSource, /export async function loadHubEngineScoreMap/);
});

test('ai video engines hub exposes SERP-focused metadata without a brand suffix', () => {
  const { title, description } = enMessages.aiVideoEngines.meta;

  assert.equal(title, 'Compare AI Video Engines: 11-Criteria Scorecards');
  assert.equal(
    description,
    'Compare Kling, Seedance, Veo, LTX and other AI video engines by pricing, audio, duration, resolution and 11-criteria side-by-side scorecards.'
  );
  assert.ok(title.length <= 60, `title should stay within 60 chars, got ${title.length}`);
  assert.ok(description.length <= 160, `description should stay within 160 chars, got ${description.length}`);
  assert.doesNotMatch(title, /MaxVideoAI|—|\|/);
  assert.doesNotMatch(frMessages.aiVideoEngines.meta.title, /MaxVideoAI|—|\|/);
  assert.doesNotMatch(esMessages.aiVideoEngines.meta.title, /MaxVideoAI|—|\|/);
  for (const [locale, meta] of [
    ['fr', frMessages.aiVideoEngines.meta],
    ['es', esMessages.aiVideoEngines.meta],
  ] as const) {
    assert.ok(meta.title.length <= 60, `${locale} title should stay within 60 chars, got ${meta.title.length}`);
    assert.ok(
      meta.description.length <= 160,
      `${locale} description should stay within 160 chars, got ${meta.description.length}`
    );
  }
  assert.match(pageSource, /titleBranding:\s*'none'/);
  assert.match(copyEnSource, /title:\s*'Compare AI video engines'/);
});
