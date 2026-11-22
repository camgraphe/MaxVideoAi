import type { NextRequest } from 'next/server';
import { withMobileMiloAttachments } from './milo-media';
import { AUDIO_INTENT_PACK, AUDIO_CREATION_INTENTS, isAudioIntent } from '@/lib/audio-creation';
import type { PromptAssistanceRequest } from '@/lib/prompt-assistance/contract';
import { acceptsMobileAudioSetting, readMobileAudioCatalog } from './audio-catalog';
import { isMobileMode, workflowForMode } from '@/lib/mobile-generation-contract';
import { AgentApiError } from '@/server/agent-api/errors';
import {
  handlePromptAssistance,
  type PromptBearerTransport,
  type PromptCommand,
  type PromptHandlerDependencies,
} from '@/server/prompt-assistance/route-handler';
import { readMobileModels } from './catalog';
import { handlePromptAnalysis } from '@/server/prompt-assistance/analysis-route-handler';
import { mobileUser, MobileHttpError } from './http';

type Dependencies = Pick<PromptHandlerDependencies, 'enabled' | 'send' | 'schedule'> & {
  user?: typeof mobileUser;
  models?: typeof readMobileModels;
  audio?: typeof readMobileAudioCatalog;
};

const mobileScopes = new Set([
  'video:create',
  'video:modify',
  'video:extend',
  'image:create',
  'image:edit',
  ...AUDIO_CREATION_INTENTS.map((intent) => 'audio:' + intent),
]);
const levels = new Set(['select_luna', 'select_terra', 'select_sol']);
const invalid = () => new SyntaxError('Invalid native Milo request.');

function validateQuery(params: URLSearchParams) {
  if (!params.size) return;
  const scope = params.get('scope');
  if (
    params.size !== 2 ||
    !params.get('sessionId') ||
    params.getAll('sessionId').length !== 1 ||
    !(scope ? mobileScopes.has(scope) : Boolean(params.get('requestId')))
  )
    throw invalid();
}

function validateAudioDraft(
  draft: PromptAssistanceRequest['draft'],
  catalog: ReturnType<typeof readMobileAudioCatalog>,
) {
  const { workflow, mode, engineId, target, settings, readOnlyText } = draft;
  if (!isAudioIntent(workflow) || AUDIO_INTENT_PACK[workflow] !== mode) throw invalid();
  const entry = catalog.modes.find((item) => item.mode === mode && item.engineId === engineId);
  if (
    !entry?.available ||
    target !== (mode === 'voice_only' ? 'script' : 'prompt') ||
    draft.text.length > (target === 'script' ? entry.narration!.maxChars : entry.prompt.maxChars)
  )
    throw invalid();
  if (readOnlyText && (Object.keys(readOnlyText).some((key) => key !== 'lyrics') || mode !== 'song'))
    throw invalid();
  const variant = entry.variants.find(
    (item) =>
      item.available && Object.entries(item.settings).every(([key, fixed]) => settings[key] === fixed),
  );
  if (
    !variant ||
    Object.entries(settings).some(([key, value]) => {
      const control = variant.controls.find((item) => item.key === key);
      return control?.type === 'text' || !acceptsMobileAudioSetting(control, value);
    })
  )
    throw invalid();
}

async function validateCommand(input: PromptCommand, dependencies: Dependencies) {
  if (input.action === 'choose' && levels.has(input.choice.action)) return;
  if (input.action !== 'message') throw invalid();
  const { assistanceModel, assistanceRevision, draft } = input.request;
  if (!assistanceModel || assistanceRevision === undefined) throw invalid();
  await validateMobileDraft(draft, dependencies);
}

async function validateMobileDraft(draft: PromptAssistanceRequest['draft'], dependencies: Dependencies) {
  const { engineId, mode, surface, target, workflow } = draft;
  if (surface === 'audio' && draft.references.length) throw invalid();
  if (surface === 'audio') return validateAudioDraft(draft, (dependencies.audio ?? readMobileAudioCatalog)());
  if (!isMobileMode(mode) || target !== 'prompt' || workflow !== workflowForMode(mode)) throw invalid();
  const [model] = await (dependencies.models ?? readMobileModels)({
    id: engineId,
    surface,
    mediaReferences: true,
  });
  const control = model?.modes.find((option) => option.mode === mode);
  if (!control) throw invalid();
  if (draft.references.length) {
    const fields = [
      ...(control.mediaReferenceFields ?? []),
      ...(control.sourceVideo ? [{ fieldId: control.sourceVideo.fieldId, kind: 'video', max: 1 }] : []),
      ...(control.referenceImageField ? [{ fieldId: control.referenceImageField, kind: 'image', max: control.imageSeries?.max ?? 1 }] : []),
      ...[control.lastFrame, control.optionalLastFrame, control.optionalFirstFrame].flatMap(field =>
        field ? [{ fieldId: field.fieldId, kind: 'image', max: 1 }] : []),
    ];
    const counts = new Map<string, number>();
    const assets = new Set<string>();
    const budget = control.referenceBudget;
    let total = 0;
    const byKind = { audio: 0, image: 0, video: 0 };
    for (const source of draft.references) {
      const field = fields.find(f => f.fieldId === source.fieldId);
      if (!field || source.ref?.type !== 'asset' || source.ref.kind !== field.kind) throw invalid();
      const count = counts.get(field.fieldId) ?? 0;
      if (count >= field.max || source.slot !== count || assets.has(source.ref.assetId)) throw invalid();
      counts.set(field.fieldId, count + 1);
      assets.add(source.ref.assetId);
      if (budget?.fieldIds.includes(field.fieldId)) {
        const max = budget.maxByType?.[source.ref.kind];
        if (++total > budget.maxTotal || ++byKind[source.ref.kind] > (max ?? Infinity)) throw invalid();
      }
    }
  }
}

function mobileMiloAccess(dependencies: Dependencies): PromptBearerTransport['authenticate'] {
  return async (req) => {
    try {
      return {
        ok: true,
        userId: await (dependencies.user ?? mobileUser)(req, true),
      };
    } catch (error) {
      if (error instanceof AgentApiError && error.code === 'AUTH_REQUIRED')
        return { ok: false, status: 401, error: 'UNAUTHORIZED' };
      if (error instanceof MobileHttpError && error.code === 'LEGAL_CONSENT_REQUIRED')
        return { ok: false, status: 403, error: 'LEGAL_CONSENT_REQUIRED' };
      return { ok: false, status: 503, error: 'ASSISTANCE_UNAVAILABLE' };
    }
  };
}

export function handleMobileMilo(request: NextRequest, dependencies: Dependencies = {}) {
  const bearer: PromptBearerTransport = {
    authenticate: mobileMiloAccess(dependencies),
    projectSession: request.headers.get('x-milo-turn-media') === '1' ? withMobileMiloAttachments : undefined,
    validateQuery,
    validateCommand: (input) => validateCommand(input, dependencies),
  };
  return handlePromptAssistance(request, dependencies, bearer);
}

export function handleMobileMiloAnalysis(request: NextRequest, dependencies: Dependencies = {}) {
  return handlePromptAnalysis(request, dependencies, {
    authenticate: mobileMiloAccess(dependencies),
    validateDraft: (draft) => validateMobileDraft(draft, dependencies),
  });
}
