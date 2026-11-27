import { projectMobileModelSettings } from '@/lib/mobile-model-settings';
import {
  listPublicAgentCatalogEngines,
  type AgentModelCatalogDeps,
  type AgentPublicCatalogEngine,
} from '@/server/agent-api/model-catalog';
import { projectMobileMediaControls } from '@/lib/mobile-media-references';
import { agentSeedanceWorkflowEnabled } from '@/server/agent-api/seedance-workflow';
import { seedanceWorkflowCandidate } from '@/server/agent-api/seedance-workflow-capabilities';
import { getMediaExcerptLimits } from '@/lib/video-excerpt';
import { projectMobileSiteReferences } from '@/lib/mobile-site-references';
import { toEngineGenerationMode } from '@/server/agent-api/generation-mode-aliases';
import { projectAgentModelModeDetails } from '@/server/agent-api/model-details';
import { resolveVideoOperationEngine } from '@/lib/video-operation';
import {
  isMobileMode,
  isSourceVideoMode,
  phoneVideoSourceField,
  phoneFrameFields,
  phoneOptionalLastFrame,
  phoneImageSeries,
  phoneImageReferenceField,
  needsReference,
  withControlDefaults,
  type ModeControls,
  type ModelDetails,
  type Surface,
} from '@/lib/mobile-generation-contract';

function referenceLimits(
  ref: ReturnType<typeof projectAgentModelModeDetails>['references'][number],
): ModeControls['referenceLimits'] {
  return {
    maxSizeMB: ref.maxSizeMB,
    acceptedMimeTypes: ref.acceptedMimeTypes && [...ref.acceptedMimeTypes],
    acceptedFileExtensions: ref.acceptedFileExtensions && [...ref.acceptedFileExtensions],
    minImageSidePx: ref.minImageSidePx,
    imageAspectRatio: ref.imageAspectRatio,
  };
}

function mobileModeCandidate(candidate: AgentPublicCatalogEngine, mode: ModeControls['mode'], videoOperations: boolean): AgentPublicCatalogEngine {
  if (!videoOperations || mode !== 'v2v' || candidate.engine.operationCaps?.['kling-edit']?.mode !== mode) return candidate;
  const engine = resolveVideoOperationEngine(candidate.engine, mode, 'kling-edit');
  return { ...candidate, engine, modeCaps: { ...candidate.modeCaps, [mode]: engine.modeCaps?.[mode] } };
}

