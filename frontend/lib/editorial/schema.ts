import { createHash } from 'node:crypto';
import { z } from 'zod';

const slug = z.string().min(3).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const text = z.string().trim().min(1).max(12000).refine((value) => !/<\s*\/?\s*(?:script|iframe|style|object|embed)\b/i.test(value), 'Executable markup is forbidden');
const spanText = z.string().min(1).max(12000)
  .refine((value) => value.trim().length > 0, 'Span cannot be blank')
  .refine((value) => !/<\s*\/?\s*(?:script|iframe|style|object|embed)\b/i.test(value), 'Executable markup is forbidden');
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Invalid date');
const httpsUrl = z.string().url().refine((value) => {
  const parsed = new URL(value);
  return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
}, 'HTTPS URL required');
const safeHref = z.string().max(500).refine((value) => {
  if (value.startsWith('/') && !value.startsWith('//')) return !/[\s<>]/.test(value);
  return httpsUrl.safeParse(value).success;
}, 'Internal path or HTTPS URL required');
const sourceIds = z.array(z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/)).max(10).default([]);

const paragraph = z.object({
  text: text.optional(),
  spans: z.array(z.object({ text: spanText, bold: z.boolean().optional(), href: safeHref.optional() }).strict()).min(1).max(50).optional(),
  sourceIds,
}).strict().refine((value) => Boolean(value.text) !== Boolean(value.spans), 'Use either plain text or controlled spans');
const link = z.object({ label: text, href: safeHref }).strict();
const blockId = z.string().regex(/^[a-z][a-z0-9-]{1,63}$/);
const textBlock = z.object({ id: blockId, type: z.literal('text'), heading: text, paragraphs: z.array(paragraph).min(1).max(16) }).strict();
const mediaBlock = z.object({ id: blockId, type: z.literal('media'), assetId: blockId, heading: text.or(z.literal('')).optional(), presentation: z.enum(['single', 'storyboard']).optional(), alt: text.optional(), caption: text, panels: z.array(z.object({ title: text, alt: text, caption: text }).strict()).length(3).optional() }).strict();
const comparisonBlock = z.object({ id: blockId, type: z.literal('comparison'), heading: text, columns: z.array(text).min(2).max(5), rows: z.array(z.array(text).min(2).max(5)).min(1).max(20) }).strict();
const stepsBlock = z.object({ id: blockId, type: z.literal('steps'), heading: text, note: text.optional(), steps: z.array(z.object({ title: text, body: text }).strict()).min(1).max(12) }).strict();
const promptBlock = z.object({ id: blockId, type: z.literal('prompt'), heading: text, template: text, note: text, sourceIds: sourceIds.optional() }).strict();
const conclusionBlock = z.object({ id: blockId, type: z.literal('conclusion'), heading: text, paragraphs: z.array(text).min(1).max(5), cta: link.optional() }).strict();

const diagramBlock = z.object({id:blockId,type:z.literal('diagram'),heading:text.or(z.literal('')),nodes:z.array(z.object({kind:z.enum(['image','model','video','file']),label:text.pipe(z.string().max(120))}).strict()).min(2).max(6),connections:z.array(text.pipe(z.string().max(120))).min(1).max(5),alt:text,caption:text}).strict();
const videoBlock = z.object({id:blockId,type:z.literal('video'),heading:text.or(z.literal('')),videoId:z.string().regex(/^[\w-]{11}$/),sourceId:blockId,credit:text.pipe(z.string().max(200)),startSeconds:z.number().int().min(0).max(86400),caption:text}).strict();
export function sourceVideoId(url:string){const u=new URL(url);return u.hostname==='youtu.be'?u.pathname.slice(1):['youtube.com','www.youtube.com'].includes(u.hostname)?u.pathname==='/watch'?u.searchParams.get('v'):u.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})$/)?.[1]:null;}

