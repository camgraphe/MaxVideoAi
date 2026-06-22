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
      subtitle: 'Faster Veo drafts with optional native audio, reference-to-video runs, 4K output, and short concept loops.',
      subtitleHighlights: ['faster Veo drafts', 'optional native audio', '4K output'],
      paragraph:
        'Use Veo 3.1 Fast for quick text-to-video, image-to-video, reference-to-video, first-last frame tests, and 4K checks when you need lower-cost Veo iteration before moving approved shots into Veo 3.1.',
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
      badges: ['Fast route', '8s', '4K option'],
      altContext: 'Veo 3.1 Fast short concept draft',
    },
    features: [
      { title: 'Fast Veo drafts', body: 'Test concepts from 720p through 4K before paying for the main production route.', tone: 'quality' },
      { title: 'Optional audio', body: 'Toggle native audio on when timing or ambience needs a rough pass.', tone: 'audio' },
      { title: 'Reference-to-video', body: 'Attach 1-3 stills for an 8s consistency pass on identity, product or style.', tone: 'reference' },
      { title: 'First-last tests', body: 'Bridge approved opening and ending frames for short motion checks.', tone: 'reference' },
      { title: 'Extend support', body: 'Continue an existing Fast clip when a draft needs a pickup beat.', tone: 'duration' },
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
      { title: 'Reference-to-video', body: 'Attach 1-3 stills when identity, wardrobe, product or style continuity matters.' },
      { title: '4K check', body: 'Use 4K on selected Fast runs when you need to inspect detail before the production route.' },
      { title: 'First-last frames', body: 'Provide a landing frame when the ending pose or composition matters.' },
      { title: 'Audio toggle', body: 'Turn audio on for rough timing, or off when you only need visual motion.' },
    ],
    pricingCopy: {
      title: 'Veo 3.1 Fast pricing at a glance',
      subtitle: 'Preset draft totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'Up to 4K',
    },
    meta: {
      title: 'Veo 3.1 Fast: 4K Pricing, Drafts & Examples | MaxVideoAI',
      description:
        'Use Veo 3.1 Fast for faster Veo drafts up to 4K, optional native audio, first-last frame tests and lower-cost short concept loops before Veo 3.1 finals.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'ROUTE GOOGLE FAST VIDEO',
      title: 'Veo 3.1 Fast',
      subtitle: 'Des brouillons Veo rapides avec audio natif optionnel, reference-to-video, sortie 4K et boucles courtes.',
      subtitleHighlights: ['brouillons Veo rapides', 'audio natif optionnel', 'sortie 4K'],
      paragraph:
        'Utilisez Veo 3.1 Fast pour tester vite en texte-vidéo, image-vidéo, reference-to-video, première-dernière image et checks 4K avant de passer les plans retenus dans Veo 3.1.',
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
      badges: ['Fast', '8 s', 'Option 4K'],
      altContext: 'brouillon court Veo 3.1 Fast',
    },
    features: [
      { title: 'Brouillons Veo rapides', body: 'Testez les concepts de 720p à 4K avant la route de production principale.', tone: 'quality' },
      { title: 'Audio optionnel', body: 'Activez l’audio natif pour tester timing ou ambiance.', tone: 'audio' },
      { title: 'Reference-to-video', body: 'Ajoutez 1 à 3 stills pour une passe cohérence identité, produit ou style de 8 s.', tone: 'reference' },
      { title: 'Tests première-dernière', body: 'Reliez deux images approuvées pour contrôler une transition courte.', tone: 'reference' },
      { title: 'Extension', body: 'Prolongez un clip Fast existant quand le brouillon a besoin d’un beat en plus.', tone: 'duration' },
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
      { title: 'Reference-to-video', body: 'Ajoutez 1 à 3 stills quand identité, tenue, produit ou style doivent rester cohérents.' },
      { title: 'Check 4K', body: 'Utilisez la 4K sur les runs Fast retenus quand vous devez inspecter le détail.' },
      { title: 'Première-dernière image', body: 'Ajoutez une image d’arrivée quand la pose finale compte.' },
      { title: 'Audio', body: 'Activez l’audio pour le timing, ou coupez-le pour un test purement visuel.' },
    ],
    pricingCopy: {
      title: 'Prix Veo 3.1 Fast en un coup d’œil',
      subtitle: 'Prix totaux par scénario de brouillon — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Jusqu’à 4K',
    },
    meta: {
      title: 'Veo 3.1 Fast : tarifs 4K, brouillons et exemples | MaxVideoAI',
      description:
        'Utilisez Veo 3.1 Fast pour des brouillons Veo rapides jusqu’en 4K, audio natif optionnel, tests première-dernière image et boucles courtes.',
    },
  },
  es: {
    hero: {
      eyebrow: 'RUTA GOOGLE FAST VIDEO',
      title: 'Veo 3.1 Fast',
      subtitle: 'Borradores Veo más rápidos con audio nativo opcional, reference-to-video, salida 4K y loops cortos.',
      subtitleHighlights: ['borradores Veo más rápidos', 'audio nativo opcional', 'salida 4K'],
      paragraph:
        'Usa Veo 3.1 Fast para probar rápido texto a video, imagen a video, reference-to-video, primer-último cuadro y checks 4K antes de pasar las tomas aprobadas a Veo 3.1.',
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
      badges: ['Fast', '8 s', 'Opción 4K'],
      altContext: 'borrador corto de concepto con Veo 3.1 Fast',
    },
    features: [
      { title: 'Borradores Veo rápidos', body: 'Prueba conceptos de 720p a 4K antes de la ruta principal de producción.', tone: 'quality' },
      { title: 'Audio opcional', body: 'Activa audio nativo cuando necesitas probar ritmo o ambiente.', tone: 'audio' },
      { title: 'Reference-to-video', body: 'Adjunta 1 a 3 stills para una pasada de consistencia de 8 s en identidad, producto o estilo.', tone: 'reference' },
      { title: 'Primer-último cuadro', body: 'Conecta cuadros aprobados para revisar una transición corta.', tone: 'reference' },
      { title: 'Extensión', body: 'Continúa un clip Fast existente cuando el borrador necesita un beat extra.', tone: 'duration' },
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
      { title: 'Reference-to-video', body: 'Adjunta 1 a 3 stills cuando identidad, vestuario, producto o estilo deben mantenerse coherentes.' },
      { title: 'Check 4K', body: 'Usa 4K en runs Fast seleccionados cuando necesites revisar detalle.' },
      { title: 'Primer-último cuadro', body: 'Agrega un cuadro final cuando importan la pose o composición de llegada.' },
      { title: 'Audio', body: 'Actívalo para probar timing, o apágalo si solo necesitas movimiento visual.' },
    ],
    pricingCopy: {
      title: 'Precios de Veo 3.1 Fast de un vistazo',
      subtitle: 'Precios totales por escenario de borrador. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Hasta 4K',
    },
    meta: {
      title: 'Veo 3.1 Fast: precios 4K, borradores y ejemplos | MaxVideoAI',
      description:
        'Usa Veo 3.1 Fast para borradores Veo rápidos hasta 4K, audio nativo opcional, pruebas de primer-último cuadro y loops cortos.',
    },
  },
};

const VEO_31_LITE_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'GOOGLE LOWER-COST VIDEO ROUTE',
      title: 'Veo 3.1 Lite',
      subtitle: 'Lower-cost Veo drafts with optional native audio, short prompt tests, and simple image-to-video checks.',
      subtitleHighlights: ['lower-cost Veo drafts', 'optional native audio', 'short prompt tests'],
      paragraph:
        'Use Veo 3.1 Lite when you need the cheapest Veo 3.1 route for short drafts, timing checks and prompt comparisons before upgrading winners to Fast or Veo 3.1.',
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
      description: 'Lower-cost Veo draft with optional audio',
      renderLabel: 'View draft',
      badges: ['Optional audio', '8s', '720p'],
      altContext: 'Veo 3.1 Lite short audio-ready draft',
    },
    features: [
      { title: 'Lower-cost Veo', body: 'Use Lite for the cheapest Veo timing and prompt checks.', tone: 'price' },
      { title: 'Optional audio', body: 'Toggle native audio on for ambience or off for lower-cost visual tests.', tone: 'audio' },
      { title: 'Text or image', body: 'Start from a prompt or a single visual reference.', tone: 'reference' },
      { title: 'First-last tests', body: 'Use paired frames when the ending composition matters.', tone: 'continuity' },
      { title: 'Max 8s', body: 'Keep tests short and focused on one clear beat.', tone: 'duration' },
      { title: '720p or 1080p', body: 'Choose a cost/quality level before generation.', tone: 'quality' },
    ],
    decisionCards: [
      {
        title: 'Lite or Fast?',
        body: 'Use Lite for the lowest-cost Veo drafts. Use Fast when you need reference-to-video control or broader iteration controls.',
        cta: { label: 'Compare Lite vs Fast', href: compareHref('en', 'veo-3-1-lite', 'veo-3-1-fast') },
      },
      {
        title: 'Need audio timing?',
        body: 'When audio is enabled, write short ambience, SFX or dialogue cues into the prompt instead of leaving sound vague.',
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
      { title: 'Audio cue', body: 'Keep ambience or dialogue short when audio is enabled.' },
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
      title: 'Veo 3.1 Lite: Pricing, Optional Audio & Examples | MaxVideoAI',
      description:
        'Use Veo 3.1 Lite for lower-cost Veo drafts with optional native audio, short prompt tests and image-to-video checks before upgrading winners.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'ROUTE GOOGLE VIDEO À MOINDRE COÛT',
      title: 'Veo 3.1 Lite',
      subtitle: 'Des brouillons Veo à moindre coût avec audio natif optionnel, tests de prompts courts et contrôles image-vidéo simples.',
      subtitleHighlights: ['brouillons Veo à moindre coût', 'audio natif optionnel', 'tests de prompts courts'],
      paragraph:
        'Utilisez Veo 3.1 Lite pour la route Veo 3.1 la moins coûteuse : brouillons courts, tests de rythme et comparaisons de prompts avant de monter les gagnants vers Fast ou Veo 3.1.',
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
      description: 'Brouillon Veo avec audio optionnel',
      renderLabel: 'Voir le brouillon',
      badges: ['Audio optionnel', '8 s', '720p'],
      altContext: 'brouillon court Veo 3.1 Lite avec audio',
    },
    features: [
      { title: 'Veo à moindre coût', body: 'Utilisez Lite pour les tests Veo les plus économiques.', tone: 'price' },
      { title: 'Audio optionnel', body: 'Activez l’audio natif pour l’ambiance ou coupez-le pour un test visuel moins cher.', tone: 'audio' },
      { title: 'Texte ou image', body: 'Démarrez depuis un prompt ou une seule référence visuelle.', tone: 'reference' },
      { title: 'Première-dernière', body: 'Utilisez deux images quand la composition finale compte.', tone: 'continuity' },
      { title: 'Max 8 s', body: 'Gardez les tests courts et centrés sur un beat.', tone: 'duration' },
      { title: '720p ou 1080p', body: 'Choisissez le niveau coût/qualité avant génération.', tone: 'quality' },
    ],
    decisionCards: [
      {
        title: 'Lite ou Fast ?',
        body: 'Utilisez Lite pour les brouillons Veo les moins chers. Choisissez Fast pour le reference-to-video ou des contrôles plus larges.',
        cta: { label: 'Comparer Lite vs Fast', href: compareHref('fr', 'veo-3-1-lite', 'veo-3-1-fast') },
      },
      {
        title: 'Besoin de timing audio ?',
        body: 'Quand l’audio est activé, écrivez des cues courts d’ambiance, de SFX ou de dialogue dans le prompt.',
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
      { title: 'Cue audio', body: 'Gardez ambiance ou dialogue courts quand l’audio est activé.' },
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
      title: 'Veo 3.1 Lite : tarifs, audio optionnel et exemples | MaxVideoAI',
      description:
        'Utilisez Veo 3.1 Lite pour des brouillons Veo à moindre coût avec audio natif optionnel, tests de prompts courts et contrôles image-vidéo.',
    },
  },
  es: {
    hero: {
      eyebrow: 'RUTA GOOGLE VIDEO DE MENOR COSTE',
      title: 'Veo 3.1 Lite',
      subtitle: 'Borradores Veo de menor coste con audio nativo opcional, pruebas cortas de prompt y checks simples de imagen a video.',
      subtitleHighlights: ['borradores Veo de menor coste', 'audio nativo opcional', 'pruebas cortas de prompt'],
      paragraph:
        'Usa Veo 3.1 Lite cuando necesitas la ruta Veo 3.1 más económica para borradores cortos, pruebas de ritmo y comparación de prompts antes de subir ganadores a Fast o Veo 3.1.',
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
      description: 'Borrador Veo con audio opcional',
      renderLabel: 'Ver borrador',
      badges: ['Audio opcional', '8 s', '720p'],
      altContext: 'borrador corto con audio en Veo 3.1 Lite',
    },
    features: [
      { title: 'Veo de menor coste', body: 'Usa Lite para los checks Veo más económicos.', tone: 'price' },
      { title: 'Audio opcional', body: 'Activa audio nativo para ambiente o apágalo para pruebas visuales de menor coste.', tone: 'audio' },
      { title: 'Texto o imagen', body: 'Empieza desde un prompt o una sola referencia visual.', tone: 'reference' },
      { title: 'Primer-último cuadro', body: 'Usa dos cuadros cuando la composición final importa.', tone: 'continuity' },
      { title: 'Max 8 s', body: 'Mantén las pruebas cortas y enfocadas en un beat claro.', tone: 'duration' },
      { title: '720p o 1080p', body: 'Elige nivel de coste/calidad antes de generar.', tone: 'quality' },
    ],
    decisionCards: [
      {
        title: '¿Lite o Fast?',
        body: 'Usa Lite para los borradores Veo más económicos. Usa Fast si necesitas reference-to-video o más controles.',
        cta: { label: 'Comparar Lite vs Fast', href: compareHref('es', 'veo-3-1-lite', 'veo-3-1-fast') },
      },
      {
        title: '¿Necesitas ritmo de audio?',
        body: 'Cuando el audio está activado, escribe cues breves de ambiente, SFX o diálogo en el prompt.',
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
      { title: 'Cue de audio', body: 'Mantén ambiente o diálogo cortos cuando el audio está activado.' },
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
      title: 'Veo 3.1 Lite: precios, audio opcional y ejemplos | MaxVideoAI',
      description:
        'Usa Veo 3.1 Lite para borradores Veo de menor coste con audio nativo opcional, pruebas cortas de prompt y checks de imagen a video.',
    },
  },
};

const KLING_3_STANDARD_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'KLING LOWER-COST STORYBOARD ROUTE',
      title: 'Kling 3 Standard',
      subtitle: 'Multi-shot drafts for 1080p start-frame tests, prompt planning, and native audio options.',
      subtitleHighlights: ['multi-shot drafts', '1080p start-frame tests', 'native audio options'],
      paragraph:
        'Use Kling 3 Standard when you want lower-cost Kling 3 start-frame testing in 1080p: structured prompts, image-to-video drafts, optional end frames and audio before moving winners into Pro.',
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
      description: 'Lower-cost start-frame draft',
      renderLabel: 'View draft',
      badges: ['1080p', '15s max', 'Audio option'],
      altContext: 'Kling 3 Standard start-frame draft',
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
        body: 'Use Standard for lower-cost start-frame testing. Use Kling 3 Pro when the approved shot needs stronger final fidelity.',
        cta: { label: 'Compare Standard vs Pro', href: compareHref('en', 'kling-3-standard', 'kling-3-pro') },
      },
      {
        title: 'Planning multiple shots?',
        body: 'Keep each beat short, assign one action per shot, and reuse continuity anchors across the sequence.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Need final delivery?',
        body: 'Validate in Standard first, then move approved shots into Pro when fidelity, stability and final-quality approval matter more.',
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
        'Use Kling 3 Standard for lower-cost 1080p start-frame drafts, image-to-video tests, native audio options and 15 second Kling planning.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'ROUTE KLING STORYBOARD À MOINDRE COÛT',
      title: 'Kling 3 Standard',
      subtitle: 'Des brouillons multi-plans pour tests start-frame 1080p, planification de prompts et options audio natives.',
      subtitleHighlights: ['brouillons multi-plans', 'tests start-frame 1080p', 'options audio natives'],
      paragraph:
        'Utilisez Kling 3 Standard pour tester des start frames Kling 3 à moindre coût en 1080p : prompts structurés, brouillons image-vidéo, image de fin optionnelle et audio avant de passer les gagnants en Pro.',
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
      description: 'Brouillon start-frame à moindre coût',
      renderLabel: 'Voir le brouillon',
      badges: ['1080p', '15 s max', 'Audio optionnel'],
      altContext: 'brouillon start-frame Kling 3 Standard',
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
        body: 'Utilisez Standard pour les tests start-frame à moindre coût. Passez à Kling 3 Pro pour une fidélité finale plus forte.',
        cta: { label: 'Comparer Standard vs Pro', href: compareHref('fr', 'kling-3-standard', 'kling-3-pro') },
      },
      {
        title: 'Plusieurs plans à structurer ?',
        body: 'Gardez chaque beat court, une action par plan, et répétez les ancres de continuité.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Besoin d’une livraison finale ?',
        body: 'Validez d’abord en Standard, puis passez les plans approuvés en Pro quand fidélité, stabilité et qualité finale priment.',
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
        'Utilisez Kling 3 Standard pour des brouillons start-frame 1080p à moindre coût, tests image-vidéo, options audio natives et séquences Kling jusqu’à 15 s.',
    },
  },
  es: {
    hero: {
      eyebrow: 'RUTA KLING STORYBOARD DE MENOR COSTE',
      title: 'Kling 3 Standard',
      subtitle: 'Borradores multi-shot para pruebas start-frame 1080p, planificación de prompts y opciones de audio nativo.',
      subtitleHighlights: ['borradores multi-shot', 'pruebas start-frame 1080p', 'opciones de audio nativo'],
      paragraph:
        'Usa Kling 3 Standard para probar start frames Kling 3 de menor coste en 1080p: prompts estructurados, borradores imagen a video, cuadro final opcional y audio antes de pasar ganadores a Pro.',
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
      description: 'Borrador start-frame de menor coste',
      renderLabel: 'Ver borrador',
      badges: ['1080p', '15 s max', 'Audio opcional'],
      altContext: 'borrador start-frame con Kling 3 Standard',
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
        body: 'Usa Standard para pruebas start-frame de menor coste. Usa Kling 3 Pro cuando la toma aprobada necesite más fidelidad final.',
        cta: { label: 'Comparar Standard vs Pro', href: compareHref('es', 'kling-3-standard', 'kling-3-pro') },
      },
      {
        title: '¿Planeas varias tomas?',
        body: 'Mantén cada beat corto, una acción por toma y repite anclas de continuidad.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: '¿Necesitas entrega final?',
        body: 'Valida primero en Standard y pasa tomas aprobadas a Pro cuando importen más fidelidad, estabilidad y calidad final.',
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
        'Usa Kling 3 Standard para borradores start-frame 1080p de menor coste, pruebas imagen a video, opciones de audio y planificación Kling hasta 15 s.',
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
        'Use Kling 3 4K after the prompt or start frame is approved and the shot needs native 4K output for delivery, editing or large-screen review. Use Kling 3.0 Omni 4K when references should guide the shot without opening it.',
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
        'Utilisez Kling 3 4K une fois le prompt ou la start frame validé, quand le plan doit sortir en 4K native pour livraison, montage ou revue grand format. Utilisez Kling 3.0 Omni 4K quand les references doivent guider le plan sans l ouvrir.',
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
        'Usa Kling 3 4K cuando el prompt o start frame ya estan aprobados y la toma necesita salida 4K nativa para entrega, edicion o revision en pantalla grande. Usa Kling 3.0 Omni 4K cuando las referencias deben guiar el plano sin abrirlo.',
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
      badges: ['Generate', 'Audio on', '16:9'],
      altContext: 'LTX 2.3 Pro cinematic generate render',
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
      badges: ['Generate', 'Audio activé', '16:9'],
      altContext: 'rendu cinématique Generate LTX 2.3 Pro',
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
      badges: ['Generate', 'Audio activado', '16:9'],
      altContext: 'render cinematográfico Generate con LTX 2.3 Pro',
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

const LTX_2_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'SUPPORTED LTX 2 PRO ROUTE',
      title: 'LTX 2',
      subtitle:
        'High-fidelity 16:9 clips for text-to-video or image-to-video, with 1080p to 4K checks on the supported older LTX route.',
      subtitleHighlights: ['High-fidelity 16:9 clips', 'text-to-video or image-to-video', '1080p to 4K checks'],
      paragraph:
        'Use LTX 2 when you need the supported older Pro LTX route for short 6-10s 16:9 clips, image starts, negative prompts, seed control and high-res checks. Use LTX 2.3 Pro for the current production workflow.',
      primaryCta: { label: 'Generate with LTX 2', href: '/app?engine=ltx-2' },
      secondaryCta: { label: 'View examples', href: examplesHref('en', 'ltx') },
      quickLinks: [
        { label: 'View LTX 2.3 Pro', href: modelsHref('en', 'ltx-2-3-pro') },
        { label: 'View pricing', href: pricingHref('en', 'ltx-2-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'LTX 2 example',
      description: 'High-fidelity 16:9 render',
      renderLabel: 'View render',
      badges: ['Audio on', '10s', '16:9'],
      altContext: 'LTX 2 high-fidelity 16:9 video render',
    },
    features: [
      { title: '16:9 fidelity', body: 'Use LTX 2 for short landscape clips that need a clean premium look.', tone: 'quality' },
      { title: 'Text or image start', body: 'Start from a prompt or a single still reference for image-to-video.', tone: 'reference' },
      { title: '1080p to 4K', body: 'Check approved prompts at higher resolutions when the shot needs detail.', tone: 'quality' },
      { title: '25 or 50 fps', body: 'Choose the frame-rate option exposed by the MaxVideoAI route.', tone: 'duration' },
      { title: 'Max 10s', body: 'Keep this older route focused on concise one-beat renders.', tone: 'duration' },
      { title: 'Pay-as-you-go', body: 'See exact live price before you generate.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'LTX 2 or LTX 2.3 Pro?',
        body: 'Use LTX 2 for older high-fidelity 16:9 clips. Use LTX 2.3 Pro when you want the current LTX production route and broader workflow surface.',
        cta: { label: 'View LTX 2.3 Pro', href: modelsHref('en', 'ltx-2-3-pro') },
      },
      {
        title: 'Need a faster LTX draft?',
        body: 'Use LTX 2 Fast for longer low-cost 16:9 draft loops before deciding whether a shot deserves a higher-fidelity pass.',
        cta: { label: 'View LTX 2 Fast', href: modelsHref('en', 'ltx-2-fast') },
      },
      {
        title: 'Comparing premium engines?',
        body: 'Compare LTX 2 with Veo 3.1 when choosing between older LTX high-res checks and current premium short-video routes.',
        cta: { label: 'Compare LTX 2 vs Veo 3.1', href: compareHref('en', 'ltx-2', 'veo-3-1') },
      },
      {
        title: 'Need prompt examples?',
        body: 'Start with a compact subject, action, camera and negative prompt structure before spending on high-res checks.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
    ],
    referenceWorkflows: [
      { title: 'Text prompt', body: 'Write one subject, one visible action, one camera move and the intended finish.' },
      { title: 'Start image', body: 'Use one clean still when product shape, framing or identity must stay stable.' },
      { title: 'Negative prompt', body: 'Block visual artifacts or unwanted style cues instead of adding more positive instructions.' },
      { title: 'Seed check', body: 'Reuse seed control when you need comparable variants from the same creative direction.' },
      { title: 'High-res pass', body: 'Move from 1080p checks to 1440p or 4K only after the motion direction is approved.' },
    ],
    pricingCopy: {
      title: 'LTX 2 pricing at a glance',
      subtitle: 'Preset supported-route totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: '6-10s route; up to 4K',
    },
    meta: {
      title: 'LTX 2: Pricing, 4K Clips & Examples | MaxVideoAI',
      description:
        'Use LTX 2 for supported older LTX high-fidelity 16:9 clips, text-to-video, image-to-video, 1080p to 4K checks, pricing and examples.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'ROUTE LTX 2 PRO ENCORE PRISE EN CHARGE',
      title: 'LTX 2',
      subtitle:
        'Clips 16:9 haute fidélité en text-to-video ou image-to-video, avec checks 1080p à 4K sur l’ancienne route LTX prise en charge.',
      subtitleHighlights: ['Clips 16:9 haute fidélité', 'text-to-video ou image-to-video', 'checks 1080p à 4K'],
      paragraph:
        'Utilisez LTX 2 pour l’ancienne route Pro LTX encore prise en charge : clips 16:9 courts de 6 à 10 s, image de départ, negative prompt, seed et vérifications haute résolution. Gardez LTX 2.3 Pro pour le workflow production actuel.',
      primaryCta: { label: 'Générer avec LTX 2', href: '/app?engine=ltx-2' },
      secondaryCta: { label: 'Voir les exemples', href: examplesHref('fr', 'ltx') },
      quickLinks: [
        { label: 'Voir LTX 2.3 Pro', href: modelsHref('fr', 'ltx-2-3-pro') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'ltx-2-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple LTX 2',
      description: 'Rendu 16:9 haute fidélité',
      renderLabel: 'Voir le rendu',
      badges: ['Audio activé', '10 s', '16:9'],
      altContext: 'rendu video 16:9 haute fidelite avec LTX 2',
    },
    features: [
      { title: 'Fidélité 16:9', body: 'Réservez LTX 2 aux plans paysage courts avec un rendu premium propre.', tone: 'quality' },
      { title: 'Texte ou image source', body: 'Démarrez depuis un prompt ou une image fixe unique pour l’image-to-video.', tone: 'reference' },
      { title: '1080p à 4K', body: 'Passez en haute résolution quand le mouvement du plan est déjà validé.', tone: 'quality' },
      { title: '25 ou 50 fps', body: 'Choisissez l’option de frame rate exposée dans MaxVideoAI.', tone: 'duration' },
      { title: 'Max 10 s', body: 'Gardez cette route plus ancienne sur des rendus courts en un beat.', tone: 'duration' },
      { title: 'Paiement à l’usage', body: 'Prix exact affiché avant génération.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'LTX 2 ou LTX 2.3 Pro ?',
        body: 'Utilisez LTX 2 pour des clips 16:9 haute fidélité sur l’ancienne route. Passez à LTX 2.3 Pro pour la route LTX production actuelle.',
        cta: { label: 'Voir LTX 2.3 Pro', href: modelsHref('fr', 'ltx-2-3-pro') },
      },
      {
        title: 'Besoin d’un draft LTX plus rapide ?',
        body: 'Utilisez LTX 2 Fast pour des boucles 16:9 plus longues et moins chères avant de relancer un plan en meilleure fidélité.',
        cta: { label: 'Voir LTX 2 Fast', href: modelsHref('fr', 'ltx-2-fast') },
      },
      {
        title: 'Vous comparez des moteurs premium ?',
        body: 'Comparez LTX 2 et Veo 3.1 entre checks haute résolution LTX plus anciens et routes premium actuelles.',
        cta: { label: 'Comparer LTX 2 vs Veo 3.1', href: compareHref('fr', 'ltx-2', 'veo-3-1') },
      },
      {
        title: 'Besoin d’exemples de prompts ?',
        body: 'Partez d’une structure courte : sujet, action, caméra et negative prompt avant de payer un check haute résolution.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt texte', body: 'Décrivez un sujet, une action visible, un mouvement caméra et le rendu attendu.' },
      { title: 'Image de départ', body: 'Utilisez une image nette quand produit, cadrage ou identité doivent rester stables.' },
      { title: 'Negative prompt', body: 'Bloquez les artefacts ou styles indésirables au lieu d’empiler des consignes positives.' },
      { title: 'Seed', body: 'Réutilisez le seed pour comparer des variantes issues de la même direction créative.' },
      { title: 'Passe haute résolution', body: 'Montez en 1440p ou 4K seulement après validation du mouvement.' },
    ],
    pricingCopy: {
      title: 'Prix LTX 2 en un coup d’œil',
      subtitle: 'Totaux pour cette route prise en charge — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Route 6-10 s ; jusqu’à 4K',
    },
    meta: {
      title: 'LTX 2 : tarifs, clips 4K et exemples | MaxVideoAI',
      description:
        'Utilisez LTX 2 pour des clips 16:9 haute fidélité encore pris en charge, text-to-video, image-to-video, checks 1080p à 4K, tarifs et exemples.',
    },
  },
  es: {
    hero: {
      eyebrow: 'RUTA LTX 2 PRO AUN COMPATIBLE',
      title: 'LTX 2',
      subtitle:
        'Clips 16:9 de alta fidelidad para texto a video o imagen a video, con checks de 1080p a 4K en la ruta LTX anterior compatible.',
      subtitleHighlights: ['Clips 16:9 de alta fidelidad', 'texto a video o imagen a video', 'checks de 1080p a 4K'],
      paragraph:
        'Usa LTX 2 cuando necesites la ruta Pro anterior de LTX: clips 16:9 cortos de 6 a 10 s, imagen inicial, negative prompt, seed y revisiones en alta resolución. Usa LTX 2.3 Pro para el flujo de producción actual.',
      primaryCta: { label: 'Generar con LTX 2', href: '/app?engine=ltx-2' },
      secondaryCta: { label: 'Ver ejemplos', href: examplesHref('es', 'ltx') },
      quickLinks: [
        { label: 'Ver LTX 2.3 Pro', href: modelsHref('es', 'ltx-2-3-pro') },
        { label: 'Ver precios', href: pricingHref('es', 'ltx-2-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo LTX 2',
      description: 'Render 16:9 de alta fidelidad',
      renderLabel: 'Ver render',
      badges: ['Audio activo', '10 s', '16:9'],
      altContext: 'render de video 16:9 de alta fidelidad con LTX 2',
    },
    features: [
      { title: 'Fidelidad 16:9', body: 'Usa LTX 2 para clips landscape cortos con look premium limpio.', tone: 'quality' },
      { title: 'Texto o imagen inicial', body: 'Empieza desde un prompt o una imagen fija para imagen a video.', tone: 'reference' },
      { title: '1080p a 4K', body: 'Sube resolución cuando la dirección de movimiento ya está aprobada.', tone: 'quality' },
      { title: '25 o 50 fps', body: 'Elige la opción de frame rate disponible en la ruta de MaxVideoAI.', tone: 'duration' },
      { title: 'Máx. 10 s', body: 'Mantén esta ruta anterior enfocada en renders cortos de un beat.', tone: 'duration' },
      { title: 'Pago por uso', body: 'Ve el precio exacto antes de generar.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '¿LTX 2 o LTX 2.3 Pro?',
        body: 'Usa LTX 2 para clips 16:9 de alta fidelidad en la ruta anterior. Usa LTX 2.3 Pro cuando necesitas la ruta LTX de producción actual.',
        cta: { label: 'Ver LTX 2.3 Pro', href: modelsHref('es', 'ltx-2-3-pro') },
      },
      {
        title: '¿Necesitas un borrador LTX más rápido?',
        body: 'Usa LTX 2 Fast para loops 16:9 más largos y de menor coste antes de decidir si la toma merece una pasada con más fidelidad.',
        cta: { label: 'Ver LTX 2 Fast', href: modelsHref('es', 'ltx-2-fast') },
      },
      {
        title: '¿Comparas motores premium?',
        body: 'Compara LTX 2 con Veo 3.1 al elegir entre checks antiguos de alta resolución y rutas premium actuales.',
        cta: { label: 'Comparar LTX 2 vs Veo 3.1', href: compareHref('es', 'ltx-2', 'veo-3-1') },
      },
      {
        title: '¿Necesitas ejemplos de prompts?',
        body: 'Empieza con una estructura corta: sujeto, acción, cámara y negative prompt antes de pagar checks en alta resolución.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt de texto', body: 'Describe un sujeto, una acción visible, un movimiento de cámara y el acabado esperado.' },
      { title: 'Imagen inicial', body: 'Usa una imagen limpia cuando producto, encuadre o identidad deban mantenerse estables.' },
      { title: 'Negative prompt', body: 'Bloquea artefactos o estilos no deseados sin sumar demasiadas instrucciones positivas.' },
      { title: 'Seed', body: 'Reutiliza seed para comparar variantes dentro de la misma dirección creativa.' },
      { title: 'Pasada en alta resolución', body: 'Pasa a 1440p o 4K solo cuando el movimiento ya esté aprobado.' },
    ],
    pricingCopy: {
      title: 'Precios de LTX 2 de un vistazo',
      subtitle: 'Totales para esta ruta compatible. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Ruta de 6-10 s; hasta 4K',
    },
    meta: {
      title: 'LTX 2: precios, clips 4K y ejemplos | MaxVideoAI',
      description:
        'Usa LTX 2 para clips 16:9 de alta fidelidad aún compatibles, texto a video, imagen a video, checks de 1080p a 4K, precios y ejemplos.',
    },
  },
};

const LTX_2_FAST_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'SUPPORTED LTX 2 FAST ROUTE',
      title: 'LTX 2 Fast',
      subtitle: 'Fast 16:9 drafts up to 20s for text or image starts, audio-ready review passes, and 1080p to 4K checks.',
      subtitleHighlights: ['Fast 16:9 drafts', 'up to 20s', '1080p to 4K checks'],
      paragraph:
        'Use LTX 2 Fast for the supported older fast LTX route when you need low-cost 16:9 drafts, longer 20s timing checks, image starts and high-res review options. Use LTX 2.3 Fast for the current fast LTX workflow.',
      primaryCta: { label: 'Draft with LTX 2 Fast', href: '/app?engine=ltx-2-fast' },
      secondaryCta: { label: 'View examples', href: examplesHref('en', 'ltx') },
      quickLinks: [
        { label: 'View LTX 2.3 Fast', href: modelsHref('en', 'ltx-2-3-fast') },
        { label: 'View pricing', href: pricingHref('en', 'ltx-2-fast-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'LTX 2 Fast example',
      description: 'Fast 16:9 draft loop',
      renderLabel: 'View draft',
      badges: ['Fast route', '20s max', '16:9'],
      altContext: 'LTX 2 Fast 16:9 draft video render',
    },
    features: [
      { title: 'Fast 16:9 drafts', body: 'Move quickly through older LTX timing and composition checks.', tone: 'duration' },
      { title: 'Text or image start', body: 'Use a prompt or one still to test product, subject or scene setup.', tone: 'reference' },
      { title: 'Up to 20s', body: 'Use longer 1080p/25 fps loops when pacing matters more than polish.', tone: 'duration' },
      { title: '1080p to 4K', body: 'Shorter checks can still use high-res review settings.', tone: 'quality' },
      { title: 'Audio-ready', body: 'Use the audio-enabled route for timing and review passes.', tone: 'audio' },
      { title: 'Pay-as-you-go', body: 'See exact live price before you generate.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'LTX 2 Fast or LTX 2.3 Fast?',
        body: 'Use LTX 2 Fast for supported older 16:9 draft loops. Use LTX 2.3 Fast for the current fast LTX route and broader format coverage.',
        cta: { label: 'View LTX 2.3 Fast', href: modelsHref('en', 'ltx-2-3-fast') },
      },
      {
        title: 'Need higher fidelity?',
        body: 'Move approved draft directions into LTX 2 or LTX 2.3 Pro when the shot needs a more polished pass.',
        cta: { label: 'View LTX 2', href: modelsHref('en', 'ltx-2') },
      },
      {
        title: 'Comparing fast value routes?',
        body: 'Compare LTX 2 Fast with Wan 2.5 when choosing between longer 16:9 LTX loops and lower-cost audio checks.',
        cta: { label: 'Compare LTX 2 Fast vs Wan 2.5', href: compareHref('en', 'ltx-2-fast', 'wan-2-5') },
      },
      {
        title: 'Need prompt examples?',
        body: 'Use short draft prompts with one motion beat, one camera move and a clear review goal.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
    ],
    referenceWorkflows: [
      { title: 'Draft prompt', body: 'Keep one subject, one motion idea and one camera move so the fast route stays readable.' },
      { title: 'Image start', body: 'Use one still to lock the product, character or environment before testing motion.' },
      { title: 'Long loop', body: 'Use 12-20s only for 1080p timing checks where pacing matters more than detail.' },
      { title: 'High-res short check', body: 'Use 1440p or 4K on shorter clips when you need to inspect detail.' },
      { title: 'Upgrade path', body: 'Move winning directions into LTX 2.3 Fast or Pro depending on the current workflow needed.' },
    ],
    pricingCopy: {
      title: 'LTX 2 Fast draft pricing',
      subtitle: 'Preset draft totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: '20s at 1080p / 25 fps',
    },
    meta: {
      title: 'LTX 2 Fast: Pricing, 20s Drafts & Examples | MaxVideoAI',
      description:
        'Use LTX 2 Fast for supported older LTX 16:9 drafts, 20s timing checks, text-to-video, image-to-video, high-res review options and pricing.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'ROUTE LTX 2 FAST ENCORE PRISE EN CHARGE',
      title: 'LTX 2 Fast',
      subtitle:
        'Drafts 16:9 rapides jusqu’à 20 s pour texte ou image de départ, revues avec audio et checks 1080p à 4K.',
      subtitleHighlights: ['Drafts 16:9 rapides', 'jusqu’à 20 s', 'checks 1080p à 4K'],
      paragraph:
        'Utilisez LTX 2 Fast pour l’ancienne route fast LTX encore prise en charge : drafts 16:9 moins chers, tests de timing jusqu’à 20 s, image de départ et options haute résolution. Utilisez LTX 2.3 Fast pour le workflow fast LTX actuel.',
      primaryCta: { label: 'Drafter avec LTX 2 Fast', href: '/app?engine=ltx-2-fast' },
      secondaryCta: { label: 'Voir les exemples', href: examplesHref('fr', 'ltx') },
      quickLinks: [
        { label: 'Voir LTX 2.3 Fast', href: modelsHref('fr', 'ltx-2-3-fast') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'ltx-2-fast-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple LTX 2 Fast',
      description: 'Boucle draft 16:9 rapide',
      renderLabel: 'Voir le brouillon',
      badges: ['Fast', '20 s max', '16:9'],
      altContext: 'rendu video draft 16:9 avec LTX 2 Fast',
    },
    features: [
      { title: 'Drafts 16:9 rapides', body: 'Avancez vite sur timing et composition dans l’ancien workflow LTX.', tone: 'duration' },
      { title: 'Texte ou image source', body: 'Testez produit, sujet ou décor depuis un prompt ou une image fixe.', tone: 'reference' },
      { title: 'Jusqu’à 20 s', body: 'Utilisez les boucles 1080p/25 fps quand le pacing compte plus que le polish.', tone: 'duration' },
      { title: '1080p à 4K', body: 'Les tests plus courts peuvent aussi servir à vérifier le détail.', tone: 'quality' },
      { title: 'Audio-ready', body: 'Gardez le son actif quand le timing ou la revue en a besoin.', tone: 'audio' },
      { title: 'Paiement à l’usage', body: 'Prix exact affiché avant génération.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'LTX 2 Fast ou LTX 2.3 Fast ?',
        body: 'Utilisez LTX 2 Fast pour d’anciens drafts 16:9 encore pris en charge. Choisissez LTX 2.3 Fast pour la route fast actuelle et plus de formats.',
        cta: { label: 'Voir LTX 2.3 Fast', href: modelsHref('fr', 'ltx-2-3-fast') },
      },
      {
        title: 'Besoin de plus de fidélité ?',
        body: 'Déplacez les directions validées vers LTX 2 ou LTX 2.3 Pro quand le plan mérite une passe plus propre.',
        cta: { label: 'Voir LTX 2', href: modelsHref('fr', 'ltx-2') },
      },
      {
        title: 'Vous comparez des routes fast ?',
        body: 'Comparez LTX 2 Fast et Wan 2.5 entre boucles LTX 16:9 plus longues et checks audio moins chers.',
        cta: { label: 'Comparer LTX 2 Fast vs Wan 2.5', href: compareHref('fr', 'ltx-2-fast', 'wan-2-5') },
      },
      {
        title: 'Besoin d’exemples de prompts ?',
        body: 'Utilisez des prompts courts avec un beat de mouvement, une caméra et un objectif de revue clair.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt de draft', body: 'Gardez un sujet, une idée de mouvement et un mouvement caméra pour rester lisible.' },
      { title: 'Image de départ', body: 'Utilisez une image pour verrouiller produit, personnage ou environnement.' },
      { title: 'Boucle longue', body: 'Réservez 12-20 s aux tests 1080p où le rythme compte plus que le détail.' },
      { title: 'Check court haute résolution', body: 'Passez en 1440p ou 4K sur les clips courts quand il faut inspecter le détail.' },
      { title: 'Montée de gamme', body: 'Envoyez les directions gagnantes vers LTX 2.3 Fast ou Pro selon le workflow actuel recherché.' },
    ],
    pricingCopy: {
      title: 'Prix des drafts LTX 2 Fast',
      subtitle: 'Totaux de brouillon par scénario — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: '20 s en 1080p / 25 fps',
    },
    meta: {
      title: 'LTX 2 Fast : tarifs, drafts 20 s et exemples | MaxVideoAI',
      description:
        'Utilisez LTX 2 Fast pour des drafts 16:9 encore pris en charge, tests de timing 20 s, text-to-video, image-to-video, checks haute résolution et tarifs.',
    },
  },
  es: {
    hero: {
      eyebrow: 'RUTA LTX 2 FAST AUN COMPATIBLE',
      title: 'LTX 2 Fast',
      subtitle:
        'Borradores 16:9 rápidos de hasta 20 s para texto o imagen inicial, pases de revisión con audio y checks de 1080p a 4K.',
      subtitleHighlights: ['Borradores 16:9 rápidos', 'hasta 20 s', 'checks de 1080p a 4K'],
      paragraph:
        'Usa LTX 2 Fast para la ruta fast anterior de LTX cuando necesitas borradores 16:9 de menor coste, checks de timing de hasta 20 s, imagen inicial y opciones de revisión en alta resolución. Usa LTX 2.3 Fast para el flujo fast actual.',
      primaryCta: { label: 'Hacer draft con LTX 2 Fast', href: '/app?engine=ltx-2-fast' },
      secondaryCta: { label: 'Ver ejemplos', href: examplesHref('es', 'ltx') },
      quickLinks: [
        { label: 'Ver LTX 2.3 Fast', href: modelsHref('es', 'ltx-2-3-fast') },
        { label: 'Ver precios', href: pricingHref('es', 'ltx-2-fast-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo LTX 2 Fast',
      description: 'Loop de borrador 16:9 rápido',
      renderLabel: 'Ver borrador',
      badges: ['Fast', '20 s max', '16:9'],
      altContext: 'render de borrador 16:9 con LTX 2 Fast',
    },
    features: [
      { title: 'Borradores 16:9 rápidos', body: 'Avanza rápido en timing y composición dentro del workflow LTX anterior.', tone: 'duration' },
      { title: 'Texto o imagen inicial', body: 'Prueba producto, sujeto o escena desde un prompt o una imagen fija.', tone: 'reference' },
      { title: 'Hasta 20 s', body: 'Usa loops 1080p/25 fps cuando el pacing importa más que el acabado.', tone: 'duration' },
      { title: '1080p a 4K', body: 'Los checks cortos también sirven para revisar detalle en alta resolución.', tone: 'quality' },
      { title: 'Listo para audio', body: 'Usa la ruta con audio cuando el timing o la revisión lo requieran.', tone: 'audio' },
      { title: 'Pago por uso', body: 'Ve el precio exacto antes de generar.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '¿LTX 2 Fast o LTX 2.3 Fast?',
        body: 'Usa LTX 2 Fast para loops 16:9 anteriores aún compatibles. Usa LTX 2.3 Fast para la ruta fast actual y mayor cobertura de formatos.',
        cta: { label: 'Ver LTX 2.3 Fast', href: modelsHref('es', 'ltx-2-3-fast') },
      },
      {
        title: '¿Necesitas más fidelidad?',
        body: 'Lleva las direcciones aprobadas a LTX 2 o LTX 2.3 Pro cuando la toma necesite una pasada más pulida.',
        cta: { label: 'Ver LTX 2', href: modelsHref('es', 'ltx-2') },
      },
      {
        title: '¿Comparas rutas fast de valor?',
        body: 'Compara LTX 2 Fast con Wan 2.5 al elegir entre loops 16:9 más largos y checks con audio de menor coste.',
        cta: { label: 'Comparar LTX 2 Fast vs Wan 2.5', href: compareHref('es', 'ltx-2-fast', 'wan-2-5') },
      },
      {
        title: '¿Necesitas ejemplos de prompts?',
        body: 'Usa prompts cortos con un beat de movimiento, una cámara y un objetivo claro de revisión.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt de borrador', body: 'Mantén un sujeto, una idea de movimiento y un movimiento de cámara para que la ruta fast sea legible.' },
      { title: 'Imagen inicial', body: 'Usa una imagen para fijar producto, personaje o entorno antes de probar movimiento.' },
      { title: 'Loop largo', body: 'Reserva 12-20 s para checks 1080p donde el ritmo pesa más que el detalle.' },
      { title: 'Check corto en alta resolución', body: 'Usa 1440p o 4K en clips más cortos cuando necesitas inspeccionar detalle.' },
      { title: 'Ruta de mejora', body: 'Lleva las mejores direcciones a LTX 2.3 Fast o Pro según el workflow actual que necesites.' },
    ],
    pricingCopy: {
      title: 'Precios de drafts LTX 2 Fast',
      subtitle: 'Totales de borrador por escenario. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: '20 s en 1080p / 25 fps',
    },
    meta: {
      title: 'LTX 2 Fast: precios, borradores 20 s y ejemplos | MaxVideoAI',
      description:
        'Usa LTX 2 Fast para borradores 16:9 aún compatibles, checks de timing de 20 s, texto a video, imagen a video, revisión en alta resolución y precios.',
    },
  },
};

const SEEDANCE_15_PRO_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'SUPPORTED SEEDANCE LEGACY PRO ROUTE',
      title: 'Seedance 1.5 Pro',
      subtitle: 'Camera-fixed shots, seeded variants and start/end frame control for supported older Seedance workflows.',
      subtitleHighlights: ['Camera-fixed shots', 'seeded variants', 'start/end frame control'],
      paragraph:
        'Use Seedance 1.5 Pro when you need the older supported Seedance route: repeatable short clips, optional audio, seed control, camera-fixed setups and image-to-video landings. Use Seedance 2.0 for current 2.0 production work.',
      primaryCta: { label: 'Generate with Seedance 1.5 Pro', href: '/app?engine=seedance-1-5-pro' },
      secondaryCta: { label: 'View Seedance 2.0', href: modelsHref('en', 'seedance-2-0') },
      quickLinks: [
        { label: 'Compare vs Seedance 2.0', href: compareHref('en', 'seedance-1-5-pro', 'seedance-2-0') },
        { label: 'View pricing', href: pricingHref('en', 'seedance-1-5-pro-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Seedance 1.5 Pro example',
      description: 'Camera-fixed cinematic render',
      renderLabel: 'View render',
      badges: ['Audio on', '12s', '1080p'],
      altContext: 'camera-fixed Seedance 1.5 Pro cinematic render',
    },
    features: [
      { title: 'Camera fixed', body: 'Lock the shot when steadier motion matters more than dynamic camera moves.', tone: 'continuity' },
      { title: 'Seed control', body: 'Reuse a seed for repeatable variants and A/B creative passes.', tone: 'quality' },
      { title: 'Start/end frames', body: 'Guide image-to-video landings with an optional final frame.', tone: 'reference' },
      { title: 'Audio on/off', body: 'Generate with native sound, or switch audio off for lower-cost silent drafts.', tone: 'audio' },
      { title: '1080p on I2V', body: 'Use 1080p on image-to-video checks; text-to-video stays on 480p or 720p presets.', tone: 'quality' },
      { title: 'Pay-as-you-go', body: 'See exact live price before you generate.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Use 1.5 Pro or Seedance 2.0?',
        body: 'Use 1.5 Pro for legacy-compatible camera-fixed and seeded tests. Use Seedance 2.0 for the current native-audio production workflow.',
        cta: { label: 'Compare 1.5 Pro vs 2.0', href: compareHref('en', 'seedance-1-5-pro', 'seedance-2-0') },
      },
      {
        title: 'Need repeatable variants?',
        body: 'Keep one prompt structure, reuse seed control, then change only the action, timing or audio cue you are testing.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Planning final Seedance work?',
        body: 'Move current campaign finals to Seedance 2.0 when multi-shot continuity and broader references matter more.',
        cta: { label: 'Open Seedance 2.0', href: modelsHref('en', 'seedance-2-0') },
      },
    ],
    referenceWorkflows: [
      { title: 'Text prompt', body: 'Write one subject, one action, lighting, style and an optional audio cue.' },
      { title: 'Camera-fixed setup', body: 'Use camera_fixed for locked-off product, city or storyboard shots.' },
      { title: 'Image-to-video', body: 'Start from one image, then add an end frame when the landing pose matters.' },
      { title: 'Seeded variant', body: 'Reuse the same seed to compare small prompt changes without changing the whole look.' },
      { title: 'Upgrade path', body: 'Use Seedance 2.0 when the project needs the current 2.0 workflow.' },
    ],
    pricingCopy: {
      title: 'Seedance 1.5 Pro pricing at a glance',
      subtitle: 'Preset audio-on totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios. Audio-off routes may quote lower in the app.',
      ctaLabel: 'View full pricing',
      maxDurationNote: '1080p on I2V only',
    },
    meta: {
      title: 'Seedance 1.5 Pro: Pricing & Camera Fixed | MaxVideoAI',
      description:
        'Explore Seedance 1.5 Pro pricing, examples, camera-fixed shots, seed control, audio on/off and start/end frame workflows. Compare Seedance 1.5 Pro vs Seedance 2.0.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'ANCIENNE ROUTE SEEDANCE PRO PRISE EN CHARGE',
      title: 'Seedance 1.5 Pro',
      subtitle: 'Plans camera-fixed, variantes avec seed et contrôle image de départ/fin pour les anciens workflows Seedance.',
      subtitleHighlights: ['Plans camera-fixed', 'variantes avec seed', 'contrôle image de départ/fin'],
      paragraph:
        'Utilisez Seedance 1.5 Pro pour l’ancienne route Seedance encore prise en charge : clips courts répétables, audio optionnel, seed, camera_fixed et fins image-to-video. Passez à Seedance 2.0 pour la route actuelle.',
      primaryCta: { label: 'Générer avec Seedance 1.5 Pro', href: '/app?engine=seedance-1-5-pro' },
      secondaryCta: { label: 'Voir Seedance 2.0', href: modelsHref('fr', 'seedance-2-0') },
      quickLinks: [
        { label: 'Comparer vs Seedance 2.0', href: compareHref('fr', 'seedance-1-5-pro', 'seedance-2-0') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'seedance-1-5-pro-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Seedance 1.5 Pro',
      description: 'Rendu cinématographique camera-fixed',
      renderLabel: 'Voir le rendu',
      badges: ['Audio activé', '12 s', '1080p'],
      altContext: 'rendu cinématographique Seedance 1.5 Pro avec camera_fixed',
    },
    features: [
      { title: 'Camera fixed', body: 'Verrouillez le plan quand la stabilité prime sur le mouvement caméra.', tone: 'continuity' },
      { title: 'Contrôle seed', body: 'Réutilisez un seed pour des variantes répétables et des tests A/B.', tone: 'quality' },
      { title: 'Images départ/fin', body: 'Guidez la fin image-to-video avec une image finale optionnelle.', tone: 'reference' },
      { title: 'Audio on/off', body: 'Générez avec son natif ou coupez l’audio pour des brouillons moins chers.', tone: 'audio' },
      { title: '1080p en I2V', body: 'Utilisez le 1080p sur les checks image-to-video ; le texte-vidéo reste en presets 480p ou 720p.', tone: 'quality' },
      { title: 'Paiement à l’usage', body: 'Prix exact affiché avant génération.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '1.5 Pro ou Seedance 2.0 ?',
        body: 'Utilisez 1.5 Pro pour les tests camera_fixed et seedés hérités. Utilisez Seedance 2.0 pour la production actuelle avec audio natif.',
        cta: { label: 'Comparer 1.5 Pro vs 2.0', href: compareHref('fr', 'seedance-1-5-pro', 'seedance-2-0') },
      },
      {
        title: 'Besoin de variantes répétables ?',
        body: 'Gardez la même structure de prompt, réutilisez le seed, puis changez seulement l’action, le timing ou le son testé.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Vous préparez un rendu Seedance final ?',
        body: 'Passez les finales de campagne vers Seedance 2.0 si la continuité multi-plans et les références larges comptent davantage.',
        cta: { label: 'Ouvrir Seedance 2.0', href: modelsHref('fr', 'seedance-2-0') },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt texte', body: 'Écrivez un sujet, une action, lumière, style et un indice audio optionnel.' },
      { title: 'Setup camera_fixed', body: 'Utilisez camera_fixed pour les plans produit, ville ou storyboard verrouillés.' },
      { title: 'Image-to-video', body: 'Partez d’une image et ajoutez une image finale si la pose d’arrivée compte.' },
      { title: 'Variante seedée', body: 'Réutilisez le même seed pour comparer de petites variations sans changer tout le rendu.' },
      { title: 'Passage en 2.0', body: 'Utilisez Seedance 2.0 quand le projet demande la route Seedance actuelle.' },
    ],
    pricingCopy: {
      title: 'Prix Seedance 1.5 Pro en un coup d’œil',
      subtitle: 'Prix totaux avec audio — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD. Les routes audio off peuvent être moins chères dans l’app.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: '1080p en I2V uniquement',
    },
    meta: {
      title: 'Seedance 1.5 Pro : tarifs et camera fixed | MaxVideoAI',
      description:
        'Explorez prix Seedance 1.5 Pro, exemples, camera_fixed, seed, audio on/off et workflows image de départ/fin. Comparez Seedance 1.5 Pro vs Seedance 2.0.',
    },
  },
  es: {
    hero: {
      eyebrow: 'RUTA SEEDANCE PRO ANTERIOR COMPATIBLE',
      title: 'Seedance 1.5 Pro',
      subtitle: 'Tomas camera-fixed, variantes con seed y control de frame inicial/final para workflows Seedance anteriores.',
      subtitleHighlights: ['Tomas camera-fixed', 'variantes con seed', 'control de frame inicial/final'],
      paragraph:
        'Usa Seedance 1.5 Pro cuando necesitas la ruta Seedance anterior aún compatible: clips cortos repetibles, audio opcional, seed, camera_fixed y cierres image-to-video. Usa Seedance 2.0 para la ruta actual.',
      primaryCta: { label: 'Generar con Seedance 1.5 Pro', href: '/app?engine=seedance-1-5-pro' },
      secondaryCta: { label: 'Ver Seedance 2.0', href: modelsHref('es', 'seedance-2-0') },
      quickLinks: [
        { label: 'Comparar con Seedance 2.0', href: compareHref('es', 'seedance-1-5-pro', 'seedance-2-0') },
        { label: 'Ver precios', href: pricingHref('es', 'seedance-1-5-pro-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Seedance 1.5 Pro',
      description: 'Render cinematográfico camera-fixed',
      renderLabel: 'Ver render',
      badges: ['Audio activo', '12 s', '1080p'],
      altContext: 'render cinematográfico Seedance 1.5 Pro con camera_fixed',
    },
    features: [
      { title: 'Camera fixed', body: 'Bloquea la toma cuando necesitas estabilidad más que movimiento de cámara.', tone: 'continuity' },
      { title: 'Control de seed', body: 'Reutiliza un seed para variantes repetibles y pruebas A/B.', tone: 'quality' },
      { title: 'Frames inicial/final', body: 'Guía el cierre image-to-video con un frame final opcional.', tone: 'reference' },
      { title: 'Audio on/off', body: 'Genera con sonido nativo o apaga audio para borradores más baratos.', tone: 'audio' },
      { title: '1080p en I2V', body: 'Usa 1080p en checks image-to-video; texto a video queda en presets 480p o 720p.', tone: 'quality' },
      { title: 'Pago por uso', body: 'Ve el precio exacto antes de generar.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '¿1.5 Pro o Seedance 2.0?',
        body: 'Usa 1.5 Pro para pruebas heredadas con camera_fixed y seed. Usa Seedance 2.0 para la producción actual con audio nativo.',
        cta: { label: 'Comparar 1.5 Pro vs 2.0', href: compareHref('es', 'seedance-1-5-pro', 'seedance-2-0') },
      },
      {
        title: '¿Necesitas variantes repetibles?',
        body: 'Mantén la misma estructura de prompt, reutiliza el seed y cambia solo acción, timing o audio.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: '¿Preparas un final en Seedance?',
        body: 'Lleva los finales de campaña a Seedance 2.0 cuando importen más la continuidad multi-shot y referencias amplias.',
        cta: { label: 'Abrir Seedance 2.0', href: modelsHref('es', 'seedance-2-0') },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt de texto', body: 'Escribe un sujeto, una acción, luz, estilo y una pista de audio opcional.' },
      { title: 'Setup camera_fixed', body: 'Usa camera_fixed para planos de producto, ciudad o storyboard bloqueados.' },
      { title: 'Image-to-video', body: 'Parte de una imagen y añade frame final si la pose de llegada importa.' },
      { title: 'Variante con seed', body: 'Reutiliza el mismo seed para comparar cambios pequeños sin cambiar todo el look.' },
      { title: 'Paso a 2.0', body: 'Usa Seedance 2.0 cuando el proyecto necesita la ruta Seedance actual.' },
    ],
    pricingCopy: {
      title: 'Precios de Seedance 1.5 Pro de un vistazo',
      subtitle: 'Totales con audio. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD. Las rutas audio off pueden cotizar menos en la app.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: '1080p solo en I2V',
    },
    meta: {
      title: 'Seedance 1.5 Pro: precios y camera fixed | MaxVideoAI',
      description:
        'Explora precios de Seedance 1.5 Pro, ejemplos, camera_fixed, seed, audio on/off y workflows con frame inicial/final. Compara Seedance 1.5 Pro vs Seedance 2.0.',
    },
  },
};

const SORA_2_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: '720P VIDEO + NATIVE AUDIO ROUTE',
      title: 'Sora 2',
      subtitle: 'Synced audio, text-to-video and image-to-video for fast cinematic concepts, ads and social-ready scenes.',
      subtitleHighlights: ['Synced audio', 'text-to-video', 'image-to-video'],
      paragraph:
        'Use Sora 2 when you need a fast OpenAI video route for 720p concepts: short cinematic shots, image-led motion tests, native sound, and quick storyboard passes before moving final selects into Pro.',
      primaryCta: { label: 'Generate with Sora 2', href: '/app?engine=sora-2' },
      secondaryCta: { label: 'View examples', href: examplesHref('en', 'sora') },
      quickLinks: [
        { label: 'Compare vs Pro', href: compareHref('en', 'sora-2', 'sora-2-pro') },
        { label: 'View pricing', href: pricingHref('en', 'sora-2-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Sora 2 example',
      description: 'Cinematic concept with synced audio',
      renderLabel: 'View render',
      badges: ['Audio on', '12s', '720p'],
      altContext: 'cinematic Sora 2 concept scene with synced audio',
    },
    features: [
      { title: 'Synced audio', body: 'Dialogue, ambience and SFX are generated with the clip.', tone: 'audio' },
      { title: 'Text-to-video', body: 'Start from a compact scene brief, camera direction and sound cues.', tone: 'reference' },
      { title: 'Image-to-video', body: 'Animate a single approved frame when look or framing matters.', tone: 'continuity' },
      { title: '720p route', body: 'Use Sora 2 for fast review loops before Pro finals.', tone: 'quality' },
      { title: 'Max 12s', body: 'Build one clear beat or a short two-beat sequence per render.', tone: 'duration' },
      { title: 'Pay-as-you-go', body: 'See exact live price before you generate.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Sora 2 or Sora 2 Pro?',
        body: 'Use Sora 2 for faster 720p concept passes. Use Pro when the selected shot needs 1080p polish and tighter finishing control.',
        cta: { label: 'Compare Sora 2 vs Pro', href: compareHref('en', 'sora-2', 'sora-2-pro') },
      },
      {
        title: 'Starting from an image?',
        body: 'Upload one clean frame to lock composition, product shape or character direction before writing the motion brief.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Comparing premium routes?',
        body: 'Compare Sora 2 with Veo 3.1 or Kling 3 Pro when choosing between OpenAI concepts, Google polish and motion-control alternatives.',
        cta: { label: 'Compare Sora 2 vs Veo 3.1', href: compareHref('en', 'sora-2', 'veo-3-1') },
      },
    ],
    referenceWorkflows: [
      { title: 'Text prompt', body: 'Write subject, action, camera, style and one or two sound cues.' },
      { title: 'Image input', body: 'Use one frame to anchor the opening composition, then prompt only the motion and audio.' },
      { title: 'Duration choice', body: 'Use 4s for hook tests, 8s for a full beat and 12s for short storyboard sequences.' },
      { title: 'Audio cues', body: 'Keep dialogue short and tie SFX to visible actions so sound stays useful.' },
      { title: 'Upgrade path', body: 'Move winning Sora 2 concepts into Sora 2 Pro when you need final polish.' },
    ],
    pricingCopy: {
      title: 'Sora 2 pricing at a glance',
      subtitle: 'Preset 720p totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'Up to 720p',
    },
    meta: {
      title: 'Sora 2: Pricing, Native Audio & Examples | MaxVideoAI',
      description:
        'Explore Sora 2 pricing, examples, synced native audio, text-to-video and image-to-video workflows. Compare Sora 2 vs Pro and other AI video models.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'ROUTE VIDÉO 720P + AUDIO NATIF',
      title: 'Sora 2',
      subtitle: 'Audio synchronisé, text-to-video et image-to-video pour concepts cinématographiques, pubs et scènes social-ready.',
      subtitleHighlights: ['Audio synchronisé', 'text-to-video', 'image-to-video'],
      paragraph:
        'Utilisez Sora 2 pour une route OpenAI rapide en 720p : plans cinématographiques courts, tests depuis image, audio natif et passes storyboard avant de finaliser les meilleurs rendus en Pro.',
      primaryCta: { label: 'Générer avec Sora 2', href: '/app?engine=sora-2' },
      secondaryCta: { label: 'Voir les exemples', href: examplesHref('fr', 'sora') },
      quickLinks: [
        { label: 'Comparer vs Pro', href: compareHref('fr', 'sora-2', 'sora-2-pro') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'sora-2-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Sora 2',
      description: 'Concept cinématographique avec audio synchronisé',
      renderLabel: 'Voir le rendu',
      badges: ['Audio activé', '12 s', '720p'],
      altContext: 'scène conceptuelle Sora 2 avec audio synchronisé',
    },
    features: [
      { title: 'Audio synchronisé', body: 'Dialogue, ambiance et SFX sont générés avec le clip.', tone: 'audio' },
      { title: 'Text-to-video', body: 'Partez d’un brief scène, caméra et son clair.', tone: 'reference' },
      { title: 'Image-to-video', body: 'Animez une image validée quand le cadrage doit rester stable.', tone: 'continuity' },
      { title: 'Route 720p', body: 'Utilisez Sora 2 pour les boucles de revue avant les finales Pro.', tone: 'quality' },
      { title: 'Max 12 s', body: 'Construisez un beat clair ou une mini-séquence courte par rendu.', tone: 'duration' },
      { title: 'Paiement à l’usage', body: 'Prix exact affiché avant génération.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Sora 2 ou Sora 2 Pro ?',
        body: 'Utilisez Sora 2 pour des concepts 720p rapides. Passez à Pro quand le plan retenu demande du 1080p et un rendu plus final.',
        cta: { label: 'Comparer Sora 2 vs Pro', href: compareHref('fr', 'sora-2', 'sora-2-pro') },
      },
      {
        title: 'Vous partez d’une image ?',
        body: 'Chargez une image propre pour verrouiller composition, produit ou direction personnage, puis décrivez seulement mouvement et son.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Vous comparez les routes premium ?',
        body: 'Comparez Sora 2 avec Veo 3.1 ou Kling 3 Pro selon vos priorités : concepts OpenAI, polish Google ou alternatives de contrôle motion.',
        cta: { label: 'Comparer Sora 2 vs Veo 3.1', href: compareHref('fr', 'sora-2', 'veo-3-1') },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt texte', body: 'Écrivez sujet, action, caméra, style et un ou deux indices sonores.' },
      { title: 'Image source', body: 'Ancrez la composition de départ, puis concentrez le prompt sur mouvement et audio.' },
      { title: 'Choix de durée', body: '4 s pour le hook, 8 s pour un beat complet, 12 s pour une courte séquence.' },
      { title: 'Indices audio', body: 'Gardez les dialogues courts et liez les SFX aux actions visibles.' },
      { title: 'Passage en Pro', body: 'Déplacez les concepts gagnants vers Sora 2 Pro pour le polish final.' },
    ],
    pricingCopy: {
      title: 'Prix Sora 2 en un coup d’œil',
      subtitle: 'Prix totaux en 720p — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Jusqu’à 720p',
    },
    meta: {
      title: 'Sora 2 : tarifs, audio natif et exemples | MaxVideoAI',
      description:
        'Explorez prix Sora 2, exemples, audio natif synchronisé, text-to-video et image-to-video. Comparez Sora 2 vs Pro et les autres modèles vidéo IA.',
    },
  },
  es: {
    hero: {
      eyebrow: 'RUTA DE VIDEO 720P + AUDIO NATIVO',
      title: 'Sora 2',
      subtitle: 'Audio sincronizado, texto a video e imagen a video para conceptos cinematográficos, anuncios y escenas listas para social.',
      subtitleHighlights: ['Audio sincronizado', 'texto a video', 'imagen a video'],
      paragraph:
        'Usa Sora 2 cuando necesitas una ruta OpenAI rápida en 720p: tomas cinematográficas cortas, pruebas desde imagen, sonido nativo y pasadas de storyboard antes de llevar los selects finales a Pro.',
      primaryCta: { label: 'Generar con Sora 2', href: '/app?engine=sora-2' },
      secondaryCta: { label: 'Ver ejemplos', href: examplesHref('es', 'sora') },
      quickLinks: [
        { label: 'Comparar con Pro', href: compareHref('es', 'sora-2', 'sora-2-pro') },
        { label: 'Ver precios', href: pricingHref('es', 'sora-2-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Sora 2',
      description: 'Concepto cinematográfico con audio sincronizado',
      renderLabel: 'Ver render',
      badges: ['Audio activo', '12 s', '720p'],
      altContext: 'escena conceptual de Sora 2 con audio sincronizado',
    },
    features: [
      { title: 'Audio sincronizado', body: 'Diálogo, ambiente y SFX se generan junto con el clip.', tone: 'audio' },
      { title: 'Texto a video', body: 'Empieza con un brief claro de escena, cámara y sonido.', tone: 'reference' },
      { title: 'Imagen a video', body: 'Anima un frame aprobado cuando el encuadre debe mantenerse estable.', tone: 'continuity' },
      { title: 'Ruta 720p', body: 'Usa Sora 2 para revisar rápido antes de pasar a finales Pro.', tone: 'quality' },
      { title: 'Máx. 12 s', body: 'Construye un beat claro o una secuencia corta por render.', tone: 'duration' },
      { title: 'Pago por uso', body: 'Ve el precio exacto antes de generar.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '¿Sora 2 o Sora 2 Pro?',
        body: 'Usa Sora 2 para conceptos rápidos en 720p. Usa Pro cuando la toma elegida necesita 1080p y acabado más final.',
        cta: { label: 'Comparar Sora 2 vs Pro', href: compareHref('es', 'sora-2', 'sora-2-pro') },
      },
      {
        title: '¿Empiezas desde una imagen?',
        body: 'Sube un frame limpio para fijar composición, producto o dirección de personaje, y escribe el prompt solo para movimiento y audio.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: '¿Comparas rutas premium?',
        body: 'Compara Sora 2 con Veo 3.1 o Kling 3 Pro según priorices conceptos OpenAI, acabado Google o alternativas de control de movimiento.',
        cta: { label: 'Comparar Sora 2 vs Veo 3.1', href: compareHref('es', 'sora-2', 'veo-3-1') },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt de texto', body: 'Escribe sujeto, acción, cámara, estilo y una o dos pistas de sonido.' },
      { title: 'Imagen inicial', body: 'Fija la composición de arranque y centra el prompt en movimiento y audio.' },
      { title: 'Duración', body: '4 s para hooks, 8 s para un beat completo y 12 s para secuencias cortas.' },
      { title: 'Pistas de audio', body: 'Mantén el diálogo corto y liga los SFX a acciones visibles.' },
      { title: 'Paso a Pro', body: 'Lleva los conceptos ganadores a Sora 2 Pro cuando necesites acabado final.' },
    ],
    pricingCopy: {
      title: 'Precios de Sora 2 de un vistazo',
      subtitle: 'Totales predefinidos en 720p. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Hasta 720p',
    },
    meta: {
      title: 'Sora 2: precios, audio nativo y ejemplos | MaxVideoAI',
      description:
        'Explora precios de Sora 2, ejemplos, audio nativo sincronizado, texto a video e imagen a video. Compara Sora 2 vs Pro y otros modelos de video IA.',
    },
  },
};

const SORA_2_PRO_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'OPENAI PRO VIDEO MODEL',
      title: 'Sora 2 Pro',
      subtitle: 'Higher-resolution finals, audio control and reference-guided image-to-video for polished short-form production.',
      subtitleHighlights: ['Higher-resolution finals', 'audio control', 'reference-guided image-to-video'],
      paragraph:
        'Use Sora 2 Pro when a selected Sora concept needs the current Pro route: 720p or 1080p delivery, text-to-video or image-to-video generation, optional native sound, and final-quality review loops inside MaxVideoAI.',
      primaryCta: { label: 'Generate with Sora 2 Pro', href: '/app?engine=sora-2-pro' },
      secondaryCta: { label: 'View examples', href: examplesHref('en', 'sora') },
      quickLinks: [
        { label: 'Compare vs Sora 2', href: compareHref('en', 'sora-2-pro', 'sora-2', 'sora-2-pro') },
        { label: 'View pricing', href: pricingHref('en', 'sora-2-pro-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Sora 2 Pro example',
      description: '8s 16:9 Pro continuity render',
      renderLabel: 'View render',
      badges: ['Audio off', '8s', '16:9'],
      altContext: 'Sora 2 Pro continuity control render',
    },
    features: [
      { title: '1080p route', body: 'Use Pro for selected shots that need cleaner delivery.', tone: 'quality' },
      { title: 'Synced audio', body: 'Keep dialogue, ambience and SFX in the same generation flow.', tone: 'audio' },
      { title: 'Text-to-video', body: 'Brief a complete short shot with subject, action, camera and sound.', tone: 'reference' },
      { title: 'Image-to-video', body: 'Use a still frame to preserve composition before motion and audio cues.', tone: 'continuity' },
      { title: 'Max 12s', body: 'Plan tight production beats rather than extended scenes.', tone: 'duration' },
      { title: 'Pay-as-you-go', body: 'See exact live price before you generate.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Pro or standard Sora 2?',
        body: 'Use standard Sora 2 for 720p concept passes. Use Pro when a winning shot needs 1080p output and more final-quality review.',
        cta: { label: 'Compare Sora 2 vs Pro', href: compareHref('en', 'sora-2-pro', 'sora-2', 'sora-2-pro') },
      },
      {
        title: 'Ready for final review?',
        body: 'Use Pro after the prompt, framing and audio cues are already close. That keeps higher-cost iterations focused.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Comparing premium finals?',
        body: 'Compare Sora 2 Pro with Veo 3.1 or Kling 3 Pro when selecting a final route for ads, explainers or cinematic inserts.',
        cta: { label: 'Compare Sora 2 Pro vs Veo 3.1', href: compareHref('en', 'sora-2-pro', 'veo-3-1', 'sora-2-pro') },
      },
    ],
    referenceWorkflows: [
      { title: 'Text-to-video final', body: 'Use a compact director brief with one clear action, camera move and sound plan.' },
      { title: 'Image-to-video final', body: 'Start from an approved still when identity, product shape or framing must stay stable.' },
      { title: 'Audio planning', body: 'Separate voice, ambience and SFX so the sound brief does not fight the visual action.' },
      { title: 'Continuity anchors', body: 'Repeat wardrobe, props, location and lighting when a 12s clip contains several beats.' },
      { title: 'Cost control', body: 'Prototype in Sora 2, then reserve Pro for the shots worth polishing.' },
    ],
    pricingCopy: {
      title: 'Sora 2 Pro pricing at a glance',
      subtitle: 'Preset Pro totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: '4/8/12s · up to 1080p',
    },
    meta: {
      title: 'Sora 2 Pro: Pricing, 1080p & Examples | MaxVideoAI',
      description:
        'Explore Sora 2 Pro pricing, 1080p examples, synced native audio, text-to-video and image-to-video workflows. Compare Sora 2 Pro vs Sora 2.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'MODÈLE VIDÉO OPENAI PRO',
      title: 'Sora 2 Pro',
      subtitle: 'Finales en plus haute résolution, contrôle audio et image-to-video guidé par référence pour des productions courtes soignées.',
      subtitleHighlights: ['plus haute résolution', 'contrôle audio', 'image-to-video guidé par référence'],
      paragraph:
        'Utilisez Sora 2 Pro quand un concept Sora sélectionné doit passer sur la route Pro actuelle : sortie 720p ou 1080p, text-to-video ou image-to-video, son natif optionnel et revues proches du rendu final.',
      primaryCta: { label: 'Générer avec Sora 2 Pro', href: '/app?engine=sora-2-pro' },
      secondaryCta: { label: 'Voir les exemples', href: examplesHref('fr', 'sora') },
      quickLinks: [
        { label: 'Comparer vs Sora 2', href: compareHref('fr', 'sora-2-pro', 'sora-2', 'sora-2-pro') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'sora-2-pro-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Sora 2 Pro',
      description: 'Rendu Pro 8 s 16:9 de continuité',
      renderLabel: 'Voir le rendu',
      badges: ['Audio désactivé', '8 s', '16:9'],
      altContext: 'rendu de contrôle de continuité Sora 2 Pro',
    },
    features: [
      { title: 'Route 1080p', body: 'Utilisez Pro pour les plans sélectionnés qui demandent une livraison plus nette.', tone: 'quality' },
      { title: 'Audio synchronisé', body: 'Gardez dialogue, ambiance et SFX dans le même flux de génération.', tone: 'audio' },
      { title: 'Text-to-video', body: 'Briefez un plan court complet : sujet, action, caméra et son.', tone: 'reference' },
      { title: 'Image-to-video', body: 'Partez d’une image fixe pour préserver composition et identité.', tone: 'continuity' },
      { title: 'Max 12 s', body: 'Planifiez des beats serrés plutôt que des scènes longues.', tone: 'duration' },
      { title: 'Paiement à l’usage', body: 'Prix exact affiché avant génération.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Pro ou Sora 2 standard ?',
        body: 'Utilisez Sora 2 pour des concepts 720p. Passez en Pro quand le plan gagnant demande du 1080p et une revue plus finale.',
        cta: { label: 'Comparer Sora 2 vs Pro', href: compareHref('fr', 'sora-2-pro', 'sora-2', 'sora-2-pro') },
      },
      {
        title: 'Prêt pour la revue finale ?',
        body: 'Utilisez Pro quand prompt, cadrage et indices audio sont déjà proches du résultat attendu.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Vous comparez les finales premium ?',
        body: 'Comparez Sora 2 Pro avec Veo 3.1 ou Kling 3 Pro pour des pubs, explainers ou inserts cinématographiques.',
        cta: { label: 'Comparer Sora 2 Pro vs Veo 3.1', href: compareHref('fr', 'sora-2-pro', 'veo-3-1', 'sora-2-pro') },
      },
    ],
    referenceWorkflows: [
      { title: 'Finale text-to-video', body: 'Utilisez un brief réalisateur compact avec une action, un mouvement caméra et un plan sonore.' },
      { title: 'Finale image-to-video', body: 'Partez d’une image validée si identité, produit ou cadrage doivent rester stables.' },
      { title: 'Plan audio', body: 'Séparez voix, ambiance et SFX pour éviter un prompt sonore contradictoire.' },
      { title: 'Ancrages de continuité', body: 'Répétez tenue, accessoires, lieu et lumière quand le clip contient plusieurs beats.' },
      { title: 'Contrôle du coût', body: 'Prototypez en Sora 2, puis réservez Pro aux plans qui méritent le polish.' },
    ],
    pricingCopy: {
      title: 'Prix Sora 2 Pro en un coup d’œil',
      subtitle: 'Prix totaux Pro — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: '4/8/12 s · jusqu’à 1080p',
    },
    meta: {
      title: 'Sora 2 Pro : tarifs, 1080p et exemples | MaxVideoAI',
      description:
        'Explorez prix Sora 2 Pro, exemples 1080p, audio natif synchronisé, text-to-video et image-to-video. Comparez Sora 2 Pro vs Sora 2.',
    },
  },
  es: {
    hero: {
      eyebrow: 'MODELO DE VIDEO OPENAI PRO',
      title: 'Sora 2 Pro',
      subtitle: 'Finales en mayor resolución, control de audio e imagen a video guiada por referencia para producción short-form pulida.',
      subtitleHighlights: ['mayor resolución', 'control de audio', 'imagen a video guiada por referencia'],
      paragraph:
        'Usa Sora 2 Pro cuando un concepto Sora elegido necesita la ruta Pro actual: salida 720p o 1080p, texto a video o imagen a video, sonido nativo opcional y revisiones cercanas a entrega final.',
      primaryCta: { label: 'Generar con Sora 2 Pro', href: '/app?engine=sora-2-pro' },
      secondaryCta: { label: 'Ver ejemplos', href: examplesHref('es', 'sora') },
      quickLinks: [
        { label: 'Comparar con Sora 2', href: compareHref('es', 'sora-2-pro', 'sora-2', 'sora-2-pro') },
        { label: 'Ver precios', href: pricingHref('es', 'sora-2-pro-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Sora 2 Pro',
      description: 'Render Pro 8 s 16:9 de continuidad',
      renderLabel: 'Ver render',
      badges: ['Audio desactivado', '8 s', '16:9'],
      altContext: 'render de control de continuidad con Sora 2 Pro',
    },
    features: [
      { title: 'Ruta 1080p', body: 'Usa Pro para tomas seleccionadas que necesitan entrega más limpia.', tone: 'quality' },
      { title: 'Audio sincronizado', body: 'Mantén diálogo, ambiente y SFX en el mismo flujo de generación.', tone: 'audio' },
      { title: 'Texto a video', body: 'Brief de una toma corta con sujeto, acción, cámara y sonido.', tone: 'reference' },
      { title: 'Imagen a video', body: 'Parte de un frame aprobado para preservar composición e identidad.', tone: 'continuity' },
      { title: 'Máx. 12 s', body: 'Planifica beats cerrados, no escenas largas.', tone: 'duration' },
      { title: 'Pago por uso', body: 'Ve el precio exacto antes de generar.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '¿Pro o Sora 2 estándar?',
        body: 'Usa Sora 2 para conceptos en 720p. Usa Pro cuando la toma ganadora necesita 1080p y una revisión más final.',
        cta: { label: 'Comparar Sora 2 vs Pro', href: compareHref('es', 'sora-2-pro', 'sora-2', 'sora-2-pro') },
      },
      {
        title: '¿Lista para revisión final?',
        body: 'Usa Pro cuando prompt, encuadre y pistas de audio ya estén cerca del resultado esperado.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: '¿Comparas finales premium?',
        body: 'Compara Sora 2 Pro con Veo 3.1 o Kling 3 Pro para anuncios, explainers o inserts cinematográficos.',
        cta: { label: 'Comparar Sora 2 Pro vs Veo 3.1', href: compareHref('es', 'sora-2-pro', 'veo-3-1', 'sora-2-pro') },
      },
    ],
    referenceWorkflows: [
      { title: 'Final texto a video', body: 'Usa un brief de director compacto con una acción, cámara y plan de sonido.' },
      { title: 'Final imagen a video', body: 'Parte de un still aprobado cuando identidad, producto o encuadre deben quedarse estables.' },
      { title: 'Plan de audio', body: 'Separa voz, ambiente y SFX para que el sonido no compita con la acción visual.' },
      { title: 'Anclas de continuidad', body: 'Repite vestuario, props, ubicación e iluminación cuando el clip tenga varios beats.' },
      { title: 'Control de costo', body: 'Prototipa en Sora 2 y reserva Pro para las tomas que vale la pena pulir.' },
    ],
    pricingCopy: {
      title: 'Precios de Sora 2 Pro de un vistazo',
      subtitle: 'Totales Pro predefinidos. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: '4/8/12 s · hasta 1080p',
    },
    meta: {
      title: 'Sora 2 Pro: precios, 1080p y ejemplos | MaxVideoAI',
      description:
        'Explora precios de Sora 2 Pro, ejemplos 1080p, audio nativo sincronizado, texto a video e imagen a video. Compara Sora 2 Pro vs Sora 2.',
    },
  },
};

const KLING_O3_PRO_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'KLING 3.0 OMNI PRO',
      title: 'Kling 3.0 Omni Pro',
      subtitle: 'Reference-to-video, storyboard guidance and source-video V2V for Kling shots where uploaded media should guide the render instead of forcing the first frame.',
      subtitleHighlights: ['Reference-to-video', 'storyboard guidance', 'source-video V2V'],
      paragraph:
        'Use Kling 3.0 Omni Pro when reference images, storyboard frames or a source video should steer style, character continuity, motion or camera language. Use Kling 3 Pro instead when the uploaded image must visibly open the clip as the start frame.',
      primaryCta: { label: 'Generate with Kling 3.0 Omni Pro', href: '/app?engine=kling-o3-pro' },
      secondaryCta: { label: 'Compare vs Kling 3 Pro', href: compareHref('en', 'kling-3-pro', 'kling-o3-pro') },
      quickLinks: [
        { label: 'Compare vs Kling 3 Pro', href: compareHref('en', 'kling-3-pro', 'kling-o3-pro') },
        { label: 'View pricing', href: pricingHref('en', 'kling-o3-pro-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Kling 3.0 Omni Pro example',
      description: 'Storyboard-guided production render',
      renderLabel: 'View render',
      badges: ['Storyboard', '12s', 'Audio on'],
      altContext: 'tiny lighthouse keeper storyboard-guided Kling 3.0 Omni Pro render',
    },
    features: [
      { title: 'Reference images', body: 'Use @Image anchors for style, subject, storyboard or scene continuity without forcing the first image to open.', tone: 'reference' },
      { title: 'Source-video V2V', body: 'Attach a source video and refer to @Video1 when motion, pacing or camera language should guide the shot.', tone: 'continuity' },
      { title: 'Optional start/end frames', body: 'Combine references with opening or ending frames when the shot needs stronger structure.', tone: 'reference' },
      { title: 'Native audio route', body: 'Generate with audio when the selected O3 route exposes audio controls.', tone: 'audio' },
      { title: 'Up to 15s', body: 'Use Pro for longer reference-guided clips before moving final 4K work to the 4K route.', tone: 'duration' },
      { title: 'Live quote', body: 'The app shows the exact price before generation.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'O3 Pro or Kling 3 Pro?',
        body: 'Choose O3 Pro when images are references or storyboard inputs. Choose Kling 3 Pro when an uploaded image should be the visible start frame.',
        cta: { label: 'Compare O3 Pro vs Kling 3 Pro', href: compareHref('en', 'kling-3-pro', 'kling-o3-pro') },
      },
      {
        title: 'Need source-video guidance?',
        body: 'Use O3 Pro or Standard for source-video V2V. Prompt with @Video1 when the source clip should control motion or camera continuity.',
        cta: { label: 'Open O3 Pro composer', href: '/app?engine=kling-o3-pro' },
      },
      {
        title: 'Need native 4K?',
        body: 'Use O3 4K after the reference direction is approved. Stay on Pro while testing source-video V2V and storyboard structure.',
        cta: { label: 'View O3 4K', href: modelsHref('en', 'kling-o3-4k') },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt only', body: 'Use text when no visual anchor is needed and O3 should generate from the scene brief.' },
      { title: 'Reference images', body: 'Use @Image1, @Image2 and more for character, object, style or storyboard guidance.' },
      { title: 'Start/end frames', body: 'Add optional opening or ending frames when the first or last pose must be controlled.' },
      { title: 'Source video', body: 'Use @Video1 for video-to-video motion, pacing, composition or camera continuity.' },
      { title: 'Reference plus V2V', body: 'Combine source video and reference images when motion and visual identity both matter.' },
    ],
    pricingCopy: {
      title: 'Kling 3.0 Omni Pro pricing at a glance',
      subtitle: 'Preset totals for reference-guided and video-to-video scenarios. Check the live quote before generating.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
    },
    meta: {
      title: 'Kling 3.0 Omni Pro: Reference, Storyboard & V2V | MaxVideoAI',
      description:
        'Use Kling 3.0 Omni Pro for reference-to-video, storyboard inputs, source-video V2V, @Image and @Video1 prompts, native audio and live pricing.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'KLING 3.0 OMNI PRO',
      title: 'Kling 3.0 Omni Pro',
      subtitle: 'Reference-to-video, storyboard et V2V depuis vidéo source pour les plans Kling où les médias importés doivent guider le rendu sans devenir la première frame.',
      subtitleHighlights: ['Reference-to-video', 'storyboard', 'V2V depuis vidéo source'],
      paragraph:
        "Utilisez Kling 3.0 Omni Pro quand des images de référence, des frames storyboard ou une vidéo source doivent guider le style, la continuité, le mouvement ou le langage caméra. Utilisez Kling 3 Pro quand l'image importée doit vraiment ouvrir le clip comme start frame.",
      primaryCta: { label: 'Générer avec Kling 3.0 Omni Pro', href: '/app?engine=kling-o3-pro' },
      secondaryCta: { label: 'Comparer vs Kling 3 Pro', href: compareHref('fr', 'kling-3-pro', 'kling-o3-pro') },
      quickLinks: [
        { label: 'Comparer vs Kling 3 Pro', href: compareHref('fr', 'kling-3-pro', 'kling-o3-pro') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'kling-o3-pro-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Kling 3.0 Omni Pro',
      description: 'Rendu production guidé par storyboard',
      renderLabel: 'Voir le rendu',
      badges: ['Storyboard', '12 s', 'Audio activé'],
      altContext: 'rendu Kling 3.0 Omni Pro guidé par storyboard avec petit gardien de phare',
    },
    features: [
      { title: 'Images de référence', body: 'Utilisez les ancres @Image pour le style, le sujet, le storyboard ou la continuité sans forcer la première image en ouverture.', tone: 'reference' },
      { title: 'V2V vidéo source', body: 'Ajoutez une vidéo source et citez @Video1 quand le mouvement, le rythme ou la caméra doivent guider le plan.', tone: 'continuity' },
      { title: 'Start/end optionnels', body: 'Combinez références et frames de début/fin quand le plan doit être plus structuré.', tone: 'reference' },
      { title: 'Route audio native', body: 'Générez avec audio quand la route O3 sélectionnée expose les contrôles audio.', tone: 'audio' },
      { title: 'Jusqu’à 15 s', body: 'Utilisez Pro pour les clips guidés par références avant de passer les rendus finaux en 4K.', tone: 'duration' },
      { title: 'Prix live', body: 'L’app affiche le prix exact avant génération.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'O3 Pro ou Kling 3 Pro ?',
        body: 'Choisissez O3 Pro quand les images sont des références ou un storyboard. Choisissez Kling 3 Pro quand une image doit être la start frame visible.',
        cta: { label: 'Comparer O3 Pro vs Kling 3 Pro', href: compareHref('fr', 'kling-3-pro', 'kling-o3-pro') },
      },
      {
        title: 'Besoin de V2V ?',
        body: 'Utilisez O3 Pro ou Standard pour le V2V depuis vidéo source. Citez @Video1 quand la source doit guider le mouvement ou la continuité caméra.',
        cta: { label: 'Ouvrir le composer O3 Pro', href: '/app?engine=kling-o3-pro' },
      },
      {
        title: 'Besoin de 4K native ?',
        body: 'Utilisez O3 4K une fois la direction par références validée. Restez sur Pro pour tester le V2V et la structure storyboard.',
        cta: { label: 'Voir O3 4K', href: modelsHref('fr', 'kling-o3-4k') },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt seul', body: 'Utilisez le texte quand aucune ancre visuelle n’est nécessaire.' },
      { title: 'Images de référence', body: 'Utilisez @Image1, @Image2 et plus pour le personnage, l’objet, le style ou le storyboard.' },
      { title: 'Frames début/fin', body: 'Ajoutez une ouverture ou une fin optionnelle quand la pose doit être contrôlée.' },
      { title: 'Vidéo source', body: 'Utilisez @Video1 pour guider mouvement, rythme, composition ou caméra en video-to-video.' },
      { title: 'Référence plus V2V', body: 'Combinez vidéo source et images de référence quand le mouvement et l’identité visuelle comptent.' },
    ],
    pricingCopy: {
      title: 'Prix Kling 3.0 Omni Pro en un coup d’œil',
      subtitle: 'Totaux par scénario référence ou video-to-video. Vérifiez le prix live avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
    },
    meta: {
      title: 'Kling 3.0 Omni Pro : références, storyboard et V2V | MaxVideoAI',
      description:
        'Utilisez Kling 3.0 Omni Pro pour reference-to-video, storyboard, V2V depuis vidéo source, prompts @Image et @Video1, audio natif et prix live.',
    },
  },
  es: {
    hero: {
      eyebrow: 'KLING 3.0 OMNI PRO',
      title: 'Kling 3.0 Omni Pro',
      subtitle: 'Reference-to-video, storyboard y V2V desde video fuente para tomas Kling donde los medios subidos deben guiar el render sin ser el primer frame.',
      subtitleHighlights: ['Reference-to-video', 'storyboard', 'V2V desde video fuente'],
      paragraph:
        'Usa Kling 3.0 Omni Pro cuando imágenes de referencia, frames storyboard o un video fuente deben guiar estilo, continuidad, movimiento o lenguaje de cámara. Usa Kling 3 Pro cuando la imagen subida debe abrir el clip como start frame.',
      primaryCta: { label: 'Generar con Kling 3.0 Omni Pro', href: '/app?engine=kling-o3-pro' },
      secondaryCta: { label: 'Comparar con Kling 3 Pro', href: compareHref('es', 'kling-3-pro', 'kling-o3-pro') },
      quickLinks: [
        { label: 'Comparar con Kling 3 Pro', href: compareHref('es', 'kling-3-pro', 'kling-o3-pro') },
        { label: 'Ver precios', href: pricingHref('es', 'kling-o3-pro-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Kling 3.0 Omni Pro',
      description: 'Render de producción guiado por storyboard',
      renderLabel: 'Ver render',
      badges: ['Storyboard', '12 s', 'Audio activo'],
      altContext: 'render Kling 3.0 Omni Pro guiado por storyboard con un pequeño farero',
    },
    features: [
      { title: 'Imágenes de referencia', body: 'Usa anclas @Image para estilo, sujeto, storyboard o continuidad sin forzar la primera imagen como apertura.', tone: 'reference' },
      { title: 'V2V con video fuente', body: 'Adjunta un video fuente y cita @Video1 cuando movimiento, ritmo o cámara deben guiar la toma.', tone: 'continuity' },
      { title: 'Start/end opcionales', body: 'Combina referencias con frames de inicio o final cuando la toma necesita más estructura.', tone: 'reference' },
      { title: 'Ruta con audio nativo', body: 'Genera con audio cuando la ruta O3 seleccionada expone controles de audio.', tone: 'audio' },
      { title: 'Hasta 15 s', body: 'Usa Pro para clips guiados por referencias antes de pasar finales a la ruta 4K.', tone: 'duration' },
      { title: 'Precio en vivo', body: 'La app muestra el precio exacto antes de generar.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '¿O3 Pro o Kling 3 Pro?',
        body: 'Elige O3 Pro cuando las imágenes son referencias o storyboard. Elige Kling 3 Pro cuando una imagen debe ser el start frame visible.',
        cta: { label: 'Comparar O3 Pro vs Kling 3 Pro', href: compareHref('es', 'kling-3-pro', 'kling-o3-pro') },
      },
      {
        title: '¿Necesitas guía V2V?',
        body: 'Usa O3 Pro o Standard para V2V desde video fuente. Cita @Video1 cuando la fuente debe controlar movimiento o continuidad de cámara.',
        cta: { label: 'Abrir compositor O3 Pro', href: '/app?engine=kling-o3-pro' },
      },
      {
        title: '¿Necesitas 4K nativo?',
        body: 'Usa O3 4K cuando la dirección por referencias ya está aprobada. Mantente en Pro para probar V2V y estructura storyboard.',
        cta: { label: 'Ver O3 4K', href: modelsHref('es', 'kling-o3-4k') },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt solo', body: 'Usa texto cuando no se necesita ancla visual.' },
      { title: 'Imágenes de referencia', body: 'Usa @Image1, @Image2 y más para personaje, objeto, estilo o storyboard.' },
      { title: 'Frames inicio/final', body: 'Agrega apertura o final opcional cuando la pose debe controlarse.' },
      { title: 'Video fuente', body: 'Usa @Video1 para guiar movimiento, ritmo, composición o cámara en video-to-video.' },
      { title: 'Referencia más V2V', body: 'Combina video fuente e imágenes de referencia cuando importan movimiento e identidad visual.' },
    ],
    pricingCopy: {
      title: 'Precios de Kling 3.0 Omni Pro de un vistazo',
      subtitle: 'Totales por escenario con referencias o video-to-video. Revisa el precio en vivo antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
    },
    meta: {
      title: 'Kling 3.0 Omni Pro: referencias, storyboard y V2V | MaxVideoAI',
      description:
        'Usa Kling 3.0 Omni Pro para reference-to-video, storyboard, V2V desde video fuente, prompts @Image y @Video1, audio nativo y precio en vivo.',
    },
  },
};

const KLING_O3_STANDARD_COPY: LocalizedTemplateCopy = {
  en: {
    ...KLING_O3_PRO_COPY.en,
    hero: {
      ...KLING_O3_PRO_COPY.en.hero,
      eyebrow: 'KLING 3.0 OMNI STANDARD',
      title: 'Kling 3.0 Omni Standard',
      subtitle: 'Lower-cost reference-to-video, storyboard drafts and source-video V2V before moving approved directions into O3 Pro.',
      paragraph:
        'Use Kling 3.0 Omni Standard for cheaper reference-guided iteration: storyboard images, style anchors, optional start/end frames and source-video V2V tests. Move winners into O3 Pro when the shot needs stronger final polish.',
      primaryCta: { label: 'Generate with Kling 3.0 Omni Standard', href: '/app?engine=kling-o3-standard' },
      secondaryCta: { label: 'View O3 Pro', href: modelsHref('en', 'kling-o3-pro') },
      quickLinks: [
        { label: 'Compare vs O3 Pro', href: compareHref('en', 'kling-o3-standard', 'kling-o3-pro') },
        { label: 'View pricing', href: pricingHref('en', 'kling-o3-standard-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      ...KLING_O3_PRO_COPY.en.media,
      caption: 'Kling 3.0 Omni Standard example',
      description: 'Lower-cost storyboard draft',
      badges: ['Storyboard draft', '12s', 'Audio on'],
      altContext: 'origami whale storyboard-guided Kling 3.0 Omni Standard draft',
    },
    decisionCards: [
      {
        title: 'Standard or Pro?',
        body: 'Use Standard for lower-cost reference and V2V tests. Move to Pro when the selected direction needs final-quality fidelity.',
        cta: { label: 'View O3 Pro', href: modelsHref('en', 'kling-o3-pro') },
      },
      ...KLING_O3_PRO_COPY.en.decisionCards.slice(1),
    ],
    pricingCopy: {
      ...KLING_O3_PRO_COPY.en.pricingCopy,
      title: 'Kling 3.0 Omni Standard pricing at a glance',
      subtitle: 'Lower-cost preset totals for reference-guided drafts and source-video V2V tests.',
    },
    meta: {
      title: 'Kling 3.0 Omni Standard: Reference Drafts & V2V | MaxVideoAI',
      description:
        'Use Kling 3.0 Omni Standard for lower-cost reference-to-video, storyboard drafts, source-video V2V, @Image and @Video1 prompts.',
    },
  },
  fr: {
    ...KLING_O3_PRO_COPY.fr,
    hero: {
      ...KLING_O3_PRO_COPY.fr.hero,
      eyebrow: 'KLING 3.0 OMNI STANDARD',
      title: 'Kling 3.0 Omni Standard',
      subtitle: 'Reference-to-video moins coûteux, drafts storyboard et V2V depuis vidéo source avant de passer les directions validées en O3 Pro.',
      paragraph:
        'Utilisez Kling 3.0 Omni Standard pour itérer à moindre coût : images storyboard, ancres de style, frames début/fin optionnelles et tests V2V depuis vidéo source. Passez les gagnants en O3 Pro pour plus de finition.',
      primaryCta: { label: 'Générer avec Kling 3.0 Omni Standard', href: '/app?engine=kling-o3-standard' },
      secondaryCta: { label: 'Voir O3 Pro', href: modelsHref('fr', 'kling-o3-pro') },
      quickLinks: [
        { label: 'Comparer vs O3 Pro', href: compareHref('fr', 'kling-o3-standard', 'kling-o3-pro') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'kling-o3-standard-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      ...KLING_O3_PRO_COPY.fr.media,
      caption: 'Exemple Kling 3.0 Omni Standard',
      description: 'Draft storyboard moins coûteux',
      badges: ['Draft storyboard', '12 s', 'Audio activé'],
      altContext: 'draft Kling 3.0 Omni Standard guidé par storyboard avec baleine origami',
    },
    decisionCards: [
      {
        title: 'Standard ou Pro ?',
        body: 'Utilisez Standard pour tester références et V2V à moindre coût. Passez en Pro quand la direction choisie demande une fidélité finale plus forte.',
        cta: { label: 'Voir O3 Pro', href: modelsHref('fr', 'kling-o3-pro') },
      },
      ...KLING_O3_PRO_COPY.fr.decisionCards.slice(1),
    ],
    pricingCopy: {
      ...KLING_O3_PRO_COPY.fr.pricingCopy,
      title: 'Prix Kling 3.0 Omni Standard en un coup d’œil',
      subtitle: 'Totaux moins coûteux pour drafts guidés par références et tests V2V.',
    },
    meta: {
      title: 'Kling 3.0 Omni Standard : drafts référence et V2V | MaxVideoAI',
      description:
        'Utilisez Kling 3.0 Omni Standard pour reference-to-video moins coûteux, drafts storyboard, V2V source, prompts @Image et @Video1.',
    },
  },
  es: {
    ...KLING_O3_PRO_COPY.es,
    hero: {
      ...KLING_O3_PRO_COPY.es.hero,
      eyebrow: 'KLING 3.0 OMNI STANDARD',
      title: 'Kling 3.0 Omni Standard',
      subtitle: 'Reference-to-video de menor costo, borradores storyboard y V2V desde video fuente antes de mover direcciones aprobadas a O3 Pro.',
      paragraph:
        'Usa Kling 3.0 Omni Standard para iterar con menor costo: imágenes storyboard, anclas de estilo, frames inicio/final opcionales y pruebas V2V desde video fuente. Pasa ganadores a O3 Pro para más acabado.',
      primaryCta: { label: 'Generar con Kling 3.0 Omni Standard', href: '/app?engine=kling-o3-standard' },
      secondaryCta: { label: 'Ver O3 Pro', href: modelsHref('es', 'kling-o3-pro') },
      quickLinks: [
        { label: 'Comparar con O3 Pro', href: compareHref('es', 'kling-o3-standard', 'kling-o3-pro') },
        { label: 'Ver precios', href: pricingHref('es', 'kling-o3-standard-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      ...KLING_O3_PRO_COPY.es.media,
      caption: 'Ejemplo Kling 3.0 Omni Standard',
      description: 'Borrador storyboard de menor costo',
      badges: ['Draft storyboard', '12 s', 'Audio activo'],
      altContext: 'borrador Kling 3.0 Omni Standard guiado por storyboard con ballena origami',
    },
    decisionCards: [
      {
        title: '¿Standard o Pro?',
        body: 'Usa Standard para pruebas de referencia y V2V con menor costo. Pasa a Pro cuando la dirección elegida necesita más fidelidad final.',
        cta: { label: 'Ver O3 Pro', href: modelsHref('es', 'kling-o3-pro') },
      },
      ...KLING_O3_PRO_COPY.es.decisionCards.slice(1),
    ],
    pricingCopy: {
      ...KLING_O3_PRO_COPY.es.pricingCopy,
      title: 'Precios de Kling 3.0 Omni Standard de un vistazo',
      subtitle: 'Totales de menor costo para borradores guiados por referencias y pruebas V2V.',
    },
    meta: {
      title: 'Kling 3.0 Omni Standard: borradores referencia y V2V | MaxVideoAI',
      description:
        'Usa Kling 3.0 Omni Standard para reference-to-video de menor costo, borradores storyboard, V2V fuente, prompts @Image y @Video1.',
    },
  },
};

const KLING_O3_4K_COPY: LocalizedTemplateCopy = {
  en: {
    ...KLING_O3_PRO_COPY.en,
    hero: {
      ...KLING_O3_PRO_COPY.en.hero,
      eyebrow: 'KLING 3.0 OMNI 4K',
      title: 'Kling 3.0 Omni 4K',
      subtitle: 'Native 4K reference-guided Kling video for approved storyboard and visual-reference directions. This is not the source-video V2V route.',
      subtitleHighlights: ['Native 4K', 'reference-guided Kling video', 'not source-video V2V'],
      paragraph:
        'Use Kling 3.0 Omni 4K when reference images or storyboard frames should guide a native 4K final without being forced as the opening frame. Use O3 Pro or Standard when the workflow needs a source video or @Video1 V2V.',
      primaryCta: { label: 'Generate with Kling 3.0 Omni 4K', href: '/app?engine=kling-o3-4k' },
      secondaryCta: { label: 'View O3 Pro', href: modelsHref('en', 'kling-o3-pro') },
      quickLinks: [
        { label: 'Compare vs O3 Pro', href: compareHref('en', 'kling-o3-4k', 'kling-o3-pro') },
        { label: 'View pricing', href: pricingHref('en', 'kling-o3-4k-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Kling 3.0 Omni 4K example',
      description: 'Native 4K storyboard delivery render',
      renderLabel: 'View render',
      badges: ['Native 4K', '10s', 'Audio off'],
      altContext: 'Kling 3.0 Omni 4K storyboard-guided native 4K render',
    },
    features: [
      { title: 'Native 4K', body: 'Use this route for final reference-guided 4K delivery renders.', tone: 'quality' },
      { title: 'Reference images', body: 'Use @Image anchors for style, subject, storyboard or visual continuity.', tone: 'reference' },
      { title: 'Storyboard delivery', body: 'Move approved storyboard direction into 4K after cheaper Pro or Standard tests.', tone: 'continuity' },
      { title: 'Optional start/end frames', body: 'Use opening or ending frames when the native 4K render needs a stronger structure.', tone: 'reference' },
      { title: 'Not source-video V2V', body: 'Use O3 Pro or Standard when a source video and @Video1 are required.', tone: 'duration' },
      { title: 'Final quote', body: 'The app shows the exact 4K price before generation.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'When should you use O3 4K?',
        body: 'Use O3 4K after the reference or storyboard direction is approved and the output needs native 4K delivery.',
        cta: { label: 'Start O3 4K render', href: '/app?engine=kling-o3-4k' },
      },
      {
        title: 'Need source-video V2V?',
        body: 'Do not use 4K for source-video V2V. Use O3 Pro or Standard when @Video1 should guide motion or camera continuity.',
        cta: { label: 'View O3 Pro', href: modelsHref('en', 'kling-o3-pro') },
      },
      {
        title: 'Still choosing the direction?',
        body: 'Draft the visual structure in Standard or Pro before paying for the native 4K delivery route.',
        cta: { label: 'View O3 Standard', href: modelsHref('en', 'kling-o3-standard') },
      },
    ],
    referenceWorkflows: [
      { title: 'Reference images', body: 'Use @Image anchors for style, subject, product details or storyboard frames.' },
      { title: 'Start/end frames', body: 'Add an opening or ending frame when the 4K render needs a defined boundary.' },
      { title: 'Prompt structure', body: 'Keep the prompt explicit about camera, action, continuity and delivery intent.' },
      { title: 'No source video', body: 'Use O3 Pro or Standard if the workflow requires @Video1.' },
      { title: 'Final pass', body: 'Reserve 4K for approved shots, client review, campaign masters or edit-ready inserts.' },
    ],
    pricingCopy: {
      title: 'Kling 3.0 Omni 4K pricing at a glance',
      subtitle: 'Native 4K preset totals for approved reference-guided delivery renders.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'Native 4K reference route',
    },
    meta: {
      title: 'Kling 3.0 Omni 4K: Native 4K Reference Video | MaxVideoAI',
      description:
        'Use Kling 3.0 Omni 4K for native 4K reference-guided and storyboard-guided video. Use O3 Pro or Standard for source-video V2V.',
    },
  },
  fr: {
    ...KLING_O3_PRO_COPY.fr,
    hero: {
      ...KLING_O3_PRO_COPY.fr.hero,
      eyebrow: 'KLING 3.0 OMNI 4K',
      title: 'Kling 3.0 Omni 4K',
      subtitle: 'Vidéo Kling 4K native guidée par références pour directions storyboard validées. Ce n’est pas la route V2V depuis vidéo source.',
      subtitleHighlights: ['4K native', 'guidage par références', 'pas de V2V source'],
      paragraph:
        'Utilisez Kling 3.0 Omni 4K quand des images de référence ou frames storyboard doivent guider une finale 4K native sans devenir la frame d’ouverture. Utilisez O3 Pro ou Standard quand il faut une vidéo source ou @Video1.',
      primaryCta: { label: 'Générer avec Kling 3.0 Omni 4K', href: '/app?engine=kling-o3-4k' },
      secondaryCta: { label: 'Voir O3 Pro', href: modelsHref('fr', 'kling-o3-pro') },
      quickLinks: [
        { label: 'Comparer vs O3 Pro', href: compareHref('fr', 'kling-o3-4k', 'kling-o3-pro') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'kling-o3-4k-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Kling 3.0 Omni 4K',
      description: 'Rendu de livraison 4K natif guidé par storyboard',
      renderLabel: 'Voir le rendu',
      badges: ['4K native', '10 s', 'Audio off'],
      altContext: 'rendu Kling 3.0 Omni 4K natif guidé par storyboard',
    },
    features: [
      { title: '4K native', body: 'Utilisez cette route pour les rendus finaux 4K guidés par références.', tone: 'quality' },
      { title: 'Images de référence', body: 'Utilisez les ancres @Image pour style, sujet, storyboard ou continuité visuelle.', tone: 'reference' },
      { title: 'Livraison storyboard', body: 'Passez une direction validée en 4K après les tests moins coûteux en Pro ou Standard.', tone: 'continuity' },
      { title: 'Start/end optionnels', body: 'Ajoutez début ou fin quand le rendu 4K doit être mieux structuré.', tone: 'reference' },
      { title: 'Pas de V2V source', body: 'Utilisez O3 Pro ou Standard quand une vidéo source et @Video1 sont requis.', tone: 'duration' },
      { title: 'Prix final', body: 'L’app affiche le prix exact 4K avant génération.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Quand utiliser O3 4K ?',
        body: 'Utilisez O3 4K après validation de la direction référence ou storyboard, quand la sortie doit être en 4K native.',
        cta: { label: 'Lancer O3 4K', href: '/app?engine=kling-o3-4k' },
      },
      {
        title: 'Besoin de V2V source ?',
        body: 'N’utilisez pas 4K pour le V2V depuis vidéo source. Utilisez O3 Pro ou Standard quand @Video1 doit guider le mouvement.',
        cta: { label: 'Voir O3 Pro', href: modelsHref('fr', 'kling-o3-pro') },
      },
      {
        title: 'Direction encore à choisir ?',
        body: 'Brouillonnez la structure en Standard ou Pro avant de payer la route de livraison 4K native.',
        cta: { label: 'Voir O3 Standard', href: modelsHref('fr', 'kling-o3-standard') },
      },
    ],
    referenceWorkflows: [
      { title: 'Images de référence', body: 'Utilisez @Image pour style, sujet, détails produit ou frames storyboard.' },
      { title: 'Frames début/fin', body: 'Ajoutez une ouverture ou fin quand le rendu 4K demande une limite claire.' },
      { title: 'Structure du prompt', body: 'Soyez explicite sur caméra, action, continuité et intention de livraison.' },
      { title: 'Pas de vidéo source', body: 'Utilisez O3 Pro ou Standard si le workflow demande @Video1.' },
      { title: 'Passe finale', body: 'Réservez la 4K aux plans approuvés, revue client, masters campagne ou inserts montage.' },
    ],
    pricingCopy: {
      title: 'Prix Kling 3.0 Omni 4K en un coup d’œil',
      subtitle: 'Totaux 4K natifs pour rendus de livraison guidés par références.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Route référence 4K native',
    },
    meta: {
      title: 'Kling 3.0 Omni 4K : vidéo référence 4K native | MaxVideoAI',
      description:
        'Utilisez Kling 3.0 Omni 4K pour vidéo 4K native guidée par références et storyboard. Utilisez O3 Pro ou Standard pour V2V source.',
    },
  },
  es: {
    ...KLING_O3_PRO_COPY.es,
    hero: {
      ...KLING_O3_PRO_COPY.es.hero,
      eyebrow: 'KLING 3.0 OMNI 4K',
      title: 'Kling 3.0 Omni 4K',
      subtitle: 'Video Kling 4K nativo guiado por referencias para direcciones storyboard aprobadas. No es la ruta V2V desde video fuente.',
      subtitleHighlights: ['4K nativo', 'guiado por referencias', 'sin V2V fuente'],
      paragraph:
        'Usa Kling 3.0 Omni 4K cuando imágenes de referencia o frames storyboard deben guiar una final 4K nativa sin convertirse en la apertura. Usa O3 Pro o Standard cuando necesitas video fuente o @Video1.',
      primaryCta: { label: 'Generar con Kling 3.0 Omni 4K', href: '/app?engine=kling-o3-4k' },
      secondaryCta: { label: 'Ver O3 Pro', href: modelsHref('es', 'kling-o3-pro') },
      quickLinks: [
        { label: 'Comparar con O3 Pro', href: compareHref('es', 'kling-o3-4k', 'kling-o3-pro') },
        { label: 'Ver precios', href: pricingHref('es', 'kling-o3-4k-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Kling 3.0 Omni 4K',
      description: 'Render de entrega 4K nativo guiado por storyboard',
      renderLabel: 'Ver render',
      badges: ['4K nativo', '10 s', 'Audio off'],
      altContext: 'render Kling 3.0 Omni 4K nativo guiado por storyboard',
    },
    features: [
      { title: '4K nativo', body: 'Usa esta ruta para renders finales 4K guiados por referencias.', tone: 'quality' },
      { title: 'Imágenes de referencia', body: 'Usa anclas @Image para estilo, sujeto, storyboard o continuidad visual.', tone: 'reference' },
      { title: 'Entrega storyboard', body: 'Mueve una dirección aprobada a 4K después de pruebas más baratas en Pro o Standard.', tone: 'continuity' },
      { title: 'Start/end opcionales', body: 'Agrega inicio o final cuando el render 4K necesita más estructura.', tone: 'reference' },
      { title: 'Sin V2V fuente', body: 'Usa O3 Pro o Standard cuando se requiere video fuente y @Video1.', tone: 'duration' },
      { title: 'Precio final', body: 'La app muestra el precio exacto 4K antes de generar.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '¿Cuándo usar O3 4K?',
        body: 'Usa O3 4K después de aprobar la dirección por referencias o storyboard, cuando la salida necesita 4K nativo.',
        cta: { label: 'Iniciar O3 4K', href: '/app?engine=kling-o3-4k' },
      },
      {
        title: '¿Necesitas V2V fuente?',
        body: 'No uses 4K para V2V desde video fuente. Usa O3 Pro o Standard cuando @Video1 debe guiar el movimiento.',
        cta: { label: 'Ver O3 Pro', href: modelsHref('es', 'kling-o3-pro') },
      },
      {
        title: '¿Aún eliges dirección?',
        body: 'Haz borradores de estructura en Standard o Pro antes de pagar la ruta 4K nativa.',
        cta: { label: 'Ver O3 Standard', href: modelsHref('es', 'kling-o3-standard') },
      },
    ],
    referenceWorkflows: [
      { title: 'Imágenes de referencia', body: 'Usa @Image para estilo, sujeto, detalles de producto o frames storyboard.' },
      { title: 'Frames inicio/final', body: 'Agrega apertura o final cuando el render 4K necesita un límite claro.' },
      { title: 'Estructura del prompt', body: 'Sé explícito con cámara, acción, continuidad e intención de entrega.' },
      { title: 'Sin video fuente', body: 'Usa O3 Pro o Standard si el workflow requiere @Video1.' },
      { title: 'Pasada final', body: 'Reserva 4K para tomas aprobadas, revisión cliente, masters de campaña o inserts de edición.' },
    ],
    pricingCopy: {
      title: 'Precios de Kling 3.0 Omni 4K de un vistazo',
      subtitle: 'Totales 4K nativos para renders de entrega guiados por referencias.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Ruta referencia 4K nativa',
    },
    meta: {
      title: 'Kling 3.0 Omni 4K: video referencia 4K nativo | MaxVideoAI',
      description:
        'Usa Kling 3.0 Omni 4K para video 4K nativo guiado por referencias y storyboard. Usa O3 Pro o Standard para V2V fuente.',
    },
  },
};

const KLING_25_TURBO_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'SUPPORTED KLING SILENT DRAFT ROUTE',
      title: 'Kling 2.5 Turbo',
      subtitle: 'Silent 1080p drafts for text or image starts, camera look-dev, and negative prompt control.',
      subtitleHighlights: ['Silent 1080p drafts', 'text or image starts', 'negative prompt control'],
      paragraph:
        'Use Kling 2.5 Turbo when you need a supported older Kling route for silent short drafts, single-image motion tests, camera-first look-dev, and lower-cost prompt cleanup before moving approved shots into Kling 3.',
      primaryCta: { label: 'Draft with Kling 2.5 Turbo', href: '/app?engine=kling-2-5-turbo' },
      secondaryCta: { label: 'View examples', href: examplesHref('en', 'kling') },
      quickLinks: [
        { label: 'View Kling 3 Standard', href: modelsHref('en', 'kling-3-standard') },
        { label: 'View pricing', href: pricingHref('en', 'kling-2-5-turbo-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Kling 2.5 Turbo example',
      description: 'Silent short draft for look-dev',
      renderLabel: 'View draft',
      badges: ['Silent', '10s', '1080p'],
      altContext: 'silent Kling 2.5 Turbo draft clip',
    },
    features: [
      { title: 'Silent drafts', body: 'Generate video-only clips that are easy to score or edit later.', tone: 'quality' },
      { title: 'Text or image', body: 'Start from a prompt or one reference still for short motion tests.', tone: 'reference' },
      { title: 'Camera look-dev', body: 'Try tracking, dolly, handheld or product moves before the final route.', tone: 'continuity' },
      { title: 'Negative prompt', body: 'Block extra people, text, logos and visual artifacts with cleanup copy.', tone: 'reference' },
      { title: 'Max 10s', body: 'Keep one scene and one action inside the exposed short duration.', tone: 'duration' },
      { title: 'Pay-as-you-go', body: 'See exact live price before you generate.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'When should you use 2.5 Turbo?',
        body: 'Use it for silent look-dev, camera tests and inexpensive Kling drafts. Use Kling 3 routes when the shot needs the current workflow.',
        cta: { label: 'View Kling 3 Standard', href: modelsHref('en', 'kling-3-standard') },
      },
      {
        title: 'Need audio or stronger finals?',
        body: 'Move approved recipes into Kling 3 Pro when the render needs stronger current-model fidelity or sound context.',
        cta: { label: 'View Kling 3 Pro', href: modelsHref('en', 'kling-3-pro') },
      },
      {
        title: 'Cleaning up a prompt?',
        body: 'Use one action, one camera move and a strong negative prompt before trying more expensive routes.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
    ],
    referenceWorkflows: [
      { title: 'Text prompt', body: 'Write a tight shot brief: subject, action, setting, camera move and style.' },
      { title: 'Single image', body: 'Use one still when subject shape, product framing or composition should anchor the clip.' },
      { title: 'Negative prompt', body: 'List what to avoid: text, logos, extra characters, distortion or low-quality motion.' },
      { title: 'CFG scale', body: 'Adjust adherence carefully when the shot needs less drift or more creative freedom.' },
      { title: 'Upgrade path', body: 'Send the best silent recipe to Kling 3 Standard or Pro when it is ready for review.' },
    ],
    pricingCopy: {
      title: 'Kling 2.5 Turbo pricing at a glance',
      subtitle: 'Preset silent draft totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'Up to 1080p',
    },
    meta: {
      title: 'Kling 2.5 Turbo: Pricing & Silent Drafts | MaxVideoAI',
      description:
        'Use Kling 2.5 Turbo for supported older Kling silent drafts, text or image starts, negative prompt control and lower-cost 1080p look-dev.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'ROUTE KLING DRAFT MUET PRISE EN CHARGE',
      title: 'Kling 2.5 Turbo',
      subtitle: 'Drafts muets 1080p pour départs texte ou image, look-dev caméra et contrôle par prompt négatif.',
      subtitleHighlights: ['Drafts muets 1080p', 'départs texte ou image', 'contrôle par prompt négatif'],
      paragraph:
        'Utilisez Kling 2.5 Turbo quand il vous faut une ancienne route Kling encore prise en charge pour des drafts muets courts, des tests de mouvement depuis une image, du look-dev caméra et du nettoyage de prompt avant Kling 3.',
      primaryCta: { label: 'Créer un draft avec Kling 2.5 Turbo', href: '/app?engine=kling-2-5-turbo' },
      secondaryCta: { label: 'Voir les exemples', href: examplesHref('fr', 'kling') },
      quickLinks: [
        { label: 'Voir Kling 3 Standard', href: modelsHref('fr', 'kling-3-standard') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'kling-2-5-turbo-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Kling 2.5 Turbo',
      description: 'Draft muet court pour look-dev',
      renderLabel: 'Voir le draft',
      badges: ['Muet', '10 s', '1080p'],
      altContext: 'draft muet Kling 2.5 Turbo',
    },
    features: [
      { title: 'Drafts muets', body: 'Générez des clips sans son, faciles à monter ou sonoriser ensuite.', tone: 'quality' },
      { title: 'Texte ou image', body: 'Partez d’un prompt ou d’une image unique pour tester le mouvement.', tone: 'reference' },
      { title: 'Look-dev caméra', body: 'Testez tracking, dolly, handheld ou mouvement produit avant la route finale.', tone: 'continuity' },
      { title: 'Prompt négatif', body: 'Bloquez texte, logos, personnages en trop et artefacts visuels.', tone: 'reference' },
      { title: 'Max 10 s', body: 'Gardez une scène et une action dans une durée courte.', tone: 'duration' },
      { title: 'Paiement à l’usage', body: 'Prix exact affiché avant génération.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Quand utiliser 2.5 Turbo ?',
        body: 'Utilisez-le pour le look-dev muet, les tests caméra et les drafts Kling économiques. Passez aux routes Kling 3 pour le workflow actuel.',
        cta: { label: 'Voir Kling 3 Standard', href: modelsHref('fr', 'kling-3-standard') },
      },
      {
        title: 'Besoin de son ou d’un rendu plus final ?',
        body: 'Déplacez les recettes validées vers Kling 3 Pro quand le plan demande plus de fidélité ou du contexte sonore.',
        cta: { label: 'Voir Kling 3 Pro', href: modelsHref('fr', 'kling-3-pro') },
      },
      {
        title: 'Vous nettoyez un prompt ?',
        body: 'Gardez une action, un mouvement caméra et un prompt négatif solide avant les routes plus coûteuses.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt texte', body: 'Rédigez un brief serré : sujet, action, décor, mouvement caméra et style.' },
      { title: 'Image unique', body: 'Utilisez une image quand la forme du sujet, le produit ou le cadrage doivent rester stables.' },
      { title: 'Prompt négatif', body: 'Listez ce à éviter : texte, logos, personnages en trop, distorsion ou mouvement faible.' },
      { title: 'CFG scale', body: 'Ajustez l’adhérence avec prudence quand le plan dérive ou manque de liberté.' },
      { title: 'Passage Kling 3', body: 'Envoyez la meilleure recette muette vers Kling 3 Standard ou Pro pour la revue.' },
    ],
    pricingCopy: {
      title: 'Prix Kling 2.5 Turbo en un coup d’œil',
      subtitle: 'Prix totaux de drafts muets — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Jusqu’à 1080p',
    },
    meta: {
      title: 'Kling 2.5 Turbo : tarifs et drafts muets | MaxVideoAI',
      description:
        'Utilisez Kling 2.5 Turbo pour des drafts Kling muets encore pris en charge, départ texte ou image, prompt négatif et look-dev 1080p à moindre coût.',
    },
  },
  es: {
    hero: {
      eyebrow: 'RUTA KLING SILENCIOSA AUN COMPATIBLE',
      title: 'Kling 2.5 Turbo',
      subtitle: 'Borradores silenciosos 1080p para arranques con texto o imagen, look-dev de cámara y control con prompt negativo.',
      subtitleHighlights: ['Borradores silenciosos 1080p', 'arranques con texto o imagen', 'control con prompt negativo'],
      paragraph:
        'Usa Kling 2.5 Turbo cuando necesitas una ruta Kling anterior aún compatible para borradores cortos sin sonido, pruebas desde una imagen, look-dev de cámara y limpieza de prompt antes de pasar a Kling 3.',
      primaryCta: { label: 'Crear borrador con Kling 2.5 Turbo', href: '/app?engine=kling-2-5-turbo' },
      secondaryCta: { label: 'Ver ejemplos', href: examplesHref('es', 'kling') },
      quickLinks: [
        { label: 'Ver Kling 3 Standard', href: modelsHref('es', 'kling-3-standard') },
        { label: 'Ver precios', href: pricingHref('es', 'kling-2-5-turbo-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Kling 2.5 Turbo',
      description: 'Borrador silencioso corto para look-dev',
      renderLabel: 'Ver borrador',
      badges: ['Silencioso', '10 s', '1080p'],
      altContext: 'borrador silencioso con Kling 2.5 Turbo',
    },
    features: [
      { title: 'Borradores sin sonido', body: 'Genera clips de video listos para musicalizar o editar después.', tone: 'quality' },
      { title: 'Texto o imagen', body: 'Empieza con un prompt o una sola imagen para probar movimiento corto.', tone: 'reference' },
      { title: 'Look-dev de cámara', body: 'Prueba tracking, dolly, handheld o movimientos de producto antes de la ruta final.', tone: 'continuity' },
      { title: 'Prompt negativo', body: 'Bloquea texto, logos, personajes extra y artefactos visuales.', tone: 'reference' },
      { title: 'Máx. 10 s', body: 'Mantén una escena y una acción dentro de la duración corta.', tone: 'duration' },
      { title: 'Pago por uso', body: 'Ve el precio exacto antes de generar.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '¿Cuándo usar 2.5 Turbo?',
        body: 'Úsalo para look-dev silencioso, pruebas de cámara y borradores Kling económicos. Usa rutas Kling 3 para el flujo actual.',
        cta: { label: 'Ver Kling 3 Standard', href: modelsHref('es', 'kling-3-standard') },
      },
      {
        title: '¿Necesitas sonido o más acabado?',
        body: 'Pasa las recetas aprobadas a Kling 3 Pro cuando la toma necesita más fidelidad o contexto sonoro.',
        cta: { label: 'Ver Kling 3 Pro', href: modelsHref('es', 'kling-3-pro') },
      },
      {
        title: '¿Estás limpiando un prompt?',
        body: 'Usa una acción, un movimiento de cámara y un prompt negativo claro antes de probar rutas más costosas.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt de texto', body: 'Escribe un brief concreto: sujeto, acción, entorno, movimiento de cámara y estilo.' },
      { title: 'Imagen única', body: 'Usa un still cuando forma del sujeto, producto o composición deban quedar anclados.' },
      { title: 'Prompt negativo', body: 'Lista lo que debes evitar: texto, logos, personajes extra, distorsión o baja calidad.' },
      { title: 'CFG scale', body: 'Ajusta adherencia con cuidado si la toma deriva o necesita más libertad creativa.' },
      { title: 'Paso a Kling 3', body: 'Lleva la mejor receta silenciosa a Kling 3 Standard o Pro para revisión.' },
    ],
    pricingCopy: {
      title: 'Precios de Kling 2.5 Turbo de un vistazo',
      subtitle: 'Totales de borradores silenciosos. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Hasta 1080p',
    },
    meta: {
      title: 'Kling 2.5 Turbo: precios y borradores mudos | MaxVideoAI',
      description:
        'Usa Kling 2.5 Turbo para borradores Kling silenciosos aún compatibles, arranque con texto o imagen, prompt negativo y look-dev 1080p de menor costo.',
    },
  },
};

const KLING_26_PRO_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'SUPPORTED KLING AUDIO PRO ROUTE',
      title: 'Kling 2.6 Pro',
      subtitle: 'Native audio, 1080p short clips, and text-to-video or image-to-video for supported older Kling Pro workflows.',
      subtitleHighlights: ['Native audio', '1080p short clips', 'text-to-video or image-to-video'],
      paragraph:
        'Use Kling 2.6 Pro when you need a supported older Kling route for short audio-ready clips, text or image starts, negative prompts, seed control and 1080p output before moving current work into Kling 3 Pro.',
      primaryCta: { label: 'Generate with Kling 2.6 Pro', href: '/app?engine=kling-2-6-pro' },
      secondaryCta: { label: 'View examples', href: examplesHref('en', 'kling') },
      quickLinks: [
        { label: 'Compare vs Kling 3 Pro', href: compareHref('en', 'kling-2-6-pro', 'kling-3-pro') },
        { label: 'View pricing', href: pricingHref('en', 'kling-2-6-pro-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Kling 2.6 Pro example',
      description: 'Audio-ready 1080p short clip',
      renderLabel: 'View render',
      badges: ['Audio on', '10s', '1080p'],
      altContext: 'Kling 2.6 Pro short cinematic clip with audio',
    },
    features: [
      { title: 'Native audio', body: 'Generate dialogue, ambience or SFX with the visual pass when audio is enabled.', tone: 'audio' },
      { title: 'Text-to-video', body: 'Start with a compact scene brief, camera direction and sound cue.', tone: 'reference' },
      { title: 'Image-to-video', body: 'Use one start image when composition or subject identity should stay anchored.', tone: 'continuity' },
      { title: '1080p output', body: 'Keep this supported route focused on short full-HD clips.', tone: 'quality' },
      { title: 'Max 10s', body: 'Plan one clean beat or a short two-beat sequence per render.', tone: 'duration' },
      { title: 'Pay-as-you-go', body: 'See exact live price before you generate.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Kling 2.6 Pro or Kling 3 Pro?',
        body: 'Use 2.6 Pro for supported older audio-ready short clips. Use Kling 3 Pro for the current Pro workflow and stronger production planning.',
        cta: { label: 'Compare Kling 2.6 Pro vs Kling 3 Pro', href: compareHref('en', 'kling-2-6-pro', 'kling-3-pro') },
      },
      {
        title: 'Need a short audio pass?',
        body: 'Keep dialogue and SFX brief, tie sound to visible action and use the audio toggle only when review context needs it.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Still only testing motion?',
        body: 'Use Kling 2.5 Turbo or Kling 3 Standard when the goal is silent draft iteration before a final-quality pass.',
        cta: { label: 'View Kling 2.5 Turbo', href: modelsHref('en', 'kling-2-5-turbo') },
      },
    ],
    referenceWorkflows: [
      { title: 'Text prompt', body: 'Write subject, action, camera, lighting, style and one short sound cue.' },
      { title: 'Start image', body: 'Use one image for product framing, character identity or a stable opening composition.' },
      { title: 'Audio cue', body: 'Keep ambience, SFX or dialogue short enough to sync with the visible beat.' },
      { title: 'Negative prompt and seed', body: 'Use cleanup terms and seed control when you need more repeatability.' },
      { title: 'Kling 3 handoff', body: 'Move approved recipes into Kling 3 Pro when the job needs the current route.' },
    ],
    pricingCopy: {
      title: 'Kling 2.6 Pro pricing at a glance',
      subtitle: 'Preset 1080p totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'Up to 1080p',
    },
    meta: {
      title: 'Kling 2.6 Pro: Pricing, Audio & Examples | MaxVideoAI',
      description:
        'Use Kling 2.6 Pro for supported older Kling 1080p clips with native audio, text-to-video, image-to-video, negative prompts and examples.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'ROUTE KLING PRO AUDIO PRISE EN CHARGE',
      title: 'Kling 2.6 Pro',
      subtitle: 'Audio natif, clips courts 1080p et texte-vidéo ou image-vidéo pour les anciens workflows Kling Pro pris en charge.',
      subtitleHighlights: ['Audio natif', 'clips courts 1080p', 'texte-vidéo ou image-vidéo'],
      paragraph:
        'Utilisez Kling 2.6 Pro quand il vous faut une ancienne route Kling encore prise en charge pour des clips courts avec audio, départ texte ou image, prompt négatif, seed et sortie 1080p avant de passer au workflow Kling 3 Pro actuel.',
      primaryCta: { label: 'Générer avec Kling 2.6 Pro', href: '/app?engine=kling-2-6-pro' },
      secondaryCta: { label: 'Voir les exemples', href: examplesHref('fr', 'kling') },
      quickLinks: [
        { label: 'Comparer vs Kling 3 Pro', href: compareHref('fr', 'kling-2-6-pro', 'kling-3-pro') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'kling-2-6-pro-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Kling 2.6 Pro',
      description: 'Clip court 1080p avec audio',
      renderLabel: 'Voir le rendu',
      badges: ['Audio activé', '10 s', '1080p'],
      altContext: 'clip cinématique court Kling 2.6 Pro avec audio',
    },
    features: [
      { title: 'Audio natif', body: 'Générez dialogue, ambiance ou SFX avec l’image quand l’audio est activé.', tone: 'audio' },
      { title: 'Texte-vidéo', body: 'Partez d’un brief compact avec scène, caméra et intention sonore.', tone: 'reference' },
      { title: 'Image-vidéo', body: 'Utilisez une image de départ pour stabiliser composition ou identité.', tone: 'continuity' },
      { title: 'Sortie 1080p', body: 'Gardez cette route sur des clips courts full HD.', tone: 'quality' },
      { title: 'Max 10 s', body: 'Planifiez un beat net ou une mini-séquence par rendu.', tone: 'duration' },
      { title: 'Paiement à l’usage', body: 'Prix exact affiché avant génération.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Kling 2.6 Pro ou Kling 3 Pro ?',
        body: 'Utilisez 2.6 Pro pour des clips courts audio-ready encore pris en charge. Utilisez Kling 3 Pro pour le workflow Pro actuel.',
        cta: { label: 'Comparer Kling 2.6 Pro vs Kling 3 Pro', href: compareHref('fr', 'kling-2-6-pro', 'kling-3-pro') },
      },
      {
        title: 'Besoin d’une passe audio courte ?',
        body: 'Gardez dialogues et SFX courts, reliés à l’action visible, et activez l’audio seulement si la revue en a besoin.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Vous testez seulement le mouvement ?',
        body: 'Utilisez Kling 2.5 Turbo ou Kling 3 Standard pour des itérations muettes avant la passe finale.',
        cta: { label: 'Voir Kling 2.5 Turbo', href: modelsHref('fr', 'kling-2-5-turbo') },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt texte', body: 'Écrivez sujet, action, caméra, lumière, style et un cue sonore court.' },
      { title: 'Image de départ', body: 'Utilisez une image pour cadrage produit, identité ou composition d’ouverture.' },
      { title: 'Cue audio', body: 'Gardez ambiance, SFX ou dialogue assez courts pour rester synchrones.' },
      { title: 'Prompt négatif et seed', body: 'Ajoutez des termes de nettoyage et un seed quand il faut plus de répétabilité.' },
      { title: 'Passage Kling 3', body: 'Déplacez les recettes validées vers Kling 3 Pro quand le job demande la route actuelle.' },
    ],
    pricingCopy: {
      title: 'Prix Kling 2.6 Pro en un coup d’œil',
      subtitle: 'Prix totaux 1080p prédéfinis — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Jusqu’à 1080p',
    },
    meta: {
      title: 'Kling 2.6 Pro : tarifs, audio et exemples | MaxVideoAI',
      description:
        'Utilisez Kling 2.6 Pro pour des clips Kling 1080p encore pris en charge avec audio natif, texte-vidéo, image-vidéo, prompt négatif et exemples.',
    },
  },
  es: {
    hero: {
      eyebrow: 'RUTA KLING PRO CON AUDIO AUN COMPATIBLE',
      title: 'Kling 2.6 Pro',
      subtitle: 'Audio nativo, clips cortos 1080p y texto a video o imagen a video para workflows Kling Pro anteriores aún compatibles.',
      subtitleHighlights: ['Audio nativo', 'clips cortos 1080p', 'texto a video o imagen a video'],
      paragraph:
        'Usa Kling 2.6 Pro cuando necesitas una ruta Kling anterior aún compatible para clips cortos con audio, arranque con texto o imagen, prompt negativo, seed y salida 1080p antes de mover el trabajo actual a Kling 3 Pro.',
      primaryCta: { label: 'Generar con Kling 2.6 Pro', href: '/app?engine=kling-2-6-pro' },
      secondaryCta: { label: 'Ver ejemplos', href: examplesHref('es', 'kling') },
      quickLinks: [
        { label: 'Comparar con Kling 3 Pro', href: compareHref('es', 'kling-2-6-pro', 'kling-3-pro') },
        { label: 'Ver precios', href: pricingHref('es', 'kling-2-6-pro-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Kling 2.6 Pro',
      description: 'Clip corto 1080p listo para audio',
      renderLabel: 'Ver render',
      badges: ['Audio activado', '10 s', '1080p'],
      altContext: 'clip cinematográfico corto con Kling 2.6 Pro y audio',
    },
    features: [
      { title: 'Audio nativo', body: 'Genera diálogo, ambiente o SFX con la pasada visual cuando el audio está activo.', tone: 'audio' },
      { title: 'Texto a video', body: 'Empieza con un brief compacto de escena, cámara y sonido.', tone: 'reference' },
      { title: 'Imagen a video', body: 'Usa una imagen inicial para anclar composición o identidad.', tone: 'continuity' },
      { title: 'Salida 1080p', body: 'Mantén esta ruta enfocada en clips cortos full HD.', tone: 'quality' },
      { title: 'Máx. 10 s', body: 'Planea un beat claro o una secuencia muy corta por render.', tone: 'duration' },
      { title: 'Pago por uso', body: 'Ve el precio exacto antes de generar.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '¿Kling 2.6 Pro o Kling 3 Pro?',
        body: 'Usa 2.6 Pro para clips cortos con audio aún compatibles. Usa Kling 3 Pro para el workflow Pro actual.',
        cta: { label: 'Comparar Kling 2.6 Pro vs Kling 3 Pro', href: compareHref('es', 'kling-2-6-pro', 'kling-3-pro') },
      },
      {
        title: '¿Necesitas una pasada corta con audio?',
        body: 'Mantén diálogo y SFX breves, ligados a acciones visibles, y activa audio solo cuando la revisión lo necesite.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: '¿Solo estás probando movimiento?',
        body: 'Usa Kling 2.5 Turbo o Kling 3 Standard para iteraciones silenciosas antes de la pasada final.',
        cta: { label: 'Ver Kling 2.5 Turbo', href: modelsHref('es', 'kling-2-5-turbo') },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt de texto', body: 'Escribe sujeto, acción, cámara, luz, estilo y un cue de sonido corto.' },
      { title: 'Imagen inicial', body: 'Usa una imagen para anclar producto, identidad o composición de apertura.' },
      { title: 'Cue de audio', body: 'Mantén ambiente, SFX o diálogo lo bastante cortos para sincronizar con el beat visible.' },
      { title: 'Prompt negativo y seed', body: 'Usa términos de limpieza y seed cuando necesitas más repetibilidad.' },
      { title: 'Paso a Kling 3', body: 'Mueve las recetas aprobadas a Kling 3 Pro cuando el trabajo necesita la ruta actual.' },
    ],
    pricingCopy: {
      title: 'Precios de Kling 2.6 Pro de un vistazo',
      subtitle: 'Totales 1080p predefinidos. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Hasta 1080p',
    },
    meta: {
      title: 'Kling 2.6 Pro: precios, audio y ejemplos | MaxVideoAI',
      description:
        'Usa Kling 2.6 Pro para clips Kling 1080p aún compatibles con audio nativo, texto a video, imagen a video, prompt negativo y ejemplos.',
    },
  },
};

const WAN_26_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'WAN MULTI-SHOT VIDEO ROUTE',
      title: 'Wan 2.6',
      subtitle: '15s multi-shot clips, 5s/10s reference-video consistency, and optional audio for text or image starts.',
      subtitleHighlights: ['15s multi-shot clips', '5s/10s reference-video consistency', 'optional audio for text or image starts'],
      paragraph:
        'Use Wan 2.6 when you need the newer Wan route on MaxVideoAI: 720p or 1080p clips up to 15 seconds, text-to-video, image-to-video, 5s/10s reference-video guidance and optional audio for text or image workflows.',
      primaryCta: { label: 'Generate with Wan 2.6', href: '/app?engine=wan-2-6' },
      secondaryCta: { label: 'View examples', href: examplesHref('en', 'wan') },
      quickLinks: [
        { label: 'Compare vs Sora 2', href: compareHref('en', 'wan-2-6', 'sora-2', 'wan-2-6') },
        { label: 'View pricing', href: pricingHref('en', 'wan-2-6-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Wan 2.6 example',
      description: 'Multi-shot reference-guided clip',
      renderLabel: 'View render',
      badges: ['15s max', '1080p', 'Audio option'],
      altContext: 'Wan 2.6 multi-shot cinematic clip',
    },
    features: [
      { title: 'Multi-shot clips', body: 'Plan short sequences with cleaner internal beat structure.', tone: 'continuity' },
      { title: 'Reference-to-video', body: 'Use supported reference videos for 5s/10s consistency checks; audio is off in this mode.', tone: 'reference' },
      { title: 'Text or image start', body: 'Generate from a prompt or anchor the first frame with one image.', tone: 'reference' },
      { title: '720p or 1080p', body: 'Choose review or production preview resolution before generation.', tone: 'quality' },
      { title: 'Max 15s', body: 'Use 5, 10 or 15 second durations depending on the beat.', tone: 'duration' },
      { title: 'Pay-as-you-go', body: 'See exact live price before you generate.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Wan 2.6 or Wan 2.5?',
        body: 'Use Wan 2.6 for longer 15s clips, reference-video consistency and multi-shot planning. Use Wan 2.5 for shorter audio-ready checks.',
        cta: { label: 'Compare Wan 2.6 vs Wan 2.5', href: compareHref('en', 'wan-2-6', 'wan-2-5', 'wan-2-6') },
      },
      {
        title: 'Need reference consistency?',
        body: 'Use reference-to-video for 5s/10s clips when motion rhythm, subject identity or a previous take should guide the next output.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Comparing premium routes?',
        body: 'Compare Wan 2.6 with Sora 2 or Veo 3.1 when audio, consistency and cinematic polish are the decision points.',
        cta: { label: 'Compare Wan 2.6 vs Sora 2', href: compareHref('en', 'wan-2-6', 'sora-2', 'wan-2-6') },
      },
    ],
    referenceWorkflows: [
      { title: 'Text prompt', body: 'Write subject, action, camera, style, duration and optional sound direction.' },
      { title: 'Image start', body: 'Use one still to lock product shape, character framing or opening composition.' },
      { title: 'Reference videos', body: 'Use one to three videos for 5s/10s guidance when motion or identity should stay consistent.' },
      { title: 'Audio track', body: 'Attach a short track only for text or image workflows when timing or mood should follow sound.' },
      { title: 'Multi-shot beats', body: 'Use short timestamped beats when a 15 second clip needs internal structure.' },
    ],
    pricingCopy: {
      title: 'Wan 2.6 pricing at a glance',
      subtitle: 'Preset 720p/1080p totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'Up to 1080p',
    },
    meta: {
      title: 'Wan 2.6: Pricing, References & Examples | MaxVideoAI',
      description:
        'Explore Wan 2.6 pricing, 15s multi-shot video, text-to-video, image-to-video, 5s/10s reference-video workflows, optional audio and examples.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'ROUTE VIDÉO WAN MULTI-PLANS',
      title: 'Wan 2.6',
      subtitle: 'Clips multi-plans jusqu’à 15 s, cohérence reference-to-video en 5s/10s et audio optionnel depuis texte ou image.',
      subtitleHighlights: ['Clips multi-plans jusqu’à 15 s', 'cohérence reference-to-video en 5s/10s', 'audio optionnel depuis texte ou image'],
      paragraph:
        'Utilisez Wan 2.6 pour la route Wan plus récente dans MaxVideoAI : clips 720p ou 1080p jusqu’à 15 secondes, texte-vidéo, image-vidéo, guidage par vidéos de référence en 5s/10s et audio optionnel depuis texte ou image.',
      primaryCta: { label: 'Générer avec Wan 2.6', href: '/app?engine=wan-2-6' },
      secondaryCta: { label: 'Voir les exemples', href: examplesHref('fr', 'wan') },
      quickLinks: [
        { label: 'Comparer vs Sora 2', href: compareHref('fr', 'wan-2-6', 'sora-2', 'wan-2-6') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'wan-2-6-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Wan 2.6',
      description: 'Clip multi-plans guidé par références',
      renderLabel: 'Voir le rendu',
      badges: ['15 s max', '1080p', 'Audio optionnel'],
      altContext: 'clip cinématique multi-plans Wan 2.6',
    },
    features: [
      { title: 'Clips multi-plans', body: 'Structurez des séquences courtes avec des beats plus lisibles.', tone: 'continuity' },
      { title: 'Reference-to-video', body: 'Utilisez des vidéos de référence pour des checks 5s/10s; l’audio est désactivé dans ce mode.', tone: 'reference' },
      { title: 'Texte ou image', body: 'Partez d’un prompt ou d’une image pour ancrer la première frame.', tone: 'reference' },
      { title: '720p ou 1080p', body: 'Choisissez résolution de revue ou de préproduction avant génération.', tone: 'quality' },
      { title: 'Max 15 s', body: 'Utilisez 5, 10 ou 15 secondes selon le beat.', tone: 'duration' },
      { title: 'Paiement à l’usage', body: 'Prix exact affiché avant génération.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Wan 2.6 ou Wan 2.5 ?',
        body: 'Utilisez Wan 2.6 pour le 15 s, la cohérence par vidéo de référence et le multi-plans. Wan 2.5 reste utile pour les checks audio courts.',
        cta: { label: 'Comparer Wan 2.6 vs Wan 2.5', href: compareHref('fr', 'wan-2-6', 'wan-2-5', 'wan-2-6') },
      },
      {
        title: 'Besoin de cohérence par référence ?',
        body: 'Utilisez reference-to-video en 5s/10s quand mouvement, identité ou take précédent doivent guider le résultat.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Vous comparez les routes premium ?',
        body: 'Comparez Wan 2.6 avec Sora 2 ou Veo 3.1 quand audio, cohérence et rendu cinématique guident le choix.',
        cta: { label: 'Comparer Wan 2.6 vs Sora 2', href: compareHref('fr', 'wan-2-6', 'sora-2', 'wan-2-6') },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt texte', body: 'Indiquez sujet, action, caméra, style, durée et intention sonore optionnelle.' },
      { title: 'Image de départ', body: 'Utilisez une image pour figer produit, personnage ou composition d’ouverture.' },
      { title: 'Vidéos de référence', body: 'Ajoutez une à trois vidéos pour guider mouvement ou identité sur des clips 5s/10s.' },
      { title: 'Piste audio', body: 'Ajoutez une piste courte uniquement en texte ou image quand le timing doit suivre le son.' },
      { title: 'Beats multi-plans', body: 'Utilisez des beats courts et datés quand un clip de 15 s doit rester structuré.' },
    ],
    pricingCopy: {
      title: 'Prix Wan 2.6 en un coup d’œil',
      subtitle: 'Prix totaux 720p/1080p prédéfinis — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Jusqu’à 1080p',
    },
    meta: {
      title: 'Wan 2.6 : tarifs, références et exemples | MaxVideoAI',
      description:
        'Explorez Wan 2.6 : prix, vidéo multi-plans jusqu’à 15 s, texte-vidéo, image-vidéo, références 5s/10s, audio optionnel et exemples.',
    },
  },
  es: {
    hero: {
      eyebrow: 'RUTA WAN MULTI-SHOT',
      title: 'Wan 2.6',
      subtitle: 'Clips multi-shot de hasta 15 s, consistencia reference-to-video en 5s/10s y audio opcional desde texto o imagen.',
      subtitleHighlights: ['Clips multi-shot de hasta 15 s', 'consistencia reference-to-video en 5s/10s', 'audio opcional desde texto o imagen'],
      paragraph:
        'Usa Wan 2.6 como la ruta Wan más reciente en MaxVideoAI: clips 720p o 1080p de hasta 15 segundos, texto a video, imagen a video, guía con videos de referencia en 5s/10s y audio opcional desde texto o imagen.',
      primaryCta: { label: 'Generar con Wan 2.6', href: '/app?engine=wan-2-6' },
      secondaryCta: { label: 'Ver ejemplos', href: examplesHref('es', 'wan') },
      quickLinks: [
        { label: 'Comparar con Sora 2', href: compareHref('es', 'wan-2-6', 'sora-2', 'wan-2-6') },
        { label: 'Ver precios', href: pricingHref('es', 'wan-2-6-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Wan 2.6',
      description: 'Clip multi-shot guiado por referencias',
      renderLabel: 'Ver render',
      badges: ['15 s max', '1080p', 'Audio opcional'],
      altContext: 'clip cinematográfico multi-shot con Wan 2.6',
    },
    features: [
      { title: 'Clips multi-shot', body: 'Planea secuencias cortas con estructura interna más clara.', tone: 'continuity' },
      { title: 'Reference-to-video', body: 'Usa videos de referencia para checks 5s/10s; el audio queda desactivado en este modo.', tone: 'reference' },
      { title: 'Texto o imagen', body: 'Genera desde prompt o ancla el primer frame con una imagen.', tone: 'reference' },
      { title: '720p o 1080p', body: 'Elige resolución de revisión o preproducción antes de generar.', tone: 'quality' },
      { title: 'Máx. 15 s', body: 'Usa 5, 10 o 15 segundos según el beat.', tone: 'duration' },
      { title: 'Pago por uso', body: 'Ve el precio exacto antes de generar.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '¿Wan 2.6 o Wan 2.5?',
        body: 'Usa Wan 2.6 para 15 s, consistencia con video de referencia y multi-shot. Usa Wan 2.5 para checks cortos con audio.',
        cta: { label: 'Comparar Wan 2.6 vs Wan 2.5', href: compareHref('es', 'wan-2-6', 'wan-2-5', 'wan-2-6') },
      },
      {
        title: '¿Necesitas consistencia por referencia?',
        body: 'Usa reference-to-video en 5s/10s cuando ritmo de movimiento, identidad o un take previo deben guiar el output.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: '¿Comparas rutas premium?',
        body: 'Compara Wan 2.6 con Sora 2 o Veo 3.1 cuando audio, consistencia y acabado cinematográfico importan.',
        cta: { label: 'Comparar Wan 2.6 vs Sora 2', href: compareHref('es', 'wan-2-6', 'sora-2', 'wan-2-6') },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt de texto', body: 'Define sujeto, acción, cámara, estilo, duración y dirección sonora opcional.' },
      { title: 'Imagen inicial', body: 'Usa una imagen para fijar producto, personaje o composición inicial.' },
      { title: 'Videos de referencia', body: 'Agrega uno a tres videos para guiar movimiento o identidad en clips de 5s/10s.' },
      { title: 'Pista de audio', body: 'Adjunta una pista corta solo en texto o imagen cuando el timing debe seguir sonido.' },
      { title: 'Beats multi-shot', body: 'Usa beats breves con tiempos cuando un clip de 15 s necesita estructura interna.' },
    ],
    pricingCopy: {
      title: 'Precios de Wan 2.6 de un vistazo',
      subtitle: 'Totales 720p/1080p predefinidos. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Hasta 1080p',
    },
    meta: {
      title: 'Wan 2.6: precios, referencias y ejemplos | MaxVideoAI',
      description:
        'Explora Wan 2.6: precios, video multi-shot hasta 15 s, texto a video, imagen a video, referencias 5s/10s, audio opcional y ejemplos.',
    },
  },
};

const WAN_25_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'WAN SUPPORTED AUDIO DRAFT ROUTE',
      title: 'Wan 2.5',
      subtitle: 'Audio-ready 5-10s clips for text or image starts, prompt expansion, and 480p to 1080p checks.',
      subtitleHighlights: ['Audio-ready 5-10s clips', 'text or image starts', '480p to 1080p checks'],
      paragraph:
        'Use Wan 2.5 when you need the supported older Wan route for short audio-ready tests: text-to-video, image-to-video, optional soundtrack upload, prompt expansion, seed control and lower-resolution draft passes.',
      primaryCta: { label: 'Generate with Wan 2.5', href: '/app?engine=wan-2-5' },
      secondaryCta: { label: 'View examples', href: examplesHref('en', 'wan') },
      quickLinks: [
        { label: 'Compare vs Sora 2', href: compareHref('en', 'wan-2-5', 'sora-2', 'wan-2-5') },
        { label: 'View pricing', href: pricingHref('en', 'wan-2-5-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Wan 2.5 example',
      description: 'Short audio-ready draft clip',
      renderLabel: 'View render',
      badges: ['Audio-ready', '10s max', '1080p'],
      altContext: 'Wan 2.5 short audio-ready draft clip',
    },
    features: [
      { title: 'Audio-ready tests', body: 'Use native sound or attach a short WAV/MP3 track when timing matters.', tone: 'audio' },
      { title: 'Text or image start', body: 'Generate from a prompt or one source image for quick motion checks.', tone: 'reference' },
      { title: '480p to 1080p', body: 'Pick lower-cost draft resolution or 1080p when the shot needs more detail.', tone: 'quality' },
      { title: 'Prompt expansion', body: 'Use expansion when a simple brief needs more visual detail.', tone: 'continuity' },
      { title: 'Max 10s', body: 'Keep Wan 2.5 focused on short single-beat or two-beat clips.', tone: 'duration' },
      { title: 'Pay-as-you-go', body: 'See exact live price before you generate.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Wan 2.5 or Wan 2.6?',
        body: 'Use Wan 2.5 for short audio-ready checks and lower-resolution drafts. Use Wan 2.6 when you need 15s, multi-shot or reference-video guidance.',
        cta: { label: 'View Wan 2.6', href: modelsHref('en', 'wan-2-6') },
      },
      {
        title: 'Need the soundtrack to steer timing?',
        body: 'Attach a short audio file when rhythm or mood should guide the clip, then keep the visual prompt simple.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Comparing audio-native routes?',
        body: 'Compare Wan 2.5 with Sora 2 when you are choosing between lower-cost checks and Sora-style synced outputs.',
        cta: { label: 'Compare Wan 2.5 vs Sora 2', href: compareHref('en', 'wan-2-5', 'sora-2', 'wan-2-5') },
      },
    ],
    referenceWorkflows: [
      { title: 'Text prompt', body: 'Describe one subject, one action, one camera move and one sound direction.' },
      { title: 'Image start', body: 'Use a single image to hold framing, product shape or character identity.' },
      { title: 'Audio file', body: 'Attach a short soundtrack when rhythm, ambience or mood should drive the take.' },
      { title: 'Prompt expansion', body: 'Turn expansion on for sparse briefs; turn it off when every visual detail is deliberate.' },
      { title: 'Wan 2.6 upgrade', body: 'Move to Wan 2.6 for longer clips, multi-shot plans or reference-video consistency.' },
    ],
    pricingCopy: {
      title: 'Wan 2.5 pricing at a glance',
      subtitle: 'Preset short-clip totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'Up to 1080p',
    },
    meta: {
      title: 'Wan 2.5: Pricing, Audio Drafts & Examples | MaxVideoAI',
      description:
        'Use Wan 2.5 for short audio-ready AI video drafts, text-to-video, image-to-video, optional soundtrack upload, prompt expansion and pricing.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'ROUTE WAN AUDIO DRAFT PRISE EN CHARGE',
      title: 'Wan 2.5',
      subtitle: 'Clips audio-ready de 5 à 10 s pour départs texte ou image, expansion de prompt et checks 480p à 1080p.',
      subtitleHighlights: ['Clips audio-ready de 5 à 10 s', 'départs texte ou image', 'checks 480p à 1080p'],
      paragraph:
        'Utilisez Wan 2.5 quand il vous faut l’ancienne route Wan encore prise en charge pour des tests courts avec audio : texte-vidéo, image-vidéo, upload audio optionnel, expansion de prompt, seed et drafts basse résolution.',
      primaryCta: { label: 'Générer avec Wan 2.5', href: '/app?engine=wan-2-5' },
      secondaryCta: { label: 'Voir les exemples', href: examplesHref('fr', 'wan') },
      quickLinks: [
        { label: 'Comparer vs Sora 2', href: compareHref('fr', 'wan-2-5', 'sora-2', 'wan-2-5') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'wan-2-5-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Wan 2.5',
      description: 'Draft court audio-ready',
      renderLabel: 'Voir le rendu',
      badges: ['Audio-ready', '10 s max', '1080p'],
      altContext: 'draft court Wan 2.5 avec audio',
    },
    features: [
      { title: 'Tests audio-ready', body: 'Utilisez le son natif ou une piste WAV/MP3 courte quand le timing compte.', tone: 'audio' },
      { title: 'Texte ou image', body: 'Partez d’un prompt ou d’une image source pour tester vite le mouvement.', tone: 'reference' },
      { title: '480p à 1080p', body: 'Choisissez une résolution draft moins chère ou 1080p pour plus de détail.', tone: 'quality' },
      { title: 'Expansion de prompt', body: 'Activez-la quand un brief simple a besoin de détails visuels.', tone: 'continuity' },
      { title: 'Max 10 s', body: 'Gardez Wan 2.5 sur des clips courts à un ou deux beats.', tone: 'duration' },
      { title: 'Paiement à l’usage', body: 'Prix exact affiché avant génération.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Wan 2.5 ou Wan 2.6 ?',
        body: 'Utilisez Wan 2.5 pour des checks audio courts et des drafts basse résolution. Passez à Wan 2.6 pour 15 s, multi-plans ou référence vidéo.',
        cta: { label: 'Voir Wan 2.6', href: modelsHref('fr', 'wan-2-6') },
      },
      {
        title: 'La piste audio doit guider le timing ?',
        body: 'Ajoutez un fichier audio court quand rythme ou ambiance doivent piloter le clip, puis gardez le prompt visuel simple.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Vous comparez des routes avec audio ?',
        body: 'Comparez Wan 2.5 avec Sora 2 pour choisir entre checks moins coûteux et sorties synchronisées façon Sora.',
        cta: { label: 'Comparer Wan 2.5 vs Sora 2', href: compareHref('fr', 'wan-2-5', 'sora-2', 'wan-2-5') },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt texte', body: 'Décrivez un sujet, une action, un mouvement caméra et une direction sonore.' },
      { title: 'Image de départ', body: 'Utilisez une image pour conserver cadrage, produit ou identité du personnage.' },
      { title: 'Fichier audio', body: 'Ajoutez une piste courte quand rythme, ambiance ou mood doivent guider la prise.' },
      { title: 'Expansion de prompt', body: 'Activez-la pour un brief pauvre ; désactivez-la quand chaque détail est volontaire.' },
      { title: 'Passage Wan 2.6', body: 'Passez à Wan 2.6 pour clips plus longs, multi-plans ou cohérence par vidéo de référence.' },
    ],
    pricingCopy: {
      title: 'Prix Wan 2.5 en un coup d’œil',
      subtitle: 'Prix totaux de clips courts — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Jusqu’à 1080p',
    },
    meta: {
      title: 'Wan 2.5 : tarifs, drafts audio et exemples | MaxVideoAI',
      description:
        'Utilisez Wan 2.5 pour des drafts vidéo IA courts avec audio, texte-vidéo, image-vidéo, upload audio optionnel, expansion de prompt et tarifs.',
    },
  },
  es: {
    hero: {
      eyebrow: 'RUTA WAN AUDIO DRAFT AUN COMPATIBLE',
      title: 'Wan 2.5',
      subtitle: 'Clips con audio de 5 a 10 s para arranques con texto o imagen, expansión de prompt y checks de 480p a 1080p.',
      subtitleHighlights: ['Clips con audio de 5 a 10 s', 'arranques con texto o imagen', 'checks de 480p a 1080p'],
      paragraph:
        'Usa Wan 2.5 cuando necesitas la ruta Wan anterior aún compatible para pruebas cortas con audio: texto a video, imagen a video, carga de audio opcional, expansión de prompt, seed y borradores en baja resolución.',
      primaryCta: { label: 'Generar con Wan 2.5', href: '/app?engine=wan-2-5' },
      secondaryCta: { label: 'Ver ejemplos', href: examplesHref('es', 'wan') },
      quickLinks: [
        { label: 'Comparar con Sora 2', href: compareHref('es', 'wan-2-5', 'sora-2', 'wan-2-5') },
        { label: 'Ver precios', href: pricingHref('es', 'wan-2-5-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Wan 2.5',
      description: 'Borrador corto listo para audio',
      renderLabel: 'Ver render',
      badges: ['Con audio', '10 s max', '1080p'],
      altContext: 'borrador corto con audio usando Wan 2.5',
    },
    features: [
      { title: 'Pruebas con audio', body: 'Usa sonido nativo o adjunta una pista WAV/MP3 corta cuando el timing importa.', tone: 'audio' },
      { title: 'Texto o imagen', body: 'Empieza con un prompt o una imagen fuente para probar movimiento rápido.', tone: 'reference' },
      { title: '480p a 1080p', body: 'Elige resolución de borrador de menor coste o 1080p si necesitas más detalle.', tone: 'quality' },
      { title: 'Expansión de prompt', body: 'Actívala cuando un brief simple necesita más detalle visual.', tone: 'continuity' },
      { title: 'Máx. 10 s', body: 'Mantén Wan 2.5 en clips cortos de uno o dos beats.', tone: 'duration' },
      { title: 'Pago por uso', body: 'Ve el precio exacto antes de generar.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '¿Wan 2.5 o Wan 2.6?',
        body: 'Usa Wan 2.5 para checks cortos con audio y borradores de menor resolución. Usa Wan 2.6 para 15 s, multi-shot o video de referencia.',
        cta: { label: 'Ver Wan 2.6', href: modelsHref('es', 'wan-2-6') },
      },
      {
        title: '¿La pista debe marcar el ritmo?',
        body: 'Adjunta audio corto cuando ritmo o ambiente deben guiar el clip, y deja simple el prompt visual.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: '¿Comparas rutas con audio?',
        body: 'Compara Wan 2.5 con Sora 2 si eliges entre checks de menor coste y salidas sincronizadas estilo Sora.',
        cta: { label: 'Comparar Wan 2.5 vs Sora 2', href: compareHref('es', 'wan-2-5', 'sora-2', 'wan-2-5') },
      },
    ],
    referenceWorkflows: [
      { title: 'Prompt de texto', body: 'Describe un sujeto, una acción, un movimiento de cámara y una dirección sonora.' },
      { title: 'Imagen inicial', body: 'Usa una imagen para mantener encuadre, producto o identidad del personaje.' },
      { title: 'Archivo de audio', body: 'Adjunta una pista corta cuando ritmo, ambiente o mood deben guiar la toma.' },
      { title: 'Expansión de prompt', body: 'Actívala para briefs simples; apágala cuando cada detalle visual sea intencional.' },
      { title: 'Paso a Wan 2.6', body: 'Pasa a Wan 2.6 para clips más largos, multi-shot o consistencia con video de referencia.' },
    ],
    pricingCopy: {
      title: 'Precios de Wan 2.5 de un vistazo',
      subtitle: 'Totales de clips cortos. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Hasta 1080p',
    },
    meta: {
      title: 'Wan 2.5: precios, drafts con audio y ejemplos | MaxVideoAI',
      description:
        'Usa Wan 2.5 para borradores cortos de video IA con audio, texto a video, imagen a video, carga de audio opcional, expansión de prompt y precios.',
    },
  },
};

const LUMA_RAY_2_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'PREVIOUS-GENERATION LUMA ROUTE',
      title: 'Luma Ray 2',
      subtitle: 'Previous-generation Luma route for supported Generate, Modify and Reframe workflows.',
      subtitleHighlights: ['Previous-generation Luma', 'Modify', 'Reframe'],
      paragraph:
        'Use Luma Ray 2 when you need a legacy-compatible Luma render or an older Ray 2 workflow. Start new Luma Modify, guide/keyframe and Reframe work on Ray 3.2, then keep Ray 2 for historical prompts, fallback checks and older examples.',
      primaryCta: { label: 'Open legacy Ray 2', href: '/app?engine=lumaRay2' },
      secondaryCta: { label: 'Open Ray 3.2', href: modelsHref('en', 'luma-ray-3-2') },
      quickLinks: [
        { label: 'Current Luma: Ray 3.2', href: modelsHref('en', 'luma-ray-3-2') },
        { label: 'Compare vs Flash', href: compareHref('en', 'luma-ray-2', 'luma-ray-2-flash') },
        { label: 'View pricing', href: pricingHref('en', 'luma-ray-2-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Luma Ray 2 example',
      description: 'Previous-generation Luma workflow',
      renderLabel: 'View render',
      badges: ['Legacy route', 'Modify + Reframe', '1080p'],
      altContext: 'cinematic Luma Ray 2 video example',
    },
    features: [
      { title: 'Legacy Luma route', body: 'Use Ray 2 for older prompts, historical examples and compatibility checks.', tone: 'quality' },
      { title: 'Text or image start', body: 'Generate from a prompt or animate one still with optional end-frame guidance.', tone: 'reference' },
      { title: 'Modify source clips', body: 'Keep the blocking and timing that already work while changing look or detail.', tone: 'continuity' },
      { title: 'Reframe delivery cuts', body: 'Turn an approved source clip into vertical, square or wide delivery variants.', tone: 'reference' },
      { title: '5s or 9s generate', body: 'Choose short controlled generation runs up to 1080p.', tone: 'duration' },
      { title: 'Ray 3.2 for new edits', body: 'Use Ray 3.2 first when guide frames, keyframes or current Reframe behavior matter.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Ray 2 or Ray 3.2?',
        body: 'Use Ray 3.2 for current Luma Modify, keyframe guidance and Reframe work. Keep Ray 2 for legacy prompts, old examples and compatibility coverage.',
        cta: { label: 'Open Ray 3.2', href: modelsHref('en', 'luma-ray-3-2') },
      },
      {
        title: 'Modifying existing footage?',
        body: 'Use Ray 2 Modify only when you need the older route. For new source-video edits, Ray 3.2 should be the first Luma option.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Need stronger generation?',
        body: 'Use Seedance, Kling or Veo when the job is flagship generation, sound-capable video or broader reference control rather than a Luma legacy workflow.',
        cta: { label: 'Compare Ray 2 vs Veo Fast', href: compareHref('en', 'luma-ray-2', 'veo-3-1-fast') },
      },
    ],
    referenceWorkflows: [
      { title: 'Text-to-video', body: 'Write a compact subject, camera, lighting and motion brief for a new cinematic shot.' },
      { title: 'Image-to-video', body: 'Use one start image to anchor composition, product shape or identity before adding motion.' },
      { title: 'End frame', body: 'Add a closing image only when the landing pose or final composition matters.' },
      { title: 'Modify', body: 'Upload a source video, name what must stay, name what changes, then choose an adherence strength.' },
      { title: 'Reframe', body: 'Prioritize the subject and delivery format instead of rewriting the whole scene.' },
    ],
    pricingCopy: {
      title: 'Legacy Luma Ray 2 pricing at a glance',
      subtitle: 'Preset Ray 2 generate totals by duration and resolution - use Ray 3.2 for current Luma edit and Reframe work.',
      footnote: 'Generate pricing uses preset duration/resolution tiers. Modify and Reframe are quoted live from source-clip settings.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'Up to 1080p',
    },
    meta: {
      title: 'Luma Ray 2 Legacy: Pricing, Modify & Reframe | MaxVideoAI',
      description:
        'Explore Luma Ray 2 as a previous-generation Luma route, with legacy pricing, examples, Modify, Reframe, Ray 2 Flash context and Ray 3.2 migration guidance.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'ROUTE LUMA D’ANCIENNE GENERATION',
      title: 'Luma Ray 2',
      subtitle: 'Route Luma d’ancienne génération pour les workflows Generate, Modify et Reframe encore pris en charge.',
      subtitleHighlights: ['Route Luma d’ancienne génération', 'Modify', 'Reframe'],
      paragraph:
        'Utilisez Luma Ray 2 quand vous avez besoin d’un rendu Luma compatible avec l’ancienne route ou d’un workflow Ray 2 historique. Pour les nouveaux travaux Luma Modify, images guides, keyframes et Reframe, partez de Ray 3.2.',
      primaryCta: { label: 'Ouvrir Ray 2 legacy', href: '/app?engine=lumaRay2' },
      secondaryCta: { label: 'Ouvrir Ray 3.2', href: modelsHref('fr', 'luma-ray-3-2') },
      quickLinks: [
        { label: 'Luma actuel : Ray 3.2', href: modelsHref('fr', 'luma-ray-3-2') },
        { label: 'Comparer vs Flash', href: compareHref('fr', 'luma-ray-2', 'luma-ray-2-flash') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'luma-ray-2-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Luma Ray 2',
      description: 'Workflow Luma d’ancienne génération',
      renderLabel: 'Voir le rendu',
      badges: ['Route legacy', 'Modify + Reframe', '1080p'],
      altContext: 'exemple vidéo cinématographique Luma Ray 2',
    },
    features: [
      { title: 'Route Luma legacy', body: 'Gardez Ray 2 pour les anciens prompts, exemples historiques et tests de compatibilité.', tone: 'quality' },
      { title: 'Départ texte ou image', body: 'Générez depuis un prompt ou animez une image avec fin optionnelle.', tone: 'reference' },
      { title: 'Modifier une source', body: 'Conservez un timing qui marche déjà tout en changeant le look ou le détail.', tone: 'continuity' },
      { title: 'Recadrer pour livrer', body: 'Déclinez un master validé en formats vertical, carré ou large.', tone: 'reference' },
      { title: 'Génération 5 ou 9 s', body: 'Travaillez sur des plans courts et contrôlés jusqu’à 1080p.', tone: 'duration' },
      { title: 'Ray 3.2 pour les nouveaux edits', body: 'Utilisez Ray 3.2 d’abord si images guides, keyframes ou Reframe actuel comptent.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Ray 2 ou Ray 3.2 ?',
        body: 'Utilisez Ray 3.2 pour les nouveaux workflows Luma Modify, keyframes et Reframe. Gardez Ray 2 pour les prompts legacy, anciens exemples et tests de compatibilité.',
        cta: { label: 'Ouvrir Ray 3.2', href: modelsHref('fr', 'luma-ray-3-2') },
      },
      {
        title: 'Vous modifiez une vidéo existante ?',
        body: 'Utilisez Modify Ray 2 seulement si vous voulez l’ancienne route. Pour un nouvel edit vidéo source, Ray 3.2 doit passer en premier.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Besoin d’une génération plus forte ?',
        body: 'Utilisez Seedance, Kling ou Veo pour les routes flagship, les sorties avec son ou le contrôle référence plus large plutôt qu’un workflow Luma legacy.',
        cta: { label: 'Comparer Ray 2 vs Veo Fast', href: compareHref('fr', 'luma-ray-2', 'veo-3-1-fast') },
      },
    ],
    referenceWorkflows: [
      { title: 'Text-to-video', body: 'Rédigez un brief court : sujet, caméra, lumière et mouvement du plan.' },
      { title: 'Image-to-video', body: 'Ancrez composition, produit ou identité avec une image de départ.' },
      { title: 'Image de fin', body: 'Ajoutez une fin uniquement si la pose ou la composition d’arrivée compte.' },
      { title: 'Modify', body: 'Chargez une source vidéo, indiquez ce qui doit rester, ce qui change, puis choisissez la force.' },
      { title: 'Reframe', body: 'Priorisez le sujet et le format de livraison sans réécrire toute la scène.' },
    ],
    pricingCopy: {
      title: 'Prix Luma Ray 2 legacy en un coup d’œil',
      subtitle: 'Prix totaux Ray 2 par palier durée/résolution — utilisez Ray 3.2 pour les edits Luma et Reframe actuels.',
      footnote: 'La génération suit des paliers durée/résolution. Modify et Reframe sont chiffrés en direct selon le clip source et les réglages.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Jusqu’à 1080p',
    },
    meta: {
      title: 'Luma Ray 2 legacy : tarifs, Modify et Reframe | MaxVideoAI',
      description:
        'Explorez Luma Ray 2 comme route Luma d’ancienne génération : tarifs, exemples, Modify, Reframe, contexte Ray 2 Flash et migration vers Ray 3.2.',
    },
  },
  es: {
    hero: {
      eyebrow: 'RUTA LUMA DE GENERACION ANTERIOR',
      title: 'Luma Ray 2',
      subtitle: 'Ruta Luma de generación anterior para flujos Generate, Modify y Reframe compatibles.',
      subtitleHighlights: ['Ruta Luma de generación anterior', 'Modify', 'Reframe'],
      paragraph:
        'Usa Luma Ray 2 cuando necesitas un render compatible con la ruta anterior o un workflow histórico de Ray 2. Para nuevos trabajos Luma de Modify, cuadros guía, keyframes y Reframe, empieza por Ray 3.2.',
      primaryCta: { label: 'Abrir Ray 2 legacy', href: '/app?engine=lumaRay2' },
      secondaryCta: { label: 'Abrir Ray 3.2', href: modelsHref('es', 'luma-ray-3-2') },
      quickLinks: [
        { label: 'Luma actual: Ray 3.2', href: modelsHref('es', 'luma-ray-3-2') },
        { label: 'Comparar con Flash', href: compareHref('es', 'luma-ray-2', 'luma-ray-2-flash') },
        { label: 'Ver precios', href: pricingHref('es', 'luma-ray-2-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Luma Ray 2',
      description: 'Workflow Luma de generación anterior',
      renderLabel: 'Ver render',
      badges: ['Ruta legacy', 'Modify + Reframe', '1080p'],
      altContext: 'ejemplo de video cinematográfico con Luma Ray 2',
    },
    features: [
      { title: 'Ruta Luma legacy', body: 'Usa Ray 2 para prompts antiguos, ejemplos históricos y pruebas de compatibilidad.', tone: 'quality' },
      { title: 'Inicio con texto o imagen', body: 'Genera desde prompt o anima un still con cuadro final opcional.', tone: 'reference' },
      { title: 'Modificar clips fuente', body: 'Conserva timing y bloqueo que funcionan mientras cambias look o detalle.', tone: 'continuity' },
      { title: 'Reframe para entrega', body: 'Convierte un master aprobado en formatos verticales, cuadrados o widescreen.', tone: 'reference' },
      { title: 'Genera 5 o 9 s', body: 'Trabaja tomas cortas y controladas hasta 1080p.', tone: 'duration' },
      { title: 'Ray 3.2 para nuevos edits', body: 'Usa Ray 3.2 primero si importan cuadros guía, keyframes o Reframe actual.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '¿Ray 2 o Ray 3.2?',
        body: 'Usa Ray 3.2 para los nuevos flujos Luma de Modify, keyframes y Reframe. Mantén Ray 2 para prompts legacy, ejemplos antiguos y compatibilidad.',
        cta: { label: 'Abrir Ray 3.2', href: modelsHref('es', 'luma-ray-3-2') },
      },
      {
        title: '¿Modificas material existente?',
        body: 'Usa Modify Ray 2 solo si necesitas la ruta anterior. Para nuevos edits de video fuente, Ray 3.2 debe ser la primera opción Luma.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: '¿Necesitas generación más fuerte?',
        body: 'Usa Seedance, Kling o Veo para rutas flagship, salidas con sonido o control de referencias más amplio en lugar de un workflow Luma legacy.',
        cta: { label: 'Comparar Ray 2 vs Veo Fast', href: compareHref('es', 'luma-ray-2', 'veo-3-1-fast') },
      },
    ],
    referenceWorkflows: [
      { title: 'Texto a video', body: 'Escribe un brief compacto: sujeto, cámara, luz y movimiento de la toma.' },
      { title: 'Imagen a video', body: 'Ancla composición, producto o identidad con una imagen inicial.' },
      { title: 'Cuadro final', body: 'Agrega un cierre solo si importan la pose o composición de llegada.' },
      { title: 'Modify', body: 'Sube un video fuente, define qué se conserva, qué cambia y elige la fuerza.' },
      { title: 'Reframe', body: 'Prioriza el sujeto y el formato de entrega sin reescribir toda la escena.' },
    ],
    pricingCopy: {
      title: 'Precios legacy de Luma Ray 2 de un vistazo',
      subtitle: 'Totales Ray 2 por duración y resolución. Usa Ray 3.2 para edits Luma y Reframe actuales.',
      footnote: 'La generación usa niveles de duración/resolución. Modify y Reframe se cotizan en vivo según el clip fuente y los ajustes.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Hasta 1080p',
    },
    meta: {
      title: 'Luma Ray 2 legacy: precios, Modify y Reframe | MaxVideoAI',
      description:
        'Explora Luma Ray 2 como ruta Luma de generación anterior: precios, ejemplos, Modify, Reframe, contexto Ray 2 Flash y migración a Ray 3.2.',
    },
  },
};

const LUMA_RAY_2_FLASH_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'PREVIOUS-GENERATION FAST LUMA ROUTE',
      title: 'Luma Ray 2 Flash',
      subtitle: 'Previous-generation fast Luma route for older Ray 2 draft coverage, Modify and Reframe.',
      subtitleHighlights: ['Previous-generation fast Luma', 'draft coverage', 'Modify and Reframe'],
      paragraph:
        'Use Luma Ray 2 Flash when you need a legacy-compatible fast Ray 2 pass or older draft context. For new Luma source-video edits, keyframe guidance and Reframe work, start with Ray 3.2 instead of making Flash the first choice.',
      primaryCta: { label: 'Open legacy Flash', href: '/app?engine=lumaRay2_flash' },
      secondaryCta: { label: 'Open Ray 3.2', href: modelsHref('en', 'luma-ray-3-2') },
      quickLinks: [
        { label: 'Current Luma: Ray 3.2', href: modelsHref('en', 'luma-ray-3-2') },
        { label: 'Compare vs Ray 2', href: compareHref('en', 'luma-ray-2-flash', 'luma-ray-2', 'luma-ray-2-flash') },
        { label: 'View pricing', href: pricingHref('en', 'luma-ray-2-flash-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Luma Ray 2 Flash example',
      description: 'Previous-generation fast Luma workflow',
      renderLabel: 'View draft',
      badges: ['Legacy fast route', 'Draft pass', '1080p'],
      altContext: 'fast Luma Ray 2 Flash draft example',
    },
    features: [
      { title: 'Legacy fast route', body: 'Use Flash for older Ray 2 draft prompts, old examples and compatibility checks.', tone: 'duration' },
      { title: 'Start-image tests', body: 'Animate a first frame to check motion, framing and landing before final spend.', tone: 'reference' },
      { title: 'Modify passes', body: 'Try adherence, flex and reimagine strengths on source clips.', tone: 'continuity' },
      { title: 'Reframe variants', body: 'Test vertical, square or wide crops before locking delivery formats.', tone: 'reference' },
      { title: 'Up to 1080p', body: 'Choose 540p, 720p or 1080p for draft generation.', tone: 'quality' },
      { title: 'Ray 3.2 for current edits', body: 'Move new Modify, keyframe and Reframe work to Ray 3.2 first.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Flash or Ray 3.2?',
        body: 'Use Ray 3.2 for current Luma Modify, keyframes and Reframe. Keep Flash only when you need legacy fast Ray 2 behavior or old draft economics.',
        cta: {
          label: 'Open Ray 3.2',
          href: modelsHref('en', 'luma-ray-3-2'),
        },
      },
      {
        title: 'Testing edits or crops?',
        body: 'Use Flash for older source-video look tests only when the legacy route matters. New edit and crop tests should start on Ray 3.2.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Need a fast current draft route?',
        body: 'Compare against LTX Fast, Seedance Fast or Veo Fast when speed matters more than preserving a legacy Luma workflow.',
        cta: { label: 'Compare Flash vs LTX Fast', href: compareHref('en', 'luma-ray-2-flash', 'ltx-2-3-fast') },
      },
    ],
    referenceWorkflows: [
      { title: 'Text-to-video', body: 'Keep the draft prompt compact: one subject, one move, one mood and one format.' },
      { title: 'Start image', body: 'Use a first frame to lock composition while Flash tests motion and pacing.' },
      { title: 'Optional end frame', body: 'Add an end image only when the active image-to-video route exposes it and the draft needs a specific landing composition.' },
      { title: 'Modify', body: 'Explore source-video look changes before committing the winning direction to Ray 2.' },
      { title: 'Reframe', body: 'Validate mobile, square or wide crops while the source clip is still being approved.' },
    ],
    pricingCopy: {
      title: 'Legacy Luma Ray 2 Flash pricing',
      subtitle: 'Preset legacy draft totals - use Ray 3.2 first for current Luma Modify and Reframe work.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'Up to 1080p',
    },
    meta: {
      title: 'Luma Ray 2 Flash Legacy: Pricing & Drafts | MaxVideoAI',
      description:
        'Use Luma Ray 2 Flash as a previous-generation fast Luma route, with legacy draft pricing, Modify, Reframe, Ray 2 context and Ray 3.2 migration guidance.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'ROUTE LUMA FAST D’ANCIENNE GENERATION',
      title: 'Luma Ray 2 Flash',
      subtitle: 'Route Luma fast d’ancienne génération pour brouillons legacy, Modify et Reframe Ray 2 historiques.',
      subtitleHighlights: ['Route Luma fast d’ancienne génération', 'brouillons legacy', 'Modify et Reframe'],
      paragraph:
        'Utilisez Luma Ray 2 Flash quand vous avez besoin d’une passe Ray 2 rapide compatible avec l’ancienne route ou d’un contexte de brouillon historique. Pour les nouveaux edits vidéo source, keyframes et Reframe Luma, commencez par Ray 3.2.',
      primaryCta: { label: 'Ouvrir Flash legacy', href: '/app?engine=lumaRay2_flash' },
      secondaryCta: { label: 'Ouvrir Ray 3.2', href: modelsHref('fr', 'luma-ray-3-2') },
      quickLinks: [
        { label: 'Luma actuel : Ray 3.2', href: modelsHref('fr', 'luma-ray-3-2') },
        { label: 'Comparer vs Ray 2', href: compareHref('fr', 'luma-ray-2-flash', 'luma-ray-2', 'luma-ray-2-flash') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'luma-ray-2-flash-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Luma Ray 2 Flash',
      description: 'Workflow Luma fast d’ancienne génération',
      renderLabel: 'Voir le brouillon',
      badges: ['Fast legacy', 'Brouillon', '1080p'],
      altContext: 'exemple de brouillon rapide Luma Ray 2 Flash',
    },
    features: [
      { title: 'Route fast legacy', body: 'Utilisez Flash pour les anciens prompts Ray 2, exemples historiques et tests de compatibilité.', tone: 'duration' },
      { title: 'Tests image de départ', body: 'Animez une première image pour vérifier mouvement, cadrage et arrivée.', tone: 'reference' },
      { title: 'Passes Modify', body: 'Testez les forces adhere, flex et reimagine sur une source vidéo.', tone: 'continuity' },
      { title: 'Variantes Reframe', body: 'Validez crops verticaux, carrés ou larges avant la livraison.', tone: 'reference' },
      { title: 'Jusqu’à 1080p', body: 'Choisissez 540p, 720p ou 1080p pour les générations brouillon.', tone: 'quality' },
      { title: 'Ray 3.2 pour les edits actuels', body: 'Passez les nouveaux workflows Modify, keyframes et Reframe sur Ray 3.2 d’abord.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Flash ou Ray 3.2 ?',
        body: 'Utilisez Ray 3.2 pour Luma Modify, keyframes et Reframe actuels. Gardez Flash seulement pour le comportement fast Ray 2 legacy.',
        cta: {
          label: 'Ouvrir Ray 3.2',
          href: modelsHref('fr', 'luma-ray-3-2'),
        },
      },
      {
        title: 'Vous testez edits ou crops ?',
        body: 'Utilisez Flash pour les tests vidéo source plus anciens seulement si la route legacy compte. Les nouveaux tests doivent partir de Ray 3.2.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Besoin d’une route rapide actuelle ?',
        body: 'Comparez plutôt LTX Fast, Seedance Fast ou Veo Fast quand la vitesse compte plus que la compatibilité Luma legacy.',
        cta: { label: 'Comparer Flash vs LTX Fast', href: compareHref('fr', 'luma-ray-2-flash', 'ltx-2-3-fast') },
      },
    ],
    referenceWorkflows: [
      { title: 'Text-to-video', body: 'Gardez un prompt court : un sujet, un mouvement, une ambiance, un format.' },
      { title: 'Image de départ', body: 'Utilisez une première image pour verrouiller la composition pendant que Flash teste le mouvement.' },
      { title: 'Image de fin optionnelle', body: 'Ajoutez une image de fin seulement si la route image-vidéo active l’expose et que le brouillon doit atterrir sur une composition précise.' },
      { title: 'Modify', body: 'Explorez les changements de look sur source vidéo avant la passe Ray 2.' },
      { title: 'Reframe', body: 'Validez crops mobile, carré ou large pendant que le clip source est encore en validation.' },
    ],
    pricingCopy: {
      title: 'Prix Luma Ray 2 Flash legacy',
      subtitle: 'Prix totaux de brouillon legacy — utilisez Ray 3.2 d’abord pour les workflows Luma Modify et Reframe actuels.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Jusqu’à 1080p',
    },
    meta: {
      title: 'Luma Ray 2 Flash legacy : tarifs et brouillons | MaxVideoAI',
      description:
        'Utilisez Luma Ray 2 Flash comme route Luma fast d’ancienne génération : tarifs de brouillon, Modify, Reframe, contexte Ray 2 et migration vers Ray 3.2.',
    },
  },
  es: {
    hero: {
      eyebrow: 'RUTA LUMA FAST DE GENERACION ANTERIOR',
      title: 'Luma Ray 2 Flash',
      subtitle: 'Ruta Luma fast de generación anterior para borradores legacy, Modify y Reframe históricos de Ray 2.',
      subtitleHighlights: ['Ruta Luma fast de generación anterior', 'borradores legacy', 'Modify y Reframe'],
      paragraph:
        'Usa Luma Ray 2 Flash cuando necesitas una pasada rápida compatible con la ruta Ray 2 anterior o contexto de borrador histórico. Para nuevos edits de video fuente, keyframes y Reframe de Luma, empieza por Ray 3.2.',
      primaryCta: { label: 'Abrir Flash legacy', href: '/app?engine=lumaRay2_flash' },
      secondaryCta: { label: 'Abrir Ray 3.2', href: modelsHref('es', 'luma-ray-3-2') },
      quickLinks: [
        { label: 'Luma actual: Ray 3.2', href: modelsHref('es', 'luma-ray-3-2') },
        { label: 'Comparar con Ray 2', href: compareHref('es', 'luma-ray-2-flash', 'luma-ray-2', 'luma-ray-2-flash') },
        { label: 'Ver precios', href: pricingHref('es', 'luma-ray-2-flash-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Luma Ray 2 Flash',
      description: 'Workflow Luma fast de generación anterior',
      renderLabel: 'Ver borrador',
      badges: ['Fast legacy', 'Borrador', '1080p'],
      altContext: 'ejemplo de borrador rápido con Luma Ray 2 Flash',
    },
    features: [
      { title: 'Ruta fast legacy', body: 'Usa Flash para prompts Ray 2 antiguos, ejemplos históricos y pruebas de compatibilidad.', tone: 'duration' },
      { title: 'Pruebas con imagen inicial', body: 'Anima un primer frame para revisar movimiento, encuadre y llegada.', tone: 'reference' },
      { title: 'Pasadas Modify', body: 'Prueba fuerzas adhere, flex y reimagine sobre clips fuente.', tone: 'continuity' },
      { title: 'Variantes Reframe', body: 'Valida crops verticales, cuadrados o widescreen antes de entregar.', tone: 'reference' },
      { title: 'Hasta 1080p', body: 'Elige 540p, 720p o 1080p para generación de borradores.', tone: 'quality' },
      { title: 'Ray 3.2 para edits actuales', body: 'Mueve nuevos flujos Modify, keyframes y Reframe a Ray 3.2 primero.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '¿Flash o Ray 3.2?',
        body: 'Usa Ray 3.2 para Luma Modify, keyframes y Reframe actuales. Mantén Flash solo si necesitas comportamiento fast Ray 2 legacy.',
        cta: {
          label: 'Abrir Ray 3.2',
          href: modelsHref('es', 'luma-ray-3-2'),
        },
      },
      {
        title: '¿Pruebas ediciones o crops?',
        body: 'Usa Flash para pruebas antiguas de video fuente solo si importa la ruta legacy. Las nuevas pruebas deben empezar por Ray 3.2.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: '¿Necesitas una ruta rápida actual?',
        body: 'Compara LTX Fast, Seedance Fast o Veo Fast cuando la velocidad importa más que la compatibilidad Luma legacy.',
        cta: { label: 'Comparar Flash vs LTX Fast', href: compareHref('es', 'luma-ray-2-flash', 'ltx-2-3-fast') },
      },
    ],
    referenceWorkflows: [
      { title: 'Texto a video', body: 'Mantén el prompt compacto: un sujeto, un movimiento, un mood y un formato.' },
      { title: 'Imagen inicial', body: 'Usa un primer frame para fijar composición mientras Flash prueba movimiento y pacing.' },
      { title: 'Cuadro final opcional', body: 'Agrega un cuadro final solo si la ruta imagen a video activa lo expone y el borrador debe aterrizar en una composición específica.' },
      { title: 'Modify', body: 'Explora cambios de look en video fuente antes de pasar la dirección ganadora a Ray 2.' },
      { title: 'Reframe', body: 'Valida crops móviles, cuadrados o widescreen mientras el clip fuente se aprueba.' },
    ],
    pricingCopy: {
      title: 'Precios legacy de Luma Ray 2 Flash',
      subtitle: 'Totales de borrador legacy. Usa Ray 3.2 primero para flujos Luma Modify y Reframe actuales.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Hasta 1080p',
    },
    meta: {
      title: 'Luma Ray 2 Flash legacy: precios y borradores | MaxVideoAI',
      description:
        'Usa Luma Ray 2 Flash como ruta Luma fast de generación anterior: precios de borrador, Modify, Reframe, contexto Ray 2 y migración a Ray 3.2.',
    },
  },
};

const LUMA_RAY_32_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'LUMA MODIFY + REFRAME ROUTE',
      title: 'Luma Ray 3.2',
      subtitle: 'Source-video Modify, Reframe, guide/keyframe control and silent video outputs.',
      subtitleHighlights: ['Source-video Modify', 'Reframe', 'silent video outputs'],
      paragraph:
        'Use Ray 3.2 when a source clip already has usable timing: change the visual treatment with Modify, guide selected moments with a frame or keyframes, or Reframe the approved shot into new delivery ratios. Text-to-video and image-to-video remain useful supporting routes for short silent Luma motion tests.',
      primaryCta: { label: 'Generate with Luma Ray 3.2', href: '/app?engine=luma-ray-3-2' },
      secondaryCta: { label: 'View examples', href: examplesHref('en', 'luma') },
      quickLinks: [
        { label: 'View pricing', href: pricingHref('en', 'luma-ray-3-2-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
        { label: 'Specs', href: '#specs' },
      ],
    },
    media: {
      caption: 'Luma Ray 3.2 example',
      description: 'Modify and Reframe route for current Luma video',
      renderLabel: 'View render',
      badges: ['Modify', 'Reframe', 'Silent video'],
      altContext: 'Luma Ray 3.2 source-video Modify and Reframe example',
    },
    features: [
      { title: 'Modify source clips', body: 'Keep source timing and camera motion while changing look, subject detail or scene treatment.', tone: 'continuity' },
      { title: 'Reframe delivery cuts', body: 'Outpaint a source clip into vertical, square, landscape or ultrawide formats.', tone: 'duration' },
      { title: 'Guide/keyframes', body: 'Use a guide frame or indexed keyframes when selected source moments need visual direction.', tone: 'reference' },
      { title: 'Text or start image', body: 'Generate short silent Luma motion tests when there is no source clip yet.', tone: 'reference' },
      { title: '540p to 1080p', body: 'Draft lower, then inspect selected edit or reframe candidates at 720p or 1080p.', tone: 'quality' },
      { title: 'Silent by design', body: 'Ray 3.2 outputs video only in MaxVideoAI; add music, voice or sound design later.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Modify or Reframe first?',
        body: 'Use Modify when the source timing already works and the look needs to change. Use Reframe when an approved master needs another aspect ratio.',
        cta: { label: 'Open app', href: '/app?engine=luma-ray-3-2' },
      },
      {
        title: 'Need guide frames?',
        body: 'Use one guide frame for a single visual target, or indexed keyframes when specific moments in the source video need direction.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Need audio?',
        body: 'Ray 3.2 is a silent video route here. Choose it for visual edits and reframes, then add music, voice or sound design downstream.',
        cta: { label: 'Check pricing', href: pricingHref('en', 'luma-ray-3-2-pricing') },
      },
    ],
    referenceWorkflows: [
      { title: 'Source video', body: 'Upload a clean MP4, MOV or WebM clip when Modify or Reframe should preserve source timing.' },
      { title: 'Modify', body: 'State what stays from the source first, then describe the visual change and strength of reinterpretation.' },
      { title: 'Guide frames', body: 'Use one guide frame or indexed keyframes for Modify when specific moments need visual direction.' },
      { title: 'Reframe target', body: 'Choose the delivery ratio first, then keep the prompt focused on subject priority and canvas fill.' },
      { title: 'Supporting generation', body: 'Use text or a start image only when you need to create a new short silent clip before editing.' },
    ],
    pricingCopy: {
      title: 'Luma Ray 3.2 pricing at a glance',
      subtitle: 'Preset Ray 3.2 totals use MaxVideoAI display pricing; exact price appears before generation.',
      footnote: 'All Ray 3.2 routes keep the same MaxVideoAI customer quote based on Fal reference pricing plus the configured margin; direct fulfillment does not change the client price.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'Up to 1080p',
    },
    meta: {
      title: 'Luma Ray 3.2 Modify Video, Reframe & Examples | MaxVideoAI',
      description:
        'Explore Luma Ray 3.2 source-video Modify, AI video Reframe, guide/keyframe controls, silent 5s/10s output, pricing, prompt tips and examples.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'ROUTE LUMA MODIFY + REFRAME',
      title: 'Luma Ray 3.2',
      subtitle: 'Modify de vidéo source, Reframe, contrôle par images clés et sorties silencieuses.',
      subtitleHighlights: ['Modify de vidéo source', 'Reframe', 'sorties silencieuses'],
      paragraph:
        'Utilisez Ray 3.2 quand une vidéo source a déjà le bon timing : changez le traitement visuel avec Modify, guidez certains moments avec une image ou des images clés, ou recadrez le plan validé avec Reframe. Le texte-vers-video et l’image-vers-video restent utiles comme routes complémentaires pour des tests courts et silencieux.',
      primaryCta: { label: 'Générer avec Luma Ray 3.2', href: '/app?engine=luma-ray-3-2' },
      secondaryCta: { label: 'Voir les exemples', href: examplesHref('fr', 'luma') },
      quickLinks: [
        { label: 'Voir les tarifs', href: pricingHref('fr', 'luma-ray-3-2-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
        { label: 'Caractéristiques', href: '#specs' },
      ],
    },
    media: {
      caption: 'Exemple Luma Ray 3.2',
      description: 'Route Modify et Reframe pour la vidéo Luma actuelle',
      renderLabel: 'Voir le rendu',
      badges: ['Modify', 'Reframe', 'Vidéo silencieuse'],
      altContext: 'exemple Luma Ray 3.2 Modify et Reframe',
    },
    features: [
      { title: 'Modify de clips sources', body: 'Gardez timing et mouvement source tout en changeant look, détails sujet ou traitement scène.', tone: 'continuity' },
      { title: 'Reframe de livrables', body: 'Outpaintez un clip source en vertical, carré, paysage ou ultrawide.', tone: 'duration' },
      { title: 'Images guides', body: 'Utilisez image guide ou images clés indexées quand certains moments source doivent être dirigés.', tone: 'reference' },
      { title: 'Texte ou image source', body: 'Générez des tests de mouvement Luma courts et silencieux quand aucun clip source n’existe encore.', tone: 'reference' },
      { title: '540p à 1080p', body: 'Brouillonnez plus bas, puis contrôlez les candidats retenus en 720p ou 1080p.', tone: 'quality' },
      { title: 'Sortie silencieuse', body: 'Ray 3.2 produit la vidéo seule dans MaxVideoAI; ajoutez musique, voix ou sound design ensuite.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Modify ou Reframe d’abord ?',
        body: 'Utilisez Modify quand le timing source fonctionne déjà et que le rendu doit changer. Utilisez Reframe quand un master validé doit changer de ratio.',
        cta: { label: 'Ouvrir l’app', href: '/app?engine=luma-ray-3-2' },
      },
      {
        title: 'Besoin d’images guides ?',
        body: 'Utilisez une image guide pour une cible visuelle unique, ou des images clés indexées quand certains moments de la vidéo source doivent être dirigés.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Besoin d’audio ?',
        body: 'Ray 3.2 est une route vidéo silencieuse ici. Choisissez-la pour les retouches visuelles et reframes, puis ajoutez musique, voix ou sound design ensuite.',
        cta: { label: 'Vérifier le prix', href: pricingHref('fr', 'luma-ray-3-2-pricing') },
      },
    ],
    referenceWorkflows: [
      { title: 'Vidéo source', body: 'Chargez un clip MP4, MOV ou WebM propre quand Modify ou Reframe doivent préserver le timing source.' },
      { title: 'Modify', body: 'Dites d’abord ce qui reste depuis la source, puis décrivez le changement visuel et la force de réinterprétation.' },
      { title: 'Images guides', body: 'Utilisez une image guide ou des images clés indexées quand certains moments du Modify doivent être dirigés.' },
      { title: 'Cible Reframe', body: 'Choisissez d’abord le ratio de livraison, puis gardez le prompt centré sur le sujet prioritaire et le remplissage du cadre.' },
      { title: 'Génération complémentaire', body: 'Utilisez texte ou image de départ seulement pour créer un nouveau clip court et silencieux avant retouche.' },
    ],
    pricingCopy: {
      title: 'Prix Luma Ray 3.2 en un coup d’oeil',
      subtitle: 'Totaux Ray 3.2 par preset avec prix affichés MaxVideoAI de référence; prix exact avant génération.',
      footnote: 'Toutes les routes Ray 3.2 gardent le même devis client MaxVideoAI basé sur la référence Fal avec la marge configurée; l’exécution directe ne change pas le prix client.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Jusqu’à 1080p',
    },
    meta: {
      title: 'Luma Ray 3.2 Modify Video, Reframe et exemples | MaxVideoAI',
      description:
        'Explorez Luma Ray 3.2 : Modify de vidéo source, Reframe vidéo IA, images guides, sorties silencieuses 5 s / 10 s, tarifs, prompts et exemples.',
    },
  },
  es: {
    hero: {
      eyebrow: 'RUTA LUMA MODIFY + REFRAME',
      title: 'Luma Ray 3.2',
      subtitle: 'Modify de video fuente, Reframe, control con imágenes clave y salidas silenciosas.',
      subtitleHighlights: ['Modify de video fuente', 'Reframe', 'salidas silenciosas'],
      paragraph:
        'Usa Ray 3.2 cuando un video fuente ya tiene timing útil: cambia el tratamiento visual con Modify, guía momentos concretos con un cuadro o imágenes clave, o reencuadra la toma aprobada con Reframe. Texto a video e imagen a video siguen como rutas complementarias para pruebas cortas y silenciosas.',
      primaryCta: { label: 'Generar con Luma Ray 3.2', href: '/app?engine=luma-ray-3-2' },
      secondaryCta: { label: 'Ver ejemplos', href: examplesHref('es', 'luma') },
      quickLinks: [
        { label: 'Ver precios', href: pricingHref('es', 'luma-ray-3-2-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
        { label: 'Especificaciones', href: '#specs' },
      ],
    },
    media: {
      caption: 'Ejemplo Luma Ray 3.2',
      description: 'Ruta Modify y Reframe para video Luma actual',
      renderLabel: 'Ver render',
      badges: ['Modify', 'Reframe', 'Video silencioso'],
      altContext: 'ejemplo Luma Ray 3.2 Modify y Reframe',
    },
    features: [
      { title: 'Modify de clips fuente', body: 'Conserva timing y movimiento fuente mientras cambias look, detalles del sujeto o tratamiento de escena.', tone: 'continuity' },
      { title: 'Reframe de entregables', body: 'Outpaintea un clip fuente a vertical, cuadrado, paisaje o ultrawide.', tone: 'duration' },
      { title: 'Cuadros guía', body: 'Usa cuadro guía o imágenes clave indexadas cuando momentos concretos del video fuente necesitan dirección.', tone: 'reference' },
      { title: 'Texto o imagen inicial', body: 'Genera pruebas cortas y silenciosas de movimiento Luma cuando aún no existe clip fuente.', tone: 'reference' },
      { title: '540p a 1080p', body: 'Borrador en resolución menor y revisa candidatos elegidos en 720p o 1080p.', tone: 'quality' },
      { title: 'Salida silenciosa', body: 'Ray 3.2 entrega solo video en MaxVideoAI; añade musica, voz o sound design después.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '¿Modify o Reframe primero?',
        body: 'Usa Modify cuando el timing fuente ya funciona y el look debe cambiar. Usa Reframe cuando un master aprobado necesita otro ratio.',
        cta: { label: 'Abrir app', href: '/app?engine=luma-ray-3-2' },
      },
      {
        title: '¿Necesitas cuadros guía?',
        body: 'Usa un cuadro guía para una única referencia visual, o imágenes clave indexadas cuando momentos concretos del video fuente necesitan dirección.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: '¿Necesitas audio?',
        body: 'Ray 3.2 es una ruta de video silencioso aquí. Úsala para ediciones visuales y reframes, y añade música, voz o sound design después.',
        cta: { label: 'Revisar precio', href: pricingHref('es', 'luma-ray-3-2-pricing') },
      },
    ],
    referenceWorkflows: [
      { title: 'Video fuente', body: 'Sube un clip MP4, MOV o WebM limpio cuando Modify o Reframe deben preservar el timing fuente.' },
      { title: 'Modify', body: 'Explica primero qué se conserva de la fuente y después el cambio visual y la fuerza de reinterpretación.' },
      { title: 'Imagenes guia', body: 'Usa una imagen guia o imagenes clave indexadas cuando momentos concretos del Modify necesitan dirección visual.' },
      { title: 'Destino Reframe', body: 'Elige primero el ratio de entrega y mantén el prompt centrado en prioridad de sujeto y relleno de lienzo.' },
      { title: 'Generación complementaria', body: 'Usa texto o imagen inicial solo para crear un nuevo clip corto y silencioso antes de editar.' },
    ],
    pricingCopy: {
      title: 'Precios de Luma Ray 3.2 de un vistazo',
      subtitle: 'Totales Ray 3.2 por preset con precios de referencia MaxVideoAI; precio exacto antes de generar.',
      footnote: 'Todas las rutas Ray 3.2 mantienen la misma cotización cliente MaxVideoAI basada en la referencia Fal con el margen configurado; la ejecución directa no cambia el precio cliente.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Hasta 1080p',
    },
    meta: {
      title: 'Luma Ray 3.2 Modify Video, Reframe y ejemplos | MaxVideoAI',
      description:
        'Explora Luma Ray 3.2: Modify de video fuente, Reframe de video IA, cuadros guía, salidas silenciosas 5 s / 10 s, precios, prompts y ejemplos.',
    },
  },
};

const LUMA_UNI_1_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'LUMA IMAGE GENERATION ROUTE',
      title: 'Luma Uni-1',
      subtitle: '2K image generation with image edits, multi-reference guidance, layout reasoning and optional web-grounded references.',
      subtitleHighlights: ['2K image generation', 'image edits', 'multi-reference guidance'],
      paragraph:
        'Use Uni-1 for text-to-image, source-image edits, reference-led layouts and visual research stills when you need a thoughtful Luma image route without claiming perfect typography or guaranteed factual accuracy.',
      primaryCta: { label: 'Generate with Luma Uni-1', href: '/app/image?engine=luma-uni-1' },
      secondaryCta: { label: 'View pricing', href: pricingHref('en', 'luma-uni-1-pricing') },
      quickLinks: [
        { label: 'Open image workspace', href: '/app/image?engine=luma-uni-1' },
        { label: 'View pricing', href: pricingHref('en', 'luma-uni-1-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Luma Uni-1 example',
      description: 'Reference-led 2K image generation and edit workflow',
      renderLabel: 'View image',
      badges: ['2K', 'Edit', 'References'],
      altContext: 'Luma Uni-1 reference-led image example',
    },
    features: [
      { title: '2K stills', body: 'Create single 2K images for concepts, references and layout exploration.', tone: 'quality' },
      { title: 'Source edits', body: 'Use the first image as the edit source, then guide revisions with the prompt.', tone: 'continuity' },
      { title: 'Multi-reference input', body: 'Attach references for product shape, style, typography direction or composition cues.', tone: 'reference' },
      { title: 'Layout reasoning', body: 'Useful for arranging visual elements, but exact text still needs review.', tone: 'quality' },
      { title: 'Web-grounded option', body: 'Use web search only when current visual context helps the still brief.', tone: 'reference' },
      { title: 'Display pricing', body: 'Display prices use MaxVideoAI pricing before generation.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'When to choose Uni-1',
        body: 'Choose Uni-1 for 2K still concepts, source edits, reference preparation and visual layout exploration before a final image route.',
        cta: { label: 'Open Uni-1', href: '/app/image?engine=luma-uni-1' },
      },
      {
        title: 'How to use references',
        body: 'Give each reference a role: product shape, palette, layout, style or text hierarchy. Keep the prompt explicit about what to preserve.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'When to move to Uni-1 Max',
        body: 'Move selected stills to Max when the hero asset needs higher-fidelity detail, product finish or more careful revisions.',
        cta: { label: 'View Uni-1 Max', href: modelsHref('en', 'luma-uni-1-max') },
      },
    ],
    referenceWorkflows: [
      { title: 'Text-to-image', body: 'Describe the artifact, subject, layout, visual style, aspect ratio and any text that needs review.' },
      { title: 'Source edit', body: 'Upload one source image, then separate preserve instructions from changes.' },
      { title: 'Multi-reference layout', body: 'Use references to anchor subject, style, palette and composition instead of asking one prompt to carry everything.' },
      { title: 'Web-grounded visual research', body: 'Enable web search only when recent visual context is useful and still verify the result.' },
      { title: 'Handoff to video', body: 'Save the clearest still as a start image when the next step is motion in a video model.' },
    ],
    pricingCopy: {
      title: 'Luma Uni-1 pricing at a glance',
      subtitle: 'Display prices use MaxVideoAI pricing; exact price appears before generation.',
      footnote: 'Reference and edit examples include source/reference image counts where shown; final app quotes remain authoritative.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'One image',
    },
    meta: {
      title: 'Luma Uni-1: Image Pricing, References & Editing | MaxVideoAI',
      description:
        'Explore Luma Uni-1 2K image generation, source-image edits, multi-reference guidance, web-grounded visual research and MaxVideoAI pricing.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'ROUTE LUMA IMAGE',
      title: 'Luma Uni-1',
      subtitle: 'Génération d’images 2K avec retouches image, guidage multi-référence, composition raisonnée et références web optionnelles.',
      subtitleHighlights: ['Génération d’images 2K', 'retouches image', 'guidage multi-référence'],
      paragraph:
        'Utilisez Uni-1 pour créer depuis texte, retoucher une source, guider la composition par références et préparer une recherche visuelle sans promettre une typographie parfaite.',
      primaryCta: { label: 'Générer avec Luma Uni-1', href: '/app/image?engine=luma-uni-1' },
      secondaryCta: { label: 'Voir les tarifs', href: pricingHref('fr', 'luma-uni-1-pricing') },
      quickLinks: [
        { label: 'Ouvrir l’espace image', href: '/app/image?engine=luma-uni-1' },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'luma-uni-1-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Luma Uni-1',
      description: 'Génération d’images 2K et retouche guidée par références',
      renderLabel: 'Voir l’image',
      badges: ['2K', 'Retouche', 'Références'],
      altContext: 'exemple image Luma Uni-1 guidé par références',
    },
    features: [
      { title: 'Images 2K', body: 'Créez des images 2K uniques pour concepts, références et exploration de composition.', tone: 'quality' },
      { title: 'Retouches source', body: 'Utilisez la première image comme source, puis guidez la révision par prompt.', tone: 'continuity' },
      { title: 'Multi-référence', body: 'Ajoutez des références pour forme produit, style, direction typographique ou composition.', tone: 'reference' },
      { title: 'Composition raisonnée', body: 'Utile pour organiser les éléments visuels, avec contrôle humain du texte exact.', tone: 'quality' },
      { title: 'Option avec contexte web', body: 'Activez la recherche web seulement si le contexte visuel actuel aide la consigne.', tone: 'reference' },
      { title: 'Prix de référence', body: 'Les prix affichés utilisent les références publiques MaxVideoAI avant génération.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Quand choisir Uni-1',
        body: 'Choisissez Uni-1 pour concepts 2K, retouches source, préparation de références et exploration de composition.',
        cta: { label: 'Ouvrir Uni-1', href: '/app/image?engine=luma-uni-1' },
      },
      {
        title: 'Bien utiliser les références',
        body: 'Donnez un rôle à chaque référence : produit, palette, composition, style ou hiérarchie texte. Précisez ce qui doit rester.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Quand passer a Uni-1 Max',
        body: 'Passez les images retenues dans Max quand le visuel principal exige plus de détail, de finition produit ou de révision précise.',
        cta: { label: 'Voir Uni-1 Max', href: modelsHref('fr', 'luma-uni-1-max') },
      },
    ],
    referenceWorkflows: [
      { title: 'Texte vers image', body: 'Décrivez visuel, sujet, composition, style, ratio et tout texte à vérifier.' },
      { title: 'Retouche source', body: 'Chargez une source, puis séparez ce qui doit rester de ce qui doit changer.' },
      { title: 'Composition multi-référence', body: 'Utilisez les références pour ancrer sujet, style, palette et composition.' },
      { title: 'Recherche visuelle avec contexte web', body: 'Activez la recherche web seulement si le contexte récent est utile, puis vérifiez le résultat.' },
      { title: 'Passage vers vidéo', body: 'Gardez l’image la plus claire comme image de départ si l’étape suivante est le mouvement.' },
    ],
    pricingCopy: {
      title: 'Prix Luma Uni-1 en un coup d’oeil',
      subtitle: 'Les prix affichés utilisent les références publiques MaxVideoAI; le prix exact apparaît avant génération.',
      footnote: 'Les exemples de retouche/référence incluent les comptes images indiqués; le devis dans l’app reste la référence.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Une image',
    },
    meta: {
      title: 'Luma Uni-1 : prix image, références et retouche | MaxVideoAI',
      description:
        'Explorez Luma Uni-1 : génération image 2K, retouches source, guidage multi-référence, recherche visuelle avec contexte web et prix de référence.',
    },
  },
  es: {
    hero: {
      eyebrow: 'RUTA LUMA DE IMAGEN',
      title: 'Luma Uni-1',
      subtitle: 'Generación de imagen 2K con ediciones de imagen, guía multi-referencia, composición razonada y referencias web opcionales.',
      subtitleHighlights: ['Generación de imagen 2K', 'ediciones de imagen', 'guía multi-referencia'],
      paragraph:
        'Usa Uni-1 para texto a imagen, ediciones de fuente, composiciones guiadas por referencias e investigación visual sin prometer tipografía perfecta ni precisión garantizada.',
      primaryCta: { label: 'Generar con Luma Uni-1', href: '/app/image?engine=luma-uni-1' },
      secondaryCta: { label: 'Ver precios', href: pricingHref('es', 'luma-uni-1-pricing') },
      quickLinks: [
        { label: 'Abrir espacio de imagen', href: '/app/image?engine=luma-uni-1' },
        { label: 'Ver precios', href: pricingHref('es', 'luma-uni-1-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Luma Uni-1',
      description: 'Generación 2K y edición guiada por referencias',
      renderLabel: 'Ver imagen',
      badges: ['2K', 'Edición', 'Referencias'],
      altContext: 'ejemplo de imagen Luma Uni-1 guiada por referencias',
    },
    features: [
      { title: 'Imágenes 2K', body: 'Crea imágenes 2K únicas para conceptos, referencias y exploración de composición.', tone: 'quality' },
      { title: 'Ediciones fuente', body: 'Usa la primera imagen como fuente y guía la revisión con el prompt.', tone: 'continuity' },
      { title: 'Entrada multi-referencia', body: 'Adjunta referencias para forma de producto, estilo, dirección tipográfica o composición.', tone: 'reference' },
      { title: 'Composición razonada', body: 'Ayuda a ordenar elementos visuales, pero el texto exacto necesita revisión.', tone: 'quality' },
      { title: 'Opción con contexto web', body: 'Usa búsqueda web solo cuando el contexto visual actual ayuda a la consigna.', tone: 'reference' },
      { title: 'Precio de referencia', body: 'Los precios mostrados usan referencias públicas de MaxVideoAI antes de generar.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Cuándo elegir Uni-1',
        body: 'Elige Uni-1 para conceptos 2K, ediciones de fuente, preparación de referencias y exploración de composición visual.',
        cta: { label: 'Abrir Uni-1', href: '/app/image?engine=luma-uni-1' },
      },
      {
        title: 'Cómo usar referencias',
        body: 'Da un rol a cada referencia: producto, paleta, composición, estilo o jerarquía de texto. Define qué se conserva.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Cuándo pasar a Uni-1 Max',
        body: 'Mueve imágenes elegidas a Max cuando el visual principal necesita más detalle, acabado de producto o revisión cuidadosa.',
        cta: { label: 'Ver Uni-1 Max', href: modelsHref('es', 'luma-uni-1-max') },
      },
    ],
    referenceWorkflows: [
      { title: 'Texto a imagen', body: 'Describe visual, sujeto, composición, estilo, ratio y cualquier texto que deba revisarse.' },
      { title: 'Edición fuente', body: 'Sube una imagen fuente y separa instrucciones de preservar y cambiar.' },
      { title: 'Composición multi-referencia', body: 'Usa referencias para anclar sujeto, estilo, paleta y composición.' },
      { title: 'Investigación visual con contexto web', body: 'Activa búsqueda web solo si el contexto reciente ayuda, y revisa el resultado.' },
      { title: 'Paso a video', body: 'Guarda la imagen más clara como imagen inicial cuando el siguiente paso sea movimiento.' },
    ],
    pricingCopy: {
      title: 'Precios de Luma Uni-1 de un vistazo',
      subtitle: 'Los precios mostrados usan referencias públicas de MaxVideoAI; el precio exacto aparece antes de generar.',
      footnote: 'Los ejemplos de edición/referencia incluyen los conteos de imagen indicados; la cotización en la app manda.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Una imagen',
    },
    meta: {
      title: 'Luma Uni-1: precios de imagen, referencias y edición | MaxVideoAI',
      description:
        'Explora Luma Uni-1: generación de imagen 2K, ediciones de fuente, guía multi-referencia, investigación visual con contexto web y precios de referencia.',
    },
  },
};

const LUMA_UNI_1_MAX_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'LUMA PREMIUM IMAGE ROUTE',
      title: 'Luma Uni-1 Max',
      subtitle: 'Higher-fidelity Uni-1 stills for precise image revisions, product visuals and reference-led edits.',
      subtitleHighlights: ['Higher-fidelity Uni-1 stills', 'precise image revisions', 'reference-led edits'],
      paragraph:
        'Use Uni-1 Max when the still needs more careful detail than the base route: hero images, product-label layouts, typography-sensitive concepts and high-detail edits with references.',
      primaryCta: { label: 'Generate with Luma Uni-1 Max', href: '/app/image?engine=luma-uni-1-max' },
      secondaryCta: { label: 'View pricing', href: pricingHref('en', 'luma-uni-1-max-pricing') },
      quickLinks: [
        { label: 'Open image workspace', href: '/app/image?engine=luma-uni-1-max' },
        { label: 'View pricing', href: pricingHref('en', 'luma-uni-1-max-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Luma Uni-1 Max example',
      description: 'Premium 2K still and reference edit workflow',
      renderLabel: 'View image',
      badges: ['2K', 'Hero still', 'References'],
      altContext: 'Luma Uni-1 Max premium still image example',
    },
    features: [
      { title: 'Premium 2K route', body: 'Use Max for selected stills that need stronger detail and finish.', tone: 'quality' },
      { title: 'Product visuals', body: 'Good fit for catalog-style stills, labels, packaging and campaign layouts.', tone: 'reference' },
      { title: 'Precise revisions', body: 'Use source images and references to narrow what should change.', tone: 'continuity' },
      { title: 'Typography-sensitive', body: 'Helpful for text-aware layouts, while exact copy still needs inspection.', tone: 'quality' },
      { title: 'Reference direction', body: 'Blend product, style, wardrobe or layout references into one still brief.', tone: 'reference' },
      { title: 'Display pricing', body: 'Display prices use MaxVideoAI pricing before generation.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Max or base Uni-1?',
        body: 'Use base Uni-1 for exploration. Use Max for selected hero stills, product detail and revisions that justify the higher-cost route.',
        cta: { label: 'View Uni-1', href: modelsHref('en', 'luma-uni-1') },
      },
      {
        title: 'Product or typography hero still?',
        body: 'Name exact label hierarchy, surface materials, lighting and composition; then inspect text and edges before shipping.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Edit with references',
        body: 'Use the source image for what must remain, then add references only when each one has a clear role.',
        cta: { label: 'Open Uni-1 Max', href: '/app/image?engine=luma-uni-1-max' },
      },
    ],
    referenceWorkflows: [
      { title: 'Hero still', body: 'Define product, scene, layout, copy placement, lighting and output ratio before generating.' },
      { title: 'Product label or poster', body: 'Write text hierarchy explicitly, then verify lettering, logo placement and fine details.' },
      { title: 'High-detail edit', body: 'Upload the source image and describe the smallest set of changes needed.' },
      { title: 'Multi-reference creative direction', body: 'Assign references to product identity, palette, material, style or composition.' },
      { title: 'Handoff to video', body: 'Use the strongest still as a start image when the campaign later needs motion.' },
    ],
    pricingCopy: {
      title: 'Luma Uni-1 Max pricing at a glance',
      subtitle: 'Display prices use MaxVideoAI pricing; exact price appears before generation.',
      footnote: 'Max is not positioned as cheaper or faster than Uni-1; choose it when the still needs the higher-fidelity route.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'One image',
    },
    meta: {
      title: 'Luma Uni-1 Max: Pricing, 2K Images & Editing | MaxVideoAI',
      description:
        'Explore Luma Uni-1 Max pricing, premium 2K still generation, source-image edits, typography-sensitive layouts and reference-led image workflows.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'ROUTE LUMA IMAGE PREMIUM',
      title: 'Luma Uni-1 Max',
      subtitle: 'Images Uni-1 plus fidèles pour révisions précises, visuels produit et retouches guidées par références.',
      subtitleHighlights: ['Images Uni-1 plus fidèles', 'révisions précises', 'retouches guidées par références'],
      paragraph:
        'Utilisez Uni-1 Max quand l’image demande plus de soin que la route de base : visuels principaux, compositions produit, concepts sensibles à la typographie et retouches détaillées par références.',
      primaryCta: { label: 'Générer avec Luma Uni-1 Max', href: '/app/image?engine=luma-uni-1-max' },
      secondaryCta: { label: 'Voir les tarifs', href: pricingHref('fr', 'luma-uni-1-max-pricing') },
      quickLinks: [
        { label: 'Ouvrir l’espace image', href: '/app/image?engine=luma-uni-1-max' },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'luma-uni-1-max-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Luma Uni-1 Max',
      description: 'Image 2K haut de gamme et retouche par référence',
      renderLabel: 'Voir l’image',
      badges: ['2K', 'Visuel principal', 'Références'],
      altContext: 'exemple image premium Luma Uni-1 Max',
    },
    features: [
      { title: 'Route 2K haut de gamme', body: 'Utilisez Max pour les images retenues qui demandent plus de détail et finition.', tone: 'quality' },
      { title: 'Visuels produit', body: 'Adapté aux packshots, étiquettes, emballages et compositions de campagne.', tone: 'reference' },
      { title: 'Révisions précises', body: 'Utilisez source et références pour limiter clairement ce qui change.', tone: 'continuity' },
      { title: 'Sensible à la typo', body: 'Utile pour compositions avec texte, avec vérification humaine du texte exact.', tone: 'quality' },
      { title: 'Direction par référence', body: 'Combinez références produit, style, tenue ou composition dans une consigne image.', tone: 'reference' },
      { title: 'Prix de référence', body: 'Les prix affichés utilisent les références publiques MaxVideoAI avant génération.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Max ou Uni-1 base ?',
        body: 'Gardez Uni-1 pour explorer. Utilisez Max pour les visuels principaux, détails produit et révisions qui justifient la route plus coûteuse.',
        cta: { label: 'Voir Uni-1', href: modelsHref('fr', 'luma-uni-1') },
      },
      {
        title: 'Visuel produit ou typographie ?',
        body: 'Nommez hiérarchie texte, matières, lumière et composition; vérifiez texte et contours avant livraison.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Retouche avec références',
        body: 'La source indique ce qui reste. Ajoutez seulement des références avec un rôle clair.',
        cta: { label: 'Ouvrir Uni-1 Max', href: '/app/image?engine=luma-uni-1-max' },
      },
    ],
    referenceWorkflows: [
      { title: 'Visuel principal', body: 'Définissez produit, scène, composition, placement du texte, lumière et ratio avant génération.' },
      { title: 'Étiquette produit ou affiche', body: 'Écrivez la hiérarchie texte, puis vérifiez lettrage, logo et détails fins.' },
      { title: 'Retouche détaillée', body: 'Chargez la source et décrivez le plus petit ensemble de changements nécessaires.' },
      { title: 'Direction créative multi-référence', body: 'Attribuez les références à identité produit, palette, matière, style ou composition.' },
      { title: 'Passage vers vidéo', body: 'Utilisez l’image la plus forte comme image de départ si la campagne passe ensuite au mouvement.' },
    ],
    pricingCopy: {
      title: 'Prix Luma Uni-1 Max en un coup d’oeil',
      subtitle: 'Les prix affichés utilisent les références publiques MaxVideoAI; le prix exact apparaît avant génération.',
      footnote: 'Max n’est pas présenté comme moins cher ou plus rapide que Uni-1; choisissez-le quand l’image exige plus de fidélité.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Une image',
    },
    meta: {
      title: 'Luma Uni-1 Max : tarifs, images 2K et retouche | MaxVideoAI',
      description:
        'Explorez Luma Uni-1 Max : prix, génération image 2K haut de gamme, retouches source, compositions sensibles à la typographie et flux image par références.',
    },
  },
  es: {
    hero: {
      eyebrow: 'RUTA LUMA PREMIUM DE IMAGEN',
      title: 'Luma Uni-1 Max',
      subtitle: 'Imágenes Uni-1 de mayor fidelidad para revisiones precisas, visuales de producto y ediciones con referencias.',
      subtitleHighlights: ['Imágenes Uni-1 de mayor fidelidad', 'revisiones precisas', 'ediciones con referencias'],
      paragraph:
        'Usa Uni-1 Max cuando la imagen necesita más detalle que la ruta base: visuales principales, composiciones de producto, conceptos sensibles a tipografía y ediciones detalladas con referencias.',
      primaryCta: { label: 'Generar con Luma Uni-1 Max', href: '/app/image?engine=luma-uni-1-max' },
      secondaryCta: { label: 'Ver precios', href: pricingHref('es', 'luma-uni-1-max-pricing') },
      quickLinks: [
        { label: 'Abrir espacio de imagen', href: '/app/image?engine=luma-uni-1-max' },
        { label: 'Ver precios', href: pricingHref('es', 'luma-uni-1-max-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Luma Uni-1 Max',
      description: 'Imagen 2K de alta fidelidad y flujo de edición con referencias',
      renderLabel: 'Ver imagen',
      badges: ['2K', 'Visual principal', 'Referencias'],
      altContext: 'ejemplo de imagen premium con Luma Uni-1 Max',
    },
    features: [
      { title: 'Ruta 2K de alta fidelidad', body: 'Usa Max para imágenes seleccionadas que necesitan más detalle y acabado.', tone: 'quality' },
      { title: 'Visuales de producto', body: 'Buen ajuste para catálogo, etiquetas, packaging y composiciones de campaña.', tone: 'reference' },
      { title: 'Revisiones precisas', body: 'Usa imagen fuente y referencias para acotar lo que debe cambiar.', tone: 'continuity' },
      { title: 'Sensible a tipografía', body: 'Ayuda en composiciones con texto, aunque el texto exacto requiere inspección.', tone: 'quality' },
      { title: 'Dirección con referencias', body: 'Combina producto, estilo, vestuario o composición en una consigna de imagen.', tone: 'reference' },
      { title: 'Precio de referencia', body: 'Los precios mostrados usan referencias públicas de MaxVideoAI antes de generar.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '¿Max o Uni-1 base?',
        body: 'Usa Uni-1 base para explorar. Usa Max para visuales principales, detalle de producto y revisiones que justifiquen una ruta de mayor costo.',
        cta: { label: 'Ver Uni-1', href: modelsHref('es', 'luma-uni-1') },
      },
      {
        title: '¿Visual de producto o tipografía?',
        body: 'Nombra jerarquía de texto, materiales, luz y composición; revisa texto y bordes antes de entregar.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Editar con referencias',
        body: 'La imagen fuente define lo que queda. Agrega referencias solo si cada una tiene un rol claro.',
        cta: { label: 'Abrir Uni-1 Max', href: '/app/image?engine=luma-uni-1-max' },
      },
    ],
    referenceWorkflows: [
      { title: 'Visual principal', body: 'Define producto, escena, composición, ubicación de texto, luz y ratio antes de generar.' },
      { title: 'Etiqueta de producto o póster', body: 'Escribe la jerarquía de texto y verifica letras, logo y detalles finos.' },
      { title: 'Edición de alto detalle', body: 'Sube la fuente y describe el conjunto mínimo de cambios necesarios.' },
      { title: 'Dirección creativa multi-referencia', body: 'Asigna referencias a identidad de producto, paleta, material, estilo o composición.' },
      { title: 'Paso a video', body: 'Usa la imagen más fuerte como imagen inicial si la campaña después necesita movimiento.' },
    ],
    pricingCopy: {
      title: 'Precios de Luma Uni-1 Max de un vistazo',
      subtitle: 'Los precios mostrados usan referencias públicas de MaxVideoAI; el precio exacto aparece antes de generar.',
      footnote: 'Max no se presenta como más barato o rápido que Uni-1; elige esta ruta cuando la imagen necesite mayor fidelidad.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Una imagen',
    },
    meta: {
      title: 'Luma Uni-1 Max: precios, imágenes 2K y edición | MaxVideoAI',
      description:
        'Explora Luma Uni-1 Max: precios, imágenes 2K de alta fidelidad, ediciones de fuente, composiciones sensibles a tipografía y flujos con referencias.',
    },
  },
};

const HAPPY_HORSE_10_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'LEGACY VIDEO EDIT ROUTE',
      title: 'Happy Horse 1.0',
      subtitle:
        'Legacy video-edit route for source clip adjustments; use Happy Horse 1.1 for new text, image and reference generations.',
      subtitleHighlights: ['legacy video-edit', 'source clip adjustments', 'Happy Horse 1.1'],
      paragraph:
        'Use Happy Horse 1.0 only when you need the legacy video-edit endpoint. Use Happy Horse 1.1 for new text, image and reference generations.',
      primaryCta: { label: 'Generate with Happy Horse 1.0', href: '/app?engine=happy-horse-1-0' },
      secondaryCta: { label: 'View examples', href: examplesHref('en', 'happy-horse') },
      quickLinks: [
        { label: 'Compare vs Happy Horse 1.1', href: compareHref('en', 'happy-horse-1-1', 'happy-horse-1-0', 'happy-horse-1-1') },
        { label: 'View pricing', href: pricingHref('en', 'happy-horse-1-0-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Happy Horse 1.0 example',
      description: 'Legacy native-audio video-edit route',
      renderLabel: 'View render',
      badges: ['Native audio', 'R2V', '1080p'],
      altContext: 'Happy Horse 1.0 native audio reference-guided video example',
    },
    features: [
      { title: 'Native audio', body: 'Generate dialogue, ambience and SFX with the render when the route supports it.', tone: 'audio' },
      { title: 'Current route moved', body: 'Use Happy Horse 1.1 for new text, image and reference generations.', tone: 'reference' },
      { title: 'R2V references', body: 'Use multiple references to guide identity, motion, style or scene details.', tone: 'continuity' },
      { title: 'Video edit', body: 'Modify an existing clip when you need a controlled visual adjustment.', tone: 'quality' },
      { title: '720p or 1080p', body: 'Choose the exposed MaxVideoAI resolution before generation.', tone: 'quality' },
      { title: 'Pay-as-you-go', body: 'See exact live price before you generate.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Need the current Happy Horse?',
        body: 'Start on Happy Horse 1.1 for new text, image and reference generations. Keep 1.0 only for legacy video-edit jobs.',
        cta: { label: 'Open Happy Horse 1.1', href: modelsHref('en', 'happy-horse-1-1') },
      },
      {
        title: 'Working from references?',
        body: 'Assign each file one job: identity, wardrobe, movement, environment or audio mood.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Need another audio-native route?',
        body: 'Compare with Veo when you are choosing between cinematic Google output and a flexible audio-video workflow.',
        cta: { label: 'Compare Happy Horse vs Veo', href: compareHref('en', 'happy-horse-1-0', 'veo-3-1') },
      },
    ],
    referenceWorkflows: [
      { title: 'Text-to-video', body: 'Write the subject, action, camera, style and audio beats in a compact brief.' },
      { title: 'Image-to-video', body: 'Use a still image to anchor subject, product, wardrobe or composition.' },
      { title: 'R2V references', body: 'Give each reference one role so identity, movement and environment do not conflict.' },
      { title: 'Video edit', body: 'Use source video when the job is to change look, pacing or detail without starting over.' },
      { title: 'Audio handling', body: 'Keep dialogue short and tie SFX to visible actions for cleaner synchronized output.' },
    ],
    pricingCopy: {
      title: 'Happy Horse 1.0 pricing at a glance',
      subtitle: 'Preset native-audio totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'Up to 1080p',
    },
    meta: {
      title: 'Happy Horse 1.0 Legacy Video Edit Route | MaxVideoAI',
      description:
        'Use Happy Horse 1.0 as the legacy Alibaba video-edit route on MaxVideoAI. Use Happy Horse 1.1 for new text, image and reference generations.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'ANCIENNE ROUTE D’ÉDITION VIDÉO',
      title: 'Happy Horse 1.0',
      subtitle:
        'Ancienne route d’édition vidéo pour clip source ; utilisez Happy Horse 1.1 pour les nouvelles générations texte, image et référence.',
      subtitleHighlights: ['édition vidéo', 'clip source', 'Happy Horse 1.1'],
      paragraph:
        'Utilisez Happy Horse 1.0 seulement pour l’ancien endpoint d’édition vidéo. Utilisez Happy Horse 1.1 pour les nouvelles générations texte, image et référence.',
      primaryCta: { label: 'Générer avec Happy Horse 1.0', href: '/app?engine=happy-horse-1-0' },
      secondaryCta: { label: 'Voir les exemples', href: examplesHref('fr', 'happy-horse') },
      quickLinks: [
        { label: 'Comparer vs Happy Horse 1.1', href: compareHref('fr', 'happy-horse-1-1', 'happy-horse-1-0', 'happy-horse-1-1') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'happy-horse-1-0-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Happy Horse 1.0',
      description: 'Ancienne route d’édition vidéo avec audio natif',
      renderLabel: 'Voir le rendu',
      badges: ['Audio natif', 'R2V', '1080p'],
      altContext: 'exemple vidéo Happy Horse 1.0 avec audio natif et références',
    },
    features: [
      { title: 'Audio natif', body: 'Générez dialogue, ambiance et SFX avec le rendu quand la route le permet.', tone: 'audio' },
      { title: 'Route actuelle déplacée', body: 'Utilisez Happy Horse 1.1 pour les nouvelles générations texte, image et référence.', tone: 'reference' },
      { title: 'Références R2V', body: 'Utilisez plusieurs références pour guider identité, mouvement, style ou décor.', tone: 'continuity' },
      { title: 'Édition vidéo', body: 'Modifiez un clip existant pour un ajustement visuel plus contrôlé.', tone: 'quality' },
      { title: '720p ou 1080p', body: 'Choisissez la résolution exposée dans MaxVideoAI avant génération.', tone: 'quality' },
      { title: 'Paiement à l’usage', body: 'Prix exact affiché avant génération.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Besoin du Happy Horse actuel ?',
        body: 'Démarrez sur Happy Horse 1.1 pour les nouvelles générations texte, image et référence. Gardez 1.0 uniquement pour l’ancienne édition vidéo.',
        cta: { label: 'Ouvrir Happy Horse 1.1', href: modelsHref('fr', 'happy-horse-1-1') },
      },
      {
        title: 'Travail avec références ?',
        body: 'Donnez un rôle clair à chaque fichier : identité, tenue, mouvement, environnement ou humeur audio.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Besoin d’une autre route audio ?',
        body: 'Comparez avec Veo si vous hésitez entre rendu Google cinématographique et workflow audio-vidéo flexible.',
        cta: { label: 'Comparer Happy Horse vs Veo', href: compareHref('fr', 'happy-horse-1-0', 'veo-3-1') },
      },
    ],
    referenceWorkflows: [
      { title: 'Text-to-video', body: 'Structurez sujet, action, caméra, style et beats audio dans un brief court.' },
      { title: 'Image-to-video', body: 'Utilisez une image pour ancrer sujet, produit, tenue ou composition.' },
      { title: 'Références R2V', body: 'Attribuez un rôle par référence pour éviter les conflits entre identité, mouvement et décor.' },
      { title: 'Édition vidéo', body: 'Utilisez une source vidéo quand il faut changer look, rythme ou détail sans repartir de zéro.' },
      { title: 'Gestion audio', body: 'Gardez les dialogues courts et liez les SFX aux actions visibles.' },
    ],
    pricingCopy: {
      title: 'Prix Happy Horse 1.0 en un coup d’œil',
      subtitle: 'Prix totaux avec audio natif — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Jusqu’à 1080p',
    },
    meta: {
      title: 'Happy Horse 1.0 : ancienne édition vidéo | MaxVideoAI',
      description:
        'Utilisez Happy Horse 1.0 comme ancienne route Happy Horse pour l’édition vidéo. Utilisez Happy Horse 1.1 pour les nouvelles générations texte, image et référence.',
    },
  },
  es: {
    hero: {
      eyebrow: 'RUTA ANTERIOR DE EDICIÓN DE VIDEO',
      title: 'Happy Horse 1.0',
      subtitle:
        'Ruta anterior de edición de video para clip fuente; usa Happy Horse 1.1 para nuevas generaciones de texto, imagen y referencia.',
      subtitleHighlights: ['edición de video', 'clip fuente', 'Happy Horse 1.1'],
      paragraph:
        'Usa Happy Horse 1.0 solo para el endpoint anterior de edición de video. Usa Happy Horse 1.1 para nuevas generaciones de texto, imagen y referencia.',
      primaryCta: { label: 'Generar con Happy Horse 1.0', href: '/app?engine=happy-horse-1-0' },
      secondaryCta: { label: 'Ver ejemplos', href: examplesHref('es', 'happy-horse') },
      quickLinks: [
        { label: 'Comparar vs Happy Horse 1.1', href: compareHref('es', 'happy-horse-1-1', 'happy-horse-1-0', 'happy-horse-1-1') },
        { label: 'Ver precios', href: pricingHref('es', 'happy-horse-1-0-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Happy Horse 1.0',
      description: 'Ruta anterior de edición de video con audio nativo',
      renderLabel: 'Ver resultado',
      badges: ['Audio nativo', 'R2V', '1080p'],
      altContext: 'ejemplo de Happy Horse 1.0 con audio nativo y referencias',
    },
    features: [
      { title: 'Audio nativo', body: 'Genera diálogo, ambiente y SFX con el render cuando la ruta lo permite.', tone: 'audio' },
      { title: 'Ruta actual movida', body: 'Usa Happy Horse 1.1 para nuevas generaciones de texto, imagen y referencia.', tone: 'reference' },
      { title: 'Referencias R2V', body: 'Usa varias referencias para guiar identidad, movimiento, estilo o escena.', tone: 'continuity' },
      { title: 'Edición de video', body: 'Modifica un clip existente cuando necesitas un ajuste visual controlado.', tone: 'quality' },
      { title: '720p o 1080p', body: 'Elige la resolución disponible en MaxVideoAI antes de generar.', tone: 'quality' },
      { title: 'Pago por uso', body: 'Ve el precio exacto antes de generar.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '¿Necesitas el Happy Horse actual?',
        body: 'Empieza en Happy Horse 1.1 para nuevas generaciones de texto, imagen y referencia. Mantén 1.0 solo para la edición de video anterior.',
        cta: { label: 'Abrir Happy Horse 1.1', href: modelsHref('es', 'happy-horse-1-1') },
      },
      {
        title: '¿Trabajas con referencias?',
        body: 'Dale una función clara a cada archivo: identidad, vestuario, movimiento, entorno o mood de audio.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: '¿Necesitas otra ruta con audio?',
        body: 'Compara con Veo si estás eligiendo entre salida cinematográfica de Google y un flujo audio-video flexible.',
        cta: { label: 'Comparar Happy Horse vs Veo', href: compareHref('es', 'happy-horse-1-0', 'veo-3-1') },
      },
    ],
    referenceWorkflows: [
      { title: 'Texto a video', body: 'Define sujeto, acción, cámara, estilo y beats de audio en un brief compacto.' },
      { title: 'Imagen a video', body: 'Usa una imagen para fijar sujeto, producto, vestuario o composición.' },
      { title: 'Referencias R2V', body: 'Asigna un rol por referencia para evitar choques entre identidad, movimiento y entorno.' },
      { title: 'Edición de video', body: 'Usa video fuente cuando el trabajo es cambiar look, ritmo o detalle sin empezar de cero.' },
      { title: 'Manejo de audio', body: 'Mantén diálogo corto y conecta SFX con acciones visibles para una sincronía más limpia.' },
    ],
    pricingCopy: {
      title: 'Precios de Happy Horse 1.0 de un vistazo',
      subtitle: 'Totales con audio nativo. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Hasta 1080p',
    },
    meta: {
      title: 'Happy Horse 1.0: edición de video anterior | MaxVideoAI',
      description:
        'Usa Happy Horse 1.0 como ruta anterior de Happy Horse para edición de video. Usa Happy Horse 1.1 para nuevas generaciones de texto, imagen y referencia.',
    },
  },
};

const HAPPY_HORSE_11_COPY: LocalizedTemplateCopy = {
  en: {
    ...HAPPY_HORSE_10_COPY.en,
    hero: {
      eyebrow: 'CURRENT ALIBABA VIDEO MODEL',
      title: 'Happy Horse 1.1',
      subtitle: 'Native audio, lip-sync, image-to-video and reference-to-video in one current Alibaba route.',
      subtitleHighlights: ['Native audio', 'image-to-video', 'reference-to-video'],
      paragraph:
        'Use Happy Horse 1.1 when a shot needs synchronized speech or sound from text, a starting image, or up to nine reference images. Keep Happy Horse 1.0 for legacy video-edit jobs.',
      primaryCta: { label: 'Generate with Happy Horse 1.1', href: '/app?engine=happy-horse-1-1' },
      secondaryCta: { label: 'View examples', href: examplesHref('en', 'happy-horse') },
      quickLinks: [
        { label: 'Compare vs Seedance', href: compareHref('en', 'happy-horse-1-1', 'seedance-2-0') },
        { label: 'View pricing', href: pricingHref('en', 'happy-horse-1-1-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Happy Horse 1.1 example',
      description: 'Native-audio text, image and reference video route',
      renderLabel: 'View render',
      badges: ['Native audio', 'Reference video', '1080p'],
      altContext: 'Happy Horse 1.1 native audio reference-guided video example',
    },
    features: [
      { title: 'Native audio', body: 'Generate dialogue, ambience and SFX with the render when the route supports it.', tone: 'audio' },
      { title: 'Text or image', body: 'Start from a scene brief or a still image to lock subject and composition.', tone: 'reference' },
      { title: 'Reference images', body: 'Use up to nine references with character1 through character9 prompt anchors.', tone: 'continuity' },
      { title: 'Expanded ratios', body: 'Use landscape, vertical, square, classic, wide, tall, 5:4 or 4:5 composition.', tone: 'quality' },
      { title: '720p or 1080p', body: 'Choose the exposed MaxVideoAI resolution before generation.', tone: 'quality' },
      { title: 'Lower 1080p provider rate', body: 'Happy Horse 1.1 uses the current Fal 1080p rate before MaxVideoAI margin.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Happy Horse 1.1 or Seedance?',
        body: 'Use Happy Horse 1.1 for Alibaba native-audio text, image and reference generation. Use Seedance 2.0 when multimodal references, longer production continuity and current Seedance behavior are the priority.',
        cta: { label: 'Compare Happy Horse vs Seedance', href: compareHref('en', 'happy-horse-1-1', 'seedance-2-0') },
      },
      {
        title: 'Need video edit?',
        body: 'Use Happy Horse 1.0 only when you specifically need the legacy video-edit endpoint. New text, image and reference jobs should start on 1.1.',
        cta: { label: 'Open legacy Happy Horse 1.0', href: modelsHref('en', 'happy-horse-1-0') },
      },
      {
        title: 'Working from references?',
        body: 'Assign each file one job: identity, wardrobe, movement, environment or audio mood.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
    ],
    referenceWorkflows: [
      { title: 'Text-to-video', body: 'Write the subject, action, camera, style and audio beats in a compact brief.' },
      { title: 'Image-to-video', body: 'Use a still image to anchor subject, product, wardrobe or composition.' },
      { title: 'Reference-to-video', body: 'Name each reference as character1, character2 and onward to keep roles clear.' },
      { title: 'Legacy video edit', body: 'Switch to Happy Horse 1.0 only when a source video must be edited rather than regenerated.' },
      { title: 'Audio handling', body: 'Keep dialogue short and tie SFX to visible actions for cleaner synchronized output.' },
    ],
    pricingCopy: {
      title: 'Happy Horse 1.1 pricing at a glance',
      subtitle: 'Preset native-audio totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'Up to 1080p',
    },
    meta: {
      title: 'Happy Horse 1.1: Pricing, Native Audio & Reference Video | MaxVideoAI',
      description:
        'Explore Happy Horse 1.1 pricing, native audio, lip-sync, text-to-video, image-to-video and reference-to-video workflows on MaxVideoAI.',
    },
  },
  fr: {
    ...HAPPY_HORSE_10_COPY.fr,
    hero: {
      eyebrow: 'MODÈLE VIDÉO ALIBABA ACTUEL',
      title: 'Happy Horse 1.1',
      subtitle: 'Audio natif, synchronisation labiale, génération depuis image et génération guidée par références dans la route Alibaba actuelle.',
      subtitleHighlights: ['Audio natif', 'synchronisation labiale', 'références'],
      paragraph:
        'Utilisez Happy Horse 1.1 quand un plan doit générer voix ou son synchronisé depuis un texte, une image de départ ou jusqu’à neuf références. Gardez Happy Horse 1.0 pour l’ancienne édition vidéo.',
      primaryCta: { label: 'Générer avec Happy Horse 1.1', href: '/app?engine=happy-horse-1-1' },
      secondaryCta: { label: 'Voir les exemples', href: examplesHref('fr', 'happy-horse') },
      quickLinks: [
        { label: 'Comparer vs Seedance', href: compareHref('fr', 'happy-horse-1-1', 'seedance-2-0') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'happy-horse-1-1-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Happy Horse 1.1',
      description: 'Route texte, image et références avec audio natif',
      renderLabel: 'Voir le rendu',
      badges: ['Audio natif', 'Références', '1080p'],
      altContext: 'exemple vidéo Happy Horse 1.1 avec audio natif et références',
    },
    features: [
      { title: 'Audio natif', body: 'Générez dialogue, ambiance et SFX avec le rendu quand la route le permet.', tone: 'audio' },
      { title: 'Texte ou image', body: 'Partez d’un brief ou d’une image pour verrouiller sujet et composition.', tone: 'reference' },
      { title: 'Images de référence', body: 'Utilisez jusqu’à neuf références avec les ancres character1 à character9.', tone: 'continuity' },
      { title: 'Ratios élargis', body: 'Utilisez paysage, vertical, carré, classique, très large, très haut, 5:4 ou 4:5.', tone: 'quality' },
      { title: '720p ou 1080p', body: 'Choisissez la résolution exposée dans MaxVideoAI avant génération.', tone: 'quality' },
      { title: '1080p fournisseur moins cher', body: 'Happy Horse 1.1 utilise le tarif Fal 1080p actuel avant marge MaxVideoAI.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Happy Horse 1.1 ou Seedance ?',
        body: 'Choisissez Happy Horse 1.1 pour les générations Alibaba avec audio natif depuis texte, image ou références. Choisissez Seedance 2.0 pour des références multimodales et une continuité de production Seedance actuelle.',
        cta: { label: 'Comparer Happy Horse vs Seedance', href: compareHref('fr', 'happy-horse-1-1', 'seedance-2-0') },
      },
      {
        title: 'Besoin de montage vidéo ?',
        body: 'Utilisez Happy Horse 1.0 seulement si vous avez besoin de l’ancien endpoint d’édition vidéo. Les nouvelles générations texte, image et référence doivent partir de 1.1.',
        cta: { label: 'Ouvrir l’ancienne route Happy Horse 1.0', href: modelsHref('fr', 'happy-horse-1-0') },
      },
      {
        title: 'Travail avec références ?',
        body: 'Donnez un rôle clair à chaque fichier : identité, tenue, mouvement, environnement ou humeur audio.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
    ],
    referenceWorkflows: [
      { title: 'Texte vers vidéo', body: 'Structurez sujet, action, caméra, style et indications audio dans une consigne courte.' },
      { title: 'Image vers vidéo', body: 'Utilisez une image pour ancrer sujet, produit, tenue ou composition.' },
      { title: 'Références vers vidéo', body: 'Nommez chaque référence character1, character2 et ainsi de suite pour clarifier les rôles.' },
      { title: 'Ancienne édition vidéo', body: 'Passez à Happy Horse 1.0 uniquement quand une vidéo source doit être éditée plutôt que régénérée.' },
      { title: 'Gestion audio', body: 'Gardez les dialogues courts et liez les SFX aux actions visibles.' },
    ],
    pricingCopy: {
      title: 'Prix Happy Horse 1.1 en un coup d’œil',
      subtitle: 'Prix totaux avec audio natif — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Jusqu’à 1080p',
    },
    meta: {
      title: 'Happy Horse 1.1 : tarifs, audio natif et références | MaxVideoAI',
      description:
        'Explorez Happy Horse 1.1 : prix, audio natif, synchronisation labiale, génération depuis texte, image et références sur MaxVideoAI.',
    },
  },
  es: {
    ...HAPPY_HORSE_10_COPY.es,
    hero: {
      eyebrow: 'MODELO DE VIDEO ALIBABA ACTUAL',
      title: 'Happy Horse 1.1',
      subtitle: 'Audio nativo, sincronización labial, imagen a video y generación guiada por referencias en la ruta actual de Alibaba.',
      subtitleHighlights: ['Audio nativo', 'sincronización labial', 'referencias'],
      paragraph:
        'Usa Happy Horse 1.1 cuando un plano necesita voz o sonido sincronizado desde texto, una imagen inicial o hasta nueve referencias. Mantén Happy Horse 1.0 para la edición de video anterior.',
      primaryCta: { label: 'Generar con Happy Horse 1.1', href: '/app?engine=happy-horse-1-1' },
      secondaryCta: { label: 'Ver ejemplos', href: examplesHref('es', 'happy-horse') },
      quickLinks: [
        { label: 'Comparar vs Seedance', href: compareHref('es', 'happy-horse-1-1', 'seedance-2-0') },
        { label: 'Ver precios', href: pricingHref('es', 'happy-horse-1-1-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Happy Horse 1.1',
      description: 'Ruta de texto, imagen y referencias con audio nativo',
      renderLabel: 'Ver resultado',
      badges: ['Audio nativo', 'Referencias', '1080p'],
      altContext: 'ejemplo de Happy Horse 1.1 con audio nativo y referencias',
    },
    features: [
      { title: 'Audio nativo', body: 'Genera diálogo, ambiente y SFX con el render cuando la ruta lo permite.', tone: 'audio' },
      { title: 'Texto o imagen', body: 'Empieza con un brief o una imagen para fijar sujeto y composición.', tone: 'reference' },
      { title: 'Imágenes de referencia', body: 'Usa hasta nueve referencias con anclas character1 a character9.', tone: 'continuity' },
      { title: 'Ratios ampliados', body: 'Usa paisaje, vertical, cuadrado, clásico, panorámico, alto, 5:4 o 4:5.', tone: 'quality' },
      { title: '720p o 1080p', body: 'Elige la resolución disponible en MaxVideoAI antes de generar.', tone: 'quality' },
      { title: '1080p proveedor más barato', body: 'Happy Horse 1.1 usa la tarifa Fal 1080p actual antes del margen MaxVideoAI.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '¿Happy Horse 1.1 o Seedance?',
        body: 'Usa Happy Horse 1.1 para generación Alibaba con audio nativo desde texto, imagen o referencias. Usa Seedance 2.0 para referencias multimodales y continuidad actual de producción Seedance.',
        cta: { label: 'Comparar Happy Horse vs Seedance', href: compareHref('es', 'happy-horse-1-1', 'seedance-2-0') },
      },
      {
        title: '¿Necesitas edición de video?',
        body: 'Usa Happy Horse 1.0 solo si necesitas el endpoint anterior de edición de video. Los nuevos trabajos de texto, imagen y referencia deben empezar en 1.1.',
        cta: { label: 'Abrir la ruta anterior Happy Horse 1.0', href: modelsHref('es', 'happy-horse-1-0') },
      },
      {
        title: '¿Trabajas con referencias?',
        body: 'Dale una función clara a cada archivo: identidad, vestuario, movimiento, entorno o mood de audio.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
    ],
    referenceWorkflows: [
      { title: 'Texto a video', body: 'Define sujeto, acción, cámara, estilo e indicaciones de audio en un prompt compacto.' },
      { title: 'Imagen a video', body: 'Usa una imagen para fijar sujeto, producto, vestuario o composición.' },
      { title: 'Referencias a video', body: 'Nombra cada referencia como character1, character2 y así sucesivamente para aclarar roles.' },
      { title: 'Edición de video anterior', body: 'Cambia a Happy Horse 1.0 solo cuando una fuente de video deba editarse en lugar de regenerarse.' },
      { title: 'Manejo de audio', body: 'Mantén diálogo corto y conecta SFX con acciones visibles.' },
    ],
    pricingCopy: {
      title: 'Precios de Happy Horse 1.1 de un vistazo',
      subtitle: 'Totales con audio nativo. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Hasta 1080p',
    },
    meta: {
      title: 'Happy Horse 1.1: precios, audio nativo y referencias | MaxVideoAI',
      description:
        'Explora Happy Horse 1.1: precios, audio nativo, sincronización labial, texto a video, imagen a video y referencias a video en MaxVideoAI.',
    },
  },
};

const MINIMAX_HAILUO_02_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'BUDGET MOTION DRAFT ROUTE',
      title: 'MiniMax Hailuo 02',
      subtitle: 'Budget motion drafts for physics-aware tests, start/end frame checks and silent storyboard clips.',
      subtitleHighlights: ['Budget motion drafts', 'physics-aware tests', 'silent storyboard clips'],
      paragraph:
        'Use Hailuo 02 for low-cost 6 to 10 second motion tests at 512P or 768P before moving winners into higher-resolution or audio-capable production routes.',
      primaryCta: { label: 'Draft with Hailuo 02', href: '/app?engine=minimax-hailuo-02-text' },
      secondaryCta: { label: 'View examples', href: examplesHref('en', 'hailuo') },
      quickLinks: [
        { label: 'Compare vs Pika', href: compareHref('en', 'minimax-hailuo-02-text', 'pika-text-to-video') },
        { label: 'View pricing', href: pricingHref('en', 'minimax-hailuo-02-text-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Hailuo 02 example',
      description: 'Silent motion draft for timing and physics',
      renderLabel: 'View draft',
      badges: ['Silent', '10s', '768P'],
      altContext: 'MiniMax Hailuo 02 silent motion draft example',
    },
    features: [
      { title: 'Budget drafts', body: 'Test motion ideas before spending on final-quality routes.', tone: 'price' },
      { title: 'Physics tests', body: 'Check object movement, collisions and body motion in short clips.', tone: 'continuity' },
      { title: 'Text or image', body: 'Start from a prompt or a still image depending on how locked the shot is.', tone: 'reference' },
      { title: '512P or 768P', body: 'Draft cap on this route; use higher-resolution engines for delivery.', tone: 'quality' },
      { title: '6s or 10s', body: 'Choose compact durations for timing and storyboard validation.', tone: 'duration' },
      { title: 'Silent output', body: 'Plan music, voiceover and SFX in a later production pass.', tone: 'audio' },
    ],
    decisionCards: [
      {
        title: 'Hailuo or Pika?',
        body: 'Use Hailuo for budget motion and physics checks. Use Pika when stylized social loops and seed variants matter more.',
        cta: { label: 'Compare Hailuo vs Pika', href: compareHref('en', 'minimax-hailuo-02-text', 'pika-text-to-video') },
      },
      {
        title: 'Testing the landing frame?',
        body: 'Use image-to-video and end-frame planning when the final pose or composition matters.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Need sound or 1080p?',
        body: 'Compare with Kling 2.6 Pro when you need stronger output quality, audio support or production-ready renders.',
        cta: { label: 'Compare Hailuo vs Kling', href: compareHref('en', 'minimax-hailuo-02-text', 'kling-2-6-pro') },
      },
    ],
    referenceWorkflows: [
      { title: 'Text-to-video', body: 'Keep the test narrow: one subject, one action and one camera move.' },
      { title: 'Image-to-video', body: 'Use a start image when composition or product shape should stay stable.' },
      { title: 'End frame', body: 'Plan the landing pose with a clear final composition when available.' },
      { title: 'Prompt optimizer', body: 'Use optimization for quick drafts, then tighten the wording after you see motion behavior.' },
      { title: 'Upgrade path', body: 'Send approved movement to a higher-resolution or audio-capable engine for finals.' },
    ],
    pricingCopy: {
      title: 'MiniMax Hailuo 02 pricing at a glance',
      subtitle: 'Preset draft totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'Up to 768P',
    },
    meta: {
      title: 'MiniMax Hailuo 02: Pricing, Motion Drafts & Examples | MaxVideoAI',
      description:
        'Explore MiniMax Hailuo 02 pricing, budget motion drafts, physics-aware tests, image-to-video starts and silent storyboard examples on MaxVideoAI.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'ROUTE BROUILLON MOUVEMENT',
      title: 'MiniMax Hailuo 02',
      subtitle: 'Brouillons mouvement économiques pour tests physiques, image de fin et clips storyboard silencieux.',
      subtitleHighlights: ['Brouillons mouvement économiques', 'tests physiques', 'clips storyboard silencieux'],
      paragraph:
        'Utilisez Hailuo 02 pour tester à coût réduit des mouvements de 6 à 10 secondes en 512P ou 768P, avant de passer les meilleures pistes sur une route plus haute résolution ou avec audio.',
      primaryCta: { label: 'Créer un brouillon Hailuo 02', href: '/app?engine=minimax-hailuo-02-text' },
      secondaryCta: { label: 'Voir les exemples', href: examplesHref('fr', 'hailuo') },
      quickLinks: [
        { label: 'Comparer vs Pika', href: compareHref('fr', 'minimax-hailuo-02-text', 'pika-text-to-video') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'minimax-hailuo-02-text-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Hailuo 02',
      description: 'Brouillon silencieux pour rythme et physique',
      renderLabel: 'Voir le brouillon',
      badges: ['Silencieux', '10 s', '768P'],
      altContext: 'exemple de brouillon mouvement silencieux avec MiniMax Hailuo 02',
    },
    features: [
      { title: 'Brouillons économiques', body: 'Testez les idées de mouvement avant les routes finales plus coûteuses.', tone: 'price' },
      { title: 'Tests physiques', body: 'Vérifiez mouvements d’objets, collisions et gestuelle sur des clips courts.', tone: 'continuity' },
      { title: 'Texte ou image', body: 'Partez d’un prompt ou d’une image selon le niveau de verrouillage du plan.', tone: 'reference' },
      { title: '512P ou 768P', body: 'Limite brouillon de cette route ; utilisez une route plus haute résolution pour livrer.', tone: 'quality' },
      { title: '6 s ou 10 s', body: 'Choisissez des durées compactes pour valider timing et storyboard.', tone: 'duration' },
      { title: 'Sortie silencieuse', body: 'Préparez musique, voix et SFX dans une passe de production suivante.', tone: 'audio' },
    ],
    decisionCards: [
      {
        title: 'Hailuo ou Pika ?',
        body: 'Utilisez Hailuo pour le mouvement et la physique à petit budget. Utilisez Pika pour des loops sociaux stylisés et variantes par seed.',
        cta: { label: 'Comparer Hailuo vs Pika', href: compareHref('fr', 'minimax-hailuo-02-text', 'pika-text-to-video') },
      },
      {
        title: 'Vous testez l’image de fin ?',
        body: 'Utilisez image-to-video et une fin claire quand la pose ou la composition finale compte.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Besoin d’audio ou de 1080p ?',
        body: 'Comparez avec Kling 2.6 Pro si vous cherchez plus de qualité, du son ou une sortie prête pour production.',
        cta: { label: 'Comparer Hailuo vs Kling', href: compareHref('fr', 'minimax-hailuo-02-text', 'kling-2-6-pro') },
      },
    ],
    referenceWorkflows: [
      { title: 'Text-to-video', body: 'Gardez le test serré : un sujet, une action, un mouvement caméra.' },
      { title: 'Image-to-video', body: 'Utilisez une image de départ quand composition ou forme produit doit rester stable.' },
      { title: 'Image de fin', body: 'Préparez une pose finale claire lorsque la composition d’arrivée compte.' },
      { title: 'Optimisation du prompt', body: 'Servez-vous de l’optimisation pour brouillonner vite, puis resserrez après avoir vu le mouvement.' },
      { title: 'Passage final', body: 'Envoyez le mouvement validé vers une route plus haute résolution ou avec audio.' },
    ],
    pricingCopy: {
      title: 'Prix MiniMax Hailuo 02 en un coup d’œil',
      subtitle: 'Prix totaux de brouillon — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Jusqu’à 768P',
    },
    meta: {
      title: 'MiniMax Hailuo 02 : tarifs, brouillons mouvement et exemples | MaxVideoAI',
      description:
        'Explorez MiniMax Hailuo 02 : prix, brouillons mouvement économiques, tests physiques, image-to-video et exemples storyboard silencieux sur MaxVideoAI.',
    },
  },
  es: {
    hero: {
      eyebrow: 'RUTA ECONÓMICA DE MOVIMIENTO',
      title: 'MiniMax Hailuo 02',
      subtitle: 'Borradores de movimiento económicos para pruebas físicas, cuadros finales y clips storyboard sin audio.',
      subtitleHighlights: ['Borradores de movimiento económicos', 'pruebas físicas', 'clips storyboard sin audio'],
      paragraph:
        'Usa Hailuo 02 para pruebas de movimiento de 6 a 10 segundos en 512P o 768P antes de pasar los ganadores a rutas de mayor resolución o con audio.',
      primaryCta: { label: 'Crear borrador con Hailuo 02', href: '/app?engine=minimax-hailuo-02-text' },
      secondaryCta: { label: 'Ver ejemplos', href: examplesHref('es', 'hailuo') },
      quickLinks: [
        { label: 'Comparar vs Pika', href: compareHref('es', 'minimax-hailuo-02-text', 'pika-text-to-video') },
        { label: 'Ver precios', href: pricingHref('es', 'minimax-hailuo-02-text-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Hailuo 02',
      description: 'Borrador silencioso para ritmo y física',
      renderLabel: 'Ver borrador',
      badges: ['Sin audio', '10s', '768P'],
      altContext: 'ejemplo de borrador de movimiento sin audio con MiniMax Hailuo 02',
    },
    features: [
      { title: 'Borradores económicos', body: 'Prueba ideas de movimiento antes de pagar rutas finales.', tone: 'price' },
      { title: 'Pruebas físicas', body: 'Revisa movimiento de objetos, colisiones y gestos en clips cortos.', tone: 'continuity' },
      { title: 'Texto o imagen', body: 'Empieza con prompt o imagen según qué tan cerrado esté el plano.', tone: 'reference' },
      { title: '512P o 768P', body: 'Límite de borrador en esta ruta; usa motores de mayor resolución para entregar.', tone: 'quality' },
      { title: '6s o 10s', body: 'Elige duraciones compactas para validar timing y storyboard.', tone: 'duration' },
      { title: 'Salida sin audio', body: 'Resuelve música, voz y SFX en una pasada posterior.', tone: 'audio' },
    ],
    decisionCards: [
      {
        title: '¿Hailuo o Pika?',
        body: 'Usa Hailuo para movimiento y física con bajo costo. Usa Pika cuando importan loops sociales estilizados y variantes por seed.',
        cta: { label: 'Comparar Hailuo vs Pika', href: compareHref('es', 'minimax-hailuo-02-text', 'pika-text-to-video') },
      },
      {
        title: '¿Pruebas el cuadro final?',
        body: 'Usa imagen a video y una llegada clara cuando la pose o composición final importa.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: '¿Necesitas audio o 1080p?',
        body: 'Compara con Kling 2.6 Pro cuando necesitas más calidad, audio o renders listos para producción.',
        cta: { label: 'Comparar Hailuo vs Kling', href: compareHref('es', 'minimax-hailuo-02-text', 'kling-2-6-pro') },
      },
    ],
    referenceWorkflows: [
      { title: 'Texto a video', body: 'Mantén la prueba enfocada: un sujeto, una acción y un movimiento de cámara.' },
      { title: 'Imagen a video', body: 'Usa una imagen inicial cuando composición o forma del producto debe mantenerse estable.' },
      { title: 'Cuadro final', body: 'Define la pose de llegada cuando la composición final cuenta.' },
      { title: 'Optimizador de prompt', body: 'Úsalo para iterar rápido, luego ajusta el texto después de ver el comportamiento del movimiento.' },
      { title: 'Ruta de salida', body: 'Lleva el movimiento aprobado a un motor con mayor resolución o audio para finales.' },
    ],
    pricingCopy: {
      title: 'Precios de MiniMax Hailuo 02 de un vistazo',
      subtitle: 'Totales de borrador. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Hasta 768P',
    },
    meta: {
      title: 'MiniMax Hailuo 02: precios, borradores y ejemplos | MaxVideoAI',
      description:
        'Explora MiniMax Hailuo 02: precios, borradores de movimiento económicos, pruebas físicas, imagen a video y ejemplos storyboard sin audio en MaxVideoAI.',
    },
  },
};

const PIKA_TEXT_TO_VIDEO_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'PIKA TEXT-TO-VIDEO ROUTE',
      title: 'Pika 2.2 Text-to-Video',
      subtitle: 'Text-to-Video social loops with stylized motion, seeds, negative prompts and silent 5s/10s output.',
      subtitleHighlights: ['Text-to-Video social loops', 'stylized motion', 'silent 5s/10s output'],
      paragraph:
        'Use Pika 2.2 for prompt-led, silent stylized animation, variant testing and short social clips when the creative direction is anime, comic, pixel, toon or playful 3D.',
      primaryCta: { label: 'Generate with Pika 2.2', href: '/app?engine=pika-text-to-video' },
      secondaryCta: { label: 'View examples', href: examplesHref('en', 'pika') },
      quickLinks: [
        { label: 'Compare vs Hailuo', href: compareHref('en', 'pika-text-to-video', 'minimax-hailuo-02-text') },
        { label: 'View pricing', href: pricingHref('en', 'pika-text-to-video-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Pika 2.2 Text-to-Video example',
      description: 'Stylized silent social clip',
      renderLabel: 'View render',
      badges: ['Silent', '10s', '1080p'],
      altContext: 'Pika 2.2 stylized text-to-video social loop',
    },
    features: [
      { title: 'Text-to-Video first', body: 'Start from a compact prompt when the idea is style, action and loop timing.', tone: 'reference' },
      { title: 'Stylized motion', body: 'Create anime, comic, pixel, toon or playful 3D movement.', tone: 'quality' },
      { title: 'Seeds', body: 'Reuse seed-driven variants when a style direction starts working.', tone: 'continuity' },
      { title: 'Negative prompts', body: 'Exclude unwanted visual traits while testing a stylized direction.', tone: 'reference' },
      { title: '5s or 10s', body: 'Keep clips compact for loops, social edits and motion tests.', tone: 'duration' },
      { title: 'Silent output', body: 'Add music, voice and SFX after the visual pass.', tone: 'audio' },
    ],
    decisionCards: [
      {
        title: 'Pika or Hailuo?',
        body: 'Use Pika for stylized social loops and seed variants. Use Hailuo 02 for lower-cost physics and motion checks.',
        cta: { label: 'Compare Pika vs Hailuo', href: compareHref('en', 'pika-text-to-video', 'minimax-hailuo-02-text') },
      },
      {
        title: 'Building a stylized prompt?',
        body: 'Lock subject, style, action and exclusions before testing variants with seeds.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Need a broader draft route?',
        body: 'Compare with LTX 2.3 Fast when you need a more general draft engine before production routes.',
        cta: { label: 'Compare Pika vs LTX 2.3 Fast', href: compareHref('en', 'pika-text-to-video', 'ltx-2-3-fast') },
      },
    ],
    referenceWorkflows: [
      { title: 'Text-to-video', body: 'Write subject, action, style family and what to avoid in one compact prompt.' },
      { title: 'Style anchors', body: 'Name the art direction, palette and loop behavior instead of relying on reference-heavy setup.' },
      { title: 'Seed variants', body: 'Keep a useful seed and iterate prompts around the same visual lane.' },
      { title: 'Negative prompt', body: 'List distracting artifacts, unwanted styles or text elements to avoid.' },
      { title: 'Related image start', body: 'Use the related Pika image workflow only when one still must anchor composition.' },
    ],
    pricingCopy: {
      title: 'Pika 2.2 pricing at a glance',
      subtitle: 'Preset stylized clip totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'Up to 1080p',
    },
    meta: {
      title: 'Pika Text-to-Video Limits: 5s/10s, Pricing & Best Uses',
      description:
        'Check Pika 2.2 text-to-video limits, 5s/10s duration, 720p/1080p pricing and when to use another AI video model.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'ROUTE PIKA TEXT-TO-VIDEO',
      title: 'Pika 2.2 Text-to-Video',
      subtitle: 'Boucles sociales Text-to-Video avec mouvement stylisé, seeds, prompts négatifs et sortie silencieuse 5 s/10 s.',
      subtitleHighlights: ['Boucles sociales Text-to-Video', 'mouvement stylisé', 'sortie silencieuse 5 s/10 s'],
      paragraph:
        'Utilisez Pika 2.2 pour des animations silencieuses pilotées par prompt, des variantes rapides et des clips sociaux courts quand la direction créative est anime, BD, pixel, cartoon ou 3D playful.',
      primaryCta: { label: 'Générer avec Pika 2.2', href: '/app?engine=pika-text-to-video' },
      secondaryCta: { label: 'Voir les exemples', href: examplesHref('fr', 'pika') },
      quickLinks: [
        { label: 'Comparer vs Hailuo', href: compareHref('fr', 'pika-text-to-video', 'minimax-hailuo-02-text') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'pika-text-to-video-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Text-to-Video Pika 2.2',
      description: 'Clip social stylisé silencieux',
      renderLabel: 'Voir le rendu',
      badges: ['Silencieux', '10 s', '1080p'],
      altContext: 'boucle sociale text-to-video stylisée avec Pika 2.2',
    },
    features: [
      { title: 'Text-to-Video d’abord', body: 'Partez d’un prompt compact quand l’idée repose sur style, action et timing de boucle.', tone: 'reference' },
      { title: 'Mouvement stylisé', body: 'Créez du mouvement anime, BD, pixel, cartoon ou 3D playful.', tone: 'quality' },
      { title: 'Seeds', body: 'Réutilisez les variantes par seed quand une direction visuelle fonctionne.', tone: 'continuity' },
      { title: 'Prompts négatifs', body: 'Écartez les traits visuels indésirables pendant vos tests stylisés.', tone: 'reference' },
      { title: '5 s ou 10 s', body: 'Gardez des clips compacts pour loops, edits sociaux et tests de mouvement.', tone: 'duration' },
      { title: 'Sortie silencieuse', body: 'Ajoutez musique, voix et SFX après validation visuelle.', tone: 'audio' },
    ],
    decisionCards: [
      {
        title: 'Pika ou Hailuo ?',
        body: 'Utilisez Pika pour des boucles sociales stylisées et variantes par seed. Utilisez Hailuo 02 pour les tests mouvement/physique à coût réduit.',
        cta: { label: 'Comparer Pika vs Hailuo', href: compareHref('fr', 'pika-text-to-video', 'minimax-hailuo-02-text') },
      },
      {
        title: 'Construire un prompt stylisé ?',
        body: 'Verrouillez sujet, style, action et exclusions avant de tester des variantes par seed.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Besoin d’une route brouillon plus large ?',
        body: 'Comparez avec LTX 2.3 Fast quand vous voulez un moteur de draft plus général avant les routes de production.',
        cta: { label: 'Comparer Pika vs LTX 2.3 Fast', href: compareHref('fr', 'pika-text-to-video', 'ltx-2-3-fast') },
      },
    ],
    referenceWorkflows: [
      { title: 'Text-to-video', body: 'Écrivez sujet, action, famille de style et exclusions dans un prompt compact.' },
      { title: 'Ancres de style', body: 'Nommez direction artistique, palette et comportement de boucle plutôt qu’un setup chargé en références.' },
      { title: 'Variantes par seed', body: 'Gardez un seed utile et itérez les prompts dans la même voie visuelle.' },
      { title: 'Prompt négatif', body: 'Listez artefacts, styles ou éléments texte à éviter.' },
      { title: 'Départ image associé', body: 'Utilisez le workflow image Pika associé seulement si un still doit ancrer la composition.' },
    ],
    pricingCopy: {
      title: 'Prix Pika 2.2 en un coup d’œil',
      subtitle: 'Prix totaux de clips stylisés — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Jusqu’à 1080p',
    },
    meta: {
      title: 'Pika 2.2 Text-to-Video : tarifs, boucles silencieuses et exemples | MaxVideoAI',
      description:
        'Explorez Pika 2.2 Text-to-Video : tarifs, clips silencieux stylisés, boucles sociales, seeds, prompts négatifs et exemples sur MaxVideoAI.',
    },
  },
  es: {
    hero: {
      eyebrow: 'RUTA PIKA TEXT-TO-VIDEO',
      title: 'Pika 2.2 Text-to-Video',
      subtitle: 'Loops sociales Text-to-Video con movimiento estilizado, seeds, prompts negativos y salida sin audio de 5s/10s.',
      subtitleHighlights: ['Loops sociales Text-to-Video', 'movimiento estilizado', 'salida sin audio de 5s/10s'],
      paragraph:
        'Usa Pika 2.2 para animación estilizada sin audio guiada por prompt, variantes rápidas y clips sociales cortos cuando la dirección es anime, cómic, pixel, toon o 3D lúdico.',
      primaryCta: { label: 'Generar con Pika 2.2', href: '/app?engine=pika-text-to-video' },
      secondaryCta: { label: 'Ver ejemplos', href: examplesHref('es', 'pika') },
      quickLinks: [
        { label: 'Comparar vs Hailuo', href: compareHref('es', 'pika-text-to-video', 'minimax-hailuo-02-text') },
        { label: 'Ver precios', href: pricingHref('es', 'pika-text-to-video-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Text-to-Video Pika 2.2',
      description: 'Clip social estilizado sin audio',
      renderLabel: 'Ver resultado',
      badges: ['Sin audio', '10s', '1080p'],
      altContext: 'loop social text-to-video estilizado con Pika 2.2',
    },
    features: [
      { title: 'Text-to-Video primero', body: 'Empieza con un prompt compacto cuando la idea depende de estilo, acción y timing de loop.', tone: 'reference' },
      { title: 'Movimiento estilizado', body: 'Crea movimiento anime, cómic, pixel, toon o 3D lúdico.', tone: 'quality' },
      { title: 'Seeds', body: 'Reutiliza variantes por seed cuando una dirección visual empieza a funcionar.', tone: 'continuity' },
      { title: 'Prompts negativos', body: 'Excluye rasgos visuales no deseados mientras pruebas una dirección estilizada.', tone: 'reference' },
      { title: '5s o 10s', body: 'Mantén clips compactos para loops, ediciones sociales y pruebas de movimiento.', tone: 'duration' },
      { title: 'Salida sin audio', body: 'Agrega música, voz y SFX después de aprobar la parte visual.', tone: 'audio' },
    ],
    decisionCards: [
      {
        title: '¿Pika o Hailuo?',
        body: 'Usa Pika para loops sociales estilizados y variantes por seed. Usa Hailuo 02 para física y movimiento de bajo costo.',
        cta: { label: 'Comparar Pika vs Hailuo', href: compareHref('es', 'pika-text-to-video', 'minimax-hailuo-02-text') },
      },
      {
        title: '¿Armas un prompt estilizado?',
        body: 'Fija sujeto, estilo, acción y exclusiones antes de probar variantes con seeds.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: '¿Necesitas una ruta draft más amplia?',
        body: 'Compara con LTX 2.3 Fast cuando necesitas un motor de borrador más general antes de rutas de producción.',
        cta: { label: 'Comparar Pika vs LTX 2.3 Fast', href: compareHref('es', 'pika-text-to-video', 'ltx-2-3-fast') },
      },
    ],
    referenceWorkflows: [
      { title: 'Texto a video', body: 'Escribe sujeto, acción, familia visual y exclusiones en un prompt compacto.' },
      { title: 'Anclas de estilo', body: 'Nombra dirección artística, paleta y comportamiento del loop en vez de depender de demasiadas referencias.' },
      { title: 'Variantes por seed', body: 'Conserva un seed útil e itera prompts dentro de la misma línea visual.' },
      { title: 'Prompt negativo', body: 'Lista artefactos, estilos o texto no deseado para evitarlos.' },
      { title: 'Inicio con imagen relacionado', body: 'Usa el flujo de imagen de Pika solo cuando un still deba fijar la composición.' },
    ],
    pricingCopy: {
      title: 'Precios de Pika 2.2 de un vistazo',
      subtitle: 'Totales de clips estilizados. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Hasta 1080p',
    },
    meta: {
      title: 'Pika 2.2 Text-to-Video: precios, loops silenciosos y ejemplos | MaxVideoAI',
      description:
        'Explora Pika 2.2 Text-to-Video: precios, clips estilizados sin audio, loops sociales, seeds, prompts negativos y ejemplos en MaxVideoAI.',
    },
  },
};

const GPT_IMAGE_2_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'OPENAI IMAGE GENERATION MODEL',
      title: 'GPT Image 2',
      subtitle: 'Quality-first image generation for readable text, product stills and controlled edits.',
      subtitleHighlights: ['readable text', 'product stills', 'controlled edits'],
      paragraph:
        'Use GPT Image 2 when the still needs precise text, product-label fidelity, quality controls, custom sizes or mask-guided edits from reference images.',
      primaryCta: { label: 'Generate with GPT Image 2', href: '/app/image?engine=gpt-image-2' },
      secondaryCta: { label: 'View pricing', href: pricingHref('en', 'gpt-image-2-pricing') },
      quickLinks: [
        { label: 'Open image workspace', href: '/app/image?engine=gpt-image-2' },
        { label: 'View pricing', href: pricingHref('en', 'gpt-image-2-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'GPT Image 2 example',
      description: 'Text-heavy product still and controlled edit workflow',
      renderLabel: 'View image',
      badges: ['Text', 'Edits', '4K size'],
      altContext: 'GPT Image 2 product still with readable text',
    },
    features: [
      { title: 'Readable text', body: 'Useful for packaging, labels, UI-style layouts and editorial graphics.', tone: 'quality' },
      { title: 'Product stills', body: 'Build catalog-style shots with controlled lighting and composition.', tone: 'reference' },
      { title: 'Image edits', body: 'Upload references for prompt-led edits, with optional mask control.', tone: 'continuity' },
      { title: 'Custom sizes', body: 'Use presets or custom dimensions up to the exposed route limits.', tone: 'quality' },
      { title: 'Quality levels', body: 'Choose low, medium or high depending on cost and fidelity.', tone: 'price' },
      { title: 'Batch output', body: 'Generate up to 4 images when exploring variants.', tone: 'duration' },
    ],
    decisionCards: [
      {
        title: 'GPT Image 2 or Nano Banana 2?',
        body: 'Use GPT Image 2 for text-heavy stills and controlled edits. Use Nano Banana 2 for broader ratios and grounded Google image workflows.',
        cta: { label: 'View Nano Banana 2', href: modelsHref('en', 'nano-banana-2') },
      },
      {
        title: 'Working on product text?',
        body: 'Write the exact label hierarchy, lighting, camera angle and edit constraints before generating.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Need cleaner source control?',
        body: 'Prepare the product source, mask or exact text hierarchy first, then render or edit the final still in GPT Image 2.',
        cta: { label: 'Open GPT Image 2', href: '/app/image?engine=gpt-image-2' },
      },
    ],
    referenceWorkflows: [
      { title: 'Text-to-image', body: 'Specify subject, exact text, layout, lighting, lens and output size.' },
      { title: 'Image edit', body: 'Upload the source image and describe what should change and what must stay locked.' },
      { title: 'Mask-guided edit', body: 'Use a mask only when an edit should be constrained to a specific region.' },
      { title: 'Quality choice', body: 'Draft lower, then switch to high when typography or product detail matters.' },
      { title: 'Batch variants', body: 'Generate multiple images for composition exploration before selecting a final.' },
    ],
    pricingCopy: {
      title: 'GPT Image 2 pricing at a glance',
      subtitle: 'Preset image totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'Up to 4 images',
    },
    meta: {
      title: 'GPT Image 2: Pricing, Text Rendering & Editing | MaxVideoAI',
      description:
        'Explore GPT Image 2 pricing, readable text rendering, product stills, custom image sizes, reference edits and mask-guided image workflows on MaxVideoAI.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'MODÈLE IMAGE OPENAI',
      title: 'GPT Image 2',
      subtitle: 'Génération d’images orientée qualité pour texte lisible, packshots produit et retouches contrôlées.',
      subtitleHighlights: ['texte lisible', 'packshots produit', 'retouches contrôlées'],
      paragraph:
        'Utilisez GPT Image 2 quand l’image doit préserver du texte, des détails produit, des réglages qualité, des tailles personnalisées ou des retouches guidées par masque.',
      primaryCta: { label: 'Générer avec GPT Image 2', href: '/app/image?engine=gpt-image-2' },
      secondaryCta: { label: 'Voir les tarifs', href: pricingHref('fr', 'gpt-image-2-pricing') },
      quickLinks: [
        { label: 'Ouvrir l’espace image', href: '/app/image?engine=gpt-image-2' },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'gpt-image-2-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple GPT Image 2',
      description: 'Packshot avec texte et retouche contrôlée',
      renderLabel: 'Voir l’image',
      badges: ['Texte', 'Retouches', 'Format 4K'],
      altContext: 'packshot GPT Image 2 avec texte lisible',
    },
    features: [
      { title: 'Texte lisible', body: 'Utile pour packaging, labels, maquettes UI et visuels éditoriaux.', tone: 'quality' },
      { title: 'Packshots produit', body: 'Créez des images catalogue avec lumière et composition maîtrisées.', tone: 'reference' },
      { title: 'Retouches image', body: 'Chargez des références pour des modifications pilotées par prompt.', tone: 'continuity' },
      { title: 'Tailles personnalisées', body: 'Utilisez presets ou dimensions custom dans les limites exposées.', tone: 'quality' },
      { title: 'Niveaux qualité', body: 'Choisissez low, medium ou high selon coût et fidélité.', tone: 'price' },
      { title: 'Variantes', body: 'Générez jusqu’à 4 images pour explorer plusieurs compositions.', tone: 'duration' },
    ],
    decisionCards: [
      {
        title: 'GPT Image 2 ou Nano Banana 2 ?',
        body: 'Prenez GPT Image 2 pour texte et retouches contrôlées. Prenez Nano Banana 2 pour ratios plus larges et workflows Google guidés.',
        cta: { label: 'Voir Nano Banana 2', href: modelsHref('fr', 'nano-banana-2') },
      },
      {
        title: 'Travail sur texte produit ?',
        body: 'Décrivez hiérarchie de label, lumière, angle caméra et contraintes de retouche avant génération.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Besoin d’un meilleur contrôle source ?',
        body: 'Préparez le produit, le masque ou la hiérarchie texte, puis rendez ou retouchez le still final dans GPT Image 2.',
        cta: { label: 'Ouvrir GPT Image 2', href: '/app/image?engine=gpt-image-2' },
      },
    ],
    referenceWorkflows: [
      { title: 'Text-to-image', body: 'Précisez sujet, texte exact, layout, lumière, optique et taille de sortie.' },
      { title: 'Retouche image', body: 'Chargez l’image source et dites ce qui change, et ce qui reste verrouillé.' },
      { title: 'Masque', body: 'Utilisez un masque seulement quand la retouche doit rester dans une zone précise.' },
      { title: 'Choix qualité', body: 'Brouillonnez plus bas, puis passez en high pour typographie ou détail produit.' },
      { title: 'Variantes', body: 'Générez plusieurs images pour explorer la composition avant sélection.' },
    ],
    pricingCopy: {
      title: 'Prix GPT Image 2 en un coup d’œil',
      subtitle: 'Prix totaux par scénario image — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Jusqu’à 4 images',
    },
    meta: {
      title: 'GPT Image 2 : tarifs, texte lisible et retouche | MaxVideoAI',
      description:
        'Explorez GPT Image 2 : prix, texte lisible, packshots produit, tailles personnalisées, retouches par références et masques dans MaxVideoAI.',
    },
  },
  es: {
    hero: {
      eyebrow: 'MODELO DE IMAGEN OPENAI',
      title: 'GPT Image 2',
      subtitle: 'Generación de imagen enfocada en calidad para texto legible, producto y ediciones controladas.',
      subtitleHighlights: ['texto legible', 'producto', 'ediciones controladas'],
      paragraph:
        'Usa GPT Image 2 cuando el still necesita texto preciso, fidelidad de producto, controles de calidad, tamaños personalizados o ediciones guiadas por máscara.',
      primaryCta: { label: 'Generar con GPT Image 2', href: '/app/image?engine=gpt-image-2' },
      secondaryCta: { label: 'Ver precios', href: pricingHref('es', 'gpt-image-2-pricing') },
      quickLinks: [
        { label: 'Abrir espacio de imagen', href: '/app/image?engine=gpt-image-2' },
        { label: 'Ver precios', href: pricingHref('es', 'gpt-image-2-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo GPT Image 2',
      description: 'Imagen de producto con texto y edición controlada',
      renderLabel: 'Ver imagen',
      badges: ['Texto', 'Edición', 'Tamaño 4K'],
      altContext: 'imagen de producto GPT Image 2 con texto legible',
    },
    features: [
      { title: 'Texto legible', body: 'Útil para packaging, etiquetas, layouts tipo UI y gráficos editoriales.', tone: 'quality' },
      { title: 'Producto', body: 'Crea stills de catálogo con iluminación y composición controladas.', tone: 'reference' },
      { title: 'Edición de imagen', body: 'Sube referencias para cambios guiados por prompt y máscara opcional.', tone: 'continuity' },
      { title: 'Tamaños custom', body: 'Usa presets o dimensiones personalizadas dentro de los límites expuestos.', tone: 'quality' },
      { title: 'Niveles de calidad', body: 'Elige low, medium o high según costo y fidelidad.', tone: 'price' },
      { title: 'Variantes', body: 'Genera hasta 4 imágenes para explorar composiciones.', tone: 'duration' },
    ],
    decisionCards: [
      {
        title: '¿GPT Image 2 o Nano Banana 2?',
        body: 'Usa GPT Image 2 para texto y edición controlada. Usa Nano Banana 2 para ratios amplios y flujos Google con grounding.',
        cta: { label: 'Ver Nano Banana 2', href: modelsHref('es', 'nano-banana-2') },
      },
      {
        title: '¿Trabajas texto de producto?',
        body: 'Define jerarquía del label, luz, ángulo de cámara y restricciones de edición antes de generar.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: '¿Necesitas más control de fuente?',
        body: 'Prepara producto, máscara o jerarquía de texto, y luego genera o edita el still final en GPT Image 2.',
        cta: { label: 'Abrir GPT Image 2', href: '/app/image?engine=gpt-image-2' },
      },
    ],
    referenceWorkflows: [
      { title: 'Texto a imagen', body: 'Especifica sujeto, texto exacto, layout, luz, lente y tamaño de salida.' },
      { title: 'Edición de imagen', body: 'Sube la fuente y explica qué cambia y qué debe quedarse fijo.' },
      { title: 'Máscara', body: 'Usa máscara solo cuando la edición debe limitarse a una zona concreta.' },
      { title: 'Calidad', body: 'Borrador en calidad baja o media; usa high para texto o detalle de producto.' },
      { title: 'Variantes', body: 'Genera varias imágenes para explorar composición antes de elegir.' },
    ],
    pricingCopy: {
      title: 'Precios de GPT Image 2 de un vistazo',
      subtitle: 'Totales por escenario de imagen. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Hasta 4 imágenes',
    },
    meta: {
      title: 'GPT Image 2: precios, texto legible y edición | MaxVideoAI',
      description:
        'Explora GPT Image 2: precios, texto legible, producto, tamaños personalizados, ediciones con referencias y máscaras en MaxVideoAI.',
    },
  },
};

const NANO_BANANA_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'GOOGLE FAST IMAGE ROUTE',
      title: 'Nano Banana',
      subtitle: 'Fast still drafts, reference edits and batch image variants for lightweight visual exploration.',
      subtitleHighlights: ['Fast still drafts', 'reference edits', 'batch image variants'],
      paragraph:
        'Use Nano Banana as the low-friction Google image route for quick still concepts, simple reference edits and multi-image batches before moving finals to Pro or Nano Banana 2.',
      primaryCta: { label: 'Generate with Nano Banana', href: '/app/image?engine=nano-banana' },
      secondaryCta: { label: 'View pricing', href: pricingHref('en', 'nano-banana-pricing') },
      quickLinks: [
        { label: 'Open image workspace', href: '/app/image?engine=nano-banana' },
        { label: 'View pricing', href: pricingHref('en', 'nano-banana-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Nano Banana example',
      description: 'Fast still concept and edit route',
      renderLabel: 'View image',
      badges: ['Fast', 'Batch', 'Edit'],
      altContext: 'Nano Banana fast still image example',
    },
    features: [
      { title: 'Fast still drafts', body: 'Explore image ideas quickly before investing in final routes.', tone: 'price' },
      { title: 'Reference edits', body: 'Upload 1-4 images for prompt-led edits and remixes.', tone: 'reference' },
      { title: 'Batch variants', body: 'Generate multiple outputs from one prompt for visual exploration.', tone: 'duration' },
      { title: 'Broad ratios', body: 'Use common social, square, portrait and wide aspect ratios.', tone: 'quality' },
      { title: 'Low unit cost', body: 'Good for early moodboards and storyboard stills.', tone: 'price' },
      { title: 'Image workspace', body: 'Use the same MaxVideoAI wallet, prompts and history as the rest of the app.', tone: 'continuity' },
    ],
    decisionCards: [
      {
        title: 'Nano Banana or Nano Banana 2?',
        body: 'Use Nano Banana for cheaper fast batches. Use Nano Banana 2 for grounding, wider ratios and stronger edit controls.',
        cta: { label: 'View Nano Banana 2', href: modelsHref('en', 'nano-banana-2') },
      },
      {
        title: 'Batching quick variants?',
        body: 'Keep prompts short, change one visual variable at a time and batch several outputs.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Need higher-res campaign stills?',
        body: 'Move selected directions into Nano Banana Pro when text polish, campaign finish or higher-res output matters.',
        cta: { label: 'View Nano Banana Pro', href: modelsHref('en', 'nano-banana-pro') },
      },
    ],
    referenceWorkflows: [
      { title: 'Text-to-image', body: 'Describe the subject, style, aspect ratio and one clear composition target.' },
      { title: 'Image edit', body: 'Upload a reference and state what changes while preserving structure.' },
      { title: 'Batch variants', body: 'Run several images when exploring moodboards, thumbnails or storyboard stills.' },
      { title: 'Aspect ratio', body: 'Pick the delivery ratio before prompting so composition matches the final crop.' },
      { title: 'Upgrade path', body: 'Send winners to Nano Banana 2 or Pro when the still needs grounding or 4K polish.' },
    ],
    pricingCopy: {
      title: 'Nano Banana pricing at a glance',
      subtitle: 'Preset image totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'Up to 8 images',
    },
    meta: {
      title: 'Nano Banana: Pricing, Fast Image Drafts & Edits | MaxVideoAI',
      description:
        'Explore Nano Banana pricing, fast still drafts, reference image edits, batch variants and lightweight Google image workflows on MaxVideoAI.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'ROUTE IMAGE GOOGLE RAPIDE',
      title: 'Nano Banana',
      subtitle: 'Brouillons image rapides, retouches par référence et variantes en lot pour explorer vite.',
      subtitleHighlights: ['Brouillons image rapides', 'retouches par référence', 'variantes en lot'],
      paragraph:
        'Utilisez Nano Banana comme route Google légère pour concepts rapides, retouches simples par référence et lots d’images avant de finaliser dans Pro ou Nano Banana 2.',
      primaryCta: { label: 'Générer avec Nano Banana', href: '/app/image?engine=nano-banana' },
      secondaryCta: { label: 'Voir les tarifs', href: pricingHref('fr', 'nano-banana-pricing') },
      quickLinks: [
        { label: 'Ouvrir l’espace image', href: '/app/image?engine=nano-banana' },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'nano-banana-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Nano Banana',
      description: 'Concept image rapide et route de retouche',
      renderLabel: 'Voir l’image',
      badges: ['Rapide', 'Lot', 'Retouche'],
      altContext: 'exemple image rapide Nano Banana',
    },
    features: [
      { title: 'Brouillons rapides', body: 'Explorez des idées visuelles avant les routes finales.', tone: 'price' },
      { title: 'Retouches référence', body: 'Chargez 1 à 4 images pour remixer ou éditer.', tone: 'reference' },
      { title: 'Variantes en lot', body: 'Générez plusieurs sorties depuis un prompt.', tone: 'duration' },
      { title: 'Formats courants', body: 'Utilisez ratios sociaux, carré, portrait ou large.', tone: 'quality' },
      { title: 'Coût léger', body: 'Adapté aux moodboards et stills de storyboard.', tone: 'price' },
      { title: 'Workspace image', body: 'Même wallet, prompts et historique que le reste de MaxVideoAI.', tone: 'continuity' },
    ],
    decisionCards: [
      {
        title: 'Nano Banana ou Nano Banana 2 ?',
        body: 'Gardez Nano Banana pour les lots rapides moins chers. Passez à Nano Banana 2 pour grounding, ratios larges et contrôles plus forts.',
        cta: { label: 'Voir Nano Banana 2', href: modelsHref('fr', 'nano-banana-2') },
      },
      {
        title: 'Besoin de variantes rapides ?',
        body: 'Gardez un prompt court, changez une variable visuelle à la fois et lancez plusieurs sorties.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Besoin de visuels 4K ?',
        body: 'Passez les directions retenues dans Nano Banana Pro pour texte plus propre, finition campagne ou sortie 4K.',
        cta: { label: 'Voir Nano Banana Pro', href: modelsHref('fr', 'nano-banana-pro') },
      },
    ],
    referenceWorkflows: [
      { title: 'Text-to-image', body: 'Décrivez sujet, style, ratio et composition cible.' },
      { title: 'Retouche image', body: 'Chargez une référence et dites ce qui change tout en gardant la structure.' },
      { title: 'Variantes', body: 'Lancez plusieurs images pour moodboards, miniatures ou storyboards.' },
      { title: 'Ratio', body: 'Choisissez le format de livraison avant le prompt.' },
      { title: 'Passage final', body: 'Envoyez les pistes gagnantes vers Nano Banana 2 ou Pro.' },
    ],
    pricingCopy: {
      title: 'Prix Nano Banana en un coup d’œil',
      subtitle: 'Prix totaux par scénario image — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Jusqu’à 8 images',
    },
    meta: {
      title: 'Nano Banana : tarifs, brouillons image rapides et retouches | MaxVideoAI',
      description:
        'Explorez Nano Banana : prix, brouillons image rapides, retouches par références, variantes en lot et workflows Google légers dans MaxVideoAI.',
    },
  },
  es: {
    hero: {
      eyebrow: 'RUTA GOOGLE DE IMAGEN RÁPIDA',
      title: 'Nano Banana',
      subtitle: 'Borradores rápidos de imagen, ediciones con referencia y variantes en lote para explorar visuales.',
      subtitleHighlights: ['Borradores rápidos de imagen', 'ediciones con referencia', 'variantes en lote'],
      paragraph:
        'Usa Nano Banana como ruta Google ligera para conceptos rápidos, ediciones simples con referencia y lotes de imágenes antes de pasar finales a Pro o Nano Banana 2.',
      primaryCta: { label: 'Generar con Nano Banana', href: '/app/image?engine=nano-banana' },
      secondaryCta: { label: 'Ver precios', href: pricingHref('es', 'nano-banana-pricing') },
      quickLinks: [
        { label: 'Abrir espacio de imagen', href: '/app/image?engine=nano-banana' },
        { label: 'Ver precios', href: pricingHref('es', 'nano-banana-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Nano Banana',
      description: 'Concepto rápido y ruta de edición',
      renderLabel: 'Ver imagen',
      badges: ['Rápido', 'Lote', 'Edición'],
      altContext: 'ejemplo de imagen rápida con Nano Banana',
    },
    features: [
      { title: 'Borradores rápidos', body: 'Explora ideas visuales antes de invertir en rutas finales.', tone: 'price' },
      { title: 'Ediciones con referencia', body: 'Sube 1 a 4 imágenes para remix o edición.', tone: 'reference' },
      { title: 'Variantes en lote', body: 'Genera varias salidas desde un mismo prompt.', tone: 'duration' },
      { title: 'Ratios comunes', body: 'Usa formatos sociales, cuadrado, retrato o wide.', tone: 'quality' },
      { title: 'Costo ligero', body: 'Bueno para moodboards y stills de storyboard.', tone: 'price' },
      { title: 'Workspace de imagen', body: 'Mismo wallet, prompts e historial que el resto de MaxVideoAI.', tone: 'continuity' },
    ],
    decisionCards: [
      {
        title: '¿Nano Banana o Nano Banana 2?',
        body: 'Usa Nano Banana para lotes rápidos y baratos. Usa Nano Banana 2 para grounding, ratios amplios y mejores controles.',
        cta: { label: 'Ver Nano Banana 2', href: modelsHref('es', 'nano-banana-2') },
      },
      {
        title: '¿Necesitas variantes rápidas?',
        body: 'Mantén el prompt corto, cambia una variable visual por vez y genera varias salidas.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: '¿Necesitas piezas 4K?',
        body: 'Pasa las direcciones elegidas a Nano Banana Pro para texto más limpio, acabado de campaña o salida 4K.',
        cta: { label: 'Ver Nano Banana Pro', href: modelsHref('es', 'nano-banana-pro') },
      },
    ],
    referenceWorkflows: [
      { title: 'Texto a imagen', body: 'Describe sujeto, estilo, ratio y composición objetivo.' },
      { title: 'Edición de imagen', body: 'Sube una referencia y explica qué cambia y qué se conserva.' },
      { title: 'Variantes', body: 'Genera varias imágenes para moodboards, miniaturas o storyboard.' },
      { title: 'Ratio', body: 'Elige el formato final antes de escribir el prompt.' },
      { title: 'Ruta final', body: 'Lleva las mejores opciones a Nano Banana 2 o Pro.' },
    ],
    pricingCopy: {
      title: 'Precios de Nano Banana de un vistazo',
      subtitle: 'Totales por escenario de imagen. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Hasta 8 imágenes',
    },
    meta: {
      title: 'Nano Banana: precios, borradores rápidos y edición | MaxVideoAI',
      description:
        'Explora Nano Banana: precios, borradores rápidos de imagen, ediciones con referencia, variantes en lote y flujos Google ligeros en MaxVideoAI.',
    },
  },
};

const NANO_BANANA_2_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'GOOGLE GROUNDED IMAGE MODEL',
      title: 'Nano Banana 2',
      subtitle: 'Grounded image generation, wide aspect ratios and multi-reference edits for production-ready stills.',
      subtitleHighlights: ['Grounded image generation', 'wide aspect ratios', 'multi-reference edits'],
      paragraph:
        'Use Nano Banana 2 when you need 0.5K to 4K stills, optional web grounding, wider aspect ratios and larger reference sets for controlled image generation or edits.',
      primaryCta: { label: 'Generate with Nano Banana 2', href: '/app/image?engine=nano-banana-2' },
      secondaryCta: { label: 'View pricing', href: pricingHref('en', 'nano-banana-2-pricing') },
      quickLinks: [
        { label: 'Open image workspace', href: '/app/image?engine=nano-banana-2' },
        { label: 'View pricing', href: pricingHref('en', 'nano-banana-2-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Nano Banana 2 example',
      description: 'Grounded still generation and edit workflow',
      renderLabel: 'View image',
      badges: ['Grounded', '4K', 'References'],
      altContext: 'Nano Banana 2 grounded image generation example',
    },
    features: [
      { title: 'Grounded prompts', body: 'Use optional web grounding when current visual context matters.', tone: 'reference' },
      { title: '0.5K to 4K', body: 'Draft cheaply, then move selected stills up to higher resolution.', tone: 'quality' },
      { title: 'Wide ratios', body: 'Support common, panoramic and extreme aspect ratios.', tone: 'duration' },
      { title: 'Multi-reference edits', body: 'Use larger reference sets for product, moodboard or layout consistency.', tone: 'continuity' },
      { title: 'Seeds', body: 'Reuse a seed to iterate around the same composition.', tone: 'reference' },
      { title: 'Pay-as-you-go', body: 'See exact live price before you generate.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Nano Banana 2 or Pro?',
        body: 'Use Nano Banana 2 for grounding, ratios and cost control. Use Pro when stronger text polish and campaign delivery matter more.',
        cta: { label: 'View Nano Banana Pro', href: modelsHref('en', 'nano-banana-pro') },
      },
      {
        title: 'Using web grounding?',
        body: 'Only enable web search when the brief needs current visual context; keep owned brand references explicit.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Need text-heavy OpenAI stills?',
        body: 'Compare your brief with GPT Image 2 when label accuracy and controlled mask edits are the primary job.',
        cta: { label: 'View GPT Image 2', href: modelsHref('en', 'gpt-image-2') },
      },
    ],
    referenceWorkflows: [
      { title: 'Text-to-image', body: 'Set subject, ratio, resolution, style and whether the prompt needs grounding.' },
      { title: 'Image edit', body: 'Use references to preserve product shape, layout, materials or palette.' },
      { title: 'Web grounding', body: 'Enable only when current context improves the image brief.' },
      { title: 'Extreme ratios', body: 'Design the composition for panoramic or vertical formats before generating.' },
      { title: 'Resolution ladder', body: 'Use 0.5K or 1K for drafts, then 2K or 4K for selected finals.' },
    ],
    pricingCopy: {
      title: 'Nano Banana 2 pricing at a glance',
      subtitle: 'Preset image totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'Up to 4K',
    },
    meta: {
      title: 'Nano Banana 2: Pricing, Grounded Images & Editing | MaxVideoAI',
      description:
        'Explore Nano Banana 2 pricing, grounded image generation, 0.5K to 4K outputs, wide aspect ratios, multi-reference edits and web-grounded prompts.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'MODÈLE IMAGE GOOGLE GUIDÉ',
      title: 'Nano Banana 2',
      subtitle: 'Génération d’images guidée, ratios larges et retouches multi-références pour des stills de production.',
      subtitleHighlights: ['Génération d’images guidée', 'ratios larges', 'retouches multi-références'],
      paragraph:
        'Utilisez Nano Banana 2 pour des stills 0.5K à 4K, grounding web optionnel, ratios étendus et jeux de références plus larges pour générer ou éditer avec contrôle.',
      primaryCta: { label: 'Générer avec Nano Banana 2', href: '/app/image?engine=nano-banana-2' },
      secondaryCta: { label: 'Voir les tarifs', href: pricingHref('fr', 'nano-banana-2-pricing') },
      quickLinks: [
        { label: 'Ouvrir l’espace image', href: '/app/image?engine=nano-banana-2' },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'nano-banana-2-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Nano Banana 2',
      description: 'Génération guidée et retouche image',
      renderLabel: 'Voir l’image',
      badges: ['Guidé', '4K', 'Références'],
      altContext: 'exemple de génération image guidée avec Nano Banana 2',
    },
    features: [
      { title: 'Prompts guidés', body: 'Activez le grounding web quand le contexte visuel actuel compte.', tone: 'reference' },
      { title: '0.5K à 4K', body: 'Brouillonnez à bas coût puis montez les pistes retenues.', tone: 'quality' },
      { title: 'Ratios larges', body: 'Formats courants, panoramiques et extrêmes.', tone: 'duration' },
      { title: 'Multi-références', body: 'Utilisez plus de références pour produit, moodboard ou layout.', tone: 'continuity' },
      { title: 'Seeds', body: 'Réutilisez un seed pour itérer autour d’une composition.', tone: 'reference' },
      { title: 'Paiement à l’usage', body: 'Prix exact affiché avant génération.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Nano Banana 2 ou Pro ?',
        body: 'Prenez Nano Banana 2 pour grounding, ratios et coût maîtrisé. Prenez Pro pour un texte plus propre et une livraison campagne.',
        cta: { label: 'Voir Nano Banana Pro', href: modelsHref('fr', 'nano-banana-pro') },
      },
      {
        title: 'Utiliser le grounding web ?',
        body: 'Activez la recherche web seulement si le brief dépend d’un contexte visuel récent; gardez vos références de marque explicites.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Besoin de texte OpenAI ?',
        body: 'Regardez GPT Image 2 quand précision des labels et retouches par masque sont prioritaires.',
        cta: { label: 'Voir GPT Image 2', href: modelsHref('fr', 'gpt-image-2') },
      },
    ],
    referenceWorkflows: [
      { title: 'Text-to-image', body: 'Définissez sujet, ratio, résolution, style et besoin éventuel de grounding.' },
      { title: 'Retouche image', body: 'Utilisez les références pour préserver forme produit, layout, matière ou palette.' },
      { title: 'Grounding web', body: 'Activez-le seulement si le contexte actuel améliore le brief.' },
      { title: 'Ratios extrêmes', body: 'Pensez la composition pour panoramique ou vertical avant génération.' },
      { title: 'Échelle résolution', body: '0.5K ou 1K pour brouillons, puis 2K ou 4K pour les finales.' },
    ],
    pricingCopy: {
      title: 'Prix Nano Banana 2 en un coup d’œil',
      subtitle: 'Prix totaux par scénario image — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Jusqu’à 4K',
    },
    meta: {
      title: 'Nano Banana 2 : tarifs, images guidées et retouche | MaxVideoAI',
      description:
        'Explorez Nano Banana 2 : prix, génération guidée, sorties 0.5K à 4K, ratios larges, retouches multi-références et grounding web.',
    },
  },
  es: {
    hero: {
      eyebrow: 'MODELO GOOGLE DE IMAGEN GUIADA',
      title: 'Nano Banana 2',
      subtitle: 'Generación de imagen guiada, ratios amplios y ediciones multi-referencia para stills de producción.',
      subtitleHighlights: ['Generación de imagen guiada', 'ratios amplios', 'ediciones multi-referencia'],
      paragraph:
        'Usa Nano Banana 2 para stills de 0.5K a 4K, grounding web opcional, ratios amplios y sets de referencia más grandes para generar o editar con control.',
      primaryCta: { label: 'Generar con Nano Banana 2', href: '/app/image?engine=nano-banana-2' },
      secondaryCta: { label: 'Ver precios', href: pricingHref('es', 'nano-banana-2-pricing') },
      quickLinks: [
        { label: 'Abrir espacio de imagen', href: '/app/image?engine=nano-banana-2' },
        { label: 'Ver precios', href: pricingHref('es', 'nano-banana-2-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Nano Banana 2',
      description: 'Generación guiada y edición de imagen',
      renderLabel: 'Ver imagen',
      badges: ['Guiado', '4K', 'Referencias'],
      altContext: 'ejemplo de generación de imagen guiada con Nano Banana 2',
    },
    features: [
      { title: 'Prompts guiados', body: 'Activa web grounding cuando el contexto visual actual importa.', tone: 'reference' },
      { title: '0.5K a 4K', body: 'Borrador barato y subida de resolución para finales seleccionados.', tone: 'quality' },
      { title: 'Ratios amplios', body: 'Formatos comunes, panorámicos y extremos.', tone: 'duration' },
      { title: 'Multi-referencia', body: 'Usa más referencias para producto, moodboard o layout.', tone: 'continuity' },
      { title: 'Seeds', body: 'Reutiliza un seed para iterar sobre la misma composición.', tone: 'reference' },
      { title: 'Pago por uso', body: 'Ve el precio exacto antes de generar.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '¿Nano Banana 2 o Pro?',
        body: 'Usa Nano Banana 2 para grounding, ratios y control de costo. Usa Pro cuando pesan texto más limpio y entrega de campaña.',
        cta: { label: 'Ver Nano Banana Pro', href: modelsHref('es', 'nano-banana-pro') },
      },
      {
        title: '¿Usas web grounding?',
        body: 'Activa búsqueda web solo si el brief necesita contexto visual reciente; mantén explícitas tus referencias de marca.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: '¿Necesitas texto con OpenAI?',
        body: 'Revisa GPT Image 2 cuando la precisión de labels y las ediciones con máscara son el trabajo principal.',
        cta: { label: 'Ver GPT Image 2', href: modelsHref('es', 'gpt-image-2') },
      },
    ],
    referenceWorkflows: [
      { title: 'Texto a imagen', body: 'Define sujeto, ratio, resolución, estilo y si hace falta grounding.' },
      { title: 'Edición de imagen', body: 'Usa referencias para preservar forma de producto, layout, materiales o paleta.' },
      { title: 'Web grounding', body: 'Actívalo solo cuando el contexto actual mejore el brief.' },
      { title: 'Ratios extremos', body: 'Diseña la composición para panorámico o vertical antes de generar.' },
      { title: 'Escalera de resolución', body: '0.5K o 1K para borradores; 2K o 4K para finales.' },
    ],
    pricingCopy: {
      title: 'Precios de Nano Banana 2 de un vistazo',
      subtitle: 'Totales por escenario de imagen. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Hasta 4K',
    },
    meta: {
      title: 'Nano Banana 2: precios, imágenes guiadas y edición | MaxVideoAI',
      description:
        'Explora Nano Banana 2: precios, generación guiada, salidas 0.5K a 4K, ratios amplios, ediciones multi-referencia y web grounding.',
    },
  },
};

const NANO_BANANA_PRO_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'GOOGLE PRO IMAGE MODEL',
      title: 'Nano Banana Pro',
      subtitle: '4K campaign stills, typography-focused edits and multi-image references for polished visual assets.',
      subtitleHighlights: ['4K campaign stills', 'typography-focused edits', 'multi-image references'],
      paragraph:
        'Use Nano Banana Pro when a still needs stronger typography, campaign polish, 2K/4K delivery and reference-led edits for brand, product or launch visuals.',
      primaryCta: { label: 'Generate with Nano Banana Pro', href: '/app/image?engine=nano-banana-pro' },
      secondaryCta: { label: 'View pricing', href: pricingHref('en', 'nano-banana-pro-pricing') },
      quickLinks: [
        { label: 'Open image workspace', href: '/app/image?engine=nano-banana-pro' },
        { label: 'View pricing', href: pricingHref('en', 'nano-banana-pro-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Nano Banana Pro example',
      description: '4K campaign still and typography workflow',
      renderLabel: 'View image',
      badges: ['2K/4K', 'Typography', 'References'],
      altContext: 'Nano Banana Pro campaign image with typography',
    },
    features: [
      { title: '4K campaign stills', body: 'Render higher-resolution stills for launch and client-facing assets.', tone: 'quality' },
      { title: 'Typography focus', body: 'Use explicit text hierarchy and layout cues for readable campaign graphics.', tone: 'reference' },
      { title: 'Reference edits', body: 'Upload references for wardrobe, product, layout or style continuity.', tone: 'continuity' },
      { title: 'Seeds', body: 'Lock randomness while iterating on the same framing.', tone: 'reference' },
      { title: '2K first', body: 'Draft at 2K before paying for 4K finals.', tone: 'price' },
      { title: 'Image workspace', body: 'Generate and edit still assets without leaving MaxVideoAI.', tone: 'duration' },
    ],
    decisionCards: [
      {
        title: 'Pro or Nano Banana 2?',
        body: 'Use Pro for 4K campaign polish and typography. Use Nano Banana 2 for grounding, wider ratios and lower-cost drafts.',
        cta: { label: 'View Nano Banana 2', href: modelsHref('en', 'nano-banana-2') },
      },
      {
        title: 'Working with typography?',
        body: 'Name the exact copy, hierarchy, spacing and surface where the text should appear.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Need cheaper quick variants?',
        body: 'Use Nano Banana for lightweight batches before moving a selected direction into Pro.',
        cta: { label: 'View Nano Banana', href: modelsHref('en', 'nano-banana') },
      },
    ],
    referenceWorkflows: [
      { title: 'Campaign still', body: 'Define product, layout, copy, lighting and delivery resolution in one prompt.' },
      { title: 'Reference edit', body: 'Upload refs for product identity, wardrobe, background, palette or typography direction.' },
      { title: '2K to 4K', body: 'Validate composition at 2K, then rerun at 4K for final assets.' },
      { title: 'Seed iteration', body: 'Reuse seed and adjust only one prompt variable per pass.' },
      { title: 'Brand safety', body: 'Use owned marks and original characters; avoid protected IP and celebrity likeness.' },
    ],
    pricingCopy: {
      title: 'Nano Banana Pro pricing at a glance',
      subtitle: 'Preset image totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'Up to 4K',
    },
    meta: {
      title: 'Nano Banana Pro: Pricing, 4K Images & Typography | MaxVideoAI',
      description:
        'Explore Nano Banana Pro pricing, 2K and 4K campaign stills, typography-focused image generation, reference edits and brand asset workflows.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'MODÈLE IMAGE GOOGLE PRO',
      title: 'Nano Banana Pro',
      subtitle: 'Visuels campagne 4K, retouches orientées typographie et références multiples pour assets finalisés.',
      subtitleHighlights: ['Visuels campagne 4K', 'retouches orientées typographie', 'références multiples'],
      paragraph:
        'Utilisez Nano Banana Pro quand une image doit porter une typographie plus fiable, une finition campagne, une sortie 2K/4K et des retouches guidées par références.',
      primaryCta: { label: 'Générer avec Nano Banana Pro', href: '/app/image?engine=nano-banana-pro' },
      secondaryCta: { label: 'Voir les tarifs', href: pricingHref('fr', 'nano-banana-pro-pricing') },
      quickLinks: [
        { label: 'Ouvrir l’espace image', href: '/app/image?engine=nano-banana-pro' },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'nano-banana-pro-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Nano Banana Pro',
      description: 'Visuel 4K et workflow typographie',
      renderLabel: 'Voir l’image',
      badges: ['2K/4K', 'Typographie', 'Références'],
      altContext: 'image campagne Nano Banana Pro avec typographie',
    },
    features: [
      { title: 'Visuels 4K', body: 'Rendez des stills haute résolution pour lancements et assets client.', tone: 'quality' },
      { title: 'Typographie', body: 'Décrivez hiérarchie de texte, placement et layout.', tone: 'reference' },
      { title: 'Retouches référence', body: 'Chargez des refs pour produit, tenue, décor ou style.', tone: 'continuity' },
      { title: 'Seeds', body: 'Verrouillez l’aléatoire pendant les itérations.', tone: 'reference' },
      { title: '2K d’abord', body: 'Validez en 2K avant de payer une finale 4K.', tone: 'price' },
      { title: 'Workspace image', body: 'Générez et éditez vos assets dans MaxVideoAI.', tone: 'duration' },
    ],
    decisionCards: [
      {
        title: 'Pro ou Nano Banana 2 ?',
        body: 'Prenez Pro pour la finition 4K et la typographie. Prenez Nano Banana 2 pour grounding, ratios larges et brouillons moins chers.',
        cta: { label: 'Voir Nano Banana 2', href: modelsHref('fr', 'nano-banana-2') },
      },
      {
        title: 'Travail typographique ?',
        body: 'Nommez le texte exact, sa hiérarchie, son espacement et le support où il apparaît.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
      {
        title: 'Besoin de variantes moins chères ?',
        body: 'Utilisez Nano Banana pour les lots rapides avant de finaliser une piste dans Pro.',
        cta: { label: 'Voir Nano Banana', href: modelsHref('fr', 'nano-banana') },
      },
    ],
    referenceWorkflows: [
      { title: 'Visuel campagne', body: 'Définissez produit, layout, texte, lumière et résolution de livraison.' },
      { title: 'Retouche référence', body: 'Chargez des refs pour identité produit, tenue, décor, palette ou typo.' },
      { title: '2K vers 4K', body: 'Validez la composition en 2K, puis relancez en 4K.' },
      { title: 'Itération par seed', body: 'Réutilisez le seed et changez une seule variable par passe.' },
      { title: 'Sécurité marque', body: 'Utilisez vos propres marques et personnages; évitez IP protégée et célébrités.' },
    ],
    pricingCopy: {
      title: 'Prix Nano Banana Pro en un coup d’œil',
      subtitle: 'Prix totaux par scénario image — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Jusqu’à 4K',
    },
    meta: {
      title: 'Nano Banana Pro : tarifs, images 4K et typographie | MaxVideoAI',
      description:
        'Explorez Nano Banana Pro : prix, visuels campagne 2K/4K, génération typographique, retouches par références et workflows brand assets.',
    },
  },
  es: {
    hero: {
      eyebrow: 'MODELO GOOGLE PRO DE IMAGEN',
      title: 'Nano Banana Pro',
      subtitle: 'Stills de campaña 4K, ediciones enfocadas en tipografía y multi-referencia para assets pulidos.',
      subtitleHighlights: ['Stills de campaña 4K', 'ediciones enfocadas en tipografía', 'multi-referencia'],
      paragraph:
        'Usa Nano Banana Pro cuando una imagen necesita tipografía más fuerte, acabado de campaña, entrega 2K/4K y ediciones guiadas por referencias.',
      primaryCta: { label: 'Generar con Nano Banana Pro', href: '/app/image?engine=nano-banana-pro' },
      secondaryCta: { label: 'Ver precios', href: pricingHref('es', 'nano-banana-pro-pricing') },
      quickLinks: [
        { label: 'Abrir espacio de imagen', href: '/app/image?engine=nano-banana-pro' },
        { label: 'Ver precios', href: pricingHref('es', 'nano-banana-pro-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Nano Banana Pro',
      description: 'Still 4K y flujo de tipografía',
      renderLabel: 'Ver imagen',
      badges: ['2K/4K', 'Tipografía', 'Referencias'],
      altContext: 'imagen de campaña Nano Banana Pro con tipografía',
    },
    features: [
      { title: 'Stills 4K', body: 'Renderiza imágenes de mayor resolución para lanzamientos y assets de cliente.', tone: 'quality' },
      { title: 'Tipografía', body: 'Define jerarquía de texto, ubicación y layout.', tone: 'reference' },
      { title: 'Ediciones con referencia', body: 'Sube refs para producto, vestuario, fondo o estilo.', tone: 'continuity' },
      { title: 'Seeds', body: 'Fija el azar mientras iteras sobre el mismo encuadre.', tone: 'reference' },
      { title: 'Primero 2K', body: 'Valida en 2K antes de pagar una final 4K.', tone: 'price' },
      { title: 'Workspace de imagen', body: 'Genera y edita assets dentro de MaxVideoAI.', tone: 'duration' },
    ],
    decisionCards: [
      {
        title: '¿Pro o Nano Banana 2?',
        body: 'Usa Pro para acabado 4K y tipografía. Usa Nano Banana 2 para grounding, ratios amplios y borradores más baratos.',
        cta: { label: 'Ver Nano Banana 2', href: modelsHref('es', 'nano-banana-2') },
      },
      {
        title: '¿Trabajas con tipografía?',
        body: 'Nombra el texto exacto, jerarquía, espaciado y superficie donde debe aparecer.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
      {
        title: '¿Necesitas variantes más baratas?',
        body: 'Usa Nano Banana para lotes rápidos antes de mover una dirección seleccionada a Pro.',
        cta: { label: 'Ver Nano Banana', href: modelsHref('es', 'nano-banana') },
      },
    ],
    referenceWorkflows: [
      { title: 'Still de campaña', body: 'Define producto, layout, texto, luz y resolución de entrega.' },
      { title: 'Edición con referencia', body: 'Sube refs para identidad de producto, vestuario, fondo, paleta o tipografía.' },
      { title: '2K a 4K', body: 'Valida composición en 2K y relanza en 4K para finales.' },
      { title: 'Iteración por seed', body: 'Reutiliza seed y cambia solo una variable por pasada.' },
      { title: 'Seguridad de marca', body: 'Usa marcas propias y personajes originales; evita IP protegida y celebridades.' },
    ],
    pricingCopy: {
      title: 'Precios de Nano Banana Pro de un vistazo',
      subtitle: 'Totales por escenario de imagen. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Hasta 4K',
    },
    meta: {
      title: 'Nano Banana Pro: precios, imágenes 4K y tipografía | MaxVideoAI',
      description:
        'Explora Nano Banana Pro: precios, stills 2K/4K de campaña, tipografía, ediciones con referencia y workflows de assets de marca.',
    },
  },
};

export const ADDITIONAL_TEMPLATE_COPY = {
  'gpt-image-2': GPT_IMAGE_2_COPY,
  'happy-horse-1-0': HAPPY_HORSE_10_COPY,
  'happy-horse-1-1': HAPPY_HORSE_11_COPY,
  'kling-2-5-turbo': KLING_25_TURBO_COPY,
  'kling-2-6-pro': KLING_26_PRO_COPY,
  'kling-3-4k': KLING_3_4K_COPY,
  'kling-3-standard': KLING_3_STANDARD_COPY,
  'kling-o3-4k': KLING_O3_4K_COPY,
  'kling-o3-pro': KLING_O3_PRO_COPY,
  'kling-o3-standard': KLING_O3_STANDARD_COPY,
  'luma-ray-2': LUMA_RAY_2_COPY,
  'luma-ray-2-flash': LUMA_RAY_2_FLASH_COPY,
  'luma-ray-3-2': LUMA_RAY_32_COPY,
  'luma-uni-1': LUMA_UNI_1_COPY,
  'luma-uni-1-max': LUMA_UNI_1_MAX_COPY,
  'ltx-2': LTX_2_COPY,
  'ltx-2-fast': LTX_2_FAST_COPY,
  'ltx-2-3-pro': LTX_23_PRO_COPY,
  'minimax-hailuo-02-text': MINIMAX_HAILUO_02_COPY,
  'nano-banana': NANO_BANANA_COPY,
  'nano-banana-2': NANO_BANANA_2_COPY,
  'nano-banana-pro': NANO_BANANA_PRO_COPY,
  'pika-text-to-video': PIKA_TEXT_TO_VIDEO_COPY,
  'seedance-1-5-pro': SEEDANCE_15_PRO_COPY,
  'sora-2': SORA_2_COPY,
  'sora-2-pro': SORA_2_PRO_COPY,
  'veo-3-1-fast': VEO_31_FAST_COPY,
  'veo-3-1-lite': VEO_31_LITE_COPY,
  'wan-2-5': WAN_25_COPY,
  'wan-2-6': WAN_26_COPY,
} satisfies Record<string, LocalizedTemplateCopy>;
