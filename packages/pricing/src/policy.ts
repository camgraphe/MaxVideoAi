export type PricingPolicyRule = {
  id: string;
  engineId?: string;
  mode?: string;
  resolution?: string;
  marginPercent: number;
  marginFlatCents: number;
  surchargeAudioPercent: number;
  surchargeUpscalePercent: number;
  currency: string;
  compatibilityProfile?: string;
};

export type PricingCompatibilityProfile = {
  id: string;
  vendorSubtotalRounding: 'nearest' | 'up' | 'down' | 'preserve';
  marginRounding: 'nearest' | 'up' | 'down';
  surchargeRounding: 'nearest' | 'up' | 'down';
  discountRounding: 'nearest' | 'up' | 'down';
  totalRounding: 'nearest' | 'up' | 'down';
  subtotalRounding?: 'nearest' | 'up' | 'down';
  marginPercentOverride?: number;
  marginFlatCentsOverride?: number;
  surchargeAudioPercentOverride?: number;
  surchargeUpscalePercentOverride?: number;
  discountPercentOverride?: number;
};

export type PricingPolicyDocument = {
  version: 1;
  supportedCurrencies: string[];
  compatibilityProfiles: PricingCompatibilityProfile[];
  rules: PricingPolicyRule[];
};

export type PricingPolicyReferences = {
  engineIds?: ReadonlySet<string>;
  modesByEngineId?: ReadonlyMap<string, ReadonlySet<string>>;
  resolutionsByEngineId?: ReadonlyMap<string, ReadonlySet<string>>;
};

export type PricingPolicyScenario = {
  engineId: string;
  mode?: string;
  resolution?: string;
};

export type ResolvedPricingPolicy = {
  rule: PricingPolicyRule;
  source: 'database' | 'versioned';
  matchedBy: 'precise' | 'engine' | 'global';
  sourceRuleId: string;
};

export type PricingPolicyResolutionCode = 'ambiguous_match' | 'missing_rule';

export class PricingPolicyResolutionError extends Error {
  readonly code: PricingPolicyResolutionCode;

  constructor(code: PricingPolicyResolutionCode, message: string) {
    super(message);
    this.name = 'PricingPolicyResolutionError';
    this.code = code;
  }
}

export type PricingPolicyValidationCode =
  | 'invalid_document'
  | 'unsupported_version'
  | 'duplicate_id'
  | 'invalid_number'
  | 'unsupported_currency'
  | 'unknown_engine'
  | 'unknown_mode'
  | 'unknown_resolution'
  | 'unknown_compatibility_profile'
  | 'ambiguous_selector'
  | 'missing_global_rule';

export class PricingPolicyValidationError extends Error {
  readonly code: PricingPolicyValidationCode;

  constructor(code: PricingPolicyValidationCode, message: string) {
    super(message);
    this.name = 'PricingPolicyValidationError';
    this.code = code;
  }
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PricingPolicyValidationError('invalid_document', `${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new PricingPolicyValidationError('invalid_document', `${label} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(value: unknown, label: string): string | undefined {
  return value == null ? undefined : asNonEmptyString(value, label);
}

function nonNegativeNumber(value: unknown, label: string, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (integer && !Number.isInteger(value))) {
    throw new PricingPolicyValidationError('invalid_number', `${label} must be a finite non-negative${integer ? ' integer' : ''}`);
  }
  return value;
}

function optionalNonNegativeNumber(value: unknown, label: string, integer = false): number | undefined {
  return value == null ? undefined : nonNegativeNumber(value, label, integer);
}

function roundingValue<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new PricingPolicyValidationError('invalid_document', `${label} has an unsupported rounding mode`);
  }
  return value as T;
}

function selectorKey(rule: PricingPolicyRule): string {
  return `${rule.engineId ?? '*'}|${rule.mode ?? '*'}|${rule.resolution ?? '*'}`;
}