export const editorialBlockSchema = z.discriminatedUnion('type', [textBlock, mediaBlock, comparisonBlock, stepsBlock, promptBlock, conclusionBlock, diagramBlock, videoBlock]);
const locale = z.enum(['en', 'fr', 'es']);
export const editorialVariantSchema = z.object({
  locale,
  audience: z.enum(['en', 'fr-FR', 'es-419']).optional(),
  slug,
  title: text.pipe(z.string().max(160)),
  description: text.pipe(z.string().max(320)),
  keywords: z.array(text.pipe(z.string().max(80))).min(1).max(20),
  blocks: z.array(editorialBlockSchema).min(3).max(40),
}).strict();
export const editorialSourceSchema = z.object({
  id: blockId,
  title: text,
  publisher: text.pipe(z.string().max(160)),
  url: httpsUrl,
  retrievedAt: day,
  publishedAt: day.optional(),
  verification: text.optional(),
  supportedClaims: z.array(text).max(30).optional(),
  limits: text.optional(),
  usage: text.optional(),
}).strict();
const asset = z.object({
  id: blockId,
  kind: z.enum(['generated-illustration', 'verified-capture']),
  storageKey: z.string().regex(/^editorial\/[a-z0-9/_-]+\.(?:webp|png|jpe?g)$/),
  mime: z.enum(['image/webp', 'image/png', 'image/jpeg']),
  width: z.number().int().min(320).max(8000),
  height: z.number().int().min(160).max(8000),
  bytes: z.number().int().positive().max(20_000_000),
  rights: z.enum(['owned', 'licensed']),
  sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  generationPrompt: text.optional(),
  reviewNote: text.optional(),
  generationModel: z.string().max(80).optional(),
  licenseName: text.optional(),
  sourceUrl: httpsUrl.optional(),
}).strict().superRefine((value, context) => {
  if (value.kind === 'generated-illustration' && !value.generationPrompt) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Generated illustration needs its prompt' });
  }
  if (value.rights === 'licensed' && !value.licenseName) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Licensed asset needs license name' });
  }
  if (value.kind === 'verified-capture' && !value.sourceUrl) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Capture needs provenance URL' });
  }
});

const topicCandidate = z.object({
  topicKey: slug,
  title: text.pipe(z.string().max(200)),
  lane: z.enum(['models', 'editing', 'agents', 'creator-workflows']),
  score: z.number().int().min(1).max(5),
  decision: z.enum(['selected', 'update', 'hold']),
  evidenceUrls: z.array(httpsUrl).min(1).max(8),
  existingArticleSlugs: z.array(slug).max(10),
  productPath: safeHref.refine((value) => value.startsWith('/') && !value.startsWith('//')),
  rationale: text.pipe(z.string().max(1200)),
}).strict();

