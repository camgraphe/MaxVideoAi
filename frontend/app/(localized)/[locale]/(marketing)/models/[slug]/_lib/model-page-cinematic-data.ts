import { z } from 'zod';
import { buildVideoWatchPath } from '@/lib/video-seo-canonical';
import { buildCinematicCapabilities, type CinematicCapabilities } from './model-page-capabilities';
import workspacePreviews from '@/config/model-cinematic-workspace-previews.json';
import draftIllustration from '@/config/model-draft-workflow-illustration.json';
import type { AppLocale } from '@/i18n/locales';
import type { ModelEditorialImage } from './model-page-editorial-images';
import type { ModelExamplesContent } from './model-page-examples-content';
import type { ModelCinematicContent, ModelCinematicExamplesContent } from './model-page-cinematic-content';
import { miloEntryHref } from '@/lib/prompt-assistance/marketing-entry';
import { getImageEditorialPreset, imageEditorialPresetHref } from '@/lib/image/editorial-presets';
import type { PublicModelQuoteInput } from '@/lib/pricing-public-model-contract';
import { cinematicProofVideo } from './model-page-proof-video';
import { getCinematicVideoMedia, cinematicVideoMetadata, type CinematicVideoMedia } from './model-page-cinematic-media';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const file = z.object({ url: z.string(), sha256: hash, width: z.number().positive(), height: z.number().positive() });
const frameSchema = z.object({
  id: z.string(), sourceEngineId: z.string().min(1), kind: z.literal('start-frame'),
  videoUrl: z.null(), prompt: z.string().min(1), manifestSha256: hash,
  original: file.extend({ url: z.string().url().startsWith('https://media.maxvideoai.com/renders/images/') }),
  display: file.extend({ url: z.string().regex(/^\/assets\/model-examples\/[a-z0-9-]+\/[a-f0-9]{64}\.webp$/) }),
});

const ui = {
  // Keep actions tied to the actual image model, including video-page start frames.
  en: { previousExamples: 'Previous examples', nextExamples: 'Next examples', play: "Play video", loading: "Loading…", retry: "Try again", playTogether: "Play both", pause: "Pause", timeline: "Comparison timeline", mute: "Mute result", unmute: "Unmute result", restart: "Restart both", close: 'Close', heroPrompt: 'Prompt for this visual', promptLibrary: 'Prompts to adapt', promptTemplate: 'Prompt starting point', copyVideo: 'Copy video prompt', detailSource: 'Detail from the same image', unretouched: 'No retouching', frame: 'Frame', shotPlan: 'Direct the shot', frameDirection: 'Use the original first frame to anchor the subject, lighting and composition.', animateFrame: 'Animate the supplied first frame.', videoPrompt: 'Video prompt', zoom: 'Inspect detail', zoomOut: 'Full frame', face: 'Face & hair', texture: 'Fabric & texture', gradient: 'Colour', before: 'Source', after: 'Edit', aboutExamples: 'About these examples', copy: 'Copy prompt', copied: 'Copied', original: 'Open original', prompt: 'Prompt & settings', source: 'Exact edit source', compare: 'Reveal the edit', background: 'Preview background', light: 'Light', dark: 'Dark', motion: 'Planned motion', sound: 'Planned sound', still: 'Start frame · GPT Image 2.6 Sunburst', sourcePrompt: 'Image prompt (English)' },
  fr: { previousExamples: 'Exemples précédents', nextExamples: 'Exemples suivants', play: "Lire la vidéo", loading: "Chargement…", retry: "Réessayer", playTogether: "Lire ensemble", pause: "Pause", timeline: "Position de la comparaison", mute: "Couper le son du résultat", unmute: "Activer le son du résultat", restart: "Recommencer ensemble", close: 'Fermer', heroPrompt: 'Prompt de ce visuel', promptLibrary: 'Prompts à adapter', promptTemplate: 'Base de prompt', copyVideo: 'Copier le prompt vidéo', detailSource: 'Détail de la même image', unretouched: 'Sans retouche', frame: 'Image', shotPlan: 'Diriger le plan', frameDirection: 'Utilisez la première image originale pour guider le sujet, la lumière et la composition.', animateFrame: 'Anime la première image fournie.', videoPrompt: 'Prompt vidéo', zoom: 'Inspecter les détails', zoomOut: 'Vue complète', face: 'Visage et cheveux', texture: 'Tissu et texture', gradient: 'Couleur', before: 'Source', after: 'Retouche', aboutExamples: 'À propos de ces exemples', copy: 'Copier le prompt', copied: 'Copié', original: 'Ouvrir l’original', prompt: 'Prompt et réglages', source: 'Source exacte de la retouche', compare: 'Révéler la retouche', background: 'Fond de prévisualisation', light: 'Clair', dark: 'Sombre', motion: 'Mouvement prévu', sound: 'Son prévu', still: 'Image de départ · GPT Image 2.6 Sunburst', sourcePrompt: 'Prompt de l’image (anglais)' },
  es: { previousExamples: 'Ejemplos anteriores', nextExamples: 'Ejemplos siguientes', play: "Reproducir vídeo", loading: "Cargando…", retry: "Reintentar", playTogether: "Reproducir ambos", pause: "Pausa", timeline: "Posición de la comparación", mute: "Silenciar resultado", unmute: "Activar sonido del resultado", restart: "Reiniciar ambos", close: 'Cerrar', heroPrompt: 'Prompt de este visual', promptLibrary: 'Prompts para adaptar', promptTemplate: 'Punto de partida del prompt', copyVideo: 'Copiar prompt de vídeo', detailSource: 'Detalle de la misma imagen', unretouched: 'Sin retoques', frame: 'Fotograma', shotPlan: 'Dirigir el plano', frameDirection: 'Usa el primer fotograma original para orientar el sujeto, la luz y la composición.', animateFrame: 'Anima el primer fotograma proporcionado.', videoPrompt: 'Prompt de vídeo', zoom: 'Inspeccionar detalles', zoomOut: 'Encuadre completo', face: 'Rostro y cabello', texture: 'Tejido y textura', gradient: 'Color', before: 'Origen', after: 'Edición', aboutExamples: 'Sobre estos ejemplos', copy: 'Copiar prompt', copied: 'Copiado', original: 'Abrir original', prompt: 'Prompt y ajustes', source: 'Origen exacto de la edición', compare: 'Mostrar la edición', background: 'Fondo de vista previa', light: 'Claro', dark: 'Oscuro', motion: 'Movimiento previsto', sound: 'Sonido previsto', still: 'Fotograma inicial · GPT Image 2.6 Sunburst', sourcePrompt: 'Prompt de imagen (inglés)' },
};

