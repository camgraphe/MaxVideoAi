import type { AppLocale } from '@/i18n/locales';
import type { EngineLocalizedContent } from '@/lib/models/i18n';
import demos from '@/config/model-keyframe-demos.json';
import { parseModelCinematicContent } from './model-page-cinematic-content';
import { parseModelDecisionContent } from './model-page-decision-content';
import { parseModelExamplesContent } from './model-page-examples-content';
import { parseModelPromptingContent } from './model-page-prompting-content';

// Keep the prepared storyboard in the editorial source until an end-to-end render is verified.
const copy = {
  en: {
    overview: 'FLUX 3 Max is a video model post-trained by fal in collaboration with Black Forest Labs. Start with text, animate an opening image, or supply the first and last frames to direct a transition.',
    description: 'Create 5–20s videos with FLUX 3 Max from text or images, with optional audio. See real prompts, first and last frames, and prices for 720p or upscaled 1080p.',
    intro: 'Turn text or images into a 5–20 second video with optional audio. Give FLUX 3 Max an opening image, or set both the first and last frames to guide the shot.',
    modes: 'Choose how to start your shot', sound: 'Direct the sound', soundBody: 'Write the line, the room tone and the pause that follows.',
    reference: 'Timed keyframes', note: 'With two images, describe how the action leads from the opening composition to the final view.',
    steps: ['Establish the scene', 'Direct the action', 'Describe the sound'],
    controls: 'Choose optional audio, Low or High reasoning, a seed and 720p or upscaled 1080p. Review the price in Create before generating.',
    modelQuestion: 'What is FLUX 3 Max?', familyQuestion: 'How is FLUX 3 Max different from FLUX 3?', examplesQuestion: 'Where can I find FLUX 3 Max prompts and examples?', heldQuestion: 'How do keyframes work in FLUX 3 Max?',
    family: 'Max is fal’s post-trained variant of FLUX 3 Video. Use text or images to start a shot. If you want to continue an existing video, the standard FLUX 3 model offers an extension workflow.',
    examples: 'Play a film in the examples gallery and open its prompt to inspect the direction. In Create you can reuse the prompt or refine it with Milo.',
  },
  fr: {
    overview: 'FLUX 3 Max est un modèle vidéo post-entraîné par fal en collaboration avec Black Forest Labs. Partez d’un texte, animez une image ou donnez les images de début et de fin pour diriger une transition.',
    description: 'Créez des vidéos de 5 à 20 s avec FLUX 3 Max, avec ou sans son. Découvrez les prompts, les images de début et de fin et les tarifs en 720p ou en 1080p par upscale.',
    intro: 'Transformez un texte ou une image en vidéo de 5 à 20 secondes, avec du son si vous le souhaitez. Donnez à FLUX 3 Max une image de départ ou fixez aussi l’image de fin pour guider le plan.',
    modes: 'Choisissez le point de départ du plan', sound: 'Dirigez le son', soundBody: 'Écrivez la réplique, le bruit de fond et le silence qui suit.',
    reference: 'Séquence d’images clés', note: 'Avec deux images, décrivez le mouvement qui relie le cadre de départ à celui d’arrivée.',
    steps: ['Plantez le décor', 'Dirigez l’action', 'Décrivez le son'],
    controls: 'Choisissez le son, le niveau de raisonnement, une seed et la sortie en 720p ou en 1080p avec upscale. Le devis s’affiche dans Create avant la génération.',
    modelQuestion: 'Qu’est-ce que FLUX 3 Max ?', familyQuestion: 'Quelle différence entre FLUX 3 Max et FLUX 3 ?', examplesQuestion: 'Où trouver des prompts et exemples FLUX 3 Max ?', heldQuestion: 'Comment utiliser les images clés dans FLUX 3 Max ?',
    family: 'Max est la variante de FLUX 3 Video post-entraînée par fal. Un texte ou des images donnent le départ du plan. Pour prolonger une vidéo existante, le modèle FLUX 3 standard propose un mode d’extension.',
    examples: 'Lancez un film dans la galerie et ouvrez son prompt pour voir les indications de mise en scène. Vous pouvez reprendre le prompt dans Create ou le retravailler avec Milo.',
  },
  es: {
    overview: 'FLUX 3 Max es un modelo de vídeo posentrenado por fal en colaboración con Black Forest Labs. Parte de un texto, anima una imagen inicial o guía una transición con los fotogramas de inicio y fin.',
    description: 'Crea vídeos de 5 a 20 s con FLUX 3 Max y audio opcional. Explora los prompts, los fotogramas de inicio y fin y los precios en 720p o con reescalado a 1080p.',
    intro: 'Convierte texto o imágenes en un vídeo de 5 a 20 segundos con audio opcional. Dale a FLUX 3 Max una imagen inicial o fija también el último fotograma para guiar el plano.',
    modes: 'Elige cómo empieza el plano', sound: 'Dirige el sonido', soundBody: 'Escribe la frase, el sonido ambiente y la pausa que sigue.',
    reference: 'Secuencia de imágenes clave', note: 'Con dos imágenes, describe el movimiento que conecta la composición inicial con el encuadre final.',
    steps: ['Presenta la escena', 'Dirige la acción', 'Describe el sonido'],
    controls: 'Elige el audio, el nivel de razonamiento, una semilla y la salida en 720p o 1080p con reescalado. Revisa el precio en Create antes de generar.',
    modelQuestion: '¿Qué es FLUX 3 Max?', familyQuestion: '¿En qué se diferencia FLUX 3 Max de FLUX 3?', examplesQuestion: '¿Dónde encuentro prompts y ejemplos de FLUX 3 Max?', heldQuestion: '¿Cómo se usan las imágenes clave en FLUX 3 Max?',
    family: 'Max es la variante de FLUX 3 Video posentrenada por fal. Puedes iniciar un plano con texto o imágenes. Si quieres prolongar un vídeo existente, el modelo FLUX 3 estándar ofrece un modo de extensión.',
    examples: 'Reproduce una película en la galería y abre su prompt para ver las indicaciones de dirección. Puedes reutilizarlo en Create o ajustarlo con Milo.',
  },
} as const;

