import {z} from 'zod';
import type {PromptAssistanceRequest} from './contract';
import {PROMPT_ASSISTANCE_TEXT_MAX_CHARS} from './limits';
import {promptAnalysisRequestSchema} from './analysis-request';

export const promptWorkflows = {
  video: ['create', 'modify', 'extend', 'reframe', 'retake', 'keyframes', 'references'],
  image: ['create', 'edit'],
  audio: ['voice', 'music', 'song', 'sfx', 'ambience'],
} as const;
export const promptWorkflowSchema = z.enum(['create','modify','extend','reframe','retake','keyframes','references','edit','voice','music','song','sfx','ambience']);
export const promptSessionScopeSchema = z.string().refine(value => Object.entries(promptWorkflows).some(([surface, workflows]) => workflows.some(workflow => value === `${surface}:${workflow}`)));
export function videoPromptWorkflow(mode: string | null, engineId = '') {
  if (mode === 'v2v') return 'modify';
  if (mode === 'ref2v') return engineId.startsWith('flux-3') ? 'keyframes' : 'references';
  if (mode === 'extend' || mode === 'reframe' || mode === 'retake') return mode;
  return 'create';
}
/** Missing workflow is the deployed legacy contract; new clients always send it. */
export function promptSessionScope(draft: {surface:string; mode:string; workflow?:string}) {
  return draft.workflow ? `${draft.surface}:${draft.workflow}` : draft.surface === 'audio' ? `audio:${draft.mode}` : draft.surface;
}
/** Same deterministic input on the server and browser; never exposes the draft in a restore response. */
export function canonicalPromptDraft(draft: PromptAssistanceRequest['draft']): string {
  const sorted = (value: unknown): unknown => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).filter(([,v]) => v !== undefined).sort(([a],[b]) => a<b?-1:a>b?1:0).map(([k,v]) => [k,sorted(v)])) : value;
  return JSON.stringify(sorted(draft));
}
export const promptSessionSnapshotSchema = z.object({
  sessionId: z.string().uuid(), scope: promptSessionScopeSchema,
  status: z.enum(['active','expired','full']),
  turns: z.array(z.union([
    z.object({requestId:z.string().uuid(),message:z.string().max(PROMPT_ASSISTANCE_TEXT_MAX_CHARS),reply:z.string().max(PROMPT_ASSISTANCE_TEXT_MAX_CHARS),analysisRequest:promptAnalysisRequestSchema.optional()}).strict(),
    z.object({requestId:z.string().uuid(),message:z.string().max(PROMPT_ASSISTANCE_TEXT_MAX_CHARS),state:z.literal('failed'),reply:z.null(),error:z.string().regex(/^[A-Z_]{1,80}$/)}).strict(),
  ])).max(100),
  proposal: z.object({text:z.string().max(PROMPT_ASSISTANCE_TEXT_MAX_CHARS),draftFingerprint:z.string().regex(/^[a-f0-9]{64}$/)}).strict().nullable(),
  pending: z.object({requestId:z.string().uuid()}).strict().nullable(),
}).strict();
export type PromptSessionSnapshot = z.infer<typeof promptSessionSnapshotSchema>;

/** Failed user turns cannot own a completed suggestion or its application proof. */
export function lastCompletedPromptRequestId(snapshot:PromptSessionSnapshot|null|undefined):string {
  for(let index=(snapshot?.turns.length??0)-1;index>=0;index--){
    const turn=snapshot!.turns[index];if(turn.reply!==null)return turn.requestId;
  }
  return '';
}
