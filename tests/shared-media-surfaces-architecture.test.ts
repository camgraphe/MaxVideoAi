import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();

const assetDropzonePath = join(root, 'frontend/components/AssetDropzone.tsx');
const assetFieldTooltipPath = join(root, 'frontend/components/asset-dropzone/AssetFieldTooltip.tsx');
const assetMediaPickerMenuPath = join(root, 'frontend/components/asset-dropzone/AssetMediaPickerMenu.tsx');
const assetDropzoneSlotPath = join(root, 'frontend/components/asset-dropzone/AssetDropzoneSlot.tsx');
const assetDropzoneHelpersPath = join(root, 'frontend/components/asset-dropzone/asset-dropzone-helpers.ts');
const assetDropzoneTypesPath = join(root, 'frontend/components/asset-dropzone/asset-dropzone-types.ts');
const assetExclusivePickerHookPath = join(root, 'frontend/components/asset-dropzone/useExclusiveMediaPicker.ts');

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
    assetFieldTooltipPath,
    assetMediaPickerMenuPath,
    assetDropzoneSlotPath,
    assetDropzoneHelpersPath,
    assetDropzoneTypesPath,
    assetExclusivePickerHookPath,
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
  const assetFieldTooltipSource = readFileSync(assetFieldTooltipPath, 'utf8');
  const assetMediaPickerMenuSource = readFileSync(assetMediaPickerMenuPath, 'utf8');
  const assetDropzoneSlotSource = readFileSync(assetDropzoneSlotPath, 'utf8');
  const assetDropzoneHelpersSource = readFileSync(assetDropzoneHelpersPath, 'utf8');
  const assetDropzoneTypesSource = readFileSync(assetDropzoneTypesPath, 'utf8');
  const assetExclusivePickerHookSource = readFileSync(assetExclusivePickerHookPath, 'utf8');

  assert.match(assetDropzoneSource, /<AssetDropzoneSlot/, 'AssetDropzone should compose a focused slot component');
  assert.match(
    assetDropzoneSource,
    /const emptySlots = displaySlots\.filter[\s\S]*return \[\.\.\.emptySlots, \.\.\.filledSlots\]/,
    'collection asset fields should render the add action before existing thumbnails'
  );
  assert.doesNotMatch(assetDropzoneSource, /function resolveSlotLabel|function readMediaDuration/, 'AssetDropzone should not own helper logic');
  assert.doesNotMatch(assetDropzoneSource, /AudioEqualizerBadge|Trash2|<audio|<video/, 'AssetDropzone should not own slot media rendering');
  assert.match(assetDropzoneSource, /<AssetFieldTooltip/, 'AssetDropzone should compose a field-level details tooltip');
  assert.match(
    assetDropzoneSource,
    /const maxVideoDuration = field\.maxDurationSec \?\? limits\.videoMaxDurationSec;[\s\S]*assetCopy\.secondsMax\(maxVideoDuration\)/,
    'video helper copy should surface field-level duration limits such as Seedance reference videos'
  );
  assert.match(
    assetDropzoneSource,
    /const visibleHelperText = field\.type === 'video'[\s\S]*helperLines\.join\(' · '\)/,
    'video helper copy should render visibly instead of living only inside the tooltip'
  );
  assert.match(
    assetDropzoneSource,
    /const isSourceVideoDisabledState = disabledReason\?\.toLowerCase\(\)\.includes\('source video'\);[\s\S]*const disabledStatusLabel = isSourceVideoDisabledState[\s\S]*Source video active[\s\S]*Unavailable/,
    'disabled asset fields should show a specific source-video status instead of relying on greyed styling'
  );
  assert.match(
    assetDropzoneSource,
    /disabled && disabledReason && !isSourceVideoDisabledState/,
    'source-video conflicts should keep only the Source video active badge visible'
  );
  assert.doesNotMatch(
    assetDropzoneSource,
    /disabled && 'opacity-70'/,
    'disabled asset fields should not rely on card opacity to explain workflow conflicts'
  );
  assert.match(assetFieldTooltipSource, /export function AssetFieldTooltip/, 'AssetFieldTooltip should own the details tooltip rendering');
  assert.match(
    assetFieldTooltipSource,
    /group-hover\/tooltip:block group-focus-within\/tooltip:block/,
    'asset placeholder details should be available on hover and focus for desktop and mobile'
  );
  assert.match(
    assetFieldTooltipSource,
    /right-0[\s\S]*sm:left-1\/2 sm:right-auto sm:-translate-x-1\/2/,
    'asset placeholder tooltips should stay inside narrow mobile viewports'
  );
  assert.doesNotMatch(
    assetDropzoneSource,
    /title=\{detailsTooltip\}/,
    'asset placeholder details should not rely only on the native title tooltip'
  );
  assert.match(assetDropzoneSlotSource, /export function AssetDropzoneSlot/, 'AssetDropzoneSlot should own slot rendering');
  assert.match(assetDropzoneSlotSource, /<AssetMediaPickerMenu/, 'AssetDropzoneSlot should delegate upload/library choice UI');
  assert.match(
    assetDropzoneSlotSource,
    /useExclusiveMediaPicker/,
    'AssetDropzoneSlot should use the shared exclusive picker hook'
  );
  assert.match(
    assetExclusivePickerHookSource,
    /let activePickerId: string \| null = null;[\s\S]*useSyncExternalStore/,
    'media picker exclusivity should use one shared active picker id'
  );
  assert.match(
    assetExclusivePickerHookSource,
    /const pickerOpen = activeId === mediaPickerId;[\s\S]*setActivePickerId\(mediaPickerId\);/,
    'opening a media picker should make every other picker inactive'
  );
  assert.doesNotMatch(
    assetDropzoneSlotSource,
    /isLockedEmptySlot && disabledReason|disabledReason && slotIndex === 0 && !isLockedEmptySlot/,
    'slot bodies should not duplicate disabled workflow explanations already shown at field level'
  );
  assert.match(assetMediaPickerMenuSource, /export function AssetMediaPickerMenu/, 'AssetMediaPickerMenu should own the choose-media popup');
  assert.match(assetMediaPickerMenuSource, /role="dialog"/, 'choose-media popup should expose dialog semantics');
  assert.doesNotMatch(
    assetDropzoneSlotSource,
    /const slotDescription|const slotMeta|field\.description \?\? roleDescription|helperLines\.slice\(0, 2\)/,
    'slot cards should keep long helper copy in the header tooltip instead of the body'
  );
  assert.match(
    assetDropzoneSlotSource,
    /const isInitialCollectionSlot =\s+isCollectionField && asset == null && filledAssetCount === 0 && displaySlotCount === 1;/,
    'initial empty collection fields should keep the single add-placeholder layout'
  );
  assert.match(
    assetDropzoneSlotSource,
    /const flattenSlotSurface = displaySlotCount === 1 && \(!isCollectionField \|\| isInitialCollectionSlot\);/,
    'initial empty collection fields should share the single-placeholder layout'
  );
  assert.match(
    assetDropzoneSource,
    /compactCollectionLayout=\{compactCollectionLayout\}/,
    'collection asset fields should pass a compact layout signal down to slot rendering'
  );
  assert.match(
    assetDropzoneSlotSource,
    /const isCompactCollectionAsset = compactCollectionLayout && asset != null;/,
    'filled collection assets should use a dedicated compact thumbnail layout'
  );
  assert.match(
    assetDropzoneSlotSource,
    /isCompactCollectionAsset[\s\S]*min-h-0 rounded-none border-0 bg-transparent/,
    'filled collection assets should not render as boxed vertical cards'
  );
  assert.match(
    assetDropzoneSlotSource,
    /compactCollectionLayout\s+\?\s+'relative aspect-video w-full rounded-\[10px\] bg-surface object-cover'/,
    'filled collection images should render as compact horizontal thumbnails'
  );
  assert.match(
    assetDropzoneSlotSource,
    /const compactAssetLabel = visibleBadge \?\? slotLabel \?\? assetCopy\.imageSlot;/,
    'filled collection assets should label thumbnails with the prompt token/friendly slot label'
  );
  assert.doesNotMatch(
    assetDropzoneSlotSource,
    /compactCollectionLayout \? \([\s\S]*asset\.name[\s\S]*\) : null/,
    'compact collection labels should not expose internal asset filenames or job ids'
  );
  assert.match(
    assetDropzoneSlotSource,
    /compactCollectionLayout\s+\?\s+'right-0\.5 top-0\.5 !h-4 !min-h-0 !w-4 !min-w-0/,
    'compact collection remove should be a small top-right control'
  );
  assert.match(
    assetDropzoneSlotSource,
    /compactCollectionLayout \? <X className="h-2\.5 w-2\.5" aria-hidden \/> : <Trash2/,
    'compact collection remove should use a small X instead of the trash icon'
  );
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
  assert.ok(assetFieldTooltipSource.split('\n').length <= 90, 'AssetFieldTooltip should stay below 90 lines');
  assert.ok(assetMediaPickerMenuSource.split('\n').length <= 100, 'AssetMediaPickerMenu should stay below 100 lines');
  assert.ok(assetDropzoneSlotSource.split('\n').length <= 380, 'AssetDropzoneSlot should stay below 380 lines');
  assert.ok(assetExclusivePickerHookSource.split('\n').length <= 70, 'useExclusiveMediaPicker should stay below 70 lines');
  assert.ok(mediaLightboxSource.split('\n').length <= 320, 'MediaLightbox should stay below 320 lines');
  assert.ok(mediaLightboxEntryCardSource.split('\n').length <= 470, 'MediaLightboxEntryCard should stay below 470 lines');
  assert.ok(quadPreviewSource.split('\n').length <= 260, 'QuadPreviewPanel should stay below 260 lines');
  assert.ok(quadMosaicFigureSource.split('\n').length <= 150, 'QuadMosaicFigure should stay below 150 lines');
  assert.ok(quadSingleTilesGridSource.split('\n').length <= 260, 'QuadSingleTilesGrid should stay below 260 lines');
});
