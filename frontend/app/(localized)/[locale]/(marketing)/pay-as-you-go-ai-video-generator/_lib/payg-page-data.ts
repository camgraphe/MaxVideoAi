import type { AppLocale } from '@/i18n/locales';
import {
  buildPricingHubData,
  type PricingHubData,
  type VideoPricePresetId,
  type VideoPricingRow,
} from '../../pricing/_lib/pricingHubData';

export const PAYG_PAGE_PATH = '/pay-as-you-go-ai-video-generator';

const MODEL_FAMILIES = ['seedance', 'kling', 'veo', 'happy-horse', 'seedance-mini', 'ltx', 'wan'] as const;
const PRIMARY_PRICE_PRESETS: readonly VideoPricePresetId[] = ['5s-720p', '8s-1080p', '10s-1080p'];
const MODEL_FAMILY_PREFERRED_IDS: Record<(typeof MODEL_FAMILIES)[number], readonly string[]> = {
  seedance: ['seedance-2-0', 'seedance-2-0-fast', 'seedance-2-0-mini'],
  'happy-horse': ['happy-horse-1-1', 'happy-horse-1-0'],
  'seedance-mini': ['seedance-2-0-mini'],
  kling: ['kling-3-pro', 'kling-3-standard', 'kling-2-5-turbo'],
  veo: ['veo-3-1', 'veo-3-1-fast', 'veo-3-1-lite'],
  ltx: ['ltx-2-3-fast', 'ltx-2-3', 'ltx-2-fast'],
  wan: ['wan-2-6', 'wan-2-5'],
};
const PAYG_COMPARE_ALLOWED_MODEL_IDS = new Set([
  ...Object.values(MODEL_FAMILY_PREFERRED_IDS).flat(),
  'ltx-2-3-pro',
]);
const PAYG_COMPARE_CANONICAL_HREFS: Record<string, string> = {
  '/ai-video-engines/veo-3-1-vs-kling-3-pro': '/ai-video-engines/kling-3-pro-vs-veo-3-1',
};

const PRICE_LOOKUP_CONFIGS = [
  {
    id: 'seedance-2-0',
    query: 'seedance 2 price',
    title: 'Seedance 2.0 price lookup',
    body: 'Start here for the current all-around model: strong text-to-video, image references, native audio options, and a quote before rendering.',
    presetId: '5s-720p' satisfies VideoPricePresetId,
  },
  {
    id: 'kling-3-pro',
    query: 'kling 3 pro price',
    title: 'Kling 3 Pro price lookup',
    body: 'A solid route for controlled motion, camera moves, product shots, and image-to-video tests without a monthly plan.',
    presetId: '8s-1080p' satisfies VideoPricePresetId,
  },
  {
    id: 'veo-3-1',
    query: 'veo 3.1 price',
    title: 'Veo 3.1 price lookup',
    body: 'Use Google Veo when cinematic prompt interpretation, Google video quality, or premium visual polish matters more than draft cost.',
    presetId: '8s-1080p' satisfies VideoPricePresetId,
  },
  {
    id: 'happy-horse-1-1',
    query: 'happy horse 1.1 price',
    title: 'Happy Horse 1.1 price lookup',
    body: 'Check Happy Horse 1.1 when Alibaba video output, references, or a different visual feel may beat the defaults.',
    presetId: '5s-720p' satisfies VideoPricePresetId,
  },
  {
    id: 'seedance-2-0-mini',
    query: 'seedance 2 mini price',
    title: 'Seedance 2.0 Mini price lookup',
    body: 'Use Seedance 2 Mini for lighter multimodal tests, shorter iterations, and lower-friction checks before moving to the main Seedance 2 route.',
    presetId: '5s-720p' satisfies VideoPricePresetId,
  },
  {
    id: 'ltx-2-3-fast',
    query: 'ltx 2.3 pricing',
    title: 'LTX 2.3 Fast price lookup',
    body: 'Use LTX 2.3 Fast as a strong, efficient option for drafts, prompt iteration, and budget-aware production planning.',
    presetId: '8s-1080p' satisfies VideoPricePresetId,
  },
] as const;

type PriceLookupId = (typeof PRICE_LOOKUP_CONFIGS)[number]['id'];

