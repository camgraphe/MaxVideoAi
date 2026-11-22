import { z } from 'zod';
import { STUDIO_CONVERSATION_MAX_ATTACHMENTS } from '@/lib/studio/conversation-creation-contract';
import type { NextRequest } from 'next/server';
import { MILO_LEVELS, miloLevelForModel, studioAssistantModelSchema } from '@/lib/studio/assistance-contract';
import { STUDIO_TASK_POLICY_VERSION, STUDIO_TASK_PROFILES } from '@/lib/studio/task-budget-contract';
import { studioProjectNameSchema } from '@/lib/studio/conversation-project-title';
import type { ImageConversationTurn } from '@/lib/studio/image-conversation-contract';
import type { StudioAllowance, StudioJournal, StudioReference } from '@/lib/mobile-studio';
import { readBoundedJsonBody } from '@/server/read-bounded-json-body';
import { resolveStudioApiAccess } from '@/server/studio/access';
import {
  listStudioConversationProjects,
  readStudioConversationProjectId,
} from '@/server/studio/conversation-project-list';
import { createStudioConversationProject, removeStudioConversationProject } from '@/server/studio/conversation-project-command';
import { renameStudioConversationProject } from '@/server/studio/conversation-project-naming';
import { readStudioAssistanceStatus } from '@/server/studio/assistance-ledger';
import { createImageConversationService } from '@/server/studio/image-conversation-service';
import { createStudioTaskConversationAdapter } from '@/server/studio/tasks/conversation-adapter';
import { createStudioTaskService } from '@/server/studio/tasks/service';
import { studioTasksEnabled } from '@/server/studio/tasks/policy';
import { scheduleStudioWorker } from '@/server/studio/worker-host';
import type { StudioGenerationActor } from '@/server/agent-api/generation-actor';
import { studioConversationEditingEnabled } from '@/app/api/studio/_lib/studio-conversation-editing-handler';
import { MobileHttpError, mobileResponse } from './http';

const nameInput = z.object({ name: studioProjectNameSchema, idempotencyKey: z.string().uuid() });
const createInput = nameInput.extend({ action: z.literal('create') }).strict();
const renameInput = nameInput.extend({ action: z.literal('rename') }).strict();
const deleteInput = z.object({ action: z.literal('delete'), confirmed: z.literal(true) }).strict();
const quick = STUDIO_TASK_PROFILES.quick;
const messageInput = z
  .object({
    action: z.literal('message'),
    confirmed: z.literal(true),
    requestId: z.string().uuid(),
    message: z.string().trim().min(1).max(4000),
    media: z.array(z.object({
      assetId: z.string().regex(/^ma_[a-f0-9]{32}$/),
      kind: z.enum(['image', 'video', 'audio']),
    }).strict()).max(STUDIO_CONVERSATION_MAX_ATTACHMENTS).optional(),
    locale: z.enum(['en', 'fr', 'es']),
    model: studioAssistantModelSchema,
    assistanceRevision: z.number().int().nonnegative(),
    policyVersion: z.literal(STUDIO_TASK_POLICY_VERSION),
    maxCredits: z.literal(quick.maxCredits),
    customerMaxCredits: z.number().int().nonnegative(),
  })
  .strict();
const projectInput = z.discriminatedUnion('action', [renameInput, deleteInput, messageInput]);
const customerCeiling = (model: StudioAllowance['model']) =>
  miloLevelForModel(model) === 'lite' ? 0 : quick.maxCredits;

function turnMedia(turn: Pick<ImageConversationTurn, 'references' | 'attachments' | 'referenceMentions'>): StudioReference[] {
  const media = new Map<string, StudioReference>();
  for (const assetId of turn.references) media.set(assetId, { assetId, kind: 'image' });
  for (const ref of turn.attachments ?? []) {
    if (ref.type === 'asset') media.set(ref.assetId, { assetId: ref.assetId, kind: ref.kind });
  }
  const result: StudioReference[] = [];
  for (const { assetId } of turn.referenceMentions ?? []) {
    const ref = media.get(assetId);
    if (ref) { result.push(ref); media.delete(assetId); }
  }
  return result.concat([...media.values()]);
}

