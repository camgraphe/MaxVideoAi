import type { AppLocale } from '@/i18n/locales';

import { PRICE_AUDIO_LABELS } from './model-page-specs-constants';
import type { SoraCopy } from './model-page-specs';
import type {
  DecisionExampleFilterId,
  ModelExampleFilter,
  ModelExampleIconId,
  ModelExamplesContent,
} from './model-page-examples-content';

export const LEGACY_ACTIVE_IMAGE_FALLBACK_SLUGS = new Set([
  'nano-banana-pro',
  'nano-banana',
  'nano-banana-2',
  'seedream',
  'gpt-image-2',
  'luma-uni-1',
  'luma-uni-1-max',
]);

export type BuildLegacyModelExamplesContentInput = {
  modelSlug: string;
  locale: AppLocale;
  copy: Pick<SoraCopy,
    | 'heroTitle'
    | 'galleryTitle'
    | 'galleryIntro'
    | 'galleryAllCta'
    | 'recreateLabel'
  >;
  imageFallbackActive: boolean;
};

function resolveExamplesModelName(copy: BuildLegacyModelExamplesContentInput['copy']) {
  const rawTitle = copy.heroTitle ?? copy.galleryTitle ?? '';
  const cleanedTitle = rawTitle
    .replace(/\s+(?:examples|exemples|ejemplos)\b.*$/i, '')
    .replace(/\s+-\s+.*$/i, '')
    .trim();
  return cleanedTitle || 'this model';
}
function getFallbackExamplesTitle(locale: AppLocale, modelName: string) {
  if (locale === 'fr') return `Exemples ${modelName}`;
  if (locale === 'es') return `Ejemplos de ${modelName}`;
  return `${modelName} examples`;
}

function getFallbackExamplesIntro(locale: AppLocale, modelName: string) {
  if (locale === 'fr') {
    return `Explorez des rendus de la communauté et voyez comment ${modelName} se comporte dans des workflows MaxVideoAI.`;
  }
  if (locale === 'es') {
    return `Explora resultados de la comunidad y mira cómo ${modelName} funciona en flujos de MaxVideoAI.`;
  }
  return `Explore real community outputs and see how ${modelName} performs inside MaxVideoAI workflows.`;
}

function isLumaRay2Route(engineSlug?: string) {
  return engineSlug === 'luma-ray-2' || engineSlug === 'lumaRay2';
}

function isLumaRay2FlashRoute(engineSlug?: string) {
  return engineSlug === 'luma-ray-2-flash' || engineSlug === 'lumaRay2_flash';
}

function isLumaRay32Route(engineSlug?: string) {
  return engineSlug === 'luma-ray-3-2';
}

function isLumaUni1Route(engineSlug?: string) {
  return engineSlug === 'luma-uni-1';
}

function isLumaUni1MaxRoute(engineSlug?: string) {
  return engineSlug === 'luma-uni-1-max';
}

function isSeedance15ProRoute(engineSlug?: string) {
  return engineSlug === 'seedance-1-5-pro';
}

function isKling34kRoute(engineSlug?: string) {
  return engineSlug === 'kling-3-4k';
}

function isKling3ProRoute(engineSlug?: string) {
  return engineSlug === 'kling-3-pro';
}

function isKling3StandardRoute(engineSlug?: string) {
  return engineSlug === 'kling-3-standard';
}

