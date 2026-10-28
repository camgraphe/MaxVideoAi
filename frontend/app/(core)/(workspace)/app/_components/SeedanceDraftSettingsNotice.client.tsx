'use client';

import type { SeedanceDraftControls } from '@/lib/seedance-workflow-contract';
import { supportsSeedanceDraftSetup } from '@/lib/seedance-draft-setup';
import { PROMPT_ASSISTANCE_PREVIEW } from '@/lib/prompt-assistance/preview-state';
import { getSeedanceDraftCopy } from '../_lib/seedance-draft-copy';
import { SeedanceDraftLocalPreviewMode } from './SeedanceDraftLocalPreviewMode.client';

// Display-only fallback: never passed to the quote, generation or resolution owners.
const unavailableControls: SeedanceDraftControls = {
  available: true, selected: false, phase: 'setup', pending: true,
  toggle: () => {}, generate: () => {},
};

export function SeedanceDraftSettingsNotice({ controls, setup, locale }: {
  controls?: SeedanceDraftControls;
  setup: Parameters<typeof supportsSeedanceDraftSetup>[0];
  locale: string;
}) {
  const active = controls?.available ? controls : undefined;
  if (!active && !(PROMPT_ASSISTANCE_PREVIEW && supportsSeedanceDraftSetup(setup))) return null;
  const copy = getSeedanceDraftCopy(locale);
  return <div className="mt-2 border-t border-hairline pt-2">
    <SeedanceDraftLocalPreviewMode preview={active ?? unavailableControls} locale={locale}
      unavailableReason={active ? undefined : copy.previewUnavailable} />
    {active ? <>
      <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
        {active.selected ? active.phase !== 'setup' ? copy.locked : copy.selected : copy.inactive}
      </p>
      {!active.live ? <p className="mt-1 text-[10px] text-text-muted">{copy.prototype}</p> : null}
    </> : null}
  </div>;
}