async function readJournal(actor: StudioGenerationActor, origin: string) {
  const service = createImageConversationService(actor, {
    enabled: true,
    actionsEnabled: true,
    editingEnabled: true,
    requestOrigin: origin,
    mediaEnabled: process.env.STUDIO_CONVERSATION_MEDIA_ENABLED === 'true',
    exportsEnabled: process.env.STUDIO_CONVERSATION_EXPORTS_ENABLED === 'true',
  });
  return createStudioTaskConversationAdapter(actor, service).read();
}

async function readAllowance(userId: string): Promise<StudioAllowance | null> {
  if (!studioTasksEnabled()) return null;
  const status = await readStudioAssistanceStatus(userId);
  if (!status.enabled || !status.canContinue || status.unresolvedCalls || !status.credits) return null;
  const level = miloLevelForModel(status.selectedModel);
  if (
    level === 'lite'
      ? !status.sponsoredAvailable
      : status.credits.included.remaining + (status.paid.enabled ? status.credits.purchased.remaining : 0) <=
        0
  )
    return null;
  return {
    model: status.selectedModel,
    label: MILO_LEVELS[level].label,
    revision: status.revision,
    mediaEnabled: process.env.STUDIO_CONVERSATION_MEDIA_ENABLED === 'true',
    policyVersion: STUDIO_TASK_POLICY_VERSION,
    maxCredits: quick.maxCredits,
    customerMaxCredits: customerCeiling(status.selectedModel),
  };
}

const owners = {
  access: resolveStudioApiAccess,
  consentBlocked: async (user: string) => {
    const { computeReconsentStatus } = await import('@/server/legal-reconsent-status');
    return (await computeReconsentStatus(user)).shouldBlock;
  },
  enabled: studioConversationEditingEnabled,
  list: listStudioConversationProjects,
  owned: readStudioConversationProjectId,
  create: createStudioConversationProject,
  rename: renameStudioConversationProject,
  remove: removeStudioConversationProject,
  journal: readJournal,
  allowance: readAllowance,
  tasksEnabled: studioTasksEnabled,
  task: createStudioTaskService,
  wake: scheduleStudioWorker,
};