export function validatePricingPolicyDocument(
  input: unknown,
  references: PricingPolicyReferences = {}
): PricingPolicyDocument {
  const document = asRecord(input, 'pricing policy');
  if (document.version !== 1) {
    throw new PricingPolicyValidationError('unsupported_version', 'pricing policy version must be 1');
  }
  if (!Array.isArray(document.supportedCurrencies) || !document.supportedCurrencies.length) {
    throw new PricingPolicyValidationError('invalid_document', 'supportedCurrencies must be a non-empty array');
  }
  const supportedCurrencies = document.supportedCurrencies.map((value, index) =>
    asNonEmptyString(value, `supportedCurrencies[${index}]`).toUpperCase()
  );
  if (new Set(supportedCurrencies).size !== supportedCurrencies.length) {
    throw new PricingPolicyValidationError('duplicate_id', 'supportedCurrencies must be unique');
  }

  if (!Array.isArray(document.compatibilityProfiles)) {
    throw new PricingPolicyValidationError('invalid_document', 'compatibilityProfiles must be an array');
  }
  const profileIds = new Set<string>();
  const compatibilityProfiles = document.compatibilityProfiles.map((raw, index): PricingCompatibilityProfile => {
    const profile = asRecord(raw, `compatibilityProfiles[${index}]`);
    const id = asNonEmptyString(profile.id, `compatibilityProfiles[${index}].id`);
    if (profileIds.has(id)) throw new PricingPolicyValidationError('duplicate_id', `duplicate compatibility profile id: ${id}`);
    profileIds.add(id);
    const marginPercentOverride = optionalNonNegativeNumber(profile.marginPercentOverride, `${id}.marginPercentOverride`);
    const marginFlatCentsOverride = optionalNonNegativeNumber(profile.marginFlatCentsOverride, `${id}.marginFlatCentsOverride`, true);
    const surchargeAudioPercentOverride = optionalNonNegativeNumber(
      profile.surchargeAudioPercentOverride,
      `${id}.surchargeAudioPercentOverride`
    );
    const surchargeUpscalePercentOverride = optionalNonNegativeNumber(
      profile.surchargeUpscalePercentOverride,
      `${id}.surchargeUpscalePercentOverride`
    );
    const discountPercentOverride = optionalNonNegativeNumber(profile.discountPercentOverride, `${id}.discountPercentOverride`);
    if (discountPercentOverride != null && discountPercentOverride > 1) {
      throw new PricingPolicyValidationError('invalid_number', `${id}.discountPercentOverride must not exceed 1`);
    }
    const subtotalRounding =
      profile.subtotalRounding == null
        ? undefined
        : roundingValue(profile.subtotalRounding, ['nearest', 'up', 'down'], `${id}.subtotalRounding`);
    return {
      id,
      vendorSubtotalRounding: roundingValue(profile.vendorSubtotalRounding, ['nearest', 'up', 'down', 'preserve'], `${id}.vendorSubtotalRounding`),
      marginRounding: roundingValue(profile.marginRounding, ['nearest', 'up', 'down'], `${id}.marginRounding`),
      surchargeRounding: roundingValue(profile.surchargeRounding, ['nearest', 'up', 'down'], `${id}.surchargeRounding`),
      discountRounding: roundingValue(profile.discountRounding, ['nearest', 'up', 'down'], `${id}.discountRounding`),
      totalRounding: roundingValue(profile.totalRounding, ['nearest', 'up', 'down'], `${id}.totalRounding`),
      ...(subtotalRounding ? { subtotalRounding } : {}),
      ...(marginPercentOverride != null ? { marginPercentOverride } : {}),
      ...(marginFlatCentsOverride != null ? { marginFlatCentsOverride } : {}),
      ...(surchargeAudioPercentOverride != null ? { surchargeAudioPercentOverride } : {}),
      ...(surchargeUpscalePercentOverride != null ? { surchargeUpscalePercentOverride } : {}),
      ...(discountPercentOverride != null ? { discountPercentOverride } : {}),
    };
  });

  if (!Array.isArray(document.rules) || !document.rules.length) {
    throw new PricingPolicyValidationError('invalid_document', 'rules must be a non-empty array');
  }
  const ruleIds = new Set<string>();
  const selectors = new Set<string>();
  const rules = document.rules.map((raw, index): PricingPolicyRule => {
    const rule = asRecord(raw, `rules[${index}]`);
    const id = asNonEmptyString(rule.id, `rules[${index}].id`);
    if (ruleIds.has(id)) throw new PricingPolicyValidationError('duplicate_id', `duplicate pricing rule id: ${id}`);
    ruleIds.add(id);
    const engineId = optionalString(rule.engineId, `${id}.engineId`);
    const mode = optionalString(rule.mode, `${id}.mode`);
    const resolution = optionalString(rule.resolution, `${id}.resolution`);
    const currency = asNonEmptyString(rule.currency, `${id}.currency`).toUpperCase();
    const compatibilityProfile = optionalString(rule.compatibilityProfile, `${id}.compatibilityProfile`);
    if (!supportedCurrencies.includes(currency)) {
      throw new PricingPolicyValidationError('unsupported_currency', `${id} uses unsupported currency ${currency}`);
    }
    if (engineId && references.engineIds && !references.engineIds.has(engineId)) {
      throw new PricingPolicyValidationError('unknown_engine', `${id} references unknown engine ${engineId}`);
    }
    if (engineId && mode && references.modesByEngineId && !references.modesByEngineId.get(engineId)?.has(mode)) {
      throw new PricingPolicyValidationError('unknown_mode', `${id} references unknown mode ${mode} for ${engineId}`);
    }
    if (
      engineId &&
      resolution &&
      references.resolutionsByEngineId &&
      !references.resolutionsByEngineId.get(engineId)?.has(resolution)
    ) {
      throw new PricingPolicyValidationError('unknown_resolution', `${id} references unknown resolution ${resolution} for ${engineId}`);
    }
    if (compatibilityProfile && !profileIds.has(compatibilityProfile)) {
      throw new PricingPolicyValidationError(
        'unknown_compatibility_profile',
        `${id} references unknown compatibility profile ${compatibilityProfile}`
      );
    }
    const normalized: PricingPolicyRule = {
      id,
      ...(engineId ? { engineId } : {}),
      ...(mode ? { mode } : {}),
      ...(resolution ? { resolution } : {}),
      marginPercent: nonNegativeNumber(rule.marginPercent, `${id}.marginPercent`),
      marginFlatCents: nonNegativeNumber(rule.marginFlatCents, `${id}.marginFlatCents`, true),
      surchargeAudioPercent: nonNegativeNumber(rule.surchargeAudioPercent, `${id}.surchargeAudioPercent`),
      surchargeUpscalePercent: nonNegativeNumber(rule.surchargeUpscalePercent, `${id}.surchargeUpscalePercent`),
      currency,
      ...(compatibilityProfile ? { compatibilityProfile } : {}),
    };
    const selector = selectorKey(normalized);
    if (selectors.has(selector)) {
      throw new PricingPolicyValidationError('ambiguous_selector', `ambiguous pricing selector: ${selector}`);
    }
    selectors.add(selector);
    return normalized;
  });

  if (!rules.some((rule) => !rule.engineId && !rule.mode && !rule.resolution)) {
    throw new PricingPolicyValidationError('missing_global_rule', 'pricing policy requires one global rule');
  }

  return {
    version: 1,
    supportedCurrencies: [...supportedCurrencies],
    compatibilityProfiles: compatibilityProfiles.map((profile) => ({ ...profile })),
    rules: rules.map((rule) => ({ ...rule })),
  };
}

