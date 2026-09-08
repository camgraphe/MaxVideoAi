'use client';

import type { ReactNode } from 'react';
import {
  ACCESSORY_OPTIONS,
  CHARACTER_CONSISTENCY_OPTIONS,
  CHARACTER_OUTPUT_OPTIONS,
  CHARACTER_QUALITY_OPTIONS,
  CHARACTER_REFERENCE_STRENGTH_OPTIONS,
  HAIR_COLOR_OPTIONS,
  HAIR_LENGTH_OPTIONS,
  HAIRSTYLE_OPTIONS,
  OUTFIT_STYLE_OPTIONS,
  REALISM_STYLE_OPTIONS,
  getAvailableCharacterFormatOptions,
} from '@/lib/character-builder';
import {
  AUDIO_INTENSITY_VALUES,
  AUDIO_LANGUAGE_VALUES,
  AUDIO_MOOD_VALUES,
  AUDIO_VOICE_DELIVERY_VALUES,
  AUDIO_VOICE_GENDER_VALUES,
  AUDIO_VOICE_PROFILE_VALUES,
  getAudioPackConfig,
} from '@/lib/audio-generation';
import { FieldLabel, NumberControl, SelectControl } from './NodeInspectorControls';
import baseStyles from '../maxvideoai-editor.module.css';
import inspectorStyles from '../_styles/inspector.module.css';
import type { WorkspacePolicyControlField, WorkspaceShotSettings } from '../_lib/workspace-types';
import type { WorkspaceShotInspectorSection } from '../_lib/workspace-shot-inspector-helpers';
import { normalizeWorkspaceCharacterBuilderSettings } from '../_lib/workspace-tool-settings';
import type { StudioControlCopy } from '../../_lib/studio-copy';

const styles = { ...baseStyles, ...inspectorStyles };

type ShotNodeToolSectionsProps = {
  copy: StudioControlCopy;
  shot: WorkspaceShotSettings;
  sections: WorkspaceShotInspectorSection[];
  controlFields: WorkspacePolicyControlField[];
  onPatchShot: (patch: Partial<WorkspaceShotSettings>) => void;
};