function isSilentVideoDecisionEngine(engineSlug?: string) {
  return (
    engineSlug === 'minimax-hailuo-02-text' ||
    engineSlug === 'pika-text-to-video' ||
    isLumaRay2Route(engineSlug) ||
    isLumaRay2FlashRoute(engineSlug) ||
    isLumaRay32Route(engineSlug)
  );
}
function getDecisionExampleFilters(locale: AppLocale, isImageEngine: boolean, engineSlug?: string): ModelExampleFilter[] {
  if (isImageEngine) {
    if (engineSlug === 'nano-banana-lite') {
      if (locale === 'fr') {
        return [
          { id: 'all', label: 'Tous' },
          { id: 'campaign', label: 'Drafts 1K' },
          { id: 'edit', label: 'Edit' },
          { id: 'reference', label: 'Références' },
          { id: 'batch', label: 'Variantes' },
        ];
      }
      if (locale === 'es') {
        return [
          { id: 'all', label: 'Todo' },
          { id: 'campaign', label: 'Drafts 1K' },
          { id: 'edit', label: 'Edit' },
          { id: 'reference', label: 'Referencias' },
          { id: 'batch', label: 'Variantes' },
        ];
      }
      return [
        { id: 'all', label: 'All' },
        { id: 'campaign', label: '1K drafts' },
        { id: 'edit', label: 'Edit' },
        { id: 'reference', label: 'References' },
        { id: 'batch', label: 'Variants' },
      ];
    }

    if (engineSlug === 'seedream-5-0-pro') {
      if (locale === 'fr') {
        return [
          { id: 'all', label: 'Tous' },
          { id: 'infographic', label: 'Infographie' },
          { id: 'campaign', label: 'Campagne' },
          { id: 'edit', label: 'Edit' },
          { id: 'final', label: 'Frame final' },
        ];
      }
      if (locale === 'es') {
        return [
          { id: 'all', label: 'Todo' },
          { id: 'infographic', label: 'Infografia' },
          { id: 'campaign', label: 'Campaña' },
          { id: 'edit', label: 'Edit' },
          { id: 'final', label: 'Frame final' },
        ];
      }
      return [
        { id: 'all', label: 'All' },
        { id: 'infographic', label: 'Infographic' },
        { id: 'campaign', label: 'Campaign' },
        { id: 'edit', label: 'Edit' },
        { id: 'final', label: 'Final frame' },
      ];
    }

    if (engineSlug === 'seedream') {
      if (locale === 'fr') {
        return [
          { id: 'all', label: 'Tous' },
          { id: 'product', label: 'Produit' },
          { id: 'character', label: 'Personnage' },
          { id: 'edit', label: 'Edit' },
          { id: 'batch', label: 'Batch' },
        ];
      }
      if (locale === 'es') {
        return [
          { id: 'all', label: 'Todo' },
          { id: 'product', label: 'Producto' },
          { id: 'character', label: 'Personaje' },
          { id: 'edit', label: 'Edit' },
          { id: 'batch', label: 'Batch' },
        ];
      }
      return [
        { id: 'all', label: 'All' },
        { id: 'product', label: 'Product still' },
        { id: 'character', label: 'Character' },
        { id: 'edit', label: 'Edit' },
        { id: 'batch', label: 'Batch' },
      ];
    }

    if (engineSlug === 'nano-banana-2') {
      if (locale === 'fr') {
        return [
          { id: 'all', label: 'Tous' },
          { id: 'grounded', label: 'Guidé' },
          { id: 'edit', label: 'Edit' },
          { id: 'reference', label: 'Références' },
          { id: 'wide', label: 'Ratio large' },
        ];
      }
      if (locale === 'es') {
        return [
          { id: 'all', label: 'Todo' },
          { id: 'grounded', label: 'Guiado' },
          { id: 'edit', label: 'Edit' },
          { id: 'reference', label: 'Referencias' },
          { id: 'wide', label: 'Ratio amplio' },
        ];
      }
      return [
        { id: 'all', label: 'All' },
        { id: 'grounded', label: 'Grounded' },
        { id: 'edit', label: 'Edit' },
        { id: 'reference', label: 'References' },
        { id: 'wide', label: 'Wide ratio' },
      ];
    }
    if (engineSlug === 'gpt-image-2') {
      if (locale === 'fr') {
        return [
          { id: 'all', label: 'Tous' },
          { id: 'product', label: 'Produit' },
          { id: 'typography', label: 'Texte' },
          { id: 'ui', label: 'UI' },
          { id: 'edit', label: 'Edit' },
          { id: 'mask', label: 'Masque' },
          { id: 'final', label: '4K final' },
        ];
      }
      if (locale === 'es') {
        return [
          { id: 'all', label: 'Todo' },
          { id: 'product', label: 'Producto' },
          { id: 'typography', label: 'Texto' },
          { id: 'ui', label: 'UI' },
          { id: 'edit', label: 'Edit' },
          { id: 'mask', label: 'Máscara' },
          { id: 'final', label: '4K final' },
        ];
      }
      return [
        { id: 'all', label: 'All' },
        { id: 'product', label: 'Product' },
        { id: 'typography', label: 'Readable text' },
        { id: 'ui', label: 'UI mockup' },
        { id: 'edit', label: 'Image edit' },
        { id: 'mask', label: 'Mask edit' },
        { id: 'final', label: '4K final' },
      ];
    }
    if (isLumaUni1Route(engineSlug)) {
      if (locale === 'fr') {
        return [
          { id: 'all', label: 'Tous' },
          { id: 'product', label: 'Produit' },
          { id: 'edit', label: 'Edit' },
          { id: 'reference', label: 'References' },
          { id: 'campaign', label: 'Direction' },
        ];
      }
      if (locale === 'es') {
        return [
          { id: 'all', label: 'Todo' },
          { id: 'product', label: 'Producto' },
          { id: 'edit', label: 'Edit' },
          { id: 'reference', label: 'Referencias' },
          { id: 'campaign', label: 'Direccion' },
        ];
      }
      return [
        { id: 'all', label: 'All' },
        { id: 'product', label: 'Product' },
        { id: 'edit', label: 'Edit' },
        { id: 'reference', label: 'References' },
        { id: 'campaign', label: 'Direction' },
      ];
    }
    if (isLumaUni1MaxRoute(engineSlug)) {
      if (locale === 'fr') {
        return [
          { id: 'all', label: 'Tous' },
          { id: 'product', label: 'Produit' },
          { id: 'typography', label: 'Typographie' },
          { id: 'edit', label: 'Edit' },
          { id: 'reference', label: 'References' },
        ];
      }
      if (locale === 'es') {
        return [
          { id: 'all', label: 'Todo' },
          { id: 'product', label: 'Producto' },
          { id: 'typography', label: 'Tipografia' },
          { id: 'edit', label: 'Edit' },
          { id: 'reference', label: 'Referencias' },
        ];
      }
      return [
        { id: 'all', label: 'All' },
        { id: 'product', label: 'Product' },
        { id: 'typography', label: 'Typography' },
        { id: 'edit', label: 'Edit' },
        { id: 'reference', label: 'References' },
      ];
    }
    if (locale === 'fr') {
      return [
        { id: 'all', label: 'Tous' },
        { id: 'campaign', label: 'Campagne' },
        { id: 'typography', label: 'Typographie' },
        { id: 'reference', label: 'Référence' },
        { id: 'final', label: '4K final' },
      ];
    }
    if (locale === 'es') {
      return [
        { id: 'all', label: 'Todo' },
        { id: 'campaign', label: 'Campaña' },
        { id: 'typography', label: 'Tipografía' },
        { id: 'reference', label: 'Referencia' },
        { id: 'final', label: '4K final' },
      ];
    }
    return [
      { id: 'all', label: 'All' },
      { id: 'campaign', label: 'Campaign' },
      { id: 'typography', label: 'Typography' },
      { id: 'reference', label: 'Reference edit' },
      { id: 'final', label: '4K final' },
    ];
  }

  if (locale === 'fr') {
    const filters: ModelExampleFilter[] = [
      { id: 'all', label: 'Tous' },
      { id: 'cinematic', label: 'Cinématique' },
      { id: 'product', label: 'Produit / Pub' },
      { id: 'action', label: 'Action' },
      { id: 'vertical', label: 'Vertical' },
    ];
    if (!isSilentVideoDecisionEngine(engineSlug)) filters.push({ id: 'audio', label: PRICE_AUDIO_LABELS.fr.on });
    return filters;
  }
  if (locale === 'es') {
    const filters: ModelExampleFilter[] = [
      { id: 'all', label: 'Todo' },
      { id: 'cinematic', label: 'Cinemático' },
      { id: 'product', label: 'Producto / Anuncio' },
      { id: 'action', label: 'Acción' },
      { id: 'vertical', label: 'Vertical' },
    ];
    if (!isSilentVideoDecisionEngine(engineSlug)) filters.push({ id: 'audio', label: PRICE_AUDIO_LABELS.es.on });
    return filters;
  }
  const filters: ModelExampleFilter[] = [
    { id: 'all', label: 'All' },
    { id: 'cinematic', label: 'Cinematic' },
    { id: 'product', label: 'Product / Ad' },
    { id: 'action', label: 'Action' },
    { id: 'vertical', label: 'Vertical' },
  ];
  if (!isSilentVideoDecisionEngine(engineSlug)) filters.push({ id: 'audio', label: 'Audio on' });
  return filters;
}

