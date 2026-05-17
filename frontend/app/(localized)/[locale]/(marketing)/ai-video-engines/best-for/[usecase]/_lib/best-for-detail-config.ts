import type { AppLocale } from '@/i18n/locales';
import engineCatalog from '@/config/engine-catalog.json';
import compareConfig from '@/config/compare-config.json';

export interface Params {
  locale?: AppLocale;
  usecase: string;
}

export interface BestForEntry {
  slug: string;
  title: string;
  description?: string;
  tier: number;
  topPicks?: string[];
  relatedComparisons?: string[];
}

export type RelatedGuideEntry = BestForEntry & {
  displayTitle: string;
};

export type EngineCatalogEntry = {
  engineId?: string;
  modelSlug: string;
  marketingName: string;
  provider?: string;
  brandId?: string;
  family?: string;
  bestFor?: string;
};

export type EngineScore = {
  engineId?: string;
  modelSlug?: string;
  fidelity?: number;
  motion?: number;
  anatomy?: number;
  textRendering?: number;
  consistency?: number;
  lipsyncQuality?: number;
  sequencingQuality?: number;
};

export type EngineScoresFile = {
  version?: string;
  last_updated?: string;
  scores?: EngineScore[];
};

export type RankedPick = {
  slug: string;
  engine?: EngineCatalogEntry;
  rank: number;
  criterion: string;
  score?: number;
  accent: string;
  reason: string;
  bullets: string[];
};

export type ExamplePreviewPick = RankedPick & {
  examplesSlug: string;
  heroThumbUrl?: string | null;
};

export const BEST_FOR_PAGES = compareConfig.bestForPages as BestForEntry[];
export const ENGINE_CATALOG = engineCatalog as EngineCatalogEntry[];
export const ENGINE_BY_SLUG = new Map(ENGINE_CATALOG.map((entry) => [entry.modelSlug, entry]));

export const DETAIL_COPY: Record<
  AppLocale,
  {
    eyebrow: string;
    shortlist: string;
    shortlistDescription: string;
    ranked: string;
    rank: string;
    topPick: string;
    provider: string;
    fit: string;
    evidence: string;
    topReason: string;
    shortlistReason: string;
    viewModel: string;
    viewExamples: string;
    compareWith: string;
    compareShortlistCta: string;
    examplesCta: string;
    alsoAvailable: string;
    chooseTitle: string;
    examplesTitle: string;
    examplesDescription: string;
    whyTitle: string;
    mistakesTitle: string;
    fullAnalysis: string;
    relatedGuides: string;
    allGuides: string;
    score: string;
    overall: string;
    criteriaNote: string;
    compareShortlist: string;
    compareDescription: string;
    contentComing: string;
    backToHub: string;
    backToTop: string;
    criteria: string;
    quickLinks: string;
    tier: string;
    browseAllExamples: string;
  }
