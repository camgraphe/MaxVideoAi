import { customerDisplayPrice } from "@/lib/customer-price-presentation";
import { recordedGenerationOutputDuration } from "@/lib/generation-output-duration";
import { getRuntimeModelById } from "@/config/model-runtime";
import { AgentApiError, type AgentApiErrorCode } from "./errors";
import {
  requireGenerationActor,
  type GenerationActor,
} from "./generation-actor";
import {createHash} from 'node:crypto';
import { normalizeGenerationRequest,stableJson } from "./generation-normalization";
import type {AgentPublicGenerationEngine} from './model-catalog';
import type { CanonicalGenerationRequest } from "./generation-types";
import {
  readGenerationPricing,
  type GenerationPricingReadDependencies,
} from "./generation-pricing-read";
import { projectAgentModelModeDetails } from "./model-details";
import {
  getAgentModelEditorialSummary,
  isAgentModelRecommendationEligible,
} from "./model-editorial-policy";
import { getAgentModelGuidance } from "./model-guidance";
import { resolveGenerationReferencesForActor } from "./resolve-generation-references";
import type { ResolvedReference } from "./reference-types";
import type { StudioPricingEstimate } from "@/lib/studio/conversation-pricing-contract";

export type GenerationPriceComparisonInput = Pick<
  CanonicalGenerationRequest,
  "surface" | "mode" | "prompt" | "settings" | "references"
> & {
  /** Only supply when the client asks to compare against this exact model. Repriced, never a stored amount. */
  baselineModelId?: string;
  baselineSettings?: CanonicalGenerationRequest["settings"];
  candidateModelIds?: string[];
};
export type GenerationPriceOption = StudioPricingEstimate & {
  modelLabel: string;
  audio: "optional" | "always_generated" | "unavailable";
  references: CanonicalGenerationRequest["references"];
  defaultedSettings: string[];
  editorialGuidance: ReturnType<typeof getAgentModelEditorialSummary>;
  bestFor: readonly string[];
  savings?: {
    baselineModelId: string;
    amountCents: number;
    percent: number;
    configurationDiffers: boolean;
  };
};
export type GenerationPriceComparison = {
  options: GenerationPriceOption[];
  baseline: GenerationPriceOption | null;
  comparisonCurrency?: string;
  excludedCurrencies?: { modelId: string; currency: string }[];
  unavailable: { modelId: string; code: AgentApiErrorCode; baseline?: true }[];
  estimatedAt: string;
  quoteRequired: true;
};

type ComparisonCatalogScope=Pick<CanonicalGenerationRequest,'surface'|'mode'> & {candidateModelIds?:readonly string[]|null;baselineModelId?:string|null};
function comparisonCandidates(input:ComparisonCatalogScope,catalog:readonly AgentPublicGenerationEngine[]) {
  const explicitIds=new Set([...(input.candidateModelIds??[]),...(input.baselineModelId?[input.baselineModelId]:[])]);
  return catalog.filter(candidate=>candidate.surface===input.surface&&candidate.publicModes.includes(input.mode)
    &&(!input.candidateModelIds||explicitIds.has(candidate.engine.id))
    &&(explicitIds.has(candidate.engine.id)||isAgentModelRecommendationEligible(candidate.engine.id,getRuntimeModelById(candidate.engine.id)?.lifecycle)));
}

/** Negative duration evidence is reusable only against the same live candidate identities/capabilities. */
export function generationComparisonCatalogFingerprint(input:ComparisonCatalogScope,catalog:readonly AgentPublicGenerationEngine[]):string {
  const models=comparisonCandidates(input,catalog).map(candidate=>{
    try {
      const {duration,durationPolicy}=projectAgentModelModeDetails(candidate,input.mode);
      return {modelId:candidate.engine.id,duration,durationPolicy};
    } catch(error) {
      if(!(error instanceof AgentApiError))throw error;
      return {modelId:candidate.engine.id,unavailable:error.code};
    }
  }).sort((a,b)=>a.modelId.localeCompare(b.modelId));
  return createHash('sha256').update(stableJson({surface:input.surface,mode:input.mode,models})).digest('hex');
}