function renderToolSection(title: string, children: ReactNode) {
  return (
    <div className={styles.connectedList}>
      <div className={styles.sectionHeading}>
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

type StudioControlOptionKey = keyof StudioControlCopy['options'];

const CHARACTER_OUTPUT_COPY_KEYS = {
  'portrait-reference': 'characterPortraitReference',
  'character-sheet': 'characterSheet',
} as const satisfies Record<string, StudioControlOptionKey>;
const CHARACTER_CONSISTENCY_COPY_KEYS = {
  exploratory: 'characterExploratory',
  balanced: 'characterBalanced',
  strict: 'characterStrict',
} as const satisfies Record<string, StudioControlOptionKey>;
const CHARACTER_REFERENCE_COPY_KEYS = {
  loose: 'characterLoose',
  balanced: 'characterBalanced',
  strong: 'characterStrong',
} as const satisfies Record<string, StudioControlOptionKey>;
const CHARACTER_QUALITY_COPY_KEYS = {
  draft: 'characterStandard',
  final: 'characterPro',
} as const satisfies Record<string, StudioControlOptionKey>;
const REALISM_COPY_KEYS = {
  photoreal: 'realismPhotoreal',
  cinematic: 'realismCinematic',
  stylized: 'realismStylized',
  animated: 'realismAnimated',
} as const satisfies Record<string, StudioControlOptionKey>;
const AUDIO_MOOD_COPY_KEYS = {
  epic: 'moodEpic',
  tense: 'moodTense',
  intimate: 'moodIntimate',
  dark: 'moodDark',
  dreamy: 'moodDreamy',
  'sci-fi': 'moodSciFi',
  documentary: 'moodDocumentary',
} as const satisfies Record<string, StudioControlOptionKey>;
const AUDIO_INTENSITY_COPY_KEYS = {
  subtle: 'intensitySubtle',
  standard: 'intensityStandard',
  intense: 'intensityIntense',
} as const satisfies Record<string, StudioControlOptionKey>;
const AUDIO_GENDER_COPY_KEYS = {
  female: 'genderFemale',
  male: 'genderMale',
  neutral: 'genderNeutral',
} as const satisfies Record<string, StudioControlOptionKey>;
const AUDIO_PROFILE_COPY_KEYS = {
  balanced: 'profileBalanced',
  warm: 'profileWarm',
  bright: 'profileBright',
  deep: 'profileDeep',
} as const satisfies Record<string, StudioControlOptionKey>;
const AUDIO_DELIVERY_COPY_KEYS = {
  natural: 'deliveryNatural',
  cinematic: 'deliveryCinematic',
  trailer: 'deliveryTrailer',
  intimate: 'deliveryIntimate',
} as const satisfies Record<string, StudioControlOptionKey>;
const AUDIO_LANGUAGE_COPY_KEYS = {
  auto: 'languageAuto',
  english: 'languageEnglish',
  french: 'languageFrench',
  spanish: 'languageSpanish',
  german: 'languageGerman',
} as const satisfies Record<string, StudioControlOptionKey>;
type SpecializedOptionKey = keyof StudioControlCopy['specialized']['options'];
const HAIR_COLOR_COPY_KEYS: Record<string, SpecializedOptionKey> = {
  black: 'hairBlack',
  'dark-brown': 'hairDarkBrown',
  brown: 'hairBrown',
  blonde: 'hairBlonde',
  red: 'hairRed',
  gray: 'hairGray',
  fantasy: 'hairFantasy',
};
const HAIR_LENGTH_COPY_KEYS: Record<string, SpecializedOptionKey> = {
  short: 'hairShort',
  medium: 'hairMedium',
  long: 'hairLong',
  'very-long': 'hairVeryLong',
};
const HAIRSTYLE_COPY_KEYS: Record<string, SpecializedOptionKey> = {
  straight: 'hairStraight',
  'wavy-bob': 'hairWavyBob',
  curly: 'hairCurly',
  ponytail: 'hairPonytail',
  braids: 'hairBraids',
  'buzz-cut': 'hairBuzzCut',
  afro: 'hairAfro',
  'tied-back': 'hairTiedBack',
};
const OUTFIT_STYLE_COPY_KEYS: Record<string, SpecializedOptionKey> = {
  casual: 'outfitCasual',
  business: 'outfitBusiness',
  streetwear: 'outfitStreetwear',
  formal: 'outfitFormal',
  luxury: 'outfitLuxury',
  'sci-fi': 'outfitSciFi',
  fantasy: 'outfitFantasy',
  tactical: 'outfitTactical',
};
const ACCESSORY_COPY_KEYS: Record<string, SpecializedOptionKey> = {
  glasses: 'accessoryGlasses',
  sunglasses: 'accessorySunglasses',
  earrings: 'accessoryEarrings',
  necklace: 'accessoryNecklace',
  hat: 'accessoryHat',
  headscarf: 'accessoryHeadscarf',
};

function renderBooleanRow(
  copy: StudioControlCopy,
  label: string,
  checked: boolean,
  onChange: (value: boolean) => void
) {
  return (
    <div className={styles.toggleRow}>
      <span>{label}</span>
      <button type="button" className={checked ? styles.toggleActive : ''} onClick={() => onChange(!checked)}>
        {checked ? copy.options.on : copy.options.off}
      </button>
    </div>
  );
}

function renderCharacterBuilderSection(
  copy: StudioControlCopy,
  shot: WorkspaceShotSettings,
  onPatchShot: (patch: Partial<WorkspaceShotSettings>) => void,
  has: (field: WorkspacePolicyControlField) => boolean
) {
  const characterSettings = normalizeWorkspaceCharacterBuilderSettings(shot.toolSettings?.characterBuilder);
  const patchCharacter = (patch: Partial<typeof characterSettings>) => {
    onPatchShot({
      toolSettings: {
        ...shot.toolSettings,
        characterBuilder: { ...characterSettings, ...patch },
      },
    });
  };
  const patchTraits = (patch: Partial<typeof characterSettings.traits>) => {
    patchCharacter({ traits: { ...characterSettings.traits, ...patch } });
  };
  const patchOutputOptions = (patch: Partial<typeof characterSettings.outputOptions>) => {
    patchCharacter({ outputOptions: { ...characterSettings.outputOptions, ...patch } });
  };
  const formatOptions = getAvailableCharacterFormatOptions(characterSettings.qualityMode);

  return renderToolSection(copy.specialized.sections.characterBuilder, (
    <>
      <div className={styles.settingsGrid}>
        {has('characterOutputMode') ? <FieldLabel>
          {copy.labels.characterOutputMode}
          <SelectControl value={characterSettings.outputMode} onChange={(value) => patchCharacter({ outputMode: value as typeof characterSettings.outputMode })}>
            {CHARACTER_OUTPUT_OPTIONS.map((option) => <option key={option.id} value={option.id}>{copy.options[CHARACTER_OUTPUT_COPY_KEYS[option.id]]}</option>)}
          </SelectControl>
        </FieldLabel> : null}
        {has('characterQualityMode') ? <FieldLabel>
          {copy.labels.characterQualityMode}
          <SelectControl value={characterSettings.qualityMode} onChange={(value) => patchCharacter({ qualityMode: value as typeof characterSettings.qualityMode })}>
            {CHARACTER_QUALITY_OPTIONS.map((option) => <option key={option.id} value={option.id}>{copy.options[CHARACTER_QUALITY_COPY_KEYS[option.id]]}</option>)}
          </SelectControl>
        </FieldLabel> : null}
        {has('characterFormatMode') ? <FieldLabel>
          {copy.labels.characterFormatMode}
          <SelectControl value={characterSettings.formatMode} onChange={(value) => patchCharacter({ formatMode: value as typeof characterSettings.formatMode })}>
            {formatOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </SelectControl>
        </FieldLabel> : null}
        {has('outputCount') ? <FieldLabel>
          {copy.labels.outputCount}
          <SelectControl value={characterSettings.generateCount} onChange={(value) => patchCharacter({ generateCount: Number(value) === 4 ? 4 : 1 })}>
            <option value={1}>1</option>
            <option value={4}>4</option>
          </SelectControl>
        </FieldLabel> : null}
        {has('characterConsistencyMode') ? <FieldLabel>
          {copy.labels.characterConsistencyMode}
          <SelectControl value={characterSettings.consistencyMode} onChange={(value) => patchCharacter({ consistencyMode: value as typeof characterSettings.consistencyMode })}>
            {CHARACTER_CONSISTENCY_OPTIONS.map((option) => <option key={option.id} value={option.id}>{copy.options[CHARACTER_CONSISTENCY_COPY_KEYS[option.id]]}</option>)}
          </SelectControl>
        </FieldLabel> : null}
        {has('characterReferenceStrength') ? <FieldLabel>
          {copy.labels.characterReferenceStrength}
          <SelectControl value={characterSettings.referenceStrength} onChange={(value) => patchCharacter({ referenceStrength: value as typeof characterSettings.referenceStrength })}>
            {CHARACTER_REFERENCE_STRENGTH_OPTIONS.map((option) => <option key={option.id} value={option.id}>{copy.options[CHARACTER_REFERENCE_COPY_KEYS[option.id]]}</option>)}
          </SelectControl>
        </FieldLabel> : null}
        {has('characterTraits') ? <FieldLabel>
          {copy.labels.characterTraits}
          <SelectControl value={characterSettings.traits.realismStyle} onChange={(value) => patchTraits({ realismStyle: value as typeof characterSettings.traits.realismStyle })}>
            {REALISM_STYLE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{copy.options[REALISM_COPY_KEYS[option.id]]}</option>)}
          </SelectControl>
        </FieldLabel> : null}
      </div>
      {has('characterTraits') ? renderBooleanRow(copy, copy.specialized.labels.hair, characterSettings.traits.hairEnabled, (hairEnabled) => patchTraits({ hairEnabled })) : null}
      {has('characterTraits') && characterSettings.traits.hairEnabled ? (
        <div className={styles.settingsGrid}>
          <FieldLabel>
            {copy.specialized.labels.hairColor}
            <SelectControl value={characterSettings.traits.hairColor.value ?? ''} onChange={(value) => patchTraits({ hairColor: { value, source: 'manual' } })}>
              <option value="">{copy.specialized.options.auto}</option>
              {HAIR_COLOR_OPTIONS.map((option) => <option key={option.id} value={option.id}>{copy.specialized.options[HAIR_COLOR_COPY_KEYS[option.id]]}</option>)}
            </SelectControl>
          </FieldLabel>
          <FieldLabel>
            {copy.specialized.labels.hairLength}
            <SelectControl value={characterSettings.traits.hairLength.value ?? ''} onChange={(value) => patchTraits({ hairLength: { value, source: 'manual' } })}>
              <option value="">{copy.specialized.options.auto}</option>
              {HAIR_LENGTH_OPTIONS.map((option) => <option key={option.id} value={option.id}>{copy.specialized.options[HAIR_LENGTH_COPY_KEYS[option.id]]}</option>)}
            </SelectControl>
          </FieldLabel>
          <FieldLabel>
            {copy.specialized.labels.hairstyle}
            <SelectControl value={characterSettings.traits.hairstyle.value ?? ''} onChange={(value) => patchTraits({ hairstyle: { value, source: 'manual' } })}>
              <option value="">{copy.specialized.options.auto}</option>
              {HAIRSTYLE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{copy.specialized.options[HAIRSTYLE_COPY_KEYS[option.id]]}</option>)}
            </SelectControl>
          </FieldLabel>
        </div>
      ) : null}
      {has('characterTraits') ? renderBooleanRow(copy, copy.specialized.labels.outfit, characterSettings.traits.outfitEnabled, (outfitEnabled) => patchTraits({ outfitEnabled })) : null}
      {has('characterTraits') && characterSettings.traits.outfitEnabled ? (
        <FieldLabel>
          {copy.specialized.labels.outfitStyle}
          <SelectControl value={characterSettings.traits.outfitStyle.value ?? ''} onChange={(value) => patchTraits({ outfitStyle: { value, source: 'manual' } })}>
            <option value="">{copy.specialized.options.open}</option>
            {OUTFIT_STYLE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{copy.specialized.options[OUTFIT_STYLE_COPY_KEYS[option.id]]}</option>)}
          </SelectControl>
        </FieldLabel>
      ) : null}
      {has('characterTraits') ? <FieldLabel>
        {copy.specialized.labels.accessories}
        <SelectControl value={characterSettings.traits.accessories[0] ?? ''} onChange={(value) => patchTraits({ accessories: value ? [value] : [] })}>
          <option value="">{copy.specialized.options.none}</option>
          {ACCESSORY_OPTIONS.map((option) => <option key={option.id} value={option.id}>{copy.specialized.options[ACCESSORY_COPY_KEYS[option.id]]}</option>)}
        </SelectControl>
      </FieldLabel> : null}
      {has('characterTraits') ? renderBooleanRow(copy, copy.specialized.labels.closeUps, characterSettings.outputOptions.includeCloseUps, (includeCloseUps) => patchOutputOptions({ includeCloseUps })) : null}
      {has('characterTraits') ? renderBooleanRow(copy, copy.specialized.labels.neutralBackground, characterSettings.outputOptions.neutralStudioBackground, (neutralStudioBackground) => patchOutputOptions({ neutralStudioBackground })) : null}
      {has('characterTraits') ? renderBooleanRow(copy, copy.specialized.labels.preserveFaceDetails, characterSettings.outputOptions.preserveFacialDetails, (preserveFacialDetails) => patchOutputOptions({ preserveFacialDetails })) : null}
      {has('characterTraits') ? renderBooleanRow(copy, copy.specialized.labels.avoid3dRenderLook, characterSettings.outputOptions.avoid3dRenderLook, (avoid3dRenderLook) => patchOutputOptions({ avoid3dRenderLook })) : null}
      {has('characterTraits') ? <FieldLabel>
        {copy.specialized.labels.notes}
        <textarea className={styles.settingsInput} value={characterSettings.advancedNotes} rows={3} onChange={(event) => patchCharacter({ advancedNotes: event.currentTarget.value })} />
      </FieldLabel> : null}
      {has('characterTraits') ? <FieldLabel>
        {copy.specialized.labels.mustRemainVisible}
        <input className={styles.settingsInput} value={characterSettings.mustRemainVisible.join(', ')} onChange={(event) => patchCharacter({ mustRemainVisible: event.currentTarget.value.split(',').map((entry) => entry.trim()).filter(Boolean) })} />
      </FieldLabel> : null}
    </>
  ));
}