function getDecisionExampleProofItems(locale: AppLocale, modelName: string, isImageEngine: boolean, engineSlug?: string): Array<{
  title: string;
  body: string;
  icon: ModelExampleIconId;
}> {
  if (isImageEngine) {
    if (isLumaUni1Route(engineSlug) || isLumaUni1MaxRoute(engineSlug)) {
      const isMax = isLumaUni1MaxRoute(engineSlug);
      if (locale === 'fr') {
        return [
          { title: isMax ? 'Stills haute fidelite' : 'Stills propres', body: `${modelName} pour tester une direction image sans complexifier le prompt.`, icon: 'image' },
          { title: 'Edit guide', body: 'Modifiez une image source en gardant produit, forme et palette lisibles.', icon: 'pen' },
          { title: 'References', body: 'Utilisez des images de depart ou de style quand la coherence compte.', icon: 'users' },
          { title: isMax ? 'Detail et texte' : 'Ratios simples', body: isMax ? 'Bon candidat pour posters, packshots et typographie courte.' : 'Validez produit, carre, vertical ou 16:9 avant de passer en video.', icon: isMax ? 'type' : 'maximize' },
          { title: 'Pret video', body: 'Servez-vous des meilleurs stills comme images de depart pour Ray 3.2.', icon: 'shield' },
        ];
      }
      if (locale === 'es') {
        return [
          { title: isMax ? 'Stills de alta fidelidad' : 'Stills limpios', body: `${modelName} para probar direccion visual sin hacer complejo el prompt.`, icon: 'image' },
          { title: 'Edit guiado', body: 'Edita una imagen fuente manteniendo producto, forma y paleta claros.', icon: 'pen' },
          { title: 'Referencias', body: 'Usa imagenes iniciales o de estilo cuando la coherencia importa.', icon: 'users' },
          { title: isMax ? 'Detalle y texto' : 'Ratios simples', body: isMax ? 'Buen candidato para posters, packshots y tipografia corta.' : 'Valida producto, cuadrado, vertical o 16:9 antes de pasar a video.', icon: isMax ? 'type' : 'maximize' },
          { title: 'Listo para video', body: 'Usa los mejores stills como imagen inicial para Ray 3.2.', icon: 'shield' },
        ];
      }
      return [
        { title: isMax ? 'High-fidelity stills' : 'Clean stills', body: `${modelName} is best tested with a focused visual direction, not overloaded prompts.`, icon: 'image' },
        { title: 'Guided edits', body: 'Edit a source image while keeping product shape, palette, and layout readable.', icon: 'pen' },
        { title: 'References', body: 'Use start or style references when consistency matters.', icon: 'users' },
        { title: isMax ? 'Detail and text' : 'Simple ratios', body: isMax ? 'Useful for posters, packshots, and short typography tests.' : 'Validate product, square, vertical, or 16:9 stills before video.', icon: isMax ? 'type' : 'maximize' },
        { title: 'Video-ready', body: 'Use the strongest stills as start images for Ray 3.2.', icon: 'shield' },
      ];
    }
    if (locale === 'fr') {
      return [
        { title: 'Exemples image', body: `Prompts stills adaptés à ${modelName}.`, icon: 'image' },
        { title: 'Typographie', body: 'Texte exact, hiérarchie et placement restent visibles.', icon: 'type' },
        { title: 'Retouches référence', body: 'Gardez produit, identité, palette ou layout.', icon: 'pen' },
        { title: 'Finales 4K', body: 'Validez en 2K puis finalisez en 4K.', icon: 'maximize' },
        { title: 'Prêt production', body: 'Références possédées et garde-fous intégrés.', icon: 'shield' },
      ];
    }
    if (locale === 'es') {
      return [
        { title: 'Ejemplos de imagen', body: `Prompts still adaptados a ${modelName}.`, icon: 'image' },
        { title: 'Tipografía', body: 'Texto exacto, jerarquía y ubicación legibles.', icon: 'type' },
        { title: 'Ediciones con referencia', body: 'Mantén producto, identidad, paleta o layout.', icon: 'pen' },
        { title: 'Finales 4K', body: 'Valida en 2K y termina en 4K.', icon: 'maximize' },
        { title: 'Listo para producción', body: 'Referencias propias y controles integrados.', icon: 'shield' },
      ];
    }
    return [
      { title: 'Still image examples', body: `Prompt patterns tailored to ${modelName}.`, icon: 'image' },
      { title: 'Typography control', body: 'Exact copy, hierarchy and placement stay explicit.', icon: 'type' },
      { title: 'Reference edits', body: 'Keep product identity, palette, layout or style.', icon: 'pen' },
      { title: '4K finals', body: 'Validate at 2K, then finish at 4K.', icon: 'maximize' },
      { title: 'Production-aware', body: 'Owned references and built-in guardrails.', icon: 'shield' },
    ];
  }

  if (isSilentVideoDecisionEngine(engineSlug)) {
    const isPika = engineSlug === 'pika-text-to-video';
    const isLuma = isLumaRay2Route(engineSlug);
    const isLumaFlash = isLumaRay2FlashRoute(engineSlug);
    const isLuma32 = isLumaRay32Route(engineSlug);
    if (isLuma32) {
      if (locale === 'fr') {
        return [
          { title: 'Modify source', body: 'Etudiez comment Ray 3.2 change un clip sans perdre son timing.', icon: 'sparkles' },
          { title: 'Reframe livraison', body: 'Recreez un ratio vertical, carre ou large depuis le meme master.', icon: 'zap' },
          { title: 'Sortie silencieuse', body: 'Ray 3.2 ne genere pas d audio natif sur cette route MaxVideoAI.', icon: 'audio' },
          { title: 'Images guides', body: 'Utilisez une image ou des images cles pour diriger des moments precis.', icon: 'image' },
          { title: 'Controle cout', body: 'Validez en 5 s / 540p ou 720p avant les passes 1080p.', icon: 'shield' },
        ];
      }
      if (locale === 'es') {
        return [
          { title: 'Modify fuente', body: 'Estudia como Ray 3.2 cambia un clip sin perder su timing.', icon: 'sparkles' },
          { title: 'Reframe entrega', body: 'Recrea un ratio vertical, cuadrado o ancho desde el mismo master.', icon: 'zap' },
          { title: 'Salida sin audio', body: 'Ray 3.2 no genera audio nativo en esta ruta de MaxVideoAI.', icon: 'audio' },
          { title: 'Cuadros guia', body: 'Usa un cuadro o imagenes clave para dirigir momentos concretos.', icon: 'image' },
          { title: 'Control de coste', body: 'Valida en 5 s / 540p o 720p antes de pasadas 1080p.', icon: 'shield' },
        ];
      }
      return [
        { title: 'Modify source clips', body: 'Study how Ray 3.2 changes a clip without losing its timing.', icon: 'sparkles' },
        { title: 'Reframe delivery', body: 'Recreate a vertical, square, or wide cut from the same approved master.', icon: 'zap' },
        { title: 'Silent output', body: 'Ray 3.2 does not generate native audio on this MaxVideoAI route.', icon: 'audio' },
        { title: 'Guide frames', body: 'Use one frame or indexed keyframes to steer specific source moments.', icon: 'image' },
        { title: 'Cost control', body: 'Validate at 5s / 540p or 720p before 1080p passes.', icon: 'shield' },
      ];
    }
    if (locale === 'fr') {
      return [
        { title: isPika ? 'Boucles stylisées' : isLuma ? 'Rendus Luma premium' : isLumaFlash ? 'Brouillons Luma rapides' : 'Rendus brouillon', body: isPika ? 'Voyez les boucles Text-to-Video silencieuses possibles avec Pika 2.2.' : isLuma ? 'Comparez génération, image de départ, Modify et Reframe dans Ray 2.' : isLumaFlash ? 'Comparez vite directions, cadrages et versions Modify avant Ray 2.' : 'Voyez les tests mouvement légers possibles avec Hailuo 02.', icon: 'sparkles' },
        { title: isLuma ? 'Recréer un rendu' : 'Recréer un test', body: isPika ? 'Ouvrez l’app et réutilisez le prompt, le ratio et la durée.' : isLuma ? 'Ouvrez l’app avec Ray 2 et réutilisez prompt, ratio et durée.' : isLumaFlash ? 'Ouvrez l’app avec Ray 2 Flash et réutilisez la recette du draft.' : 'Ouvrez l’app et réutilisez le prompt ou l’image de départ.', icon: 'zap' },
        { title: 'Sortie silencieuse', body: isPika ? 'Aucune bande-son générée ici ; ajoutez son et voix plus tard.' : isLuma ? 'Ray 2 ne génère pas d’audio natif dans cette route MaxVideoAI.' : isLumaFlash ? 'Ray 2 Flash ne génère pas d’audio natif dans cette route.' : 'Pas d’audio natif sur cette route ; ajoutez son et voix plus tard.', icon: 'audio' },
        { title: isPika ? 'Seeds et négatifs' : isLuma || isLumaFlash ? 'Start image et edit' : 'Tests physiques', body: isPika ? 'Gardez une direction visuelle et bloquez texte, logos ou artefacts.' : isLuma ? 'Animez une image de départ, modifiez un clip source ou recadrez un master.' : isLumaFlash ? 'Animez une image de départ ou testez Modify/Reframe sur clip source.' : 'Vérifiez force, collisions, tissu, eau et contact au sol.', icon: 'users' },
        { title: isPika ? 'Social first' : isLuma ? 'Route finale Ray 2' : isLumaFlash ? 'Upgrade vers Ray 2' : 'Route de brouillon', body: isPika ? 'Pensé pour clips courts, overlays et loops à monter ensuite.' : isLuma ? 'Gardez Ray 2 pour les shots validés et les variantes de livraison.' : isLumaFlash ? 'Gardez Flash pour l’itération, puis finalisez les gagnants sur Ray 2.' : '512P/768P ici ; passez les plans validés sur une route finale.', icon: 'shield' },
      ];
    }
    if (locale === 'es') {
      return [
        { title: isPika ? 'Loops estilizados' : isLuma ? 'Renders Luma premium' : isLumaFlash ? 'Borradores Luma rápidos' : 'Renders de borrador', body: isPika ? 'Mira loops Text-to-Video sin audio posibles con Pika 2.2.' : isLuma ? 'Compara generación, imagen inicial, Modify y Reframe dentro de Ray 2.' : isLumaFlash ? 'Compara rápido dirección, encuadre y versiones Modify antes de Ray 2.' : 'Mira pruebas ligeras de movimiento posibles con Hailuo 02.', icon: 'sparkles' },
        { title: isLuma ? 'Recrear un render' : 'Recrear una prueba', body: isPika ? 'Abre la app y reutiliza prompt, formato y duración.' : isLuma ? 'Abre la app con Ray 2 y reutiliza prompt, formato y duración.' : isLumaFlash ? 'Abre la app con Ray 2 Flash y reutiliza la receta del borrador.' : 'Abre la app y reutiliza prompt o imagen inicial.', icon: 'zap' },
        { title: 'Salida sin audio', body: isPika ? 'Aquí no se genera banda sonora; añade sonido y voz después.' : isLuma ? 'Ray 2 no genera audio nativo en esta ruta de MaxVideoAI.' : isLumaFlash ? 'Ray 2 Flash no genera audio nativo en esta ruta.' : 'Esta ruta no tiene audio nativo; añade sonido y voz después.', icon: 'audio' },
        { title: isPika ? 'Seeds y negativos' : isLuma || isLumaFlash ? 'Start image y edición' : 'Pruebas físicas', body: isPika ? 'Mantén una dirección visual y bloquea texto, logos o artefactos.' : isLuma ? 'Anima una imagen inicial, modifica un clip fuente o reencuadra un master.' : isLumaFlash ? 'Anima una imagen inicial o prueba Modify/Reframe sobre video fuente.' : 'Revisa fuerza, colisiones, tela, agua y contacto con el suelo.', icon: 'users' },
        { title: isPika ? 'Social first' : isLuma ? 'Ruta final Ray 2' : isLumaFlash ? 'Upgrade a Ray 2' : 'Ruta de borrador', body: isPika ? 'Pensado para clips cortos, overlays y loops para editar después.' : isLuma ? 'Usa Ray 2 para tomas aprobadas y variantes de entrega.' : isLumaFlash ? 'Usa Flash para iterar y finaliza los ganadores en Ray 2.' : '512P/768P aquí; pasa los planos aprobados a una ruta final.', icon: 'shield' },
      ];
    }
    return [
      { title: isPika ? 'Stylized loops' : isLuma ? 'Premium Luma renders' : isLumaFlash ? 'Fast Luma drafts' : 'Draft renders', body: isPika ? `See silent Text-to-Video loops possible with ${modelName}.` : isLuma ? 'Compare generation, start-image motion, Modify and Reframe inside Ray 2.' : isLumaFlash ? 'Compare direction, framing and Modify variants before Ray 2.' : `See lightweight motion tests possible with ${modelName}.`, icon: 'sparkles' },
      { title: isLuma ? 'Recreate a render' : 'Recreate a test', body: isPika ? 'Open the app and reuse the prompt, aspect ratio and duration.' : isLuma ? 'Open Ray 2 in the app and reuse prompt, aspect ratio and duration.' : isLumaFlash ? 'Open Ray 2 Flash in the app and reuse the draft setup.' : 'Open the app and reuse the prompt or start image setup.', icon: 'zap' },
      { title: 'Silent output', body: isPika ? 'No soundtrack is generated here; add sound and voice later.' : isLuma ? 'Ray 2 does not generate native audio on this MaxVideoAI route.' : isLumaFlash ? 'Ray 2 Flash does not generate native audio on this route.' : 'No native audio on this route; add sound and voice later.', icon: 'audio' },
      { title: isPika ? 'Seeds and negatives' : isLuma || isLumaFlash ? 'Start image and edit' : 'Physics checks', body: isPika ? 'Keep a visual lane and block text, logos or artifacts.' : isLuma ? 'Animate a start frame, modify a source clip or reframe an approved master.' : isLumaFlash ? 'Animate a start frame or test Modify/Reframe from a source clip.' : 'Review force, collisions, cloth, water and ground contact.', icon: 'users' },
      { title: isPika ? 'Social first' : isLuma ? 'Ray 2 final route' : isLumaFlash ? 'Upgrade to Ray 2' : 'Draft route', body: isPika ? 'Built for short clips, overlays and loops you can edit later.' : isLuma ? 'Use Ray 2 for selected shots and final delivery variants.' : isLumaFlash ? 'Use Flash for iteration, then final selected shots on Ray 2.' : '512P/768P here; move approved shots to a final route.', icon: 'shield' },
    ];
  }

  if (isSeedance15ProRoute(engineSlug)) {
    if (locale === 'fr') {
      return [
        { title: 'Rendus camera_fixed', body: `Voyez les plans verrouillés possibles avec ${modelName}.`, icon: 'sparkles' },
        { title: 'Recréer une variante', body: 'Ouvrez l’app avec le même seed, ratio et réglage caméra.', icon: 'zap' },
        { title: 'Audio on/off', body: 'Gardez l’audio natif ou coupez-le pour réduire le coût.', icon: 'audio' },
        { title: 'Images départ/fin', body: 'Utilisez une image initiale et une fin optionnelle en I2V.', icon: 'image' },
        { title: 'Route legacy contrôlée', body: 'Idéal pour tests Seedance 1.5 répétables avant migration 2.0.', icon: 'shield' },
      ];
    }
    if (locale === 'es') {
      return [
        { title: 'Renders camera_fixed', body: `Mira tomas bloqueadas posibles con ${modelName}.`, icon: 'sparkles' },
        { title: 'Recrear una variante', body: 'Abre la app con el mismo seed, ratio y ajuste de cámara.', icon: 'zap' },
        { title: 'Audio on/off', body: 'Mantén audio nativo o apágalo para reducir coste.', icon: 'audio' },
        { title: 'Frames inicial/final', body: 'Usa una imagen inicial y un final opcional en I2V.', icon: 'image' },
        { title: 'Ruta legacy controlada', body: 'Útil para pruebas Seedance 1.5 repetibles antes de migrar a 2.0.', icon: 'shield' },
      ];
    }
    return [
      { title: 'Camera-fixed renders', body: `See locked-camera shots possible with ${modelName}.`, icon: 'sparkles' },
      { title: 'Recreate a variant', body: 'Open the app with the same seed, ratio and camera setting.', icon: 'zap' },
      { title: 'Audio on/off', body: 'Keep native audio or switch it off for a lower quote.', icon: 'audio' },
      { title: 'Start/end frames', body: 'Use a start image and optional end frame in I2V.', icon: 'image' },
      { title: 'Controlled legacy route', body: 'Useful for repeatable Seedance 1.5 tests before moving to 2.0.', icon: 'shield' },
    ];
  }

  if (isKling34kRoute(engineSlug)) {
    if (locale === 'fr') {
      return [
        { title: 'Masters 4K natifs', body: `Voyez les rendus finaux possibles avec ${modelName}.`, icon: 'maximize' },
        { title: 'Recréer un master', body: 'Ouvrez l’app avec Kling 3 4K et réutilisez le prompt validé.', icon: 'zap' },
        { title: 'Audio optionnel', body: 'Activez l’audio seulement s’il appartient au fichier de livraison.', icon: 'audio' },
        { title: 'Image source verrouillée', body: 'Gardez produit, cadrage et composition stables en image-to-video.', icon: 'image' },
        { title: 'Prêt livraison', body: 'À réserver aux plans approuvés où le détail 4K justifie le coût.', icon: 'shield' },
      ];
    }
    if (locale === 'es') {
      return [
        { title: 'Masters 4K nativos', body: `Mira renders finales posibles con ${modelName}.`, icon: 'maximize' },
        { title: 'Recrear un master', body: 'Abre la app con Kling 3 4K y reutiliza el prompt aprobado.', icon: 'zap' },
        { title: 'Audio opcional', body: 'Activa audio solo cuando pertenece al archivo final.', icon: 'audio' },
        { title: 'Imagen fuente bloqueada', body: 'Mantén producto, encuadre y composición estables en image-to-video.', icon: 'image' },
        { title: 'Listo para entrega', body: 'Úsalo en tomas aprobadas donde el detalle 4K justifica el coste.', icon: 'shield' },
      ];
    }
    return [
      { title: 'Native 4K masters', body: `See final delivery renders possible with ${modelName}.`, icon: 'maximize' },
      { title: 'Recreate a master', body: 'Open the app with Kling 3 4K and reuse the approved prompt.', icon: 'zap' },
      { title: 'Optional audio', body: 'Turn audio on only when it belongs in the delivery file.', icon: 'audio' },
      { title: 'Locked source image', body: 'Keep product, framing and composition stable in image-to-video.', icon: 'image' },
      { title: 'Delivery ready', body: 'Reserved for approved shots where 4K detail justifies the cost.', icon: 'shield' },
    ];
  }

  if (isKling3StandardRoute(engineSlug)) {
    if (locale === 'fr') {
      return [
        { title: 'Brouillons storyboard', body: `Voyez les tests multi-plans possibles avec ${modelName}.`, icon: 'sparkles' },
        { title: 'Recréer une variante', body: 'Ouvrez l’app avec Kling 3 Standard et réutilisez le setup.', icon: 'zap' },
        { title: 'Audio on/off', body: 'Testez avec audio natif ou gardez le brouillon silencieux.', icon: 'audio' },
        { title: 'Image source + fin', body: 'Ancrez le sujet avec une image source et une fin optionnelle.', icon: 'image' },
        { title: 'Passage Pro', body: 'Montez les directions validées vers Pro pour plus de fidélité.', icon: 'shield' },
      ];
    }
    if (locale === 'es') {
      return [
        { title: 'Borradores storyboard', body: `Mira pruebas multi-shot posibles con ${modelName}.`, icon: 'sparkles' },
        { title: 'Recrear una variante', body: 'Abre la app con Kling 3 Standard y reutiliza el setup.', icon: 'zap' },
        { title: 'Audio on/off', body: 'Prueba con audio nativo o mantén el borrador sin sonido.', icon: 'audio' },
        { title: 'Imagen fuente + final', body: 'Ancla el sujeto con imagen fuente y frame final opcional.', icon: 'image' },
        { title: 'Pasar a Pro', body: 'Mueve direcciones aprobadas a Pro para más fidelidad.', icon: 'shield' },
      ];
    }
    return [
      { title: 'Storyboard drafts', body: `See multi-shot tests possible with ${modelName}.`, icon: 'sparkles' },
      { title: 'Recreate a variant', body: 'Open the app with Kling 3 Standard and reuse the setup.', icon: 'zap' },
      { title: 'Audio on/off', body: 'Test with native audio or keep the draft silent for post.', icon: 'audio' },
      { title: 'Source + end frame', body: 'Anchor the subject with a source image and optional end frame.', icon: 'image' },
      { title: 'Move to Pro', body: 'Move approved directions to Pro for stronger fidelity.', icon: 'shield' },
    ];
  }

  if (isKling3ProRoute(engineSlug)) {
    if (locale === 'fr') {
      return [
        { title: 'Rendus Pro contrôlés', body: `Voyez les séquences premium possibles avec ${modelName}.`, icon: 'sparkles' },
        { title: 'Recréer un rendu', body: 'Ouvrez l’app avec Kling 3 Pro et réutilisez la configuration.', icon: 'zap' },
        { title: 'Audio + voix', body: 'Utilisez audio natif, lip sync et voice IDs quand le plan le demande.', icon: 'audio' },
        { title: 'Elements + end frame', body: 'Stabilisez sujet, produit et landing avec Elements et image finale.', icon: 'image' },
        { title: 'Passe qualité', body: 'Gardez Pro pour les shots où fidélité et stabilité comptent.', icon: 'shield' },
      ];
    }
    if (locale === 'es') {
      return [
        { title: 'Renders Pro controlados', body: `Mira secuencias premium posibles con ${modelName}.`, icon: 'sparkles' },
        { title: 'Recrear un render', body: 'Abre la app con Kling 3 Pro y reutiliza la configuración.', icon: 'zap' },
        { title: 'Audio + voces', body: 'Usa audio nativo, lip sync y voice IDs cuando la toma lo necesite.', icon: 'audio' },
        { title: 'Elements + frame final', body: 'Estabiliza sujeto, producto y landing con Elements y frame final.', icon: 'image' },
        { title: 'Pasada de calidad', body: 'Reserva Pro para tomas donde importen fidelidad y estabilidad.', icon: 'shield' },
      ];
    }
    return [
      { title: 'Controlled Pro renders', body: `See premium sequences possible with ${modelName}.`, icon: 'sparkles' },
      { title: 'Recreate a render', body: 'Open the app with Kling 3 Pro and reuse the setup.', icon: 'zap' },
      { title: 'Audio + voices', body: 'Use native audio, lip sync and voice IDs when the shot needs it.', icon: 'audio' },
      { title: 'Elements + end frame', body: 'Stabilize subject, product and landing frame with Elements.', icon: 'image' },
      { title: 'Quality pass', body: 'Use Pro when fidelity and stability matter more than draft cost.', icon: 'shield' },
    ];
  }

  if (locale === 'fr') {
    return [
      { title: 'Rendus communautaires', body: `Voyez ce qui est possible avec ${modelName}.`, icon: 'sparkles' },
      { title: 'Recréer un plan', body: 'Ouvrez l’app en un clic et réutilisez la configuration.', icon: 'zap' },
      { title: 'Audio natif', body: 'Dialogue, ambiance et SFX générés en synchro.', icon: 'audio' },
      { title: 'Continuité multi-plans', body: 'Gardez personnages, style et scène cohérents.', icon: 'users' },
      { title: 'Prêt pour la production', body: 'Garde-fous et filtres intégrés.', icon: 'shield' },
    ];
  }

  if (locale === 'es') {
    return [
      { title: 'Resultados reales', body: `Mira qué es posible con ${modelName}.`, icon: 'sparkles' },
      { title: 'Recrear una toma', body: 'Abre la app con un clic y reutiliza la configuración.', icon: 'zap' },
      { title: 'Audio nativo', body: 'Diálogo, ambiente y efectos de sonido generados en sincronía.', icon: 'audio' },
      { title: 'Continuidad entre tomas', body: 'Mantiene personajes, estilo y escena consistentes.', icon: 'users' },
      { title: 'Listo para producción', body: 'Controles de seguridad y filtros integrados.', icon: 'shield' },
    ];
  }

  return [
    { title: 'Real community renders', body: `See what's possible with ${modelName}.`, icon: 'sparkles' },
    { title: 'Recreate any shot', body: 'Jump into the app with one click and reuse the setup.', icon: 'zap' },
    { title: 'Native audio', body: 'Dialogue, ambience and SFX generated in sync.', icon: 'audio' },
    { title: 'Multi-shot continuity', body: 'Keep characters, style and scene consistency across sequences.', icon: 'users' },
    { title: 'Production-aware', body: 'Built-in guardrails and safety filters for responsible review.', icon: 'shield' },
  ];
}

