'use client';
import { Fragment } from 'react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { VideoExcerptControl } from '@/components/media/VideoExcerptControl.client';
import { getVideoWorkflowSourceField, type VideoSourceWorkflow } from '@/lib/video-source-workflow';
import { AssetDropzone } from '@/components/AssetDropzone';
import type { ComposerProps } from './composer-types';
type Props = Pick<ComposerProps, 'engine' | 'caps' | 'assets' | 'onPrepareVideoExcerpt' | 'onVideoExcerptEditorChange' | 'onAssetAdd' | 'onAssetRemove' | 'onNotice' | 'onOpenLibrary' | 'onAssetUrlSelect'> & {
  videoSourceWorkflow?: VideoSourceWorkflow;
  orderedAssetFields: ComposerProps['assetFields']; referenceWarning: string;
};
export function ComposerReferenceFields({ videoSourceWorkflow, onPrepareVideoExcerpt, onVideoExcerptEditorChange, orderedAssetFields, engine, caps, assets, onAssetAdd, onAssetRemove, onNotice, onOpenLibrary, onAssetUrlSelect, referenceWarning }: Props) {
  const { locale } = useI18n();
  const sourceField = videoSourceWorkflow ? getVideoWorkflowSourceField(engine.inputSchema, videoSourceWorkflow) : null;
  return <>
              {orderedAssetFields.map(({ field, required, role, headerAction, guidance, disabled, disabledReason, disabledPresentation }) => (
                <Fragment key={field.id}><AssetDropzone density="default"
                  allowVideoExcerptImport={Boolean(onPrepareVideoExcerpt && sourceField?.id === field.id)}
                  engine={engine}
                  caps={caps}
                  field={field}
                  required={required}
                  isSoloField={orderedAssetFields.length === 1}
                  className={field.maxCount && field.maxCount > 1 ? 'md:col-span-2' : undefined}
                  role={role}
                  assets={assets[field.id] ?? []}
                  headerAction={headerAction}
                  guidance={guidance}
                  disabled={disabled}
                  disabledReason={disabledReason} disabledPresentation={disabledPresentation}
                  onSelect={onAssetAdd}
                  onRemove={onAssetRemove}
                  onError={onNotice}
                  onOpenLibrary={onOpenLibrary}
                  onUrlSelect={onAssetUrlSelect}
                  referenceWarning={referenceWarning}
                />
                {videoSourceWorkflow && sourceField?.id === field.id ? (assets[field.id] ?? []).map((asset, index) => asset && (asset.status === 'ready' || asset.excerptEditing) ? <VideoExcerptControl
                  key={`${engine.id}:${videoSourceWorkflow}:${field.id}:${index}`} engine={engine} field={field} index={index} asset={asset} mode={videoSourceWorkflow} locale={locale}
                  onPrepareVideoExcerpt={onPrepareVideoExcerpt} onVideoExcerptEditorChange={onVideoExcerptEditorChange} /> : null) : null}</Fragment>
              ))}
  </>;
}