export function handleMobileStudio(
  req: NextRequest,
  projectId?: string,
  overrides: Partial<typeof owners> = {},
) {
  const deps = { ...owners, ...overrides };
  return mobileResponse(async () => {
    if (
      req.headers.get('x-maxvideoai-auth-mode') !== 'bearer' ||
      !/^Bearer \S+$/.test(req.headers.get('authorization') ?? '')
    )
      throw new MobileHttpError('UNAUTHORIZED', 401, 'Sign in to Studio.');
    const access = await deps.access(req);
    if (!access.ok) throw new MobileHttpError(access.error, access.status, 'Studio is unavailable.');
    if (!deps.enabled()) throw new MobileHttpError('STUDIO_DISABLED', 404, 'Studio is unavailable.');
    const { userId } = access;
    if (await deps.consentBlocked(userId))
      throw new MobileHttpError('LEGAL_CONSENT_REQUIRED', 403, 'Review the current terms in Account.');
    if (projectId === undefined) {
      if (req.method === 'GET' && req.nextUrl.searchParams.get('view') === 'allowance')
        return { allowance: await deps.allowance(userId) };
      if (req.method === 'GET')
        return {
          projects: (await deps.list(userId)).map(({ id, name, updatedAt }) => ({ id, name, updatedAt })),
        };
      const parsed = createInput.safeParse(await readBoundedJsonBody(req, 4096));
      if (!parsed.success) throw new SyntaxError('Invalid project.');
      const { name, idempotencyKey } = parsed.data;
      return deps.create({ userId }, { name, idempotencyKey }, { featureEnabled: true });
    }
    if (!projectId || projectId.length > 128 || !(await deps.owned(userId, projectId)))
      throw new MobileHttpError('PROJECT_UNAVAILABLE', 404, 'This project is unavailable.');
    const actor = { authMethod: 'studio-session' as const, clientId: null, userId, projectId };
    if (req.method === 'GET') {
      const [journal, allowance] = await Promise.all([
        deps.journal(actor, req.nextUrl.origin),
        deps.allowance(userId).catch(() => null),
      ]);
      return {
        projectId: journal.projectId,
        projectName: journal.projectName,
        allowance,
        turns: journal.turns.map(({ requestId, message, references, attachments, referenceMentions, reply, state, task, quote }) => ({
          requestId,
          message,
          media: turnMedia({ references, attachments, referenceMentions }),
          reply,
          state: task?.state === 'paused' ? 'paused' : state,
          quote: quote
            ? {
                label: quote.modelLabel,
                amountCents: quote.price.amountCents,
                currency: quote.price.currency,
                state: quote.state,
              }
            : null,
        })),
      } satisfies StudioJournal;
    }
    const parsed = projectInput.safeParse(await readBoundedJsonBody(req, 32768));
    if (!parsed.success) throw new SyntaxError('Invalid project command.');
    const input = parsed.data;
    if (input.action === 'delete') {
      const result = await deps.remove({ userId, projectId });
      if (result === 'busy') throw new MobileHttpError('PROJECT_BUSY', 409, 'Wait for the current Studio task to finish.');
      if (result === 'missing') throw new MobileHttpError('PROJECT_UNAVAILABLE', 404, 'This project is unavailable.');
      return { projectId, deleted: true };
    }
    if (input.action === 'rename')
      return deps.rename({ userId, projectId }, { name: input.name, idempotencyKey: input.idempotencyKey });
    if (!deps.tasksEnabled() || input.customerMaxCredits !== customerCeiling(input.model))
      throw new MobileHttpError('REVIEW_REQUIRED', 409, 'Review the current assistance allowance.');
    const media = input.media ?? [];
    if (new Set(media.map(ref => ref.assetId)).size !== media.length)
      throw new MobileHttpError('REFERENCE_INVALID', 422, 'Choose distinct references.');
    if (media.some(ref => ref.kind !== 'image') && process.env.STUDIO_CONVERSATION_MEDIA_ENABLED !== 'true')
      throw new MobileHttpError('REFERENCE_INVALID', 422, 'Video and audio references are unavailable in this session.');
    const counts = { image: 0, video: 0, audio: 0 };
    // enqueue verifies the account model and revision under lock, or recovers the identical saved request.
    const saved = await deps.task(actor).enqueue({
      requestId: input.requestId,
      message: input.message,
      locale: input.locale,
      references: media.filter(ref => ref.kind === 'image').map(ref => ref.assetId),
      ...(media.length ? {
        attachments: media.filter(ref => ref.kind !== 'image').map(ref => ({ ...ref, type: 'asset' as const })),
        referenceMentions: media.map(({ assetId, kind }) => ({
          assetId, label: kind[0].toUpperCase() + kind.slice(1) + ' ' + (++counts[kind]),
        })),
      } : {}),
      taskBudget: {
        profile: 'quick',
        maxCredits: input.maxCredits,
        policyVersion: input.policyVersion,
        model: input.model,
        assistanceRevision: input.assistanceRevision,
      },
    }, 'mobile').catch(error => {
      if (error instanceof Error && ['MEDIA_NOT_AVAILABLE','MEDIA_DELETED'].includes(error.message))
        throw new MobileHttpError('REFERENCE_INVALID', 422, 'A reference is no longer available.');
      throw error;
    });
    if (saved.state === 'queued') deps.wake('task', { userId, projectId, requestId: saved.requestId });
    return { projectId, requestId: saved.requestId };
  });
}
