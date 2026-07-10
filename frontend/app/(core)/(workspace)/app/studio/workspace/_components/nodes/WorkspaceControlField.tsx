'use client';

import type { ReactNode } from 'react';
import {
  CHARACTER_CONSISTENCY_OPTIONS,
  CHARACTER_OUTPUT_OPTIONS,
  CHARACTER_QUALITY_OPTIONS,
  CHARACTER_REFERENCE_STRENGTH_OPTIONS,
  getAvailableCharacterFormatOptions,
  REALISM_STYLE_OPTIONS,
} from '@/lib/character-builder';
import {
  AUDIO_INTENSITY_VALUES,
  AUDIO_LANGUAGE_VALUES,
  AUDIO_MOOD_VALUES,
  AUDIO_VOICE_DELIVERY_VALUES,
  AUDIO_VOICE_GENDER_VALUES,
  AUDIO_VOICE_PROFILE_VALUES,
} from '@/lib/audio-generation';
import { getDefaultStudioChatModel, getStudioChatModels } from '@/lib/studio-chat-models';
import type {
  WorkspaceChatSettings,
  WorkspaceModelCapability,
  WorkspacePolicyControlField,
  WorkspaceShotSettings,
} from '../../_lib/workspace-types';
import type { WorkspaceResolvedControl } from '../../_lib/models/workspace-block-capability-policy';
import { normalizeWorkspaceCharacterBuilderSettings } from '../../_lib/workspace-tool-settings';
import styles from './workspace-control-field.module.css';

type WorkspaceControlFieldInput = WorkspacePolicyControlField | WorkspaceResolvedControl;

export type WorkspaceControlFieldProps = {
  field: WorkspaceControlFieldInput;
  shot?: WorkspaceShotSettings;
  chat?: WorkspaceChatSettings;
  capability?: WorkspaceModelCapability | null;
  disabled?: boolean;
  disabledReason?: string;
  variant?: 'node' | 'inspector';
  label?: string;
  chatModels?: Array<{ modelId: string; label: string }>;
  onPatchShot?: (patch: Partial<WorkspaceShotSettings>) => void;
  onPatchChat?: (patch: Partial<WorkspaceChatSettings>) => void;
  onPatchPromptText?: (value: string) => void;
};

const FALLBACK_DURATIONS = [5, 7, 8, 10];
const FALLBACK_RATIOS = ['16:9', '9:16', '1:1'];
const FALLBACK_RESOLUTIONS = ['720p', '1080p'];
const FALLBACK_FPS = [24, 30];

function fieldId(field: WorkspaceControlFieldInput): WorkspacePolicyControlField | null {
  return typeof field === 'string' ? field : field.id as WorkspacePolicyControlField;
}

function fieldMetadata(field: WorkspaceControlFieldInput): Partial<Pick<WorkspaceResolvedControl, 'label' | 'disabled' | 'disabledReason' | 'reason'>> {
  return typeof field === 'string' ? {} : field;
}

function optionValues<T>(values: readonly T[] | undefined, fallback: T[]): T[] {
  return values?.length ? [...values] : fallback;
}

function defaultAngleSettings() {
  return { rotation: 35, tilt: 0, zoom: 1, safeMode: true, generateBestAngles: false };
}

function defaultUpscaleSettings(shot: WorkspaceShotSettings) {
  return {
    mode: 'target' as const,
    upscaleFactor: 2 as const,
    outputFormat: shot.outputKind === 'video' ? 'mp4' : 'png',
  };
}

function defaultAudioSettings() {
  return {
    mood: 'epic' as const,
    intensity: 'standard' as const,
    musicEnabled: false,
    voiceGender: 'neutral' as const,
    voiceProfile: 'balanced' as const,
    voiceDelivery: 'natural' as const,
    language: 'auto' as const,
  };
}

