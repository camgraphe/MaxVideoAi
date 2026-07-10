'use client';

import clsx from 'clsx';
import { AssetFieldTooltip } from '@/components/asset-dropzone/AssetFieldTooltip';
import type { AssetFieldGuidance as AssetFieldGuidanceCopy } from '@/components/asset-dropzone/asset-dropzone-types';

type AssetFieldGuidanceProps = {
  tooltipId: string;
  guidance?: AssetFieldGuidanceCopy | null;
  fullBleedSingleAsset: boolean;
};

export function AssetFieldGuidance({ tooltipId, guidance, fullBleedSingleAsset }: AssetFieldGuidanceProps) {
  if (!guidance?.label || fullBleedSingleAsset) return null;

  return (
    <div
      role="note"
      className={clsx(
        'flex items-start gap-1.5 text-[11px] leading-4 text-text-muted dark:text-white/52',
        guidance.tooltip && 'pr-1'
      )}
    >
      <span className="min-w-0">{guidance.label}</span>
      {guidance.tooltip ? (
        <AssetFieldTooltip tooltipId={tooltipId} details={[guidance.tooltip]} fullBleedSingleAsset={false} />
      ) : null}
    </div>
  );
}
