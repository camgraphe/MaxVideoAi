import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();

const assetDropzonePath = join(root, 'frontend/components/AssetDropzone.tsx');
const assetDropzoneSlotPath = join(root, 'frontend/components/asset-dropzone/AssetDropzoneSlot.tsx');
const assetDropzoneHelpersPath = join(root, 'frontend/components/asset-dropzone/asset-dropzone-helpers.ts');
const assetDropzoneTypesPath = join(root, 'frontend/components/asset-dropzone/asset-dropzone-types.ts');

const mediaLightboxPath = join(root, 'frontend/components/MediaLightbox.tsx');
const mediaLightboxEntryCardPath = join(root, 'frontend/components/media-lightbox/MediaLightboxEntryCard.tsx');
const mediaLightboxHelpersPath = join(root, 'frontend/components/media-lightbox/media-lightbox-helpers.ts');
const mediaLightboxTypesPath = join(root, 'frontend/components/media-lightbox/media-lightbox-types.ts');

const quadPreviewPath = join(root, 'frontend/components/QuadPreviewPanel.tsx');
const quadMosaicFigurePath = join(root, 'frontend/components/quad-preview/QuadMosaicFigure.tsx');
const quadSingleTilesGridPath = join(root, 'frontend/components/quad-preview/QuadSingleTilesGrid.tsx');
const quadPreviewHelpersPath = join(root, 'frontend/components/quad-preview/quad-preview-helpers.ts');
const quadPreviewTypesPath = join(root, 'frontend/components/quad-preview/quad-preview-types.ts');

test('shared media surfaces delegate slot, entry rendering, helper, and type ownership', () => {
  for (const path of [
    assetDropzonePath,
    assetDropzoneSlotPath,
    assetDropzoneHelpersPath,
    assetDropzoneTypesPath,
    mediaLightboxPath,
    mediaLightboxEntryCardPath,
    mediaLightboxHelpersPath,
    mediaLightboxTypesPath,
    quadPreviewPath,
    quadMosaicFigurePath,
    quadSingleTilesGridPath,
    quadPreviewHelpersPath,
    quadPreviewTypesPath,
  ]) {
    assert.ok(existsSync(path), `${path} should exist`);
  }

  const assetDropzoneSource = readFileSync(assetDropzonePath, 'utf8');
  const assetDropzoneSlotSource = readFileSync(assetDropzoneSlotPath, 'utf8');
  const assetDropzoneHelpersSource = readFileSync(assetDropzoneHelpersPath, 'utf8');
  const assetDropzoneTypesSource = readFileSync(assetDropzoneTypesPath, 'utf8');

  assert.match(assetDropzoneSource, /<AssetDropzoneSlot/, 'AssetDropzone should compose a focused slot component');
  assert.doesNotMatch(assetDropzoneSource, /function resolveSlotLabel|function readMediaDuration/, 'AssetDropzone should not own helper logic');
  assert.doesNotMatch(assetDropzoneSource, /AudioEqualizerBadge|Trash2|<audio|<video/, 'AssetDropzone should not own slot media rendering');
  assert.match(assetDropzoneSlotSource, /export function AssetDropzoneSlot/, 'AssetDropzoneSlot should own slot rendering');
  assert.match(assetDropzoneHelpersSource, /export function resolveSlotLabel/, 'asset dropzone helpers should own slot labels');
  assert.match(assetDropzoneHelpersSource, /export function readMediaDuration/, 'asset dropzone helpers should own browser duration probing');
  assert.match(assetDropzoneTypesSource, /export type AssetSlotAttachment/, 'asset dropzone types should own public attachment types');

  const mediaLightboxSource = readFileSync(mediaLightboxPath, 'utf8');
  const mediaLightboxEntryCardSource = readFileSync(mediaLightboxEntryCardPath, 'utf8');
  const mediaLightboxHelpersSource = readFileSync(mediaLightboxHelpersPath, 'utf8');
  const mediaLightboxTypesSource = readFileSync(mediaLightboxTypesPath, 'utf8');

  assert.match(mediaLightboxSource, /<MediaLightboxEntryCard/, 'MediaLightbox should compose a focused entry card');
  assert.doesNotMatch(mediaLightboxSource, /function formatPromptPreview|function RenderDecorVisual|function ActionCard/, 'MediaLightbox should not own entry rendering helpers');
  assert.match(mediaLightboxEntryCardSource, /export function MediaLightboxEntryCard/, 'MediaLightboxEntryCard should own entry rendering');
  assert.match(mediaLightboxEntryCardSource, /function RenderDecorVisual/, 'entry card should own decorative render visuals');
  assert.match(mediaLightboxHelpersSource, /export function formatPromptPreview/, 'media lightbox helpers should own prompt formatting');
  assert.match(mediaLightboxHelpersSource, /export function resolveStatusLabel/, 'media lightbox helpers should own status labels');
  assert.match(mediaLightboxTypesSource, /export interface MediaLightboxEntry/, 'media lightbox types should own public entry contracts');

  const quadPreviewSource = readFileSync(quadPreviewPath, 'utf8');
  const quadMosaicFigureSource = readFileSync(quadMosaicFigurePath, 'utf8');
  const quadSingleTilesGridSource = readFileSync(quadSingleTilesGridPath, 'utf8');
  const quadPreviewHelpersSource = readFileSync(quadPreviewHelpersPath, 'utf8');
  const quadPreviewTypesSource = readFileSync(quadPreviewTypesPath, 'utf8');

  assert.match(quadPreviewSource, /<QuadMosaicFigure/, 'QuadPreviewPanel should compose a focused mosaic figure');
  assert.match(quadPreviewSource, /<QuadSingleTilesGrid/, 'QuadPreviewPanel should compose focused single-take tiles');
  assert.doesNotMatch(quadPreviewSource, /TILE_ACTIONS|data-quad-cell|data-quad-tile-fallback/, 'QuadPreviewPanel should not own tile rendering details');
  assert.match(quadMosaicFigureSource, /export function QuadMosaicFigure/, 'QuadMosaicFigure should own mosaic rendering');
  assert.match(quadSingleTilesGridSource, /export function QuadSingleTilesGrid/, 'QuadSingleTilesGrid should own single-take tile rendering');
  assert.match(quadPreviewHelpersSource, /export const TILE_ACTIONS/, 'quad preview helpers should own tile action metadata');
  assert.match(quadPreviewHelpersSource, /export function getAspectClass/, 'quad preview helpers should own aspect classes');
  assert.match(quadPreviewHelpersSource, /export function buildTilesWithPlaceholders/, 'quad preview helpers should own placeholder composition');
  assert.match(quadPreviewTypesSource, /export interface QuadPreviewTile/, 'quad preview types should own public tile contracts');

  assert.ok(assetDropzoneSource.split('\n').length <= 460, 'AssetDropzone should stay below 460 lines');
  assert.ok(assetDropzoneSlotSource.split('\n').length <= 380, 'AssetDropzoneSlot should stay below 380 lines');
  assert.ok(mediaLightboxSource.split('\n').length <= 320, 'MediaLightbox should stay below 320 lines');
  assert.ok(mediaLightboxEntryCardSource.split('\n').length <= 470, 'MediaLightboxEntryCard should stay below 470 lines');
  assert.ok(quadPreviewSource.split('\n').length <= 260, 'QuadPreviewPanel should stay below 260 lines');
  assert.ok(quadMosaicFigureSource.split('\n').length <= 150, 'QuadMosaicFigure should stay below 150 lines');
  assert.ok(quadSingleTilesGridSource.split('\n').length <= 260, 'QuadSingleTilesGrid should stay below 260 lines');
});
