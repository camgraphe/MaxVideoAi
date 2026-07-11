import type { AppLocale } from '@/i18n/locales';

export type BenchmarkCopy = {
  meta: { title: string; description: string };
  hero: { eyebrow: string; title: string; intro: string; proof: string };
  nav: { scores: string; specs: string; speed: string; method: string };
  evidence: Array<{ title: string; body: string }>;
  scores: { title: string; intro: string; model: string; overall: string; updated: string; source: string };
  specs: {
    title: string;
    intro: string;
    source: string;
    modes: string;
    audio: string;
    references: string;
    modeLabels: Record<'textToVideo' | 'imageToVideo' | 'videoToVideo', string>;
  };
  latency: { title: string; intro: string; median: string; p90: string; window: string; unavailable: string; more: string };
  methodology: {
    title: string;
    intro: string;
    formula: string;
    prompts: string;
    canonicalPrompt: string;
    limitations: string;
    changelog: string;
    criteria: Record<string, { label: string; definition: string }>;
    methodNotes: string[];
    initialRelease: string;
  };
  refundNote: string;
  cta: { title: string; body: string; models: string; compare: string; pricing: string; generate: string };
  scoreLabels: Array<{ id: string; label: string }>;
};

const SCORE_LABELS = {
  en: ['Prompt', 'Visual', 'Motion', 'Consistency', 'Human', 'Text', 'Audio', 'Sequencing', 'Control', 'Stability', 'Value'],
  fr: ['Prompt', 'Visuel', 'Mouvement', 'Cohérence', 'Humain', 'Texte', 'Audio', 'Séquences', 'Contrôle', 'Stabilité', 'Valeur'],
  es: ['Prompt', 'Visual', 'Movimiento', 'Consistencia', 'Personas', 'Texto', 'Audio', 'Secuencias', 'Control', 'Estabilidad', 'Valor'],
} as const;

const SCORE_IDS = ['fidelity', 'visualQuality', 'motion', 'consistency', 'anatomy', 'textRendering', 'lipsyncQuality', 'sequencingQuality', 'controllability', 'speedStability', 'pricing'];

