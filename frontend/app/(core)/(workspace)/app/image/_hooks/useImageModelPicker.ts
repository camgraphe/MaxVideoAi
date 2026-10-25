'use client';
import { useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { authFetch } from '@/lib/authFetch';
import { modelEstimateKey } from '@/lib/model-picker-estimates';
import type { EngineCaps } from '@/types/engines';
import type { EnginePickerContext } from '@/components/ui/engine-select/model-picker-types';
import type { PricingEstimateResponse } from '../_lib/image-workspace-types';
import { prepareImagePickerOption, type ImagePickerSettings } from '../_lib/image-model-picker';

type Prepared = ReturnType<typeof prepareImagePickerOption>['settings'];
export function useImageModelPicker({ engines, engineId, accountId, settings, apply }: {
  engines: EngineCaps[]; engineId: string; accountId: string | null; settings: ImagePickerSettings;
  apply: (id: string, settings: Prepared) => void;
}) {
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const prepared = useMemo(() => open ? Object.fromEntries(engines.map(engine => [engine.id, prepareImagePickerOption(engine, settings, locale)])) : {}, [engines, settings, locale, open]);
  const options = Object.fromEntries(Object.entries(prepared).map(([id, option]) => [id, {
    summary: option.summary, changes: option.changes, disabledReason: option.disabledReason, priceUnavailableReason: option.priceUnavailableReason,
    estimate: option.disabledReason || option.priceUnavailableReason ? undefined : {
      key: modelEstimateKey(option.request), load: async () => {
        const response = await authFetch('/api/images/estimate', { method: 'POST', signal: AbortSignal.timeout(15_000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(option.request) });
        const result = await response.json() as PricingEstimateResponse;
        if (!response.ok || !result.ok) throw new Error('Estimate unavailable');
        return { amount: result.pricing.totalCents, currency: result.pricing.currency };
      },
    },
  }]));
  const context: EnginePickerContext = { key: modelEstimateKey([accountId, engineId, settings]), scope: `image:${accountId ?? 'guest'}`,
    label: [settings.mode === 'i2i' ? (locale === 'fr' ? 'Modifier une image' : locale === 'es' ? 'Editar imagen' : 'Edit image') : 'Image', settings.resolution, settings.aspectRatio, `×${settings.numImages}`].filter(Boolean).join(' · '),
    mode: settings.mode, options, onOpenChange: setOpen };
  return { context, select: (id: string) => { const next = prepared[id]; if (next && !next.disabledReason) apply(id, next.settings); } };
}
