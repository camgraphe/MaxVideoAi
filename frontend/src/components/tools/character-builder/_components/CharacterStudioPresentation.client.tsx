'use client';

import { useState } from 'react';
import {
  presentationFields,
  PRESENTATION_FIELD_LIMIT,
  type StudioPresentation,
  type PresentationField,
} from '@/lib/character-studio-presentation';
import {
  STUDIO_CHARACTER_TYPES,
  STUDIO_EYES,
  STUDIO_CLOTHING,
  getStudioScene,
  type StudioLocale,
} from '@/lib/character-studio-catalog';
import type { StudioCharacter } from '@/types/character-studio';
import type { CharacterCopy } from '../_lib/character-builder-copy';

const language = {
  fr: {
    title: 'Fiche du personnage',
    edit: 'Modifier la fiche',
    save: 'Enregistrer la fiche',
    cancel: 'Annuler',
    empty: 'Non renseigné',
    error: 'La fiche n’a pas été enregistrée.',
    labels: [
      'Type et rôle',
      'Présentation',
      'Âge',
      'Carnation, pelage ou matière',
      'Visage',
      'Yeux',
      'Cheveux ou antennes',
      'Silhouette',
      'Tenue',
      'Signes distinctifs et accessoires',
      'Décor',
    ],
  },
  en: {
    title: 'Character profile',
    edit: 'Edit profile',
    save: 'Save profile',
    cancel: 'Cancel',
    empty: 'Unspecified',
    error: 'The profile could not be saved.',
    labels: [
      'Type and role',
      'Presentation',
      'Age',
      'Skin tone, fur or surface',
      'Face',
      'Eyes',
      'Hair or antennae',
      'Build',
      'Outfit',
      'Distinctive features and accessories',
      'Setting',
    ],
  },
  es: {
    title: 'Ficha del personaje',
    edit: 'Editar ficha',
    save: 'Guardar ficha',
    cancel: 'Cancelar',
    empty: 'Sin especificar',
    error: 'No se ha podido guardar la ficha.',
    labels: [
      'Tipo y rol',
      'Presentación',
      'Edad',
      'Piel, pelaje o superficie',
      'Rostro',
      'Ojos',
      'Cabello o antenas',
      'Complexión',
      'Ropa',
      'Rasgos y accesorios',
      'Escenario',
    ],
  },
};
function savedTraits(
  character: StudioCharacter,
  copy: CharacterCopy,
  locale: StudioLocale,
): StudioPresentation {
  const t = character.identity.settingsSnapshot.builder.traits;
  const lookup = (map: Record<string, string>, id?: string | null) =>
    id && id !== 'auto' ? (map[id] ?? id) : '';
  const join = (...values: Array<string | undefined>) => values.filter(Boolean).join(' · ');
  const opt = copy.options;
  return {
    role:
      t.customCharacterDescription ||
      STUDIO_CHARACTER_TYPES.find((x) => x.id === t.characterType?.value)?.label[locale],
    presentation: t.customGenderDescription || lookup(opt.gender, t.genderPresentation?.value),
    age: lookup(opt.age, t.ageRange?.value),
    surface: lookup(opt.skinTone, t.skinTone?.value),
    face: lookup(opt.faceCues, t.faceCues?.value),
    eyes: join(
      lookup(opt.eyeColor, t.eyeColor?.value),
      STUDIO_EYES.find((x) => x.id === t.eyeShape?.value)?.label[locale],
    ),
    hair:
      t.customHairDescription ||
      join(
        lookup(opt.hairstyle, t.hairstyle?.value),
        lookup(opt.hairLength, t.hairLength?.value),
        lookup(opt.hairColor, t.hairColor?.value),
      ),
    build: lookup(opt.bodyBuild, t.bodyBuild?.value),
    outfit:
      t.customOutfitDescription ||
      STUDIO_CLOTHING.find((x) => x.id === t.outfitStyle?.value)?.label[locale] ||
      lookup(opt.outfit, t.outfitStyle?.value),
    details: join(
      ...(t.accessories ?? []).map((x) => lookup(opt.accessories, x)),
      ...(t.distinctiveFeatures ?? []).map((x) => lookup(opt.distinctive, x)),
      t.customDetailsDescription,
    ),
    scene: join(getStudioScene(t.sceneId)?.label[locale], t.customSceneDescription),
  };
}

export function CharacterStudioPresentation({
  character,
  copy,
  locale,
  onSave,
}: {
  character: StudioCharacter;
  copy: CharacterCopy;
  locale: StudioLocale;
  onSave: (profile: StudioPresentation) => Promise<boolean | undefined>;
}) {
  const text = language[locale],
    base = savedTraits(character, copy, locale);
  const [editing, setEditing] = useState(false),
    [draft, setDraft] = useState<StudioPresentation>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const entries = presentationFields.map((key, index) => ({
    key,
    label: text.labels[index],
  }));
  const value = (key: PresentationField) => character.presentation?.[key] || base[key] || '';
  const action = 'rounded-lg border border-border px-3 py-2 text-xs font-medium disabled:opacity-50';
  return (
    <section className="rounded-xl border border-border bg-bg/50 p-4" aria-label={text.title}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{text.title}</h3>
        {!editing && (
          <button
            type="button"
            className={action}
            onClick={() => {
              setDraft(character.presentation ?? {});
              setError(false);
              setEditing(true);
            }}
          >
            {text.edit}
          </button>
        )}
      </div>
      {editing ? (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError(false);
            try {
              if (await onSave(draft)) setEditing(false);
              else setError(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {entries.map(({ key, label }) => (
              <label key={key} className="text-xs text-text-secondary">
                {label}
                <textarea
                  disabled={busy}
                  value={draft[key] ?? ''}
                  placeholder={base[key] || text.empty}
                  maxLength={PRESENTATION_FIELD_LIMIT}
                  onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                  className="mt-1 block w-full rounded-lg border border-border bg-bg px-2 py-2 text-sm text-text-primary"
                  rows={2}
                />
              </label>
            ))}
          </div>
          {error && <p role="alert">{text.error}</p>}
          <div className="mt-4 flex gap-2">
            <button className={action} disabled={busy} type="submit">
              {text.save}
            </button>
            <button className={action} type="button" disabled={busy} onClick={() => setEditing(false)}>
              {text.cancel}
            </button>
          </div>
        </form>
      ) : (
        <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
          {entries.map(({ key, label }) => (
            <div key={key} className={key === 'role' ? 'sm:col-span-2' : ''}>
              <dt className="text-xs text-text-secondary">{label}</dt>
              <dd className="mt-0.5 whitespace-pre-line break-words text-sm">{value(key) || text.empty}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