const creationUi = {
  en: { reuse: 'Use this prompt', refine: 'Refine with Milo', price: 'Generation price', priceLoading: 'Checking price…', priceUnavailable: 'Price in Create', priceUnit: '/ image', priceNote: 'Before taxes', framePrice: 'Start-frame image price' },
  fr: { reuse: 'Utiliser ce prompt', refine: 'Affiner avec Milo', price: 'Prix de génération', priceLoading: 'Tarif en cours…', priceUnavailable: 'Prix dans Create', priceUnit: '/ image', priceNote: 'Hors taxes', framePrice: 'Prix de l’image de départ' },
  es: { reuse: 'Usar este prompt', refine: 'Refinar con Milo', price: 'Precio de generación', priceLoading: 'Consultando precio…', priceUnavailable: 'Precio en Create', priceUnit: '/ imagen', priceNote: 'Sin impuestos', framePrice: 'Precio del fotograma inicial' },
};
export type CinematicAsset = Pick<ModelEditorialImage, 'id' | 'title' | 'prompt' | 'original' | 'display' | 'metadataLabel' | 'source' | 'alphaVerified'> & {
  engineId?: string;
  watchHref?: string;
  video?: NonNullable<ReturnType<typeof cinematicProofVideo>>;
  videoCreation?: { href: string; refineHref: string };
  creation?: { href: string; refineHref: string; quoteInput: PublicModelQuoteInput; locale: AppLocale; isStartFrame: boolean };
};
export type CinematicPresentation = {
  locale: AppLocale;
  content: ModelCinematicContent;
  examples: ModelCinematicExamplesContent;
  assets: CinematicAsset[];
  hero: CinematicAsset;
  media?: CinematicVideoMedia;
  capabilities?: CinematicCapabilities;
  workspacePreview?: { url: string; width: number; height: number; mobile: { url: string; width: number; height: number } };
  draftVisual?: typeof draftIllustration;
  assistantHref: string;
  ui: typeof ui.en & typeof creationUi.en;
};

