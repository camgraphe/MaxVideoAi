import type { EngineCaps, EngineInputField } from '@/types/engines';
import type { WorkspaceModelCapability, WorkspaceRenderOption, WorkspaceShotSettings } from '../workspace-types';
import { fieldSearchKey, fieldsFor } from './model-engine-fields';

function audioToggleFieldFor(engine: EngineCaps): EngineInputField | null {
  return (
    fieldsFor(engine).find((field) => {
      if (field.type !== 'boolean' && field.type !== 'enum') return false;
      const key = fieldSearchKey(field);
      if (!key.includes('audio') && !key.includes('sound')) return false;
      if (key.includes('audiourl') || key.includes('audioinput') || key.includes('audiosetting') || key.includes('keepaudio')) {
        return false;
      }
      return (
        key.includes('generateaudio') ||
        key.includes('audioenabled') ||
        key.includes('enableaudio') ||
        key.includes('withaudio') ||
        key === 'audio' ||
        key === 'sound'
      );
    }) ?? null
  );
}

function lipSyncFieldFor(engine: EngineCaps): EngineInputField | null {
  return (
    fieldsFor(engine).find((field) => {
      if (field.type !== 'boolean' && field.type !== 'enum') return false;
      const key = fieldSearchKey(field);
      return key.includes('lipsync') || key.includes('lipsynch') || key.includes('lipsynchronization');
    }) ?? null
  );
}

function hasModeAudioToggle(engine: EngineCaps): boolean {
  return Object.values(engine.modeCaps ?? {}).some((caps) => caps?.audioToggle === true);
}

function defaultEnabledFor(field: EngineInputField | null, fallback: boolean): boolean {
  const value = field?.default;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === 'on' || normalized === 'yes') return true;
    if (normalized === 'false' || normalized === 'off' || normalized === 'no') return false;
  }
  return fallback;
}

export function resolveWorkspaceRenderOptions(engine: EngineCaps): WorkspaceRenderOption[] {
  const options: WorkspaceRenderOption[] = [];
  const audioField = audioToggleFieldFor(engine);
  const hasAudioToggle = hasModeAudioToggle(engine) || Boolean(audioField);

  if (hasAudioToggle) {
    options.push({
      id: 'audio',
      label: audioField?.label || 'Audio',
      control: 'toggle',
      defaultEnabled: defaultEnabledFor(audioField, true),
      fieldId: audioField?.id,
      engineParam: audioField?.engineParam,
      description: audioField?.description,
    });
  } else if (engine.audio) {
    options.push({
      id: 'audio',
      label: 'Native audio',
      control: 'included',
      defaultEnabled: true,
      description: 'This engine includes native audio without a separate render toggle.',
    });
  }

  const lipSyncField = lipSyncFieldFor(engine);
  if (lipSyncField) {
    options.push({
      id: 'lip_sync',
      label: lipSyncField.label || 'Lip-sync',
      control: 'toggle',
      defaultEnabled: defaultEnabledFor(lipSyncField, false),
      fieldId: lipSyncField.id,
      engineParam: lipSyncField.engineParam,
      description: lipSyncField.description,
    });
  }

  return options;
}

export function workspaceAudioEnabledForRequest(
  settings: Pick<WorkspaceShotSettings, 'audioEnabled'>,
  capability: WorkspaceModelCapability | null
): boolean | undefined {
  const audioOption = capability?.render_options.find((option) => option.id === 'audio');
  if (audioOption?.control !== 'toggle') return undefined;
  return settings.audioEnabled;
}
