import type { AppLocale } from '@/i18n/locales';

type PricingHubCopy = {
  liveQuote: string;
  noExactRoute: string;
  priceCellCheapest: string;
  quote: {
    audioOff: string;
    audioIncluded: string;
    audioOptional: string;
    audioUnavailable: string;
    audio: string;
    unsupported: string;
    silent: string;
    dedicated: string;
    fast: string;
    supported: string;
    optional: string;
    sampleRequired: string;
    appPresets: string;
    square: string;
    portrait: string;
    landscape: string;
    maxDuration: (seconds: number) => string;
    minDuration: (seconds: number) => string;
    durationsOnly: (seconds: number[]) => string;
    resolutionOnly: (resolution: string) => string;
    resolutionUnavailable: (resolution: string) => string;
    fourKNote: (seconds: number) => string;
    perSecond: (price: string) => string;
  };
  links: {
    model: string;
    examples: string;
    compare: string;
    livePrice: string;
    more: string;
    imageApp: string;
    audioApp: string;
    tool: string;
    viewRow: string;
    imagePricing: string;
    audioPricing: string;
    toolPricing: string;
  };
  video: {
    ariaTabs: string;
    title: string;
    intro: string;
    currencyLabel: string;
    cheapestCurrentGen: string;
    tableHeaders: {
      engine: string;
      caps: string;
      actions: string;
    };
    tabs: {
      video: string;
      image: string;
      audio: string;
      tools: string;
    };
    presetSubLabels: Record<string, string>;
    mobile: {
      title: string;
      viewFullTable: string;
      noExactCurrentGen: string;
      includeLegacy: string;
      previousGen: string;
    };
    groups: {
      recommendedTitle: string;
      recommendedDescription: string;
      legacyTitle: string;
      legacyDescription: string;
    };
    highlights: {
      draftIntent: string;
      detailIntent: string;
      soundIntent: string;
      bestDraft: string;
      cheapest8s: string;
      cheapest10s: string;
      cheapestAudio: string;
      cheapest4k: string;
      dedicated4k: string;
      currentGenCount: string;
      currentGenValue: (count: number) => string;
    };
    globalNote: string;
  };
  popularChecks: {
    title: string;
    columns: {
      priceCheck: string;
      cheapestEngine: string;
      typicalPrice: string;
      link: string;
    };
    rows: {
      draft720: string;
      premium8s: string;
      video1080: string;
      audio1080: string;
      image: string;
      voiceOver: string;
      upscale4k: string;
    };
  };
  otherSurfaces: {
    title: string;
    intro: string;
    imageTitle: string;
    audioTitle: string;
    toolTitle: string;
    imageColumns: {
      engine: string;
      standard: string;
      highQuality: string;
      reference: string;
      sizes: string;
      links: string;
    };
    audioColumns: {
      mode: string;
      thirtySeconds: string;
      sixtySeconds: string;
      oneTwentySeconds: string;
      voiceClone: string;
      links: string;
    };
    toolColumns: {
      tool: string;
      standard: string;
      pro: string;
      bestUsedBefore: string;
      links: string;
    };
  };
  audioModes: {
    musicOnly: string;
    voiceOnly: string;
    cinematic: string;
    cinematicVoice: string;
    voiceClone: string;
  };
  tools: {
    characterBuilderDraft: string;
    characterBuilderFinal: string;
    changeCameraAngle: string;
    generateBestAngles: string;
    imageUpscale: string;
    videoUpscale: string;
    imageToVideoReferences: string;
    finalCharacterReferences: string;
    imageToVideoSetup: string;
    storyboardCoverage: string;
    imageToVideoSourceCleanup: string;
    finalExport: string;
  };
  creditsRefunds: {
    creditNotes: { title: string; items: Array<{ title: string; body: string }>; links: { termsHref: string; terms: string; refunds: string; support: string; studio: string } };
    title: string;
    intro: string;
    cards: Array<{
      title: string;
      body: string;
      link?: {
        href: '/pay-as-you-go-ai-video-generator';
        label: string;
      };
    }>;
  };
};

function formatSeconds(locale: AppLocale, seconds: number) {
  return locale === 'en' ? `${seconds}s` : `${seconds} s`;
}