function defaultAspectRatio(
  values: readonly string[],
  references: readonly ResolvedReference[],
): string | undefined {
  const image = references.find(
    (ref) => ref.mediaKind === "image" && ref.width && ref.height,
  );
  const ratio = image?.width && image.height ? image.width / image.height : 1;
  return values
    .filter((value) => /^\d+:\d+$/.test(value))
    .sort((a, b) => {
      const numeric = (value: string) => {
        const [w, h] = value.split(":").map(Number);
        return w / h;
      };
      return (
        Math.abs(Math.log(numeric(a) / ratio)) -
        Math.abs(Math.log(numeric(b) / ratio))
      );
    })[0];
}

/** Prices only: validates actual owned references and executability through the quote's canonical read seam. */
export async function compareGenerationPrices(
  input: GenerationPriceComparisonInput,
  actor: GenerationActor,
  deps: GenerationPricingReadDependencies,
): Promise<GenerationPriceComparison> {
  requireGenerationActor(actor);
  if (input.baselineSettings && !input.baselineModelId)
    throw new AgentApiError(
      "PARAMETER_INVALID",
      "Original settings require a baselineModelId for comparison.",
    );
  let base: CanonicalGenerationRequest;
  try {
    base = normalizeGenerationRequest({
      surface: input.surface,
      mode: input.mode,
      prompt: input.prompt,
      settings: input.settings,
      references: input.references,
      engineId: input.baselineModelId ?? "comparison",
      outputCount: 1,
    });
  } catch {
    throw new AgentApiError(
      "PARAMETER_INVALID",
      "Use supported canonical comparison settings, including durationSec for video.",
    );
  }
  if (base.references.some((ref) => ref.kind !== "asset"))
    throw new AgentApiError(
      "REFERENCE_INVALID",
      "Import saved owned media before comparing reference-based generation.",
    );
  const catalog = await deps.listPublicEngines();
  const references = base.references.length
    ? await (
        deps.resolveGenerationReferences ?? resolveGenerationReferencesForActor
      )(base, actor)
    : [];
  const membership = await deps.resolveMembershipPricing(actor.userId);
  const estimatedAt = new Date().toISOString();
  const unavailable: GenerationPriceComparison["unavailable"] = [];
  const options: GenerationPriceOption[] = [];
  let originalBaseline: GenerationPriceOption | null = null;
  const explicitIds = new Set([
    ...(input.candidateModelIds ?? []),
    ...(input.baselineModelId ? [input.baselineModelId] : []),
  ]);
  for (const id of explicitIds)
    if (!catalog.some((candidate) => candidate.engine.id === id))
      unavailable.push({ modelId: id, code: "ENGINE_UNAVAILABLE" });
  const candidates = comparisonCandidates({...input,surface:base.surface,mode:base.mode},catalog);
  const scenarios = candidates.map((candidate) => ({
    candidate,
    settings: base.settings,
    baseline: false,
  }));
  if (input.baselineSettings && input.baselineModelId) {
    const candidate = catalog.find(
      (candidate) =>
        candidate.engine.id === input.baselineModelId &&
        candidate.surface === base.surface &&
        candidate.publicModes.includes(base.mode),
    );
    if (candidate)
      scenarios.push({
        candidate,
        settings: input.baselineSettings,
        baseline: true,
      });
  }
  // Small batches bound concurrent database price reads; no provider inference calls.
  for (let start = 0; start < scenarios.length; start += 4) {
    await Promise.all(
      scenarios.slice(start, start + 4).map(async (scenario) => {
        const { candidate } = scenario;
        const modelId = candidate.engine.id;
        try {
          const details = projectAgentModelModeDetails(candidate, base.mode);
          const settings = { ...scenario.settings };
          const defaultedSettings: string[] = [];
          if (settings.audio !== undefined && details.audio !== "optional") {
            if (settings.audio !== (details.audio === "always_generated"))
              throw new AgentApiError(
                "PARAMETER_INVALID",
                "The model cannot satisfy the requested audio setting.",
              );
            delete settings.audio;
          }
          const defaults: Record<string, unknown> = {
            resolution: details.resolutions.find(
              (value) => value !== "auto" && value !== "custom",
            ),
            aspectRatio: defaultAspectRatio(details.aspectRatios, references),
          };
          for (const setting of details.settings) {
            if (
              ["imageWidth", "imageHeight"].includes(setting.key) &&
              (settings.resolution ?? defaults.resolution) !== "custom"
            )
              continue;
            if (setting.default !== null)
              defaults[setting.key] = setting.default;
          }
          for (const [key, value] of Object.entries(defaults))
            if (
              settings[key] === undefined &&
              value !== undefined &&
              value !== null
            ) {
              settings[key] = value as string | number | boolean;
              defaultedSettings.push(key);
            }
          const request = normalizeGenerationRequest({
            ...base,
            engineId: modelId,
            settings,
          });
          const { pricing, pricingSnapshot } = await readGenerationPricing(
            request,
            actor,
            {
              ...deps,
              listPublicEngines: async () => catalog,
              resolveGenerationReferences: async () => references,
              resolveMembershipPricing: async () => membership,
            },
          );
          const scalarSettings: Record<
            string,
            string | number | boolean | null
          > = {};
          for (const [key, value] of Object.entries(request.settings)) {
            if (
              value !== null &&
              !["string", "number", "boolean"].includes(typeof value)
            )
              throw new AgentApiError(
                "PARAMETER_INVALID",
                "Only simple settings can be compared.",
              );
            scalarSettings[key] = value as string | number | boolean | null;
          }
          const outputDurationSec =
            request.surface === "video"
              ? recordedGenerationOutputDuration(pricingSnapshot)
              : undefined;
          const option: GenerationPriceOption = {
            modelId,
            modelLabel: candidate.engine.label,
            surface: request.surface,
            mode: request.mode,
            settings: scalarSettings,
            references: request.references,
            referenceCount: request.references.length,
            outputCount: 1,
            ...(outputDurationSec !== undefined ? { outputDurationSec } : {}),
            audio: details.audio,
            defaultedSettings,
            editorialGuidance: getAgentModelEditorialSummary(modelId),
            bestFor: getAgentModelGuidance(modelId)?.bestFor ?? [],
            price: customerDisplayPrice(pricing.priceCents, pricing.currency),
            estimatedAt,
            quoteRequired: true,
          };
          if (scenario.baseline) originalBaseline = option;
          else options.push(option);
        } catch (error) {
          if (!(error instanceof AgentApiError)) throw error;
          unavailable.push({
            modelId,
            code: error.code,
            ...(scenario.baseline ? { baseline: true as const } : {}),
          });
        }
      }),
    );
  }
  if (!options.length) {
    // An exact scenario with no match is different from malformed input. Keep
    // the single-output contract and provide live facts for a workflow decision.
    const models = candidates.flatMap(candidate => {
      try {
        const details = projectAgentModelModeDetails(candidate, base.mode);
        const {mode,duration,durationPolicy,audio,resolutions,aspectRatios}=details;
        return [{modelId: candidate.engine.id,mode,duration,durationPolicy,audio,resolutions,aspectRatios}];
      } catch (error) {
        if (!(error instanceof AgentApiError)) throw error;
        return [];
      }
    });
    const requestedDurationSec = base.surface === 'video' && typeof base.settings.durationSec === 'number'
      ? base.settings.durationSec : null;
    const durationMismatch = requestedDurationSec !== null && models.length > 0 && models.length === candidates.length
      && models.every(({durationPolicy, duration}) => durationPolicy === 'requested' && duration !== null
        && (duration.options !== null ? !duration.options.includes(requestedDurationSec)
          : duration.range !== null && (requestedDurationSec < duration.range.min || requestedDurationSec > duration.range.max)));
    // The bounded diagnostic must retain longer component choices for a film,
    // rather than hiding them behind the first eight shorter catalog entries.
    if(durationMismatch)models.sort((a,b)=>{
      const longest=(model:typeof a)=>model.duration?.range?.max??Math.max(0,...(model.duration?.options??[]));
      return longest(b)-longest(a)||a.modelId.localeCompare(b.modelId);
    });
    throw new AgentApiError(
      "PARAMETER_INVALID",
      durationMismatch
        ? `No current model in this comparison supports ${requestedDurationSec} seconds as a single clip. Keep the requested total duration; propose a supported multi-clip workflow and separate scripted voiceover when needed. No quote or generation was created.`
        : "No current model could be verified and priced for all these constraints and references. Keep the requirements; use the returned mode facts to explain the mismatch or unavailable pricing. No quote or generation was created.",
      false,
      {type: 'generation_comparison', reason: 'no_matching_scenario', surface: base.surface, mode: base.mode,
        requestedDurationSec, durationMismatch, catalogFingerprint:generationComparisonCatalogFingerprint({...input,surface:base.surface,mode:base.mode},catalog),
        ...(durationMismatch?{modelsOrder:'longest_supported_clip'}:{}),
        models: models.slice(0, 8), modelsTruncated: models.length > 8},
    );
  }
  options.sort(
    (a, b) =>
      a.price.currency.localeCompare(b.price.currency) ||
      a.price.amountCents - b.price.amountCents ||
      a.modelId.localeCompare(b.modelId),
  );
  const baseline = input.baselineSettings
    ? originalBaseline
    : (options.find((option) => option.modelId === input.baselineModelId) ??
      null);
  const currencies = [
    ...new Set(options.map((option) => option.price.currency)),
  ];
  const comparisonCurrency =
    baseline?.price.currency ??
    currencies.sort(
      (a, b) =>
        options.filter((option) => option.price.currency === b).length -
          options.filter((option) => option.price.currency === a).length ||
        a.localeCompare(b),
    )[0];
  const comparable = options.filter(
    (option) => option.price.currency === comparisonCurrency,
  );
  const excludedCurrencies = options
    .filter((option) => option.price.currency !== comparisonCurrency)
    .map((option) => ({
      modelId: option.modelId,
      currency: option.price.currency,
    }));
  if (baseline)
    for (const option of options) {
      if (
        option.price.currency !== baseline.price.currency ||
        option.price.amountCents >= baseline.price.amountCents
      )
        continue;
      const amountCents = baseline.price.amountCents - option.price.amountCents;
      option.savings = {
        baselineModelId: baseline.modelId,
        amountCents,
        percent:
          Math.round((amountCents / baseline.price.amountCents) * 1000) / 10,
        configurationDiffers:
          JSON.stringify({
            ...option.settings,
            audio:
              option.audio === "always_generated" ||
              option.settings.audio === true,
          }) !==
          JSON.stringify({
            ...baseline.settings,
            audio:
              baseline.audio === "always_generated" ||
              baseline.settings.audio === true,
          }),
      };
    }
  // Keep the cheapest, the requested baseline/editorial preference, and a distinct price between them.
  // A high price is never a quality rank. Live editorial facts accompany every option.
  if (!comparable.length)
    return {
      options: [],
      baseline,
      comparisonCurrency,
      excludedCurrencies,
      unavailable,
      estimatedAt,
      quoteRequired: true,
    };
  const selected = [comparable[0]];
  const preferred =
    comparable.find((option) => option.modelId === input.baselineModelId) ??
    comparable.find(
      (option) => option.editorialGuidance.level === "reference",
    ) ??
    comparable.at(-1)!;
  if (preferred.price.amountCents === selected[0].price.amountCents)
    selected[0] = preferred;
  else selected.push(preferred);
  const remaining = comparable.filter((option) => !selected.includes(option));
  const target =
    (selected[0].price.amountCents + preferred.price.amountCents) / 2;
  while (remaining.length && selected.length < 3) {
    remaining.sort((a, b) => {
      const distinct = (option: GenerationPriceOption) =>
        selected.every(
          (chosen) => chosen.price.amountCents !== option.price.amountCents,
        )
          ? 0
          : 1;
      return (
        distinct(a) - distinct(b) ||
        Math.abs(a.price.amountCents - target) -
          Math.abs(b.price.amountCents - target) ||
        a.modelId.localeCompare(b.modelId)
      );
    });
    selected.push(remaining.shift()!);
  }
  selected.sort(
    (a, b) =>
      a.price.currency.localeCompare(b.price.currency) ||
      a.price.amountCents - b.price.amountCents,
  );
  return {
    options: selected,
    baseline,
    comparisonCurrency,
    excludedCurrencies,
    unavailable: unavailable.sort((a, b) => a.modelId.localeCompare(b.modelId)),
    estimatedAt,
    quoteRequired: true,
  };
}