const PRICE_LOOKUP_COPY: Record<Exclude<AppLocale, 'en'>, Record<PriceLookupId, { query: string; title: string; body: string }>> = {
  es: {
    'seedance-2-0': { query: 'precio de Seedance 2', title: 'Consulta el precio de Seedance 2.0', body: 'Empieza aquí si buscas un modelo versátil: texto a video, referencias de imagen, opciones de audio nativo y cotización antes del render.' },
    'kling-3-pro': { query: 'precio de Kling 3 Pro', title: 'Consulta el precio de Kling 3 Pro', body: 'Una opción sólida para controlar el movimiento, trabajar movimientos de cámara, crear tomas de producto y probar imagen a video sin un plan mensual.' },
    'veo-3-1': { query: 'precio de Veo 3.1', title: 'Consulta el precio de Veo 3.1', body: 'Elige Google Veo cuando la interpretación cinematográfica del prompt, la calidad de Google o el acabado premium importen más que el costo del borrador.' },
    'happy-horse-1-1': { query: 'precio de Happy Horse 1.1', title: 'Consulta el precio de Happy Horse 1.1', body: 'Prueba Happy Horse 1.1 cuando quieras comparar el resultado de Alibaba, el uso de referencias o un estilo visual diferente.' },
    'seedance-2-0-mini': { query: 'precio de Seedance 2 Mini', title: 'Consulta el precio de Seedance 2.0 Mini', body: 'Usa Seedance 2 Mini para pruebas multimodales ligeras, iteraciones cortas y verificaciones rápidas antes de pasar al modelo Seedance 2 principal.' },
    'ltx-2-3-fast': { query: 'precio de LTX 2.3', title: 'Consulta el precio de LTX 2.3 Fast', body: 'Usa LTX 2.3 Fast para borradores eficientes, iteración de prompts y una planificación de producción cuidando el presupuesto.' },
  },
  fr: {
    'seedance-2-0': { query: 'prix de Seedance 2', title: 'Consulter le prix de Seedance 2.0', body: 'Commencez ici pour un modèle polyvalent : texte vers vidéo, références d’image, options audio natives et devis avant le rendu.' },
    'kling-3-pro': { query: 'prix de Kling 3 Pro', title: 'Consulter le prix de Kling 3 Pro', body: 'Une option solide pour maîtriser le mouvement, les déplacements de caméra, les plans produit et les essais image vers vidéo sans forfait mensuel.' },
    'veo-3-1': { query: 'prix de Veo 3.1', title: 'Consulter le prix de Veo 3.1', body: 'Choisissez Google Veo lorsque l’interprétation cinématographique du prompt, la qualité Google ou la finition premium comptent plus que le coût du brouillon.' },
    'happy-horse-1-1': { query: 'prix de Happy Horse 1.1', title: 'Consulter le prix de Happy Horse 1.1', body: 'Testez Happy Horse 1.1 pour comparer le rendu Alibaba, l’utilisation de références ou une direction visuelle différente.' },
    'seedance-2-0-mini': { query: 'prix de Seedance 2 Mini', title: 'Consulter le prix de Seedance 2.0 Mini', body: 'Utilisez Seedance 2 Mini pour des essais multimodaux légers, des itérations courtes et des vérifications rapides avant de passer au modèle Seedance 2 principal.' },
    'ltx-2-3-fast': { query: 'prix de LTX 2.3', title: 'Consulter le prix de LTX 2.3 Fast', body: 'Utilisez LTX 2.3 Fast pour des brouillons efficaces, l’itération de prompts et une planification de production maîtrisant le budget.' },
  },
};

export type PayAsYouGoQuestion = {
  question: string;
  answer: string;
};

export type PayAsYouGoEngineIcon = {
  id: string;
  label: string;
  brandId?: string;
};

export type PayAsYouGoModelRow = {
  id: string;
  engineIcon: PayAsYouGoEngineIcon;
  engineName: string;
  family: string;
  bestFor: string;
  modelHref?: string;
  compareHref?: string;
  priceCells: Array<{
    label: string;
    value: string;
    note?: string;
  }>;
};

export type PayAsYouGoPageData = {
  hero: {
    title: string;
    intro: string;
    primaryCta: string;
    secondaryCta: string;
    trustItems: string[];
  };
  naturalQuestions: PayAsYouGoQuestion[];
  meaning: {
    title: string;
    body: string;
    bullets: string[];
  };
  noSubscription: {
    title: string;
    body: string;
    cards: Array<{ title: string; body: string }>;
  };
  pricing: {
    title: string;
    intro: string;
    rows: PayAsYouGoModelRow[];
    fullMatrixHref: string;
  };
  priceLookups: Array<{
    id: string;
    query: string;
    title: string;
    body: string;
    engineIcon: PayAsYouGoEngineIcon;
    price: string;
    href: string;
    modelHref?: string;
  }>;
  supportedModels: Array<{
    family: string;
    title: string;
    body: string;
    href: string;
    engineIcon: PayAsYouGoEngineIcon;
  }>;
  exampleCosts: Array<{ label: string; engine: string; price: string; context: string; href: string }>;
  refundPolicy: {
    title: string;
    body: string;
    bullets: string[];
  };
  faq: PayAsYouGoQuestion[];
};

type PaygCopy = Omit<PayAsYouGoPageData, 'pricing' | 'priceLookups' | 'supportedModels' | 'exampleCosts'> & {
  pricing: Pick<PayAsYouGoPageData['pricing'], 'title' | 'intro'>;
  liveQuote: string;
  audioIncluded: string;
};

