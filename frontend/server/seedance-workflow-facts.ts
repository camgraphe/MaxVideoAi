import type { NormalizedAttachment } from '@/app/api/generate/_lib/generation-attachment-types';
import type { MinimaxH3MaxPricingReference } from '@/lib/minimax-h3-max-pricing';
import type { SeedanceEditSourceFacts } from '@/lib/seedance-edit-source';
import type { AspectRatio, EngineCaps, Mode } from '@/types/engines';
import { isRecord } from './byteplus-record-utils';
import { deriveGenerationAttachmentReferences } from '@/app/api/generate/_lib/attachment-references';
import { createHash } from 'node:crypto';
import { seedanceSourcePricingAspectRatio } from '@/lib/seedance-option-pricing';

export const SEEDANCE_WORKFLOW_MODES = ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'] as const;
export type SeedanceWorkflowMode = typeof SEEDANCE_WORKFLOW_MODES[number];

/** Captured after owned media validation, before the initial debit; never read from a caller. */
export type SeedanceWorkflowMediaFacts = {
  schemaVersion: 1;
  mode: SeedanceWorkflowMode;
  durationSec: number;
  durationOption?: number | string | null;
  aspectRatio: string | null;
  hasVideoInput: boolean;
  inputVideoDurationSec?: number;
  seedanceSourceAspectRatio?: AspectRatio;
  seedanceEditSource?: SeedanceEditSourceFacts;
  attachments: NormalizedAttachment[];
  trustedMediaReferences: MinimaxH3MaxPricingReference[];
};

export function readSeedanceWorkflowMediaFacts(value: unknown): SeedanceWorkflowMediaFacts | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || !SEEDANCE_WORKFLOW_MODES.includes(value.mode as SeedanceWorkflowMode)
    || !Number.isInteger(value.durationSec) || Number(value.durationSec) < 4 || Number(value.durationSec) > 30
    || (value.aspectRatio !== null && typeof value.aspectRatio !== 'string') || typeof value.hasVideoInput !== 'boolean'
    || !Array.isArray(value.attachments) || !Array.isArray(value.trustedMediaReferences)
    || value.attachments.some(attachment => !isRecord(attachment) || !['image', 'video', 'audio'].includes(String(attachment.kind))
      || typeof attachment.url !== 'string' || !attachment.url || typeof attachment.slotId !== 'string')
    || value.trustedMediaReferences.some(reference => !isRecord(reference) || !['image', 'video', 'audio'].includes(String(reference.kind))
      || typeof reference.url !== 'string' || !reference.url)) return null;
  const videos = value.attachments.filter(attachment => isRecord(attachment) && attachment.kind === 'video');
  if (value.hasVideoInput !== (videos.length > 0) || (value.hasVideoInput
    && (typeof value.inputVideoDurationSec !== 'number' || !Number.isFinite(value.inputVideoDurationSec)
      || value.inputVideoDurationSec <= 0 || value.inputVideoDurationSec > 30))) return null;
  if (value.mode === 'i2v' && !value.attachments.some(attachment => isRecord(attachment) && attachment.kind === 'image')) return null;
  if (['v2v', 'extend'].includes(String(value.mode)) && !value.hasVideoInput) return null;
  if (value.mode === 'ref2v' && value.attachments.length === 0) return null;
  return value as SeedanceWorkflowMediaFacts;
}

export function captureSeedanceWorkflowMediaFacts(value: SeedanceWorkflowMediaFacts): SeedanceWorkflowMediaFacts {
  const facts = readSeedanceWorkflowMediaFacts(JSON.parse(JSON.stringify(value)));
  if (!facts) throw new Error('Verified Draft media facts are incomplete.');
  return facts;
}

/** Final content is provider-owned; reference reconstruction performs no network or library lookup. */
export function restoreSeedanceFinalAttachments(facts: SeedanceWorkflowMediaFacts,
  params: Omit<Parameters<typeof deriveGenerationAttachmentReferences>[0], 'attachments'>) {
  const attachments = facts.attachments;
  const references = deriveGenerationAttachmentReferences({ ...params, attachments });
  const trustedDurationSecByField = attachments.reduce<Record<string, number[]>>((fields, attachment) => {
    if (attachment.slotId && typeof attachment.durationSec === 'number') (fields[attachment.slotId] ??= []).push(attachment.durationSec);
    return fields;
  }, {});
  return { ok: true as const, attachments, references, trustedDurationSecByField, trustedMediaReferences: facts.trustedMediaReferences };
}

/** Completion checkpoints may grow; only immutable creative and billing settings bind the debit. */
export function seedanceDraftBillingFingerprint(parent: { prompt: string; audio: boolean; settings: unknown }): string {
  const settings = isRecord(parent.settings) ? parent.settings : {};
  const workflow = isRecord(settings.seedanceWorkflow) ? settings.seedanceWorkflow : {};
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
    : isRecord(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  return createHash('sha256').update(JSON.stringify(canonical({ prompt: parent.prompt, audio: parent.audio,
    inputMode: settings.inputMode, core: settings.core, advanced: settings.advanced, refs: settings.refs, mediaFacts: workflow.mediaFacts }))).digest('hex');
}

export function resolveSeedanceWorkflowSourceFacts(params: { engine: EngineCaps; mode: Mode; aspectRatio: string | null;
  initialImageUrl?: string; trustedMediaReferences: MinimaxH3MaxPricingReference[]; finalFacts?: SeedanceWorkflowMediaFacts }) {
  try {
    const sourceAspectRatio = params.finalFacts?.seedanceSourceAspectRatio ?? seedanceSourcePricingAspectRatio(params,
      params.trustedMediaReferences.filter(reference => params.mode !== 'i2v' || reference.url === params.initialImageUrl));
    return { ok: true as const, sourceAspectRatio };
  } catch (error) {
    return { ok: false as const, status: 422, body: { ok: false, error: 'SEEDANCE_SOURCE_FORMAT_UNSUPPORTED',
      message: error instanceof Error ? error.message : 'Verified source framing is required.' } };
  }
}
