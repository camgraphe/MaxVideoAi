import { getBaseEngines } from '@/lib/engines';
import type { AspectRatio, EngineCaps, Resolution } from '@/types/engines';
import type { WorkspaceModelCapability, WorkspaceWorkflowType } from '../workspace-types';
import { ALL_INPUT_KINDS, inputConnectorsFor, optionalInputsFor, requiredInputsFor } from './model-input-connectors';
import { hasFieldId, hasFieldType, hasMode } from './model-engine-fields';
import { resolveWorkspaceRenderOptions } from './model-pricing-adapter';

function workflowTypesFor(engine: EngineCaps): WorkspaceWorkflowType[] {
  const workflows: WorkspaceWorkflowType[] = [];
  if (hasMode(engine, ['t2v'])) workflows.push('text_to_video');
  if (hasMode(engine, ['i2v', 'ref2v', 'fl2v', 'r2v'])) workflows.push('image_to_video');
  if (hasMode(engine, ['v2v', 'extend', 'retake', 'reframe'])) workflows.push('video_to_video');
  if (hasMode(engine, ['r2v']) || engine.id.includes('storyboard')) workflows.push('storyboard_to_video');
  return workflows.length ? workflows : ['text_to_video'];
}

function supportedDurations(engine: EngineCaps): number[] {
  const values = new Set<number>();
  Object.values(engine.modeCaps ?? {}).forEach((caps) => {
    if (!caps?.duration) return;
    if ('options' in caps.duration) {
      caps.duration.options.forEach((value) => {
        const numeric = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
        if (Number.isFinite(numeric)) values.add(numeric);
      });
      return;
    }
    if (Number.isFinite(caps.duration.default)) values.add(caps.duration.default);
    if (Number.isFinite(caps.duration.min)) values.add(caps.duration.min);
  });
  if (!values.size && Number.isFinite(engine.maxDurationSec)) {
    values.add(Math.min(engine.maxDurationSec, 5));
    if (engine.maxDurationSec >= 8) values.add(8);
    if (engine.maxDurationSec >= 10) values.add(10);
  }
  return Array.from(values).sort((a, b) => a - b);
}

function supportedAspectRatios(engine: EngineCaps): AspectRatio[] {
  const ratios = new Set<AspectRatio>(engine.aspectRatios);
  Object.values(engine.modeCaps ?? {}).forEach((caps) => {
    caps?.aspectRatio?.forEach((ratio) => ratios.add(ratio as AspectRatio));
  });
  return Array.from(ratios);
}

function supportedResolutions(engine: EngineCaps): Resolution[] {
  const resolutions = new Set<Resolution>(engine.resolutions);
  Object.values(engine.modeCaps ?? {}).forEach((caps) => {
    caps?.resolution?.forEach((resolution) => resolutions.add(resolution as Resolution));
  });
  return Array.from(resolutions);
}

function supportedFps(engine: EngineCaps): number[] {
  const fps = new Set<number>(engine.fps);
  Object.values(engine.modeCaps ?? {}).forEach((caps) => {
    if (Array.isArray(caps?.fps)) {
      caps.fps.forEach((value) => fps.add(value));
    } else if (typeof caps?.fps === 'number') {
      fps.add(caps.fps);
    }
  });
  return Array.from(fps).sort((a, b) => a - b);
}

function buildCapability(engine: EngineCaps): WorkspaceModelCapability {
  const workflows = workflowTypesFor(engine);
  const family = engine.id.toLowerCase();
  const supportsImage = hasMode(engine, ['i2v', 'ref2v', 'fl2v', 'r2v']) || hasFieldType(engine, 'image');
  const supportsVideo = hasMode(engine, ['v2v', 'extend', 'retake', 'reframe']) || hasFieldType(engine, 'video');
  const supportsAudio = engine.audio || hasFieldType(engine, 'audio') || hasMode(engine, ['a2v']);
  const renderOptions = resolveWorkspaceRenderOptions(engine);
  const baseRequiredInputs = requiredInputsFor(engine);
  const baseOptionalInputs = optionalInputsFor(engine);
  const inputConnectors = inputConnectorsFor(engine, baseRequiredInputs, baseOptionalInputs);
  const requiredInputs = inputConnectors.filter((connector) => connector.required).map((connector) => connector.kind);
  const optionalInputs = inputConnectors.filter((connector) => !connector.required).map((connector) => connector.kind);
  const supportedInputs = new Set([...requiredInputs, ...optionalInputs]);

  return {
    id: engine.id,
    label: engine.label,
    provider: engine.provider,
    providerEngineSlug: engine.providerMeta?.modelSlug ?? engine.id,
    modes: [...engine.modes],
    workflows,
    text_to_video: workflows.includes('text_to_video'),
    image_to_video: workflows.includes('image_to_video'),
    video_to_video: workflows.includes('video_to_video'),
    storyboard_to_video: workflows.includes('storyboard_to_video'),
    reference_image: supportsImage,
    reference_video: supportsVideo,
    product_reference: supportsImage && !family.startsWith('sora'),
    character_reference: supportsImage && (family.includes('kling') || family.includes('ltx') || family.includes('happy-horse')),
    motion_reference: supportsVideo || hasMode(engine, ['ref2v']),
    audio_input: supportsAudio,
    music_input: supportsAudio,
    voiceover_input: supportsAudio || engine.audio || family.includes('veo') || family.includes('happy-horse'),
    dialogue: engine.audio || family.includes('veo') || family.includes('happy-horse') || hasFieldId(engine, ['dialogue']),
    lip_sync: renderOptions.some((option) => option.id === 'lip_sync'),
    audio_generation: renderOptions.some((option) => option.id === 'audio'),
    supports_people_reference: supportsImage && !family.startsWith('sora') && !family.includes('seedance-2-0-fast'),
    supports_product_reference: supportsImage && !family.startsWith('sora'),
    supported_aspect_ratios: supportedAspectRatios(engine),
    supported_durations: supportedDurations(engine),
    supported_resolutions: supportedResolutions(engine),
    supported_fps: supportedFps(engine),
    input_connectors: inputConnectors,
    render_options: renderOptions,
    required_inputs: requiredInputs,
    optional_inputs: optionalInputs,
    unsupported_inputs: ALL_INPUT_KINDS.filter((kind) => !supportedInputs.has(kind)),
  };
}

export function getWorkspaceModelCapabilities(engines: EngineCaps[] = getBaseEngines()): WorkspaceModelCapability[] {
  return engines.map(buildCapability).filter((capability) => capability.workflows.length > 0);
}

export function getWorkspaceModelCapability(
  modelId: string,
  capabilities: WorkspaceModelCapability[] = getWorkspaceModelCapabilities()
): WorkspaceModelCapability | null {
  return capabilities.find((capability) => capability.id === modelId) ?? capabilities[0] ?? null;
}