const en: PricingHubCopy = {
  liveQuote: 'Live quote',
  noExactRoute: 'No exact route',
  priceCellCheapest: 'Cheapest',
  quote: {
    audioOff: 'Audio off',
    audioIncluded: 'audio incl.',
    audioOptional: 'audio opt.',
    audioUnavailable: 'no audio',
    audio: 'audio',
    unsupported: 'unsupported',
    silent: 'silent',
    dedicated: 'dedicated',
    fast: 'fast',
    supported: 'Supported',
    optional: 'Optional',
    sampleRequired: 'Sample required',
    appPresets: 'App presets',
    square: 'Square',
    portrait: 'Portrait',
    landscape: 'Landscape',
    maxDuration: (seconds) => `max ${formatSeconds('en', seconds)}`,
    minDuration: (seconds) => `min ${formatSeconds('en', seconds)}`,
    durationsOnly: (seconds) => `${seconds.join('/')}s`,
    resolutionOnly: (resolution) => `${resolution} only`,
    resolutionUnavailable: (resolution) => `no ${resolution}`,
    fourKNote: (seconds) => `${formatSeconds('en', seconds)} 4K`,
    perSecond: (price) => `${price}/s`,
  },
  links: {
    model: 'Model',
    examples: 'Examples',
    compare: 'Compare',
    livePrice: 'Live price',
    more: 'More',
    imageApp: 'Image app',
    audioApp: 'Audio app',
    tool: 'Tool',
    viewRow: 'View row',
    imagePricing: 'Image pricing',
    audioPricing: 'Audio pricing',
    toolPricing: 'Tool pricing',
  },
  video: {
    ariaTabs: 'Pricing surfaces',
    title: 'AI video prices by engine',
    intro:
      'Compare preset MaxVideoAI total prices for common video scenarios. Unsupported combinations are marked clearly. Open the app for the exact live quote before generation.',
    currencyLabel: 'Prices shown in USD credits.',
    cheapestCurrentGen: 'Cheapest current-gen',
    tableHeaders: { engine: 'Engine', caps: 'Caps', actions: 'Actions' },
    tabs: { video: 'Video', image: 'Image', audio: 'Audio', tools: 'Tools & Upscale' },
    presetSubLabels: {
      'entry-route': 'Native',
      '5s-720p': 'Draft',
      '10s-720p': 'Preview',
      '8s-1080p': 'Premium',
      '10s-1080p': 'Standard',
      '10s-1080p-audio': 'Narrative',
      '4k-route': 'Native / route',
    },
    mobile: {
      title: 'Compare by scenario',
      viewFullTable: 'View full table',
      noExactCurrentGen: 'No exact route for current-generation engines.',
      includeLegacy: 'Include previous-generation routes',
      previousGen: 'previous-gen',
    },
    groups: {
      recommendedTitle: 'Recommended video engines',
      recommendedDescription: 'Current-generation and recommended routes for new generations.',
      legacyTitle: 'Previous-generation and budget routes',
      legacyDescription: 'Older or budget routes that may still be useful for low-cost tests.',
    },
    highlights: {
      draftIntent: 'Try a short idea',
      detailIntent: 'Give the scene more room',
      soundIntent: 'Create a scene with sound',
      bestDraft: 'Cheapest current-gen 5s 720p',
      cheapest8s: 'Cheapest current-gen 8s 1080p',
      cheapest10s: 'Cheapest current-gen 10s 1080p',
      cheapestAudio: 'Cheapest current-gen 10s 1080p + audio',
      cheapest4k: 'Cheapest 4K output',
      dedicated4k: 'Dedicated 4K engine',
      currentGenCount: 'Current-gen engines available',
      currentGenValue: (count) => `${count} engines`,
    },
    globalNote:
      'Prices are current MaxVideoAI display prices for preset scenarios. Open the app for the exact live price before each generation, including provider limits, duration rounding and job-level rounding.',
  },
  popularChecks: {
    title: 'Popular price checks',
    columns: {
      priceCheck: 'Price check',
      cheapestEngine: 'Cheapest current-gen option',
      typicalPrice: 'Typical exact price',
      link: 'Link',
    },
    rows: {
      draft720: '5s 720p video',
      premium8s: '8s 1080p premium video',
      video1080: '10s 1080p video',
      audio1080: '10s 1080p + audio',
      image: '1 image generation',
      voiceOver: '30s voice-over',
      upscale4k: '4K upscale',
    },
  },
  otherSurfaces: {
    title: 'Image, audio and tool pricing',
    intro: 'Compact MaxVideoAI price references for image generation, audio generation, character prep, angle tools and upscale.',
    imageTitle: 'Image generation pricing',
    audioTitle: 'Audio pricing',
    toolTitle: 'Prep tools and upscale pricing',
    imageColumns: {
      engine: 'Image engine',
      standard: '1 standard image',
      highQuality: '1 high-quality image',
      reference: 'Image-to-image / reference',
      sizes: 'Sizes / aspect ratios',
      links: 'Links',
    },
    audioColumns: {
      mode: 'Audio mode / provider',
      thirtySeconds: '30s',
      sixtySeconds: '60s',
      oneTwentySeconds: '120s',
      voiceClone: 'Voice clone / sample support',
      links: 'Links',
    },
    toolColumns: {
      tool: 'Tool',
      standard: 'Standard output',
      pro: 'Pro / high-res output',
      bestUsedBefore: 'Best used before',
      links: 'Links',
    },
  },
  audioModes: {
    musicOnly: 'Music Only',
    voiceOnly: 'Voice Over',
    cinematic: 'Cinematic',
    cinematicVoice: 'Cinematic + Voice',
    voiceClone: 'Seed Audio reference voice',
  },
  tools: {
    characterBuilderDraft: 'Character Builder Draft',
    characterBuilderFinal: 'Character Builder Final',
    changeCameraAngle: 'Change Camera Angle',
    generateBestAngles: 'Generate 4 best angles',
    imageUpscale: 'Image Upscale',
    videoUpscale: 'Video Upscale',
    imageToVideoReferences: 'Image-to-video references',
    finalCharacterReferences: 'Final character references',
    imageToVideoSetup: 'Image-to-video setup',
    storyboardCoverage: 'Storyboard coverage',
    imageToVideoSourceCleanup: 'Image-to-video source cleanup',
    finalExport: 'Final export',
  },
  creditsRefunds: {
    creditNotes: {
      "title": "Credit validity before you top up",
      "items": [
        {
          "title": "Purchased media credits",
          "body": "Unused purchased media credits stay in your wallet between projects, with no subscription required. Our current Terms do not specify an expiry period or an inactivity deadline for this balance. Contact support before buying if you need confirmation of a validity period."
        },
        {
          "title": "Promotional, bonus and free credits",
          "body": "These have no cash value and are not refundable. Check the specific offer for its validity conditions; if none are stated, ask support before assuming the media-credit or Studio rules apply."
        },
        {
          "title": "Milo assistance credits",
          "body": "Milo Standard and Max share 500 included assistance credits per UTC calendar month. Unused included credits do not carry over. Purchased Milo packs accumulate without expiry or automatic refill. Each pack purchase is confirmed and funded from your MaxVideoAI wallet. Media generation has its own separate quote. Milo Lite has no extra assistance fee, subject to request limits and service availability."
        }
      ],
      "links": {
        "termsHref": "/legal/terms#wallet-credits",
        "terms": "Wallet terms",
        "refunds": "Refund policy and request procedure",
        "support": "Ask support about credit validity",
        "studio": "Studio assistance"
      }
    },
    title: 'Credits, live quotes and refunds',
    intro: 'Pricing tables are preset references. The app remains the source for job-level live quotes before launch.',
    cards: [
      {
        title: 'Pay-as-you-go credits',
        body: 'Use credits without a required subscription. Starter credits begin at $10, and you can top up when you need more generations.',
        link: {
          href: '/pay-as-you-go-ai-video-generator',
          label: 'How pay-as-you-go credits work',
        },
      },
      {
        title: 'Exact price before launch',
        body: "The app shows the live price for your selected engine, duration, resolution and options before generation, even as a guest. Using Milo in a generator or Studio? Standard and Max share included and purchased assistance credits. Media generation has its own quote. Review both when planning your budget.",
      },
      {
        title: 'Failed generations refunded',
        body: 'Technically failed generations are recredited to your wallet. This is not an automatic card or bank refund. Completed results consume credits even if they disappoint; a new attempt has a new quote. Payment-refund requests are reviewed under the refund policy.',
      },
      {
        title: 'Secure checkout',
        body: 'Payments run through Stripe. Cards, Apple Pay and Google Pay appear when available on your device and browser.',
      },
    ],
  },
};