function controls(model: AgentPublicCatalogEngine, mediaReferences: boolean, modelSettings: boolean, videoOperations: boolean): ModeControls[] {
  return model.publicModes.filter(isMobileMode).flatMap((mode) => {
    const candidate = mobileModeCandidate(model, mode, videoOperations);
    const audioSource = mode === 'a2v';
    if (audioSource && !mediaReferences) return [];
    const details = projectAgentModelModeDetails(candidate, mode, false);
    const videoMode = isSourceVideoMode(mode);
    if (videoMode && details.sourceGeneration?.required) return [];
    const requiredRefs = details.references.filter((field) => field.required);
    if (audioSource && (details.durationPolicy !== 'source_audio' || requiredRefs.length !== 1
      || requiredRefs[0].type !== 'audio' || !requiredRefs[0].roles.includes('source'))) return [];
    const framePair = mode === 'fl2v' && phoneFrameFields(candidate.engine.inputSchema);
    const first = requiredRefs.find((field) => field.type === 'image' && field.roles.includes('first_frame'));
    const last = requiredRefs.find((field) => field.type === 'image' && field.roles.includes('last_frame'));
    if (
      mode === 'fl2v' &&
      (!framePair ||
        requiredRefs.length !== 2 ||
        !first ||
        !last ||
        requiredRefs.some((field) => (field.min ?? 1) > 1 || (field.max ?? 1) < 1))
    )
      return [];
    const series =
      (mode === 'ref2v' || mode === 'i2i') && phoneImageSeries(candidate.engine.inputSchema, mode);
    // A single image array must satisfy all mandatory media fields. Optional alternate workflows stay independent.
    const seriesRef =
      series &&
      details.references.find(
        (field) =>
          field.type === 'image' && field.roles.includes('reference') && (field.max ?? 0) >= series.max,
      );
    if (mode === 'ref2v' && (!series || !seriesRef)) return [];
    const usable = (field: (typeof requiredRefs)[number]) =>
      field.type === (videoMode ? 'video' : 'image') &&
      (field.min ?? 1) <= 1 &&
      field.roles.some((role) => ['first_frame', 'source', 'reference'].includes(role));
    if (
      details.outputCount.min > 1 ||
      (!audioSource && !framePair && !seriesRef && (requiredRefs.length > 1 || requiredRefs.some((field) => !usable(field))))
    )
      return [];
    const ref = (seriesRef || (framePair ? first : requiredRefs[0])) ?? details.references.find(usable);
    const role = ref?.roles.find(
      (item): item is NonNullable<ModeControls['referenceRole']> =>
        item === 'first_frame' || item === 'source' || item === 'reference',
    );
    if (!audioSource && (needsReference(mode) ? !role : requiredRefs.length > 0)) return [];
    const defaults: ModeControls['defaults'] = {};
    for (const setting of details.settings.filter((field) => field.required)) {
      if (setting.default !== null) defaults[setting.key] = setting.default;
      else if (!['durationSec', 'resolution', 'aspectRatio', 'audio'].includes(setting.key)) return [];
    }
    const source =
      videoMode && requiredRefs.find((field) => field.type === 'video' && field.roles.includes('source'));
    const sourceField = videoMode && phoneVideoSourceField(candidate.engine.inputSchema, mode);
    if (videoMode && (!source || !sourceField || role !== 'source')) return [];
    const imageField =
      !videoMode &&
      needsReference(mode) &&
      phoneImageReferenceField(
        candidate.engine.inputSchema,
        toEngineGenerationMode(candidate.engine.id, mode),
      );
    const schemaLimits = candidate.engine.inputSchema?.constraints;
    const optionalLastField =
      (mode === 'i2v' || mode === 'i2v_standard') &&
      imageField &&
      (role === 'source' || role === 'first_frame') &&
      phoneOptionalLastFrame(candidate.engine.inputSchema, toEngineGenerationMode(candidate.engine.id, mode));
    const optionalLast =
      optionalLastField &&
      details.references.find(
        (field) => !field.required && field.type === 'image' && field.roles.includes('last_frame'),
      );
    const sourceMax =
      source &&
      [
        source.durationSec?.max,
        source.durationSec?.combinedMax,
        candidate.engine.inputLimits.videoMaxDurationSec,
        schemaLimits?.maxVideoDurationSec,
      ].filter((n): n is number => typeof n === 'number' && n > 0);
    const inheritsDuration = audioSource || (videoMode && details.durationPolicy === 'source_video');
    const range = details.duration?.range;
    const durations =
      details.duration?.options ??
      (range
        ? Array.from(
            { length: Math.min(60, Math.max(0, range.max - range.min + 1)) },
            (_, index) => range.min + index,
          )
        : []);
    if (candidate.surface === 'video' && !inheritsDuration && !durations.length) return [];
    return [
      withControlDefaults(
        {
          mode,
          ...(candidate.engine.activeVideoOperation === 'kling-edit' ? { operation: 'kling-edit' as const } : {}),
          durations: inheritsDuration ? [] : [...durations],
          ...(needsReference(mode) && ref
            ? {
                referenceLimits: {
                  ...referenceLimits(ref),
                  ...(videoMode
                    ? {
                        minVideoPixels:
                          typeof schemaLimits?.minVideoPixelCount === 'number'
                            ? schemaLimits.minVideoPixelCount
                            : undefined,
                        exclusiveMaxSeconds:
                          typeof schemaLimits?.videoDurationExclusiveMaxSec === 'number'
                            ? schemaLimits.videoDurationExclusiveMaxSec
                            : undefined,
                      }
                    : {}),
                },
              }
            : {}),
          ...(framePair && last
            ? { lastFrame: { fieldId: framePair.last, limits: referenceLimits(last) } }
            : {}),
          ...(optionalLastField && optionalLast
            ? { optionalLastFrame: { fieldId: optionalLastField, limits: referenceLimits(optionalLast) } }
            : {}),
          ...(series && seriesRef
            ? { referenceImageField: series.fieldId, imageSeries: series }
            : imageField
              ? { referenceImageField: imageField }
              : {}),
          ...(source && sourceField
            ? {
                sourceVideo: {
                  fieldId: sourceField,
                  ...(getMediaExcerptLimits(candidate.engine, mode, sourceField)
                    ? { canPrepareExcerpt: true as const }
                    : {}),
                  inheritsDuration,
                  ...(source.durationSec?.min ? { minSeconds: source.durationSec.min } : {}),
                  ...(sourceMax && sourceMax.length ? { maxSeconds: Math.min(...sourceMax) } : {}),
                },
              }
            : {}),
          resolutions: details.resolutions.filter((value) => value !== 'custom' || modelSettings),
          aspectRatios: [...details.aspectRatios],
          audio: details.audio,
          defaults,
          referenceRole: needsReference(mode) ? role! : null,
        },
        candidate.modeCaps[mode]?.duration?.default,
      ),
    ];
  });
}

export async function readMobileModels(
  filter: { surface?: Surface; id?: string; mediaReferences?: boolean; modelSettings?: boolean; videoOperations?: boolean },
  dependencies?: AgentModelCatalogDeps,
): Promise<ModelDetails[]> {
  const candidates = await listPublicAgentCatalogEngines(dependencies);
  return candidates
    .filter(
      (candidate) =>
        candidate.generationEnabled &&
        (!filter.id || candidate.engine.id === filter.id) &&
        (!filter.surface || candidate.surface === filter.surface),
    )
    .flatMap((candidate) => {
      const draftModes = candidate.engine.id === 'seedance-2-5' && agentSeedanceWorkflowEnabled()
        ? seedanceWorkflowCandidate({ engineId: candidate.engine.id, seedanceWorkflow: { step: 'draft' } }, candidate).publicModes
        : [];
      const videoOperations = !!(filter.modelSettings && filter.videoOperations);
      const modes = controls(candidate, !!filter.mediaReferences, !!filter.modelSettings, videoOperations)
        .map((control) => {
          const active = mobileModeCandidate(candidate, control.mode, videoOperations);
          const rawMode = toEngineGenerationMode(active.engine.id, control.mode);
          const settings = filter.modelSettings
            ? projectMobileModelSettings(active.engine, rawMode, control, active.modeCaps[control.mode]!)
            : control;
          const projected = filter.mediaReferences
            ? projectMobileMediaControls(active.engine, rawMode, settings)
            : settings;
          if (draftModes.includes(control.mode)) projected.seedanceDraft = 'native';
          return projected;
        })
        .filter((control) => control.mode !== 'a2v' || control.sourceAudio);
      return modes.length
        ? [
            {
              id: candidate.engine.id,
              label: candidate.engine.label,
              provider: candidate.engine.provider,
              surface: candidate.surface,
              ...(modes.some((m) => m.lastFrame || m.optionalLastFrame)
                ? { supportsFramePair: true as const }
                : {}),
              siteReferences: projectMobileSiteReferences(candidate.engine, candidate.surface, modes),
              modes,
            },
          ]
        : [];
    });
}
