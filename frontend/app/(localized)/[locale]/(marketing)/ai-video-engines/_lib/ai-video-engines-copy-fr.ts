import type { BestForCtaCopy, HubCopy } from './ai-video-engines-copy-types';

export const FR_HUB_COPY: HubCopy = {
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
  };

export const FR_BEST_FOR_CTA: BestForCtaCopy = {
    title: 'Besoin d’une recommandation plutôt que d’un duel ?',
    body: 'Ouvrez les guides Best-for pour choisir par cas d’usage : cinéma, références, ads, UGC, 4K et séquences multi-shot.',
    label: 'Voir les guides Best-for',
  };
