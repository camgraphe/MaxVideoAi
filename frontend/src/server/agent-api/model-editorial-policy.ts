import {z} from 'zod';
import document from '@/config/agent-model-editorial-policy.json' with {type: 'json'};
import {getModelRegistryEntries} from '@/config/model-registry';

const text = z.string().min(1).max(280).refine(value=>value===value.trim() && value===value.normalize('NFC'),'Expected trimmed NFC text');
const reviewDate = text.refine(value=>/^\d{4}-\d{2}-\d{2}$/.test(value)).refine(value=> {
  const parsed=new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10)===value;
},'Expected a calendar date');
const provenanceSchema = z.object({
  kind: z.enum(['product_decision','vendor_policy']),source: text,sourceVersion: text.nullable(),reviewedAt: reviewDate,summary: text,
}).strict().superRefine((source,context)=> {
  if (source.kind==='vendor_policy' && (source.source!=='https://raw.githubusercontent.com/higgsfield-ai/skills/main/higgsfield-generate/SKILL.md' || !source.sourceVersion)) {
    context.addIssue({code: z.ZodIssueCode.custom,message: 'Vendor evidence must identify a reviewed primary source and version'});
  }
});
const policySchema=z.object({
  schemaVersion: z.literal(1),version: text.refine(value=>/^\d{4}-\d{2}-\d{2}\.\d+$/.test(value)),basis: z.literal('product_editorial_preference'),
  reviewedAt: reviewDate,reviewAfterDays: z.number().int().min(1).max(365),
  provenance: z.array(provenanceSchema).min(1).max(4),
  entries: z.array(z.object({engineId: text,level: z.enum(['reference','alternative','on_request']),rationale: text}).strict()).min(1),
}).strict();

type EditorialPolicy=z.infer<typeof policySchema>;
export type AgentModelEditorialGuidance=Readonly<{
  policyVersion: string;
  basis: 'product_editorial_preference';
  level: 'reference' | 'alternative' | 'on_request';
  rationale: string;
  reviewedAt: string | null;
  reviewAgeDays: number | null;
  reviewAfterDays: number;
  reviewStatus: 'current' | 'review_due' | 'unreviewed' | 'not_yet_reviewed';
  provenance: readonly Readonly<EditorialPolicy['provenance'][number]>[];
}>;
export type AgentModelEditorialPolicy=Readonly<Omit<EditorialPolicy,'entries' | 'provenance'> & {
  entries: readonly Readonly<EditorialPolicy['entries'][number]>[];
  provenance: AgentModelEditorialGuidance['provenance'];
}>;
export type AgentModelEditorialSummary=Pick<AgentModelEditorialGuidance,'policyVersion' | 'basis' | 'level' | 'rationale' | 'reviewedAt' | 'reviewStatus'>;

/** An editorial preference never supplies identity, capability, price or certification. */
export function parseAgentModelEditorialPolicy(value: unknown,knownEngineIds: ReadonlySet<string>): AgentModelEditorialPolicy {
  const parsed=policySchema.parse(value);
  const ids=new Set<string>();
  for (const entry of parsed.entries) {
    if (!knownEngineIds.has(entry.engineId) || ids.has(entry.engineId)) throw new Error('[agent-model-editorial-policy] Unknown or duplicate exact engine ID');
    ids.add(entry.engineId);
  }
  if (!parsed.provenance.some(source=>source.kind==='product_decision')) throw new Error('[agent-model-editorial-policy] A product decision is required; vendor policy is not independent validation');
  if (parsed.provenance.some(source=>source.reviewedAt>parsed.reviewedAt)) throw new Error('[agent-model-editorial-policy] Source review cannot follow policy review');
  return Object.freeze({...parsed,entries: Object.freeze(parsed.entries.map(entry=>Object.freeze(entry))),provenance: Object.freeze(parsed.provenance.map(source=>Object.freeze(source)))});
}

const policy=parseAgentModelEditorialPolicy(document,new Set(getModelRegistryEntries().map(entry=>entry.id)));
const entries=new Map(policy.entries.map(entry=>[entry.engineId,entry]));

export function getAgentModelEditorialGuidance(engineId: string,asOf=new Date()): AgentModelEditorialGuidance {
  const entry=entries.get(engineId);
  const age=Math.floor((asOf.getTime()-new Date(`${policy.reviewedAt}T00:00:00Z`).getTime())/86_400_000);
  const reviewStatus=!entry ? 'unreviewed' : !Number.isFinite(age) || age<0 ? 'not_yet_reviewed' : age>=policy.reviewAfterDays ? 'review_due' : 'current';
  return Object.freeze({policyVersion: policy.version,basis: policy.basis,level: entry?.level ?? 'alternative',
    rationale: entry?.rationale ?? 'No editorial review for this exact version. Inspect executable capabilities; do not infer quality from its family or release date.',
    reviewedAt: entry ? policy.reviewedAt : null,reviewAgeDays: entry && Number.isFinite(age) && age>=0 ? age : null,
    reviewAfterDays: policy.reviewAfterDays,reviewStatus,provenance: entry ? policy.provenance : Object.freeze([])});
}

export function getAgentModelEditorialSummary(engineId: string): AgentModelEditorialSummary {
  const {policyVersion,basis,level,rationale,reviewedAt,reviewStatus}=getAgentModelEditorialGuidance(engineId);
  return Object.freeze({policyVersion,basis,level,rationale,reviewedAt,reviewStatus});
}