export function heldModelPageDemo(slug: string) {
  return slug === 'flux-3-max' ? demos.demos.find(demo => demo.modelSlug === slug)?.jobId : undefined;
}

export function projectModelPageSpecs(specs: Record<string, unknown> | undefined, slug: string, locale: AppLocale) {
  if (slug !== 'flux-3-max' || !specs) return specs;
  const inputs = { en: 'Opening image with an optional ending image', fr: 'Image de départ et image de fin facultative', es: 'Imagen inicial e imagen final opcional' };
  const fps = { en: 'Fixed frame rate', fr: 'Cadence fixe', es: 'Frecuencia de fotogramas fija' };
  return { ...specs, referenceImageStyle: inputs[locale], fpsOptions: [fps[locale]] };
}

export function projectModelPageRelease(raw: EngineLocalizedContent, slug: string, locale: AppLocale): EngineLocalizedContent {
  if (slug !== 'flux-3-max') return raw;
  const c = copy[locale];
  const cinematic = parseModelCinematicContent(raw.cinematic, slug);
  const decision = parseModelDecisionContent(raw.decision, slug, locale);
  const examples = parseModelExamplesContent(raw.examples, slug, locale);
  const prompting = parseModelPromptingContent(raw.prompting, slug, locale);
  if (!cinematic?.workflows || !cinematic.capabilities || !cinematic.highlights) throw new Error('Missing FLUX model page workflows');

  delete cinematic.specialty;
  cinematic.intro = c.intro;
  cinematic.highlights = [cinematic.highlights[0], { target: 'capabilities', title: c.modes, body: cinematic.capabilities.intro },
    { target: 'prompting', title: c.sound, body: c.soundBody }];
  cinematic.workflows.intro = c.intro;
  cinematic.workflows.note = c.note;
  cinematic.workflows.items[0].steps = [...c.steps];
  cinematic.capabilities.title = c.modes;
  cinematic.capabilities.items = cinematic.capabilities.items.filter(item => item.id !== 'keyframes');
  cinematic.capabilities.controls.body = c.controls;
  decision.meta.description = c.description;
  decision.features[0].body = c.overview;
  decision.referenceWorkflows = decision.referenceWorkflows.filter(item => item.title !== c.reference);
  delete examples.keyframeDemo;
  for (const panel of examples.cinematic?.panels ?? []) if (panel.placement === 'details') panel.body = c.description;
  prompting.tabs = prompting.tabs.filter(tab => tab.id !== 'keyframes');
  prompting.tabNotes = prompting.tabNotes.filter(note => note.tabId !== 'keyframes');
  const answers = new Map<string, string>([[c.modelQuestion, c.overview], [c.familyQuestion, c.family], [c.examplesQuestion, c.examples]]);
  return { ...raw, overview: c.overview, seo: { ...raw.seo, description: c.description }, cinematic, examples, decision, prompting,
    faqs: raw.faqs.filter(faq => faq.question !== c.heldQuestion).map(faq => ({ ...faq, answer: answers.get(faq.question) ?? faq.answer })) };
}