export const editorialDraftSchema = z.object({
  canonicalSlug: slug,
  sourceLocale: z.literal('en'),
  topicKey: slug,
  runKey: z.string().regex(/^[a-zA-Z0-9:_-]{8,128}$/),
  locales: z.object({ en: editorialVariantSchema, fr: editorialVariantSchema, es: editorialVariantSchema }).strict(),
  sources: z.array(editorialSourceSchema).min(1).max(50),
  assets: z.array(asset).min(1).max(15),
  evidenceDigest: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  research: z.object({
    method: text.optional(),
    scannedAt: z.string().datetime({ offset: true }),
    queries: z.array(text.pipe(z.string().max(200))).max(20),
    signals: z.array(z.object({
      platform: z.enum(['reddit', 'x', 'other']),
      url: httpsUrl,
      observedAt: day,
      author: text.pipe(z.string().max(120)),
      title: text.pipe(z.string().max(300)),
      summary: text.pipe(z.string().max(1000)),
      relevance: z.number().int().min(1).max(5),
    }).strict()).max(30),
    existingArticleSlugs: z.array(slug).max(30),
    candidates: z.array(topicCandidate).min(2).max(20).optional(),
    recommendation: z.enum(['new', 'update']),
    productFit: z.object({ path: safeHref.refine((value) => value.startsWith('/') && !value.startsWith('//')), rationale: text }).strict(),
  }).strict(),
  quality: z.object({
    checkedAt: z.string().datetime({ offset: true }),
    linksOk: z.boolean(),
    mediaOk: z.boolean(),
    mobileOk: z.boolean(),
    seoOk: z.boolean(),
    geoOk: z.boolean().default(false),
  }).strict(),
}).strict().superRefine((draft, context) => {
  if (draft.locales.en.slug !== draft.canonicalSlug) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'English slug must equal canonical slug' });
  }
  const sourceSet = new Set(draft.sources.map((item) => item.id));
  const assetSet = new Set(draft.assets.map((item) => item.id));
  if (!draft.locales.en.blocks.some((block) => block.type === 'media')) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Every article needs a visual block' });
  }
  if (sourceSet.size !== draft.sources.length || assetSet.size !== draft.assets.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate source or asset id' });
  }
  if (draft.research.candidates) {
    const selected = draft.research.candidates.filter((candidate) => candidate.decision === 'selected');
    if (selected.length !== 1 || selected[0]?.topicKey !== draft.topicKey) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Trend scan must select exactly the draft topic' });
    }
  }
  const reference = draft.locales.en.blocks.map((block) => `${block.id}:${block.type}`);
  for (const language of ['en', 'fr', 'es'] as const) {
    const variantValue = draft.locales[language];
    if (variantValue.locale !== language) context.addIssue({ code: z.ZodIssueCode.custom, message: `Locale mismatch: ${language}` });
    const signature = variantValue.blocks.map((block) => `${block.id}:${block.type}`);
    if (new Set(signature).size !== signature.length || JSON.stringify(signature) !== JSON.stringify(reference)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `Block structure mismatch: ${language}` });
    }
    for (const block of variantValue.blocks) {
      if (block.type === 'diagram') {
        const master=draft.locales.en.blocks.find(b=>b.id===block.id);
        if(block.connections.length!==block.nodes.length-1 || master?.type!=='diagram' || JSON.stringify(master.nodes.map(n=>n.kind))!==JSON.stringify(block.nodes.map(n=>n.kind))) context.addIssue({code:z.ZodIssueCode.custom,message:'Diagram structure mismatch'});
      }
      if (block.type === 'video') {
        const source=draft.sources.find(s=>s.id===block.sourceId),master=draft.locales.en.blocks.find(b=>b.id===block.id);
        if(!source || sourceVideoId(source.url)!==block.videoId || master?.type!=='video' || master.videoId!==block.videoId || master.sourceId!==block.sourceId || master.credit!==block.credit || master.startSeconds!==block.startSeconds) context.addIssue({code:z.ZodIssueCode.custom,message:'Unverified or changed source video'});
      }
      if (block.type === 'media') {
        const master = draft.locales.en.blocks.find((item) => item.id === block.id);
        if (block.presentation === 'storyboard' ? !block.panels : (!block.alt || block.panels)) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: 'Media needs a single alt or exactly three storyboard panels' });
        }
        if (master?.type === 'media' && (master.assetId !== block.assetId || master.presentation !== block.presentation)) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: 'Localized media identity differs' });
        }
      }
      if (block.type === 'media' && !assetSet.has(block.assetId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown media asset: ${block.assetId}` });
      }
      if (block.type === 'text') {
        for (const item of block.paragraphs) {
          for (const id of item.sourceIds) {
            if (!sourceSet.has(id)) context.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown source: ${id}` });
          }
        }
      }
      if (block.type === 'prompt') for (const id of block.sourceIds ?? []) {
        if (!sourceSet.has(id)) context.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown source: ${id}` });
      }
      if (block.type === 'comparison' && block.rows.some((row) => row.length !== block.columns.length)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `Comparison column mismatch: ${block.id}` });
      }
    }
  }
});

export type EditorialDraft = z.infer<typeof editorialDraftSchema>;
export type EditorialBlock = z.infer<typeof editorialBlockSchema>;

export function parseEditorialDraft(input: unknown): EditorialDraft {
  return editorialDraftSchema.parse(input);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function digestEditorialDraft(draft: EditorialDraft): string {
  return createHash('sha256').update(canonicalJson(draft)).digest('hex');
}
