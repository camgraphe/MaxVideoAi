import type { AppLocale } from '@/i18n/locales';
import { localePathnames } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';

import type { CopyWithoutPricingScenarios } from './model-page-template-copy';
import { buildCanonicalComparePath, COMPARE_BASE_PATH_MAP } from './model-page-links';

type LocalizedTemplateCopy = Record<AppLocale, Omit<CopyWithoutPricingScenarios, 'pricingCopy'> & {
  pricingCopy: Omit<CopyWithoutPricingScenarios['pricingCopy'], 'ctaHref'>;
}>;

const PRICING_SLUG_MAP = buildSlugMap('pricing');
const GALLERY_SLUG_MAP = buildSlugMap('gallery');
const MODELS_SLUG_MAP = buildSlugMap('models');

function localizedPrefix(locale: AppLocale) {
  const pathname = localePathnames[locale];
  return pathname ? `/${pathname}` : '';
}

function localizedPath(locale: AppLocale, segment: string, suffix = '') {
  return `${localizedPrefix(locale)}/${segment}${suffix}`.replace(/\/{2,}/g, '/');
}

function pricingHref(locale: AppLocale, anchorId: string) {
  const segment = PRICING_SLUG_MAP[locale] ?? PRICING_SLUG_MAP.en;
  return `${localizedPath(locale, segment)}#${anchorId}`;
}

function examplesHref(locale: AppLocale, familySlug: string) {
  const segment = GALLERY_SLUG_MAP[locale] ?? GALLERY_SLUG_MAP.en;
  return localizedPath(locale, segment, `/${familySlug}`);
}

function modelsHref(locale: AppLocale, modelSlug: string) {
  const segment = MODELS_SLUG_MAP[locale] ?? MODELS_SLUG_MAP.en;
  return localizedPath(locale, segment, `/${modelSlug}`);
}

function compareHref(locale: AppLocale, left: string, right: string, orderSlug = left) {
  const compareBase = COMPARE_BASE_PATH_MAP[locale] ?? COMPARE_BASE_PATH_MAP.en;
  return `${localizedPrefix(locale)}${buildCanonicalComparePath({
    compareBase,
    pairSlug: [left, right].sort().join('-vs-'),
    orderSlug,
  })}`.replace(/\/{2,}/g, '/');
}