function renderAngleSection(copy: StudioControlCopy, shot: WorkspaceShotSettings, onPatchShot: (patch: Partial<WorkspaceShotSettings>) => void, has: (field: WorkspacePolicyControlField) => boolean) {
  const angle = shot.toolSettings?.angle ?? { rotation: 35, tilt: 0, zoom: 1, safeMode: true, generateBestAngles: false };
  const patchAngle = (patch: Partial<typeof angle>) => onPatchShot({ toolSettings: { ...shot.toolSettings, angle: { ...angle, ...patch } } });
  return renderToolSection(copy.specialized.sections.angleControls, (
    <>
      <div className={styles.settingsGrid}>
        {has('angleRotation') ? <FieldLabel>{copy.labels.angleRotation}<NumberControl value={angle.rotation} min={0} max={360} onChange={(rotation) => patchAngle({ rotation })} /></FieldLabel> : null}
        {has('angleTilt') ? <FieldLabel>{copy.labels.angleTilt}<NumberControl value={angle.tilt} min={-30} max={30} onChange={(tilt) => patchAngle({ tilt })} /></FieldLabel> : null}
        {has('angleZoom') ? <FieldLabel>{copy.labels.angleZoom}<NumberControl value={angle.zoom} min={0} max={10} step={0.1} onChange={(zoom) => patchAngle({ zoom })} /></FieldLabel> : null}
      </div>
      {has('angleSafeMode') ? renderBooleanRow(copy, copy.labels.angleSafeMode, angle.safeMode, (safeMode) => patchAngle({ safeMode })) : null}
      {has('angleBestAngles') ? renderBooleanRow(copy, copy.labels.angleBestAngles, angle.generateBestAngles, (generateBestAngles) => patchAngle({ generateBestAngles })) : null}
    </>
  ));
}

