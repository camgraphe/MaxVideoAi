export function referenceRoleHelpCopy(locale: string) {
  return locale === 'fr' ? {
    label: 'À propos de',
    image: { title: 'Images', description: 'Guident les sujets, le style et la composition.' },
    video: { title: 'Vidéos', description: 'Guident les mouvements et le style visuel.' },
    audio: { title: 'Audio', description: 'Guide le son, le rythme ou la voix, selon le modèle.' },
    start: { title: 'Image de début', description: 'Définit l’image d’ouverture du clip.' },
    end: { title: 'Image de fin', description: 'Définit l’image de clôture du clip.' },
    guide: { title: 'Image guide', description: 'Une image guide unique pour modifier la vidéo. Utilisez-la à la place des images clés.' },
    source: { title: 'Vidéo source', description: 'Le clip à modifier ou à prolonger, selon le mode choisi.' },
  } : locale === 'es' ? {
    label: 'Acerca de',
    image: { title: 'Imágenes', description: 'Guían los sujetos, el estilo y la composición.' },
    video: { title: 'Vídeos', description: 'Guían el movimiento y el estilo visual.' },
    audio: { title: 'Audio', description: 'Guía el sonido, el ritmo o la voz, según el modelo.' },
    start: { title: 'Imagen inicial', description: 'Define la imagen de apertura del clip.' },
    end: { title: 'Imagen final', description: 'Define la imagen de cierre del clip.' },
    guide: { title: 'Imagen guía', description: 'Una sola imagen guía para modificar el vídeo. Úsala en lugar de los fotogramas clave.' },
    source: { title: 'Vídeo fuente', description: 'El clip que se modifica o amplía, según el modo elegido.' },
  } : {
    label: 'About',
    image: { title: 'Images', description: 'Guide subjects, style and composition.' },
    video: { title: 'Videos', description: 'Guide motion and visual style.' },
    audio: { title: 'Audio', description: 'Guides sound, rhythm or voice, depending on the model.' },
    start: { title: 'Start image', description: 'Sets the opening image of your clip.' },
    end: { title: 'End image', description: 'Sets the closing image of your clip.' },
    guide: { title: 'Guide frame', description: 'A single guide image for modifying the video. Use it instead of multiple keyframes.' },
    source: { title: 'Source video', description: 'The clip to modify or extend in the selected mode.' },
  };
}
