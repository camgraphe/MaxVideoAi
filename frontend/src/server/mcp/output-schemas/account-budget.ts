import type { McpDistributionProfile } from '@/server/mcp/distribution-profile';
import * as z from 'zod/v4';
import { destination, generationMode, money, strings } from './common';

const trial = z.discriminatedUnion('status', [
  z.object({ status: z.literal('disabled') }).passthrough(),
  z.object({ status: z.literal('verification_required'), nextAction: z.object({ type: z.literal('verify_email'), url: z.string() }).passthrough() }).passthrough(),
  z.object({ status: z.literal('available'), preset: z.object({ engineId: z.string(), surface: z.literal('video'), mode: z.literal('t2v'), durationSec: z.number(), resolution: z.string(), aspectRatios: strings, audioOptional: z.boolean(), outputCount: z.number() }).passthrough() }).passthrough(),
  z.object({ status: z.literal('reserved'), jobId: z.string().nullable() }).passthrough(),
  z.object({ status: z.literal('consumed'), jobId: z.string().nullable() }).passthrough(),
  z.object({ status: z.literal('temporarily_unavailable'), reason: z.enum(['account_restricted', 'preset_unavailable', 'service_unavailable']) }).passthrough(),
]);
const accountDestinations = z.object({ connections: destination, library: destination, videoWorkspace: destination, imageWorkspace: destination, support: destination }).passthrough();
const directoryAccount = z.object({
  emailVerified: z.boolean(), wallet: money.extend({ pendingCents: z.number() }), trial,
  spendingLimits: z.object({ perGenerationCents: z.number().nullable(), dailyCents: z.number().nullable(), webApprovalAboveCents: z.number().nullable() }).passthrough(),
  accountUrl: z.string(), destinations: accountDestinations,
}).passthrough();
const directAccount = directoryAccount.extend({ accountId: z.string(), clientId: z.string().nullable(), destinations: accountDestinations.extend({ billing: destination }) });
export function getAccountStatusOutputSchema(profile: McpDistributionProfile) {
  return profile === 'openai-directory' ? directoryAccount : directAccount;
}
const attemptsMoney = money.extend({ attempts: z.number() });
const budgetLine = z.object({
  purpose: z.string(), engineId: z.string(), mode: generationMode,
  settings: z.object({ durationSec: z.number(), resolution: z.string(), aspectRatio: z.string().optional(), fps: z.number().optional(), audio: z.boolean().optional(), loop: z.boolean().optional() }).passthrough(),
  referenceCount: z.number(), clipCount: z.number(), attemptsPerClip: z.number(), unitPrice: money,
  baseProduction: attemptsMoney, creativeAttempts: attemptsMoney, total: money, intendedOutputDurationSec: z.number(),
}).passthrough();
export const calculateProjectBudgetOutputSchema = z.object({
  proposals: z.array(z.object({ name: z.string(), lines: z.array(budgetLine), baseProduction: money, creativeAttempts: money, total: money, intendedOutputDurationSec: z.number() }).passthrough()),
  currency: z.string(), membershipTier: z.enum(['member', 'plus', 'pro']), catalogRevision: z.string(),
  pricingScope: z.literal('connected_environment'), quoteRequired: z.literal(true), nextAction: z.literal('discuss_and_refine'),
}).passthrough();

const topupBranches = z.union([
  z.object({ topupRequired: z.literal(false), nextAction: z.object({ tool: z.enum(['confirm_generation', 'confirm_audio_generation']), arguments: z.object({ quoteId: z.string(), confirmed: z.literal(true) }).passthrough() }).passthrough() }).passthrough(),
  z.object({ topupRequired: z.literal(true), amountCents: z.number(), currency: z.literal('USD'), quoteIntentId: z.string(), expiresAt: z.number(), expiresAtIso: z.string(), destination, freshQuoteRequired: z.literal(true), nextActionAfterFunding: z.object({ tool: z.literal('get_account_status'), then: z.enum(['prepare_generation', 'prepare_audio_generation']) }).passthrough() }).passthrough(),
]);
// MCP SDK 1.x requires a top-level ZodObject. Publish the conditional branches
// in JSON Schema as well as enforcing them on the server.
const [notRequired, required] = topupBranches.options;
export const createTopupLinkOutputSchema = z.object({
  ...notRequired.partial().shape, ...required.partial().shape, topupRequired: z.boolean(),
}).passthrough().superRefine((value, ctx) => {
  const parsed = topupBranches.safeParse(value);
  if (!parsed.success) ctx.addIssue({ code: 'custom', message: 'Incomplete top-up handoff branch.' });
}).meta({ anyOf: z.toJSONSchema(topupBranches).anyOf });