function matchRank(rule: PricingPolicyRule, scenario: PricingPolicyScenario): number {
  if (!rule.engineId) return !rule.mode && !rule.resolution ? 1 : -1;
  if (rule.engineId !== scenario.engineId) return -1;
  if (rule.mode && rule.mode !== scenario.mode) return -1;
  if (rule.resolution && rule.resolution !== scenario.resolution) return -1;
  if (rule.mode && rule.resolution) return 5;
  if (rule.resolution) return 4;
  if (rule.mode) return 3;
  return 2;
}

function resolveFromSource(
  rules: PricingPolicyRule[],
  scenario: PricingPolicyScenario,
  source: ResolvedPricingPolicy['source']
): ResolvedPricingPolicy | null {
  const candidates = rules
    .map((rule) => ({ rule, rank: matchRank(rule, scenario) }))
    .filter((candidate) => candidate.rank > 0)
    .sort((left, right) => right.rank - left.rank || left.rule.id.localeCompare(right.rule.id));
  const winner = candidates[0];
  if (!winner) return null;
  const tied = candidates.filter((candidate) => candidate.rank === winner.rank);
  if (tied.length > 1) {
    throw new PricingPolicyResolutionError(
      'ambiguous_match',
      `ambiguous ${source} pricing rules for ${scenario.engineId}: ${tied.map((candidate) => candidate.rule.id).join(', ')}`
    );
  }
  return {
    rule: { ...winner.rule },
    source,
    matchedBy: winner.rank === 1 ? 'global' : winner.rank === 2 ? 'engine' : 'precise',
    sourceRuleId: winner.rule.id,
  };
}

export function resolvePricingPolicy(input: {
  scenario: PricingPolicyScenario;
  databaseRules: PricingPolicyRule[];
  versionedRules: PricingPolicyRule[];
}): ResolvedPricingPolicy {
  const database = resolveFromSource(input.databaseRules, input.scenario, 'database');
  if (database) return database;
  const versioned = resolveFromSource(input.versionedRules, input.scenario, 'versioned');
  if (versioned) return versioned;
  throw new PricingPolicyResolutionError('missing_rule', `no pricing policy matched ${input.scenario.engineId}`);
}
