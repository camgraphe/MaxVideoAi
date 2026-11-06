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
import { CharacterStudioOutputSettings } from './CharacterStudioOutputSettings.client';
import { CharacterStudioEntry } from './CharacterStudioExplore.client';
import { CharacterStudioAdvancedSettings } from './CharacterStudioAdvancedSettings.client';
import { getCharacterFormatResolution } from '@/lib/character-builder';
import {
  STUDIO_EYES,
  STUDIO_CHARACTER_TYPES,
  STUDIO_PRESENTATIONS,
  STUDIO_AGES,
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
import { isStudioColorTrait, normalizeStudioColor } from '@/lib/character-studio-colors';
import type { CharacterPriceStatus } from '../_hooks/useCharacterBuilderPrice';

type TraitKey =
  | 'characterType'
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
  priceStatus = price === null ? 'error' : 'ready',
  onRetryPrice,
  busy,
  canGenerate,
  onGenerate,
  navigation,
  onExplore,
}: {
  onExplore?: () => void;
  navigation: ReactNode;
  state: CharacterBuilderState;
  setState: Dispatch<SetStateAction<CharacterBuilderState>>;
  locale: StudioLocale;
  copy: CharacterCopy;
  labels: StudioCopy;
  identitySlot: ReactNode;
  styleSlot: ReactNode;
  price: number | null;
  priceStatus?: CharacterPriceStatus;
  onRetryPrice?: () => void;
  busy: boolean;
  canGenerate: boolean;
  onGenerate: (count: 1 | 4) => void;
}) {
  const [section, setSection] = useState<string | null>(state.characterId ? 'clothing' : 'type');
  const [moreHair, setMoreHair] = useState(false);
  const [sceneFamily, setSceneFamily] = useState('all');
  const options = useCharacterBuilderOptions(copy, state.qualityMode);
  const traits = state.traits;
  function patchTraits(patch: Partial<CharacterBuilderTraits>) {
    setState((previous) => ({
      ...previous,
      traits: { ...previous.traits, ...patch },
    }));
  }
  function choose(key: TraitKey, value: string | null) {
    const patch: Partial<CharacterBuilderTraits> = {
      [key]: { value, source: 'manual' },
    };
    if (key === 'hairstyle' || key === 'hairColor' || key === 'hairLength') {
      patch.customHairDescription = '';
    }
    if (key === 'outfitStyle') patch.customOutfitDescription = '';
    if (key === 'characterType') patch.customCharacterDescription = '';
    patchTraits(patch);
  }
  function labelFor(key: TraitKey, choices: Array<{ id: string; label: string }>) {
    const color = isStudioColorTrait(key) ? normalizeStudioColor(traits[key]?.value) : null;
    if (color) return color;
    return choices.find((entry) => entry.id === traits[key]?.value)?.label ?? labels.free;
  }
  function chips(
    label: string,
    key: TraitKey,
    choices: Array<{ id: string; label: string; swatch?: string }>,
  ) {
    return (
      <StudioChips
        label={label}
        options={choices}
        value={traits[key]?.value}
        onChange={(id) => choose(key, id)}
        colorCopy={isStudioColorTrait(key) ? labels : undefined}
      />
    );
  }
  function group(id: string, title: string, summary: string, Icon: typeof UserRound, content: ReactNode) {
    if (state.characterId && ['type', 'presentation', 'age', 'skin', 'face', 'body'].includes(id))
      return null;
    return (
      <section className="mx-3 mb-2 overflow-hidden rounded-xl border border-border bg-bg">
        <h3>
          <button
            type="button"
            aria-expanded={section === id}
            aria-controls={`studio-section-${id}`}
            onClick={() => setSection(section === id ? null : id)}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-hover"
          >
            <Icon size={17} className="shrink-0 text-text-secondary" />
            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="block text-sm font-medium text-text-primary">{title}</span>
              {section !== id ? (
                <span className="max-w-[100px] truncate text-[10px] text-text-secondary">{summary}</span>
              ) : null}
            </span>
            <ChevronDown
              size={16}
              className={section === id ? 'rotate-180 text-text-secondary' : 'text-text-secondary'}
            />
          </button>
        </h3>
        {section === id ? (
          <div id={`studio-section-${id}`} className="space-y-4 px-2.5 pb-3 pt-1">
            {content}
          </div>
        ) : null}
      </section>
    );
  }
  const fieldClass =
    'mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text-primary';
  return (
    <aside
      aria-label={labels.yourCharacter}
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface"
    >
      {navigation}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-studio-scroll="settings">
        <CharacterStudioEntry identity={identitySlot} copy={labels} onExplore={state.characterId ? undefined : onExplore} />
        {group(
          'type',
          labels.type,
          traits.customCharacterDescription?.trim()
            ? labels.customType
            : (STUDIO_CHARACTER_TYPES.find((x) => x.id === traits.characterType?.value)?.label[locale] ??
                labels.free),
          Sparkles,
          <>
            <StudioVisualChoices
              options={STUDIO_CHARACTER_TYPES}
              atlas="identity"
              value={traits.customCharacterDescription?.trim() ? null : traits.characterType?.value}
              onChange={(id) => choose('characterType', id)}
              locale={locale}
            />
            <label className="block text-xs font-medium text-text-secondary">
              {labels.typeNotes}
              <textarea
                className={fieldClass}
                rows={3}
                maxLength={1000}
                placeholder={labels.typePlaceholder}
                value={traits.customCharacterDescription ?? ''}
                onChange={(event) =>
                  patchTraits({
                    customCharacterDescription: event.target.value,
                  })
                }
                aria-describedby="studio-type-hint"
              />
            </label>
            <p id="studio-type-hint" className="text-xs leading-relaxed text-text-secondary">
              {labels.typeHint}
            </p>
          </>,
        )}
        {group(
          'presentation',
          labels.presentation,
          labelFor('genderPresentation', options.genderOptions),
          UserRound,
          <StudioVisualChoices
            options={STUDIO_PRESENTATIONS}
            atlas="identity"
            value={traits.genderPresentation.value}
            onChange={(id) => choose('genderPresentation', id)}
            locale={locale}
          />,
        )}
        {group(
          'age',
          copy.sections.age,
          labelFor('ageRange', options.ageOptions),
          UserRound,
          <StudioVisualChoices
            options={STUDIO_AGES}
            atlas="identity"
            value={traits.ageRange.value}
            onChange={(id) => choose('ageRange', id)}
            locale={locale}
          />,
        )}
        {group(
          'skin',
          copy.sections.skinTone,
          labelFor('skinTone', options.skinToneOptions),
          ScanFace,
          chips(copy.sections.skinTone, 'skinTone', options.skinToneOptions),
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
                    onChange={(event) =>
                      patchTraits({
                        customDetailsDescription: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
            </details>
          </>,
        )}
        {group(
          'hair',
          labels.hair,
          traits.customHairDescription?.trim()
            ? labels.customType
            : (STUDIO_HAIR.find((entry) => entry.id === traits.hairstyle.value)?.label[locale] ??
                labelFor('hairColor', options.hairColorOptions)),
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
          traits.customOutfitDescription?.trim()
            ? labels.customType
            : (STUDIO_CLOTHING.find((entry) => entry.id === traits.outfitStyle.value)?.label[locale] ??
                labels.free),
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
          traits.customSceneDescription?.trim()
            ? labels.customScene
            : (STUDIO_SCENES.find((entry) => entry.id === traits.sceneId)?.label[locale] ?? labels.free),
          MapPin,
          <>
            <label className="block text-xs font-medium text-text-secondary">
              {labels.sceneNotes}
              <textarea
                className={fieldClass}
                rows={3}
                maxLength={1000}
                placeholder={labels.scenePlaceholder}
                value={traits.customSceneDescription ?? ''}
                onChange={(event) => patchTraits({ customSceneDescription: event.target.value })}
                aria-describedby="studio-scene-hint"
              />
            </label>
            <p id="studio-scene-hint" className="text-xs leading-relaxed text-text-secondary">
              {labels.sceneHint}
            </p>
            {traits.sceneId && traits.customSceneDescription?.trim() ? (
              <button
                type="button"
                onClick={() => patchTraits({ sceneId: null })}
                className="text-xs text-text-secondary underline underline-offset-4 hover:text-text-primary"
              >
                {labels.clearScene}
              </button>
            ) : null}
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
        <CharacterStudioAdvancedSettings state={state} setState={setState} copy={copy} labels={labels} />
      </div>
      <div
        data-studio-dock
        className="z-10 shrink-0 space-y-2 border-t border-border bg-surface p-3 shadow-[0_-8px_18px_-12px_rgb(0_0_0_/_0.4)]"
      >
        <CharacterStudioOutputSettings state={state} setState={setState} copy={copy} labels={labels} />
        {priceStatus === 'error' && (
          <div id="character-price-help" role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed">
            <p>{labels.priceIssue}</p>
            {onRetryPrice && <button type="button" onClick={onRetryPrice} className="mt-1 min-h-8 font-semibold underline underline-offset-4">{labels.retryPrice}</button>}
          </div>
        )}
        <button
          type="button"
          disabled={busy || !canGenerate}
          aria-busy={busy || undefined}
          aria-describedby={priceStatus === 'error' ? 'character-price-help' : undefined}
          onClick={() => onGenerate(1)}
          className="app-generation-action flex min-h-14 w-full items-center justify-between gap-3 rounded-xl bg-brand px-3 py-3 text-left text-sm font-semibold text-on-brand transition hover:brightness-95 disabled:opacity-60"
        >
          <span className="flex min-w-0 items-center gap-2">
            {busy ? <Loader2 aria-hidden="true" size={17} className="shrink-0 animate-spin" /> : <Sparkles aria-hidden="true" size={17} className="shrink-0" />}
            <span>{busy
              ? labels.generating
              : state.outputMode === 'character-sheet'
                ? labels.generateSheet
                : state.characterId
                  ? labels.generateLook
                  : labels.generate}</span>
          </span>
          <span role="status" aria-live="polite" aria-atomic="true" className="app-generation-price shrink-0 border-l border-current/30 pl-3 text-base font-semibold tabular-nums">
            <span className="sr-only">{labels.imagePrice} · {getCharacterFormatResolution(state.formatMode, state.qualityMode).toUpperCase()} : </span>
            {price == null ? (
              <span className="block max-w-24 whitespace-normal text-xs font-medium">{priceStatus === 'loading' ? labels.priceLoading : labels.priceUnavailable}</span>
            ) : new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(price)}
          </span>
        </button>
      </div>
    </aside>
  );
}