> = {
  en: {
    eyebrow: 'Best for',
    shortlist: 'Recommended shortlist',
    shortlistDescription: 'Model cards use the same visual language as the model pages, with the strongest engines shown first.',
    ranked: 'Ranked picks',
    rank: 'Rank',
    topPick: 'Top pick',
    provider: 'Provider',
    fit: 'Best fit',
    evidence: 'Why it fits',
    topReason: 'Primary recommendation for this search intent, based on the criteria above.',
    shortlistReason: 'Strong shortlist option when this criterion matters for the final video.',
    viewModel: 'View model',
    viewExamples: 'View examples',
    compareWith: 'Compare vs',
    compareShortlistCta: 'Compare the shortlist',
    examplesCta: 'View cinematic examples',
    alsoAvailable: 'Also available',
    chooseTitle: 'When should you choose each engine?',
    examplesTitle: 'Examples to review first',
    examplesDescription: 'Preview real output direction before making a decision.',
    whyTitle: 'Why these models fit this use case',
    mistakesTitle: 'Avoid these mistakes',
    fullAnalysis: 'Read the full analysis',
    relatedGuides: 'Related best-for guides',
    allGuides: 'View all guides',
    score: 'Score',
    overall: 'Best overall',
    criteriaNote: 'Scores combine quality, control, consistency, and cost efficiency.',
    compareShortlist: 'Compare the shortlist',
    compareDescription: 'Useful side-by-side pages for validating tradeoffs before picking a model.',
    contentComing: 'Content coming soon.',
    backToHub: 'Back to Best-for hub',
    backToTop: 'Back to top',
    criteria: 'Decision criteria',
    quickLinks: 'Quick links',
    tier: 'Tier',
    browseAllExamples: 'Browse all examples',
  },
  fr: {
    eyebrow: 'Meilleur pour',
    shortlist: 'Shortlist recommandée',
    shortlistDescription: 'Les cards reprennent le style des pages modèles, avec les modèles les plus adaptés en premier.',
    ranked: 'Sélection classée',
    rank: 'Rang',
    topPick: 'Premier choix',
    provider: 'Fournisseur',
    fit: 'Meilleur usage',
    evidence: 'Pourquoi ça matche',
    topReason: 'Recommandation principale pour cette intention de recherche, d’après les critères ci-dessus.',
    shortlistReason: 'Option forte de la shortlist quand ce critère compte dans la vidéo finale.',
    viewModel: 'Voir le modèle',
    viewExamples: 'Voir les exemples',
    compareWith: 'Comparer avec',
    compareShortlistCta: 'Comparer la shortlist',
    examplesCta: 'Voir les exemples cinéma',
    alsoAvailable: 'Aussi disponible',
    chooseTitle: 'Quand choisir chaque modèle ?',
    examplesTitle: 'Exemples à vérifier d’abord',
    examplesDescription: 'Prévisualisez le rendu avant de choisir un modèle.',
    whyTitle: 'Pourquoi ces modèles conviennent',
    mistakesTitle: 'Erreurs à éviter',
    fullAnalysis: 'Lire l’analyse complète',
    relatedGuides: 'Guides Best-for liés',
    allGuides: 'Voir tous les guides',
    score: 'Score',
    overall: 'Meilleur choix',
    criteriaNote: 'Les scores combinent qualité, contrôle, cohérence et efficacité coût.',
    compareShortlist: 'Comparer la shortlist',
    compareDescription: 'Des pages côte à côte utiles pour valider les compromis avant de choisir un modèle.',
    contentComing: 'Contenu bientôt disponible.',
    backToHub: 'Retour au hub Best-for',
    backToTop: 'Retour en haut',
    criteria: 'Critères de décision',
    quickLinks: 'Liens rapides',
    tier: 'Niveau',
    browseAllExamples: 'Voir tous les exemples',
  },
  es: {
    eyebrow: 'Mejor para',
    shortlist: 'Shortlist recomendada',
    shortlistDescription: 'Las cards reutilizan el lenguaje visual de las páginas de modelos, con los modelos ideales primero.',
    ranked: 'Selección ordenada',
    rank: 'Puesto',
    topPick: 'Primera opción',
    provider: 'Proveedor',
    fit: 'Ideal para',
    evidence: 'Por qué encaja',
    topReason: 'Recomendación principal para esta intención de búsqueda, según los criterios anteriores.',
    shortlistReason: 'Opción fuerte de la shortlist cuando este criterio pesa en el video final.',
    viewModel: 'Ver modelo',
    viewExamples: 'Ver ejemplos',
    compareWith: 'Comparar con',
    compareShortlistCta: 'Comparar la shortlist',
    examplesCta: 'Ver ejemplos cinematográficos',
    alsoAvailable: 'También disponible',
    chooseTitle: '¿Cuándo elegir cada modelo?',
    examplesTitle: 'Ejemplos para revisar primero',
    examplesDescription: 'Previsualiza la dirección del resultado antes de elegir un modelo.',
    whyTitle: 'Por qué estos modelos encajan',
    mistakesTitle: 'Evita estos errores',
    fullAnalysis: 'Leer el análisis completo',
    relatedGuides: 'Guías Mejor para relacionadas',
    allGuides: 'Ver todas las guías',
    score: 'Puntuación',
    overall: 'Mejor opción',
    criteriaNote: 'Las puntuaciones combinan calidad, control, consistencia y eficiencia de precio.',
    compareShortlist: 'Comparar la shortlist',
    compareDescription: 'Páginas lado a lado útiles para validar compromisos antes de elegir modelo.',
    contentComing: 'Contenido próximamente.',
    backToHub: 'Volver al espacio Mejor para',
    backToTop: 'Volver arriba',
    criteria: 'Criterios de decisión',
    quickLinks: 'Enlaces rápidos',
    tier: 'Nivel',
    browseAllExamples: 'Ver todos los ejemplos',
  },
};