function getLegacyImageFallbackContentItems(
  engineSlug: string,
  locale: AppLocale,
): NonNullable<ModelExamplesContent['fallbackItems']> {
  const isNanoBanana2 = engineSlug === 'nano-banana-2';
  const isNanoBananaLite = engineSlug === 'nano-banana-lite';
  const isNanoBanana = engineSlug === 'nano-banana';
  const isSeedreamPro = engineSlug === 'seedream-5-0-pro';
  const isSeedream = engineSlug === 'seedream';
  const isGptImage2 = engineSlug === 'gpt-image-2';
  const examples: Array<readonly [DecisionExampleFilterId, string, string, string, string]> = isNanoBananaLite
    ? locale === 'fr'
      ? [
          ['campaign', 'Concept street 1K', 'Draft 1K', '1K', 'Concept Nano Banana Lite dynamique pour exploration sociale rapide'],
          ['edit', 'Edit veste local', 'Edit', '1K edit', 'Edit Nano Banana Lite qui transforme la tenue tout en gardant pose et sujet'],
          ['reference', 'Remix de références', 'Références', '14 refs max', 'Remix Nano Banana Lite guidé par portrait, matière et ambiance'],
          ['batch', 'Board de variantes', 'Variantes', '4 drafts', 'Board Nano Banana Lite de quatre directions visuelles rapides'],
        ]
      : locale === 'es'
        ? [
            ['campaign', 'Concepto street 1K', 'Draft 1K', '1K', 'Concepto Nano Banana Lite dinámico para exploración social rápida'],
            ['edit', 'Edit local de chaqueta', 'Edit', '1K edit', 'Edit Nano Banana Lite que transforma la ropa manteniendo pose y sujeto'],
            ['reference', 'Remix de referencias', 'Referencias', '14 refs max', 'Remix Nano Banana Lite guiado por retrato, material y ambiente'],
            ['batch', 'Board de variantes', 'Variantes', '4 drafts', 'Board Nano Banana Lite con cuatro direcciones visuales rápidas'],
          ]
        : [
            ['campaign', 'Fast street concept', '1K draft', '1K', 'Nano Banana Lite dynamic street concept for rapid social exploration'],
            ['edit', 'Local jacket edit', 'Edit', '1K edit', 'Nano Banana Lite edit changing the jacket while preserving pose and subject'],
            ['reference', 'Reference remix portrait', 'References', '14 refs max', 'Nano Banana Lite remix guided by portrait, material, and mood references'],
            ['batch', 'Variant concept board', 'Variants', '4 drafts', 'Nano Banana Lite four-direction visual exploration board'],
          ]
    : isSeedreamPro
    ? locale === 'fr'
      ? [
          ['infographic', 'Infographie ville énergie', 'Infographie', '4K', 'Infographie Seedream 5.0 Pro dense sur un district énergie propre'],
          ['campaign', 'Still campagne cinématique', 'Campagne', '4K', 'Still campagne Seedream 5.0 Pro avec composition commerciale premium'],
          ['edit', 'Composite multi-références', 'Edit', '10 refs max', 'Composite Seedream 5.0 Pro fusionnant sujet, décor, matière et mood'],
          ['final', 'Frame prêt vidéo', 'Frame final', '4K', 'Frame Seedream 5.0 Pro prêt à servir de source pour animation Seedance'],
        ]
      : locale === 'es'
        ? [
            ['infographic', 'Infografía ciudad energía', 'Infografía', '4K', 'Infografía Seedream 5.0 Pro densa sobre un distrito de energía limpia'],
            ['campaign', 'Still de campaña cinematográfico', 'Campaña', '4K', 'Still Seedream 5.0 Pro con composición comercial premium'],
            ['edit', 'Composite multi-referencia', 'Edit', '10 refs max', 'Composite Seedream 5.0 Pro que une sujeto, entorno, material y mood'],
            ['final', 'Frame listo para video', 'Frame final', '4K', 'Frame Seedream 5.0 Pro listo como fuente para animación Seedance'],
          ]
        : [
            ['infographic', 'Clean-energy city infographic', 'Infographic', '4K', 'Seedream 5.0 Pro dense clean-energy district infographic'],
            ['campaign', 'Cinematic campaign still', 'Campaign', '4K', 'Seedream 5.0 Pro premium commercial campaign composition'],
            ['edit', 'Multi-reference composite', 'Edit', '10 refs max', 'Seedream 5.0 Pro composite merging subject, setting, material, and mood references'],
            ['final', 'Video-ready keyframe', 'Final frame', '4K', 'Seedream 5.0 Pro source frame prepared for Seedance animation'],
          ]
    : isSeedream
    ? locale === 'fr'
      ? [
          ['product', 'Still produit de référence', 'Produit · 2K', '2K', 'Still produit Seedream préparé comme référence propre'],
          ['character', 'Planche personnage', 'Personnage', '2-10 refs', 'Planche Seedream avec plusieurs vues cohérentes du même personnage'],
          ['edit', 'Retouche image propre', 'Edit', 'Image edit', 'Retouche Seedream qui préserve forme, logo et proportions'],
          ['batch', 'Batch storyboard', 'Batch', '4 images', 'Batch Seedream de quatre images cohérentes pour storyboard'],
        ]
      : locale === 'es'
        ? [
            ['product', 'Still de producto', 'Producto · 2K', '2K', 'Still de producto Seedream preparado como referencia limpia'],
            ['character', 'Hoja de personaje', 'Personaje', '2-10 refs', 'Hoja Seedream con varias vistas coherentes del mismo personaje'],
            ['edit', 'Edición limpia', 'Edit', 'Image edit', 'Edición Seedream que conserva forma, logo y proporciones'],
            ['batch', 'Batch storyboard', 'Batch', '4 imágenes', 'Batch Seedream de cuatro imágenes coherentes para storyboard'],
          ]
        : [
            ['product', 'Product reference still', 'Product · 2K', '2K', 'Seedream product still prepared as a clean reference image'],
            ['character', 'Character reference sheet', 'Character', '2-10 refs', 'Seedream sheet with consistent views of the same character'],
            ['edit', 'Clean image edit', 'Edit', 'Image edit', 'Seedream edit preserving shape, logo and proportions'],
            ['batch', 'Storyboard batch', 'Batch', '4 images', 'Seedream four-image storyboard batch'],
          ]
    : isLumaUni1Route(engineSlug)
    ? locale === 'fr'
      ? [
          ['product', 'Still produit 2K', 'Produit', '2K · 16:9', 'Packshot Luma Uni-1 avec lumiere studio simple'],
          ['edit', 'Edit image source', 'Edit', 'Image edit', 'Edit Luma Uni-1 qui garde la forme produit et change le mood studio'],
          ['reference', 'Still guide par references', 'References', '2 refs', 'Still Luma Uni-1 guide par produit et reference mood'],
          ['campaign', 'Recherche direction visuelle', 'Direction', '1:1', 'Still Luma Uni-1 pour explorer une direction retail'],
        ]
      : locale === 'es'
        ? [
            ['product', 'Still de producto 2K', 'Producto', '2K · 16:9', 'Packshot Luma Uni-1 con luz de estudio simple'],
            ['edit', 'Edit de imagen fuente', 'Edit', 'Image edit', 'Edit Luma Uni-1 que conserva forma de producto y cambia mood de estudio'],
            ['reference', 'Still guiado por referencias', 'Referencias', '2 refs', 'Still Luma Uni-1 guiado por producto y referencia de mood'],
            ['campaign', 'Investigacion visual', 'Direccion', '1:1', 'Still Luma Uni-1 para explorar una direccion retail'],
          ]
        : [
            ['product', '2K product still', 'Product', '2K · 16:9', 'Luma Uni-1 clean product still with simple studio light'],
            ['edit', 'Source image edit', 'Edit', 'Image edit', 'Luma Uni-1 edit preserving product shape while changing studio tone'],
            ['reference', 'Reference-led still', 'References', '2 refs', 'Luma Uni-1 still guided by product and mood references'],
            ['campaign', 'Visual research still', 'Direction', '1:1', 'Luma Uni-1 retail research still for product direction'],
          ]
    : isLumaUni1MaxRoute(engineSlug)
    ? locale === 'fr'
      ? [
          ['product', 'Packshot haute fidelite', 'Produit', '2K · 3:2', 'Packshot skincare Luma Uni-1 Max avec detail premium'],
          ['typography', 'Poster texte lisible', 'Typographie', 'Poster', 'Poster Luma Uni-1 Max avec titre NIGHT GARDEN lisible'],
          ['edit', 'Edit produit detaille', 'Edit', 'Image edit', 'Edit Luma Uni-1 Max avec matiere et contours plus nets'],
          ['reference', 'Still campagne reference', 'References', '2 refs', 'Still Luma Uni-1 Max guide par produit et mood campagne'],
        ]
      : locale === 'es'
        ? [
            ['product', 'Packshot de alta fidelidad', 'Producto', '2K · 3:2', 'Packshot skincare Luma Uni-1 Max con detalle premium'],
            ['typography', 'Poster con texto legible', 'Tipografia', 'Poster', 'Poster Luma Uni-1 Max con titular NIGHT GARDEN legible'],
            ['edit', 'Edit de producto detallado', 'Edit', 'Image edit', 'Edit Luma Uni-1 Max con material y bordes mas nitidos'],
            ['reference', 'Still de campana con referencia', 'Referencias', '2 refs', 'Still Luma Uni-1 Max guiado por producto y mood de campana'],
          ]
        : [
            ['product', 'High-fidelity product still', 'Product', '2K · 3:2', 'Luma Uni-1 Max premium skincare product still'],
            ['typography', 'Readable poster concept', 'Typography', 'Poster', 'Luma Uni-1 Max poster with readable NIGHT GARDEN headline'],
            ['edit', 'Detailed product edit', 'Edit', 'Image edit', 'Luma Uni-1 Max edit improving material realism and edge detail'],
            ['reference', 'Campaign reference still', 'References', '2 refs', 'Luma Uni-1 Max launch still guided by product and mood references'],
          ]
    : isNanoBanana2
    ? locale === 'fr'
      ? [
          ['grounded', 'Scène produit guidée', 'Guidé · 1K', '1K', 'Image Nano Banana 2 guidée par contexte pour un lancement produit'],
          ['edit', 'Edit produit contrôlé', 'Edit', 'Edit', 'Retouche produit Nano Banana 2 avec contraintes de conservation'],
          ['reference', 'Edit multi-références', 'Références', 'Refs', 'Image Nano Banana 2 assemblant plusieurs références produit'],
          ['wide', 'Still large 4K', 'Ratio large', '4K · 21:9', 'Still Nano Banana 2 en format large 4K'],
        ]
      : locale === 'es'
        ? [
            ['grounded', 'Escena de producto guiada', 'Guiado · 1K', '1K', 'Imagen Nano Banana 2 guiada por contexto para lanzamiento de producto'],
            ['edit', 'Edit controlado de producto', 'Edit', 'Edit', 'Edición de producto Nano Banana 2 con restricciones claras'],
            ['reference', 'Edit multi-referencia', 'Referencias', 'Refs', 'Imagen Nano Banana 2 que combina varias referencias de producto'],
            ['wide', 'Still amplio 4K', 'Ratio amplio', '4K · 21:9', 'Still Nano Banana 2 en formato amplio 4K'],
          ]
        : [
            ['grounded', 'Grounded product scene', 'Grounded · 1K', '1K', 'Nano Banana 2 grounded product launch image'],
            ['edit', 'Controlled product edit', 'Edit', 'Edit', 'Nano Banana 2 product edit with keep-and-change constraints'],
            ['reference', 'Multi-reference edit', 'References', 'Refs', 'Nano Banana 2 image combining multiple product references'],
            ['wide', 'Wide-ratio 4K still', 'Wide ratio', '4K · 21:9', 'Nano Banana 2 wide 4K still image'],
          ]
    : isGptImage2
    ? locale === 'fr'
      ? [
          ['product', 'Packshot produit texte', 'Produit', '1024x768 · High', 'Packshot GPT Image 2 avec label produit lisible'],
          ['typography', 'Poster typographique', 'Texte lisible', '4K', 'Poster GPT Image 2 avec hiérarchie typographique nette'],
          ['ui', 'Mockup UI', 'UI', '1920x1080', 'Mockup d’écran GPT Image 2 avec interface lisible'],
          ['edit', 'Retouche produit', 'Edit image', 'Auto', 'Retouche GPT Image 2 qui préserve produit et label'],
          ['mask', 'Edit guidé par masque', 'Masque', 'Mask URL', 'Retouche GPT Image 2 limitée à une zone masquée'],
          ['final', 'Hero still 4K', 'Final', '3840x2160', 'Still hero GPT Image 2 en 4K avec détails produit nets'],
        ]
      : locale === 'es'
        ? [
            ['product', 'Still de producto con texto', 'Producto', '1024x768 · High', 'Still GPT Image 2 con etiqueta de producto legible'],
            ['typography', 'Póster tipográfico', 'Texto legible', '4K', 'Póster GPT Image 2 con jerarquía tipográfica clara'],
            ['ui', 'Mockup UI', 'UI', '1920x1080', 'Mockup de pantalla GPT Image 2 con interfaz legible'],
            ['edit', 'Edición de producto', 'Edit de imagen', 'Auto', 'Edición GPT Image 2 que conserva producto y etiqueta'],
            ['mask', 'Edit con máscara', 'Máscara', 'Mask URL', 'Edición GPT Image 2 limitada a una zona con máscara'],
            ['final', 'Hero still 4K', 'Final', '3840x2160', 'Still hero GPT Image 2 en 4K con detalle de producto nítido'],
          ]
        : [
            ['product', 'Product still with text', 'Product', '1024x768 · High', 'GPT Image 2 product still with readable packaging label'],
            ['typography', 'Readable typography poster', 'Readable text', '4K', 'GPT Image 2 poster with crisp typography hierarchy'],
            ['ui', 'UI mockup', 'UI', '1920x1080', 'GPT Image 2 app screen mockup with readable interface copy'],
            ['edit', 'Controlled product edit', 'Image edit', 'Auto', 'GPT Image 2 edit preserving product shape and label'],
            ['mask', 'Mask-guided edit', 'Mask edit', 'Mask URL', 'GPT Image 2 edit constrained to a masked region'],
            ['final', '4K hero still', 'Final', '3840x2160', 'GPT Image 2 4K hero still with sharp product details'],
          ]
    : isNanoBanana
    ? locale === 'fr'
      ? [
          ['campaign', 'Concept thumbnail rapide', 'Brouillon', '16:9', 'Concept visuel Nano Banana pour miniature social'],
          ['typography', 'Promo simple lisible', 'Typographie', '1:1', 'Image Nano Banana avec message promotionnel court'],
          ['reference', 'Remix de référence', 'Référence', '4:3', 'Remix Nano Banana guidé par une référence visuelle'],
          ['final', 'Batch de variantes', 'Batch', '4 variantes', 'Quatre variantes Nano Banana pour exploration rapide'],
        ]
      : locale === 'es'
        ? [
            ['campaign', 'Concepto thumbnail rápido', 'Borrador', '16:9', 'Concepto visual Nano Banana para miniatura social'],
            ['typography', 'Promo simple legible', 'Tipografía', '1:1', 'Imagen Nano Banana con mensaje promocional corto'],
            ['reference', 'Remix con referencia', 'Referencia', '4:3', 'Remix Nano Banana guiado por una referencia visual'],
            ['final', 'Batch de variantes', 'Batch', '4 variantes', 'Cuatro variantes Nano Banana para exploración rápida'],
          ]
        : [
            ['campaign', 'Fast thumbnail concept', 'Draft', '16:9', 'Nano Banana visual concept for a social thumbnail'],
            ['typography', 'Simple promo still', 'Typography', '1:1', 'Nano Banana still with short readable promo copy'],
            ['reference', 'Reference remix', 'Reference', '4:3', 'Nano Banana remix guided by a visual reference'],
            ['final', 'Batch concept grid', 'Batch', '4 variants', 'Nano Banana four-variant exploration grid'],
          ]
    : locale === 'fr'
      ? [
          ['campaign', 'Visuel campagne 2K', 'Campagne', '2K', 'Image campagne Nano Banana Pro avec layout publicitaire'],
          ['typography', 'Poster typographique', 'Typographie', '4K', 'Poster Nano Banana Pro avec typographie lisible'],
          ['reference', 'Retouche référence', 'Référence', 'Edit', 'Retouche produit Nano Banana Pro guidée par référence'],
          ['final', 'Final 2K vers 4K', 'Final 4K', '4K', 'Asset campagne Nano Banana Pro finalisé en 4K'],
        ]
      : locale === 'es'
        ? [
            ['campaign', 'Still de campaña 2K', 'Campaña', '2K', 'Imagen de campaña Nano Banana Pro con layout publicitario'],
            ['typography', 'Póster tipográfico', 'Tipografía', '4K', 'Póster Nano Banana Pro con tipografía legible'],
            ['reference', 'Edición con referencia', 'Referencia', 'Edit', 'Edición de producto Nano Banana Pro guiada por referencia'],
            ['final', 'Final 2K a 4K', 'Final 4K', '4K', 'Asset de campaña Nano Banana Pro finalizado en 4K'],
          ]
        : [
            ['campaign', '2K campaign still', 'Campaign', '2K', 'Nano Banana Pro campaign image with ad layout'],
            ['typography', 'Typography poster', 'Typography', '4K', 'Nano Banana Pro poster with readable typography'],
            ['reference', 'Reference edit', 'Reference edit', 'Edit', 'Nano Banana Pro product edit guided by references'],
            ['final', '2K to 4K final', '4K final', '4K', 'Nano Banana Pro campaign asset finalized in 4K'],
          ];

  return examples.map(([tag, title, category, resolution, alt]) => ({
    id: tag,
    title,
    category,
    aspectRatio: resolution,
    alt,
    tags: [tag],
  }));
}

