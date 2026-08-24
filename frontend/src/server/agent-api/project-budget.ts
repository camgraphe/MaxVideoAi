import { getUserMembershipStatus, type UserMembershipStatus } from '@/server/membership/user-membership-status';

import { computeGenerationCatalogRevision } from './catalog-revision';
import { AgentApiError } from './errors';
import {
  GenerationCapabilityError,
  validateCanonicalGenerationCapabilities,
} from './generation-capability-validation';
import { priceCanonicalGeneration, type GenerationPricingResult } from './generation-pricing';
import type { CanonicalGenerationReference, CanonicalGenerationRequest } from './generation-types';
import {
  listPublicAgentGenerationEngines,
  type AgentPublicGenerationEngine,
} from './model-catalog';
import type { AgentPrincipal } from './principal';
import type { AuthoritativeMembershipTier } from '../membership/user-membership-status';

export const MAX_PROJECT_PROPOSALS = 4;
export const MAX_PROJECT_LINES = 12;
export const MAX_PROJECT_CLIPS_PER_LINE = 100;
export const MAX_PROJECT_ATTEMPTS_PER_CLIP = 10;
export const MAX_PROJECT_TOTAL_ATTEMPTS = 500;

const PROJECT_PROMPT = 'Project pricing scenario';
const VIDEO_MODES = new Set(['t2v', 'i2v', 'ref2v']);
const REFERENCE_ROLES = new Set(['source', 'first_frame', 'last_frame', 'reference']);
const CURRENCY_PATTERN = /^[A-Z]{3}$/u;

type ProjectReferenceRole = 'source' | 'first_frame' | 'last_frame' | 'reference';

export type AgentProjectBudgetInput = Readonly<{
  proposals: readonly Readonly<{
    name: string;
    lines: readonly Readonly<{
      purpose: string;
      engineId: string;
      mode: 't2v' | 'i2v' | 'ref2v';
      settings: Readonly<{
        durationSec: number;
        resolution: string;
        aspectRatio: string;
        fps?: number;
        audio?: boolean;
        loop?: boolean;
      }>;
      referenceRoles?: readonly ProjectReferenceRole[];
      clipCount: number;
      attemptsPerClip: number;
    }> [];
  }> [];
}>;

type BudgetMoney = Readonly<{ amountCents: number; currency: string }>;

export type AgentProjectBudgetLine = Readonly<{
  purpose: string;
  engineId: string;
  mode: 't2v' | 'i2v' | 'ref2v';
  settings: Readonly<{
    durationSec: number;
    resolution: string;
    aspectRatio: string;
    fps?: number;
    audio?: boolean;
    loop?: boolean;
  }>;
  referenceCount: number;
  clipCount: number;
  attemptsPerClip: number;
  unitPrice: BudgetMoney;
  baseProduction: BudgetMoney & Readonly<{ attempts: number }>;
  creativeAttempts: BudgetMoney & Readonly<{ attempts: number }>;
  total: BudgetMoney;
  intendedOutputDurationSec: number;
}>;

export type AgentProjectBudgetProposal = Readonly<{
  name: string;
  lines: readonly AgentProjectBudgetLine[];
  baseProduction: BudgetMoney;
  creativeAttempts: BudgetMoney;
  total: BudgetMoney;
  intendedOutputDurationSec: number;
}>;

export type AgentProjectBudgetResult = Readonly<{
  proposals: readonly AgentProjectBudgetProposal[];
  total: BudgetMoney;
  currency: string;
  intendedOutputDurationSec: number;
  membershipTier: AuthoritativeMembershipTier;
  catalogRevision: string;
  quoteRequired: true;
  nextAction: 'discuss_and_refine';
}>;

export type AgentProjectBudgetDependencies = {
  listPublicEngines(): Promise<AgentPublicGenerationEngine[]>;
  getMembershipStatus(userId: string): Promise<Pick<UserMembershipStatus, 'pricing'>>;
  priceGeneration(
    request: CanonicalGenerationRequest,
    membershipTier: AuthoritativeMembershipTier,
  ): Promise<GenerationPricingResult>;
  computeCatalogRevision(engines: readonly AgentPublicGenerationEngine[]): string;
};

