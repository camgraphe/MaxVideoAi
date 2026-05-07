'use client';

import type { ChangeEvent, ComponentProps, FormEvent } from 'react';
import dynamic from 'next/dynamic';
import type { AssetLibraryModalProps } from '@/components/library/AssetLibraryModal';
import type { EngineInputField } from '@/types/engines';
import type { VideoGroup } from '@/types/video-groups';
import type { TopUpModalState } from '../_hooks/useWorkspacePricingGate';
import type {
  AssetLibraryKind,
  AssetLibrarySource,
  AssetPickerTarget,
  UserAsset,
} from '../_lib/workspace-assets';
import { WorkspaceAuthGateModal } from './WorkspaceAuthGateModal';
import { WorkspaceTopUpModal } from './WorkspaceTopUpModal';

const AssetLibraryModal = dynamic<AssetLibraryModalProps>(
  () => import('@/components/library/AssetLibraryModal').then((mod) => mod.AssetLibraryModal),
  { ssr: false }
);

const GroupViewerModal = dynamic(
  () => import('@/components/groups/GroupViewerModal').then((mod) => mod.GroupViewerModal),
  { ssr: false }
);

export function WorkspaceRuntimeModals({
  viewerGroup,
  onCloseViewer,
  onRefreshJob,
  topUpModal,
  topUpCopy,
  currency,
  topUpAmount,
  isTopUpLoading,
  topUpError,
  onCloseTopUp,
  onTopUpSubmit,
  onSelectPresetAmount,
  onCustomAmountChange,
  authModalOpen,
  authGateCopy,
  loginRedirectTarget,
  onCloseAuthModal,
  assetPickerTarget,
  assetLibraryKind,
  assetLibrarySource,
  visibleAssetLibrary,
  isAssetLibraryLoading,
  assetLibraryError,
  assetDeletePendingId,
  fieldFallbackLabel,
  onAssetLibrarySourceChange,
  onCloseAssetLibrary,
  onRefreshAssets,
  onSelectFieldAsset,
  onSelectKlingAsset,
  onDeleteAsset,
}: {
  viewerGroup: VideoGroup | null;
  onCloseViewer: () => void;
  onRefreshJob: (jobId: string) => Promise<void>;
  topUpModal: TopUpModalState;
  topUpCopy: ComponentProps<typeof WorkspaceTopUpModal>['copy'];
  currency: string;
  topUpAmount: number;
  isTopUpLoading: boolean;
  topUpError: string | null;
  onCloseTopUp: () => void;
  onTopUpSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSelectPresetAmount: (value: number) => void;
  onCustomAmountChange: (event: ChangeEvent<HTMLInputElement>) => void;
  authModalOpen: boolean;
  authGateCopy: ComponentProps<typeof WorkspaceAuthGateModal>['copy'];
  loginRedirectTarget: string;
  onCloseAuthModal: () => void;
  assetPickerTarget: AssetPickerTarget | null;
  assetLibraryKind: AssetLibraryKind;
  assetLibrarySource: AssetLibrarySource;
  visibleAssetLibrary: UserAsset[];
  isAssetLibraryLoading: boolean;
  assetLibraryError: string | null;
  assetDeletePendingId: string | null;
  fieldFallbackLabel: string;
  onAssetLibrarySourceChange: (source: AssetLibrarySource) => void;
  onCloseAssetLibrary: () => void;
  onRefreshAssets: (options: { source: AssetLibrarySource; kind: AssetLibraryKind }) => void | Promise<void>;
  onSelectFieldAsset: (field: EngineInputField, asset: UserAsset, slotIndex?: number) => void | Promise<void>;
  onSelectKlingAsset: (target: Extract<AssetPickerTarget, { kind: 'kling' }>, asset: UserAsset) => void;
  onDeleteAsset: (asset: UserAsset) => void | Promise<void>;
}) {
  return (
    <>
      {viewerGroup ? (
        <GroupViewerModal
          group={viewerGroup}
          onClose={onCloseViewer}
          onRefreshJob={onRefreshJob}
        />
      ) : null}
      {topUpModal ? (
        <WorkspaceTopUpModal
          modal={topUpModal}
          copy={topUpCopy}
          currency={currency}
          topUpAmount={topUpAmount}
          isTopUpLoading={isTopUpLoading}
          topUpError={topUpError}
          onClose={onCloseTopUp}
          onSubmit={onTopUpSubmit}
          onSelectPresetAmount={onSelectPresetAmount}
          onCustomAmountChange={onCustomAmountChange}
        />
      ) : null}
      {authModalOpen ? (
        <WorkspaceAuthGateModal
          copy={authGateCopy}
          loginRedirectTarget={loginRedirectTarget}
          onClose={onCloseAuthModal}
        />
      ) : null}
      {assetPickerTarget ? (
        <AssetLibraryModal
          fieldLabel={
            assetPickerTarget.kind === 'field'
              ? assetPickerTarget.field.label ?? fieldFallbackLabel
              : assetPickerTarget.slot === 'frontal'
                ? 'Kling frontal image'
                : `Kling reference ${typeof assetPickerTarget.slotIndex === 'number' ? assetPickerTarget.slotIndex + 1 : ''}`.trim()
          }
          assetType={assetLibraryKind}
          assets={visibleAssetLibrary}
          isLoading={isAssetLibraryLoading}
          error={assetLibraryError}
          source={assetLibrarySource}
          onSourceChange={onAssetLibrarySourceChange}
          onClose={onCloseAssetLibrary}
          onRefresh={(sourceOverride) =>
            onRefreshAssets({ source: sourceOverride ?? assetLibrarySource, kind: assetLibraryKind })
          }
          onSelect={(asset) => {
            if (assetPickerTarget.kind === 'field') {
              void onSelectFieldAsset(assetPickerTarget.field, asset, assetPickerTarget.slotIndex);
              return;
            }
            onSelectKlingAsset(assetPickerTarget, asset);
          }}
          onDelete={onDeleteAsset}
          deletingAssetId={assetDeletePendingId}
        />
      ) : null}
    </>
  );
}