export type BestForDetailCopy = (typeof DETAIL_COPY)[AppLocale];

export const USECASE_CRITERIA: Record<string, Record<AppLocale, string[]>> = {
  'image-to-video': {
    en: ['Image fidelity after motion', 'Camera control from a still', 'Clean product and subject preservation'],
    fr: ['Fidélité de l’image après mouvement', 'Contrôle caméra depuis une image fixe', 'Préservation propre du produit ou sujet'],
    es: ['Fidelidad de imagen tras el movimiento', 'Control de cámara desde una imagen fija', 'Preservación limpia del producto o sujeto'],
  },
  'cinematic-realism': {
    en: ['Camera language and lighting', 'Natural motion physics', 'High-end visual polish'],
    fr: ['Langage caméra et lumière', 'Physique du mouvement naturelle', 'Rendu visuel premium'],
    es: ['Lenguaje de cámara e iluminación', 'Física de movimiento natural', 'Pulido visual premium'],
  },
  'character-reference': {
    en: ['Stable identity', 'Wardrobe and prop retention', 'Reference-aware shot control'],
    fr: ['Identité stable', 'Tenue et accessoires conservés', 'Contrôle des plans par référence'],
    es: ['Identidad estable', 'Vestuario y accesorios consistentes', 'Control de planos con referencia'],
  },
  'reference-to-video': {
    en: ['Strong visual reference following', 'Flexible image or clip guidance', 'Good result with approved assets'],
    fr: ['Respect fort des références visuelles', 'Guidage flexible par image ou clip', 'Bon rendu depuis assets validés'],
    es: ['Seguimiento fuerte de referencias visuales', 'Guía flexible por imagen o clip', 'Buen resultado con assets aprobados'],
  },
  'multi-shot-video': {
    en: ['Several shots from one prompt', 'Sequence continuity', 'Edited-feeling final output'],
    fr: ['Plusieurs plans depuis un prompt', 'Continuité de séquence', 'Résultat final déjà monté'],
    es: ['Varios planos desde un prompt', 'Continuidad de secuencia', 'Resultado final con sensación de montaje'],
  },
  '4k-video': {
    en: ['Native or practical high resolution', 'Detail retention', 'Delivery-ready upscale path'],
    fr: ['Haute résolution native ou exploitable', 'Conservation du détail', 'Chemin clair vers une livraison finale'],
    es: ['Alta resolución nativa o práctica', 'Retención de detalle', 'Ruta clara hacia entrega final'],
  },
  ads: {
    en: ['Product clarity', 'Campaign-grade polish', 'Variation-friendly output'],
    fr: ['Clarté produit', 'Finition niveau campagne', 'Sorties faciles à décliner'],
    es: ['Claridad de producto', 'Acabado de campaña', 'Salida fácil de versionar'],
  },
  'ugc-ads': {
    en: ['Creator-style realism', 'Dialogue and social proof', 'Fast hook testing'],
    fr: ['Réalisme style créateur', 'Dialogue et preuve sociale', 'Tests rapides de hooks'],
    es: ['Realismo estilo creador', 'Diálogo y prueba social', 'Pruebas rápidas de hooks'],
  },
  'product-videos': {
    en: ['Packshot stability', 'Material and texture quality', 'Clean ecommerce motion'],
    fr: ['Stabilité packshot', 'Qualité matière et texture', 'Mouvement ecommerce propre'],
    es: ['Estabilidad de packshot', 'Calidad de materiales y textura', 'Movimiento ecommerce limpio'],
  },
  'lipsync-dialogue': {
    en: ['Mouth timing', 'Voice and native audio options', 'Face consistency'],
    fr: ['Timing bouche', 'Options voix et audio natif', 'Cohérence du visage'],
    es: ['Sincronía de boca', 'Opciones de voz y audio nativo', 'Consistencia facial'],
  },
  'fast-drafts': {
    en: ['Iteration speed', 'Low-cost variants', 'Enough control for review'],
    fr: ['Vitesse d’itération', 'Variantes à coût réduit', 'Contrôle suffisant pour valider'],
    es: ['Velocidad de iteración', 'Variantes de bajo precio', 'Control suficiente para revisar'],
  },
  'stylized-anime': {
    en: ['Stylized motion', 'Illustration coherence', 'Non-photoreal flexibility'],
    fr: ['Mouvement stylisé', 'Cohérence d’illustration', 'Flexibilité non photoréaliste'],
    es: ['Movimiento estilizado', 'Coherencia de ilustración', 'Flexibilidad no fotorrealista'],
  },
};

