import type { BestForCtaCopy, HubCopy } from './ai-video-engines-copy-types';

export const ES_HUB_COPY: HubCopy = {
    hero: {
      eyebrow: 'Comparar motores',
      title: 'Comparar motores de video con IA',
      intro:
        'Elige dos motores y abre una comparativa lado a lado con un clic. Usa este hub para revisar matchups útiles, filtrar por límites clave y validar precios antes de generar. Cubre texto a video, imagen a video y video a video, y te guía al motor más adecuado para tu toma.',
      compareNow: {
        left: 'Motor A',
        right: 'Motor B',
        compare: 'Comparar motores',
        searchPlaceholder: 'Buscar motor...',
        noResults: 'Sin resultados',
        strengthsLabel: 'Fortalezas',
        strengthsFallback: 'Uso general de video',
        modeLabels: {
          t2v: 'Texto a video',
          i2v: 'Imagen a video',
          v2v: 'Video a video',
        },
      },
    },
    sections: {
      popularTitle: 'Comparativas populares',
      popularIntro: 'Selección balanceada de matchups solicitados entre las principales familias de motores.',
      useCasesTitle: 'Comparar por objetivo',
      useCasesIntro: 'Elige un objetivo y abre una comparativa recomendada.',
      enginesTitle: 'Elegir motores para comparar',
      enginesIntro: 'Solo especificaciones útiles para comparar. El detalle completo queda en cada página de modelo.',
      enginesToggle: 'Mostrar catálogo de motores ({count})',
      enginesToggleHintClosed: 'Abrir lista',
      enginesToggleHintOpen: 'Ocultar lista',
      allComparisonsTitle: 'Todas las comparativas',
      allComparisonsIntro:
        'Primero verás comparativas estratégicas, luego podrás buscar en el catálogo canónico completo. ¿Necesitas cumplimiento? Revisa nuestras notas.',
      faqTitle: 'FAQ de comparativas de motores de video con IA',
      complianceLabel: 'Ver notas de cumplimiento',
      quickStartLabel: 'Acceso rápido',
      prelaunchSpotlightLabel: 'Enfoque de prelanzamiento',
      prelaunchModelLabel: 'Perfil de Seedance 2.0',
      prelaunchCompareLabel: 'Seedance 2.0 vs Sora 2',
      prelaunchCompareSecondaryLabel: 'Pika 2.2 vs Seedance 2.0',
      useCasesFallback:
        'Los chips interactivos ajustan recomendaciones al instante. Todos los enlaces siguen siendo rastreables y visibles en HTML estándar.',
    },
    tagLabels: {
      audio: 'Audio',
      cinematic: 'Cinemático',
      quality: 'Mejor calidad',
      long: 'Larga duración',
      ads: 'Ads',
      product: 'Producto',
      value: 'Mejor costo',
      general: 'General',
      i2v: 'Imagen a video',
      social: 'Social',
      fast: 'Rápido',
      storyboards: 'Storyboards',
    },
    useCaseLabels: {
      cinematic: 'Cinemático',
      ads: 'Ads',
      social: 'Social',
      product: 'Producto',
      storyboards: 'Storyboards',
      audio: 'Audio',
      'no-audio': 'Sin audio',
      'best-value': 'Mejor costo',
      'best-quality': 'Mejor calidad',
      'text-to-video': 'Texto a video',
      'image-to-video': 'Imagen a video',
      'video-to-video': 'Video a video',
    },
    popularCompareLabel: 'Comparar',
    catalogLabels: {
      sortAll: 'Todos',
      toggles: {
        includeWaitlistEarlyAccess: 'Incluir waitlist / acceso anticipado',
      },
      filters: {
        mode: 'Modo',
        audio: 'Audio',
        duration: 'Duración',
        resolution: 'Resolución',
        status: 'Estado',
        provider: 'Proveedor',
        clear: 'Limpiar filtros',
      },
      options: {
        all: 'Todos',
        modeT2v: 'Texto a video',
        modeI2v: 'Imagen a video',
        modeV2v: 'Video a video',
        audioOn: 'Audio',
        audioOff: 'Sin audio',
        durationShort: '< 8s',
        durationMedium: '8-11s',
        durationLong: '12s+',
        resolution720: '720p+',
        resolution1080: '1080p+',
        resolution4k: '4K',
        statusLive: 'Live',
        statusEarly: 'Acceso anticipado',
      },
      specs: {
        modes: 'Modos',
        audio: 'Audio',
        status: 'Estado',
        duration: 'Duración máx',
        resolution: 'Resolución máx',
        yes: 'Sí',
        no: 'No',
        unknown: 'Sin dato',
        secondsSuffix: 's',
        statusLive: 'Live',
        statusEarly: 'Acceso anticipado',
      },
      ctas: {
        model: 'Página del modelo',
        compare: 'Comparar vs',
      },
      empty: 'No hay motores para estos filtros.',
    },
    listLabels: {
      searchPlaceholder: 'Buscar comparativas...',
      loadMore: 'Ver más',
      empty: 'No hay comparativas para esta búsqueda.',
    },
    faq: [
      {
        question: '¿Cómo comparo dos motores rápidamente?',
        answer:
          'Usa el widget Comparar de la parte superior, elige Motor A y Motor B, y haz clic en Comparar para abrir la página canónica. Usa el mismo prompt (o un prompt de texto simple) en ambos modelos de IA para comparar consistencia de movimiento y fidelidad al prompt antes de generar.',
      },
      {
        question: '¿Por qué cambian las fortalezas entre comparativas?',
        answer:
          'Cada modelo equilibra distinto velocidad, fidelidad al prompt, realismo de movimiento, duración y audio. Estas compensaciones explican por qué comparar el modelo de video con IA antes de generar videos ahorra tiempo y costo.',
      },
      {
        question: '¿Se pueden comparar motores de texto a video e imagen a video?',
        answer:
          'Sí. El hub incluye matchups mixtos para comparar motores orientados a texto, imagen o ambos. Sí - también puedes incluir motores de video a video cuando estén disponibles.',
      },
      {
        question: '¿Cómo elegir entre dos motores muy parecidos?',
        answer:
          'Empieza con los chips de objetivo y valida con una prueba lado a lado. Si hay empate, ejecuta el mismo prompt de texto simple (o la misma imagen de referencia) y prioriza fidelidad al prompt, consistencia de movimiento y velocidad de entrega para tu formato final.',
      },
    ],
  };

export const ES_BEST_FOR_CTA: BestForCtaCopy = {
    title: '¿Necesitas una recomendación en lugar de un duelo?',
    body: 'Abre las guías Mejor para y elige por objetivo: cine, referencias, anuncios, UGC, 4K y secuencias multi-shot.',
    label: 'Ver guías Mejor para',
  };
