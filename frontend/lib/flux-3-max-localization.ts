import type { EngineInputField } from '@/types/engines';

const COPY: Record<string, Record<string, [string, string]>> = {
  en: {
    reference_image_urls: ['Keyframe images', 'Place 1–10 images on the timeline. Each image guides the video at its chosen position.'],
    keyframe_indexes: ['Keyframe positions', 'Unique frame positions in image order, from 0 through duration × 24 inclusive.'],
    reasoning_level: ['Reasoning level', 'High is the provider default; low is also available.'],
    resolution: ['Resolution', '720p or upscaled 1080p output.'],
    image_url: ['Opening image', 'PNG, JPEG or WebP. Add an optional end image to guide the final frame.'],
    start_image_url: ['Start image', 'PNG, JPEG or WebP. Guides the first frame.'],
    end_image_url: ['End image', 'PNG, JPEG or WebP. Guides the final frame.'],
    generate_audio: ['Generate audio', 'Enabled by default. Turn off for silent video.'],
    seed: ['Seed', 'Optional integer for reproducibility.'],
  },
  fr: {
    reference_image_urls: ['Images clés', 'Placez 1 à 10 images sur la timeline. Chaque image guide la vidéo au moment choisi.'],
    keyframe_indexes: ['Positions des images clés', 'Positions uniques dans l’ordre des images, de 0 à durée × 24 inclus.'],
    reasoning_level: ['Niveau de raisonnement', 'High est la valeur par défaut du fournisseur ; low est également disponible.'],
    resolution: ['Résolution', 'Sortie en 720p ou en 1080p mise à l’échelle.'],
    image_url: ['Image de départ', 'PNG, JPEG ou WebP. Ajoutez une image de fin facultative pour guider la dernière image.'],
    start_image_url: ['Image de départ', 'PNG, JPEG ou WebP. Guide la première image.'],
    end_image_url: ['Image de fin', 'PNG, JPEG ou WebP. Guide la dernière image.'],
    generate_audio: ['Générer l’audio', 'Activé par défaut. Désactivez pour une vidéo silencieuse.'],
    seed: ['Seed', 'Entier facultatif pour la reproductibilité.'],
  },
  es: {
    reference_image_urls: ['Fotogramas clave', 'Coloca de 1 a 10 imágenes en la línea de tiempo. Cada imagen guía el vídeo en el momento elegido.'],
    keyframe_indexes: ['Posiciones de fotogramas clave', 'Posiciones únicas en el orden de las imágenes, de 0 a duración × 24 inclusive.'],
    reasoning_level: ['Nivel de razonamiento', 'High es el valor predeterminado del proveedor; low también está disponible.'],
    resolution: ['Resolución', 'Salida en 720p o 1080p reescalado.'],
    image_url: ['Imagen inicial', 'PNG, JPEG o WebP. Añade una imagen final opcional para guiar el último fotograma.'],
    start_image_url: ['Imagen inicial', 'PNG, JPEG o WebP. Guía el primer fotograma.'],
    end_image_url: ['Imagen final', 'PNG, JPEG o WebP. Guía el último fotograma.'],
    generate_audio: ['Generar audio', 'Activado de forma predeterminada. Desactívalo para crear un vídeo silencioso.'],
    seed: ['Semilla', 'Entero opcional para reproducibilidad.'],
  },
};

export function localizeFlux3MaxField(field: EngineInputField, locale: string, engineId?: string): EngineInputField {
  if (engineId !== 'flux-3-max') return field;
  const copy = (COPY[locale] ?? COPY.en)[field.id];
  return copy ? { ...field, label: copy[0], description: copy[1] } : field;
}