function renderUpscaleSection(copy: StudioControlCopy, shot: WorkspaceShotSettings, onPatchShot: (patch: Partial<WorkspaceShotSettings>) => void, has: (field: WorkspacePolicyControlField) => boolean) {
  const upscale = shot.toolSettings?.upscale ?? { mode: 'target' as const, upscaleFactor: 2 as const, outputFormat: shot.outputKind === 'video' ? 'mp4' : 'png' };
  const patchUpscale = (patch: Partial<typeof upscale>) => onPatchShot({ toolSettings: { ...shot.toolSettings, upscale: { ...upscale, ...patch } } });
  return renderToolSection(copy.specialized.sections.upscale, (
    <div className={styles.settingsGrid}>
      {has('upscaleMode') ? <FieldLabel>
        {copy.labels.upscaleMode}
        <SelectControl value={upscale.mode} onChange={(value) => patchUpscale({ mode: value === 'factor' ? 'factor' : 'target' })}>
          <option value="target">{copy.options.upscaleTarget}</option>
          <option value="factor">{copy.options.upscaleFactor}</option>
        </SelectControl>
      </FieldLabel> : null}
      {has('upscaleFactor') ? <FieldLabel>
        {copy.labels.upscaleFactor}
        <SelectControl value={upscale.upscaleFactor} onChange={(value) => patchUpscale({ upscaleFactor: Number(value) === 4 ? 4 : 2 })}>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
        </SelectControl>
      </FieldLabel> : null}
      {has('outputFormat') ? <FieldLabel>
        {copy.labels.outputFormat}
        <SelectControl value={upscale.outputFormat ?? ''} onChange={(outputFormat) => patchUpscale({ outputFormat })}>
          {(shot.outputKind === 'video' ? ['mp4', 'webm', 'mov'] : ['png', 'jpg', 'webp']).map((format) => <option key={format} value={format}>{format.toUpperCase()}</option>)}
        </SelectControl>
      </FieldLabel> : null}
    </div>
  ));
}