const fr: PricingHubCopy = {
  ...en,
  liveQuote: 'Devis en direct',
  noExactRoute: 'Aucune route exacte',
  priceCellCheapest: 'Moins cher',
  quote: {
    ...en.quote,
    audioOff: 'Audio désactivé',
    audioIncluded: 'audio incl.',
    audioOptional: 'audio opt.',
    audioUnavailable: 'sans audio',
    audio: 'audio',
    unsupported: 'non pris en charge',
    silent: 'silencieux',
    dedicated: 'dédié',
    fast: 'rapide',
    supported: 'Pris en charge',
    optional: 'Optionnel',
    sampleRequired: 'Échantillon requis',
    appPresets: 'Presets app',
    square: 'Carré',
    portrait: 'Portrait',
    landscape: 'Paysage',
    maxDuration: (seconds) => `max ${formatSeconds('fr', seconds)}`,
    minDuration: (seconds) => `min ${formatSeconds('fr', seconds)}`,
    durationsOnly: (seconds) => seconds.map((second) => formatSeconds('fr', second)).join('/'),
    resolutionOnly: (resolution) => `${resolution} uniquement`,
    resolutionUnavailable: (resolution) => `pas de ${resolution}`,
    fourKNote: (seconds) => `${formatSeconds('fr', seconds)} 4K`,
    perSecond: (price) => `${price}/s`,
  },
  links: {
    ...en.links,
    model: 'Modèle',
    examples: 'Exemples',
    compare: 'Comparer',
    livePrice: 'Prix live',
    more: 'Plus',
    imageApp: 'App image',
    audioApp: 'App audio',
    tool: 'Outil',
    viewRow: 'Voir la ligne',
    imagePricing: 'Prix image',
    audioPricing: 'Prix audio',
    toolPricing: 'Prix outils',
  },
  video: {
    ...en.video,
    ariaTabs: 'Surfaces tarifaires',
    title: 'Prix vidéo IA par moteur',
    intro:
      'Comparez les prix totaux MaxVideoAI pour des scénarios vidéo courants. Les combinaisons non disponibles sont indiquées clairement. Ouvrez l’app pour le devis exact avant génération.',
    currencyLabel: 'Prix affichés en crédits USD.',
    cheapestCurrentGen: 'Moins cher génération actuelle',
    tableHeaders: { engine: 'Moteur', caps: 'Caps', actions: 'Actions' },
    tabs: { video: 'Vidéo', image: 'Image', audio: 'Audio', tools: 'Outils & upscale' },
    presetSubLabels: {
      'entry-route': 'Natif',
      '5s-720p': 'Brouillon',
      '10s-720p': 'Aperçu',
      '8s-1080p': 'Premium',
      '10s-1080p': 'Standard',
      '10s-1080p-audio': 'Narratif',
      '4k-route': 'Natif / route',
    },
    mobile: {
      title: 'Comparer par scénario',
      viewFullTable: 'Voir le tableau complet',
      noExactCurrentGen: 'Aucune route exacte pour les moteurs de génération actuelle.',
      includeLegacy: 'Inclure les routes de génération précédente',
      previousGen: 'ancienne génération',
    },
    groups: {
      recommendedTitle: 'Moteurs vidéo recommandés',
      recommendedDescription: 'Routes de génération actuelle recommandées pour les nouveaux rendus.',
      legacyTitle: 'Routes génération précédente et budget',
      legacyDescription: 'Routes plus anciennes ou budget, encore utiles pour des tests à faible coût.',
    },
    highlights: {
      draftIntent: 'Tester une idée courte',
      detailIntent: 'Développer une scène',
      soundIntent: 'Créer une scène avec du son',
      bestDraft: 'Moins cher actuel 5 s 720p',
      cheapest8s: 'Moins cher actuel 8 s 1080p',
      cheapest10s: 'Moins cher actuel 10 s 1080p',
      cheapestAudio: 'Moins cher actuel 10 s 1080p + audio',
      cheapest4k: 'Sortie 4K la moins chère',
      dedicated4k: 'Moteur 4K dédié',
      currentGenCount: 'Moteurs actuels disponibles',
      currentGenValue: (count) => `${count} moteurs`,
    },
    globalNote:
      'Les prix sont les prix affichés MaxVideoAI pour ces scénarios prédéfinis. Ouvrez l’app pour le prix exact avant chaque génération, avec les limites provider, l’arrondi de durée et l’arrondi par job.',
  },
  popularChecks: {
    title: 'Vérifications de prix fréquentes',
    columns: {
      priceCheck: 'Scénario',
      cheapestEngine: 'Option actuelle la moins chère',
      typicalPrice: 'Prix exact typique',
      link: 'Lien',
    },
    rows: {
      draft720: 'Vidéo 5 s 720p',
      premium8s: 'Vidéo premium 8 s 1080p',
      video1080: 'Vidéo 10 s 1080p',
      audio1080: '10 s 1080p + audio',
      image: '1 image générée',
      voiceOver: 'Voix off 30 s',
      upscale4k: 'Upscale 4K',
    },
  },
  otherSurfaces: {
    title: 'Prix image, audio et outils',
    intro: 'Références compactes MaxVideoAI pour la génération d’images, l’audio, la préparation de personnages, les angles caméra et l’upscale.',
    imageTitle: 'Prix génération d’images',
    audioTitle: 'Prix audio',
    toolTitle: 'Prix outils de préparation et upscale',
    imageColumns: {
      engine: 'Moteur image',
      standard: '1 image standard',
      highQuality: '1 image haute qualité',
      reference: 'Image-vers-image / référence',
      sizes: 'Tailles / ratios',
      links: 'Liens',
    },
    audioColumns: {
      mode: 'Mode audio / provider',
      thirtySeconds: '30 s',
      sixtySeconds: '60 s',
      oneTwentySeconds: '120 s',
      voiceClone: 'Clone voix / échantillon',
      links: 'Liens',
    },
    toolColumns: {
      tool: 'Outil',
      standard: 'Sortie standard',
      pro: 'Sortie pro / haute résolution',
      bestUsedBefore: 'À utiliser avant',
      links: 'Liens',
    },
  },
  audioModes: {
    musicOnly: 'Musique seule',
    voiceOnly: 'Voix off',
    cinematic: 'Cinématique',
    cinematicVoice: 'Cinématique + voix',
    voiceClone: 'Voix de référence Seed Audio',
  },
  tools: {
    characterBuilderDraft: 'Character Builder brouillon',
    characterBuilderFinal: 'Character Builder final',
    changeCameraAngle: 'Changer l’angle caméra',
    generateBestAngles: 'Générer les 4 meilleurs angles',
    imageUpscale: 'Upscale image',
    videoUpscale: 'Upscale vidéo',
    imageToVideoReferences: 'Références image-vers-vidéo',
    finalCharacterReferences: 'Références personnage finales',
    imageToVideoSetup: 'Préparation image-vers-vidéo',
    storyboardCoverage: 'Couverture storyboard',
    imageToVideoSourceCleanup: 'Nettoyage source image-vers-vidéo',
    finalExport: 'Export final',
  },
  creditsRefunds: {
    creditNotes: {
      "title": "Validité des crédits avant de recharger",
      "items": [
        {
          "title": "Crédits média achetés",
          "body": "Les crédits média achetés non utilisés restent dans votre portefeuille entre vos projets, sans abonnement obligatoire. Nos conditions actuelles ne précisent ni durée d’expiration ni délai d’inactivité pour ce solde. Contactez l’assistance avant l’achat si vous avez besoin de confirmer une durée de validité."
        },
        {
          "title": "Crédits promotionnels, bonus et gratuits",
          "body": "Ils n’ont pas de valeur monétaire et ne sont pas remboursables. Consultez les conditions de validité de l’offre ; si elles ne sont pas précisées, contactez l’assistance avant de leur appliquer les règles des crédits média ou de Studio."
        },
        {
          "title": "Crédits d’assistance Milo",
          "body": "Milo Standard et Max partagent 500 crédits d’assistance inclus par mois civil UTC. Les crédits inclus non utilisés ne sont pas reportés. Les packs Milo achetés se cumulent sans expiration ni recharge automatique. Chaque achat de pack est confirmé et financé depuis votre portefeuille MaxVideoAI. La génération média a son propre devis distinct. Milo Lite n’entraîne pas de frais d’assistance supplémentaires, sous réserve des limites de requête et de la disponibilité du service."
        }
      ],
      "links": {
        "termsHref": "/fr/legal/terms#wallet-credits",
        "terms": "Conditions du portefeuille",
        "refunds": "Politique et demande de remboursement (anglais)",
        "support": "Contacter l’assistance sur la validité des crédits",
        "studio": "Assistance Studio"
      }
    },
    title: 'Crédits, devis live et remboursements',
    intro: 'Les tableaux sont des références par scénario. L’app reste la source du devis exact par job avant lancement.',
    cards: [
      {
        title: 'Crédits à l’usage',
        body: 'Utilisez des crédits sans abonnement obligatoire. Les crédits de démarrage commencent à 10 $, et vous rechargez quand vous avez besoin de générer.',
        link: {
          href: '/pay-as-you-go-ai-video-generator',
          label: 'Comprendre les crédits à l’usage',
        },
      },
      {
        title: 'Prix exact avant lancement',
        body: "L’app affiche le prix live selon le moteur, la durée, la résolution et les options sélectionnés avant génération, même en invité. Vous utilisez Milo dans un générateur ou dans Studio ? Standard et Max partagent les crédits d’assistance inclus et achetés. La génération média dispose de son propre devis. Tenez compte des deux dans votre budget.",
      },
      {
        title: 'Échecs remboursés',
        body: 'Les générations en échec technique sont recréditées au portefeuille. Ce n’est pas un remboursement automatique sur carte ou compte bancaire. Un résultat terminé consomme des crédits même s’il déçoit ; un nouvel essai a un nouveau devis. Les demandes de remboursement du paiement sont examinées selon la politique de remboursement.',
      },
      {
        title: 'Paiement sécurisé',
        body: 'Les paiements passent par Stripe. Carte bancaire, Apple Pay et Google Pay s’affichent lorsqu’ils sont disponibles sur votre appareil et votre navigateur.',
      },
    ],
  },
};