export const USECASE_CHIPS: Record<string, Record<AppLocale, string[]>> = {
  'image-to-video': {
    en: ['Image fidelity', 'Motion control', 'Subject lock', 'Reference frames', 'Cost control'],
    fr: ['Fidélité image', 'Contrôle du mouvement', 'Sujet verrouillé', 'Frames de référence', 'Contrôle du coût'],
    es: ['Fidelidad de imagen', 'Control de movimiento', 'Sujeto estable', 'Frames de referencia', 'Control de precio'],
  },
  'cinematic-realism': {
    en: ['Camera language', 'Lighting', 'Motion physics', 'Visual polish', 'Cost control'],
    fr: ['Langage caméra', 'Lumière', 'Physique du mouvement', 'Rendu visuel', 'Contrôle du coût'],
    es: ['Lenguaje de cámara', 'Iluminación', 'Física del movimiento', 'Pulido visual', 'Control de precio'],
  },
  'character-reference': {
    en: ['Identity lock', 'Wardrobe', 'Props', 'Shot continuity', 'Input limits'],
    fr: ['Identité verrouillée', 'Tenue', 'Accessoires', 'Continuité des plans', 'Limites d’entrée'],
    es: ['Identidad estable', 'Vestuario', 'Props', 'Continuidad de planos', 'Límites de entrada'],
  },
  'reference-to-video': {
    en: ['References', 'Style frames', 'Audio cues', 'Product consistency', 'Output control'],
    fr: ['Références', 'Style frames', 'Repères audio', 'Cohérence produit', 'Contrôle du rendu'],
    es: ['Referencias', 'Style frames', 'Señales de audio', 'Consistencia de producto', 'Control de salida'],
  },
  'multi-shot-video': {
    en: ['Shot order', 'Continuity', 'Scene labels', 'Prompt structure', 'Final edit'],
    fr: ['Ordre des plans', 'Continuité', 'Labels de scène', 'Structure du prompt', 'Montage final'],
    es: ['Orden de planos', 'Continuidad', 'Etiquetas de escena', 'Estructura del prompt', 'Edición final'],
  },
  '4k-video': {
    en: ['Native 4K', 'Detail retention', 'Upscale path', 'Final delivery', 'Cost control'],
    fr: ['4K native', 'Détails conservés', 'Chemin upscale', 'Livraison finale', 'Contrôle du coût'],
    es: ['4K nativo', 'Retención de detalle', 'Ruta de upscale', 'Entrega final', 'Control de precio'],
  },
  ads: {
    en: ['Product clarity', 'Offer framing', 'Visual polish', 'Variant testing', 'Review speed'],
    fr: ['Clarté produit', 'Angle offre', 'Rendu propre', 'Tests de variantes', 'Vitesse de review'],
    es: ['Claridad de producto', 'Marco de oferta', 'Pulido visual', 'Pruebas de variantes', 'Velocidad de revisión'],
  },
  'ugc-ads': {
    en: ['Creator realism', 'Dialogue', 'Face consistency', 'Hook testing', 'Social proof'],
    fr: ['Réalisme créateur', 'Dialogue', 'Cohérence visage', 'Tests de hooks', 'Preuve sociale'],
    es: ['Realismo de creador', 'Diálogo', 'Consistencia facial', 'Pruebas de hooks', 'Prueba social'],
  },
  'product-videos': {
    en: ['Packshot stability', 'Textures', 'Clean reveals', 'Ecommerce motion', 'Brand fit'],
    fr: ['Stabilité packshot', 'Textures', 'Reveals propres', 'Mouvement ecommerce', 'Fit marque'],
    es: ['Estabilidad de packshot', 'Texturas', 'Reveals limpios', 'Movimiento ecommerce', 'Encaje de marca'],
  },
  'lipsync-dialogue': {
    en: ['Mouth timing', 'Voice sync', 'Face consistency', 'Audio options', 'Short dialogue'],
    fr: ['Timing bouche', 'Sync voix', 'Cohérence visage', 'Options audio', 'Dialogue court'],
    es: ['Timing de boca', 'Sync de voz', 'Consistencia facial', 'Opciones de audio', 'Diálogo corto'],
  },
  'fast-drafts': {
    en: ['Speed', 'Low cost', 'Rough timing', 'Variant testing', 'Review loop'],
    fr: ['Vitesse', 'Coût bas', 'Timing brouillon', 'Tests de variantes', 'Boucle de review'],
    es: ['Velocidad', 'Bajo precio', 'Timing preliminar', 'Pruebas de variantes', 'Ciclo de revisión'],
  },
  'stylized-anime': {
    en: ['Line quality', 'Style consistency', 'Color blocks', 'Stylized motion', 'Creative tests'],
    fr: ['Qualité du trait', 'Cohérence de style', 'Aplats de couleur', 'Mouvement stylisé', 'Tests créatifs'],
    es: ['Calidad de línea', 'Consistencia de estilo', 'Bloques de color', 'Movimiento estilizado', 'Pruebas creativas'],
  },
};