function renderStoryboardSection(copy: StudioControlCopy, shot: WorkspaceShotSettings, onPatchShot: (patch: Partial<WorkspaceShotSettings>) => void, has: (field: WorkspacePolicyControlField) => boolean) {
  const storyboard = shot.toolSettings?.storyboard ?? {
    targetModel: 'seedance' as const,
    lengthPreset: 'medium' as const,
    frameCount: 6 as const,
    durationSec: 10 as const,
    orientation: 'landscape' as const,
    tier: '4k' as const,
  };
  const patchStoryboard = (patch: Partial<typeof storyboard>) => onPatchShot({ toolSettings: { ...shot.toolSettings, storyboard: { ...storyboard, ...patch } } });
  return renderToolSection(copy.specialized.sections.storyboard, (
    <div className={styles.settingsGrid}>
      {has('tool.storyboard.targetModel') ? <FieldLabel>{copy.labels.storyboardTargetModel}<SelectControl value={storyboard.targetModel} onChange={(value) => patchStoryboard({ targetModel: value === 'kling' ? 'kling' : 'seedance' })}><option value="seedance">Seedance</option><option value="kling">Kling</option></SelectControl></FieldLabel> : null}
      {has('tool.storyboard.durationSec') ? <FieldLabel>{copy.labels.storyboardDurationSec}<SelectControl value={storyboard.durationSec} onChange={(value) => patchStoryboard({ durationSec: Number(value) as typeof storyboard.durationSec })}>{[6, 10, 15].map((value) => <option key={value} value={value}>{value}s</option>)}</SelectControl></FieldLabel> : null}
      {has('tool.storyboard.frameCount') ? <FieldLabel>{copy.labels.storyboardFrameCount}<SelectControl value={storyboard.frameCount} onChange={(value) => patchStoryboard({ frameCount: Number(value) as typeof storyboard.frameCount })}>{[4, 6, 8].map((value) => <option key={value} value={value}>{value}</option>)}</SelectControl></FieldLabel> : null}
      {has('tool.storyboard.orientation') ? <FieldLabel>{copy.labels.storyboardOrientation}<SelectControl value={storyboard.orientation} onChange={(value) => patchStoryboard({ orientation: value === 'portrait' ? 'portrait' : 'landscape' })}><option value="landscape">{copy.options.landscape}</option><option value="portrait">{copy.options.portrait}</option></SelectControl></FieldLabel> : null}
      {has('tool.storyboard.tier') ? <FieldLabel>{copy.labels.storyboardTier}<SelectControl value={storyboard.tier} onChange={(value) => patchStoryboard({ tier: value as typeof storyboard.tier })}>{['hd', '4k', 'ultra'].map((value) => <option key={value} value={value}>{value.toUpperCase()}</option>)}</SelectControl></FieldLabel> : null}
    </div>
  ));
}

