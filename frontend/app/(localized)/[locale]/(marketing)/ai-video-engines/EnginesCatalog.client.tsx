'use client';

import { useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { SelectMenu } from '@/components/ui/SelectMenu';

type CompareAction = {
  slug: string;
  label: string;
};

export type EngineCatalogCard = {
  modelSlug: string;
  marketingName: string;
  provider: string;
  availability: string;
  status: string;
  modes: string[];
  audio: boolean;
  maxDurationSec: number | null;
  maxResolutionLabel: string;
  maxResolutionValue: number | null;
  compareActions: CompareAction[];
};

type EnginesCatalogProps = {
  cards: EngineCatalogCard[];
  extendedCards?: EngineCatalogCard[];
  labels: {
    sortAll: string;
    toggles: {
      includeWaitlistEarlyAccess: string;
    };
    filters: {
      mode: string;
      audio: string;
      duration: string;
      resolution: string;
      status: string;
      provider: string;
      clear: string;
    };
    options: {
      all: string;
      modeT2v: string;
      modeI2v: string;
      modeV2v: string;
      audioOn: string;
      audioOff: string;
      durationShort: string;
      durationMedium: string;
      durationLong: string;
      resolution720: string;
      resolution1080: string;
      resolution4k: string;
      statusLive: string;
      statusEarly: string;
    };
    specs: {
      modes: string;
      audio: string;
      status: string;
      duration: string;
      resolution: string;
      yes: string;
      no: string;
      unknown: string;
      secondsSuffix: string;
      statusLive: string;
      statusEarly: string;
    };
    ctas: {
      model: string;
      compare: string;
    };
    empty: string;
  };
};

function humanizeModes(modes: string[]) {
  return modes
    .map((mode) => {
      if (mode === 't2v') return 'T2V';
      if (mode === 'i2v') return 'I2V';
      if (mode === 'v2v' || mode === 'r2v') return 'V2V';
      return mode.toUpperCase();
    })
    .join(' / ');
}

function humanizeStatus(status: string, labels: EnginesCatalogProps['labels']['specs']) {
  if (status === 'live') return labels.statusLive;
  if (status === 'early_access') return labels.statusEarly;
  return status || labels.unknown;
}

export function EnginesCatalog({ cards, extendedCards, labels }: EnginesCatalogProps) {
  const [includeWaitlistEarlyAccess, setIncludeWaitlistEarlyAccess] = useState(false);
  const [mode, setMode] = useState('all');
  const [audio, setAudio] = useState('all');
  const [duration, setDuration] = useState('all');
  const [resolution, setResolution] = useState('all');
  const [status, setStatus] = useState('all');
  const [provider, setProvider] = useState('all');

  const canToggleExtended = Boolean(extendedCards && extendedCards.length > 0);
  const sourceCards = includeWaitlistEarlyAccess && canToggleExtended ? extendedCards ?? cards : cards;

  const providerOptions = useMemo(() => {
    const providers = Array.from(new Set(sourceCards.map((card) => card.provider))).sort((a, b) => a.localeCompare(b));
    return [
      { value: 'all', label: `${labels.filters.provider}: ${labels.options.all}` },
      ...providers.map((entry) => ({ value: entry, label: entry })),
    ];
  }, [sourceCards, labels.filters.provider, labels.options.all]);

  const localizedModeOptions = useMemo(
    () => [
      { value: 'all', label: `${labels.filters.mode}: ${labels.options.all}` },
      { value: 't2v', label: labels.options.modeT2v },
      { value: 'i2v', label: labels.options.modeI2v },
      { value: 'v2v', label: labels.options.modeV2v },
    ],
    [labels.filters.mode, labels.options]
  );

  const localizedAudioOptions = useMemo(
    () => [
      { value: 'all', label: `${labels.filters.audio}: ${labels.options.all}` },
      { value: 'on', label: labels.options.audioOn },
      { value: 'off', label: labels.options.audioOff },
    ],
    [labels.filters.audio, labels.options]
  );

  const localizedDurationOptions = useMemo(
    () => [
      { value: 'all', label: `${labels.filters.duration}: ${labels.options.all}` },
      { value: 'short', label: labels.options.durationShort },
      { value: 'medium', label: labels.options.durationMedium },
      { value: 'long', label: labels.options.durationLong },
    ],
    [labels.filters.duration, labels.options]
  );

  const localizedResolutionOptions = useMemo(
    () => [
      { value: 'all', label: `${labels.filters.resolution}: ${labels.options.all}` },
      { value: '720', label: labels.options.resolution720 },
      { value: '1080', label: labels.options.resolution1080 },
      { value: '2160', label: labels.options.resolution4k },
    ],
    [labels.filters.resolution, labels.options]
  );

  const localizedStatusOptions = useMemo(
    () => [
      { value: 'all', label: `${labels.filters.status}: ${labels.options.all}` },
      { value: 'live', label: labels.options.statusLive },
      { value: 'early_access', label: labels.options.statusEarly },
    ],
    [labels.filters.status, labels.options]
  );

  const filtered = useMemo(
    () =>
      sourceCards.filter((card) => {
        if (mode !== 'all' && !card.modes.includes(mode)) return false;
        if (audio === 'on' && !card.audio) return false;
        if (audio === 'off' && card.audio) return false;
        if (status !== 'all' && card.status !== status) return false;
        if (provider !== 'all' && card.provider !== provider) return false;

        if (duration !== 'all') {
          const value = card.maxDurationSec;
          if (value == null) return false;
          if (duration === 'short' && value >= 8) return false;
          if (duration === 'medium' && (value < 8 || value >= 12)) return false;
          if (duration === 'long' && value < 12) return false;
        }

        if (resolution !== 'all') {
          const minValue = Number(resolution);
          if (card.maxResolutionValue == null || card.maxResolutionValue < minValue) return false;
        }

        return true;
      }),
    [audio, duration, mode, provider, resolution, sourceCards, status]
  );

  const hasActiveFilters =
    mode !== 'all' || audio !== 'all' || duration !== 'all' || resolution !== 'all' || status !== 'all' || provider !== 'all';

  const clearFilters = () => {
    setMode('all');
    setAudio('all');
    setDuration('all');
    setResolution('all');
    setStatus('all');
    setProvider('all');
  };

  return (
    <div className="space-y-5">
      {canToggleExtended ? (
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-text-secondary">
          <input
            type="checkbox"
            checked={includeWaitlistEarlyAccess}
            onChange={(event) => setIncludeWaitlistEarlyAccess(event.target.checked)}
            className="h-4 w-4 rounded border-hairline"
          />
          <span>{labels.toggles.includeWaitlistEarlyAccess}</span>
        </label>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <SelectMenu
          options={localizedModeOptions}
          value={mode}
          onChange={(value) => setMode(String(value))}
          buttonClassName="rounded-full border-hairline bg-surface-glass-80 px-3 py-1 text-xs font-medium text-text-secondary hover:border-text-muted hover:bg-surface-2 hover:text-text-primary"
        />
        <SelectMenu
          options={localizedAudioOptions}
          value={audio}
          onChange={(value) => setAudio(String(value))}
          buttonClassName="rounded-full border-hairline bg-surface-glass-80 px-3 py-1 text-xs font-medium text-text-secondary hover:border-text-muted hover:bg-surface-2 hover:text-text-primary"
        />
        <SelectMenu
          options={localizedDurationOptions}
          value={duration}
          onChange={(value) => setDuration(String(value))}
          buttonClassName="rounded-full border-hairline bg-surface-glass-80 px-3 py-1 text-xs font-medium text-text-secondary hover:border-text-muted hover:bg-surface-2 hover:text-text-primary"
        />
        <SelectMenu
          options={localizedResolutionOptions}
          value={resolution}
          onChange={(value) => setResolution(String(value))}
          buttonClassName="rounded-full border-hairline bg-surface-glass-80 px-3 py-1 text-xs font-medium text-text-secondary hover:border-text-muted hover:bg-surface-2 hover:text-text-primary"
        />
        <SelectMenu
          options={localizedStatusOptions}
          value={status}
          onChange={(value) => setStatus(String(value))}
          buttonClassName="rounded-full border-hairline bg-surface-glass-80 px-3 py-1 text-xs font-medium text-text-secondary hover:border-text-muted hover:bg-surface-2 hover:text-text-primary"
        />
        <SelectMenu
          options={providerOptions}
          value={provider}
          onChange={(value) => setProvider(String(value))}
          buttonClassName="rounded-full border-hairline bg-surface-glass-80 px-3 py-1 text-xs font-medium text-text-secondary hover:border-text-muted hover:bg-surface-2 hover:text-text-primary"
        />
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-full border border-hairline px-3 py-1 text-xs font-semibold text-text-secondary transition hover:border-text-muted hover:text-text-primary"
          >
            {labels.filters.clear}
          </button>
        ) : null}
      </div>

      {filtered.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((card) => (
            <article key={card.modelSlug} className="rounded-xl border border-hairline bg-surface p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-text-primary">{card.marketingName}</h3>
                <span className="rounded-full border border-hairline bg-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro text-text-muted">
                  {card.provider}
                </span>
              </div>

              <dl className="mt-3 space-y-1 text-xs text-text-secondary">
                <div>
                  <dt className="inline font-semibold text-text-muted">{labels.specs.modes}: </dt>
                  <dd className="inline">{humanizeModes(card.modes)}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold text-text-muted">{labels.specs.audio}: </dt>
                  <dd className="inline">{card.audio ? labels.specs.yes : labels.specs.no}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold text-text-muted">{labels.specs.status}: </dt>
                  <dd className="inline">{humanizeStatus(card.status, labels.specs)}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold text-text-muted">{labels.specs.duration}: </dt>
                  <dd className="inline">
                    {card.maxDurationSec != null ? `${card.maxDurationSec}${labels.specs.secondsSuffix}` : labels.specs.unknown}
                  </dd>
                </div>
                <div>
                  <dt className="inline font-semibold text-text-muted">{labels.specs.resolution}: </dt>
                  <dd className="inline">{card.maxResolutionLabel || labels.specs.unknown}</dd>
                </div>
              </dl>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Link
                  href={{ pathname: '/models/[slug]', params: { slug: card.modelSlug } }}
                  className="inline-flex rounded-full border border-hairline px-2.5 py-1 font-semibold text-text-secondary transition hover:border-text-muted hover:text-text-primary"
                >
                  {labels.ctas.model}
                </Link>
                {card.compareActions.map((action) => (
                  <Link
                    key={`${card.modelSlug}-${action.slug}`}
                    href={{
                      pathname: '/ai-video-engines/[slug]',
                      params: { slug: action.slug },
                    }}
                    prefetch={false}
                    className="inline-flex rounded-full border border-hairline px-2.5 py-1 font-semibold text-brand transition hover:border-brand hover:text-brandHover"
                  >
                    {labels.ctas.compare} {action.label}
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-hairline bg-surface p-4 text-sm text-text-secondary">{labels.empty}</div>
      )}
    </div>
  );
}
