import type { AppLocale } from '@/i18n/locales';
import type { PrepLinksSection } from '../_components/ModelPrepLinksSection';

const NANO_BANANA_MODEL_SLUGS = new Set(['nano-banana', 'nano-banana-pro', 'nano-banana-2', 'gpt-image-2']);
const VIDEO_PREP_MODEL_SLUGS = new Set(['veo-3-1', 'kling-3-pro', 'happy-horse-1-1', 'happy-horse-1-0', 'sora-2-pro', 'ltx-2-3-pro', 'ltx-2-3-fast']);
const gptImagePrepLinks = {
  en: [{ href: '/tools/character-builder', label: 'Build a reusable character reference' }, { href: '/tools/angle', label: 'Change the viewpoint before the edit' }, { href: '/app/image?engine=gpt-image-2', label: 'Open GPT Image 2' }],
  fr: [{ href: '/tools/character-builder', label: 'Créer une référence personnage réutilisable' }, { href: '/tools/angle', label: "Changer le point de vue avant l'edit" }, { href: '/app/image?engine=gpt-image-2', label: 'Ouvrir GPT Image 2' }],
  es: [{ href: '/tools/character-builder', label: 'Crear una referencia de personaje reutilizable' }, { href: '/tools/angle', label: 'Cambiar el punto de vista antes del edit' }, { href: '/app/image?engine=gpt-image-2', label: 'Abrir GPT Image 2' }],
};

export function buildModelPrepLinksSection(modelSlug: string, locale: AppLocale): PrepLinksSection | null {
  if (modelSlug === 'gpt-image-2') {
    if (locale === 'fr') {
      return {
        eyebrow: 'Avant de générer',
        title: 'Préparez la source avant le rendu GPT Image 2',
        body: 'Si le rendu a besoin d’un produit, d’un texte ou d’un masque fiable, préparez la source avant de lancer GPT Image 2.',
        links: gptImagePrepLinks.fr,
      };
    }
    if (locale === 'es') {
      return {
        eyebrow: 'Antes de generar',
        title: 'Prepara la fuente antes del render GPT Image 2',
        body: 'Si el render necesita producto, texto o máscara confiable, prepara la fuente antes de lanzar GPT Image 2.',
        links: gptImagePrepLinks.es,
      };
    }
    return {
      eyebrow: 'Before you generate',
      title: 'Prepare the source before the GPT Image 2 render',
      body: 'If the render needs a reliable product source, exact text or a mask, prepare that input before launching GPT Image 2.',
      links: gptImagePrepLinks.en,
    };
  }

  const isNanoBananaFamily = NANO_BANANA_MODEL_SLUGS.has(modelSlug);
  const isVideoPrepModel = VIDEO_PREP_MODEL_SLUGS.has(modelSlug);

  if (!isNanoBananaFamily && !isVideoPrepModel) {
    return null;
  }

  if (locale === 'fr') {
    return isNanoBananaFamily
      ? {
          eyebrow: 'Avant de générer',
          title: 'Préparez la référence avant l’edit',
          body: 'Si l’image a d’abord besoin d’une référence personnage réutilisable ou d’un meilleur angle, réglez ça avant Nano Banana.',
          links: [
            { href: '/tools/character-builder', label: 'Créer une référence personnage réutilisable' },
            { href: '/tools/angle', label: "Changer le point de vue avant l'edit" },
            { href: '/app/image', label: 'Ouvrir Image' },
          ],
        }
      : {
          eyebrow: 'Avant de générer',
          title: 'Préparez le frame avant la vidéo',
          body: 'Verrouillez le personnage, corrigez l’angle ou construisez l’image source avant de dépenser des crédits en motion.',
          links: [
            { href: '/tools/character-builder', label: 'Conserver le même personnage' },
            { href: '/tools/angle', label: 'Changer l’angle de caméra avant la vidéo' },
            { href: '/app/image', label: "Construire l'image source dans Image" },
          ],
        };
  }

  if (locale === 'es') {
    return isNanoBananaFamily
      ? {
          eyebrow: 'Antes de generar',
          title: 'Prepara la referencia antes del edit',
          body: 'Si la imagen primero necesita una referencia de personaje reutilizable o un mejor ángulo, resuélvelo antes de Nano Banana.',
          links: [
            { href: '/tools/character-builder', label: 'Crear una referencia de personaje reutilizable' },
            { href: '/tools/angle', label: 'Cambiar el punto de vista antes del edit' },
            { href: '/app/image', label: 'Abrir Image' },
          ],
        }
      : {
          eyebrow: 'Antes de generar',
          title: 'Prepara el frame antes del video',
          body: 'Fija el personaje, corrige el ángulo o construye la imagen base antes de gastar créditos en motion.',
          links: [
            { href: '/tools/character-builder', label: 'Mantener el mismo personaje' },
            { href: '/tools/angle', label: 'Cambiar el ángulo de cámara antes del video' },
            { href: '/app/image', label: 'Construir la imagen base en Image' },
          ],
        };
  }

  return isNanoBananaFamily
    ? {
        eyebrow: 'Before you generate',
        title: 'Build the reference before the edit',
        body: 'If the still needs a reusable character reference or a better viewpoint first, solve that before Nano Banana.',
        links: [
          { href: '/tools/character-builder', label: 'Build a reusable character reference' },
          { href: '/tools/angle', label: 'Change the viewpoint before the edit' },
          { href: '/app/image', label: 'Open Image' },
        ],
      }
    : {
        eyebrow: 'Before you generate',
        title: 'Prepare the frame before video',
        body: 'Lock the character, fix the viewpoint, or build the source still before you spend credits on motion.',
        links: [
          { href: '/tools/character-builder', label: 'Keep the character consistent' },
          { href: '/tools/angle', label: 'Change the camera angle before video' },
          { href: '/app/image', label: 'Build the source still in Image' },
        ],
      };
}
