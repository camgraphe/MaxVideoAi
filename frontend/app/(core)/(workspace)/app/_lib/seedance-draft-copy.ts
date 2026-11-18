const COPY = {
  en: {
    enable: 'Enable Draft · 480p → final 1080p or 4K',
    tooltip: 'Prepare a Draft in 480p, then choose to finalize in 1080p or 4K. Two separately paid generations.',
    previewUnavailable: 'Draft generation is not enabled in this local preview.',
    generated: 'Draft ready',
    locked: 'Duration, ratio and audio are retained for the final 1080p or 4K. Start a new Draft to change these settings.',
    lockTitle: 'Settings retained for final 1080p or 4K',
    selected: 'Draft: a first version in 480p. If you like it, finalize in 1080p or 4K for an extra charge. Two separate generations.',
    inactive: 'Enable Draft to prepare a 480p version you can finalize in 1080p or 4K. A standard 480p video does not support this finalization.',
    prototype: 'Local prototype · no generation or billing · regular prices shown for reference; Draft and final prices are pending validation.',
  },
  fr: {
    enable: 'Activer Draft · 480p → final 1080p ou 4K',
    tooltip: 'Préparez une première version en Draft 480p, puis choisissez de la finaliser en 1080p ou 4K. Deux générations payantes distinctes.',
    previewUnavailable: 'La génération Draft n’est pas activée dans cette prévisualisation locale.',
    generated: 'Draft généré',
    locked: 'Durée, format et audio conservés pour le final 1080p ou 4K. « Nouveau Draft » permet de changer ces réglages.',
    lockTitle: 'Réglages conservés pour le final 1080p ou 4K',
    selected: 'Draft : première version en 480p. Si elle vous convient, finalisez-la en 1080p ou 4K avec un supplément. Deux générations distinctes.',
    inactive: 'Activez Draft pour préparer une version 480p à finaliser ensuite en 1080p ou 4K. Une vidéo 480p classique ne permet pas cette finalisation.',
    prototype: 'Prototype local · aucune génération ni facturation · prix classiques de référence, tarifs Draft et final à valider.',
  },
  es: {
    enable: 'Activar Draft · 480p → final 1080p o 4K',
    tooltip: 'Prepara un Draft en 480p y después elige finalizarlo en 1080p o 4K. Dos generaciones con cobros separados.',
    previewUnavailable: 'La generación Draft no está activada en esta vista previa local.',
    generated: 'Draft listo',
    locked: 'Se conservan la duración, el formato y el audio para el final 1080p o 4K. Inicia un nuevo Draft para cambiar estos ajustes.',
    lockTitle: 'Ajustes conservados para el final 1080p o 4K',
    selected: 'Draft: una primera versión en 480p. Si te gusta, finalízala en 1080p o 4K con un cargo adicional. Dos generaciones distintas.',
    inactive: 'Activa Draft para preparar una versión 480p que podrás finalizar en 1080p o 4K. Un vídeo 480p estándar no permite esta finalización.',
    prototype: 'Prototipo local · sin generación ni cobros · precios normales de referencia; precios de Draft y final pendientes de validación.',
  },
} as const;

export function getSeedanceDraftCopy(locale: string) {
  const language = locale.toLowerCase().split('-')[0];
  return language === 'fr' || language === 'es' ? COPY[language] : COPY.en;
}
