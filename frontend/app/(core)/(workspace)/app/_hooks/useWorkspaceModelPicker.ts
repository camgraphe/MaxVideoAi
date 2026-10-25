'use client';

import { useMemo, useState } from 'react';
import { runPreflight } from '@/lib/api';
import { modelEstimateKey } from '@/lib/model-picker-estimates';
import type { EngineCaps, Mode } from '@/types/engines';
import type { EnginePickerContext } from '@/components/ui/engine-select/model-picker-types';
import type { WorkspaceModelSetup } from '../_lib/workspace-model-candidate';
import { buildWorkspacePickerOptions } from '../_lib/workspace-model-picker';
import { resolveWorkspaceWorkflow } from '../_lib/workspace-workflow-projection';
import { getEngineModeLabel } from '../_lib/workspace-engine-helpers';

export function useWorkspaceModelPicker({ current, engines, locale, memberTier, accountId, accessToken, disabledEngineReasons }: {
  current: WorkspaceModelSetup | null; engines: EngineCaps[]; locale: string;
  memberTier: 'Member' | 'Plus' | 'Pro'; accountId: string | null; accessToken: string | null;
  disabledEngineReasons?: Record<string, string>;
}): EnginePickerContext {
  const [open, setOpen] = useState(false);
  const scope = `video:${accountId ?? 'guest'}:${accessToken ?? ''}`;
  const prepared = useMemo(() => open && current ? buildWorkspacePickerOptions({ current, engines, locale, memberTier, disabledEngineReasons }) : {},
    [open, current, engines, locale, memberTier, disabledEngineReasons]);
  const engine = engines.find(item => item.id === current?.form.engineId);
  const mode: Mode = current ? resolveWorkspaceWorkflow({ engine: engine ?? null, ...current }).submissionMode : 't2v';
  const options = useMemo(() => Object.fromEntries(Object.entries(prepared).map(([id, option]) => {
    const { request, iterations, ...presentation } = option;
    return [id, { ...presentation, estimate: request ? {
      key: modelEstimateKey([request, iterations]),
      load: async () => {
        const result = await runPreflight(request, { accessToken, signal: AbortSignal.timeout(15_000) });
        if (!result.ok || typeof result.total !== 'number') throw new Error('Estimate unavailable');
        return { amount: result.total * iterations, currency: result.currency ?? 'USD' };
      },
    } : undefined }];
  })), [prepared, accessToken]);
  return {
    // Full draft signature invalidates a confirmation when references/settings change externally.
    key: open ? modelEstimateKey([scope, current, memberTier]) : 'closed', scope, mode, options, onOpenChange: setOpen,
    label: current ? [getEngineModeLabel(engine?.id, mode, locale), current.form.resolution,
      Number.isFinite(current.form.durationSec) ? `${current.form.durationSec} s` : null,
      current.form.iterations > 1 ? `×${current.form.iterations}` : null].filter(Boolean).join(' · ') : '',
  };
}
