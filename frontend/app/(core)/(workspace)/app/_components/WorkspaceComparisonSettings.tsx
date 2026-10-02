'use client';

import type { ComponentProps } from 'react';
import { CoreSettingsBar } from '@/components/CoreSettingsBar';
import type { SeedanceDraftControls } from '@/lib/seedance-workflow-contract';

type Props = ComponentProps<typeof CoreSettingsBar> & {
  draftControls?: SeedanceDraftControls;
};

export function WorkspaceComparisonSettings({ draftControls, ...settings }: Props) {
  const selected = Boolean(draftControls?.available && draftControls.selected);
  const locked = selected && draftControls?.phase !== 'setup';
  const caps = selected
    ? { ...settings.caps, modes: settings.caps?.modes ?? [settings.mode], resolution: ['480p'], resolutionLocked: true }
    : settings.caps;
  return (
    <fieldset disabled={locked} className="min-w-0">
      <CoreSettingsBar {...settings} caps={caps}
        resolutionDisplayLabel={selected ? 'Draft 480p 🔒' : settings.resolutionDisplayLabel}
        onIterationsChange={selected ? undefined : settings.onIterationsChange} />
    </fieldset>
  );
}