export function buildLegacyModelExamplesContent(
  input: BuildLegacyModelExamplesContentInput,
): ModelExamplesContent {
  const modelName = resolveExamplesModelName(input.copy);
  const recreateLabel = input.copy.recreateLabel ?? (
    input.imageFallbackActive
      ? input.locale === 'fr'
        ? 'Recréer ce still →'
        : input.locale === 'es'
          ? 'Recrear este still →'
          : 'Recreate this still →'
      : null
  );
  return {
    modelSlug: input.modelSlug,
    section: {
      title: input.copy.galleryTitle ?? getFallbackExamplesTitle(input.locale, modelName),
      intro: input.copy.galleryIntro ?? getFallbackExamplesIntro(input.locale, modelName),
      defaultCtaLabel: input.copy.galleryAllCta,
      recreateLabel,
    },
    filters: getDecisionExampleFilters(input.locale, input.imageFallbackActive, input.modelSlug),
    proofItems: getDecisionExampleProofItems(
      input.locale,
      modelName,
      input.imageFallbackActive,
      input.modelSlug,
    ).map(({ title, body, icon }, index) => ({ id: `proof-${index + 1}`, title, body, icon })),
    fallbackItems: input.imageFallbackActive
      ? getLegacyImageFallbackContentItems(input.modelSlug, input.locale)
      : null,
  };
}