const defaultDependencies: AgentProjectBudgetDependencies = {
  listPublicEngines: () => listPublicAgentGenerationEngines(),
  getMembershipStatus: getUserMembershipStatus,
  priceGeneration: priceCanonicalGeneration,
  computeCatalogRevision: computeGenerationCatalogRevision,
};

function invalidParameter(): never {
  throw new AgentApiError('PARAMETER_INVALID', 'The project budget request contains invalid settings.');
}

function internalPricingError(): never {
  throw new AgentApiError('INTERNAL_ERROR', 'Current project pricing is unavailable.');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function requireExactObject(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!isPlainObject(value)) invalidParameter();
  const allowedKeys = new Set(allowed);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) invalidParameter();
  return value;
}

function requireDenseArray(value: unknown, min: number, max: number): readonly unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length < min || value.length > max) {
    invalidParameter();
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) invalidParameter();
  }
  return value;
}

function requireText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string' || value !== value.trim() || value.length < 1 || value.length > maxLength) {
    invalidParameter();
  }
  return value;
}

function requireInteger(value: unknown, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) invalidParameter();
  return value as number;
}

function requirePrincipal(principal: AgentPrincipal): void {
  if (
    !principal
    || principal.authMethod !== 'oauth'
    || typeof principal.userId !== 'string'
    || principal.userId.length < 1
    || principal.userId.length > 128
    || principal.userId !== principal.userId.trim()
  ) {
    throw new AgentApiError('AUTH_REQUIRED', 'Connect MaxVideoAI before calculating a project budget.');
  }
}

function checkedMultiplyCents(left: number, right: number): number {
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right) || left < 0 || right < 0) {
    internalPricingError();
  }
  const result = left * right;
  if (!Number.isSafeInteger(result) || result < 0) internalPricingError();
  return result;
}

function checkedAddCents(left: number, right: number): number {
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right) || left < 0 || right < 0) {
    internalPricingError();
  }
  const result = left + right;
  if (!Number.isSafeInteger(result) || result < 0) internalPricingError();
  return result;
}

function mapCapabilityError(error: unknown): never {
  if (error instanceof GenerationCapabilityError) {
    if (error.kind === 'reference_required') {
      throw new AgentApiError('REFERENCE_REQUIRED', 'The selected model needs the declared reference input.');
    }
    if (error.kind === 'reference_invalid') {
      throw new AgentApiError('REFERENCE_INVALID', 'The declared reference inputs are not supported by the selected model.');
    }
  }
  invalidParameter();
}

function normalizeSettings(value: unknown): AgentProjectBudgetLine['settings'] {
  const settings = requireExactObject(value, ['durationSec', 'resolution', 'aspectRatio', 'fps', 'audio', 'loop']);
  const durationSec = requireInteger(settings.durationSec, 1, 86_400);
  const resolution = requireText(settings.resolution, 64);
  const aspectRatio = requireText(settings.aspectRatio, 64);
  const fps = settings.fps === undefined ? undefined : requireInteger(settings.fps, 1, 240);
  if (settings.audio !== undefined && typeof settings.audio !== 'boolean') invalidParameter();
  if (settings.loop !== undefined && typeof settings.loop !== 'boolean') invalidParameter();
  return {
    durationSec,
    resolution,
    aspectRatio,
    ...(fps === undefined ? {} : { fps }),
    ...(settings.audio === undefined ? {} : { audio: settings.audio }),
    ...(settings.loop === undefined ? {} : { loop: settings.loop }),
  };
}

function normalizeReferenceRoles(value: unknown): readonly ProjectReferenceRole[] {
  if (value === undefined) return [];
  if (Array.isArray(value) && value.length > 16) {
    throw new AgentApiError('REFERENCE_INVALID', 'The project includes too many references for one line.');
  }
  const roles = requireDenseArray(value, 0, 16);
  return roles.map((role) => {
    if (typeof role !== 'string' || !REFERENCE_ROLES.has(role)) {
      throw new AgentApiError('REFERENCE_INVALID', 'The project includes an unsupported reference role.');
    }
    return role as ProjectReferenceRole;
  });
}

