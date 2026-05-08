import type { AppLocale } from '@/i18n/locales';
import type { EnginesCatalog } from '../EnginesCatalog.client';
import type { ComparisonsDirectory } from '../ComparisonsDirectory.client';

export type HubFaqEntry = {
  question: string;
  answer: string;
};

export type HubCopy = {
  hero: {
    eyebrow: string;
    title: string;
    intro: string;
    compareNow: {
      left: string;
      right: string;
      compare: string;
      searchPlaceholder: string;
      noResults: string;
      strengthsLabel: string;
      strengthsFallback: string;
      modeLabels: Record<string, string>;
    };
  };
  sections: {
    popularTitle: string;
    popularIntro: string;
    useCasesTitle: string;
    useCasesIntro: string;
    enginesTitle: string;
    enginesIntro: string;
    enginesToggle: string;
    enginesToggleHintClosed: string;
    enginesToggleHintOpen: string;
    allComparisonsTitle: string;
    allComparisonsIntro: string;
    faqTitle: string;
    complianceLabel: string;
    quickStartLabel: string;
    prelaunchSpotlightLabel: string;
    prelaunchModelLabel: string;
    prelaunchCompareLabel: string;
    prelaunchCompareSecondaryLabel: string;
    useCasesFallback: string;
  };
  tagLabels: Record<string, string>;
  useCaseLabels: Record<string, string>;
  popularCompareLabel: string;
  catalogLabels: Parameters<typeof EnginesCatalog>[0]['labels'];
  listLabels: Parameters<typeof ComparisonsDirectory>[0]['labels'];
  faq: HubFaqEntry[];
};

export type BestForCtaCopy = {
  title: string;
  body: string;
  label: string;
};

