import { z } from 'zod';
import startFrames from '@/config/model-cinematic-start-frames.json';
import type { AppLocale } from '@/i18n/locales';
import type { ModelEditorialImage } from './model-page-editorial-images';
import type { ModelExamplesContent } from './model-page-examples-content';
import type { ModelCinematicContent, ModelCinematicExamplesContent } from './model-page-cinematic-content';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const file = z.object({ url: z.string(), sha256: hash, width: z.number().positive(), height: z.number().positive() });
const frameSchema = z.object({
  id: z.string(), sourceEngineId: z.literal('gpt-image-2-6-sunburst'), kind: z.literal('start-frame'),
  videoUrl: z.null(), prompt: z.string().min(1), manifestSha256: hash,
  original: file.extend({ url: z.string().url().startsWith('https://media.maxvideoai.com/renders/images/') }),
  display: file.extend({ url: z.string().regex(/^\/assets\/model-examples\/seedance-2-5-flash\/[a-f0-9]{64}\.webp$/) }),
});

const ui = {
  en: { copy: 'Copy prompt', copied: 'Copied', original: 'Open original', prompt: 'Prompt & settings', source: 'Exact edit source', compare: 'Reveal the edit', background: 'Preview background', light: 'Light', dark: 'Dark', motion: 'Planned motion', sound: 'Planned sound', still: 'Start frame · GPT Image 2.6 Sunburst', sourcePrompt: 'Image prompt (English)' },
  fr: { copy: 'Copier le prompt', copied: 'Copié', original: 'Ouvrir l’original', prompt: 'Prompt et réglages', source: 'Source exacte de la retouche', compare: 'Révéler la retouche', background: 'Fond de prévisualisation', light: 'Clair', dark: 'Sombre', motion: 'Mouvement prévu', sound: 'Son prévu', still: 'Image de départ · GPT Image 2.6 Sunburst', sourcePrompt: 'Prompt de l’image (anglais)' },
  es: { copy: 'Copiar prompt', copied: 'Copiado', original: 'Abrir original', prompt: 'Prompt y ajustes', source: 'Origen exacto de la edición', compare: 'Mostrar la edición', background: 'Fondo de vista previa', light: 'Claro', dark: 'Oscuro', motion: 'Movimiento previsto', sound: 'Sonido previsto', still: 'Fotograma inicial · GPT Image 2.6 Sunburst', sourcePrompt: 'Prompt de imagen (inglés)' },
};

export type CinematicAsset = Pick<ModelEditorialImage, 'id' | 'title' | 'prompt' | 'original' | 'display' | 'metadataLabel' | 'source' | 'alphaVerified'>;
export type CinematicPresentation = {
  content: ModelCinematicContent;
  examples: ModelCinematicExamplesContent;
  assets: CinematicAsset[];
  hero: CinematicAsset;
  ui: typeof ui.en;
};

/** Stills retain their image-model attribution; they never enter the video gallery/schema. */
export function buildCinematicPresentation(content: ModelCinematicContent | null, examples: ModelExamplesContent,
  editorialImages: ModelEditorialImage[], locale: AppLocale): CinematicPresentation | null {
  if (!content) return null;
  if (!examples.cinematic) throw new Error('Missing exact-locale cinematic examples');
  let assets: CinematicAsset[] = editorialImages;
  if (content.variant === 'video') {
    if (content.modelSlug !== 'seedance-2-5-flash') throw new Error('No reviewed start frames for this model');
    assets = z.array(frameSchema).parse(startFrames).map(frame => {
      const title = examples.cinematic?.assetTitles?.find(item => item.id === frame.id)?.title;
      if (!title) throw new Error('Missing localized start-frame title');
      return { ...frame, title, metadataLabel: `${ui[locale].still} · ${frame.original.width} × ${frame.original.height}` };
    });
  }
  const hero = assets.find(asset => asset.id === content.heroAssetId);
  if (!hero) throw new Error('Missing reviewed cinematic hero');
  const panelIds = examples.cinematic.panels.map(panel => panel.id);
  if (new Set(panelIds).size !== panelIds.length) throw new Error('Duplicate cinematic panel');
  const visualIds = [content.heroAssetId, ...examples.cinematic.panels.flatMap(panel => panel.assetIds)];
  if (new Set(visualIds).size !== visualIds.length) throw new Error('A cinematic visual has one placement; only the edit comparator may reuse its sources');
  for (const panel of examples.cinematic.panels) {
    const selected = panel.assetIds.map(id => assets.find(asset => asset.id === id));
    if (selected.some(asset => !asset)) throw new Error('Missing reviewed cinematic example');
    if (panel.layout === 'edit') {
      if (selected.length !== 3 || selected[1]?.source?.original.sha256 !== selected[0]?.original.sha256 || selected[2]?.source?.original.sha256 !== selected[1]?.original.sha256) throw new Error('Cinematic edit needs the exact successive references');
    }
    if (panel.layout === 'cutout' && (selected.length !== 1 || !selected[0]?.alphaVerified)) throw new Error('Cinematic cutout needs verified alpha');
  }
  return { content, examples: examples.cinematic, assets, hero, ui: ui[locale] };
}