const es: PricingHubCopy = {
  ...en,
  liveQuote: 'Precio en vivo',
  noExactRoute: 'Sin ruta exacta',
  priceCellCheapest: 'Más barato',
  quote: {
    ...en.quote,
    audioOff: 'Audio desactivado',
    audioIncluded: 'audio incl.',
    audioOptional: 'audio opc.',
    audioUnavailable: 'sin audio',
    audio: 'audio',
    unsupported: 'no admitido',
    silent: 'silencioso',
    dedicated: 'dedicado',
    fast: 'rápido',
    supported: 'Compatible',
    optional: 'Opcional',
    sampleRequired: 'Muestra requerida',
    appPresets: 'Presets app',
    square: 'Cuadrado',
    portrait: 'Vertical',
    landscape: 'Horizontal',
    maxDuration: (seconds) => `máx. ${formatSeconds('es', seconds)}`,
    minDuration: (seconds) => `mín. ${formatSeconds('es', seconds)}`,
    durationsOnly: (seconds) => seconds.map((second) => formatSeconds('es', second)).join('/'),
    resolutionOnly: (resolution) => `solo ${resolution}`,
    resolutionUnavailable: (resolution) => `sin ${resolution}`,
    fourKNote: (seconds) => `${formatSeconds('es', seconds)} 4K`,
    perSecond: (price) => `${price}/s`,
  },
  links: {
    ...en.links,
    model: 'Modelo',
    examples: 'Ejemplos',
    compare: 'Comparar',
    livePrice: 'Precio vivo',
    more: 'Más',
    imageApp: 'App imagen',
    audioApp: 'App audio',
    tool: 'Herramienta',
    viewRow: 'Ver fila',
    imagePricing: 'Precios imagen',
    audioPricing: 'Precios audio',
    toolPricing: 'Precios herramientas',
  },
  video: {
    ...en.video,
    ariaTabs: 'Superficies de precios',
    title: 'Precios de video IA por motor',
    intro:
      'Compara precios totales de MaxVideoAI para escenarios de video comunes. Las combinaciones no disponibles se marcan claramente. Abre la app para ver el precio exacto antes de generar.',
    currencyLabel: 'Precios mostrados en créditos USD.',
    cheapestCurrentGen: 'Más barato generación actual',
    tableHeaders: { engine: 'Motor', caps: 'Caps', actions: 'Acciones' },
    tabs: { video: 'Video', image: 'Imagen', audio: 'Audio', tools: 'Herramientas & upscale' },
    presetSubLabels: {
      'entry-route': 'Nativa',
      '5s-720p': 'Borrador',
      '10s-720p': 'Vista previa',
      '8s-1080p': 'Premium',
      '10s-1080p': 'Estándar',
      '10s-1080p-audio': 'Narrativo',
      '4k-route': 'Nativo / ruta',
    },
    mobile: {
      title: 'Comparar por escenario',
      viewFullTable: 'Ver tabla completa',
      noExactCurrentGen: 'Sin ruta exacta para motores de generación actual.',
      includeLegacy: 'Incluir rutas de generación anterior',
      previousGen: 'generación anterior',
    },
    groups: {
      recommendedTitle: 'Motores de video recomendados',
      recommendedDescription: 'Rutas de generación actual recomendadas para nuevas generaciones.',
      legacyTitle: 'Rutas de generación anterior y budget',
      legacyDescription: 'Rutas antiguas o budget que aún pueden servir para pruebas de bajo coste.',
    },
    highlights: {
      draftIntent: 'Probar una idea corta',
      detailIntent: 'Dar más espacio a la escena',
      soundIntent: 'Crear una escena con sonido',
      bestDraft: 'Más barato actual 5 s 720p',
      cheapest8s: 'Más barato actual 8 s 1080p',
      cheapest10s: 'Más barato actual 10 s 1080p',
      cheapestAudio: 'Más barato actual 10 s 1080p + audio',
      cheapest4k: 'Salida 4K más barata',
      dedicated4k: 'Motor 4K dedicado',
      currentGenCount: 'Motores actuales disponibles',
      currentGenValue: (count) => `${count} motores`,
    },
    globalNote:
      'Los precios son los precios mostrados por MaxVideoAI para escenarios predefinidos. Abre la app para ver el precio exacto antes de cada generación, incluyendo límites del proveedor, redondeo de duración y redondeo por job.',
  },
  popularChecks: {
    title: 'Consultas de precio frecuentes',
    columns: {
      priceCheck: 'Escenario',
      cheapestEngine: 'Opción actual más barata',
      typicalPrice: 'Precio exacto típico',
      link: 'Enlace',
    },
    rows: {
      draft720: 'Video 5 s 720p',
      premium8s: 'Video premium 8 s 1080p',
      video1080: 'Video 10 s 1080p',
      audio1080: '10 s 1080p + audio',
      image: '1 imagen generada',
      voiceOver: 'Voz en off 30 s',
      upscale4k: 'Upscale 4K',
    },
  },
  otherSurfaces: {
    title: 'Precios de imagen, audio y herramientas',
    intro: 'Referencias compactas de MaxVideoAI para generación de imágenes, audio, preparación de personajes, herramientas de ángulo y upscale.',
    imageTitle: 'Precios de generación de imágenes',
    audioTitle: 'Precios de audio',
    toolTitle: 'Precios de herramientas de prep y upscale',
    imageColumns: {
      engine: 'Motor de imagen',
      standard: '1 imagen estándar',
      highQuality: '1 imagen alta calidad',
      reference: 'Imagen a imagen / referencia',
      sizes: 'Tamaños / ratios',
      links: 'Enlaces',
    },
    audioColumns: {
      mode: 'Modo audio / proveedor',
      thirtySeconds: '30 s',
      sixtySeconds: '60 s',
      oneTwentySeconds: '120 s',
      voiceClone: 'Clon voz / muestra',
      links: 'Enlaces',
    },
    toolColumns: {
      tool: 'Herramienta',
      standard: 'Salida estándar',
      pro: 'Salida pro / alta resolución',
      bestUsedBefore: 'Mejor antes de',
      links: 'Enlaces',
    },
  },
  audioModes: {
    musicOnly: 'Solo música',
    voiceOnly: 'Voz en off',
    cinematic: 'Cinemático',
    cinematicVoice: 'Cinemático + voz',
    voiceClone: 'Voz de referencia Seed Audio',
  },
  tools: {
    characterBuilderDraft: 'Character Builder borrador',
    characterBuilderFinal: 'Character Builder final',
    changeCameraAngle: 'Cambiar ángulo de cámara',
    generateBestAngles: 'Generar los 4 mejores ángulos',
    imageUpscale: 'Upscale de imagen',
    videoUpscale: 'Upscale de video',
    imageToVideoReferences: 'Referencias imagen a video',
    finalCharacterReferences: 'Referencias finales de personaje',
    imageToVideoSetup: 'Preparación imagen a video',
    storyboardCoverage: 'Cobertura storyboard',
    imageToVideoSourceCleanup: 'Limpieza de fuente imagen a video',
    finalExport: 'Export final',
  },
  creditsRefunds: {
    creditNotes: {
      "title": "Validez de los créditos antes de recargar",
      "items": [
        {
          "title": "Créditos de medios comprados",
          "body": "Los créditos de medios comprados y no usados permanecen en tu monedero entre proyectos, sin suscripción obligatoria. Nuestras condiciones actuales no especifican un plazo de caducidad ni de inactividad para este saldo. Contacta con soporte antes de comprar si necesitas confirmar un periodo de validez."
        },
        {
          "title": "Créditos promocionales, de bonificación y gratuitos",
          "body": "No tienen valor en efectivo y no son reembolsables. Consulta las condiciones de validez de la oferta; si no se indican, pregunta a soporte antes de aplicar las reglas de los créditos de medios o de Studio."
        },
        {
          "title": "Créditos de asistencia de Milo",
          "body": "Milo Standard y Max comparten 500 créditos de asistencia incluidos por mes natural UTC. Los créditos incluidos no usados no se acumulan. Los paquetes Milo comprados se acumulan sin caducidad ni recarga automática. Cada compra de paquete se confirma y se financia desde tu monedero MaxVideoAI. La generación de medios tiene su propia cotización. Milo Lite no tiene coste adicional de asistencia, sujeto a límites de solicitudes y disponibilidad del servicio."
        }
      ],
      "links": {
        "termsHref": "/es/legal/terms#wallet-credits",
        "terms": "Condiciones del monedero",
        "refunds": "Política y solicitud de reembolso (inglés)",
        "support": "Consultar la validez con soporte",
        "studio": "Asistencia de Studio"
      }
    },
    title: 'Créditos, precios vivos y reembolsos',
    intro: 'Las tablas son referencias por escenario. La app sigue siendo la fuente del precio exacto por job antes de lanzar.',
    cards: [
      {
        title: 'Créditos de pago por uso',
        body: 'Usa créditos sin suscripción obligatoria. Los créditos iniciales empiezan en $10 y puedes recargar cuando necesites más generaciones.',
        link: {
          href: '/pay-as-you-go-ai-video-generator',
          label: 'Cómo funcionan los créditos por uso',
        },
      },
      {
        title: 'Precio exacto antes de lanzar',
        body: "La app muestra el precio vivo según el motor, la duración, la resolución y las opciones antes de generar, incluso como invitado. ¿Usas Milo en un generador o en Studio? Standard y Max comparten los créditos de asistencia incluidos y comprados. La generación de medios tiene su propia cotización. Ten en cuenta ambos al planificar tu presupuesto.",
      },
      {
        title: 'Fallos reembolsados',
        body: 'Las generaciones con un fallo técnico se abonan de nuevo al monedero. No es un reembolso automático a la tarjeta o cuenta bancaria. Un resultado completado consume créditos aunque decepcione; un nuevo intento tiene una nueva cotización. Las solicitudes de reembolso del pago se revisan según la política de reembolsos.',
      },
      {
        title: 'Pago seguro',
        body: 'Los pagos se procesan con Stripe. Tarjeta, Apple Pay y Google Pay aparecen cuando están disponibles en tu dispositivo y navegador.',
      },
    ],
  },
};

const copyByLocale: Record<AppLocale, PricingHubCopy> = { en, fr, es };

export function getPricingHubCopy(locale: AppLocale) {
  return copyByLocale[locale] ?? en;
}
