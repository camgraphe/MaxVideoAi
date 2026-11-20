import { z } from 'zod';
import { getFalEngineBySlug } from '@/config/falEngines';
import type { AppLocale } from '@/i18n/locales';
import fluxVisuals from '@/config/model-flux-workflow-visuals.json';
import klingVisuals from '@/config/model-kling-v4-workflow-visuals.json';
import illustrations from '@/config/model-capability-illustrations.json';

const text = z.string().trim().min(1);
const visualCopy = z.object({
  labels: z.array(text).min(1).max(10),
  caption: text,
  resultLabel: text.optional(),
  promptNote: text.optional(),
  filmLinkLabel: text.optional(),
  storyboard: z.object({ title: text, frameLabel: text, workflowLink: text, promptNote: text }).strict().optional(),
}).strict();
type Still = { url: string; width: number; height: number };
type CapabilityVisual = z.infer<typeof visualCopy> & {
  images: string[];
  video?: string;
  poster?: string;
  width?: number;
  height?: number;
  seconds?: number[];
  stillSize?: Pick<Still, 'width' | 'height'>;
  reveal?: { before: Still; after: Still };
};
const action = z.object({ label: text, mode: z.enum(['t2v', 'i2v', 'fl2v', 'ref2v', 'v2v', 'extend']), model: text.optional() }).strict();
export const cinematicCapabilitiesSchema = z.object({
  title: text, intro: text, diagramLabel: text,
  items: z.array(z.object({
    id: z.string().regex(/^[a-z-]+$/), label: text, title: text, body: text,
    stages: z.array(text).length(3), uses: z.array(text).length(3), note: text,
    actions: z.array(action).min(1).max(3),
    visual: visualCopy.optional(),
    proof: z.object({
      kind: z.enum(['create', 'modify', 'extend']), caption: text, note: text, prompt: text,
      labels: z.tuple([text, text]), detailsLabel: text, previewLabel: text, resetLabel: text,
    }).strict().optional(),
  }).strict()).min(3).max(4),
  controls: z.object({ title: text, body: text }).strict(),
  handoff: z.object({ title: text, body: text, actions: z.array(action).length(2) }).strict().optional(),
}).strict().refine(copy => new Set(copy.items.map(item => item.id)).size === copy.items.length, 'Unique workflow tabs');

/** Editorial modes must exist in Create. A neighbouring model is always named in the UI. */
export function buildCinematicCapabilities(copy: z.infer<typeof cinematicCapabilitiesSchema> | undefined, model: string, locale: AppLocale) {
  if (!copy) return undefined;
  function destination(value: z.infer<typeof action>) {
    const target = value.model ?? model;
    const engine = getFalEngineBySlug(target);
    if (!engine?.engine.modes.includes(value.mode)) throw new Error(`Unsupported cinematic workflow: ${target}/${value.mode}`);
    if (target !== model && !value.label.includes(engine.marketingName)) throw new Error('Cross-model actions must name the destination');
    const params = new URLSearchParams({ engine: engine.id, mode: value.mode, lang: locale });
    return { ...value, href: `/app?${params}` };
  }
  return { ...copy, items: copy.items.map(item => {
    if (item.proof && (model !== illustrations.modelSlug || item.id !== item.proof.kind)) throw new Error('Missing model-owned capability illustration');
    const mode = item.proof?.kind === 'create' ? 'ref2v' : item.proof?.kind === 'modify' ? 'v2v' : 'extend';
    const href = item.proof ? destination({ label: item.label, mode }).href + `&videoPrompt=capability-${item.id}` : undefined;
    let visual: CapabilityVisual | undefined;
    if (item.visual && model === fluxVisuals.modelSlug) {
      const source = item.id === 'text' || item.id === 'image' || item.id === 'endpoints' || item.id === 'keyframes'
        ? fluxVisuals[item.id] : undefined;
      if (!source || source.images.length !== item.visual.labels.length) throw new Error('Missing FLUX workflow visual');
      visual = { ...item.visual, ...source };
      if (visual.storyboard && visual.seconds?.length !== visual.images.length) throw new Error('Each storyboard reference needs a time position');
    }
    if (model === klingVisuals.modelSlug) {
      const ids = klingVisuals.modes[item.id as keyof typeof klingVisuals.modes];
      const frames = ids?.map(id => klingVisuals.frames[id as keyof typeof klingVisuals.frames]);
      if (!item.visual || !frames?.[0] || frames.length !== item.visual.labels.length || frames.some(frame => !frame)) {
        throw new Error('Each Kling workflow needs its own reviewed visuals and captions');
      }
      const [before, after] = frames;
      visual = {
        ...item.visual,
        images: frames.map(frame => frame.url),
        stillSize: { width: before.width, height: before.height },
        reveal: item.id === 'edit' && after ? { before, after } : undefined,
      };
    }
    const board = item.id === 'keyframes' && visual?.storyboard ? fluxVisuals.keyframes.recipe : undefined;
    const film = visual?.video && (item.id === 'image' || item.id === 'endpoints') ? fluxVisuals[item.id].recipe : undefined;
    const recipe = board ?? film;
    const recipeMode = board ? 'ref2v' : item.id === 'image' ? 'i2v' : 'fl2v';
    const recipeHref = recipe ? destination({ label: item.label, mode: recipeMode }).href + `&videoPrompt=${recipe.id}` : undefined;
    const recipeTitle = visual?.storyboard?.title ?? visual?.resultLabel;
    const recipeNote = visual?.storyboard?.promptNote ?? visual?.promptNote;
    return { ...item, visual, actions: item.actions.map(destination),
      videoRecipe: recipe && recipeHref && recipeTitle && recipeNote ? { title: recipeTitle, note: recipeNote, prompt: recipe.prompt,
        creation: { href: recipeHref, refineHref: `${recipeHref}&assistant=milo&refine=example` } } : undefined,
      proof: item.proof && href ? {
      ...item.proof, images: illustrations.images, creation: { href, refineHref: `${href}&assistant=milo&refine=example` },
    } : undefined };
  }),
    handoff: copy.handoff ? { ...copy.handoff, actions: copy.handoff.actions.map(destination) } : undefined };
}
export type CinematicCapabilities = NonNullable<ReturnType<typeof buildCinematicCapabilities>>;
