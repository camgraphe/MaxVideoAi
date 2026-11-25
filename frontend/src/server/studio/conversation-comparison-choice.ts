import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { query } from '@/lib/db';
import { studioActionRequestSchema } from '@/lib/studio/conversation-action-contract';
import { studioPricingCompareSchema } from '@/lib/studio/conversation-pricing-contract';
import type { StudioGenerationActor } from '@/server/agent-api/generation-actor';
import type { StudioRecalledReference } from './project-reference-registry';
import type { StudioQuoteRevision } from './conversation-quote-revision';

type Locale = 'en' | 'fr' | 'es';
type Choice = { sources: StudioRecalledReference[]; revision?: StudioQuoteRevision } | { clarification: string };
type PriceSelection = { by: 'minimum' } | { by: 'amount'; cents: number; currency: string } | { by: 'director' };
const minimumChoice = [
  /^(?:(?:teste[rz]?|essaie|essaye|prends?|utilise[rz]?|choisis|on (?:prend|essaie|part sur)|partons sur|va pour|allons[- ]y avec|je (?:prends|choisis|veux)) )?(?:ton|ta|le|la|l'option|le modele|l'alternative) (?:la |le )?moins cher(?:e)?(?: des (?:deux|trois|options|modeles))?(?: alors)?$/,
  /^(?:(?:try|test|use|pick|choose|take|go with|let's (?:try|use|go with)|i(?:'ll| will) (?:take|try)) )?(?:(?:your|the) )?(?:cheapest|least expensive|lowest[- ]priced)(?: (?:one|model|option))?$/,
  /^(?:(?:prueba|pruebe|usa|utiliza|elige|vamos con|me quedo con|quiero) )?(?:el|la|tu|la opcion|el modelo) (?:el |la )?mas barat[oa]$/,
];

