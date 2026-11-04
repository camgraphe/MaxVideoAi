import {z} from 'zod';

// Exact pre-inline-analysis public reply contract: old tabs reject added keys.
export const oldPromptReplySchema=z.object({reply:z.string().trim().min(1).max(50000),text:z.string().trim().min(1).max(50000).nullable()}).strict();
export const oldPromptSessionSchema=z.object({
  sessionId:z.string().uuid(),scope:z.string(),status:z.enum(['active','expired','full']),
  turns:z.array(z.union([
    z.object({requestId:z.string().uuid(),message:z.string().max(50000),reply:z.string().max(50000)}).strict(),
    z.object({requestId:z.string().uuid(),message:z.string().max(50000),state:z.literal('failed'),reply:z.null(),error:z.string().regex(/^[A-Z_]{1,80}$/)}).strict(),
  ])).max(100),
  proposal:z.object({text:z.string().max(50000),draftFingerprint:z.string().regex(/^[a-f0-9]{64}$/)}).strict().nullable(),
  pending:z.object({requestId:z.string().uuid()}).strict().nullable(),
}).strict();