function placeholdersFor(
  roles: readonly ProjectReferenceRole[],
  proposalIndex: number,
  lineIndex: number,
): CanonicalGenerationReference[] {
  return roles.map((role, index) => ({
    kind: 'asset',
    assetId: `project-pricing-${proposalIndex + 1}-${lineIndex + 1}-${index + 1}`,
    role,
  }));
}

function requireMembershipTier(value: unknown): AuthoritativeMembershipTier {
  if (value === 'member' || value === 'plus' || value === 'pro') return value;
  internalPricingError();
}

function validatePrice(
  result: GenerationPricingResult,
  membershipTier: AuthoritativeMembershipTier,
): BudgetMoney {
  const snapshot = result?.pricingSnapshot;
  if (
    !Number.isSafeInteger(result?.priceCents)
    || result.priceCents < 0
    || typeof result.currency !== 'string'
    || !CURRENCY_PATTERN.test(result.currency)
    || result.membershipTier !== membershipTier
    || !isPlainObject(snapshot)
    || snapshot.totalCents !== result.priceCents
    || snapshot.currency !== result.currency
    || snapshot.membershipTier !== membershipTier
  ) {
    internalPricingError();
  }
  return { amountCents: result.priceCents, currency: result.currency };
}

function requireLine(value: unknown): Record<string, unknown> {
  return requireExactObject(value, [
    'purpose', 'engineId', 'mode', 'settings', 'referenceRoles', 'clipCount', 'attemptsPerClip',
  ]);
}