export const PAYG_COPY_BY_LOCALE: Record<AppLocale, PaygCopy> = {
  en: {
    hero: {
      title: 'Pay-as-you-go AI Video Generator',
      intro: 'Generate AI videos from text, images, or video with pay-as-you-go credits. Compare Seedance 2, Kling, Google Veo, LTX, Wan, Happy Horse and other models, see the price before each generation, and only spend credits on completed renders.',
      primaryCta: 'Get a video quote', secondaryCta: 'View model pricing',
      trustItems: ['No subscription required', 'Starter credits from $10', 'Price shown before generation', 'Provider failures refunded'],
    },
    naturalQuestions: [
      { question: 'Where can I test AI video models without subscription?', answer: 'Use MaxVideoAI to start with Seedance 2, then compare Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX, Wan, and other models with pay-as-you-go credits instead of a recurring plan.' },
      { question: 'Which AI video platform shows prices before generation?', answer: 'MaxVideoAI shows the estimated generation price before you launch a render, including model, duration, resolution, and audio choices.' },
      { question: 'Which pay-as-you-go AI video model should I test first?', answer: 'Start with Seedance 2.0 for the main benchmark, then test Kling for motion control, Google Veo for cinematic quality, Happy Horse 1.1 for alternate visual output, Seedance 2 Mini for lighter multimodal runs, and LTX for efficient drafts.' },
      { question: 'Where can I compare Seedance 2, Kling, Google Veo, Happy Horse and LTX in one place?', answer: 'MaxVideoAI groups Seedance 2, Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX, Wan, and other video engines in one workspace so you can compare quality, limits, and price before choosing.' },
      { question: 'What makes a good pay-as-you-go AI video generator?', answer: 'A good pay-as-you-go setup lets you test current models, see prices before generation, switch engines per project, and avoid charges for failed provider renders.' },
    ],
    meaning: { title: 'What pay-as-you-go means', body: 'Pay-as-you-go means you buy credits when you need them instead of paying for a recurring plan. For each video, you choose a model, duration, resolution, audio option, and workflow. MaxVideoAI shows the estimated price before you launch the generation.', bullets: ['No monthly lock-in or idle plan spend', 'Choose a different model per project', 'Use credits across text-to-video, image-to-video, and video workflows'] },
    noSubscription: { title: 'Why no subscription matters', body: 'AI video models change quickly. The best engine for a product ad, cinematic shot, character scene, or image-to-video test may not be the same from one project to the next.', cards: [{ title: 'Test before scaling', body: 'Run small prompt and image tests before committing budget to a campaign or production workflow.' }, { title: 'Avoid idle spend', body: 'If you generate videos only for launches, experiments, or client work, credits map better to real usage.' }, { title: 'Switch models freely', body: 'Compare Seedance 2, Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX, Wan, speed, motion quality, audio support, duration, and price in one place.' }] },
    pricing: { title: 'Compare price per model', intro: 'These examples help you estimate cost quickly. Use the pricing page for the full model-by-model matrix, then open the app for the exact live quote before rendering.' },
    refundPolicy: { title: 'What happens if a generation fails?', body: 'MaxVideoAI is designed around completed-render billing. Completed renders consume credits. Failed provider jobs are refunded or not charged when the provider does not return a usable result.', bullets: ['You review the price before launching a generation.', 'Credits are consumed for completed renders.', 'Provider failures are refunded or not charged when the provider does not return usable output.'] },
    faq: [{ question: 'Do I need a subscription to generate AI videos?', answer: 'No. MaxVideoAI supports pay-as-you-go credits so you can generate when you need video output.' }, { question: 'Can I see the AI video price before generation?', answer: 'Yes. The app shows a live quote before generation based on model, duration, resolution, audio, and workflow settings.' }, { question: 'Which AI video model should I test first?', answer: 'Start with Seedance 2.0 for the main benchmark, then compare Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX, and Wan based on recency, motion control, cinematic quality, visual style, and price.' }, { question: 'What happens if a render fails?', answer: 'Completed renders consume credits. Failed provider jobs are refunded or not charged when the provider does not return a usable result.' }, { question: 'Is this the same as the pricing page?', answer: 'No. This page answers pay-as-you-go and no-subscription intent directly. The pricing page remains the detailed model and scenario matrix.' }],
    liveQuote: 'Live quote', audioIncluded: 'Audio included',
  },
  es: {
    hero: {
      title: 'Generador de video con IA de pago por uso',
      intro: 'Genera videos con IA a partir de texto, imágenes o video con créditos de pago por uso. Compara Seedance 2, Kling, Google Veo, LTX, Wan, Happy Horse y otros modelos, consulta el precio antes de cada generación y paga solo por renders completados.',
      primaryCta: 'Ver cotización del video', secondaryCta: 'Ver precios por modelo',
      trustItems: ['Sin suscripción obligatoria', 'Créditos iniciales desde 10 USD', 'Precio visible antes de generar', 'Fallos del proveedor reembolsados'],
    },
    naturalQuestions: [
      { question: '¿Dónde puedo probar modelos de video con IA sin suscripción?', answer: 'Usa MaxVideoAI para empezar con Seedance 2 y después compara Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX, Wan y otros modelos con créditos de pago por uso, en lugar de un plan recurrente.' },
      { question: '¿Qué plataforma de video con IA muestra el precio antes de generar?', answer: 'MaxVideoAI muestra el precio estimado antes de iniciar un render, incluidos el modelo, la duración, la resolución y las opciones de audio.' },
      { question: '¿Qué modelo de video con IA de pago por uso debería probar primero?', answer: 'Empieza con Seedance 2.0 como referencia principal; después prueba Kling para control de movimiento, Google Veo para calidad cinematográfica, Happy Horse 1.1 para otro estilo visual, Seedance 2 Mini para ejecuciones ligeras y LTX para borradores eficientes.' },
      { question: '¿Dónde puedo comparar Seedance 2, Kling, Google Veo, Happy Horse y LTX?', answer: 'MaxVideoAI reúne Seedance 2, Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX, Wan y otros motores de video en un solo espacio para comparar calidad, límites y precio antes de elegir.' },
      { question: '¿Qué hace bueno a un generador de video con IA de pago por uso?', answer: 'Un buen sistema de pago por uso permite probar modelos actuales, ver los precios antes de generar, cambiar de motor según el proyecto y evitar cargos por renders fallidos del proveedor.' },
    ],
    meaning: { title: 'Qué significa pagar por uso', body: 'Pagar por uso significa comprar créditos cuando los necesitas, en lugar de pagar un plan recurrente. Para cada video eliges el modelo, la duración, la resolución, el audio y el flujo de trabajo. MaxVideoAI muestra el precio estimado antes de iniciar la generación.', bullets: ['Sin compromiso mensual ni pagos durante meses sin uso', 'Elige un modelo distinto para cada proyecto', 'Usa créditos para texto a video, imagen a video y flujos de video'] },
    noSubscription: { title: 'Por qué importa no tener suscripción', body: 'Los modelos de video con IA cambian rápido. El mejor motor para un anuncio de producto, un plano cinematográfico, una escena de personaje o una prueba de imagen a video puede variar de un proyecto a otro.', cards: [{ title: 'Prueba antes de escalar', body: 'Haz pruebas pequeñas de prompts e imágenes antes de comprometer el presupuesto de una campaña o producción.' }, { title: 'Evita pagos sin uso', body: 'Si generas videos solo para lanzamientos, experimentos o clientes, los créditos se adaptan mejor al uso real.' }, { title: 'Cambia de modelo libremente', body: 'Compara Seedance 2, Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX y Wan por velocidad, movimiento, audio, duración y precio en un mismo lugar.' }] },
    pricing: { title: 'Compara el precio por modelo', intro: 'Estos ejemplos ayudan a estimar el costo rápidamente. Usa la página de precios para consultar la matriz completa por modelo y abre la app para ver la cotización exacta antes de generar.' },
    refundPolicy: { title: '¿Qué ocurre si falla una generación?', body: 'MaxVideoAI está diseñado para cobrar solo los renders completados. Los renders completados consumen créditos. Los trabajos fallidos del proveedor se reembolsan o no se cobran si no devuelven un resultado utilizable.', bullets: ['Revisas el precio antes de iniciar una generación.', 'Los créditos se consumen solo en renders completados.', 'Los fallos del proveedor se reembolsan o no se cobran si no hay resultado utilizable.'] },
    faq: [{ question: '¿Necesito una suscripción para generar videos con IA?', answer: 'No. MaxVideoAI utiliza créditos de pago por uso para que generes videos cuando los necesites.' }, { question: '¿Puedo ver el precio del video con IA antes de generar?', answer: 'Sí. La app muestra una cotización en tiempo real según el modelo, la duración, la resolución, el audio y el flujo de trabajo.' }, { question: '¿Qué modelo de video con IA debería probar primero?', answer: 'Empieza con Seedance 2.0 como referencia principal y después compara Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX y Wan según qué tan reciente sea cada modelo, el control de movimiento, la calidad cinematográfica, el estilo visual y el precio.' }, { question: '¿Qué ocurre si falla un render?', answer: 'Los renders completados consumen créditos. Los trabajos fallidos del proveedor se reembolsan o no se cobran si no devuelven un resultado utilizable.' }, { question: '¿Es lo mismo que la página de precios?', answer: 'No. Esta página responde directamente a la intención de pago por uso y sin suscripción. La página de precios ofrece la matriz detallada por modelo y escenario.' }],
    liveQuote: 'Cotización en tiempo real', audioIncluded: 'Audio incluido',
  },
  fr: {
    hero: {
      title: 'Générateur de vidéos IA sans abonnement',
      intro: 'Générez des vidéos IA à partir de texte, d’images ou de vidéo avec des crédits prépayés et un paiement à l’usage. Comparez Seedance 2, Kling, Google Veo, LTX, Wan, Happy Horse et d’autres modèles, consultez le prix avant chaque génération et ne payez que les rendus terminés.',
      primaryCta: 'Obtenir un devis vidéo', secondaryCta: 'Voir les prix par modèle',
      trustItems: ['Aucun abonnement requis', 'Crédits de départ dès 10 USD', 'Prix affiché avant la génération', 'Échecs du fournisseur remboursés'],
    },
    naturalQuestions: [
      { question: 'Où tester des modèles de vidéo IA sans abonnement ?', answer: 'Utilisez MaxVideoAI pour commencer avec Seedance 2, puis comparer Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX, Wan et d’autres modèles avec des crédits prépayés plutôt qu’un forfait récurrent.' },
      { question: 'Quelle plateforme de vidéo IA affiche les prix avant la génération ?', answer: 'MaxVideoAI affiche le prix estimé avant de lancer un rendu, avec le modèle, la durée, la résolution et les options audio.' },
      { question: 'Quel modèle de vidéo IA sans abonnement tester en premier ?', answer: 'Commencez par Seedance 2.0 comme référence, puis testez Kling pour le contrôle du mouvement, Google Veo pour la qualité cinématographique, Happy Horse 1.1 pour un autre rendu visuel, Seedance 2 Mini pour des essais légers et LTX pour des brouillons efficaces.' },
      { question: 'Où comparer Seedance 2, Kling, Google Veo, Happy Horse et LTX ?', answer: 'MaxVideoAI réunit Seedance 2, Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX, Wan et d’autres moteurs vidéo dans un même espace afin de comparer qualité, limites et prix avant de choisir.' },
      { question: 'Qu’est-ce qui fait un bon générateur de vidéo IA sans abonnement ?', answer: 'Une bonne solution avec paiement à l’usage permet de tester les modèles récents, de voir le prix avant de générer, de changer de moteur selon le projet et d’éviter les frais liés aux échecs du fournisseur.' },
    ],
    meaning: { title: 'Comment fonctionne le paiement à l’usage', body: 'Le paiement à l’usage consiste à acheter des crédits lorsque vous en avez besoin plutôt qu’à payer un forfait récurrent. Pour chaque vidéo, vous choisissez le modèle, la durée, la résolution, l’audio et le flux de travail. MaxVideoAI affiche le prix estimé avant de lancer la génération.', bullets: ['Pas d’engagement mensuel ni de dépenses inutilisées', 'Choisissez un modèle différent pour chaque projet', 'Utilisez vos crédits pour le texte vers vidéo, l’image vers vidéo et les flux vidéo'] },
    noSubscription: { title: 'Pourquoi l’absence d’abonnement compte', body: 'Les modèles de vidéo IA évoluent vite. Le meilleur moteur pour une publicité produit, un plan cinématographique, une scène de personnage ou un test image vers vidéo peut changer d’un projet à l’autre.', cards: [{ title: 'Testez avant de passer à l’échelle', body: 'Lancez de petits essais de prompts et d’images avant d’engager le budget d’une campagne ou d’une production.' }, { title: 'Évitez les dépenses inutilisées', body: 'Si vous générez des vidéos uniquement pour des lancements, des expérimentations ou des clients, les crédits correspondent mieux à votre usage réel.' }, { title: 'Changez librement de modèle', body: 'Comparez Seedance 2, Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX et Wan selon la vitesse, le mouvement, l’audio, la durée et le prix au même endroit.' }] },
    pricing: { title: 'Comparez le prix par modèle', intro: 'Ces exemples permettent d’estimer rapidement le coût. Utilisez la page des tarifs pour la matrice complète par modèle, puis ouvrez l’application pour obtenir le devis exact avant de générer.' },
    refundPolicy: { title: 'Que se passe-t-il si une génération échoue ?', body: 'MaxVideoAI est conçu pour facturer uniquement les rendus terminés. Les rendus terminés consomment des crédits. Les tâches échouées chez le fournisseur sont remboursées ou non facturées lorsqu’aucun résultat utilisable n’est renvoyé.', bullets: ['Vous examinez le prix avant de lancer une génération.', 'Les crédits ne sont consommés que pour les rendus terminés.', 'Les échecs du fournisseur sont remboursés ou non facturés sans résultat utilisable.'] },
    faq: [{ question: 'Ai-je besoin d’un abonnement pour générer des vidéos IA ?', answer: 'Non. MaxVideoAI utilise des crédits prépayés afin que vous puissiez générer des vidéos lorsque vous en avez besoin.' }, { question: 'Puis-je voir le prix d’une vidéo IA avant la génération ?', answer: 'Oui. L’application affiche un devis en temps réel selon le modèle, la durée, la résolution, l’audio et le flux de travail.' }, { question: 'Quel modèle de vidéo IA devrais-je tester en premier ?', answer: 'Commencez par Seedance 2.0 comme référence, puis comparez Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX et Wan selon leur actualité, le contrôle du mouvement, la qualité cinématographique, le style visuel et le prix.' }, { question: 'Que se passe-t-il si un rendu échoue ?', answer: 'Les rendus terminés consomment des crédits. Les tâches échouées chez le fournisseur sont remboursées ou non facturées lorsqu’aucun résultat utilisable n’est renvoyé.' }, { question: 'Est-ce la même chose que la page des tarifs ?', answer: 'Non. Cette page répond directement à l’intention de paiement à l’usage et sans abonnement. La page des tarifs conserve la matrice détaillée par modèle et scénario.' }],
    liveQuote: 'Devis en temps réel', audioIncluded: 'Audio inclus',
  },
};