function renderAudioSection(
  copy: StudioControlCopy,
  shot: WorkspaceShotSettings,
  onPatchShot: (patch: Partial<WorkspaceShotSettings>) => void,
  has: (field: WorkspacePolicyControlField) => boolean
) {
  const audio = shot.toolSettings?.audio ?? {
    mood: 'epic' as const,
    intensity: 'standard' as const,
    musicEnabled: shot.workflowType === 'sfx_generation' ? false : getAudioPackConfig(shot.workflowType === 'cinematic_voiceover' ? 'cinematic_voice' : shot.workflowType === 'cinematic_audio' ? 'cinematic' : shot.workflowType === 'voiceover_generation' ? 'voice_only' : 'music_only').defaultMusicEnabled,
    voiceGender: 'neutral' as const,
    voiceProfile: 'balanced' as const,
    voiceDelivery: 'natural' as const,
    language: 'auto' as const,
  };
  const patchAudio = (patch: Partial<typeof audio>) => onPatchShot({ toolSettings: { ...shot.toolSettings, audio: { ...audio, ...patch } } });
  const includesVoice = shot.workflowType === 'voiceover_generation' || shot.workflowType === 'cinematic_voiceover';

  return renderToolSection(copy.specialized.sections.audio, (
    <>
      <div className={styles.settingsGrid}>
        {has('audioMood') ? <FieldLabel>{copy.labels.audioMood}<SelectControl value={audio.mood} onChange={(value) => patchAudio({ mood: value as typeof audio.mood })}>{AUDIO_MOOD_VALUES.map((value) => <option key={value} value={value}>{copy.options[AUDIO_MOOD_COPY_KEYS[value]]}</option>)}</SelectControl></FieldLabel> : null}
        {has('audioIntensity') ? <FieldLabel>{copy.labels.audioIntensity}<SelectControl value={audio.intensity} onChange={(value) => patchAudio({ intensity: value as typeof audio.intensity })}>{AUDIO_INTENSITY_VALUES.map((value) => <option key={value} value={value}>{copy.options[AUDIO_INTENSITY_COPY_KEYS[value]]}</option>)}</SelectControl></FieldLabel> : null}
      </div>
      {has('audioMusicEnabled') && (shot.workflowType === 'cinematic_audio' || shot.workflowType === 'cinematic_voiceover') ? renderBooleanRow(copy, copy.labels.audioMusicEnabled, audio.musicEnabled, (musicEnabled) => patchAudio({ musicEnabled })) : null}
      {includesVoice ? (
        <div className={styles.settingsGrid}>
          {has('voiceGender') ? <FieldLabel>{copy.labels.voiceGender}<SelectControl value={audio.voiceGender} onChange={(value) => patchAudio({ voiceGender: value as typeof audio.voiceGender })}>{AUDIO_VOICE_GENDER_VALUES.map((value) => <option key={value} value={value}>{copy.options[AUDIO_GENDER_COPY_KEYS[value]]}</option>)}</SelectControl></FieldLabel> : null}
          {has('voiceProfile') ? <FieldLabel>{copy.labels.voiceProfile}<SelectControl value={audio.voiceProfile} onChange={(value) => patchAudio({ voiceProfile: value as typeof audio.voiceProfile })}>{AUDIO_VOICE_PROFILE_VALUES.map((value) => <option key={value} value={value}>{copy.options[AUDIO_PROFILE_COPY_KEYS[value]]}</option>)}</SelectControl></FieldLabel> : null}
          {has('voiceDelivery') ? <FieldLabel>{copy.labels.voiceDelivery}<SelectControl value={audio.voiceDelivery} onChange={(value) => patchAudio({ voiceDelivery: value as typeof audio.voiceDelivery })}>{AUDIO_VOICE_DELIVERY_VALUES.map((value) => <option key={value} value={value}>{copy.options[AUDIO_DELIVERY_COPY_KEYS[value]]}</option>)}</SelectControl></FieldLabel> : null}
          {has('audioLanguage') ? <FieldLabel>{copy.labels.audioLanguage}<SelectControl value={audio.language} onChange={(value) => patchAudio({ language: value as typeof audio.language })}>{AUDIO_LANGUAGE_VALUES.map((value) => <option key={value} value={value}>{copy.options[AUDIO_LANGUAGE_COPY_KEYS[value]]}</option>)}</SelectControl></FieldLabel> : null}
        </div>
      ) : null}
    </>
  ));
}