export function comparisonSelection(message: string): PriceSelection | null {
  const words = message
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[.!]+$/, '')
    .replace(/^(?:ok(?:ay)?|oui|yes|si|vale|d'accord)[, ]+/, '')
    .replace(/[, ]+(?:merci|please|por favor|s'il te plait)$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (minimumChoice.some((pattern) => pattern.test(words))) return { by: 'minimum' };
  const amount = words.match(
    /^(?:(?:celui|celle|l'option) a|(?:je prends|teste|essaie) (?:celui|celle) a|(?:use |try |take )?the (?:one|option) (?:at|for)|(?:el|la|prueba el|prueba la) de)\s+(?:(us\$|usd|\$|eur|€)\s*)?(\d{1,5})[.,](\d{2})(?:\s*(\$us|us\$|usd|\$|eur|€))?(?: me (?:va|convient)| works for me| me (?:vale|parece bien))?$/,
  );
  if (!amount) {
    // A positive reference to the offer can restore its common sources; only a definite choice sets the model.
    const offer = /\b(?:comparatif|options?|alternative|proposition|formule|propuesta|opcion|alternativa)\b/;
    const accepts =
      /^(?:je (?:partirais (?:bien )?sur|prefererais prendre|serais partant pour)|j'aimerais essayer|i(?:'d| would) (?:go with|like to try|prefer to try)|i think i'll go with|me inclinaria por|preferiria probar)\b|\b(?:me tente(?: bien)?|me plait|me convient|sounds good(?: to me)?|works for me|me parece bien|me convence)$/;
    if (
      words.length < 160 &&
      !/[.!]/.test(words) &&
      offer.test(words) &&
      accepts.test(words) &&
      !/[?¿;]|\b(?:pas|ne|non|sauf|sans|mais|si|unless|not|no|without|except|but|if|sin|salvo|pero)\b/.test(words)
    )
      return { by: 'director' };
    return null;
  }
  if (Boolean(amount[1]) === Boolean(amount[4])) return null;
  const currency = /eur|€/.test(amount[1] || amount[4]) ? 'EUR' : 'USD';
  return { by: 'amount', cents: Number(amount[2]) * 100 + Number(amount[3]), currency };
}

const storedOption = z.object({
  modelId: z.string().min(1),
  modelLabel: z.string().min(1),
  surface: z.enum(['image', 'video']),
  mode: z.string(),
  operation: z.string().optional(),
  outputCount: z.literal(1),
  quoteRequired: z.literal(true),
  referenceCount: z.number().int().nonnegative(),
  references: z.array(
    z.object({
      kind: z.literal('asset'),
      assetId: z.string(),
      role: z.string(),
      slot: z.number().int().optional(),
    }),
  ),
  settings: z.record(z.union([z.string(), z.number().finite(), z.boolean(), z.null()])),
  price: z.object({
    amountCents: z.number().int().nonnegative().safe(),
    currency: z.string().regex(/^[A-Z]{3}$/),
  }),
});
const storedResult = z.object({
  ok: z.literal(true),
  action: z.literal('pricing.compare'),
  data: z.object({
    options: z.array(storedOption).min(1).max(3),
    baseline: storedOption.nullable(),
    comparisonCurrency: z.string(),
    excludedCurrencies: z.array(z.unknown()).max(0),
    quoteRequired: z.literal(true),
    filmDurationSec: z.never().optional(),
  }),
});
const clarification = {
  en: 'Which model and settings from the comparison would you like a quote for?',
  fr: 'Pour quel modèle et quels réglages du comparatif veux-tu un devis ?',
  es: '¿Para qué modelo y ajustes de la comparación quieres un presupuesto?',
};
type Receipt = { action_json: unknown; result_json: unknown };

/** Use the receipt for the accepted configuration. Only normal quote preparation may set its current price. */
export function chooseComparedEdit(
  receipt: Receipt,
  bound: StudioRecalledReference[],
  locale: Locale,
  selection: PriceSelection,
): Choice | null {
  const action = studioPricingCompareSchema.safeParse(receipt.action_json);
  if (
    !action.success ||
    !['i2i', 'v2v'].includes(action.data.mode) ||
    action.data.filmDurationSec ||
    !action.data.references.length
  )
    return null;
  const compare = action.data;
  const uncertain = { clarification: clarification[locale] };
  const result = storedResult.safeParse(receipt.result_json);
  if (!result.success) return uncertain;
  const { options, baseline, comparisonCurrency } = result.data.data;
  // A separately priced baseline may use a different configuration of the same model.
  const candidates = baseline ? [...options, baseline] : options;
  if (
    candidates.some(
      (row) =>
        row.price.currency !== comparisonCurrency || row.surface !== compare.surface || row.mode !== compare.mode,
    )
  )
    return uncertain;
  if (selection.by === 'amount' && selection.currency !== comparisonCurrency) return uncertain;
  const amount =
    selection.by === 'amount' ? selection.cents : Math.min(...candidates.map((row) => row.price.amountCents));
  const matches =
    selection.by === 'director' ? candidates : candidates.filter((row) => row.price.amountCents === amount);
  if (!matches.length) return uncertain;
  const option = matches[0];
  if (matches.some((row) => !isDeepStrictEqual(row.references, option.references))) return uncertain;
  if (
    selection.by !== 'director' &&
    (!options.includes(option) ||
      matches.some(
        (row) =>
          row.modelId !== option.modelId ||
          !isDeepStrictEqual(row.settings, option.settings) ||
          row.operation !== option.operation,
      ))
  )
    return uncertain;
  if (
    option.referenceCount !== compare.references.length ||
    option.references.length !== compare.references.length
  )
    return uncertain;
  const sources: StudioRecalledReference[] = [];
  const remaining = [...compare.references];
  for (const ref of option.references) {
    const index = remaining.findIndex(
      (item) =>
        item.ref.type === 'asset' &&
        item.ref.assetId === ref.assetId &&
        item.role === ref.role &&
        (item.slot == null || item.slot === ref.slot),
    );
    if (index < 0) return uncertain;
    const [selected] = remaining.splice(index, 1);
    const source = bound.find((item) => item.assetId === ref.assetId && item.kind === selected.ref.kind);
    if (!source) return uncertain;
    sources.push(source);
  }
  if (selection.by === 'director') return { sources };
  const { aspectRatio, ...settings } = option.settings;
  const references = option.references.map((ref, i) => ({
    role: ref.role,
    slot: ref.slot ?? null,
    ref: { type: 'asset', assetId: ref.assetId, kind: sources[i].kind },
  }));
  const reply = { en: 'Review this quote.', fr: 'Voici le devis.', es: 'Este es el presupuesto.' }[locale];
  const parsed = studioActionRequestSchema.safeParse({
    action: option.surface === 'image' ? 'image.prepare' : 'video.prepare',
    ...(option.surface === 'video'
      ? { source: null, operation: option.operation ?? compare.operation ?? null }
      : {}),
    reply,
    prompt: compare.prompt,
    modelId: option.modelId,
    mode: option.mode,
    outputCount: 1,
    aspectRatio: aspectRatio ?? null,
    settings: Object.entries(settings).map(([name, value]) => ({ name, value })),
    references,
  });
  if (!parsed.success || (parsed.data.action !== 'image.prepare' && parsed.data.action !== 'video.prepare'))
    return uncertain;
  return {
    sources,
    revision: {
      action: parsed.data,
      previousModel: option.modelLabel,
      target: option.modelLabel,
      workflow: option.mode,
      labels: sources.map((ref) => ref.label),
    },
  };
}

export async function readComparedEdit(
  actor: StudioGenerationActor,
  requestId: string,
  bound: StudioRecalledReference[],
  locale: Locale,
  selection: PriceSelection,
) {
  const [receipt] = await query<Receipt>(
    `SELECT action_json,result_json FROM studio_conversation_steps
     WHERE user_id=$1 AND project_id=$2 AND request_id=$3 AND action_json->>'action'='pricing.compare'
     ORDER BY created_at DESC,call_id DESC LIMIT 1`,
    [actor.userId, actor.projectId, requestId],
  );
  return receipt ? chooseComparedEdit(receipt, bound, locale, selection) : null;
}