/** Stills retain their image-model attribution; they never enter the video gallery/schema. */
export function buildCinematicPresentation(content: ModelCinematicContent | null, examples: ModelExamplesContent,
  editorialImages: ModelEditorialImage[], locale: AppLocale, registeredMedia?: CinematicVideoMedia): CinematicPresentation | null {
  if (!content) return null;
  if (!examples.cinematic) throw new Error('Missing exact-locale cinematic examples');
  let assets: CinematicAsset[] = editorialImages;
  const media = content.variant === 'video' ? registeredMedia ?? getCinematicVideoMedia(content.modelSlug) : undefined;
  if (content.variant === 'video') {
    if (!media || media.modelSlug !== content.modelSlug) throw new Error('No reviewed media registered for this model');
    assets = z.array(frameSchema).parse(media.frames).map(frame => {
      if (!frame.display.url.startsWith(`/assets/model-examples/${content.modelSlug}/`)) throw new Error('Start-frame media belongs to another model');
      const title = examples.cinematic?.assetTitles?.find(item => item.id === frame.id)?.title;
      if (!title) throw new Error('Missing localized start-frame title');
      const frameLabel = { en: 'Start frame', fr: 'Image de départ', es: 'Fotograma inicial' }[locale];
      return { ...frame, engineId: frame.sourceEngineId, title, metadataLabel: `${frameLabel} · ${media.frameSourceLabel} · ${frame.original.width} × ${frame.original.height}` };
    });
    for (const proof of media.publicProofs ?? []) {
      if (proof.modelSlug !== content.modelSlug || !proof.display.url.startsWith(`/assets/model-examples/${content.modelSlug}/`)) throw new Error('Public proof belongs to another model');
      const title = examples.cinematic.assetTitles?.find(item => item.id === proof.id)?.title;
      if (!title) throw new Error('Missing localized public proof title');
      const params = new URLSearchParams({ engine: content.modelSlug, from: proof.jobId, lang: locale });
      const href = `/app?${params}`;
      assets.push({ ...proof, title, engineId: content.modelSlug, metadataLabel: '', watchHref: buildVideoWatchPath(proof.jobId),
        videoCreation: { href, refineHref: `${href}&assistant=milo&refine=example` } });
    }
  }
  assets = assets.map(asset => {
    const video = media?.examples[asset.id];
    if (video && media?.openingRecipe?.id === asset.id) {
      const recipe = media.openingRecipe;
      const params = new URLSearchParams({ engine: content.modelSlug, mode: recipe.mode, videoPrompt: recipe.id, lang: locale });
      const href = `/app?${params}`;
      return { ...asset, engineId: content.modelSlug, original: recipe.original, display: recipe.original, prompt: recipe.prompt, video, metadataLabel: cinematicVideoMetadata(media, video, locale === 'fr' ? 'Son' : locale === 'es' ? 'Sonido' : 'Sound'),
        videoCreation: { href, refineHref: `${href}&assistant=milo&refine=example` } };
    }
    if (video && media) return { ...asset, video, metadataLabel: cinematicVideoMetadata(media, video, locale === 'fr' ? 'Son' : locale === 'es' ? 'Sonido' : 'Sound') };
    const engineId = asset.engineId ?? content.modelSlug;
    const preset = getImageEditorialPreset(engineId, asset.id);
    if (!preset) return asset;
    const href = imageEditorialPresetHref(engineId, asset.id, locale);
    return { ...asset, creation: { href, refineHref: `${href}&assistant=milo&refine=example`, quoteInput: preset.quoteInput,
      locale, isStartFrame: content.variant === 'video' } };
  });
  const hero = assets.find(asset => asset.id === content.heroAssetId);
  if (!hero) throw new Error('Missing reviewed cinematic hero');
  const panelIds = examples.cinematic.panels.map(panel => panel.id);
  if (new Set(panelIds).size !== panelIds.length) throw new Error('Duplicate cinematic panel');
  if (content.workflows) {
    const proofIds = examples.cinematic.panels.filter(panel => !panel.placement || panel.placement === 'examples').map(panel => panel.id);
    const workflowIds = content.workflows.items.map(item => item.id);
    if (workflowIds.length !== proofIds.length || workflowIds.some(id => !proofIds.includes(id))) {
      throw new Error('Each offered workflow needs its own visible proof panel');
    }
  }
  if (content.overview) {
    const targets = content.overview.benefits.map(benefit => benefit.panelId);
    if (new Set(targets).size !== targets.length || targets.some(target => !examples.cinematic!.panels.some(panel => panel.id === target && (!panel.placement || panel.placement === 'examples')))) {
      throw new Error('Cinematic overview benefits must link to distinct visible proof panels');
    }
  }
  const highlightTargets = new Set(['proof-create', 'specs', 'prompting', ...(content.specialty ? ['model-workflow'] : []), ...(content.capabilities ? ['capabilities'] : [])]);
  if (content.highlights?.some(item => !highlightTargets.has(item.target))) throw new Error('Highlight needs a visible section');
  const focuses = content.workflows?.items.flatMap(item => item.focus ? [item.focus] : []) ?? [];
  if (focuses.some(focus => !media?.focuses[focus.id])) throw new Error('Missing reviewed media for cinematic focus');
  if (new Set(focuses.map(focus => focus.id)).size !== focuses.length || focuses.some(focus => !assets.some(asset => asset.id === focus.assetId))) {
    throw new Error('Cinematic focuses need unique anchors and reviewed assets');
  }
  // A reviewed comparison board replaces its original single-frame placeholder.
  // That unused frame can illustrate a focus, but visible images still occur once.
  const panelVisualIds = examples.cinematic.panels.flatMap(panel => {
    const workflow = content.workflows?.items.find(item => item.id === panel.id);
    return workflow && workflow.id !== 'create' && media?.boards.some(board => board.id === workflow.id) ? [] : panel.assetIds;
  });
  const galleryAssetId = examples.cinematic.gallery?.previewAssetId;
  if (galleryAssetId && !assets.some(asset => asset.id === galleryAssetId)) throw new Error('Gallery preview needs a reviewed asset');
  const visualIds = [content.heroAssetId, ...panelVisualIds, ...focuses.map(focus => focus.assetId), ...(galleryAssetId ? [galleryAssetId] : [])];
  if (new Set(visualIds).size !== visualIds.length) throw new Error('A cinematic visual has one placement; only the edit comparator may reuse its sources');
  for (const panel of examples.cinematic.panels) {
    const selected = panel.assetIds.map(id => assets.find(asset => asset.id === id));
    if (selected.some(asset => !asset)) throw new Error('Missing reviewed cinematic example');
    if (panel.layout === 'edit') {
      if (selected.length !== 3 || selected[1]?.source?.original.sha256 !== selected[0]?.original.sha256 || selected[2]?.source?.original.sha256 !== selected[1]?.original.sha256) throw new Error('Cinematic edit needs the exact successive references');
    }
    if (panel.layout === 'cutout' && (selected.length !== 1 || !selected[0]?.alphaVerified)) throw new Error('Cinematic cutout needs verified alpha');
  }
  for (const placement of ['prompting', 'details']) {
    const panels = examples.cinematic.panels.filter(panel => panel.placement === placement);
    if (panels.length !== 1 || panels[0].assetIds.length !== 1) throw new Error(`Cinematic ${placement} needs one dedicated visual`);
  }
  const assistantEntry = new URL(miloEntryHref(locale), 'https://maxvideoai.com');
  assistantEntry.pathname = content.variant === 'image' ? '/app/image' : '/app';
  assistantEntry.searchParams.set('engine', content.modelSlug);
  if (content.variant === 'video') assistantEntry.searchParams.set('mode', 't2v');
  const workspacePreview = content.specialty ? workspacePreviews.entries.find(entry => entry.modelSlug === content.modelSlug && entry.locale === locale) : undefined;
  const draftVisual = content.specialty?.kind === 'draft' && content.specialty.draftPreview && content.modelSlug === draftIllustration.modelSlug ? draftIllustration : undefined;
  if (content.specialty?.draftPreview && !draftVisual) throw new Error('Draft illustration needs an exact-model source');
  if (draftVisual && content.specialty?.draftPreview) {
    const angleIds = content.specialty.draftPreview.angles.map(angle => angle.id);
    if (new Set(angleIds).size !== 3 || !draftVisual.angles.every(angle => angleIds.includes(angle.id)) || !angleIds.includes(draftVisual.selectedAngleId)) throw new Error('Draft illustration needs matching localized camera angles');
  }
  if (content.specialty && !draftVisual && !workspacePreview) throw new Error('Missing exact-locale workspace preview');
  return { locale, content, capabilities: buildCinematicCapabilities(content.capabilities, content.modelSlug, locale), workspacePreview, draftVisual, examples: examples.cinematic, assets, hero, media, ui: { ...ui[locale], ...creationUi[locale] }, assistantHref: assistantEntry.pathname + assistantEntry.search };
}