export function ShotNodeToolSections({ copy, shot, sections, controlFields, onPatchShot }: ShotNodeToolSectionsProps) {
  const has = (field: WorkspacePolicyControlField) => controlFields.includes(field);
  const hasAny = (...fields: WorkspacePolicyControlField[]) => fields.some(has);
  return (
    <>
      {sections.includes('character-builder') && hasAny('characterOutputMode', 'characterConsistencyMode', 'characterQualityMode', 'characterFormatMode', 'characterReferenceStrength', 'characterTraits', 'outputCount') ? renderCharacterBuilderSection(copy, shot, onPatchShot, has) : null}
      {sections.includes('angle-controls') && hasAny('angleRotation', 'angleTilt', 'angleZoom', 'angleSafeMode', 'angleBestAngles') ? renderAngleSection(copy, shot, onPatchShot, has) : null}
      {sections.includes('upscale') && hasAny('upscaleMode', 'upscaleFactor', 'outputFormat') ? renderUpscaleSection(copy, shot, onPatchShot, has) : null}
      {sections.includes('storyboard') && hasAny('tool.storyboard.targetModel', 'tool.storyboard.frameCount', 'tool.storyboard.durationSec', 'tool.storyboard.orientation', 'tool.storyboard.tier') ? renderStoryboardSection(copy, shot, onPatchShot, has) : null}
      {sections.includes('audio-pack') && hasAny('audioMood', 'audioIntensity', 'audioMusicEnabled', 'voiceGender', 'voiceProfile', 'voiceDelivery', 'audioLanguage') ? renderAudioSection(copy, shot, onPatchShot, has) : null}
    </>
  );
}
