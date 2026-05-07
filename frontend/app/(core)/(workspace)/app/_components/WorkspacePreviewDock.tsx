'use client';

import type { Dispatch, SetStateAction } from 'react';
import dynamic from 'next/dynamic';
import { EngineSettingsBar } from '@/components/EngineSettingsBar';
import type { CompositePreviewDockProps } from '@/components/groups/CompositePreviewDock';
import type { EngineCaps, Mode } from '@/types/engines';
import type { GroupSummary } from '@/types/groups';
import type { VideoGroup } from '@/types/video-groups';
import { getEngineModeLabel } from '../_lib/workspace-engine-helpers';
import { CompositePreviewDockSkeleton } from './WorkspaceBootSkeletons';

const CompositePreviewDock = dynamic<CompositePreviewDockProps>(
  () => import('@/components/groups/CompositePreviewDock').then((mod) => mod.CompositePreviewDock),
  {
    loading: () => <CompositePreviewDockSkeleton />,
  }
);

export type WorkspaceViewerTarget =
  | { kind: 'pending'; id: string }
  | { kind: 'summary'; summary: GroupSummary }
  | { kind: 'group'; group: VideoGroup }
  | null;

export function WorkspacePreviewDock({
  group,
  isLoading,
  autoPlayRequestId,
  sharedPrompt,
  hasSharedVideoSettings,
  onCopySharedPrompt,
  guidedNavigation,
  engines,
  engineId,
  selectedEngineId,
  activeMode,
  engineModeOptions,
  modeLabelLocale,
  onEngineChange,
  onModeChange,
  renderGroups,
  compositeOverrideSummary,
  setViewerTarget,
}: {
  group: VideoGroup | null;
  isLoading: boolean;
  autoPlayRequestId: CompositePreviewDockProps['autoPlayRequestId'];
  sharedPrompt: string | null;
  hasSharedVideoSettings: boolean;
  onCopySharedPrompt: () => void;
  guidedNavigation: CompositePreviewDockProps['guidedNavigation'];
  engines: EngineCaps[];
  engineId: string;
  selectedEngineId?: string | null;
  activeMode: Mode;
  engineModeOptions: Mode[] | undefined;
  modeLabelLocale: string;
  onEngineChange: (engineId: string) => void;
  onModeChange: (mode: Mode) => void;
  renderGroups: ReadonlyMap<string, unknown>;
  compositeOverrideSummary: GroupSummary | null;
  setViewerTarget: Dispatch<SetStateAction<WorkspaceViewerTarget>>;
}) {
  return (
    <CompositePreviewDock
      group={group}
      isLoading={isLoading}
      autoPlayRequestId={autoPlayRequestId}
      copyPrompt={hasSharedVideoSettings ? null : sharedPrompt}
      onCopyPrompt={hasSharedVideoSettings ? undefined : sharedPrompt ? onCopySharedPrompt : undefined}
      showTitle={false}
      guidedNavigation={guidedNavigation}
      engineSettings={
        <EngineSettingsBar
          engines={engines}
          engineId={engineId}
          onEngineChange={onEngineChange}
          mode={activeMode}
          onModeChange={onModeChange}
          modeOptions={engineModeOptions}
          modeLabel={getEngineModeLabel(selectedEngineId, activeMode, modeLabelLocale)}
          showModeBadge={false}
        />
      }
      onOpenModal={(nextGroup) => {
        if (!nextGroup) return;
        if (renderGroups.has(nextGroup.id)) {
          setViewerTarget({ kind: 'pending', id: nextGroup.id });
          return;
        }
        if (compositeOverrideSummary && compositeOverrideSummary.id === nextGroup.id) {
          setViewerTarget({ kind: 'summary', summary: compositeOverrideSummary });
          return;
        }
        setViewerTarget({ kind: 'group', group: nextGroup });
      }}
    />
  );
}