const HUB_COPY: Record<AppLocale, HubCopy> = {
  en: {
    hero: {
      eyebrow: 'Compare engines',
      title: 'Compare AI video engines',
      intro:
        'Pick any two engines and open a side-by-side comparison in one click. Use this hub to scan popular matchups, filter by key limits, and validate pricing before you generate. It covers text-to-video, image-to-video, and video-to-video engines, then routes you to the right fit for your shot.',
      compareNow: {
        left: 'Engine A',
        right: 'Engine B',
        compare: 'Compare engines',
        searchPlaceholder: 'Search engine...',
        noResults: 'No results',
        strengthsLabel: 'Strengths',
        strengthsFallback: 'General purpose video',
        modeLabels: {
          t2v: 'Text-to-video',
          i2v: 'Image-to-video',
          v2v: 'Video-to-video',
        },
      },
    },
    sections: {
      popularTitle: 'Popular comparisons',
      popularIntro: 'A balanced shortlist of frequently requested matchups across the main engine families.',
      useCasesTitle: 'Compare by use case',
      useCasesIntro: 'Pick a goal and open one of the recommended matchups.',
      enginesTitle: 'Pick an engine to compare',
      enginesIntro: 'Compare-focused specs only. Full model guidance stays on each model page.',
      enginesToggle: 'Show engine catalog ({count})',
      enginesToggleHintClosed: 'Click to expand',
      enginesToggleHintOpen: 'Click to collapse',
      allComparisonsTitle: 'All comparisons',
      allComparisonsIntro:
        'Browse strategic matchups first, then search the full canonical catalog. Need policy details? Read our compliance notes.',
      faqTitle: 'AI video engine comparison FAQ',
      complianceLabel: 'Read compliance details',
      quickStartLabel: 'Quick start',
      prelaunchSpotlightLabel: 'Pre-launch spotlight',
      prelaunchModelLabel: 'Seedance 2.0 profile',
      prelaunchCompareLabel: 'Seedance 2.0 vs Sora 2',
      prelaunchCompareSecondaryLabel: 'Pika 2.2 vs Seedance 2.0',
      useCasesFallback: 'Interactive chips refine recommendations instantly. All links remain crawlable and available in plain HTML.',
    },
    tagLabels: {
      audio: 'Audio',
      cinematic: 'Cinematic',
      quality: 'Best quality',
      long: 'Long duration',
      ads: 'Ads',
      product: 'Product',
      value: 'Best value',
      general: 'General use',
      i2v: 'Image-to-video',
      social: 'Social',
      fast: 'Fast',
      storyboards: 'Storyboards',
    },
    useCaseLabels: {
      cinematic: 'Cinematic',
      ads: 'Ads',
      social: 'Social',
      product: 'Product',
      storyboards: 'Storyboards',
      audio: 'Audio',
      'no-audio': 'No audio',
      'best-value': 'Best value',
      'best-quality': 'Best quality',
      'text-to-video': 'Text-to-video',
      'image-to-video': 'Image-to-video',
      'video-to-video': 'Video-to-video',
    },
    popularCompareLabel: 'Compare',
    catalogLabels: {
      sortAll: 'All',
      toggles: {
        includeWaitlistEarlyAccess: 'Include waitlist / early access',
      },
      filters: {
        mode: 'Mode',
        audio: 'Audio',
        duration: 'Duration',
        resolution: 'Resolution',
        status: 'Status',
        provider: 'Provider',
        clear: 'Clear filters',
      },
      options: {
        all: 'All',
        modeT2v: 'Text-to-video',
        modeI2v: 'Image-to-video',
        modeV2v: 'Video-to-video',
        audioOn: 'Audio',
        audioOff: 'No audio',
        durationShort: '< 8s',
        durationMedium: '8-11s',
        durationLong: '12s+',
        resolution720: '720p+',
        resolution1080: '1080p+',
        resolution4k: '4K',
        statusLive: 'Live',
        statusEarly: 'Early access',
      },
      specs: {
        modes: 'Modes',
        audio: 'Audio',
        status: 'Status',
        duration: 'Max duration',
        resolution: 'Max resolution',
        yes: 'Yes',
        no: 'No',
        unknown: 'Unknown',
        secondsSuffix: 's',
        statusLive: 'Live',
        statusEarly: 'Early access',
      },
      ctas: {
        model: 'Model page',
        compare: 'Compare vs',
      },
      empty: 'No engines match these filters.',
    },
    listLabels: {
      searchPlaceholder: 'Search comparisons...',
      loadMore: 'Load more',
      empty: 'No comparisons match this search.',
    },
    faq: [
      {
        question: 'How do I compare two AI video engines quickly?',
        answer:
          'Use the Compare Now widget at the top of the page, choose Engine A and Engine B, then click Compare to open the canonical matchup page. Use the same prompt (or simple text prompt) across both AI models to compare motion consistency and prompt fidelity before you generate.',
      },
      {
        question: 'Why do some comparisons show different strengths?',
        answer:
          'Each model trades off speed, prompt fidelity, motion realism, duration, and audio support differently. The best choice depends on the specific shot and deadline. These tradeoffs are why comparing the AI video model before you generate videos saves time and cost.',
      },
      {
        question: 'Can I compare text-to-video and image-to-video engines together?',
        answer:
          'Yes. The hub includes mixed-mode matchups so you can compare engines that prioritize text prompts, image inputs, or both. Yes - you can also include video-to-video engines when available.',
      },
      {
        question: 'How should I choose between two close engines?',
        answer:
          'Start with the use case chips, then validate with a direct side-by-side test. For tie-breaks, run the same simple text prompt (or reference image) and prioritize prompt fidelity, motion consistency, and turnaround speed for your delivery format.',
      },
    ],
  },
  fr: {
    hero: {
      eyebrow: 'Comparer les modèles',
      title: 'Comparatifs de modèles vidéo IA',
      intro:
        'Choisissez deux modèles et ouvrez un comparatif côte à côte en un clic. Utilisez ce hub pour repérer les duels utiles, filtrer sur les limites clés et valider le prix avant de générer. Il couvre texte-vers-vidéo, image-vers-vidéo et vidéo-vers-vidéo, puis vous oriente vers le modèle le plus adapté à votre plan.',
      compareNow: {
        left: 'Modèle A',
        right: 'Modèle B',
        compare: 'Comparer les modèles',
        searchPlaceholder: 'Rechercher un modèle...',
        noResults: 'Aucun résultat',
        strengthsLabel: 'Points forts',
        strengthsFallback: 'Usage général vidéo',
        modeLabels: {
          t2v: 'Texte-vers-vidéo',
          i2v: 'Image-vers-vidéo',
          v2v: 'Vidéo-vers-vidéo',
        },
      },
    },
    sections: {
      popularTitle: 'Comparatifs populaires',
      popularIntro: 'Une sélection équilibrée des duels les plus demandés entre familles de modèles.',
      useCasesTitle: 'Comparer par cas d’usage',
      useCasesIntro: 'Choisissez un objectif, puis ouvrez un comparatif recommandé.',
      enginesTitle: 'Choisir un modèle à comparer',
      enginesIntro: 'Spécifications orientées comparaison uniquement. Le détail éditorial reste sur les pages modèles.',
      enginesToggle: 'Afficher le catalogue modèles ({count})',
      enginesToggleHintClosed: 'Cliquer pour déplier',
      enginesToggleHintOpen: 'Cliquer pour replier',
      allComparisonsTitle: 'Tous les comparatifs',
      allComparisonsIntro:
        'Parcourez d’abord les comparatifs prioritaires, puis cherchez dans le catalogue canonique complet. Besoin de conformité? Consultez nos notes dédiées.',
      faqTitle: 'FAQ comparatif des modèles vidéo IA',
      complianceLabel: 'Voir les notes de conformité',
      quickStartLabel: 'Accès rapide',
      prelaunchSpotlightLabel: 'Focus pré-lancement',
      prelaunchModelLabel: 'Profil Seedance 2.0',
      prelaunchCompareLabel: 'Seedance 2.0 vs Sora 2',
      prelaunchCompareSecondaryLabel: 'Pika 2.2 vs Seedance 2.0',
      useCasesFallback:
        'Les puces interactives affinent les recommandations instantanément. Tous les liens restent crawlables et présents en HTML standard.',
    },
    tagLabels: {
      audio: 'Audio',
      cinematic: 'Cinématique',
      quality: 'Qualité',
      long: 'Longue durée',
      ads: 'Publicité',
      product: 'Produit',
      value: 'Meilleur coût',
      general: 'Généraliste',
      i2v: 'Image-vers-vidéo',
      social: 'Social',
      fast: 'Rapide',
      storyboards: 'Storyboards',
    },
    useCaseLabels: {
      cinematic: 'Cinématique',
      ads: 'Publicité',
      social: 'Social',
      product: 'Produit',
      storyboards: 'Storyboards',
      audio: 'Audio',
      'no-audio': 'Sans audio',
      'best-value': 'Meilleur coût',
      'best-quality': 'Meilleure qualité',
      'text-to-video': 'Texte-vers-vidéo',
      'image-to-video': 'Image-vers-vidéo',
      'video-to-video': 'Vidéo-vers-vidéo',
    },
    popularCompareLabel: 'Comparer',
    catalogLabels: {
      sortAll: 'Tous',
      toggles: {
        includeWaitlistEarlyAccess: 'Inclure liste d’attente / accès anticipé',
      },
      filters: {
        mode: 'Mode',
        audio: 'Audio',
        duration: 'Durée',
        resolution: 'Résolution',
        status: 'Statut',
        provider: 'Fournisseur',
        clear: 'Effacer les filtres',
      },
      options: {
        all: 'Tous',
        modeT2v: 'Texte-vers-vidéo',
        modeI2v: 'Image-vers-vidéo',
        modeV2v: 'Vidéo-vers-vidéo',
        audioOn: 'Audio',
        audioOff: 'Sans audio',
        durationShort: '< 8s',
        durationMedium: '8-11s',
        durationLong: '12s+',
        resolution720: '720p+',
        resolution1080: '1080p+',
        resolution4k: '4K',
        statusLive: 'Disponible',
        statusEarly: 'Accès anticipé',
      },
      specs: {
        modes: 'Modes',
        audio: 'Audio',
        status: 'Statut',
        duration: 'Durée max',
        resolution: 'Résolution max',
        yes: 'Oui',
        no: 'Non',
        unknown: 'Inconnu',
        secondsSuffix: 's',
        statusLive: 'Disponible',
        statusEarly: 'Accès anticipé',
      },
      ctas: {
        model: 'Page modèle',
        compare: 'Comparer avec',
      },
      empty: 'Aucun modèle ne correspond à ces filtres.',
    },
    listLabels: {
      searchPlaceholder: 'Rechercher un comparatif...',
      loadMore: 'Voir plus',
      empty: 'Aucun comparatif ne correspond à la recherche.',
    },
    faq: [
      {
        question: 'Comment comparer deux modèles rapidement ?',
        answer:
          'Utilisez le module Comparer en haut de page, choisissez Modèle A et Modèle B, puis cliquez sur Comparer pour ouvrir la page canonique. Utilisez le même prompt (ou un prompt texte simple) sur les deux modèles IA pour comparer la régularité du mouvement et la fidélité au prompt avant de générer.',
      },
      {
        question: 'Pourquoi les points forts changent selon les comparatifs ?',
        answer:
          'Chaque modèle fait des compromis différents sur vitesse, fidélité au prompt, réalisme du mouvement, durée et audio. Ces compromis expliquent pourquoi comparer le modèle vidéo IA avant de générer des vidéos fait gagner du temps et du budget.',
      },
      {
        question: 'Peut-on comparer des modèles texte-vers-vidéo et image-vers-vidéo ?',
        answer:
          'Oui. L’espace inclut des duels mixtes pour comparer des modèles orientés prompt texte, image, ou hybrides. Vous pouvez aussi inclure les modèles vidéo-vers-vidéo quand ils sont disponibles.',
      },
      {
        question: 'Comment trancher entre deux modèles proches ?',
        answer:
          'Commencez par les puces de cas d’usage, puis validez avec un test côte à côte. En cas d’égalité, lancez le même prompt texte simple (ou la même image de référence) et priorisez la fidélité au prompt, la régularité du mouvement et la vitesse de livraison selon votre format.',
      },
    ],
  },
  es: {
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
  },
};

export function getHubCopy(locale: AppLocale): HubCopy {
  return HUB_COPY[locale] ?? HUB_COPY.en;
}

const BEST_FOR_CTA_BY_LOCALE: Record<AppLocale, BestForCtaCopy> = {
  en: {
    title: 'Need a recommendation instead of a matchup?',
    body: 'Open the Best-for guides for use-case rankings across cinematics, references, ads, UGC, 4K, and multi-shot sequences.',
    label: 'Browse Best-for guides',
  },
  fr: {
    title: 'Besoin d’une recommandation plutôt que d’un duel ?',
    body: 'Ouvrez les guides Best-for pour choisir par cas d’usage : cinéma, références, ads, UGC, 4K et séquences multi-shot.',
    label: 'Voir les guides Best-for',
  },
  es: {
    title: '¿Necesitas una recomendación en lugar de un duelo?',
    body: 'Abre las guías Mejor para y elige por objetivo: cine, referencias, anuncios, UGC, 4K y secuencias multi-shot.',
    label: 'Ver guías Mejor para',
  },
};

export function getBestForCta(locale: AppLocale): BestForCtaCopy {
  return BEST_FOR_CTA_BY_LOCALE[locale] ?? BEST_FOR_CTA_BY_LOCALE.en;
}