const COPY: Record<AppLocale, Omit<BenchmarkCopy, 'scoreLabels'>> = {
  en: {
    meta: { title: 'AI Video Model Benchmarks & Methodology', description: 'Compare MaxVideoAI editorial scores, sourced AI video model specifications, and observed median and P90 generation times.' },
    hero: { eyebrow: 'MaxVideoAI Research', title: 'AI video model benchmarks, explained', intro: 'Compare editorial quality scores, sourced model capabilities, and observed generation times in one clear research hub.', proof: 'Built from MaxVideoAI scorecards, current model specifications, and anonymized production latency.' },
    nav: { scores: 'Scorecards', specs: 'Specifications', speed: 'Observed speed', method: 'Methodology' },
    evidence: [
      { title: 'Editorial scores', body: 'A consistent 0–10 framework for quality, motion, control, and production fit.' },
      { title: 'Sourced specifications', body: 'Current capabilities checked against provider sources and the MaxVideoAI route.' },
      { title: 'Observed speed', body: 'Rolling 30-day median and P90 generation time for eligible models.' }
    ],
    scores: { title: 'Model scorecards', intro: 'Compare the current MaxVideoAI editorial view across eleven production criteria.', model: 'Model', overall: 'Overall score (0–10)', updated: 'Score updated', source: 'MaxVideoAI editorial score' },
    specs: { title: 'Verified model specifications', intro: 'Review the limits and workflows exposed through MaxVideoAI.', source: 'Source', modes: 'Input modes', audio: 'Audio', references: 'References', modeLabels: { textToVideo: 'Text → video', imageToVideo: 'Image → video', videoToVideo: 'Video → video' } },
    latency: { title: 'Observed generation times', intro: 'Median and P90 end-to-end generation time over a rolling 30-day window.', median: 'Median', p90: 'P90', window: 'Rolling 30 days', unavailable: 'The current latency snapshot is being refreshed.', more: 'Additional models appear as their rolling history matures.' },
    methodology: {
      title: 'How the scores work', intro: 'One scoring language, one overall formula, and one canonical prompt pack for future documented runs.', formula: 'Overall score formula', prompts: 'Canonical prompt pack', canonicalPrompt: 'Canonical prompt — English', limitations: 'Method notes', changelog: 'Methodology updates',
      criteria: {
        fidelity: { label: 'Prompt adherence', definition: 'How closely the output follows requested subjects, actions, composition, and constraints.' },
        visualQuality: { label: 'Visual quality', definition: 'Perceived detail, realism, lighting, material rendering, and absence of visible artifacts.' },
        motion: { label: 'Motion realism', definition: 'Smoothness, physical plausibility, camera movement, and temporal behavior of moving subjects.' },
        consistency: { label: 'Temporal consistency', definition: 'Identity, object, background, and style stability across the generated clip.' },
        anatomy: { label: 'Human fidelity', definition: 'Faces, hands, limbs, body proportions, contact, and human-object interactions.' },
        textRendering: { label: 'Text legibility', definition: 'Accuracy and stability of requested words, labels, interface elements, and signage.' },
        lipsyncQuality: { label: 'Audio and lip sync', definition: 'Alignment between visible speech, dialogue timing, and generated audio when supported.' },
        sequencingQuality: { label: 'Multi-shot sequencing', definition: 'Continuity, narrative order, and identity preservation across explicit shot changes.' },
        controllability: { label: 'Controllability', definition: 'Reliability of camera, reference, framing, and other supported production controls.' },
        speedStability: { label: 'Speed and stability', definition: 'Editorial assessment of delivery consistency; observed median and P90 latency are published separately.' },
        pricing: { label: 'Value score', definition: 'Relative production value at the current MaxVideoAI price position; live pricing remains on pricing and generation surfaces.' }
      },
      methodNotes: ['Generative outputs vary between runs.', 'Not every model supports every criterion or prompt type.', 'Provider capacity and queues change over time.', 'Observed production traffic is not a controlled experiment.', 'MaxVideoAI sells access to the compared models and discloses that commercial interest.'],
      initialRelease: 'Initial score definitions, overall formula, canonical prompt pack, and rolling latency rules.'
    },
    refundNote: 'Failed paid generations are automatically refunded.',
    cta: { title: 'Choose the right model for the next shot', body: 'Move from research to model specs, side-by-side comparisons, live pricing, or generation.', models: 'Browse video models', compare: 'Compare models', pricing: 'View pricing', generate: 'Generate video' }
  },
  fr: {
    meta: { title: 'Benchmarks des modèles vidéo IA et méthodologie', description: 'Comparez les scores éditoriaux MaxVideoAI, les spécifications sourcées et les temps de génération médians et P90 observés.' },
    hero: { eyebrow: 'Recherche MaxVideoAI', title: 'Les benchmarks des modèles vidéo IA, expliqués', intro: 'Comparez scores éditoriaux, capacités sourcées et temps de génération observés dans un même espace clair.', proof: 'Construit à partir des scorecards MaxVideoAI, des spécifications actuelles et de la latence de production anonymisée.' },
    nav: { scores: 'Scorecards', specs: 'Spécifications', speed: 'Vitesse observée', method: 'Méthodologie' },
    evidence: [
      { title: 'Scores éditoriaux', body: 'Un cadre cohérent sur 10 pour la qualité, le mouvement, le contrôle et le fit production.' },
      { title: 'Spécifications sourcées', body: 'Des capacités vérifiées selon les sources fournisseur et la route MaxVideoAI.' },
      { title: 'Vitesse observée', body: 'Médiane et P90 sur 30 jours glissants pour les modèles éligibles.' }
    ],
    scores: { title: 'Scorecards des modèles', intro: 'Comparez la lecture éditoriale MaxVideoAI actuelle sur onze critères de production.', model: 'Modèle', overall: 'Score global (0–10)', updated: 'Score mis à jour', source: 'Score éditorial MaxVideoAI' },
    specs: { title: 'Spécifications vérifiées', intro: 'Consultez les limites et workflows réellement exposés dans MaxVideoAI.', source: 'Source', modes: 'Modes d’entrée', audio: 'Audio', references: 'Références', modeLabels: { textToVideo: 'Texte → vidéo', imageToVideo: 'Image → vidéo', videoToVideo: 'Vidéo → vidéo' } },
    latency: { title: 'Temps de génération observés', intro: 'Médiane et P90 du temps de génération de bout en bout sur 30 jours glissants.', median: 'Médiane', p90: 'P90', window: '30 jours glissants', unavailable: 'La mesure de latence actuelle est en cours d’actualisation.', more: 'D’autres modèles apparaissent à mesure que leur historique se consolide.' },
    methodology: {
      title: 'Comment fonctionnent les scores', intro: 'Un langage de notation commun, une formule globale et un pack de prompts canonique pour les futurs tests documentés.', formula: 'Formule du score global', prompts: 'Pack de prompts canonique', canonicalPrompt: 'Prompt canonique — anglais', limitations: 'Notes méthodologiques', changelog: 'Mises à jour de la méthode',
      criteria: {
        fidelity: { label: 'Respect du prompt', definition: 'Fidélité du résultat aux sujets, actions, cadrage et contraintes demandés.' },
        visualQuality: { label: 'Qualité visuelle', definition: 'Niveau de détail, réalisme, lumière, rendu des matières et absence d’artefacts visibles.' },
        motion: { label: 'Réalisme du mouvement', definition: 'Fluidité, plausibilité physique, mouvements de caméra et comportement temporel des sujets.' },
        consistency: { label: 'Cohérence temporelle', definition: 'Stabilité des identités, objets, décors et styles pendant toute la vidéo.' },
        anatomy: { label: 'Fidélité humaine', definition: 'Visages, mains, membres, proportions, contacts et interactions entre personnes et objets.' },
        textRendering: { label: 'Lisibilité du texte', definition: 'Exactitude et stabilité des mots, étiquettes, interfaces et panneaux demandés.' },
        lipsyncQuality: { label: 'Audio et synchronisation labiale', definition: 'Alignement entre la parole visible, le dialogue et l’audio généré lorsque cette fonction est disponible.' },
        sequencingQuality: { label: 'Enchaînement multi-plans', definition: 'Continuité, ordre narratif et préservation des identités entre plusieurs plans.' },
        controllability: { label: 'Contrôlabilité', definition: 'Fiabilité des contrôles de caméra, références, cadrage et autres réglages de production.' },
        speedStability: { label: 'Vitesse et stabilité', definition: 'Évaluation éditoriale de la régularité de livraison ; la médiane et le P90 observés sont publiés séparément.' },
        pricing: { label: 'Rapport valeur-prix', definition: 'Valeur de production relative au positionnement tarifaire actuel de MaxVideoAI ; les prix live restent sur les pages tarifaires et de génération.' }
      },
      methodNotes: ['Les résultats génératifs peuvent varier d’un essai à l’autre.', 'Tous les modèles ne prennent pas en charge chaque critère ou type de prompt.', 'La capacité et les files d’attente des fournisseurs évoluent.', 'Le trafic de production observé n’est pas une expérience contrôlée.', 'MaxVideoAI commercialise l’accès aux modèles comparés et déclare cet intérêt commercial.'],
      initialRelease: 'Première version des définitions, de la formule globale, du pack de prompts canonique et des règles de latence glissante.'
    },
    refundNote: 'Les générations payantes échouées sont automatiquement remboursées.',
    cta: { title: 'Choisissez le bon modèle pour votre prochain plan', body: 'Passez de la recherche aux fiches modèles, comparaisons, prix live ou à la génération.', models: 'Voir les modèles vidéo', compare: 'Comparer les modèles', pricing: 'Voir les tarifs', generate: 'Générer une vidéo' }
  },
  es: {
    meta: { title: 'Benchmarks de modelos de video IA y metodología', description: 'Compara puntuaciones editoriales de MaxVideoAI, especificaciones con fuentes y tiempos de generación medianos y P90 observados.' },
    hero: { eyebrow: 'Investigación de MaxVideoAI', title: 'Benchmarks de modelos de video IA, explicados', intro: 'Compara puntuaciones editoriales de modelos de video, capacidades con fuentes y tiempos de generación observados en un solo centro de investigación.', proof: 'Creado con scorecards de MaxVideoAI, especificaciones actuales y latencia de producción anonimizada.' },
    nav: { scores: 'Scorecards', specs: 'Especificaciones', speed: 'Velocidad observada', method: 'Metodología' },
    evidence: [
      { title: 'Puntuaciones editoriales', body: 'Un marco coherente de 0 a 10 para calidad, movimiento, control y uso en producción.' },
      { title: 'Especificaciones con fuentes', body: 'Capacidades actuales verificadas con fuentes del proveedor y la ruta de MaxVideoAI.' },
      { title: 'Velocidad observada', body: 'Mediana y P90 de 30 días para modelos con historial suficiente.' }
    ],
    scores: { title: 'Scorecards de modelos', intro: 'Compara la evaluación editorial actual de MaxVideoAI en once criterios de producción.', model: 'Modelo', overall: 'Puntuación global (0–10)', updated: 'Puntuación actualizada', source: 'Puntuación editorial de MaxVideoAI' },
    specs: { title: 'Especificaciones verificadas', intro: 'Revisa los límites y flujos disponibles en MaxVideoAI.', source: 'Fuente', modes: 'Modos de entrada', audio: 'Audio', references: 'Referencias', modeLabels: { textToVideo: 'Texto → video', imageToVideo: 'Imagen → video', videoToVideo: 'Video → video' } },
    latency: { title: 'Tiempos de generación observados', intro: 'Mediana y P90 del tiempo total de generación durante una ventana móvil de 30 días.', median: 'Mediana', p90: 'P90', window: '30 días móviles', unavailable: 'La medición de latencia se está actualizando.', more: 'Aparecerán más modelos cuando su historial móvil esté consolidado.' },
    methodology: {
      title: 'Cómo funcionan las puntuaciones', intro: 'Un lenguaje de evaluación, una fórmula global y un pack de prompts canónico para futuras pruebas documentadas.', formula: 'Fórmula de puntuación global', prompts: 'Pack de prompts canónico', canonicalPrompt: 'Prompt canónico — inglés', limitations: 'Notas metodológicas', changelog: 'Actualizaciones de metodología',
      criteria: {
        fidelity: { label: 'Fidelidad al prompt', definition: 'Qué tan fielmente el resultado sigue los sujetos, acciones, composición y restricciones solicitados.' },
        visualQuality: { label: 'Calidad visual', definition: 'Detalle percibido, realismo, iluminación, materiales y ausencia de artefactos visibles.' },
        motion: { label: 'Realismo del movimiento', definition: 'Fluidez, plausibilidad física, movimiento de cámara y comportamiento temporal de los sujetos.' },
        consistency: { label: 'Consistencia temporal', definition: 'Estabilidad de identidades, objetos, fondos y estilos a lo largo del video.' },
        anatomy: { label: 'Fidelidad humana', definition: 'Rostros, manos, extremidades, proporciones, contacto e interacción entre personas y objetos.' },
        textRendering: { label: 'Legibilidad del texto', definition: 'Precisión y estabilidad de palabras, etiquetas, interfaces y letreros solicitados.' },
        lipsyncQuality: { label: 'Audio y sincronización labial', definition: 'Alineación entre el habla visible, el diálogo y el audio generado cuando la función está disponible.' },
        sequencingQuality: { label: 'Secuencias de varias tomas', definition: 'Continuidad, orden narrativo y preservación de identidades entre cambios de toma.' },
        controllability: { label: 'Control', definition: 'Confiabilidad de la cámara, referencias, encuadre y otros controles de producción disponibles.' },
        speedStability: { label: 'Velocidad y estabilidad', definition: 'Evaluación editorial de la consistencia de entrega; la mediana y el P90 observados se publican por separado.' },
        pricing: { label: 'Relación valor-precio', definition: 'Valor de producción relativo al precio actual en MaxVideoAI; los precios en vivo permanecen en las páginas de precios y generación.' }
      },
      methodNotes: ['Los resultados generativos pueden variar entre ejecuciones.', 'No todos los modelos admiten cada criterio o tipo de prompt.', 'La capacidad y las colas de los proveedores cambian con el tiempo.', 'El tráfico de producción observado no es un experimento controlado.', 'MaxVideoAI vende acceso a los modelos comparados y declara ese interés comercial.'],
      initialRelease: 'Primera versión de las definiciones, la fórmula global, el pack de prompts canónico y las reglas de latencia móvil.'
    },
    refundNote: 'Las generaciones pagadas que fallan se reembolsan automáticamente.',
    cta: { title: 'Elige el modelo adecuado para tu siguiente toma', body: 'Pasa de la investigación a las fichas de modelo, comparaciones, precios en vivo o generación.', models: 'Ver modelos de video', compare: 'Comparar modelos', pricing: 'Ver precios', generate: 'Generar video' }
  }
};

export function getBenchmarkCopy(locale: AppLocale): BenchmarkCopy {
  return {
    ...(COPY[locale] ?? COPY.en),
    scoreLabels: SCORE_IDS.map((id, index) => ({ id, label: SCORE_LABELS[locale][index] ?? SCORE_LABELS.en[index]! })),
  };
}
