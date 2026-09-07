'use client';
/* eslint-disable @next/next/no-img-element */

import { AppGlyph } from '@/components/app/AppGlyph';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { workspaceReferenceCopy } from '@/components/composer/workspace-reference-copy';
import type { AssetDropzoneSlotProps } from './asset-dropzone-types';

/** Media, upload and removal are siblings: native controls never activate replacement. */
export function WorkspaceAssetSlot({ asset, accept, mediaKind = 'image', slotIndex, slotLabel, disabled, disabledReason, minCount, inputRef, canOpenLibrary, onDisabledAttempt, onDrop, onPaste, onInputChange, onSelectFileSlot, onOpenLibrarySlot, onRemoveSlot, assetCopy }: AssetDropzoneSlotProps) {
  const { locale } = useI18n();
  const copy = workspaceReferenceCopy(locale);
  return <div className="app-workspace-asset-slot" data-asset-index={slotIndex}
    onDragOver={(event) => event.preventDefault()}
    onDrop={(event) => { event.preventDefault(); if (disabled) onDisabledAttempt(); else onDrop(event, slotIndex); }}
    onPaste={(event) => { if (disabled) onDisabledAttempt(); else onPaste(event, slotIndex); }}>
    <input ref={inputRef} type="file" accept={accept} className="sr-only" tabIndex={-1} aria-hidden disabled={disabled} onChange={(event) => onInputChange(event, slotIndex)} />
    {!asset ? <div className="app-reference-empty-actions">
      <button className="app-reference-add-target" type="button" disabled={disabled} title={disabledReason ?? accept} aria-label={`${copy.upload} · ${slotLabel} · ${accept}`} onClick={() => onSelectFileSlot(slotIndex)}><AppGlyph name={mediaKind} /><span>{slotLabel}{slotIndex < minCount ? <small>{copy.required}</small> : null}</span></button>
      {canOpenLibrary ? <button type="button" className="app-reference-library-target" disabled={disabled} title={`${copy.library} · ${slotLabel}`} aria-label={`${copy.library} · ${slotLabel}`} onClick={() => onOpenLibrarySlot(slotIndex)}><AppGlyph name="library" /></button> : null}
    </div> : <>
    {asset ? <div className="app-reference-media">
      {asset.kind === 'image' ? <img src={asset.previewUrl} alt={asset.name} loading="lazy" /> : asset.kind === 'video' ? <video src={asset.previewUrl} controls preload="none" aria-label={asset.name} /> : <audio src={asset.previewUrl} controls preload="none" aria-label={asset.name} />}
    </div> : null}
    <div className="app-reference-slot-label"><span>{asset?.badge ?? asset?.name ?? slotLabel}</span>{slotIndex < minCount && !asset ? <small>{copy.required}</small> : null}
      {asset?.status === 'uploading' ? <small role="status">{assetCopy.uploading}</small> : null}
      {asset?.status === 'error' ? <small role="alert">{asset.error ?? assetCopy.uploadFailed}</small> : null}
    </div>
    <div className="app-reference-slot-actions">
      <button type="button" disabled={disabled} title={disabledReason ?? accept} aria-label={`${asset ? copy.replace : copy.upload} · ${slotLabel}`} onClick={() => onSelectFileSlot(slotIndex)}>{asset ? copy.replace : copy.upload}</button>
      {canOpenLibrary ? <button type="button" disabled={disabled} title={disabledReason ?? undefined} aria-label={`${copy.library} · ${slotLabel}`} onClick={() => onOpenLibrarySlot(slotIndex)}>{copy.library}</button> : null}
      {asset ? <button type="button" aria-label={`${copy.remove} · ${slotLabel}`} onClick={() => onRemoveSlot(slotIndex)}>{copy.remove}</button> : null}
    </div>
    </>}
  </div>;
}