export const DECISION_CRITERIA_FILLERS: Record<AppLocale, string[]> = {
  en: ['Cost efficiency and speed', 'Reliability and consistency'],
  fr: ['Efficacité coût et vitesse', 'Fiabilité et cohérence'],
  es: ['Eficiencia de precio y velocidad', 'Fiabilidad y consistencia'],
};

export const USECASE_MISTAKE_FALLBACKS: Record<AppLocale, string[]> = {
  en: [
    'Choosing a model without matching the use case.',
    'Ignoring references, style frames, or input limits.',
    'Overcomplicating the first-pass prompt.',
    'Skipping draft passes and going straight to premium.',
    'Not checking cost before generation.',
  ],
  fr: [
    'Choisir un modèle sans matcher le cas d’usage.',
    'Ignorer les références, style frames ou limites d’input.',
    'Complexifier le prompt dès la première passe.',
    'Sauter les tests et aller directement sur du premium.',
    'Ne pas vérifier le coût avant génération.',
  ],
  es: [
    'Elegir un modelo sin ajustar el objetivo creativo.',
    'Ignorar referencias, style frames o límites de entrada.',
    'Complicar demasiado el primer prompt.',
    'Saltar los borradores e ir directo a premium.',
    'No revisar el precio antes de generar.',
  ],
};