export function WorkspaceControlField({
  field,
  shot,
  chat,
  capability = null,
  disabled = false,
  disabledReason,
  variant = 'node',
  label: labelOverride,
  chatModels,
  onPatchShot,
  onPatchChat,
  onPatchPromptText,
}: WorkspaceControlFieldProps) {
  const id = fieldId(field);
  const metadata = fieldMetadata(field);
  if (!id || id === 'model' || id.startsWith('setting.')) return null;

  const isDisabled = disabled || Boolean(metadata.disabled);
  const title = disabledReason ?? metadata.disabledReason ?? metadata.reason;
  const className = `${styles.field} ${variant === 'inspector' ? styles.inspectorField : ''}`;
  const selectClassName = `${styles.select} ${variant === 'node' ? 'nodrag nowheel' : ''}`;
  const inputClassName = `${styles.input} ${variant === 'node' ? 'nodrag nowheel' : ''}`;
  const wrapChat = (label: string, control: ReactNode) => <label className={className} title={title}>{label}{control}</label>;

  if (id === 'chatProvider') {
    if (!chat || !onPatchChat) return null;
    return wrapChat(labelOverride ?? 'Provider', <select className={selectClassName} disabled={isDisabled} value={chat.provider} onChange={(event) => {
      const provider = event.currentTarget.value === 'gemini' ? 'gemini' : 'openai';
      onPatchChat({ provider, modelId: getDefaultStudioChatModel(provider).modelId });
    }}><option value="openai">OpenAI</option><option value="gemini">Gemini</option></select>);
  }
  if (id === 'chatModel') {
    if (!chat || !onPatchChat) return null;
    const models = chatModels ?? getStudioChatModels(chat.provider);
    return wrapChat(labelOverride ?? 'Model', <select className={selectClassName} disabled={isDisabled} value={chat.modelId} onChange={(event) => onPatchChat({ modelId: event.currentTarget.value })}>{models.map((model) => <option key={model.modelId} value={model.modelId}>{model.label}</option>)}</select>);
  }
  if (id === 'chatSystemPrompt') {
    if (!chat || !onPatchChat) return null;
    return wrapChat(labelOverride ?? 'System prompt', <textarea className={inputClassName} rows={4} disabled={isDisabled} value={chat.systemPrompt} onChange={(event) => onPatchChat({ systemPrompt: event.currentTarget.value })} />);
  }
  if (id === 'chatMessage') {
    if (!chat || !onPatchChat) return null;
    return wrapChat(labelOverride ?? 'Message', <textarea className={inputClassName} rows={6} disabled={isDisabled} value={chat.draftMessage} onChange={(event) => {
      const value = event.currentTarget.value;
      onPatchChat({ draftMessage: value });
      onPatchPromptText?.(value);
    }} />);
  }

  if (!shot || !onPatchShot) return null;
  const patchTool = (key: 'angle' | 'upscale' | 'audio', patch: Record<string, unknown>) => {
    const current = key === 'angle'
      ? shot.toolSettings?.angle ?? defaultAngleSettings()
      : key === 'upscale'
        ? shot.toolSettings?.upscale ?? defaultUpscaleSettings(shot)
        : shot.toolSettings?.audio ?? defaultAudioSettings();
    onPatchShot({ toolSettings: { ...shot.toolSettings, [key]: { ...current, ...patch } } });
  };
  const character = normalizeWorkspaceCharacterBuilderSettings(shot.toolSettings?.characterBuilder);
  const patchCharacter = (patch: Partial<typeof character>) => onPatchShot({
    toolSettings: { ...shot.toolSettings, characterBuilder: { ...character, ...patch } },
  });
  const labels: Partial<Record<WorkspacePolicyControlField, string>> = {
    durationSec: 'Duration', aspectRatio: 'Aspect', resolution: 'Resolution', fps: 'FPS', seed: 'Seed',
    referenceStrength: 'Reference', outputCount: 'Count', audioEnabled: 'Audio', lipSyncEnabled: 'Lip sync',
    characterOutputMode: 'Output', characterConsistencyMode: 'Consistency', characterQualityMode: 'Quality',
    characterFormatMode: 'Format', characterReferenceStrength: 'Reference', characterTraits: 'Style',
    angleRotation: 'Rotation', angleTilt: 'Tilt', angleZoom: 'Zoom', angleSafeMode: 'Safe mode', angleBestAngles: 'Best angles',
    upscaleMode: 'Mode', upscaleFactor: 'Factor', outputFormat: 'Format', audioMood: 'Mood', audioIntensity: 'Intensity',
    audioMusicEnabled: 'Music bed', voiceGender: 'Voice', voiceProfile: 'Profile', voiceDelivery: 'Delivery', audioLanguage: 'Language',
  };
  const audioOption = capability?.render_options.find((option) => option.id === 'audio');
  const lipSyncOption = capability?.render_options.find((option) => option.id === 'lip_sync');
  const label = labelOverride ?? metadata.label ?? (id === 'audioEnabled' ? audioOption?.label : id === 'lipSyncEnabled' ? lipSyncOption?.label : undefined) ?? labels[id] ?? id.replace(/^tool\./, '').replaceAll('.', ' ');
  const wrap = (control: ReactNode) => <label className={className} title={title}>{label}{control}</label>;
  const toggle = (checked: boolean, onChange: () => void) => (
    <button type="button" className={`${styles.toggle} ${checked ? styles.toggleActive : ''} ${variant === 'node' ? 'nodrag' : ''}`} disabled={isDisabled} onClick={onChange}>
      {checked ? 'On' : 'Off'}
    </button>
  );

  if (id === 'durationSec') {
    const values = optionValues(capability?.supported_durations, FALLBACK_DURATIONS);
    return wrap(<select className={selectClassName} disabled={isDisabled} value={shot.durationSec} onChange={(event) => onPatchShot({ durationSec: Number(event.currentTarget.value) })}>{values.map((value) => <option key={value} value={value}>{value}s</option>)}</select>);
  }
  if (id === 'aspectRatio') {
    const values = optionValues(capability?.supported_aspect_ratios, FALLBACK_RATIOS);
    return wrap(<select className={selectClassName} disabled={isDisabled} value={shot.aspectRatio} onChange={(event) => onPatchShot({ aspectRatio: event.currentTarget.value as WorkspaceShotSettings['aspectRatio'] })}>{values.map((value) => <option key={value} value={value}>{value}</option>)}</select>);
  }
  if (id === 'resolution') {
    const values = optionValues(capability?.supported_resolutions, FALLBACK_RESOLUTIONS);
    return wrap(<select className={selectClassName} disabled={isDisabled} value={shot.resolution} onChange={(event) => onPatchShot({ resolution: event.currentTarget.value as WorkspaceShotSettings['resolution'] })}>{values.map((value) => <option key={value} value={value}>{value}</option>)}</select>);
  }
  if (id === 'fps') {
    const values = optionValues(capability?.supported_fps, FALLBACK_FPS);
    return wrap(<select className={selectClassName} disabled={isDisabled} value={shot.fps} onChange={(event) => onPatchShot({ fps: Number(event.currentTarget.value) })}>{values.map((value) => <option key={value} value={value}>{value}</option>)}</select>);
  }
  if (id === 'seed') return wrap(<input className={inputClassName} type="number" disabled={isDisabled} value={shot.seed ?? ''} onChange={(event) => onPatchShot({ seed: event.currentTarget.value ? Number(event.currentTarget.value) : null })} />);
  if (id === 'referenceStrength') return wrap(<span className={styles.rangeControl}><input className={`${styles.range} ${variant === 'node' ? 'nodrag nowheel' : ''}`} type="range" min={0} max={1} step={0.05} disabled={isDisabled} value={shot.referenceStrength} onChange={(event) => onPatchShot({ referenceStrength: Number(event.currentTarget.value) })} /><strong>{Math.round(shot.referenceStrength * 100)}%</strong></span>);
  if (id === 'audioEnabled') {
    if (audioOption?.control === 'included') return wrap(<strong className={styles.staticValue}>Included</strong>);
    if (audioOption?.control === 'toggle') return wrap(toggle(shot.audioEnabled, () => onPatchShot({ audioEnabled: !shot.audioEnabled })));
    return null;
  }
  if (id === 'lipSyncEnabled') {
    if (lipSyncOption?.control === 'included') return wrap(<strong className={styles.staticValue}>Included</strong>);
    if (lipSyncOption?.control === 'toggle') return wrap(toggle(shot.lipSyncEnabled, () => onPatchShot({ lipSyncEnabled: !shot.lipSyncEnabled })));
    return null;
  }
  if (id === 'outputCount') {
    if (shot.toolKind !== 'character-builder') return wrap(<strong className={styles.staticValue}>{typeof capability?.output_count === 'number' ? capability.output_count : `${capability?.output_count?.min ?? 1}-${capability?.output_count?.max ?? 1}`}</strong>);
    return wrap(<select className={selectClassName} disabled={isDisabled} value={character.generateCount} onChange={(event) => patchCharacter({ generateCount: Number(event.currentTarget.value) === 4 ? 4 : 1 })}><option value={1}>1</option><option value={4}>4</option></select>);
  }
  if (id === 'characterOutputMode') return wrap(<select className={selectClassName} disabled={isDisabled} value={character.outputMode} onChange={(event) => patchCharacter({ outputMode: event.currentTarget.value as typeof character.outputMode })}>{CHARACTER_OUTPUT_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>);
  if (id === 'characterConsistencyMode') return wrap(<select className={selectClassName} disabled={isDisabled} value={character.consistencyMode} onChange={(event) => patchCharacter({ consistencyMode: event.currentTarget.value as typeof character.consistencyMode })}>{CHARACTER_CONSISTENCY_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>);
  if (id === 'characterQualityMode') return wrap(<select className={selectClassName} disabled={isDisabled} value={character.qualityMode} onChange={(event) => patchCharacter({ qualityMode: event.currentTarget.value as typeof character.qualityMode })}>{CHARACTER_QUALITY_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>);
  if (id === 'characterFormatMode') return wrap(<select className={selectClassName} disabled={isDisabled} value={character.formatMode} onChange={(event) => patchCharacter({ formatMode: event.currentTarget.value as typeof character.formatMode })}>{getAvailableCharacterFormatOptions(character.qualityMode).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>);
  if (id === 'characterReferenceStrength') return wrap(<select className={selectClassName} disabled={isDisabled} value={character.referenceStrength} onChange={(event) => patchCharacter({ referenceStrength: event.currentTarget.value as typeof character.referenceStrength })}>{CHARACTER_REFERENCE_STRENGTH_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>);
  if (id === 'characterTraits') return wrap(<select className={selectClassName} disabled={isDisabled} value={character.traits.realismStyle} onChange={(event) => patchCharacter({ traits: { ...character.traits, realismStyle: event.currentTarget.value as typeof character.traits.realismStyle } })}>{REALISM_STYLE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>);

  const angle = shot.toolSettings?.angle ?? defaultAngleSettings();
  if (id === 'angleRotation') return wrap(<input className={inputClassName} type="number" min={0} max={360} disabled={isDisabled} value={angle.rotation} onChange={(event) => patchTool('angle', { rotation: Number(event.currentTarget.value) })} />);
  if (id === 'angleTilt') return wrap(<input className={inputClassName} type="number" min={-30} max={30} disabled={isDisabled} value={angle.tilt} onChange={(event) => patchTool('angle', { tilt: Number(event.currentTarget.value) })} />);
  if (id === 'angleZoom') return wrap(<input className={inputClassName} type="number" min={0} max={10} step={0.1} disabled={isDisabled} value={angle.zoom} onChange={(event) => patchTool('angle', { zoom: Number(event.currentTarget.value) })} />);
  if (id === 'angleSafeMode') return wrap(toggle(angle.safeMode, () => patchTool('angle', { safeMode: !angle.safeMode })));
  if (id === 'angleBestAngles') return wrap(toggle(angle.generateBestAngles, () => patchTool('angle', { generateBestAngles: !angle.generateBestAngles })));

  const upscale = shot.toolSettings?.upscale ?? defaultUpscaleSettings(shot);
  if (id === 'upscaleMode') return wrap(<select className={selectClassName} disabled={isDisabled} value={upscale.mode} onChange={(event) => patchTool('upscale', { mode: event.currentTarget.value === 'factor' ? 'factor' : 'target' })}><option value="target">Target</option><option value="factor">Factor</option></select>);
  if (id === 'upscaleFactor') return wrap(<select className={selectClassName} disabled={isDisabled} value={upscale.upscaleFactor} onChange={(event) => patchTool('upscale', { upscaleFactor: Number(event.currentTarget.value) === 4 ? 4 : 2 })}><option value={2}>2x</option><option value={4}>4x</option></select>);
  if (id === 'outputFormat') return wrap(<select className={selectClassName} disabled={isDisabled} value={upscale.outputFormat ?? ''} onChange={(event) => patchTool('upscale', { outputFormat: event.currentTarget.value })}>{(shot.outputKind === 'video' ? ['mp4', 'webm', 'mov'] : ['png', 'jpg', 'webp']).map((value) => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select>);

  const audio = shot.toolSettings?.audio ?? defaultAudioSettings();
  if (id === 'audioMood') return wrap(<select className={selectClassName} disabled={isDisabled} value={audio.mood} onChange={(event) => patchTool('audio', { mood: event.currentTarget.value })}>{AUDIO_MOOD_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}</select>);
  if (id === 'audioIntensity') return wrap(<select className={selectClassName} disabled={isDisabled} value={audio.intensity} onChange={(event) => patchTool('audio', { intensity: event.currentTarget.value })}>{AUDIO_INTENSITY_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}</select>);
  if (id === 'audioMusicEnabled') return wrap(toggle(audio.musicEnabled, () => patchTool('audio', { musicEnabled: !audio.musicEnabled })));
  if (id === 'voiceGender') return wrap(<select className={selectClassName} disabled={isDisabled} value={audio.voiceGender} onChange={(event) => patchTool('audio', { voiceGender: event.currentTarget.value })}>{AUDIO_VOICE_GENDER_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}</select>);
  if (id === 'voiceProfile') return wrap(<select className={selectClassName} disabled={isDisabled} value={audio.voiceProfile} onChange={(event) => patchTool('audio', { voiceProfile: event.currentTarget.value })}>{AUDIO_VOICE_PROFILE_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}</select>);
  if (id === 'voiceDelivery') return wrap(<select className={selectClassName} disabled={isDisabled} value={audio.voiceDelivery} onChange={(event) => patchTool('audio', { voiceDelivery: event.currentTarget.value })}>{AUDIO_VOICE_DELIVERY_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}</select>);
  if (id === 'audioLanguage') return wrap(<select className={selectClassName} disabled={isDisabled} value={audio.language} onChange={(event) => patchTool('audio', { language: event.currentTarget.value })}>{AUDIO_LANGUAGE_VALUES.map((value) => <option key={value} value={value}>{value}</option>)}</select>);

  const storyboard = shot.toolSettings?.storyboard ?? { targetModel: 'seedance' as const, lengthPreset: 'medium' as const, frameCount: 6 as const, durationSec: 10 as const, orientation: 'landscape' as const, tier: '4k' as const };
  const patchStoryboard = (patch: Record<string, unknown>) => onPatchShot({ toolSettings: { ...shot.toolSettings, storyboard: { ...storyboard, ...patch } } });
  if (id === 'tool.storyboard.targetModel') return wrap(<select className={selectClassName} disabled={isDisabled} value={storyboard.targetModel} onChange={(event) => patchStoryboard({ targetModel: event.currentTarget.value === 'kling' ? 'kling' : 'seedance' })}><option value="seedance">Seedance</option><option value="kling">Kling</option></select>);
  if (id === 'tool.storyboard.frameCount') return wrap(<select className={selectClassName} disabled={isDisabled} value={storyboard.frameCount} onChange={(event) => patchStoryboard({ frameCount: Number(event.currentTarget.value) })}>{[4, 6, 8].map((value) => <option key={value} value={value}>{value}</option>)}</select>);
  if (id === 'tool.storyboard.durationSec') return wrap(<select className={selectClassName} disabled={isDisabled} value={storyboard.durationSec} onChange={(event) => patchStoryboard({ durationSec: Number(event.currentTarget.value) })}>{[6, 10, 15].map((value) => <option key={value} value={value}>{value}s</option>)}</select>);
  if (id === 'tool.storyboard.orientation') return wrap(<select className={selectClassName} disabled={isDisabled} value={storyboard.orientation} onChange={(event) => patchStoryboard({ orientation: event.currentTarget.value === 'portrait' ? 'portrait' : 'landscape' })}><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select>);
  if (id === 'tool.storyboard.tier') return wrap(<select className={selectClassName} disabled={isDisabled} value={storyboard.tier} onChange={(event) => patchStoryboard({ tier: event.currentTarget.value })}>{['hd', '4k', 'ultra'].map((value) => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select>);

  if (typeof field !== 'string') {
    const value = field.kind === 'connection' ? `${field.value ?? 0} connected` : String(field.value ?? '');
    return wrap(<strong className={styles.staticValue}>{value}</strong>);
  }

  return null;
}
