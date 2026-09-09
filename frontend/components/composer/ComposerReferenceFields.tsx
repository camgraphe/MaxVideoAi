'use client';
import { AssetDropzone } from '@/components/AssetDropzone';
import type { ComposerProps } from './composer-types';
type Props = Pick<ComposerProps, 'engine' | 'caps' | 'assets' | 'onAssetAdd' | 'onAssetRemove' | 'onNotice' | 'onOpenLibrary' | 'onAssetUrlSelect'> & {
  orderedAssetFields: ComposerProps['assetFields']; referenceWarning: string;
};
export function ComposerReferenceFields({ orderedAssetFields, engine, caps, assets, onAssetAdd, onAssetRemove, onNotice, onOpenLibrary, onAssetUrlSelect, referenceWarning }: Props) {
  return <>
              {orderedAssetFields.map(({ field, required, role, headerAction, guidance, disabled, disabledReason, disabledPresentation }) => (
                <AssetDropzone key={field.id} density="default"
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
              ))}
  </>;
}