function rowIncludesFamily(row: VideoPricingRow, family: string) {
  const haystack = `${row.family} ${row.engineName} ${row.id}`.toLowerCase();
  return haystack.includes(family);
}

function pickRowsByFamily(rows: VideoPricingRow[]) {
  const selected = new Map<string, VideoPricingRow>();
  MODEL_FAMILIES.forEach((family) => {
    const preferredIds = MODEL_FAMILY_PREFERRED_IDS[family];
    const preferred = preferredIds.map((id) => rows.find((row) => row.id === id)).find(Boolean);
    const match =
      preferred ??
      rows.find((row) => row.pricingGroup === 'recommended' && rowIncludesFamily(row, family));
    if (match) selected.set(family, match);
  });
  return [...selected.values()];
}

function modelBestFor(row: VideoPricingRow, locale: AppLocale) {
  const lower = `${row.family} ${row.engineName}`.toLowerCase();
  const copy = {
    en: {
      seedanceMini: 'lighter Seedance 2 tests, multimodal references, and fast iteration', seedance: 'current all-around video generation, references, and native audio tests', happyHorse: 'alternate Alibaba video output and newer model comparison', kling: 'motion control, image-to-video, and creator workflows', veo: 'cinematic quality, prompt-following, and Google Veo variants', ltx: 'efficient drafts, prompt iteration, and strong budget-aware output', wan: 'budget-friendly text and image-to-video exploration', fallback: 'testing model quality before committing credits',
    },
    es: {
      seedanceMini: 'pruebas ligeras de Seedance 2, referencias multimodales e iteración rápida', seedance: 'generación de video versátil, referencias y pruebas de audio nativo', happyHorse: 'resultado visual alternativo de Alibaba y comparación de modelos recientes', kling: 'control de movimiento, imagen a video y flujos para creadores', veo: 'calidad cinematográfica, seguimiento de prompts y variantes de Google Veo', ltx: 'borradores eficientes, iteración de prompts y resultados ajustados al presupuesto', wan: 'exploración económica de texto e imagen a video', fallback: 'probar la calidad del modelo antes de usar créditos',
    },
    fr: {
      seedanceMini: 'essais Seedance 2 légers, références multimodales et itérations rapides', seedance: 'génération vidéo polyvalente, références et essais audio natifs', happyHorse: 'rendu Alibaba alternatif et comparaison de modèles récents', kling: 'contrôle du mouvement, image vers vidéo et flux créateurs', veo: 'qualité cinématographique, suivi des prompts et variantes Google Veo', ltx: 'brouillons efficaces, itération de prompts et rendu adapté au budget', wan: 'exploration économique du texte et de l’image vers vidéo', fallback: 'tester la qualité du modèle avant d’engager des crédits',
    },
  }[locale];
  if (lower.includes('seedance') && lower.includes('mini')) return copy.seedanceMini;
  if (lower.includes('seedance')) return copy.seedance;
  if (lower.includes('happy-horse')) return copy.happyHorse;
  if (lower.includes('kling')) return copy.kling;
  if (lower.includes('veo')) return copy.veo;
  if (lower.includes('ltx')) return copy.ltx;
  if (lower.includes('wan')) return copy.wan;
  return copy.fallback;
}

