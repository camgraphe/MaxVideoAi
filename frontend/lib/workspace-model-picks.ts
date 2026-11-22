import policy from '../config/agent-model-editorial-policy.json';

import guidance from '../config/agent-model-guidance.json';

export type PickerPriority = 'quality' | 'balanced' | 'budget';
type Workflow = 'create' | 'modify';
type Placement = { priority: PickerPriority; order: number; useCase?: string };
export type WorkspaceModelPicks = Partial<Record<Workflow, Placement>>;

/** Carry editorial order separately from catalog eligibility and executable preset prices. */
export function workspaceModelPicks(id: string): WorkspaceModelPicks {
  const uses = guidance.find((entry) => entry.engineId === id)?.bestFor ?? [];
  const picks: WorkspaceModelPicks = {};
  for (const workflow of ['create', 'modify'] as const) {
    for (const entry of policy.workspaceSelection[workflow]) {
      const order = entry.ids.indexOf(id);
      if (order >= 0) {
        const useCase =
          workflow === 'modify'
            ? uses.find((use) => use === 'source_edit')
            : entry.group === 'budget' && uses.includes('social_video')
              ? 'social_video'
              : uses[0];
        picks[workflow] = { priority: entry.group as PickerPriority, order, ...(useCase && { useCase }) };
      }
    }
  }
  return picks;
}
