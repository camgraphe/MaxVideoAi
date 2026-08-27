import { getUserMembershipStatus, type UserMembershipStatus } from '@/server/membership/user-membership-status';

import { computeGenerationCatalogRevision } from './catalog-revision';
import { AgentApiError } from './errors';
import {
  GenerationCapabilityError,
  validateCanonicalGenerationCapabilities,
} from './generation-capability-validation';
import { priceCanonicalGeneration, type GenerationPricingResult } from './generation-pricing';
import type {
  CanonicalGenerationReference,
  CanonicalGenerationRequest,
  CanonicalVideoGenerationMode,
} from './generation-types';
import { CANONICAL_VIDEO_GENERATION_MODES } from './generation-types';
import { MAX_CANONICAL_REFERENCES } from './generation-normalization';
import {
  type AgentModelCatalogDeps,
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
type ProjectVideoMode = CanonicalVideoGenerationMode;

const VIDEO_MODES = new Set<ProjectVideoMode>(CANONICAL_VIDEO_GENERATION_MODES);
const REFERENCE_ROLES = new Set(['source', 'first_frame', 'last_frame', 'reference']);
const CURRENCY_PATTERN = /^[A-Z]{3}$/u;

type ProjectReferenceRole = 'source' | 'first_frame' | 'last_frame' | 'reference';

export type AgentProjectBudgetInput = Readonly<{
  proposals: readonly Readonly<{
    name: string;
    lines: readonly Readonly<{
      purpose: string;
      engineId: string;
      mode: ProjectVideoMode;
      settings: Readonly<{
        durationSec: number;
        resolution: string;
        aspectRatio?: string;
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
  mode: ProjectVideoMode;
  settings: Readonly<{
    durationSec: number;
    resolution: string;
    aspectRatio?: string;
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
  currency: string;
  membershipTier: AuthoritativeMembershipTier;
  catalogRevision: string;
  pricingScope: 'connected_environment';
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

export function createAgentProjectBudgetDependencies(
  catalogDeps: AgentModelCatalogDeps,
): AgentProjectBudgetDependencies {
  return {
    ...defaultDependencies,
    listPublicEngines: () => listPublicAgentGenerationEngines(catalogDeps),
  };
}

function invalidParameter(): never {
  throw new AgentApiError('PARAMETER_INVALID', 'The project budget request contains invalid settings.');
}

function editProjectLine(
  code: AgentApiError['code'],
  message: string,
  proposalIndex: number,
  lineIndex: number,
  field: string,
): never {
  throw new AgentApiError(code, message, false, {
    type: 'edit_project_line',
    proposalIndex,
    lineIndex,
    field,
  });
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

function safeCapabilityField(field: string): string {
  const aliases: Readonly<Record<string, string>> = {
    duration: 'durationSec',
    aspect_ratio: 'aspectRatio',
    generate_audio: 'audio',
    image_url: 'references',
    first_frame_url: 'references',
    last_frame_url: 'references',
    image_urls: 'references',
    reference_image_urls: 'references',
    video_url: 'references',
    video_urls: 'references',
    extension_source_videos: 'references',
  };
  const normalized = aliases[field] ?? field;
  return new Set([
    'engineId', 'mode', 'prompt', 'durationSec', 'resolution', 'aspectRatio', 'fps',
    'audio', 'loop', 'references', 'settings',
  ]).has(normalized) ? normalized : 'settings';
}

function mapCapabilityError(
  error: unknown,
  proposalIndex: number,
  lineIndex: number,
): never {
  if (error instanceof GenerationCapabilityError) {
    const field = safeCapabilityField(error.field);
    if (error.kind === 'reference_required') {
      editProjectLine(
        'REFERENCE_REQUIRED',
        'The selected model needs the declared reference input.',
        proposalIndex,
        lineIndex,
        field,
      );
    }
    if (error.kind === 'reference_invalid') {
      editProjectLine(
        'REFERENCE_INVALID',
        'The declared reference inputs are not supported by the selected model.',
        proposalIndex,
        lineIndex,
        field,
      );
    }
    editProjectLine(
      'PARAMETER_INVALID',
      'A setting is not supported by the selected model.',
      proposalIndex,
      lineIndex,
      field,
    );
  }
  invalidParameter();
}

function requireLineText(
  value: unknown,
  maxLength: number,
  proposalIndex: number,
  lineIndex: number,
  field: string,
): string {
  if (typeof value !== 'string' || value !== value.trim() || value.length < 1 || value.length > maxLength) {
    editProjectLine('PARAMETER_INVALID', 'A project line field is invalid.', proposalIndex, lineIndex, field);
  }
  return value;
}

function requireLineInteger(
  value: unknown,
  min: number,
  max: number,
  proposalIndex: number,
  lineIndex: number,
  field: string,
): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    editProjectLine('PARAMETER_INVALID', 'A project line number is invalid.', proposalIndex, lineIndex, field);
  }
  return value as number;
}

function normalizeSettings(
  value: unknown,
  proposalIndex: number,
  lineIndex: number,
): AgentProjectBudgetLine['settings'] {
  if (!isPlainObject(value)) {
    editProjectLine('PARAMETER_INVALID', 'Project line settings are invalid.', proposalIndex, lineIndex, 'settings');
  }
  const allowed = new Set(['durationSec', 'resolution', 'aspectRatio', 'fps', 'audio', 'loop']);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    editProjectLine('PARAMETER_INVALID', 'Project line settings contain an unsupported field.', proposalIndex, lineIndex, 'settings');
  }
  const settings = value;
  const durationSec = requireLineInteger(settings.durationSec, 1, 86_400, proposalIndex, lineIndex, 'durationSec');
  const resolution = requireLineText(settings.resolution, 64, proposalIndex, lineIndex, 'resolution');
  const aspectRatio = settings.aspectRatio === undefined
    ? undefined
    : requireLineText(settings.aspectRatio, 64, proposalIndex, lineIndex, 'aspectRatio');
  const fps = settings.fps === undefined
    ? undefined
    : requireLineInteger(settings.fps, 1, 240, proposalIndex, lineIndex, 'fps');
  if (settings.audio !== undefined && typeof settings.audio !== 'boolean') {
    editProjectLine('PARAMETER_INVALID', 'Project line audio intent is invalid.', proposalIndex, lineIndex, 'audio');
  }
  if (settings.loop !== undefined && typeof settings.loop !== 'boolean') {
    editProjectLine('PARAMETER_INVALID', 'Project line loop intent is invalid.', proposalIndex, lineIndex, 'loop');
  }
  return {
    durationSec,
    resolution,
    ...(aspectRatio === undefined ? {} : { aspectRatio }),
    ...(fps === undefined ? {} : { fps }),
    ...(settings.audio === undefined ? {} : { audio: settings.audio }),
    ...(settings.loop === undefined ? {} : { loop: settings.loop }),
  };
}

function normalizeReferenceRoles(
  value: unknown,
  proposalIndex: number,
  lineIndex: number,
): readonly ProjectReferenceRole[] {
  if (value === undefined) return [];
  if (Array.isArray(value) && value.length > MAX_CANONICAL_REFERENCES) {
    editProjectLine(
      'REFERENCE_INVALID',
      'The project includes too many references for one line.',
      proposalIndex,
      lineIndex,
      'references',
    );
  }
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    editProjectLine('REFERENCE_INVALID', 'The project references are invalid.', proposalIndex, lineIndex, 'references');
  }
  const roles = value;
  for (let index = 0; index < roles.length; index += 1) {
    if (!Object.hasOwn(roles, index)) {
      editProjectLine('REFERENCE_INVALID', 'The project references are invalid.', proposalIndex, lineIndex, 'references');
    }
  }
  return roles.map((role) => {
    if (typeof role !== 'string' || !REFERENCE_ROLES.has(role)) {
      editProjectLine(
        'REFERENCE_INVALID',
        'The project includes an unsupported reference role.',
        proposalIndex,
        lineIndex,
        'references',
      );
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

function requireLine(value: unknown, proposalIndex: number, lineIndex: number): Record<string, unknown> {
  if (!isPlainObject(value)) {
    editProjectLine('PARAMETER_INVALID', 'The project line is invalid.', proposalIndex, lineIndex, 'line');
  }
  const allowed = new Set([
    'purpose', 'engineId', 'mode', 'settings', 'referenceRoles', 'clipCount', 'attemptsPerClip',
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    editProjectLine('PARAMETER_INVALID', 'The project line contains an unsupported field.', proposalIndex, lineIndex, 'line');
  }
  return value;
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
      const rawLine = requireLine(rawLines[lineIndex], proposalIndex, lineIndex);
      const purpose = requireLineText(rawLine.purpose, 240, proposalIndex, lineIndex, 'purpose');
      const engineId = requireLineText(rawLine.engineId, 128, proposalIndex, lineIndex, 'engineId');
      const mode = rawLine.mode;
      const candidate = candidates.get(engineId);
      if (!candidate) {
        editProjectLine(
          'ENGINE_UNAVAILABLE',
          'The selected model is not currently available.',
          proposalIndex,
          lineIndex,
          'engineId',
        );
      }
      if (
        candidate.surface !== 'video'
        || typeof mode !== 'string'
        || !VIDEO_MODES.has(mode as ProjectVideoMode)
        || !candidate.publicModes.includes(mode as ProjectVideoMode)
      ) {
        editProjectLine(
          'MODE_UNSUPPORTED',
          'The selected model does not support this video mode.',
          proposalIndex,
          lineIndex,
          'mode',
        );
      }
      const settings = normalizeSettings(rawLine.settings, proposalIndex, lineIndex);
      const clipCount = requireLineInteger(
        rawLine.clipCount, 1, MAX_PROJECT_CLIPS_PER_LINE, proposalIndex, lineIndex, 'clipCount',
      );
      const attemptsPerClip = requireLineInteger(
        rawLine.attemptsPerClip,
        1,
        MAX_PROJECT_ATTEMPTS_PER_CLIP,
        proposalIndex,
        lineIndex,
        'attemptsPerClip',
      );
      const pricedAttempts = checkedMultiplyCents(clipCount, attemptsPerClip);
      totalAttempts = checkedAddCents(totalAttempts, pricedAttempts);
      if (totalAttempts > MAX_PROJECT_TOTAL_ATTEMPTS) {
        editProjectLine(
          'PARAMETER_INVALID',
          'The project includes too many priced attempts.',
          proposalIndex,
          lineIndex,
          'attemptsPerClip',
        );
      }
      const referenceRoles = normalizeReferenceRoles(rawLine.referenceRoles, proposalIndex, lineIndex);
      const request: CanonicalGenerationRequest = {
        schemaVersion: 1,
        surface: 'video',
        engineId,
        mode: mode as ProjectVideoMode,
        prompt: PROJECT_PROMPT,
        settings,
        references: placeholdersFor(referenceRoles, proposalIndex, lineIndex),
        outputCount: 1,
      };
      try {
        validateCanonicalGenerationCapabilities(request, candidate);
      } catch (error) {
        mapCapabilityError(error, proposalIndex, lineIndex);
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
    currency,
    membershipTier,
    catalogRevision,
    pricingScope: 'connected_environment',
    quoteRequired: true,
    nextAction: 'discuss_and_refine',
  };
}
