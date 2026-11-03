'use client';
import { useState, type Dispatch, type SetStateAction, type ReactNode } from 'react';
import {
  ChevronDown,
  UserRound,
  ScanFace,
  Scissors,
  PersonStanding,
  Shirt,
  MapPin,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { normalizeCharacterFormatMode } from '@/lib/character-builder';
import {
  STUDIO_EYES,
  STUDIO_HAIR,
  STUDIO_CLOTHING,
  STUDIO_SCENES,
  type StudioLocale,
} from '@/lib/character-studio-catalog';
import type { CharacterBuilderState, CharacterBuilderTraits } from '@/types/character-builder';
import type { CharacterCopy } from '../_lib/character-builder-copy';
import type { StudioCopy } from '../_lib/character-studio-copy';
import { useCharacterBuilderOptions } from '../_hooks/useCharacterBuilderOptions';
import { StudioChips, StudioVisualChoices } from './CharacterStudioChoices.client';

type TraitKey =
  | 'genderPresentation'
  | 'ageRange'
  | 'skinTone'
  | 'faceCues'
  | 'eyeShape'
  | 'eyeColor'
  | 'hairColor'
  | 'hairLength'
  | 'hairstyle'
  | 'bodyBuild'
  | 'outfitStyle';
export function CharacterStudioComposer({
  state,
  setState,
  locale,
  copy,
  labels,
  identitySlot,
  styleSlot,
  price,
  busy,
  canGenerate,
  onGenerate,
}: {
  state: CharacterBuilderState;
  setState: Dispatch<SetStateAction<CharacterBuilderState>>;
  locale: StudioLocale;
  copy: CharacterCopy;
  labels: StudioCopy;
  identitySlot: ReactNode;
  styleSlot: ReactNode;
  price: number | null;
  busy: boolean;
  canGenerate: boolean;
  onGenerate: (count: 1 | 4) => void;
}) {
  const [section, setSection] = useState<string | null>('identity');
  const [moreHair, setMoreHair] = useState(false);
  const [sceneFamily, setSceneFamily] = useState('all');
  const [generateCount, setGenerateCount] = useState<1 | 4>(1);
  const options = useCharacterBuilderOptions(copy, state.qualityMode);
  const traits = state.traits;
  function patchTraits(patch: Partial<CharacterBuilderTraits>) {
    setState((previous) => ({ ...previous, traits: { ...previous.traits, ...patch } }));
  }
  function choose(key: TraitKey, value: string | null) {
    const patch: Partial<CharacterBuilderTraits> = { [key]: { value, source: 'manual' } };
    if (key === 'hairstyle' || key === 'hairColor' || key === 'hairLength') {
      patch.customHairDescription = '';
    }
    if (key === 'outfitStyle') patch.customOutfitDescription = '';
    patchTraits(patch);
  }
  function labelFor(key: TraitKey, choices: Array<{ id: string; label: string }>) {
    return choices.find((entry) => entry.id === traits[key]?.value)?.label ?? labels.free;
  }
  function chips(label: string, key: TraitKey, choices: Array<{ id: string; label: string; swatch?: string }>) {
    return (
      <StudioChips label={label} options={choices} value={traits[key]?.value} onChange={(id) => choose(key, id)} />
    );
  }
  function group(id: string, title: string, summary: string, Icon: typeof UserRound, content: ReactNode) {
    return (
      <section className="border-t border-border">
        <h3>
          <button
            type="button"
            aria-expanded={section === id}
            aria-controls={`studio-section-${id}`}
            onClick={() => setSection(section === id ? null : id)}
            className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-surface-hover"
          >
            <Icon size={17} className="shrink-0 text-text-secondary" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-text-primary">{title}</span>
              {section !== id ? (
                <span className="mt-1 block truncate text-xs text-text-secondary">{summary}</span>
              ) : null}
            </span>
            <ChevronDown
              size={16}
              className={section === id ? 'rotate-180 text-text-secondary' : 'text-text-secondary'}
            />
          </button>
        </h3>
        {section === id ? (
          <div id={`studio-section-${id}`} className="space-y-5 px-4 pb-5">
            {content}
          </div>
        ) : null}
      </section>
    );
  }
  const fieldClass = 'mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text-primary';
  return (
    <aside aria-label={labels.yourCharacter} className="min-w-0 rounded-xl border border-border bg-surface">
      <div className="space-y-4 p-4">
        <h2 className="text-base font-medium text-text-primary">{labels.yourCharacter}</h2>
        {identitySlot}
      </div>
      {group(
        'identity',
        labels.identity,
        [labelFor('genderPresentation', options.genderOptions), labelFor('ageRange', options.ageOptions)].join(' · '),
        UserRound,
        <>
          {chips(
            copy.summary.identity,
            'genderPresentation',
            options.genderOptions.filter((x) => x.id !== 'custom'),
          )}
          {chips(
            copy.sections.age,
            'ageRange',
            options.ageOptions.filter((x) => x.id !== 'teen'),
          )}
          {chips(copy.sections.skinTone, 'skinTone', options.skinToneOptions)}
        </>,
      )}
      {group(
        'face',
        labels.face,
        labelFor('eyeColor', options.eyeColorOptions),
        ScanFace,
        <>
          <StudioVisualChoices
            options={STUDIO_EYES}
            atlas="eyes"
            value={traits.eyeShape?.value}
            onChange={(id) => choose('eyeShape', id)}
            locale={locale}
            wide
          />
          {chips(copy.sections.eyeColor, 'eyeColor', options.eyeColorOptions)}
          {chips(copy.sections.faceCues, 'faceCues', options.faceCueOptions)}
          <details>
            <summary className="cursor-pointer text-sm text-text-secondary">{labels.details}</summary>
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                {options.distinctiveOptions.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    aria-pressed={traits.distinctiveFeatures.includes(item.id)}
                    onClick={() =>
                      patchTraits({
                        distinctiveFeatures: traits.distinctiveFeatures.includes(item.id)
                          ? traits.distinctiveFeatures.filter((id) => id !== item.id)
                          : [...traits.distinctiveFeatures, item.id],
                      })
                    }
                    className={`rounded-md border px-2 py-2 text-xs ${traits.distinctiveFeatures.includes(item.id) ? 'border-brand bg-brand/10' : 'border-border'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <label className="block text-xs text-text-secondary">
                {labels.notes}
                <textarea
                  value={traits.customDetailsDescription ?? ''}
                  className={fieldClass}
                  rows={2}
                  maxLength={1000}
                  onChange={(event) => patchTraits({ customDetailsDescription: event.target.value })}
                />
              </label>
            </div>
          </details>
        </>,
      )}
      {group(
        'hair',
        labels.hair,
        STUDIO_HAIR.find((entry) => entry.id === traits.hairstyle.value)?.label[locale] ?? labels.free,
        Scissors,
        <>
          <StudioVisualChoices
            options={moreHair ? STUDIO_HAIR : STUDIO_HAIR.slice(0, 6)}
            atlas="hairCatalog"
            value={traits.customHairDescription?.trim() ? null : traits.hairstyle.value}
            onChange={(id) => choose('hairstyle', id)}
            locale={locale}
          />
          <button
            type="button"
            onClick={() => setMoreHair(!moreHair)}
            className="w-full rounded-lg border border-border px-3 py-2 text-xs"
          >
            {moreHair ? labels.fewerHair : labels.moreHair}
          </button>
          {traits.hairstyle.value !== 'bald'
            ? chips(copy.hairEditor.color, 'hairColor', options.hairColorOptions)
            : null}
          <details>
            <summary className="cursor-pointer text-sm text-text-secondary">{labels.details}</summary>
            <div className="mt-4 space-y-4">
              {traits.hairstyle.value !== 'bald'
                ? chips(copy.hairEditor.length, 'hairLength', options.hairLengthOptions)
                : null}
              <label className="block text-xs text-text-secondary">
                {labels.hairNotes}
                <textarea
                  className={fieldClass}
                  rows={2}
                  maxLength={1000}
                  value={traits.customHairDescription ?? ''}
                  onChange={(event) => patchTraits({ customHairDescription: event.target.value })}
                />
              </label>
              {traits.customHairDescription?.trim() ? (
                <p className="text-xs text-text-secondary">{labels.customWins}</p>
              ) : null}
            </div>
          </details>
        </>,
      )}
      {group(
        'body',
        labels.body,
        labelFor('bodyBuild', options.bodyBuildOptions),
        PersonStanding,
        chips(copy.sections.bodyBuild, 'bodyBuild', options.bodyBuildOptions),
      )}
      {group(
        'clothing',
        labels.clothing,
        STUDIO_CLOTHING.find((entry) => entry.id === traits.outfitStyle.value)?.label[locale] ?? labels.free,
        Shirt,
        <>
          <StudioVisualChoices
            options={STUDIO_CLOTHING}
            atlas="fashion"
            value={traits.customOutfitDescription?.trim() ? null : traits.outfitStyle.value}
            onChange={(id) => choose('outfitStyle', id)}
            locale={locale}
          />
          <label className="block text-xs text-text-secondary">
            {labels.outfitNotes}
            <textarea
              className={fieldClass}
              rows={2}
              maxLength={1000}
              value={traits.customOutfitDescription ?? ''}
              onChange={(event) => patchTraits({ customOutfitDescription: event.target.value })}
            />
          </label>
          {traits.customOutfitDescription?.trim() ? (
            <p className="text-xs text-text-secondary">{labels.customWins}</p>
          ) : null}
          {styleSlot}
          <details>
            <summary className="cursor-pointer text-sm text-text-secondary">{labels.details}</summary>
            <div className="mt-4 flex flex-wrap gap-2">
              {options.accessoryOptions.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={traits.accessories.includes(item.id)}
                  onClick={() =>
                    patchTraits({
                      accessories: traits.accessories.includes(item.id)
                        ? traits.accessories.filter((id) => id !== item.id)
                        : [...traits.accessories, item.id],
                    })
                  }
                  className={`rounded-md border px-2 py-2 text-xs ${traits.accessories.includes(item.id) ? 'border-brand bg-brand/10' : 'border-border'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </details>
        </>,
      )}
      {group(
        'scene',
        labels.scene,
        STUDIO_SCENES.find((entry) => entry.id === traits.sceneId)?.label[locale] ?? labels.free,
        MapPin,
        <>
          <StudioChips
            label={labels.scene}
            options={(['all', 'studio', 'interior', 'urban', 'nature'] as const).map((id) => ({
              id,
              label: labels[id],
            }))}
            value={sceneFamily}
            onChange={(id) => setSceneFamily(id ?? 'all')}
          />
          <StudioVisualChoices
            options={STUDIO_SCENES.filter((entry) => sceneFamily === 'all' || entry.family === sceneFamily)}
            atlas="scenes"
            value={traits.sceneId}
            onChange={(id) => patchTraits({ sceneId: id })}
            locale={locale}
            wide
          />
          <p className="text-xs text-text-secondary">{labels.backgroundCredit}</p>
        </>,
      )}
      <div className="space-y-4 border-t border-border p-4">
        <details>
          <summary className="cursor-pointer text-sm text-text-secondary">{labels.generation}</summary>
          <div className="mt-4 space-y-4">
            <StudioChips
              label={copy.summary.output}
              options={options.outputModeOptions}
              value={state.outputMode}
              onChange={(id) => {
                if (id)
                  setState((previous) => ({
                    ...previous,
                    outputMode: id as CharacterBuilderState['outputMode'],
                    outputOptions: { ...previous.outputOptions, fullBodyRequired: id === 'character-sheet' },
                  }));
              }}
            />
            <StudioChips
              label={copy.generatePanel.quality}
              options={options.qualityOptions}
              value={state.qualityMode}
              onChange={(id) => {
                if (id)
                  setState((previous) => ({
                    ...previous,
                    qualityMode: id as CharacterBuilderState['qualityMode'],
                    formatMode: normalizeCharacterFormatMode(
                      previous.formatMode,
                      id as CharacterBuilderState['qualityMode'],
                    ),
                  }));
              }}
            />
            <StudioChips
              label={copy.generatePanel.format}
              options={options.formatLabelOptions}
              value={state.formatMode}
              onChange={(id) => {
                if (id)
                  setState((previous) => ({ ...previous, formatMode: id as CharacterBuilderState['formatMode'] }));
              }}
            />
            <StudioChips
              label={labels.count}
              options={[
                { id: '1', label: '1' },
                { id: '4', label: '4' },
              ]}
              value={String(generateCount)}
              onChange={(id) => {
                if (id) setGenerateCount(id === '4' ? 4 : 1);
              }}
            />
            <StudioChips
              label={copy.sections.consistency}
              options={options.consistencyOptions}
              value={state.consistencyMode}
              onChange={(id) => {
                if (id)
                  setState((previous) => ({
                    ...previous,
                    consistencyMode: id as CharacterBuilderState['consistencyMode'],
                  }));
              }}
            />
            {state.sourceMode === 'reference-image' ? (
              <StudioChips
                label={copy.sections.referenceStrength}
                options={options.referenceStrengthOptions}
                value={state.referenceStrength}
                onChange={(id) => {
                  if (id)
                    setState((previous) => ({
                      ...previous,
                      referenceStrength: id as CharacterBuilderState['referenceStrength'],
                    }));
                }}
              />
            ) : null}
            <label className="block text-xs text-text-secondary">
              {labels.notes}
              <textarea
                className={fieldClass}
                rows={3}
                maxLength={2000}
                placeholder={labels.notesPlaceholder}
                value={state.advancedNotes}
                onChange={(event) => setState((previous) => ({ ...previous, advancedNotes: event.target.value }))}
              />
            </label>
          </div>
        </details>
        <div className="flex items-baseline justify-between gap-2 text-xs text-text-secondary">
          <span>{labels.imagePrice}</span>
          <span>
            {price == null ? '—' : new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(price)}
          </span>
        </div>
        {!canGenerate ? (
          <p role="status" className="text-xs text-text-secondary">
            {copy.pricingError}
          </p>
        ) : null}
        <button
          type="button"
          disabled={busy || !canGenerate}
          onClick={() => onGenerate(generateCount)}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-3 text-sm font-medium text-on-brand transition hover:brightness-95 disabled:opacity-50"
        >
          {busy ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
          {busy ? labels.generating : labels.generate}
          {generateCount === 4 ? ' ×4' : ''}
        </button>
        <p className="text-center text-xs leading-relaxed text-text-secondary">{labels.noLive}</p>
      </div>
    </aside>
  );
}