export async function calculateAgentProjectBudget(
  input: AgentProjectBudgetInput,
  principal: AgentPrincipal,
  dependencies: AgentProjectBudgetDependencies = defaultDependencies,
): Promise<AgentProjectBudgetResult> {
  requirePrincipal(principal);
  const root = requireExactObject(input, ['proposals']);
  const rawProposals = requireDenseArray(root.proposals, 1, MAX_PROJECT_PROPOSALS);
  const engines = await dependencies.listPublicEngines();
  if (!Array.isArray(engines)) internalPricingError();
  const candidates = new Map(engines.map((candidate) => [candidate.engine.id, candidate]));
  const membership = await dependencies.getMembershipStatus(principal.userId);
  const membershipTier = requireMembershipTier(membership?.pricing?.tier);
  const catalogRevision = dependencies.computeCatalogRevision(engines);
  if (typeof catalogRevision !== 'string' || catalogRevision.length < 1 || catalogRevision.length > 256) {
    internalPricingError();
  }

  let lineCount = 0;
  let totalAttempts = 0;
  let currency: string | null = null;
  let projectBaseCents = 0;
  let projectCreativeCents = 0;
  let projectDurationSec = 0;
  const proposals: AgentProjectBudgetProposal[] = [];

  for (let proposalIndex = 0; proposalIndex < rawProposals.length; proposalIndex += 1) {
    const rawProposal = requireExactObject(rawProposals[proposalIndex], ['name', 'lines']);
    const name = requireText(rawProposal.name, 160);
    const rawLines = requireDenseArray(rawProposal.lines, 1, MAX_PROJECT_LINES);
    lineCount += rawLines.length;
    if (lineCount > MAX_PROJECT_LINES) invalidParameter();
    let proposalBaseCents = 0;
    let proposalCreativeCents = 0;
    let proposalDurationSec = 0;
    const lines: AgentProjectBudgetLine[] = [];

    for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex += 1) {
      const rawLine = requireLine(rawLines[lineIndex]);
      const purpose = requireText(rawLine.purpose, 240);
      const engineId = requireText(rawLine.engineId, 128);
      const mode = rawLine.mode;
      const candidate = candidates.get(engineId);
      if (!candidate) throw new AgentApiError('ENGINE_UNAVAILABLE', 'The selected model is not currently available.');
      if (candidate.surface !== 'video' || typeof mode !== 'string' || !VIDEO_MODES.has(mode) || !candidate.publicModes.includes(mode as never)) {
        throw new AgentApiError('MODE_UNSUPPORTED', 'The selected model does not support this video mode.');
      }
      const settings = normalizeSettings(rawLine.settings);
      const clipCount = requireInteger(rawLine.clipCount, 1, MAX_PROJECT_CLIPS_PER_LINE);
      const attemptsPerClip = requireInteger(rawLine.attemptsPerClip, 1, MAX_PROJECT_ATTEMPTS_PER_CLIP);
      const pricedAttempts = checkedMultiplyCents(clipCount, attemptsPerClip);
      totalAttempts = checkedAddCents(totalAttempts, pricedAttempts);
      if (totalAttempts > MAX_PROJECT_TOTAL_ATTEMPTS) invalidParameter();
      const referenceRoles = normalizeReferenceRoles(rawLine.referenceRoles);
      const request: CanonicalGenerationRequest = {
        schemaVersion: 1,
        surface: 'video',
        engineId,
        mode: mode as 't2v' | 'i2v' | 'ref2v',
        prompt: PROJECT_PROMPT,
        settings,
        references: placeholdersFor(referenceRoles, proposalIndex, lineIndex),
        outputCount: 1,
      };
      try {
        validateCanonicalGenerationCapabilities(request, candidate);
      } catch (error) {
        mapCapabilityError(error);
      }
      let unitPrice: BudgetMoney;
      try {
        unitPrice = validatePrice(await dependencies.priceGeneration(request, membershipTier), membershipTier);
      } catch (error) {
        if (error instanceof AgentApiError) throw error;
        internalPricingError();
      }
      if (currency !== null && currency !== unitPrice.currency) internalPricingError();
      currency = unitPrice.currency;
      const baseAttempts = clipCount;
      const creativeAttempts = checkedMultiplyCents(clipCount, attemptsPerClip - 1);
      const baseCents = checkedMultiplyCents(unitPrice.amountCents, baseAttempts);
      const creativeCents = checkedMultiplyCents(unitPrice.amountCents, creativeAttempts);
      const totalCents = checkedAddCents(baseCents, creativeCents);
      const intendedOutputDurationSec = checkedMultiplyCents(settings.durationSec, clipCount);
      proposalBaseCents = checkedAddCents(proposalBaseCents, baseCents);
      proposalCreativeCents = checkedAddCents(proposalCreativeCents, creativeCents);
      proposalDurationSec = checkedAddCents(proposalDurationSec, intendedOutputDurationSec);
      lines.push({
        purpose, engineId, mode: request.mode as AgentProjectBudgetLine['mode'], settings, referenceCount: referenceRoles.length,
        clipCount, attemptsPerClip, unitPrice,
        baseProduction: { amountCents: baseCents, currency: unitPrice.currency, attempts: baseAttempts },
        creativeAttempts: { amountCents: creativeCents, currency: unitPrice.currency, attempts: creativeAttempts },
        total: { amountCents: totalCents, currency: unitPrice.currency }, intendedOutputDurationSec,
      });
    }
    const outputCurrency = currency;
    if (!outputCurrency) internalPricingError();
    const proposalTotalCents = checkedAddCents(proposalBaseCents, proposalCreativeCents);
    projectBaseCents = checkedAddCents(projectBaseCents, proposalBaseCents);
    projectCreativeCents = checkedAddCents(projectCreativeCents, proposalCreativeCents);
    projectDurationSec = checkedAddCents(projectDurationSec, proposalDurationSec);
    proposals.push({
      name, lines,
      baseProduction: { amountCents: proposalBaseCents, currency: outputCurrency },
      creativeAttempts: { amountCents: proposalCreativeCents, currency: outputCurrency },
      total: { amountCents: proposalTotalCents, currency: outputCurrency },
      intendedOutputDurationSec: proposalDurationSec,
    });
  }
  if (!currency) internalPricingError();
  return {
    proposals,
    total: { amountCents: checkedAddCents(projectBaseCents, projectCreativeCents), currency },
    currency,
    intendedOutputDurationSec: projectDurationSec,
    membershipTier,
    catalogRevision,
    quoteRequired: true,
    nextAction: 'discuss_and_refine',
  };
}
