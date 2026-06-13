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
import type { WorkspaceShotSettings } from '../_lib/workspace-types';
import type { WorkspaceShotInspectorSection } from '../_lib/workspace-shot-inspector-helpers';
import { normalizeWorkspaceCharacterBuilderSettings } from '../_lib/workspace-tool-settings';

const styles = { ...baseStyles, ...inspectorStyles };

type ShotNodeToolSectionsProps = {
  shot: WorkspaceShotSettings;
  sections: WorkspaceShotInspectorSection[];
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

function renderBooleanRow(label: string, checked: boolean, onChange: (value: boolean) => void) {
  return (
    <div className={styles.toggleRow}>
      <span>{label}</span>
      <button type="button" className={checked ? styles.toggleActive : ''} onClick={() => onChange(!checked)}>
        {checked ? 'On' : 'Off'}
      </button>
    </div>
  );
}

function renderCharacterBuilderSection(
  shot: WorkspaceShotSettings,
  onPatchShot: (patch: Partial<WorkspaceShotSettings>) => void
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

  return renderToolSection('Character Builder', (
    <>
      <div className={styles.settingsGrid}>
        <FieldLabel>
          Output
          <SelectControl value={characterSettings.outputMode} onChange={(value) => patchCharacter({ outputMode: value as typeof characterSettings.outputMode })}>
            {CHARACTER_OUTPUT_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </SelectControl>
        </FieldLabel>
        <FieldLabel>
          Quality
          <SelectControl value={characterSettings.qualityMode} onChange={(value) => patchCharacter({ qualityMode: value as typeof characterSettings.qualityMode })}>
            {CHARACTER_QUALITY_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </SelectControl>
        </FieldLabel>
        <FieldLabel>
          Format
          <SelectControl value={characterSettings.formatMode} onChange={(value) => patchCharacter({ formatMode: value as typeof characterSettings.formatMode })}>
            {formatOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </SelectControl>
        </FieldLabel>
        <FieldLabel>
          Count
          <SelectControl value={characterSettings.generateCount} onChange={(value) => patchCharacter({ generateCount: Number(value) === 4 ? 4 : 1 })}>
            <option value={1}>1</option>
            <option value={4}>4</option>
          </SelectControl>
        </FieldLabel>
        <FieldLabel>
          Consistency
          <SelectControl value={characterSettings.consistencyMode} onChange={(value) => patchCharacter({ consistencyMode: value as typeof characterSettings.consistencyMode })}>
            {CHARACTER_CONSISTENCY_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </SelectControl>
        </FieldLabel>
        <FieldLabel>
          Reference
          <SelectControl value={characterSettings.referenceStrength} onChange={(value) => patchCharacter({ referenceStrength: value as typeof characterSettings.referenceStrength })}>
            {CHARACTER_REFERENCE_STRENGTH_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </SelectControl>
        </FieldLabel>
        <FieldLabel>
          Style
          <SelectControl value={characterSettings.traits.realismStyle} onChange={(value) => patchTraits({ realismStyle: value as typeof characterSettings.traits.realismStyle })}>
            {REALISM_STYLE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </SelectControl>
        </FieldLabel>
      </div>
      {renderBooleanRow('Hair', characterSettings.traits.hairEnabled, (hairEnabled) => patchTraits({ hairEnabled }))}
      {characterSettings.traits.hairEnabled ? (
        <div className={styles.settingsGrid}>
          <FieldLabel>
            Color
            <SelectControl value={characterSettings.traits.hairColor.value ?? ''} onChange={(value) => patchTraits({ hairColor: { value, source: 'manual' } })}>
              <option value="">Auto</option>
              {HAIR_COLOR_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </SelectControl>
          </FieldLabel>
          <FieldLabel>
            Length
            <SelectControl value={characterSettings.traits.hairLength.value ?? ''} onChange={(value) => patchTraits({ hairLength: { value, source: 'manual' } })}>
              <option value="">Auto</option>
              {HAIR_LENGTH_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </SelectControl>
          </FieldLabel>
          <FieldLabel>
            Style
            <SelectControl value={characterSettings.traits.hairstyle.value ?? ''} onChange={(value) => patchTraits({ hairstyle: { value, source: 'manual' } })}>
              <option value="">Auto</option>
              {HAIRSTYLE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </SelectControl>
          </FieldLabel>
        </div>
      ) : null}
      {renderBooleanRow('Outfit', characterSettings.traits.outfitEnabled, (outfitEnabled) => patchTraits({ outfitEnabled }))}
      {characterSettings.traits.outfitEnabled ? (
        <FieldLabel>
          Outfit style
          <SelectControl value={characterSettings.traits.outfitStyle.value ?? ''} onChange={(value) => patchTraits({ outfitStyle: { value, source: 'manual' } })}>
            <option value="">Open</option>
            {OUTFIT_STYLE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </SelectControl>
        </FieldLabel>
      ) : null}
      <FieldLabel>
        Accessories
        <SelectControl value={characterSettings.traits.accessories[0] ?? ''} onChange={(value) => patchTraits({ accessories: value ? [value] : [] })}>
          <option value="">None</option>
          {ACCESSORY_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </SelectControl>
      </FieldLabel>
      {renderBooleanRow('Close-ups', characterSettings.outputOptions.includeCloseUps, (includeCloseUps) => patchOutputOptions({ includeCloseUps }))}
      {renderBooleanRow('Neutral background', characterSettings.outputOptions.neutralStudioBackground, (neutralStudioBackground) => patchOutputOptions({ neutralStudioBackground }))}
      {renderBooleanRow('Preserve face details', characterSettings.outputOptions.preserveFacialDetails, (preserveFacialDetails) => patchOutputOptions({ preserveFacialDetails }))}
      {renderBooleanRow('Avoid 3D render look', characterSettings.outputOptions.avoid3dRenderLook, (avoid3dRenderLook) => patchOutputOptions({ avoid3dRenderLook }))}
      <FieldLabel>
        Notes
        <textarea className={styles.settingsInput} value={characterSettings.advancedNotes} rows={3} onChange={(event) => patchCharacter({ advancedNotes: event.currentTarget.value })} />
      </FieldLabel>
      <FieldLabel>
        Must remain visible
        <input className={styles.settingsInput} value={characterSettings.mustRemainVisible.join(', ')} onChange={(event) => patchCharacter({ mustRemainVisible: event.currentTarget.value.split(',').map((entry) => entry.trim()).filter(Boolean) })} />
      </FieldLabel>
    </>
  ));
}

function renderAngleSection(shot: WorkspaceShotSettings, onPatchShot: (patch: Partial<WorkspaceShotSettings>) => void) {
  const angle = shot.toolSettings?.angle ?? { rotation: 35, tilt: 0, zoom: 1, safeMode: true, generateBestAngles: false };
  const patchAngle = (patch: Partial<typeof angle>) => onPatchShot({ toolSettings: { ...shot.toolSettings, angle: { ...angle, ...patch } } });
  return renderToolSection('Angle controls', (
    <>
      <div className={styles.settingsGrid}>
        <FieldLabel>Rotation<NumberControl value={angle.rotation} min={0} max={360} onChange={(rotation) => patchAngle({ rotation })} /></FieldLabel>
        <FieldLabel>Tilt<NumberControl value={angle.tilt} min={-30} max={30} onChange={(tilt) => patchAngle({ tilt })} /></FieldLabel>
        <FieldLabel>Zoom<NumberControl value={angle.zoom} min={0} max={10} step={0.1} onChange={(zoom) => patchAngle({ zoom })} /></FieldLabel>
      </div>
      {renderBooleanRow('Safe mode', angle.safeMode, (safeMode) => patchAngle({ safeMode }))}
      {renderBooleanRow('4 best angles', angle.generateBestAngles, (generateBestAngles) => patchAngle({ generateBestAngles }))}
    </>
  ));
}

function renderUpscaleSection(shot: WorkspaceShotSettings, onPatchShot: (patch: Partial<WorkspaceShotSettings>) => void) {
  const upscale = shot.toolSettings?.upscale ?? { mode: 'target' as const, upscaleFactor: 2 as const, outputFormat: shot.outputKind === 'video' ? 'mp4' : 'png' };
  const patchUpscale = (patch: Partial<typeof upscale>) => onPatchShot({ toolSettings: { ...shot.toolSettings, upscale: { ...upscale, ...patch } } });
  return renderToolSection('Upscale', (
    <div className={styles.settingsGrid}>
      <FieldLabel>
        Mode
        <SelectControl value={upscale.mode} onChange={(value) => patchUpscale({ mode: value === 'factor' ? 'factor' : 'target' })}>
          <option value="target">Target</option>
          <option value="factor">Factor</option>
        </SelectControl>
      </FieldLabel>
      <FieldLabel>
        Factor
        <SelectControl value={upscale.upscaleFactor} onChange={(value) => patchUpscale({ upscaleFactor: Number(value) === 4 ? 4 : 2 })}>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
        </SelectControl>
      </FieldLabel>
      <FieldLabel>
        Format
        <SelectControl value={upscale.outputFormat ?? ''} onChange={(outputFormat) => patchUpscale({ outputFormat })}>
          {(shot.outputKind === 'video' ? ['mp4', 'webm', 'mov'] : ['png', 'jpg', 'webp']).map((format) => <option key={format} value={format}>{format.toUpperCase()}</option>)}
        </SelectControl>
      </FieldLabel>
    </div>
  ));
}

function renderStoryboardSection(shot: WorkspaceShotSettings, onPatchShot: (patch: Partial<WorkspaceShotSettings>) => void) {
  const storyboard = shot.toolSettings?.storyboard ?? {
    targetModel: 'seedance' as const,
    lengthPreset: 'medium' as const,
    frameCount: 6 as const,
    durationSec: 10 as const,
    orientation: 'landscape' as const,
    tier: '4k' as const,
  };
  const patchStoryboard = (patch: Partial<typeof storyboard>) => onPatchShot({ toolSettings: { ...shot.toolSettings, storyboard: { ...storyboard, ...patch } } });
  return renderToolSection('Storyboard', (
    <div className={styles.settingsGrid}>
      <FieldLabel>Target<SelectControl value={storyboard.targetModel} onChange={(value) => patchStoryboard({ targetModel: value === 'kling' ? 'kling' : 'seedance' })}><option value="seedance">Seedance</option><option value="kling">Kling</option></SelectControl></FieldLabel>
      <FieldLabel>Length<SelectControl value={storyboard.lengthPreset} onChange={(value) => patchStoryboard({ lengthPreset: value as typeof storyboard.lengthPreset })}>{['short', 'medium', 'long'].map((value) => <option key={value} value={value}>{value}</option>)}</SelectControl></FieldLabel>
      <FieldLabel>Frames<SelectControl value={storyboard.frameCount} onChange={(value) => patchStoryboard({ frameCount: Number(value) as typeof storyboard.frameCount })}>{[4, 6, 8].map((value) => <option key={value} value={value}>{value}</option>)}</SelectControl></FieldLabel>
      <FieldLabel>Orientation<SelectControl value={storyboard.orientation} onChange={(value) => patchStoryboard({ orientation: value === 'portrait' ? 'portrait' : 'landscape' })}><option value="landscape">Landscape</option><option value="portrait">Portrait</option></SelectControl></FieldLabel>
      <FieldLabel>Tier<SelectControl value={storyboard.tier} onChange={(value) => patchStoryboard({ tier: value as typeof storyboard.tier })}>{['hd', '4k', 'ultra'].map((value) => <option key={value} value={value}>{value.toUpperCase()}</option>)}</SelectControl></FieldLabel>
    </div>
  ));
}

function renderAudioSection(shot: WorkspaceShotSettings, onPatchShot: (patch: Partial<WorkspaceShotSettings>) => void) {
  const audio = shot.toolSettings?.audio ?? {
    mood: 'epic' as const,
    intensity: 'standard' as const,
    musicEnabled: getAudioPackConfig(shot.workflowType === 'cinematic_voiceover' ? 'cinematic_voice' : shot.workflowType === 'cinematic_audio' ? 'cinematic' : shot.workflowType === 'voiceover_generation' ? 'voice_only' : shot.workflowType === 'sfx_generation' ? 'sfx_only' : 'music_only').defaultMusicEnabled,
    voiceGender: 'neutral' as const,
    voiceProfile: 'balanced' as const,
    voiceDelivery: 'natural' as const,
    language: 'auto' as const,
  };
  const patchAudio = (patch: Partial<typeof audio>) => onPatchShot({ toolSettings: { ...shot.toolSettings, audio: { ...audio, ...patch } } });
  const includesVoice = shot.workflowType === 'voiceover_generation' || shot.workflowType === 'cinematic_voiceover';

  return renderToolSection('Audio', (
    <>
      <div className={styles.settingsGrid}>
        <FieldLabel>Mood<SelectControl value={audio.mood} onChange={(value) => patchAudio({ mood: value as typeof audio.mood })}>{AUDIO_MOOD_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}</SelectControl></FieldLabel>
        <FieldLabel>Intensity<SelectControl value={audio.intensity} onChange={(value) => patchAudio({ intensity: value as typeof audio.intensity })}>{AUDIO_INTENSITY_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}</SelectControl></FieldLabel>
      </div>
      {shot.workflowType === 'cinematic_audio' || shot.workflowType === 'cinematic_voiceover' ? renderBooleanRow('Music bed', audio.musicEnabled, (musicEnabled) => patchAudio({ musicEnabled })) : null}
      {includesVoice ? (
        <div className={styles.settingsGrid}>
          <FieldLabel>Voice<SelectControl value={audio.voiceGender} onChange={(value) => patchAudio({ voiceGender: value as typeof audio.voiceGender })}>{AUDIO_VOICE_GENDER_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}</SelectControl></FieldLabel>
          <FieldLabel>Profile<SelectControl value={audio.voiceProfile} onChange={(value) => patchAudio({ voiceProfile: value as typeof audio.voiceProfile })}>{AUDIO_VOICE_PROFILE_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}</SelectControl></FieldLabel>
          <FieldLabel>Delivery<SelectControl value={audio.voiceDelivery} onChange={(value) => patchAudio({ voiceDelivery: value as typeof audio.voiceDelivery })}>{AUDIO_VOICE_DELIVERY_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}</SelectControl></FieldLabel>
          <FieldLabel>Language<SelectControl value={audio.language} onChange={(value) => patchAudio({ language: value as typeof audio.language })}>{AUDIO_LANGUAGE_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}</SelectControl></FieldLabel>
        </div>
      ) : null}
    </>
  ));
}

export function ShotNodeToolSections({ shot, sections, onPatchShot }: ShotNodeToolSectionsProps) {
  return (
    <>
      {sections.includes('character-builder') ? renderCharacterBuilderSection(shot, onPatchShot) : null}
      {sections.includes('angle-controls') ? renderAngleSection(shot, onPatchShot) : null}
      {sections.includes('upscale') ? renderUpscaleSection(shot, onPatchShot) : null}
      {sections.includes('storyboard') ? renderStoryboardSection(shot, onPatchShot) : null}
      {sections.includes('audio-pack') ? renderAudioSection(shot, onPatchShot) : null}
    </>
  );
}
