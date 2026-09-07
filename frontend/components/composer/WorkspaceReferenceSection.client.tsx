'use client';
/* eslint-disable @next/next/no-img-element */

import { useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { AssetDropzone } from '@/components/AssetDropzone';
import { AppGlyph } from '@/components/app/AppGlyph';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { getLocalizedAssetDropzoneCopy, normalizeUiLocale } from '@/lib/ltx-localization';
import type { ComposerProps } from './composer-types';
import { getWorkspaceFrameCommand } from './workspace-reference-commands';
import { WorkspaceReferencePopup } from './WorkspaceReferencePopup.client';
import { resolveWorkspaceReferenceFieldTitle, workspaceReferenceCopy } from './workspace-reference-copy';

type Props = Pick<ComposerProps, 'engine' | 'caps' | 'assetFields' | 'assets' | 'onAssetAdd' | 'onAssetRemove' | 'onNotice' | 'onOpenLibrary' | 'onAssetUrlSelect'> & { referenceWarning: string };

export function WorkspaceReferenceSection({ assetFields, assets, engine, caps, onAssetAdd, onAssetRemove, onNotice, onOpenLibrary, onAssetUrlSelect, referenceWarning }: Props) {
  const { locale } = useI18n();
  const copy = workspaceReferenceCopy(locale);
  const assetCopy = getLocalizedAssetDropzoneCopy(normalizeUiLocale(locale));
  const requiredId = useId();
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const commandRefs = useRef(new Map<string, HTMLButtonElement>());
  const frames = assetFields.filter((entry) => getWorkspaceFrameCommand(entry, engine));
  const collections = assetFields.filter((entry) => !getWorkspaceFrameCommand(entry, engine));
  const orderedFrames = [...frames].sort((a, b) => Number(getWorkspaceFrameCommand(a, engine) === 'end') - Number(getWorkspaceFrameCommand(b, engine) === 'end'));
  const selected = assetFields.flatMap((entry) => (assets[entry.field.id] ?? []).flatMap((asset, slotIndex) => asset ? [{ entry, asset, slotIndex }] : []));
  const selectedCollections = selected.filter(({ entry }) => !getWorkspaceFrameCommand(entry, engine));
  const collectionRequired = collections.filter((entry) => entry.required && (assets[entry.field.id] ?? []).filter(Boolean).length < (entry.field.minCount ?? 1));
  const activeFrame = frames.find((entry) => entry.field.id === activeCommand);
  const popupFields = activeCommand === 'collections' ? collections : activeFrame ? [activeFrame] : [];
  const popupTitle = activeFrame ? copy[getWorkspaceFrameCommand(activeFrame, engine)!] : copy.title;
  const close = () => setActiveCommand(null);
  const open = (command: string, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    trigger.focus();
    setActiveCommand(command);
  };
  const removeAsset: NonNullable<Props['onAssetRemove']> = (field, slotIndex) => {
    // Move focus before the owned state update unmounts its Remove control.
    const popup = document.activeElement?.closest('.app-reference-popup');
    popup?.querySelector<HTMLButtonElement>('[data-modal-initial-focus="true"]')?.focus();
    onAssetRemove?.(field, slotIndex);
  };
  const openLibrary: NonNullable<Props['onOpenLibrary']> = (field, slotIndex) => {
    // Finish popup cleanup first; Library captures a connected toolbar opener and unlocked body.
    flushSync(() => setActiveCommand(null));
    triggerRef.current?.focus();
    onOpenLibrary?.(field, slotIndex);
  };
  return <section className="app-workspace-references" aria-label={copy.title}>
    <div className="app-reference-heading">
      <span><AppGlyph name="reference" />{copy.title}{selected.length ? ` · ${selected.length}` : ''}</span>
      <div className="app-reference-commands">
        {orderedFrames.map((entry) => {
          const command = getWorkspaceFrameCommand(entry, engine)!;
          const asset = (assets[entry.field.id] ?? []).find(Boolean);
          return <button key={entry.field.id} ref={(node) => { if (node) commandRefs.current.set(entry.field.id, node); else commandRefs.current.delete(entry.field.id); }} type="button" className="app-reference-command" data-reference-command={entry.field.id}
            aria-label={asset ? `${copy[command]} · ${asset.name}` : undefined} aria-haspopup="dialog" aria-expanded={activeCommand === entry.field.id} title={entry.disabledReason ?? entry.field.label}
            onClick={(event) => open(entry.field.id, event.currentTarget)}>
            <span className="app-reference-command-media">
              {asset?.kind === 'image' ? <img src={asset.previewUrl} alt="" loading="lazy" /> : <AppGlyph name={command} />}
              {asset?.status === 'uploading' ? <small className="app-reference-command-status" role="status">…<span className="sr-only">{assetCopy.uploading}</span></small> : asset?.status === 'error' ? <small className="app-reference-command-status" role="alert">!<span className="sr-only">{asset.error ?? assetCopy.uploadFailed}</span></small> : null}
            </span><span>{copy[command]}</span>
            {!asset && entry.required ? <small>{copy.required}</small> : null}
          </button>;
        })}
        {collections.length ? <button ref={(node) => { if (node) commandRefs.current.set('collections', node); else commandRefs.current.delete('collections'); }} type="button" className="app-reference-command" data-reference-command="collections"
          aria-label={copy.add} aria-describedby={collectionRequired.length ? requiredId : undefined} aria-haspopup="dialog" aria-expanded={activeCommand === 'collections'} onClick={(event) => open('collections', event.currentTarget)}>
          <span>{copy.title}</span><span aria-hidden="true">+</span>
        </button> : null}
        {assetFields.map((entry) => entry.headerAction ? <span key={entry.field.id}>{entry.headerAction}</span> : null)}
      </div>
    </div>
    {collectionRequired.length ? <p id={requiredId} className="app-reference-required">{copy.required} · {collectionRequired.map(({ field, role }) => resolveWorkspaceReferenceFieldTitle(field, role ?? 'generic', locale) || copy.kinds[field.type === 'audio' ? 'audio' : field.type === 'video' ? 'video' : 'image']).join(', ')}</p> : null}
    {selectedCollections.length ? <div className="app-reference-selected-summary">
      {selectedCollections.slice(0, 3).map(({ entry, asset, slotIndex }) => <button key={`${entry.field.id}-${slotIndex}`} type="button"
        onClick={() => {
          const command = 'collections';
          const trigger = commandRefs.current.get(command);
          if (trigger) open(command, trigger);
        }} aria-label={`${copy.manage} · ${asset.name}`}>
        {asset.kind === 'image' ? <img src={asset.previewUrl} alt="" loading="lazy" /> : <AppGlyph name={asset.kind} />}
        <span>{asset.name}</span>{asset.status === 'uploading' ? <small role="status">…</small> : asset.status === 'error' ? <small role="alert">{asset.error ?? '!'}</small> : null}
      </button>)}
      {selectedCollections.length > 3 ? <span>+{selectedCollections.length - 3}</span> : null}
    </div> : null}
    {popupFields.length ? <WorkspaceReferencePopup title={popupTitle} closeLabel={copy.close} onClose={close}>
      {popupFields.map((entry) => <AssetDropzone key={entry.field.id} {...entry} headerAction={undefined}
        density="workspace" engine={engine} caps={caps}
        assets={assets[entry.field.id] ?? []} onSelect={onAssetAdd} onRemove={removeAsset}
        onError={onNotice} onOpenLibrary={onOpenLibrary ? openLibrary : undefined} onUrlSelect={onAssetUrlSelect} referenceWarning={referenceWarning} />)}
    </WorkspaceReferencePopup> : null}
  </section>;
}