const VEO_31_FAST_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'GOOGLE FAST VIDEO ROUTE',
      title: 'Veo 3.1 Fast',
      subtitle: 'Faster Veo drafts with optional native audio, first-last frame tests, and short concept loops.',
      subtitleHighlights: ['faster Veo drafts', 'optional native audio', 'first-last frame tests'],
      paragraph:
        'Use Veo 3.1 Fast for quick text-to-video, image-to-video and first-last frame tests when you need lower-cost Veo iteration before moving approved shots into Veo 3.1.',
      primaryCta: { label: 'Generate with Veo 3.1 Fast', href: '/app?engine=veo-3-1-fast' },
      secondaryCta: { label: 'View examples', href: examplesHref('en', 'veo') },
      quickLinks: [
        { label: 'Compare vs Veo 3.1', href: compareHref('en', 'veo-3-1-fast', 'veo-3-1') },
        { label: 'View pricing', href: pricingHref('en', 'veo-3-1-fast-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Veo 3.1 Fast example',
      description: 'Fast Veo draft with optional audio',
      renderLabel: 'View draft',
      badges: ['Fast route', '8s', '1080p'],
      altContext: 'Veo 3.1 Fast short concept draft',
    },
    features: [
      { title: 'Fast Veo drafts', body: 'Test concepts before paying for the main production route.', tone: 'quality' },
      { title: 'Optional audio', body: 'Toggle native audio on when timing or ambience needs a rough pass.', tone: 'audio' },
      { title: 'First-last tests', body: 'Bridge approved opening and ending frames for short motion checks.', tone: 'reference' },
      { title: 'Extend support', body: 'Continue an existing Fast clip when a draft needs a pickup beat.', tone: 'duration' },
      { title: '720p or 1080p', body: 'Choose the exposed MaxVideoAI resolutions before generation.', tone: 'quality' },
      { title: 'Pay-as-you-go', body: 'See exact live price before you generate.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Fast or Veo 3.1?',
        body: 'Use Fast for prompt tests and short concept loops. Use Veo 3.1 when the selected shot needs final polish.',
        cta: { label: 'Compare Veo 3.1 vs Fast', href: compareHref('en', 'veo-3-1-fast', 'veo-3-1') },
      },
      {
        title: 'Testing endings?',
        body: 'Use first-last frames when the opening and final composition are already approved.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Need the cheapest Veo pass?',
        body: 'Compare Fast with Lite when you are choosing between audio control and lower-cost timing tests.',
        cta: { label: 'Compare Fast vs Lite', href: compareHref('en', 'veo-3-1-fast', 'veo-3-1-lite') },
      },
    ],
    referenceWorkflows: [
      { title: 'Text prompt', body: 'Test subject, camera, style and audio direction in one short Veo draft.' },
      { title: 'Start image', body: 'Use one still when framing, product shape or identity should anchor the first frame.' },
      { title: 'First-last frames', body: 'Provide a landing frame when the ending pose or composition matters.' },
      { title: 'Audio toggle', body: 'Turn audio on for rough timing, or off when you only need visual motion.' },
      { title: 'Upgrade path', body: 'Move winning drafts into Veo 3.1 for higher-end production renders.' },
    ],
    pricingCopy: {
      title: 'Veo 3.1 Fast pricing at a glance',
      subtitle: 'Preset draft totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'Up to 1080p',
    },
    meta: {
      title: 'Veo 3.1 Fast: Pricing, Drafts & Examples | MaxVideoAI',
      description:
        'Use Veo 3.1 Fast for faster Veo drafts, optional native audio, first-last frame tests and lower-cost short concept loops before Veo 3.1 finals.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'ROUTE GOOGLE FAST VIDEO',
      title: 'Veo 3.1 Fast',
      subtitle: 'Des brouillons Veo rapides avec audio natif optionnel, tests première-dernière image et boucles courtes.',
      subtitleHighlights: ['brouillons Veo rapides', 'audio natif optionnel', 'tests première-dernière image'],
      paragraph:
        'Utilisez Veo 3.1 Fast pour tester vite en texte-vidéo, image-vidéo et première-dernière image quand vous voulez itérer à moindre coût avant de passer les plans retenus dans Veo 3.1.',
      primaryCta: { label: 'Générer avec Veo 3.1 Fast', href: '/app?engine=veo-3-1-fast' },
      secondaryCta: { label: 'Voir les exemples', href: examplesHref('fr', 'veo') },
      quickLinks: [
        { label: 'Comparer vs Veo 3.1', href: compareHref('fr', 'veo-3-1-fast', 'veo-3-1') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'veo-3-1-fast-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Veo 3.1 Fast',
      description: 'Brouillon Veo rapide avec audio optionnel',
      renderLabel: 'Voir le brouillon',
      badges: ['Fast', '8 s', '1080p'],
      altContext: 'brouillon court Veo 3.1 Fast',
    },
    features: [
      { title: 'Brouillons Veo rapides', body: 'Testez les concepts avant la route de production principale.', tone: 'quality' },
      { title: 'Audio optionnel', body: 'Activez l’audio natif pour tester timing ou ambiance.', tone: 'audio' },
      { title: 'Tests première-dernière', body: 'Reliez deux images approuvées pour contrôler une transition courte.', tone: 'reference' },
      { title: 'Extension', body: 'Prolongez un clip Fast existant quand le brouillon a besoin d’un beat en plus.', tone: 'duration' },
      { title: '720p ou 1080p', body: 'Choisissez les résolutions exposées dans MaxVideoAI avant génération.', tone: 'quality' },
      { title: 'Paiement à l’usage', body: 'Prix exact affiché avant génération.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Fast ou Veo 3.1 ?',
        body: 'Utilisez Fast pour les tests de prompts et les boucles de concept. Passez à Veo 3.1 pour le rendu final.',
        cta: { label: 'Comparer Veo 3.1 vs Fast', href: compareHref('fr', 'veo-3-1-fast', 'veo-3-1') },
      },
      {
        title: 'Vous testez une fin ?',
        body: 'Utilisez première-dernière image quand le début et la composition finale sont déjà validés.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Besoin du test Veo le moins cher ?',
        body: 'Comparez Fast et Lite selon que vous privilégiez le contrôle audio ou le coût d’itération.',
        cta: { label: 'Comparer Fast vs Lite', href: compareHref('fr', 'veo-3-1-fast', 'veo-3-1-lite') },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt texte', body: 'Testez sujet, caméra, style et intention audio dans un brouillon court.' },
      { title: 'Image de départ', body: 'Ancrez cadrage, produit ou identité avec une seule image source.' },
      { title: 'Première-dernière image', body: 'Ajoutez une image d’arrivée quand la pose finale compte.' },
      { title: 'Audio', body: 'Activez l’audio pour le timing, ou coupez-le pour un test purement visuel.' },
      { title: 'Passage final', body: 'Déplacez les meilleurs brouillons vers Veo 3.1 pour les rendus premium.' },
    ],
    pricingCopy: {
      title: 'Prix Veo 3.1 Fast en un coup d’œil',
      subtitle: 'Prix totaux par scénario de brouillon — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Jusqu’à 1080p',
    },
    meta: {
      title: 'Veo 3.1 Fast : tarifs, brouillons et exemples | MaxVideoAI',
      description:
        'Utilisez Veo 3.1 Fast pour des brouillons Veo rapides, audio natif optionnel, tests première-dernière image et boucles courtes avant les rendus Veo 3.1.',
    },
  },
  es: {
    hero: {
      eyebrow: 'RUTA GOOGLE FAST VIDEO',
      title: 'Veo 3.1 Fast',
      subtitle: 'Borradores Veo más rápidos con audio nativo opcional, pruebas de primer-último cuadro y loops cortos.',
      subtitleHighlights: ['borradores Veo más rápidos', 'audio nativo opcional', 'pruebas de primer-último cuadro'],
      paragraph:
        'Usa Veo 3.1 Fast para probar rápido texto a video, imagen a video y primer-último cuadro cuando necesitas iterar con menor coste antes de pasar las tomas aprobadas a Veo 3.1.',
      primaryCta: { label: 'Generar con Veo 3.1 Fast', href: '/app?engine=veo-3-1-fast' },
      secondaryCta: { label: 'Ver ejemplos', href: examplesHref('es', 'veo') },
      quickLinks: [
        { label: 'Comparar con Veo 3.1', href: compareHref('es', 'veo-3-1-fast', 'veo-3-1') },
        { label: 'Ver precios', href: pricingHref('es', 'veo-3-1-fast-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Veo 3.1 Fast',
      description: 'Borrador Veo rápido con audio opcional',
      renderLabel: 'Ver borrador',
      badges: ['Fast', '8 s', '1080p'],
      altContext: 'borrador corto de concepto con Veo 3.1 Fast',
    },
    features: [
      { title: 'Borradores Veo rápidos', body: 'Prueba conceptos antes de la ruta principal de producción.', tone: 'quality' },
      { title: 'Audio opcional', body: 'Activa audio nativo cuando necesitas probar ritmo o ambiente.', tone: 'audio' },
      { title: 'Primer-último cuadro', body: 'Conecta cuadros aprobados para revisar una transición corta.', tone: 'reference' },
      { title: 'Extensión', body: 'Continúa un clip Fast existente cuando el borrador necesita un beat extra.', tone: 'duration' },
      { title: '720p o 1080p', body: 'Elige las resoluciones expuestas en MaxVideoAI antes de generar.', tone: 'quality' },
      { title: 'Pago por uso', body: 'Ve el precio exacto antes de generar.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '¿Fast o Veo 3.1?',
        body: 'Usa Fast para pruebas de prompt y loops cortos. Usa Veo 3.1 cuando la toma seleccionada necesite acabado final.',
        cta: { label: 'Comparar Veo 3.1 vs Fast', href: compareHref('es', 'veo-3-1-fast', 'veo-3-1') },
      },
      {
        title: '¿Pruebas una llegada?',
        body: 'Usa primer-último cuadro cuando el inicio y la composición final ya están aprobados.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: '¿Buscas el pase Veo más barato?',
        body: 'Compara Fast con Lite según necesites control de audio o menor coste de prueba.',
        cta: { label: 'Comparar Fast vs Lite', href: compareHref('es', 'veo-3-1-fast', 'veo-3-1-lite') },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt de texto', body: 'Prueba sujeto, cámara, estilo e intención de audio en un borrador corto.' },
      { title: 'Imagen inicial', body: 'Usa un still cuando encuadre, producto o identidad deban anclar el primer cuadro.' },
      { title: 'Primer-último cuadro', body: 'Agrega un cuadro final cuando importan la pose o composición de llegada.' },
      { title: 'Audio', body: 'Actívalo para probar timing, o apágalo si solo necesitas movimiento visual.' },
      { title: 'Paso final', body: 'Lleva los mejores borradores a Veo 3.1 para renders de producción.' },
    ],
    pricingCopy: {
      title: 'Precios de Veo 3.1 Fast de un vistazo',
      subtitle: 'Precios totales por escenario de borrador. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Hasta 1080p',
    },
    meta: {
      title: 'Veo 3.1 Fast: precios, borradores y ejemplos | MaxVideoAI',
      description:
        'Usa Veo 3.1 Fast para borradores Veo rápidos, audio nativo opcional, pruebas de primer-último cuadro y loops cortos antes de Veo 3.1.',
    },
  },
};

const VEO_31_LITE_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'GOOGLE LOWER-COST VIDEO ROUTE',
      title: 'Veo 3.1 Lite',
      subtitle: 'Lower-cost Veo drafts with audio included, short prompt tests, and simple image-to-video checks.',
      subtitleHighlights: ['lower-cost Veo drafts', 'audio included', 'short prompt tests'],
      paragraph:
        'Use Veo 3.1 Lite when you need the cheapest Veo 3.1 route for short audio-ready drafts, timing checks and prompt comparisons before upgrading winners to Fast or Veo 3.1.',
      primaryCta: { label: 'Generate with Veo 3.1 Lite', href: '/app?engine=veo-3-1-lite' },
      secondaryCta: { label: 'View examples', href: examplesHref('en', 'veo') },
      quickLinks: [
        { label: 'Compare vs Fast', href: compareHref('en', 'veo-3-1-lite', 'veo-3-1-fast') },
        { label: 'View pricing', href: pricingHref('en', 'veo-3-1-lite-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Veo 3.1 Lite example',
      description: 'Lower-cost audio-ready Veo draft',
      renderLabel: 'View draft',
      badges: ['Audio included', '8s', '720p'],
      altContext: 'Veo 3.1 Lite short audio-ready draft',
    },
    features: [
      { title: 'Lower-cost Veo', body: 'Use Lite for the cheapest Veo timing and prompt checks.', tone: 'price' },
      { title: 'Audio included', body: 'Every Lite render includes native audio, so prompt ambience deliberately.', tone: 'audio' },
      { title: 'Text or image', body: 'Start from a prompt or a single visual reference.', tone: 'reference' },
      { title: 'First-last tests', body: 'Use paired frames when the ending composition matters.', tone: 'continuity' },
      { title: 'Max 8s', body: 'Keep tests short and focused on one clear beat.', tone: 'duration' },
      { title: '720p or 1080p', body: 'Choose a cost/quality level before generation.', tone: 'quality' },
    ],
    decisionCards: [
      {
        title: 'Lite or Fast?',
        body: 'Use Lite for the lowest-cost Veo drafts with audio included. Use Fast when you need optional audio control or more iteration controls.',
        cta: { label: 'Compare Lite vs Fast', href: compareHref('en', 'veo-3-1-lite', 'veo-3-1-fast') },
      },
      {
        title: 'Need audio timing?',
        body: 'Because audio is included, write short ambience, SFX or dialogue cues into the prompt instead of leaving sound vague.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Ready for a final pass?',
        body: 'Move winning Lite drafts into Veo 3.1 when the concept is approved and needs production polish.',
        cta: { label: 'View Veo 3.1', href: modelsHref('en', 'veo-3-1') },
      },
    ],
    referenceWorkflows: [
      { title: 'Text prompt', body: 'Use one subject, one action, one camera move and a simple audio cue.' },
      { title: 'Start image', body: 'Anchor composition or product shape with a single image source.' },
      { title: 'Audio cue', body: 'Keep ambience or dialogue short because audio is included in the render.' },
      { title: 'Short timing test', body: 'Use 4, 6 or 8 seconds to test the core beat without overbuilding.' },
      { title: 'Upgrade path', body: 'Promote the best drafts to Fast or Veo 3.1 when you need more control or polish.' },
    ],
    pricingCopy: {
      title: 'Veo 3.1 Lite pricing at a glance',
      subtitle: 'Preset lower-cost totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'Up to 1080p',
    },
    meta: {
      title: 'Veo 3.1 Lite: Pricing, Audio Drafts & Examples | MaxVideoAI',
      description:
        'Use Veo 3.1 Lite for lower-cost Veo drafts with audio included, short prompt tests and image-to-video checks before upgrading winners.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'ROUTE GOOGLE VIDEO À MOINDRE COÛT',
      title: 'Veo 3.1 Lite',
      subtitle: 'Des brouillons Veo à moindre coût avec audio inclus, tests de prompts courts et contrôles image-vidéo simples.',
      subtitleHighlights: ['brouillons Veo à moindre coût', 'audio inclus', 'tests de prompts courts'],
      paragraph:
        'Utilisez Veo 3.1 Lite pour la route Veo 3.1 la moins coûteuse : brouillons courts avec audio, tests de rythme et comparaisons de prompts avant de monter les gagnants vers Fast ou Veo 3.1.',
      primaryCta: { label: 'Générer avec Veo 3.1 Lite', href: '/app?engine=veo-3-1-lite' },
      secondaryCta: { label: 'Voir les exemples', href: examplesHref('fr', 'veo') },
      quickLinks: [
        { label: 'Comparer vs Fast', href: compareHref('fr', 'veo-3-1-lite', 'veo-3-1-fast') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'veo-3-1-lite-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Veo 3.1 Lite',
      description: 'Brouillon Veo avec audio inclus',
      renderLabel: 'Voir le brouillon',
      badges: ['Audio inclus', '8 s', '720p'],
      altContext: 'brouillon court Veo 3.1 Lite avec audio',
    },
    features: [
      { title: 'Veo à moindre coût', body: 'Utilisez Lite pour les tests Veo les plus économiques.', tone: 'price' },
      { title: 'Audio inclus', body: 'Chaque rendu Lite inclut l’audio natif : promptgez l’ambiance clairement.', tone: 'audio' },
      { title: 'Texte ou image', body: 'Démarrez depuis un prompt ou une seule référence visuelle.', tone: 'reference' },
      { title: 'Première-dernière', body: 'Utilisez deux images quand la composition finale compte.', tone: 'continuity' },
      { title: 'Max 8 s', body: 'Gardez les tests courts et centrés sur un beat.', tone: 'duration' },
      { title: '720p ou 1080p', body: 'Choisissez le niveau coût/qualité avant génération.', tone: 'quality' },
    ],
    decisionCards: [
      {
        title: 'Lite ou Fast ?',
        body: 'Utilisez Lite pour les brouillons Veo les moins chers avec audio inclus. Choisissez Fast pour plus de contrôle d’itération.',
        cta: { label: 'Comparer Lite vs Fast', href: compareHref('fr', 'veo-3-1-lite', 'veo-3-1-fast') },
      },
      {
        title: 'Besoin de timing audio ?',
        body: 'Comme l’audio est inclus, écrivez des cues courts d’ambiance, de SFX ou de dialogue dans le prompt.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Prêt pour le rendu final ?',
        body: 'Passez les meilleurs brouillons Lite dans Veo 3.1 quand le concept est validé.',
        cta: { label: 'Voir Veo 3.1', href: modelsHref('fr', 'veo-3-1') },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt texte', body: 'Un sujet, une action, un mouvement caméra et un cue audio simple.' },
      { title: 'Image de départ', body: 'Ancrez composition ou forme produit avec une seule image source.' },
      { title: 'Cue audio', body: 'Gardez ambiance ou dialogue courts, car l’audio est inclus.' },
      { title: 'Test court', body: 'Utilisez 4, 6 ou 8 secondes pour valider le beat central.' },
      { title: 'Montée en gamme', body: 'Passez les meilleurs brouillons vers Fast ou Veo 3.1 selon le besoin.' },
    ],
    pricingCopy: {
      title: 'Prix Veo 3.1 Lite en un coup d’œil',
      subtitle: 'Prix totaux à moindre coût — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Jusqu’à 1080p',
    },
    meta: {
      title: 'Veo 3.1 Lite : tarifs, brouillons audio et exemples | MaxVideoAI',
      description:
        'Utilisez Veo 3.1 Lite pour des brouillons Veo à moindre coût avec audio inclus, tests de prompts courts et contrôles image-vidéo.',
    },
  },
  es: {
    hero: {
      eyebrow: 'RUTA GOOGLE VIDEO DE MENOR COSTE',
      title: 'Veo 3.1 Lite',
      subtitle: 'Borradores Veo de menor coste con audio incluido, pruebas cortas de prompt y checks simples de imagen a video.',
      subtitleHighlights: ['borradores Veo de menor coste', 'audio incluido', 'pruebas cortas de prompt'],
      paragraph:
        'Usa Veo 3.1 Lite cuando necesitas la ruta Veo 3.1 más económica para borradores cortos con audio, pruebas de ritmo y comparación de prompts antes de subir ganadores a Fast o Veo 3.1.',
      primaryCta: { label: 'Generar con Veo 3.1 Lite', href: '/app?engine=veo-3-1-lite' },
      secondaryCta: { label: 'Ver ejemplos', href: examplesHref('es', 'veo') },
      quickLinks: [
        { label: 'Comparar con Fast', href: compareHref('es', 'veo-3-1-lite', 'veo-3-1-fast') },
        { label: 'Ver precios', href: pricingHref('es', 'veo-3-1-lite-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Veo 3.1 Lite',
      description: 'Borrador Veo con audio incluido',
      renderLabel: 'Ver borrador',
      badges: ['Audio incluido', '8 s', '720p'],
      altContext: 'borrador corto con audio en Veo 3.1 Lite',
    },
    features: [
      { title: 'Veo de menor coste', body: 'Usa Lite para los checks Veo más económicos.', tone: 'price' },
      { title: 'Audio incluido', body: 'Cada render Lite incluye audio nativo, así que define ambiente con intención.', tone: 'audio' },
      { title: 'Texto o imagen', body: 'Empieza desde un prompt o una sola referencia visual.', tone: 'reference' },
      { title: 'Primer-último cuadro', body: 'Usa dos cuadros cuando la composición final importa.', tone: 'continuity' },
      { title: 'Max 8 s', body: 'Mantén las pruebas cortas y enfocadas en un beat claro.', tone: 'duration' },
      { title: '720p o 1080p', body: 'Elige nivel de coste/calidad antes de generar.', tone: 'quality' },
    ],
    decisionCards: [
      {
        title: '¿Lite o Fast?',
        body: 'Usa Lite para los borradores Veo más económicos con audio incluido. Usa Fast si necesitas más control de iteración.',
        cta: { label: 'Comparar Lite vs Fast', href: compareHref('es', 'veo-3-1-lite', 'veo-3-1-fast') },
      },
      {
        title: '¿Necesitas ritmo de audio?',
        body: 'Como el audio viene incluido, escribe cues breves de ambiente, SFX o diálogo en el prompt.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: '¿Listo para una pasada final?',
        body: 'Lleva los mejores borradores Lite a Veo 3.1 cuando el concepto esté aprobado.',
        cta: { label: 'Ver Veo 3.1', href: modelsHref('es', 'veo-3-1') },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt de texto', body: 'Un sujeto, una acción, un movimiento de cámara y un cue simple de audio.' },
      { title: 'Imagen inicial', body: 'Ancla composición o forma de producto con una sola imagen fuente.' },
      { title: 'Cue de audio', body: 'Mantén ambiente o diálogo cortos porque el audio está incluido.' },
      { title: 'Prueba corta', body: 'Usa 4, 6 u 8 segundos para validar el beat principal.' },
      { title: 'Subida de nivel', body: 'Promueve los mejores borradores a Fast o Veo 3.1 según el caso.' },
    ],
    pricingCopy: {
      title: 'Precios de Veo 3.1 Lite de un vistazo',
      subtitle: 'Totales de menor coste por escenario. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Hasta 1080p',
    },
    meta: {
      title: 'Veo 3.1 Lite: precios, borradores con audio y ejemplos | MaxVideoAI',
      description:
        'Usa Veo 3.1 Lite para borradores Veo de menor coste con audio incluido, pruebas cortas de prompt y checks de imagen a video.',
    },
  },
};

const KLING_3_STANDARD_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'KLING LOWER-COST STORYBOARD ROUTE',
      title: 'Kling 3 Standard',
      subtitle: 'Multi-shot drafts for 1080p storyboard tests, prompt planning, and native audio options.',
      subtitleHighlights: ['multi-shot drafts', '1080p storyboard tests', 'native audio options'],
      paragraph:
        'Use Kling 3 Standard when you want lower-cost Kling 3 storyboard testing in 1080p: structured prompts, image-to-video drafts, optional end frames and audio before moving winners into Pro.',
      primaryCta: { label: 'Generate with Kling 3 Standard', href: '/app?engine=kling-3-standard' },
      secondaryCta: { label: 'View examples', href: examplesHref('en', 'kling') },
      quickLinks: [
        { label: 'Compare vs Pro', href: compareHref('en', 'kling-3-standard', 'kling-3-pro') },
        { label: 'View pricing', href: pricingHref('en', 'kling-3-standard-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Kling 3 Standard example',
      description: 'Lower-cost storyboard draft',
      renderLabel: 'View draft',
      badges: ['1080p', '15s max', 'Audio option'],
      altContext: 'Kling 3 Standard storyboard-style draft',
    },
    features: [
      { title: 'Multi-shot drafts', body: 'Plan scenes and beats before spending on the Pro route.', tone: 'continuity' },
      { title: '1080p output', body: 'Keep Standard focused on cost-effective review renders.', tone: 'quality' },
      { title: 'Image-to-video', body: 'Use one source image and optional end frame for tighter drafts.', tone: 'reference' },
      { title: 'Native audio options', body: 'Run sound-on or silent tests depending on the review stage.', tone: 'audio' },
      { title: 'Max 15s', body: 'Storyboard short sequences up to 15 seconds.', tone: 'duration' },
      { title: 'Pay-as-you-go', body: 'See exact live price before you generate.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Standard or Pro?',
        body: 'Use Standard for lower-cost storyboard testing. Use Kling 3 Pro when the approved shot needs stronger final fidelity.',
        cta: { label: 'Compare Standard vs Pro', href: compareHref('en', 'kling-3-standard', 'kling-3-pro') },
      },
      {
        title: 'Planning multiple shots?',
        body: 'Keep each beat short, assign one action per shot, and reuse continuity anchors across the sequence.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Need final delivery?',
        body: 'Validate in Standard first, then move approved shots into the Pro route for the main quality pass.',
        cta: { label: 'View Kling 3 Pro', href: modelsHref('en', 'kling-3-pro') },
      },
    ],
    referenceWorkflows: [
      { title: 'Shot plan', body: 'Split the sequence into short scenes with one clear action per beat.' },
      { title: 'Image reference', body: 'Use a source image when product framing or subject identity matters.' },
      { title: 'End frame', body: 'Add a landing frame when the final composition needs control.' },
      { title: 'Audio pass', body: 'Use sound for review context or keep drafts silent for post-production.' },
      { title: 'Pro handoff', body: 'Move the best Standard drafts to Pro for the primary quality pass.' },
    ],
    pricingCopy: {
      title: 'Kling 3 Standard pricing at a glance',
      subtitle: 'Preset 1080p draft totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: '1080p route',
    },
    meta: {
      title: 'Kling 3 Standard: Pricing, 1080p Drafts & Examples | MaxVideoAI',
      description:
        'Use Kling 3 Standard for lower-cost 1080p storyboard drafts, image-to-video tests, native audio options and 15 second Kling planning.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'ROUTE KLING STORYBOARD À MOINDRE COÛT',
      title: 'Kling 3 Standard',
      subtitle: 'Des brouillons multi-plans pour tests storyboard 1080p, planification de prompts et options audio natives.',
      subtitleHighlights: ['brouillons multi-plans', 'tests storyboard 1080p', 'options audio natives'],
      paragraph:
        'Utilisez Kling 3 Standard pour tester des storyboards Kling 3 à moindre coût en 1080p : prompts structurés, brouillons image-vidéo, image de fin optionnelle et audio avant de passer les gagnants en Pro.',
      primaryCta: { label: 'Générer avec Kling 3 Standard', href: '/app?engine=kling-3-standard' },
      secondaryCta: { label: 'Voir les exemples', href: examplesHref('fr', 'kling') },
      quickLinks: [
        { label: 'Comparer vs Pro', href: compareHref('fr', 'kling-3-standard', 'kling-3-pro') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'kling-3-standard-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Kling 3 Standard',
      description: 'Brouillon storyboard à moindre coût',
      renderLabel: 'Voir le brouillon',
      badges: ['1080p', '15 s max', 'Audio optionnel'],
      altContext: 'brouillon storyboard Kling 3 Standard',
    },
    features: [
      { title: 'Brouillons multi-plans', body: 'Planifiez scènes et beats avant de passer sur Pro.', tone: 'continuity' },
      { title: 'Sortie 1080p', body: 'Gardez Standard pour les rendus de revue économiques.', tone: 'quality' },
      { title: 'Image-vidéo', body: 'Utilisez une image source et une image de fin optionnelle.', tone: 'reference' },
      { title: 'Options audio natives', body: 'Testez avec ou sans son selon l’étape de revue.', tone: 'audio' },
      { title: 'Max 15 s', body: 'Storyboards courts jusqu’à 15 secondes.', tone: 'duration' },
      { title: 'Paiement à l’usage', body: 'Prix exact affiché avant génération.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Standard ou Pro ?',
        body: 'Utilisez Standard pour les tests storyboard à moindre coût. Passez à Kling 3 Pro pour une fidélité finale plus forte.',
        cta: { label: 'Comparer Standard vs Pro', href: compareHref('fr', 'kling-3-standard', 'kling-3-pro') },
      },
      {
        title: 'Plusieurs plans à structurer ?',
        body: 'Gardez chaque beat court, une action par plan, et répétez les ancres de continuité.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Besoin d’une livraison finale ?',
        body: 'Validez d’abord en Standard, puis passez les plans approuvés en Pro pour la passe qualité principale.',
        cta: { label: 'Voir Kling 3 Pro', href: modelsHref('fr', 'kling-3-pro') },
      },
    ],
    referenceWorkflows: [
      { title: 'Plan de shots', body: 'Découpez la séquence en scènes courtes avec une action claire par beat.' },
      { title: 'Image de référence', body: 'Ancrez le sujet, le produit ou le cadrage avec une image source.' },
      { title: 'Image de fin', body: 'Ajoutez une frame d’arrivée quand la composition finale compte.' },
      { title: 'Passe audio', body: 'Ajoutez le son pour le contexte, ou gardez un brouillon silencieux pour la post-prod.' },
      { title: 'Passage Pro', body: 'Déplacez les meilleurs brouillons Standard vers Pro pour la passe qualité.' },
    ],
    pricingCopy: {
      title: 'Prix Kling 3 Standard en un coup d’œil',
      subtitle: 'Prix totaux de brouillons 1080p — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Route 1080p',
    },
    meta: {
      title: 'Kling 3 Standard : tarifs, brouillons 1080p et exemples | MaxVideoAI',
      description:
        'Utilisez Kling 3 Standard pour des brouillons storyboard 1080p à moindre coût, tests image-vidéo, options audio natives et séquences Kling jusqu’à 15 s.',
    },
  },
  es: {
    hero: {
      eyebrow: 'RUTA KLING STORYBOARD DE MENOR COSTE',
      title: 'Kling 3 Standard',
      subtitle: 'Borradores multi-shot para pruebas storyboard 1080p, planificación de prompts y opciones de audio nativo.',
      subtitleHighlights: ['borradores multi-shot', 'pruebas storyboard 1080p', 'opciones de audio nativo'],
      paragraph:
        'Usa Kling 3 Standard para probar storyboards Kling 3 de menor coste en 1080p: prompts estructurados, borradores imagen a video, cuadro final opcional y audio antes de pasar ganadores a Pro.',
      primaryCta: { label: 'Generar con Kling 3 Standard', href: '/app?engine=kling-3-standard' },
      secondaryCta: { label: 'Ver ejemplos', href: examplesHref('es', 'kling') },
      quickLinks: [
        { label: 'Comparar con Pro', href: compareHref('es', 'kling-3-standard', 'kling-3-pro') },
        { label: 'Ver precios', href: pricingHref('es', 'kling-3-standard-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Kling 3 Standard',
      description: 'Borrador storyboard de menor coste',
      renderLabel: 'Ver borrador',
      badges: ['1080p', '15 s max', 'Audio opcional'],
      altContext: 'borrador tipo storyboard con Kling 3 Standard',
    },
    features: [
      { title: 'Borradores multi-shot', body: 'Planifica escenas y beats antes de pasar a Pro.', tone: 'continuity' },
      { title: 'Salida 1080p', body: 'Usa Standard para renders de revisión más eficientes.', tone: 'quality' },
      { title: 'Imagen a video', body: 'Usa una imagen fuente y cuadro final opcional para borradores más precisos.', tone: 'reference' },
      { title: 'Opciones de audio', body: 'Prueba con o sin sonido según la etapa de revisión.', tone: 'audio' },
      { title: 'Max 15 s', body: 'Arma secuencias cortas de hasta 15 segundos.', tone: 'duration' },
      { title: 'Pago por uso', body: 'Ve el precio exacto antes de generar.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '¿Standard o Pro?',
        body: 'Usa Standard para pruebas storyboard de menor coste. Usa Kling 3 Pro cuando la toma aprobada necesite más fidelidad final.',
        cta: { label: 'Comparar Standard vs Pro', href: compareHref('es', 'kling-3-standard', 'kling-3-pro') },
      },
      {
        title: '¿Planeas varias tomas?',
        body: 'Mantén cada beat corto, una acción por toma y repite anclas de continuidad.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: '¿Necesitas entrega final?',
        body: 'Valida primero en Standard y luego pasa las tomas aprobadas a Pro para la revisión principal de calidad.',
        cta: { label: 'Ver Kling 3 Pro', href: modelsHref('es', 'kling-3-pro') },
      },
    ],
    referenceWorkflows: [
      { title: 'Plan de tomas', body: 'Divide la secuencia en escenas cortas con una acción clara por beat.' },
      { title: 'Imagen de referencia', body: 'Usa una imagen fuente cuando importen producto, sujeto o encuadre.' },
      { title: 'Cuadro final', body: 'Agrega un frame de llegada cuando la composición final debe estar controlada.' },
      { title: 'Pase de audio', body: 'Usa sonido para contexto o mantén el borrador silencioso para postproducción.' },
      { title: 'Paso a Pro', body: 'Mueve los mejores borradores Standard a Pro para la pasada principal de calidad.' },
    ],
    pricingCopy: {
      title: 'Precios de Kling 3 Standard de un vistazo',
      subtitle: 'Totales de borrador 1080p. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Ruta 1080p',
    },
    meta: {
      title: 'Kling 3 Standard: precios, borradores 1080p y ejemplos | MaxVideoAI',
      description:
        'Usa Kling 3 Standard para borradores storyboard 1080p de menor coste, pruebas imagen a video, opciones de audio y planificación Kling hasta 15 s.',
    },
  },
};

const KLING_3_4K_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'KLING NATIVE 4K DELIVERY ROUTE',
      title: 'Kling 3 4K',
      subtitle: 'Native 4K delivery for approved image-to-video shots, product masters, and final campaign renders.',
      subtitleHighlights: ['native 4K delivery', 'approved image-to-video shots', 'final campaign renders'],
      paragraph:
        'Use Kling 3 4K after the prompt, reference image or storyboard is approved and the shot needs native 4K output for delivery, editing or large-screen review.',
      primaryCta: { label: 'Generate with Kling 3 4K', href: '/app?engine=kling-3-4k' },
      secondaryCta: { label: 'View examples', href: examplesHref('en', 'kling') },
      quickLinks: [
        { label: 'Compare vs Pro', href: compareHref('en', 'kling-3-4k', 'kling-3-pro') },
        { label: 'View pricing', href: pricingHref('en', 'kling-3-4k-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Kling 3 4K example',
      description: 'Native 4K delivery render',
      renderLabel: 'View render',
      badges: ['Native 4K', '15s max', 'Delivery'],
      altContext: 'Kling 3 native 4K delivery render',
    },
    features: [
      { title: 'Native 4K output', body: 'Generate delivery-grade output directly on the 4K route.', tone: 'quality' },
      { title: 'Text or image', body: 'Use the approved prompt or image reference for the final pass.', tone: 'reference' },
      { title: 'Final masters', body: 'Reserve 4K for approved ads, product shots and campaign masters.', tone: 'continuity' },
      { title: 'Audio option', body: 'Use native audio when the final render needs sound context.', tone: 'audio' },
      { title: 'Max 15s', body: 'Render short approved clips up to 15 seconds.', tone: 'duration' },
      { title: 'Pay-as-you-go', body: 'See exact live price before you generate.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'When should you use 4K?',
        body: 'Use Kling 3 4K after the creative direction is validated. Draft in Standard or Pro before paying for final delivery.',
        cta: { label: 'Compare 4K vs Pro', href: compareHref('en', 'kling-3-4k', 'kling-3-pro') },
      },
      {
        title: 'Preparing an image-to-video master?',
        body: 'Lock the source frame, product details and final composition before rendering the 4K version.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Still testing prompts?',
        body: 'Stay on Kling 3 Standard or Pro until the shot recipe is approved.',
        cta: { label: 'View Kling 3 Standard', href: modelsHref('en', 'kling-3-standard') },
      },
    ],
    referenceWorkflows: [
      { title: 'Approved prompt', body: 'Bring a validated shot plan into 4K instead of exploring from scratch.' },
      { title: 'Image reference', body: 'Use a clean source image when product framing or visual identity matters.' },
      { title: 'Delivery framing', body: 'Choose 16:9, 9:16 or 1:1 based on the final placement.' },
      { title: 'Audio decision', body: 'Add audio only when the delivery file needs sound in review or export.' },
      { title: 'Cost control', body: 'Validate lower first, then render 4K once the creative is approved.' },
    ],
    pricingCopy: {
      title: 'Kling 3 4K pricing at a glance',
      subtitle: 'Preset native 4K totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'Native 4K route',
    },
    meta: {
      title: 'Kling 3 4K: Native 4K Pricing & Examples | MaxVideoAI',
      description:
        'Use Kling 3 4K for native 4K delivery renders, approved image-to-video shots, product masters and final campaign clips up to 15 seconds.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'ROUTE KLING 4K NATIVE DE LIVRAISON',
      title: 'Kling 3 4K',
      subtitle: 'Livraison 4K native pour plans image-vidéo approuvés, masters produit et rendus finaux de campagne.',
      subtitleHighlights: ['livraison 4K native', 'plans image-vidéo approuvés', 'rendus finaux de campagne'],
      paragraph:
        'Utilisez Kling 3 4K une fois le prompt, l’image de référence ou le storyboard validé, quand le plan doit sortir en 4K native pour livraison, montage ou revue grand format.',
      primaryCta: { label: 'Générer avec Kling 3 4K', href: '/app?engine=kling-3-4k' },
      secondaryCta: { label: 'Voir les exemples', href: examplesHref('fr', 'kling') },
      quickLinks: [
        { label: 'Comparer vs Pro', href: compareHref('fr', 'kling-3-4k', 'kling-3-pro') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'kling-3-4k-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Kling 3 4K',
      description: 'Rendu de livraison 4K native',
      renderLabel: 'Voir le rendu',
      badges: ['4K native', '15 s max', 'Livraison'],
      altContext: 'rendu de livraison Kling 3 en 4K native',
    },
    features: [
      { title: 'Sortie 4K native', body: 'Générez directement sur la route 4K pour la livraison.', tone: 'quality' },
      { title: 'Texte ou image', body: 'Utilisez le prompt ou la référence déjà validés.', tone: 'reference' },
      { title: 'Masters finaux', body: 'Réservez la 4K aux pubs, produits et exports approuvés.', tone: 'continuity' },
      { title: 'Option audio', body: 'Ajoutez l’audio natif si le fichier final doit être revu avec son.', tone: 'audio' },
      { title: 'Max 15 s', body: 'Rendez des clips courts approuvés jusqu’à 15 secondes.', tone: 'duration' },
      { title: 'Paiement à l’usage', body: 'Prix exact affiché avant génération.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Quand utiliser la 4K ?',
        body: 'Utilisez Kling 3 4K quand la direction créative est validée. Brouillonnez en Standard ou Pro avant la livraison.',
        cta: { label: 'Comparer 4K vs Pro', href: compareHref('fr', 'kling-3-4k', 'kling-3-pro') },
      },
      {
        title: 'Vous préparez un master image-vidéo ?',
        body: 'Verrouillez image source, détails produit et composition finale avant le rendu 4K.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Encore en test de prompts ?',
        body: 'Restez sur Kling 3 Standard ou Pro jusqu’à validation de la recette du plan.',
        cta: { label: 'Voir Kling 3 Standard', href: modelsHref('fr', 'kling-3-standard') },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt validé', body: 'Amenez en 4K un plan déjà validé, pas une exploration de départ.' },
      { title: 'Image de référence', body: 'Utilisez une source propre quand cadrage produit ou identité compte.' },
      { title: 'Cadrage livraison', body: 'Choisissez 16:9, 9:16 ou 1:1 selon le placement final.' },
      { title: 'Décision audio', body: 'Ajoutez l’audio seulement si le fichier final doit être revu ou exporté avec son.' },
      { title: 'Contrôle coût', body: 'Validez plus bas, puis rendez en 4K une fois le créatif approuvé.' },
    ],
    pricingCopy: {
      title: 'Prix Kling 3 4K en un coup d’œil',
      subtitle: 'Prix totaux en 4K native — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Route 4K native',
    },
    meta: {
      title: 'Kling 3 4K : tarifs 4K native et exemples | MaxVideoAI',
      description:
        'Utilisez Kling 3 4K pour des rendus de livraison en 4K native, plans image-vidéo approuvés, masters produit et clips finaux jusqu’à 15 s.',
    },
  },
  es: {
    hero: {
      eyebrow: 'RUTA KLING 4K NATIVA DE ENTREGA',
      title: 'Kling 3 4K',
      subtitle: 'Entrega 4K nativa para tomas imagen a video aprobadas, masters de producto y renders finales de campaña.',
      subtitleHighlights: ['entrega 4K nativa', 'tomas imagen a video aprobadas', 'renders finales de campaña'],
      paragraph:
        'Usa Kling 3 4K cuando el prompt, la imagen de referencia o el storyboard ya están aprobados y la toma necesita salida 4K nativa para entrega, edición o revisión en pantalla grande.',
      primaryCta: { label: 'Generar con Kling 3 4K', href: '/app?engine=kling-3-4k' },
      secondaryCta: { label: 'Ver ejemplos', href: examplesHref('es', 'kling') },
      quickLinks: [
        { label: 'Comparar con Pro', href: compareHref('es', 'kling-3-4k', 'kling-3-pro') },
        { label: 'Ver precios', href: pricingHref('es', 'kling-3-4k-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Kling 3 4K',
      description: 'Render de entrega 4K nativa',
      renderLabel: 'Ver render',
      badges: ['4K nativo', '15 s max', 'Entrega'],
      altContext: 'render de entrega Kling 3 en 4K nativo',
    },
    features: [
      { title: 'Salida 4K nativa', body: 'Genera salida de entrega directamente en la ruta 4K.', tone: 'quality' },
      { title: 'Texto o imagen', body: 'Usa el prompt o referencia ya aprobados para la pasada final.', tone: 'reference' },
      { title: 'Masters finales', body: 'Reserva 4K para anuncios, producto y exports aprobados.', tone: 'continuity' },
      { title: 'Opción de audio', body: 'Usa audio nativo cuando el archivo final necesita contexto sonoro.', tone: 'audio' },
      { title: 'Max 15 s', body: 'Renderiza clips cortos aprobados de hasta 15 segundos.', tone: 'duration' },
      { title: 'Pago por uso', body: 'Ve el precio exacto antes de generar.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '¿Cuándo usar 4K?',
        body: 'Usa Kling 3 4K después de validar la dirección creativa. Haz borradores en Standard o Pro antes de pagar entrega final.',
        cta: { label: 'Comparar 4K vs Pro', href: compareHref('es', 'kling-3-4k', 'kling-3-pro') },
      },
      {
        title: '¿Preparas un master imagen a video?',
        body: 'Bloquea cuadro fuente, detalles de producto y composición final antes de generar la versión 4K.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: '¿Sigues probando prompts?',
        body: 'Quédate en Kling 3 Standard o Pro hasta aprobar la receta de la toma.',
        cta: { label: 'Ver Kling 3 Standard', href: modelsHref('es', 'kling-3-standard') },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt aprobado', body: 'Lleva a 4K un plan ya validado, no una exploración desde cero.' },
      { title: 'Imagen de referencia', body: 'Usa una fuente limpia cuando importen producto, encuadre o identidad.' },
      { title: 'Encuadre de entrega', body: 'Elige 16:9, 9:16 o 1:1 según el placement final.' },
      { title: 'Decisión de audio', body: 'Agrega audio solo si la entrega necesita revisión o export con sonido.' },
      { title: 'Control de coste', body: 'Valida en una ruta menor y renderiza en 4K cuando el creativo esté aprobado.' },
    ],
    pricingCopy: {
      title: 'Precios de Kling 3 4K de un vistazo',
      subtitle: 'Totales en 4K nativo. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Ruta 4K nativa',
    },
    meta: {
      title: 'Kling 3 4K: precios 4K nativo y ejemplos | MaxVideoAI',
      description:
        'Usa Kling 3 4K para renders de entrega en 4K nativo, tomas imagen a video aprobadas, masters de producto y clips finales de hasta 15 s.',
    },
  },
};

const LTX_23_PRO_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'LTX PRODUCTION WORKFLOW ROUTE',
      title: 'LTX 2.3 Pro',
      subtitle: 'Audio-led workflows, Extend and Retake controls, and 4K generate passes for production video.',
      subtitleHighlights: ['audio-led workflows', 'Extend and Retake', '4K generate passes'],
      paragraph:
        'Use LTX 2.3 Pro when the LTX job needs more than a draft: text or image generation, audio-to-video, source video extension and selective retake controls in one production route.',
      primaryCta: { label: 'Generate with LTX 2.3 Pro', href: '/app?engine=ltx-2-3' },
      secondaryCta: { label: 'View examples', href: examplesHref('en', 'ltx') },
      quickLinks: [
        { label: 'Compare vs Fast', href: compareHref('en', 'ltx-2-3-pro', 'ltx-2-3-fast') },
        { label: 'View pricing', href: pricingHref('en', 'ltx-2-3-pro-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'LTX 2.3 Pro example',
      description: 'Production workflow render',
      renderLabel: 'View render',
      badges: ['Audio workflow', 'Retake', '4K'],
      altContext: 'LTX 2.3 Pro production workflow render',
    },
    features: [
      { title: 'Text and image video', body: 'Generate new shots from prompts or start images with optional end frames.', tone: 'reference' },
      { title: 'Audio-to-video', body: 'Use an uploaded audio file as timing input when sound drives the motion.', tone: 'audio' },
      { title: 'Extend', body: 'Continue a source video at the start or end with context controls.', tone: 'duration' },
      { title: 'Retake', body: 'Replace a selected section instead of regenerating the full clip.', tone: 'continuity' },
      { title: 'Up to 4K generate', body: 'Use higher resolutions for approved generate passes.', tone: 'quality' },
      { title: 'Pay-as-you-go', body: 'See exact live price before you generate.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Pro or Fast?',
        body: 'Use Fast for simple draft loops. Use Pro when the job needs audio input, extension, retake or higher-resolution production control.',
        cta: { label: 'Compare Fast vs Pro', href: compareHref('en', 'ltx-2-3-pro', 'ltx-2-3-fast') },
      },
      {
        title: 'Fixing a partial clip?',
        body: 'Use Extend when you need more footage, or Retake when one section needs replacement.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Comparing production engines?',
        body: 'Compare LTX 2.3 Pro with Veo 3.1 when deciding between editorial controls and premium short-video polish.',
        cta: { label: 'Compare LTX Pro vs Veo', href: compareHref('en', 'ltx-2-3-pro', 'veo-3-1') },
      },
    ],
    referenceWorkflows: [
      { title: 'Generate video', body: 'Use text or a start image for the base shot, with optional end-frame guidance.' },
      { title: 'Audio-to-video', body: 'Upload audio when rhythm, dialogue or music should drive the visual timing.' },
      { title: 'Extend', body: 'Continue a source clip before or after the current footage.' },
      { title: 'Retake', body: 'Target a broken time window and replace audio, video or both.' },
      { title: 'Final pass', body: 'Use higher-resolution generate settings after the route and prompt are approved.' },
    ],
    pricingCopy: {
      title: 'LTX 2.3 Pro pricing at a glance',
      subtitle: 'Preset production totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: '20s route; generate presets vary by mode',
    },
    meta: {
      title: 'LTX 2.3 Pro: Pricing, Audio, Extend & Retake | MaxVideoAI',
      description:
        'Use LTX 2.3 Pro for production LTX video workflows: audio-to-video, Extend, Retake, image-to-video and higher-resolution generate passes.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'ROUTE LTX DE PRODUCTION',
      title: 'LTX 2.3 Pro',
      subtitle: 'Workflows pilotés par audio, contrôles Extend et Retake, et passes Generate 4K pour la production vidéo.',
      subtitleHighlights: ['workflows pilotés par audio', 'Extend et Retake', 'passes Generate 4K'],
      paragraph:
        'Utilisez LTX 2.3 Pro quand un job LTX dépasse le brouillon : génération texte ou image, audio-to-video, extension de vidéo source et retake ciblé dans une seule route de production.',
      primaryCta: { label: 'Générer avec LTX 2.3 Pro', href: '/app?engine=ltx-2-3' },
      secondaryCta: { label: 'Voir les exemples', href: examplesHref('fr', 'ltx') },
      quickLinks: [
        { label: 'Comparer vs Fast', href: compareHref('fr', 'ltx-2-3-pro', 'ltx-2-3-fast') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'ltx-2-3-pro-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple LTX 2.3 Pro',
      description: 'Rendu de workflow production',
      renderLabel: 'Voir le rendu',
      badges: ['Audio', 'Retake', '4K'],
      altContext: 'rendu de workflow production LTX 2.3 Pro',
    },
    features: [
      { title: 'Texte et image vidéo', body: 'Générez depuis prompt ou image de départ, avec image de fin optionnelle.', tone: 'reference' },
      { title: 'Audio-to-video', body: 'Utilisez un fichier audio quand le son doit guider le timing.', tone: 'audio' },
      { title: 'Extend', body: 'Prolongez une vidéo source au début ou à la fin.', tone: 'duration' },
      { title: 'Retake', body: 'Remplacez une section au lieu de régénérer tout le clip.', tone: 'continuity' },
      { title: 'Generate jusqu’à 4K', body: 'Utilisez les hautes résolutions pour les passes validées.', tone: 'quality' },
      { title: 'Paiement à l’usage', body: 'Prix exact affiché avant génération.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Pro ou Fast ?',
        body: 'Utilisez Fast pour les brouillons simples. Choisissez Pro pour audio, extension, retake ou contrôle haute résolution.',
        cta: { label: 'Comparer Fast vs Pro', href: compareHref('fr', 'ltx-2-3-pro', 'ltx-2-3-fast') },
      },
      {
        title: 'Corriger une partie du clip ?',
        body: 'Utilisez Extend pour ajouter du métrage, ou Retake pour remplacer une section ciblée.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Comparer les routes production ?',
        body: 'Comparez LTX 2.3 Pro et Veo 3.1 entre contrôles éditoriaux et polish premium court.',
        cta: { label: 'Comparer LTX Pro vs Veo', href: compareHref('fr', 'ltx-2-3-pro', 'veo-3-1') },
      },
    ],
    referenceWorkflows: [
      { title: 'Generate video', body: 'Créez le plan depuis texte ou image de départ, avec image de fin optionnelle.' },
      { title: 'Audio-to-video', body: 'Chargez un audio quand rythme, dialogue ou musique doivent piloter l’image.' },
      { title: 'Extend', body: 'Continuez un clip source avant ou après le métrage existant.' },
      { title: 'Retake', body: 'Ciblez une fenêtre ratée et remplacez audio, vidéo ou les deux.' },
      { title: 'Passe finale', body: 'Passez en haute résolution une fois la route et le prompt validés.' },
    ],
    pricingCopy: {
      title: 'Prix LTX 2.3 Pro en un coup d’œil',
      subtitle: 'Prix totaux de production — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Route 20 s ; presets Generate selon le mode',
    },
    meta: {
      title: 'LTX 2.3 Pro : tarifs, audio, Extend et Retake | MaxVideoAI',
      description:
        'Utilisez LTX 2.3 Pro pour les workflows vidéo LTX de production : audio-to-video, Extend, Retake, image-to-video et passes Generate haute résolution.',
    },
  },
  es: {
    hero: {
      eyebrow: 'RUTA LTX DE PRODUCCIÓN',
      title: 'LTX 2.3 Pro',
      subtitle: 'Flujos guiados por audio, controles Extend y Retake, y pasadas Generate 4K para video de producción.',
      subtitleHighlights: ['flujos guiados por audio', 'Extend y Retake', 'pasadas Generate 4K'],
      paragraph:
        'Usa LTX 2.3 Pro cuando el trabajo LTX necesita más que un borrador: generación desde texto o imagen, audio-to-video, extensión de video fuente y retake selectivo en una ruta de producción.',
      primaryCta: { label: 'Generar con LTX 2.3 Pro', href: '/app?engine=ltx-2-3' },
      secondaryCta: { label: 'Ver ejemplos', href: examplesHref('es', 'ltx') },
      quickLinks: [
        { label: 'Comparar con Fast', href: compareHref('es', 'ltx-2-3-pro', 'ltx-2-3-fast') },
        { label: 'Ver precios', href: pricingHref('es', 'ltx-2-3-pro-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo LTX 2.3 Pro',
      description: 'Render de flujo de producción',
      renderLabel: 'Ver render',
      badges: ['Audio', 'Retake', '4K'],
      altContext: 'render de flujo de producción en LTX 2.3 Pro',
    },
    features: [
      { title: 'Texto e imagen a video', body: 'Genera desde prompt o imagen inicial, con cuadro final opcional.', tone: 'reference' },
      { title: 'Audio-to-video', body: 'Usa un audio cargado cuando el sonido debe guiar el timing.', tone: 'audio' },
      { title: 'Extend', body: 'Continúa un video fuente al inicio o al final.', tone: 'duration' },
      { title: 'Retake', body: 'Reemplaza una sección en vez de regenerar todo el clip.', tone: 'continuity' },
      { title: 'Generate hasta 4K', body: 'Usa mayor resolución para pasadas ya aprobadas.', tone: 'quality' },
      { title: 'Pago por uso', body: 'Ve el precio exacto antes de generar.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '¿Pro o Fast?',
        body: 'Usa Fast para borradores simples. Usa Pro cuando necesitas audio, extensión, retake o control de producción en mayor resolución.',
        cta: { label: 'Comparar Fast vs Pro', href: compareHref('es', 'ltx-2-3-pro', 'ltx-2-3-fast') },
      },
      {
        title: '¿Arreglas parte de un clip?',
        body: 'Usa Extend cuando falta más metraje, o Retake cuando una sección necesita reemplazo.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: '¿Comparas motores de producción?',
        body: 'Compara LTX 2.3 Pro con Veo 3.1 al elegir entre controles editoriales y acabado premium corto.',
        cta: { label: 'Comparar LTX Pro vs Veo', href: compareHref('es', 'ltx-2-3-pro', 'veo-3-1') },
      },
    ],
    referenceWorkflows: [
      { title: 'Generate video', body: 'Crea la toma desde texto o imagen inicial, con cuadro final opcional.' },
      { title: 'Audio-to-video', body: 'Carga audio cuando ritmo, diálogo o música deben guiar la imagen.' },
      { title: 'Extend', body: 'Continúa un clip fuente antes o después del metraje actual.' },
      { title: 'Retake', body: 'Selecciona una ventana fallida y reemplaza audio, video o ambos.' },
      { title: 'Pasada final', body: 'Sube resolución cuando la ruta y el prompt ya estén aprobados.' },
    ],
    pricingCopy: {
      title: 'Precios de LTX 2.3 Pro de un vistazo',
      subtitle: 'Totales de producción por escenario. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Ruta de 20 s; presets Generate varían por modo',
    },
    meta: {
      title: 'LTX 2.3 Pro: precios, audio, Extend y Retake | MaxVideoAI',
      description:
        'Usa LTX 2.3 Pro para flujos LTX de producción: audio-to-video, Extend, Retake, imagen a video y pasadas Generate de mayor resolución.',
    },
  },
};

export const ADDITIONAL_TEMPLATE_COPY = {
  'kling-3-4k': KLING_3_4K_COPY,
  'kling-3-standard': KLING_3_STANDARD_COPY,
  'ltx-2-3-pro': LTX_23_PRO_COPY,
  'veo-3-1-fast': VEO_31_FAST_COPY,
  'veo-3-1-lite': VEO_31_LITE_COPY,
} satisfies Record<string, LocalizedTemplateCopy>;
