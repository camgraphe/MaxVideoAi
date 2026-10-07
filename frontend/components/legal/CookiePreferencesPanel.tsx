'use client';

import type { ConsentCategory } from '@/lib/consent';
import { Button } from '@/components/ui/Button';
import type { CookieBannerCopy } from '@/components/legal/cookie-banner-copy';
import type { FetchState } from '@/components/legal/cookie-banner-client';

type CookiePreferencesPanelProps = {
  adsLabelId: string;
  analyticsLabelId: string;
  copy: CookieBannerCopy;
  draft: Record<ConsentCategory, boolean>;
  fetchState: FetchState;
  panelId: string;
  titleId: string;
  onSavePreferences: () => void;
  onToggleCategory: (category: ConsentCategory) => void;
};

export function CookiePreferencesPanel({
  adsLabelId,
  analyticsLabelId,
  copy,
  draft,
  fetchState,
  panelId,
  titleId,
  onSavePreferences,
  onToggleCategory,
}: CookiePreferencesPanelProps) {
  return (
    <div
      id={panelId}
      role="region"
      aria-labelledby={titleId}
      className="cookie-consent-surface cookie-consent-preferences max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-input border border-border bg-surface-2 p-3 sm:p-4"
    >
      <p id={titleId} className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        {copy.preferences.title}
      </p>
      <div className="mb-3 flex items-start justify-between gap-4 text-sm text-text-secondary">
        <span id={analyticsLabelId}>
          {copy.preferences.analytics.title}
          <span className="block text-xs text-text-muted">{copy.preferences.analytics.body}</span>
        </span>
        <PreferenceSwitch
          checked={draft.analytics}
          labelId={analyticsLabelId}
          onClick={() => onToggleCategory('analytics')}
        />
      </div>
      <div className="mb-3 flex items-start justify-between gap-4 text-sm text-text-secondary">
        <span id={adsLabelId}>
          {copy.preferences.ads.title}
          <span className="block text-xs text-text-muted">{copy.preferences.ads.body}</span>
        </span>
        <PreferenceSwitch checked={draft.ads} labelId={adsLabelId} onClick={() => onToggleCategory('ads')} />
      </div>
      <Button
        type="button"
        size="sm"
        onClick={onSavePreferences}
        disabled={fetchState === 'saving'}
        className="w-full px-3 py-2 text-sm"
      >
        {fetchState === 'saving' ? copy.actions.saving : copy.actions.savePreferences}
      </Button>
    </div>
  );
}

type PreferenceSwitchProps = {
  checked: boolean;
  labelId: string;
  onClick: () => void;
};

function PreferenceSwitch({ checked, labelId, onClick }: PreferenceSwitchProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
    >
      <span
        aria-hidden="true"
        className={`relative block h-6 w-10 rounded-full border ${checked ? 'border-brand bg-brand' : 'border-border bg-surface'}`}
      >
        <span className={`absolute left-0.5 top-0.5 h-[18px] w-[18px] rounded-full transition-transform ${checked ? 'translate-x-4 bg-on-brand' : 'bg-text-muted'}`} />
      </span>
    </button>
  );
}
