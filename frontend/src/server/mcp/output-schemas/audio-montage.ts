import * as z from 'zod/v4';
import { AUDIO_PACK_VALUES } from '@/lib/audio-generation';
import { montageSettingsSchema } from '@/lib/studio/montage-contract';
import { mediaKind, preparedQuoteFields, strings } from './common';
import { generationStatusFields } from './generation';

const toolAsset = z.discriminatedUnion('type', [
  z.object({ type: z.literal('asset'), assetId: z.string(), kind: mediaKind }).passthrough(),
  z.object({ type: z.literal('job-output'), jobId: z.string(), outputId: z.string(), kind: mediaKind }).passthrough(),
]);
const audioRequest = z.object({
  schemaVersion: z.literal(1), surface: z.literal('audio'), engineId: z.string(), mode: z.enum(AUDIO_PACK_VALUES), prompt: z.string(),
  settings: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  references: z.array(z.object({ role: z.enum(['source_video', 'voice_sample']), asset: toolAsset }).passthrough()), outputCount: z.literal(1),
}).passthrough();
export const prepareAudioGenerationOutputSchema = z.object({ ...preparedQuoteFields, summary: audioRequest, fundingMode: z.literal('wallet') }).passthrough();
export const confirmAudioGenerationOutputSchema = z.object({ ...generationStatusFields, surface: z.literal('audio'), retryAfterSeconds: z.number().nullable() }).passthrough();
export const listAudioCapabilitiesOutputSchema = z.object({
  schemaVersion: z.literal(1), surface: z.literal('audio'),
  modes: z.array(z.object({
    mode: z.enum(AUDIO_PACK_VALUES), engineId: z.string(), label: z.string(), output: z.enum(['audio', 'video_or_both']), available: z.boolean(),
    variants: z.array(z.object({ settings: z.object({ voiceModel: z.enum(['seed', 'minimax', 'eleven-v4']).optional(), musicEnabled: z.boolean().optional(), musicModel: z.enum(['clip', 'pro']).optional() }).passthrough(), models: z.array(z.object({ id: z.string(), name: z.string() }).passthrough()), available: z.boolean(), unavailableReason: z.string().nullable() }).passthrough()),
    prompt: z.object({ required: z.boolean(), maxChars: z.number() }).passthrough(),
    narration: z.object({ required: z.literal(true), maxChars: z.number() }).passthrough().nullable(),
    lyrics: z.object({ required: z.literal(true), maxChars: z.number() }).passthrough().nullable(),
    duration: z.object({ source: z.string(), minSeconds: z.number().optional(), maxSeconds: z.number().optional(), clipSeconds: z.number().optional(), suggestedSeconds: z.array(z.number()).optional() }).passthrough(),
    references: z.object({ sourceVideo: z.enum(['required', 'optional', 'unsupported']), voiceSample: z.enum(['optional_seed_only', 'unsupported']), identity: z.literal('owned_asset_or_exact_job_output') }).passthrough(),
  }).passthrough()),
  quality: z.object({ standard: z.literal(true), high: z.literal(false) }).passthrough(),
  options: z.object({ minimaxVoices: strings, seedVoices: strings, seedFormats: strings, seedSampleRates: z.array(z.number()), languages: strings, moods: strings, musicBpm: z.array(z.number()) }).passthrough(),
  confirmation: z.object({ required: z.literal(true), prepareTool: z.literal('prepare_audio_generation'), confirmTool: z.literal('confirm_audio_generation'), automaticRetry: z.literal(false) }).passthrough(),
  pricingPolicyRevision: z.string(), revision: z.string(),
}).passthrough();
export const prepareMontageOutputSchema = z.object({
  schemaVersion: z.literal(1), status: z.literal('edit_plan'), persisted: z.literal(false), title: z.string(), settings: montageSettingsSchema.passthrough(),
  clips: z.array(z.object({ clipId: z.string(), assetId: z.string(), label: z.string(), sourceInFrame: z.number(), timelineStartFrame: z.number(), durationFrames: z.number() }).passthrough()),
  totalFrames: z.number(), totalSeconds: z.number(), orderingBasis: z.literal('caller_supplied'), nextAction: z.string(),
}).passthrough();
export const createStudioMontageOutputSchema = z.object({
  schemaVersion: z.literal(1), status: z.literal('studio_project'), persisted: z.literal(true), title: z.string(), projectId: z.string(), sequenceId: z.string(), revision: z.number(), studioUrl: z.string(),
  clipCount: z.number(), totalFrames: z.number(), totalSeconds: z.number(), orderingBasis: z.literal('caller_supplied'),
}).passthrough();
