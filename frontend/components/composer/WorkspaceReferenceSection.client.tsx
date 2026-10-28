'use client';
import { getMediaExcerptLimits, getMediaExcerptImportMode } from '@/lib/video-excerpt';
import { VideoExcerptControl } from '@/components/media/VideoExcerptControl.client';
import {videoWorkflowNotices} from '@/lib/video-workflow-capabilities';
/* eslint-disable @next/next/no-img-element */

import { useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { AssetDropzone } from '@/components/AssetDropzone';
import { AppGlyph } from '@/components/app/AppGlyph';
import { WorkspaceComposerGlyph } from './WorkspaceComposerGlyph';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { getLocalizedAssetDropzoneCopy, normalizeUiLocale } from '@/lib/ltx-localization';
import type { ComposerProps } from './composer-types';
import { getReferenceCommandAvailability } from './workspace-reference-availability';
import { getWorkspaceFrameCommand } from './workspace-reference-commands';
import { WorkspaceReferenceInventory } from './WorkspaceReferenceInventory.client';
import { WorkspaceReferencePopup } from './WorkspaceReferencePopup.client';
import { resolveWorkspaceReferenceFieldTitle, workspaceReferenceCopy } from './workspace-reference-copy';
import { videoExtensionCopy } from '@/lib/video-extension';
import { getVideoWorkflowSourceField, videoModifyCopy, type VideoSourceWorkflow } from '@/lib/video-source-workflow';
import { ReferenceThumbnail } from './ReferenceThumbnail.client';
import { buildReferenceMentions, selectedReferenceLabel, referenceMentionCopy, type ReferenceMention } from './workspace-reference-mentions';

type Props = Pick<ComposerProps, 'engine' | 'caps' | 'assetFields' | 'assets' | 'onPrepareVideoExcerpt' | 'onVideoExcerptEditorChange' | 'onAssetAdd' | 'onAssetRemove' | 'onNotice' | 'onOpenLibrary' | 'onAssetUrlSelect' | 'referenceAuthAction' | 'subjectReferences'> & { referenceWarning: string; compact?: boolean; extensionWorkflow?: boolean; videoSourceWorkflow?: VideoSourceWorkflow; mentions?: ReferenceMention[]; onInsertMention?: (token: string) => void };

export function WorkspaceReferenceSection({ compact = false, assetFields, assets, engine, caps, onPrepareVideoExcerpt, onVideoExcerptEditorChange, onAssetAdd, onAssetRemove, onNotice, onOpenLibrary, onAssetUrlSelect, referenceWarning, referenceAuthAction, subjectReferences, extensionWorkflow = false, videoSourceWorkflow, mentions, onInsertMention }: Props) {
  const { locale } = useI18n();
  const copy = workspaceReferenceCopy(locale);
  const mentionCopy = referenceMentionCopy(locale);
  const referenceMentions = mentions ?? buildReferenceMentions(engine, assetFields, assets);
  const assetCopy = getLocalizedAssetDropzoneCopy(normalizeUiLocale(locale));
  const requiredId = useId();
  const restrictionId = useId();
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const [subjectEnabledFor, setSubjectEnabledFor] = useState<string | null>(null);
  // Presentation only: retained subjects always remain visible and are never cleared here.
  const subjectsVisible = Boolean(subjectReferences && (subjectReferences.hasSubjects || subjectEnabledFor === engine.id));
  const subjectPanelId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const commandRefs = useRef(new Map<string, HTMLButtonElement>());
  const excerptMode = videoSourceWorkflow ?? caps?.modes?.[0] ?? engine.modes[0];
  const canSelectRange = (fieldId: string) => Boolean(onPrepareVideoExcerpt && excerptMode && getMediaExcerptLimits(engine, excerptMode, fieldId));
  const sourceMode = videoSourceWorkflow ?? (extensionWorkflow ? 'extend' : undefined);
  const extensionCopy = sourceMode === 'extend' ? videoExtensionCopy(locale) : videoModifyCopy(locale, sourceMode === 'reframe');
  const sourceField = sourceMode ? getVideoWorkflowSourceField(engine.inputSchema, sourceMode) : null;
  const sourceEntry = assetFields.find(({ field }) => field.id === sourceField?.id);
  const sourceLabel = (sourceField?.maxCount ?? 1) > 1 ? videoExtensionCopy(locale).sources : extensionCopy.source;
  const sourceAvailability = getReferenceCommandAvailability(sourceEntry ? [sourceEntry] : [], assets);
  const sourceCount = sourceEntry ? (assets[sourceEntry.field.id] ?? []).filter(Boolean).length : 0;
  const requiredSourceMissing = Boolean(sourceEntry?.required && sourceCount < (sourceEntry.field.minCount ?? 1));
  const frames = assetFields.filter((entry) => getWorkspaceFrameCommand(entry, engine));
  const collections = assetFields.filter((entry) => !getWorkspaceFrameCommand(entry, engine) && entry !== sourceEntry);
  const orderedFrames = [...frames].sort((a, b) => Number(getWorkspaceFrameCommand(a, engine) === 'end') - Number(getWorkspaceFrameCommand(b, engine) === 'end'));
  const selected = assetFields.flatMap((entry) => (assets[entry.field.id] ?? []).flatMap((asset, slotIndex) => asset ? [{ entry, asset, slotIndex }] : []));
  const selectedCollections = compact ? selected : selected.filter(({ entry }) => !getWorkspaceFrameCommand(entry, engine));
  const visibleCollections = selectedCollections.filter(({ entry }, index) => selectedCollections.length <= 8 || index < 3 || canSelectRange(entry.field.id));
  const collectionRequired = (compact ? assetFields : collections).filter((entry) => entry.required && (assets[entry.field.id] ?? []).filter(Boolean).length < (entry.field.minCount ?? 1));
  const collectionAvailability = getReferenceCommandAvailability(collections, assets);
  const restrictionReasons = getReferenceCommandAvailability(assetFields, assets).reasons;
  if (assetFields.some((entry) => entry.disabled && !entry.disabledReason?.trim())) {
    restrictionReasons.push(copy.unavailable);
  }
  const activeFrame = frames.find((entry) => entry.field.id === activeCommand);
  const activeSource = sourceEntry?.field.id === activeCommand ? sourceEntry : null;
  const popupFields = activeCommand === 'all' ? assetFields : activeSource ? [activeSource] : activeCommand === 'collections' ? collections : activeFrame ? [activeFrame] : [];
  const popupTitle = activeSource ? sourceLabel : activeFrame ? copy[getWorkspaceFrameCommand(activeFrame, engine)!] : sourceMode && !collectionRequired.length ? extensionCopy.references : copy.title;
  const close = () => setActiveCommand(null);
  const open = (command: string, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    trigger.focus();
    setActiveCommand(command);
  };
  const removeAsset: NonNullable<Props['onAssetRemove']> = (field, slotIndex) => {
    // Move focus before the owned state update unmounts its Remove control.
    const popup = document.activeElement?.closest('.app-reference-popup');
    if (popup) popup.querySelector<HTMLButtonElement>('[data-modal-initial-focus="true"]')?.focus();
    else if (compact) triggerRef.current?.focus();
    else commandRefs.current.get(commandRefs.current.has(field.id) ? field.id : 'collections')?.focus();
    onAssetRemove?.(field, slotIndex);
  };
  const openLibrary: NonNullable<Props['onOpenLibrary']> = (field, slotIndex) => {
    // Finish popup cleanup first; Library captures a connected toolbar opener and unlocked body.
    flushSync(() => setActiveCommand(null));
    triggerRef.current?.focus();
    onOpenLibrary?.(field, slotIndex);
  };
  return <section className="app-workspace-references" data-compact-references={compact || undefined} data-extension-workflow={extensionWorkflow || undefined} aria-label={copy.title}>
    <div className="app-reference-commands" hidden={compact && !requiredSourceMissing}>
        {sourceEntry ? <button ref={(node) => { if (node) commandRefs.current.set(sourceEntry.field.id, node); else commandRefs.current.delete(sourceEntry.field.id); }}
          type="button" className={`app-reference-command${sourceAvailability.addDisabled ? ' is-add-disabled' : ''}`}
          data-reference-command={sourceEntry.field.id} data-add-disabled={sourceAvailability.addDisabled || undefined}
          aria-disabled={!sourceAvailability.canOpen || undefined} aria-haspopup="dialog" aria-expanded={Boolean(activeSource)}
          aria-describedby={sourceAvailability.addDisabled ? restrictionId : undefined}
          title={sourceEntry.disabledReason ?? sourceLabel}
          onClick={(event) => { if (sourceAvailability.canOpen) open(sourceEntry.field.id, event.currentTarget); }}>
          <span className="app-reference-command-media"><AppGlyph name="video" /></span>
          <span className="app-reference-command-label">{sourceLabel}</span>
          <small>{sourceCount ? `${sourceCount}/${sourceField?.maxCount ?? 1}` : copy.required}</small>
        </button> : null}
        {(compact ? [] : orderedFrames).map((entry) => {
          const command = getWorkspaceFrameCommand(entry, engine)!;
          const asset = (assets[entry.field.id] ?? []).find(Boolean);
          const availability = getReferenceCommandAvailability([entry], assets);
          return <button key={entry.field.id} ref={(node) => { if (node) commandRefs.current.set(entry.field.id, node); else commandRefs.current.delete(entry.field.id); }} type="button" className={`app-reference-command${availability.addDisabled ? ' is-add-disabled' : ''}`} data-reference-command={entry.field.id}
            data-add-disabled={availability.addDisabled || undefined} aria-disabled={!availability.canOpen || undefined}
            aria-label={asset ? `${copy[command]} · ${asset.name}` : undefined} aria-describedby={availability.addDisabled ? restrictionId : undefined} aria-haspopup="dialog" aria-expanded={activeCommand === entry.field.id} title={entry.disabled ? entry.disabledReason ?? copy.unavailable : copy[command]}
            onClick={(event) => { if (availability.canOpen) open(entry.field.id, event.currentTarget); }}>
            <span className="app-reference-command-media">
              {asset?.kind === 'image' ? <ReferenceThumbnail asset={asset} /> : <WorkspaceComposerGlyph name={command} />}
              {asset?.status === 'uploading' ? <small className="app-reference-command-status" role="status">…<span className="sr-only">{assetCopy.uploading}</span></small> : asset?.status === 'error' ? <small className="app-reference-command-status" role="alert">!<span className="sr-only">{asset.error ?? assetCopy.uploadFailed}</span></small> : null}
            </span><span className="app-reference-command-label">{copy[command]}</span>
            {!asset && entry.required ? <small>{copy.required}</small> : null}
            {!asset && !availability.addDisabled ? <WorkspaceComposerGlyph name="add" className="app-reference-command-add" /> : null}
          </button>;
        })}
        {!compact && (collections.length || subjectReferences) ? <button ref={(node) => { if (node) commandRefs.current.set('collections', node); else commandRefs.current.delete('collections'); }} type="button" className={`app-reference-command${collectionAvailability.addDisabled && !subjectReferences ? ' is-add-disabled' : ''}`} data-reference-command="collections"
          data-add-disabled={collectionAvailability.addDisabled && !subjectReferences || undefined} aria-disabled={!collectionAvailability.canOpen && !subjectReferences || undefined}
          aria-label={collectionAvailability.addDisabled && selectedCollections.length ? copy.manage : sourceMode && !collectionRequired.length ? extensionCopy.references : copy.add} aria-describedby={[collectionRequired.length ? requiredId : null, collections.some((entry) => entry.disabled) ? restrictionId : null].filter(Boolean).join(' ') || undefined} aria-haspopup="dialog" aria-expanded={activeCommand === 'collections'} onClick={(event) => { if (collectionAvailability.canOpen || subjectReferences) open('collections', event.currentTarget); }}>
          <span className="app-reference-command-media"><WorkspaceComposerGlyph name="reference" /></span>
          <span className="app-reference-command-label">{sourceMode && !collectionRequired.length ? extensionCopy.references : copy.title}</span>
          {collectionAvailability.addDisabled && selectedCollections.length ? <span className="app-reference-command-count" aria-hidden="true">{selectedCollections.length}</span>
            : !collectionAvailability.addDisabled || subjectReferences ? <WorkspaceComposerGlyph name="add" className="app-reference-command-add" /> : null}
        </button> : null}
        {!compact ? assetFields.map((entry) => entry.headerAction ? <span key={entry.field.id}>{entry.headerAction}</span> : null) : null}
    </div>
    {compact ? <button type="button" className="app-reference-add-compact" ref={triggerRef} aria-label={copy.add} aria-haspopup="dialog" aria-expanded={activeCommand === 'all'} onClick={event => open('all', event.currentTarget)}><WorkspaceComposerGlyph name="add" /><span>{copy.title}</span></button> : null}
    {videoWorkflowNotices(engine.id,sourceMode ?? '',locale).map(note=><p key={note.code} role="note" className="text-xs text-text-muted">{note.message}</p>)}
    {restrictionReasons.length ? <div id={restrictionId} className="app-reference-restrictions" aria-live="polite">
      {restrictionReasons.map((reason) => <p key={reason}>{referenceAuthAction?.label === reason
        ? <a className="app-reference-signin" href={referenceAuthAction.href}>{reason}</a>
        : reason}</p>)}
    </div> : null}
    {collectionRequired.length ? <p id={requiredId} className="app-reference-required">{copy.required} · {collectionRequired.map(({ field, role }) => resolveWorkspaceReferenceFieldTitle(field, role ?? 'generic', locale) || copy.kinds[field.type === 'audio' ? 'audio' : field.type === 'video' ? 'video' : 'image']).join(', ')}</p> : null}
    {selectedCollections.length ? <div className="app-reference-selected-summary">
      {visibleCollections.map(({ entry, asset, slotIndex }) => {
        const mention = referenceMentions.find(item => item.fieldId === entry.field.id && item.slotIndex === slotIndex);
        const sequence = mention ? Number(mention.token.match(/\d+/)?.[0] ?? 1) + (mention.token.startsWith('<IMAGE_') ? 1 : 0)
          : (assets[entry.field.id] ?? []).slice(0, slotIndex + 1).filter(Boolean).length;
        const frameRole = getWorkspaceFrameCommand(entry, engine);
        const label = compact && frameRole ? (locale === 'en' ? frameRole === 'start' ? 'Start image' : 'End image' : copy[frameRole]) : selectedReferenceLabel(engine, entry.field, asset.kind, sequence, locale, entry === sourceEntry);
        const canMention = Boolean(mention && onInsertMention && asset.status !== 'uploading' && asset.status !== 'error');
        return <div className="app-reference-selected-item" key={`${entry.field.id}-${slotIndex}`} data-reference-label={label}>
        <button className="app-reference-selected-manage" type="button" title={compact ? undefined : `${label} · ${asset.name}`}
          onClick={() => {
            const command = compact ? 'all' : entry === sourceEntry ? entry.field.id : 'collections';
            const trigger = compact ? triggerRef.current : commandRefs.current.get(command);
            if (trigger) open(command, trigger);
          }} aria-label={compact ? `${copy.manage} · ${label}` : `${copy.manage} · ${label} · ${asset.name}`}>
          <ReferenceThumbnail asset={asset} />
          {!canMention ? <span>{label}</span> : null}
        </button>
        {canMention && mention ? <button className="app-reference-selected-mention" type="button" title={mentionCopy.insert(mention.token)} aria-label={mentionCopy.insert(mention.token)}
          onClick={() => onInsertMention?.(mention.token)}><span>{label}</span>{!compact ? <small>{mention.token}</small> : null}</button> : null}
        {typeof asset.durationSec === 'number' ? <small className="app-reference-selected-duration">{new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(asset.durationSec)} s</small> : null}
        {asset.status === 'uploading' ? <small role="status">{assetCopy.uploading}</small> : asset.status === 'error' ? <small role="alert">{asset.error ?? assetCopy.uploadFailed}</small> : null}
        {excerptMode && canSelectRange(entry.field.id) && (asset.status === 'ready' || asset.excerptEditing) ? <VideoExcerptControl
          key={`${engine.id}:${excerptMode}:${entry.field.id}:${slotIndex}`} engine={engine} field={entry.field} index={slotIndex} asset={asset} mode={excerptMode} locale={locale}
          onPrepareVideoExcerpt={onPrepareVideoExcerpt} onVideoExcerptEditorChange={onVideoExcerptEditorChange} /> : null}
        {onAssetRemove ? <button className="app-reference-selected-remove" type="button" onClick={() => removeAsset(entry.field, slotIndex)} aria-label={`${copy.remove} · ${label} · ${asset.name}`} title={`${copy.remove} · ${label}`}>
          <span aria-hidden="true">×</span>
        </button> : null}
      </div>; })}
      {selectedCollections.length > visibleCollections.length ? <span>+{selectedCollections.length - visibleCollections.length}</span> : null}
    </div> : null}
    {engine.activeVideoOperation === 'h3-recast' && selectedCollections.some(({ entry }) => entry.field.id === 'reference_image_urls') ? <p className="app-reference-required" role="note">{mentionCopy.portraits}</p> : null}
    {subjectsVisible ? <div id={subjectPanelId} data-subject-references>{subjectReferences?.content}</div> : null}
    {popupFields.length || (activeCommand === 'collections' || activeCommand === 'all') && subjectReferences ? <WorkspaceReferencePopup singleRole={Boolean(activeFrame || activeSource)} title={popupTitle} closeLabel={copy.close} onClose={close}>
      <WorkspaceReferenceInventory fields={popupFields} assets={assets} locale={locale} renderField={(entry) => <AssetDropzone key={entry.field.id} {...entry} headerAction={compact ? entry.headerAction : undefined}
        allowVideoExcerptImport={Boolean(onPrepareVideoExcerpt && getMediaExcerptImportMode(engine, excerptMode, entry.field.id))}
        density="workspace" engine={engine} caps={caps}
        assets={assets[entry.field.id] ?? []} onSelect={onAssetAdd} onRemove={removeAsset}
        onError={onNotice} onOpenLibrary={onOpenLibrary ? openLibrary : undefined} onUrlSelect={onAssetUrlSelect} referenceWarning={referenceWarning} />} />
      {(activeCommand === 'collections' || activeCommand === 'all') && subjectReferences ? <div className="mt-3 space-y-1 border-t border-border pt-3"><button type="button" className="app-reference-command"
        aria-describedby={`${subjectPanelId}-description`} aria-expanded={subjectsVisible} aria-controls={subjectsVisible ? subjectPanelId : undefined}
        onClick={() => { setSubjectEnabledFor(engine.id); close(); }}>
        <span className="app-reference-command-media"><AppGlyph name="reference" /></span>
        <span className="app-reference-command-label">{copy.subjects}</span>
        <span aria-hidden="true">{subjectsVisible ? '✓' : '+'}</span>
      </button>
      <p id={`${subjectPanelId}-description`} className="text-xs text-text-muted">{copy.subjectsHint}</p>
      </div> : null}
    </WorkspaceReferencePopup> : null}
  </section>;
}
