import { getModelFamilyDefinition } from '@/config/model-families';
import { getFalEngineById } from '@/config/falEngines';
import { getEngineSelectFamilyRank } from '@/lib/engine-family-priority';
import type { EngineAvailability } from '@/types/engines';
import type {
  WorkspaceEdgeKind,
  WorkspaceModelCapability,
  WorkspaceShotSettings,
} from '../workspace-types';
import {
  getWorkspaceBlockCompatibleCapabilities,
  getWorkspaceBlockIntentCapabilities,
} from './workspace-block-capability-policy';
import { resolveWorkspaceEngineOperationalEligibility } from './workspace-engine-availability';

export type WorkspaceEnginePickerItem = {
  id: string;
  label: string;
  provider: string;
  brandId?: string;
  versionLabel?: string;
  availability: EngineAvailability;
  searchText: string;
  selected: boolean;
  disabled: boolean;
  disabledReason?: string;
  capability: WorkspaceModelCapability;
};

export type WorkspaceEnginePickerGroup = {
  id: string;
  label: string;
  brandId?: string;
  rank: number;
  items: WorkspaceEnginePickerItem[];
};

export function workspaceEnginePickerTriggerLabel({
  groups,
  selectedModelId,
  openLabel,
  unavailableLabel,
}: {
  groups: WorkspaceEnginePickerGroup[];
  selectedModelId: string;
  openLabel: string;
  unavailableLabel: string;
}): string {
  const selectedItem = groups
    .flatMap((group) => group.items)
    .find((item) => item.id === selectedModelId);
  if (selectedItem) return selectedItem.label;
  return groups.some((group) => group.items.length > 0) ? openLabel : unavailableLabel;
}

export function buildWorkspaceEnginePickerGroups({
  settings,
  capabilities,
  connectedInputs,
  selectedModelId,
  incompatibleReason,
  pausedReason,
  waitlistReason,
}: {
  settings: WorkspaceShotSettings;
  capabilities: WorkspaceModelCapability[];
  connectedInputs: WorkspaceEdgeKind[];
  selectedModelId: string;
  incompatibleReason: string;
  pausedReason: string;
  waitlistReason: string;
}): WorkspaceEnginePickerGroup[] {
  const intentCandidates = getWorkspaceBlockIntentCapabilities({ settings, capabilities });
  const compatibleIds = new Set(getWorkspaceBlockCompatibleCapabilities({
    settings,
    capabilities: intentCandidates,
    connectedInputs,
  }).map((capability) => capability.id));
  const groups = new Map<string, WorkspaceEnginePickerGroup>();

  for (const capability of intentCandidates) {
    const entry = getFalEngineById(capability.id);
    const familyId = entry?.family ?? entry?.brandId ?? capability.provider.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
    const family = getModelFamilyDefinition(familyId);
    const group = groups.get(familyId) ?? {
      id: familyId,
      label: family?.label ?? entry?.provider ?? capability.provider,
      brandId: family?.brandId ?? entry?.brandId,
      rank: getEngineSelectFamilyRank(entry),
      items: [],
    };
    group.rank = Math.min(group.rank, getEngineSelectFamilyRank(entry));
    const operationalEligibility = resolveWorkspaceEngineOperationalEligibility(capability);
    const availability = operationalEligibility.availability ?? 'paused';
    const availabilityReason = operationalEligibility.unavailableReason === 'paused'
      ? pausedReason
      : operationalEligibility.unavailableReason === 'waitlist'
        ? waitlistReason
        : undefined;
    const disabledReason = availabilityReason ?? (!compatibleIds.has(capability.id) ? incompatibleReason : undefined);
    group.items.push({
      id: capability.id,
      label: entry?.marketingName ?? capability.label,
      provider: entry?.provider ?? capability.provider,
      brandId: entry?.brandId,
      versionLabel: entry?.versionLabel,
      availability,
      searchText: [capability.id, capability.label, entry?.marketingName, entry?.provider, family?.label]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
      selected: capability.id === selectedModelId,
      disabled: Boolean(disabledReason),
      disabledReason,
      capability,
    });
    groups.set(familyId, group);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      items: group.items.sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label));
}