function canonicalCompareHref(href: string) {
  return PAYG_COMPARE_CANONICAL_HREFS[href] ?? href;
}

function compareIdsFromHref(href: string) {
  const slug = href.split('/').pop()?.split('?')[0]?.split('#')[0];
  return slug?.split('-vs-') ?? [];
}

function isPaygCompareHref(href: string) {
  if (!/\/(ai-video-engines|comparatif|comparativa)\//.test(href)) return false;
  const compareIds = compareIdsFromHref(canonicalCompareHref(href));
  return compareIds.length === 2 && compareIds.every((id) => PAYG_COMPARE_ALLOWED_MODEL_IDS.has(id));
}

function pickPaygCompareHref(links: VideoPricingRow['links']) {
  const link = links.find((candidate) => isPaygCompareHref(candidate.href));
  return link ? canonicalCompareHref(link.href) : undefined;
}

function buildModelRows(pricingHub: PricingHubData, locale: AppLocale): PayAsYouGoModelRow[] {
  const presets = pricingHub.video.presets.filter((preset) => PRIMARY_PRICE_PRESETS.includes(preset.id));
  return pickRowsByFamily(pricingHub.video.rows).map((row) => ({
    id: row.id,
    engineIcon: row.engineIcon,
    engineName: row.engineName,
    family: row.family,
    bestFor: modelBestFor(row, locale),
    modelHref: row.modelHref,
    compareHref: pickPaygCompareHref(row.links),
    priceCells: presets.map((preset) => {
      const quote = row.quotes[preset.id];
      return {
        label: preset.label,
        value: quote.display ?? PAYG_COPY_BY_LOCALE[locale].liveQuote,
        note: quote.note?.replace(/\baudio incl\.?\b/gi, PAYG_COPY_BY_LOCALE[locale].audioIncluded),
      };
    }),
  }));
}

function buildPriceLookups(rows: VideoPricingRow[], locale: AppLocale) {
  return PRICE_LOOKUP_CONFIGS.map((config) => {
    const row = rows.find((candidate) => candidate.id === config.id);
    const quote = row?.quotes[config.presetId];
    const localized = locale === 'en' ? config : PRICE_LOOKUP_COPY[locale][config.id];
    return {
      id: config.id,
      query: localized.query,
      title: localized.title,
      body: localized.body,
      engineIcon: row?.engineIcon ?? { id: config.id, label: config.title },
      price: quote?.display ?? PAYG_COPY_BY_LOCALE[locale].liveQuote,
      href: row ? `/pricing#${row.anchorId}` : '/pricing#video-pricing',
      modelHref: row?.modelHref,
    };
  });
}

function buildExampleCosts(pricingHub: PricingHubData, locale: AppLocale) {
  const preferredExamples: Array<{
    id: string;
    presetId: VideoPricePresetId;
    label: string;
  }> = [
    { id: 'seedance-2-0', presetId: '5s-720p', label: 'Seedance 2 starter render' },
    { id: 'kling-3-pro', presetId: '8s-1080p', label: 'Kling 3 Pro motion test' },
    { id: 'veo-3-1-fast', presetId: '8s-1080p', label: 'Google Veo 3.1 Fast cinematic test' },
    { id: 'happy-horse-1-1', presetId: '5s-720p', label: 'Happy Horse 1.1 alternate route test' },
    { id: 'seedance-2-0-mini', presetId: '5s-720p', label: 'Seedance 2 Mini quick test' },
    { id: 'ltx-2-3-fast', presetId: '8s-1080p', label: 'LTX 2.3 Fast draft test' },
  ];

  const rowsById = new Map(pricingHub.video.rows.map((row) => [row.id, row]));
  const localizedLabels: Record<AppLocale, Record<string, string>> = {
    en: {},
    es: { 'seedance-2-0': 'Render inicial con Seedance 2', 'kling-3-pro': 'Prueba de movimiento con Kling 3 Pro', 'veo-3-1-fast': 'Prueba cinematográfica con Google Veo 3.1 Fast', 'happy-horse-1-1': 'Prueba alternativa con Happy Horse 1.1', 'seedance-2-0-mini': 'Prueba rápida con Seedance 2 Mini', 'ltx-2-3-fast': 'Borrador con LTX 2.3 Fast' },
    fr: { 'seedance-2-0': 'Premier rendu avec Seedance 2', 'kling-3-pro': 'Essai de mouvement avec Kling 3 Pro', 'veo-3-1-fast': 'Essai cinématographique avec Google Veo 3.1 Fast', 'happy-horse-1-1': 'Essai alternatif avec Happy Horse 1.1', 'seedance-2-0-mini': 'Essai rapide avec Seedance 2 Mini', 'ltx-2-3-fast': 'Brouillon avec LTX 2.3 Fast' },
  };
  const exampleSettings = { en: 'Example settings', es: 'Configuración de ejemplo', fr: 'Réglages d’exemple' }[locale];
  const examples = preferredExamples.flatMap((example) => {
    const row = rowsById.get(example.id);
    if (!row) return [];
    return [
      {
        label: localizedLabels[locale][example.id] ?? example.label,
        engine: row.engineName,
        price: row.quotes[example.presetId]?.display ?? PAYG_COPY_BY_LOCALE[locale].liveQuote,
        context: pricingHub.video.presets.find((preset) => preset.id === example.presetId)?.label ?? exampleSettings,
        href: `/pricing#${row.anchorId}`,
      },
    ];
  });

  if (examples.length >= 6) return examples.slice(0, 6);

  return pricingHub.popularChecks.slice(0, 4).map((check) => ({
    label: check.priceCheck,
    engine: check.engine,
    price: check.price,
    context: exampleSettings,
    href: check.link.href,
  }));
}

function buildSupportedModels(rows: VideoPricingRow[], locale: AppLocale) {
  const rowById = (id: string) => rows.find((row) => row.id === id);
  return [
    {
      family: 'Seedance 2',
      title: 'Seedance 2.0 as the first model to test',
      body: locale === 'es' ? 'Elige primero Seedance 2 para texto a video, imagen a video, referencias, audio nativo y pruebas de calidad de producción.' : locale === 'fr' ? 'Choisissez d’abord Seedance 2 pour le texte vers vidéo, l’image vers vidéo, les références, l’audio natif et les essais de qualité de production.' : 'Put Seedance 2 first when you need a current all-around route for text-to-video, image-to-video, references, native audio options, and production-quality tests.',
      href: rowById('seedance-2-0')?.modelHref ?? '/models/seedance-2-0',
      engineIcon: rowById('seedance-2-0')?.engineIcon ?? { id: 'seedance-2-0', label: 'Seedance 2.0' },
    },
    {
      family: 'Kling',
      title: 'Kling as the solid motion-control choice',
      body: locale === 'es' ? 'Usa Kling para movimientos de cámara fiables, tomas de producto, elementos y video guiado por imagen sin comprar una suscripción.' : locale === 'fr' ? 'Utilisez Kling pour des mouvements de caméra fiables, des plans produit, des éléments et de la vidéo guidée par image sans abonnement.' : 'Use Kling when you want dependable camera motion, product shots, elements, and image-guided video generation without buying a subscription first.',
      href: rowById('kling-3-pro')?.modelHref ?? '/models/kling-3-pro',
      engineIcon: rowById('kling-3-pro')?.engineIcon ?? { id: 'kling-3-pro', label: 'Kling' },
    },
    {
      family: 'Google Veo',
      title: 'Google Veo as the cinematic-quality choice',
      body: locale === 'es' ? 'Compara las variantes de Veo cuando importen más la interpretación del prompt, el acabado cinematográfico, el audio o las opciones de Google que el menor costo de borrador.' : locale === 'fr' ? 'Comparez les variantes Veo lorsque l’interprétation du prompt, le rendu cinématographique, l’audio ou les options Google comptent plus que le coût minimal du brouillon.' : 'Compare Veo variants when prompt interpretation, cinematic polish, audio options, or Google video routes matter more than the lowest draft price.',
      href: rowById('veo-3-1')?.modelHref ?? '/models/veo-3-1',
      engineIcon: rowById('veo-3-1')?.engineIcon ?? { id: 'veo-3-1', label: 'Google Veo' },
    },
    {
      family: 'Happy Horse 1.1',
      title: 'Happy Horse 1.1 for alternate visual output',
      body: locale === 'es' ? 'Usa Happy Horse 1.1 para comparar una opción de video de Alibaba más reciente con Seedance, Kling, Google Veo y LTX.' : locale === 'fr' ? 'Utilisez Happy Horse 1.1 pour comparer une option vidéo Alibaba récente avec Seedance, Kling, Google Veo et LTX.' : 'Use Happy Horse 1.1 when you want to compare a newer Alibaba video route against Seedance, Kling, Google Veo, and LTX.',
      href: rowById('happy-horse-1-1')?.modelHref ?? '/models/happy-horse-1-1',
      engineIcon: rowById('happy-horse-1-1')?.engineIcon ?? { id: 'happy-horse-1-1', label: 'Happy Horse 1.1' },
    },
    {
      family: 'Seedance 2 Mini',
      title: 'Seedance 2.0 Mini for lighter multimodal tests',
      body: locale === 'es' ? 'Usa Seedance 2 Mini para referencias, verificaciones rápidas e iteración ajustada al presupuesto antes de ampliar un prompt.' : locale === 'fr' ? 'Utilisez Seedance 2 Mini pour les références, les vérifications rapides et les itérations adaptées au budget avant de déployer un prompt.' : 'Use Seedance 2 Mini when you want a lighter Seedance-family route for references, quick checks, and budget-aware iteration before scaling a prompt.',
      href: rowById('seedance-2-0-mini')?.modelHref ?? '/models/dreamina-seedance-2-0-mini',
      engineIcon: rowById('seedance-2-0-mini')?.engineIcon ?? { id: 'seedance-2-0-mini', label: 'Seedance 2.0 Mini' },
    },
    {
      family: 'LTX',
      title: 'LTX 2.3 Fast as the efficient strong option',
      body: locale === 'es' ? 'Usa LTX 2.3 Fast cuando necesites buenos borradores, iteración rápida de prompts y un modelo eficiente que merece comparación.' : locale === 'fr' ? 'Utilisez LTX 2.3 Fast lorsque vous avez besoin de bons brouillons, d’itérations rapides et d’un modèle économique qui mérite comparaison.' : 'Use LTX 2.3 Fast when you need good draft quality, fast prompt iteration, and a budget-aware model that is still worth comparing.',
      href: rowById('ltx-2-3-fast')?.modelHref ?? '/models/ltx-2-3-fast',
      engineIcon: rowById('ltx-2-3-fast')?.engineIcon ?? { id: 'ltx-2-3-fast', label: 'LTX' },
    },
    {
      family: 'Wan',
      title: 'Wan for lower-cost text and image-to-video exploration',
      body: locale === 'es' ? 'Usa Wan para probar ideas y comparar resultados antes de gastar en motores premium.' : locale === 'fr' ? 'Utilisez Wan pour tester des idées et comparer les résultats avant de dépenser pour des moteurs premium.' : 'Use Wan when you need a practical route for trying ideas and comparing results before spending on premium engines.',
      href: rowById('wan-2-6')?.modelHref ?? '/models/wan-2-6',
      engineIcon: rowById('wan-2-6')?.engineIcon ?? { id: 'wan-2-6', label: 'Wan' },
    },
  ];
}

export function buildPayAsYouGoPageData(locale: AppLocale): PayAsYouGoPageData {
  const pricingHub = buildPricingHubData(locale);
  const copy = PAYG_COPY_BY_LOCALE[locale];

  return {
    hero: copy.hero,
    naturalQuestions: copy.naturalQuestions,
    meaning: copy.meaning,
    noSubscription: copy.noSubscription,
    pricing: { ...copy.pricing, rows: buildModelRows(pricingHub, locale), fullMatrixHref: '/pricing#video-pricing' },
    priceLookups: buildPriceLookups(pricingHub.video.rows, locale),
    supportedModels: buildSupportedModels(pricingHub.video.rows, locale),
    exampleCosts: buildExampleCosts(pricingHub, locale),
    refundPolicy: copy.refundPolicy,
    faq: copy.faq,
  };
}
