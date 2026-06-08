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
const sourceImagesPath = join(root, 'frontend/app/(core)/video/[id]/_components/VideoWatchSourceImages.tsx');
const sourceImagesClientPath = join(root, 'frontend/app/(core)/video/[id]/_components/VideoWatchSourceImages.client.tsx');
const unavailablePath = join(root, 'frontend/app/(core)/video/[id]/_components/VideoUnavailableState.tsx');
const utilsPath = join(root, 'frontend/app/(core)/video/[id]/_lib/video-watch-page-utils.ts');

const pageSource = readFileSync(pagePath, 'utf8');
const contentSource = readFileSync(contentPath, 'utf8');
const cardSource = readFileSync(cardPath, 'utf8');
const relatedSource = readFileSync(relatedPath, 'utf8');
const sidebarSource = readFileSync(sidebarPath, 'utf8');
const sourceImagesSource = existsSync(sourceImagesPath) ? readFileSync(sourceImagesPath, 'utf8') : '';
const sourceImagesClientSource = existsSync(sourceImagesClientPath) ? readFileSync(sourceImagesClientPath, 'utf8') : '';
const unavailableSource = readFileSync(unavailablePath, 'utf8');
const utilsSource = readFileSync(utilsPath, 'utf8');

test('video watch page stays a route orchestrator', () => {
  assert.ok(existsSync(pagePath), 'video watch page should exist');
  assert.ok(existsSync(contentPath), 'video watch content component should exist');
  assert.ok(existsSync(cardPath), 'video watch card shell should exist');
  assert.ok(existsSync(relatedPath), 'video watch related examples component should exist');
  assert.ok(existsSync(sidebarPath), 'video watch sidebar component should exist');
  assert.ok(existsSync(sourceImagesPath), 'video watch source images server wrapper should exist');
  assert.ok(existsSync(sourceImagesClientPath), 'video watch source images lightbox should exist');
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
  assert.match(contentSource, /Visual workflow context/, 'public watch page should name editorial visual context without exposing SEO jargon');
  assert.match(contentSource, /promptIsExpandable/, 'long prompts should be expandable from the primary prompt panel');
  assert.match(contentSource, /PROMPT_CONTEXT_PREVIEW_MAX_CHARS/, 'long visual workflow context should use a bounded preview length');
  assert.match(contentSource, /promptContextIsLong/, 'visual workflow context should be expandable when the context itself is too long');
  assert.match(contentSource, /promptContextPreviewText/, 'collapsed prompt panel should render the bounded visual context preview');
  assert.match(contentSource, /signals\.seoPromptContext \? 'Show full context' : 'Show full prompt'/, 'visual workflow context disclosure should use context-specific expand copy');
  assert.match(contentSource, /CopyPromptButton prompt=\{signals\.promptText\}/, 'copy action should copy the full prompt without relying on the removed bottom prompt block');
  assert.doesNotMatch(contentSource, /SEO context/, 'public watch page should not expose SEO implementation labels');
  assert.doesNotMatch(contentSource, /signals\.seoPromptContext \? 'SEO context'/, 'editorial context should not be repeated as a table row');
  assert.doesNotMatch(contentSource, /label: 'Subject', value: promptContextText/, 'watch page should not repeat the prompt as a Subject row');
  assert.doesNotMatch(contentSource, /className="group mt-4 rounded-input/, 'full prompt disclosure should not sit below the prompt breakdown table');
  assert.ok(
    contentSource.indexOf('<VideoWatchSourceImages') < contentSource.indexOf('{promptContextTitle}'),
    'storyboard and source images should render above the prompt breakdown card',
  );
  assert.match(contentSource, /dangerouslySetInnerHTML/, 'content component should own JSON-LD script rendering');
  assert.match(contentSource, /from '\.\/VideoWatchCard'/, 'content component should compose the watch card shell');
  assert.match(contentSource, /from '\.\/VideoWatchRelatedExamples'/, 'content component should compose related examples');
  assert.doesNotMatch(contentSource, /<VideoWatchRelatedExamples engineLabel=/, 'related cards should not receive the current video engine as a shared badge label');
  assert.match(contentSource, /from '\.\/VideoWatchSidebar'/, 'content component should compose the sidebar');
  assert.doesNotMatch(contentSource, /function WatchCard/, 'watch card UI belongs in VideoWatchCard');
  assert.doesNotMatch(contentSource, /function buildHighlightItems/, 'highlight view model belongs in VideoWatchSidebar');
  assert.doesNotMatch(contentSource, /Related examples/, 'related examples markup belongs in VideoWatchRelatedExamples');
  assert.ok(contentSource.split('\n').length <= 360, `video watch content should stay below 360 lines, got ${contentSource.split('\n').length}`);
  assert.match(cardSource, /export function VideoWatchCard/, 'watch card shell should be exported');
  assert.match(relatedSource, /export function VideoWatchRelatedExamples/, 'related examples component should be exported');
  assert.match(relatedSource, /\{item\.engineLabel\}/, 'related example badges should use each related video engine label');
  assert.doesNotMatch(relatedSource, /engineLabel:\s*string/, 'related examples should not accept a shared engine label prop');
  assert.match(sidebarSource, /export function VideoWatchSidebar/, 'sidebar component should be exported');
  assert.match(sourceImagesSource, /VideoWatchSourceImagesClient/, 'server source image wrapper should compose the client lightbox');
  assert.doesNotMatch(sourceImagesSource, /'use client'/, 'source image URL normalization should stay server-renderable');
  assert.match(sourceImagesClientSource, /'use client'/, 'source image lightbox should own client interaction state');
  assert.match(sourceImagesClientSource, /role="dialog"/, 'source image lightbox should use dialog semantics');
  assert.match(sourceImagesClientSource, /aria-modal="true"/, 'source image lightbox should be modal to assistive tech');
  assert.match(sourceImagesClientSource, /setSelectedIndex\(index\)/, 'source image thumbnails should open the selected image');
  assert.match(sourceImagesClientSource, /setSelectedIndex\(null\)/, 'source image lightbox should expose close actions');
  assert.match(sourceImagesClientSource, /Escape/, 'source image lightbox should close from the keyboard');
  assert.match(sourceImagesClientSource, /ArrowLeft/, 'source image lightbox should support previous-image keyboard navigation');
  assert.match(sourceImagesClientSource, /ArrowRight/, 'source image lightbox should support next-image keyboard navigation');
  assert.match(sourceImagesClientSource, /View larger/, 'source image thumbnails should advertise the enlarged view affordance');
  assert.match(sourceImagesSource, /thumbnailUrl:\s*sourceImage\.thumbUrl/, 'server wrapper should keep thumbnail and original image URLs distinct');
  assert.match(sourceImagesClientSource, /const thumbnailUrl = sourceImage\.thumbnailUrl \?\? sourceImage\.imageUrl/, 'source image grid should prefer the lightweight thumbnail URL');
  assert.match(sourceImagesClientSource, /src=\{thumbnailUrl\}/, 'source image grid should render thumbnails without changing the original lightbox URL');
  assert.match(sourceImagesClientSource, /object-contain/, 'source image previews should preserve storyboard and frame aspect ratios');
  assert.match(sourceImagesClientSource, /Open original/, 'source image lightbox should expose the original asset URL');
  assert.match(sidebarSource, /function buildHighlightItems/, 'sidebar should own highlight view model');
  assert.match(sidebarSource, /function getDetailIcon/, 'sidebar should own detail icon mapping');
  assert.match(unavailableSource, /export function VideoUnavailableState/, 'unavailable component should be exported');
  assert.match(utilsSource, /export function buildMetaTitle/, 'helper module should own metadata title building');
  assert.match(utilsSource, /export function parseAspectRatio/, 'helper module should own aspect parsing');
  assert.match(utilsSource, /export function serializeJsonLd/, 'helper module should own JSON-LD serialization');
  assert.match(utilsSource, /export function isRenderable/, 'helper module should own renderability guard');
  assert.match(utilsSource, /export type WatchPageData/, 'helper module should export route data type');
});
