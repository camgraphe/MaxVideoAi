import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(core)/video/[id]/page.tsx');
const contentPath = join(root, 'frontend/app/(core)/video/[id]/_components/VideoWatchContent.tsx');
const cardPath = join(root, 'frontend/app/(core)/video/[id]/_components/VideoWatchCard.tsx');
const relatedPath = join(root, 'frontend/app/(core)/video/[id]/_components/VideoWatchRelatedExamples.tsx');
const sidebarPath = join(root, 'frontend/app/(core)/video/[id]/_components/VideoWatchSidebar.tsx');
const unavailablePath = join(root, 'frontend/app/(core)/video/[id]/_components/VideoUnavailableState.tsx');
const utilsPath = join(root, 'frontend/app/(core)/video/[id]/_lib/video-watch-page-utils.ts');

const pageSource = readFileSync(pagePath, 'utf8');
const contentSource = readFileSync(contentPath, 'utf8');
const cardSource = readFileSync(cardPath, 'utf8');
const relatedSource = readFileSync(relatedPath, 'utf8');
const sidebarSource = readFileSync(sidebarPath, 'utf8');
const unavailableSource = readFileSync(unavailablePath, 'utf8');
const utilsSource = readFileSync(utilsPath, 'utf8');

test('video watch page stays a route orchestrator', () => {
  assert.ok(existsSync(pagePath), 'video watch page should exist');
  assert.ok(existsSync(contentPath), 'video watch content component should exist');
  assert.ok(existsSync(cardPath), 'video watch card shell should exist');
  assert.ok(existsSync(relatedPath), 'video watch related examples component should exist');
  assert.ok(existsSync(sidebarPath), 'video watch sidebar component should exist');
  assert.ok(existsSync(unavailablePath), 'video unavailable component should exist');
  assert.ok(existsSync(utilsPath), 'video watch helper module should exist');

  assert.match(pageSource, /export async function generateMetadata/, 'route should keep metadata orchestration');
  assert.match(pageSource, /export default async function VideoPage/, 'route should keep page orchestration');
  assert.match(pageSource, /from '\.\/_components\/VideoWatchContent'/, 'route should import watch content');
  assert.match(pageSource, /from '\.\/_components\/VideoUnavailableState'/, 'route should import unavailable state');
  assert.match(pageSource, /from '\.\/_lib\/video-watch-page-utils'/, 'route should import helper module');
  assert.doesNotMatch(pageSource, /WatchVideoPlayer/, 'watch player rendering belongs in VideoWatchContent');
  assert.doesNotMatch(pageSource, /CopyPromptButton/, 'prompt copy UI belongs in VideoWatchContent');
  assert.doesNotMatch(pageSource, /WatchKeyFrames/, 'keyframe UI belongs in VideoWatchContent');
  assert.doesNotMatch(pageSource, /dangerouslySetInnerHTML/, 'JSON-LD script rendering belongs in VideoWatchContent');
  assert.doesNotMatch(pageSource, /function WatchCard/, 'watch card UI belongs in VideoWatchContent');
  assert.doesNotMatch(pageSource, /function serializeJsonLd/, 'JSON-LD serialization belongs in helper module');
  assert.doesNotMatch(pageSource, /function parseAspectRatio/, 'aspect parsing belongs in helper module');

  const lineCount = pageSource.split('\n').length;
  assert.ok(lineCount <= 100, `video watch page should stay below 100 lines after extraction, got ${lineCount}`);
});

test('video watch modules own rendering and helper contracts', () => {
  assert.match(contentSource, /export function VideoWatchContent/, 'content component should be exported');
  assert.match(contentSource, /WatchVideoPlayer/, 'content component should own video player rendering');
  assert.match(contentSource, /WatchKeyFrames/, 'content component should own keyframe rendering');
  assert.match(contentSource, /CopyPromptButton/, 'content component should own prompt copy UI');
  assert.match(contentSource, /Prompt improvement notes/, 'watch page should include prompt improvement notes');
  assert.match(contentSource, /Compare this model/, 'watch page should include compare links');
  assert.match(contentSource, /Estimated price/, 'watch page should label the estimated render price');
  assert.match(contentSource, /dangerouslySetInnerHTML/, 'content component should own JSON-LD script rendering');
  assert.match(contentSource, /from '\.\/VideoWatchCard'/, 'content component should compose the watch card shell');
  assert.match(contentSource, /from '\.\/VideoWatchRelatedExamples'/, 'content component should compose related examples');
  assert.match(contentSource, /from '\.\/VideoWatchSidebar'/, 'content component should compose the sidebar');
  assert.doesNotMatch(contentSource, /function WatchCard/, 'watch card UI belongs in VideoWatchCard');
  assert.doesNotMatch(contentSource, /function buildHighlightItems/, 'highlight view model belongs in VideoWatchSidebar');
  assert.doesNotMatch(contentSource, /Related examples/, 'related examples markup belongs in VideoWatchRelatedExamples');
  assert.ok(contentSource.split('\n').length <= 360, `video watch content should stay below 360 lines, got ${contentSource.split('\n').length}`);
  assert.match(cardSource, /export function VideoWatchCard/, 'watch card shell should be exported');
  assert.match(relatedSource, /export function VideoWatchRelatedExamples/, 'related examples component should be exported');
  assert.match(sidebarSource, /export function VideoWatchSidebar/, 'sidebar component should be exported');
  assert.match(sidebarSource, /function buildHighlightItems/, 'sidebar should own highlight view model');
  assert.match(sidebarSource, /function getDetailIcon/, 'sidebar should own detail icon mapping');
  assert.match(unavailableSource, /export function VideoUnavailableState/, 'unavailable component should be exported');
  assert.match(utilsSource, /export function buildMetaTitle/, 'helper module should own metadata title building');
  assert.match(utilsSource, /export function parseAspectRatio/, 'helper module should own aspect parsing');
  assert.match(utilsSource, /export function serializeJsonLd/, 'helper module should own JSON-LD serialization');
  assert.match(utilsSource, /export function isRenderable/, 'helper module should own renderability guard');
  assert.match(utilsSource, /export type WatchPageData/, 'helper module should export route data type');
});
