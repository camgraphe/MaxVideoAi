import type { AppLocale } from '@/i18n/locales';

export type ExampleFaqItem = {
  question: string;
  answer: string;
};

export type ExampleSectionItem = {
  title: string;
  body: string;
};

export type ExampleModelLanding = {
  slug: string;
  label: string;
  metaTitle: string;
  metaDescription: string;
  heroTitle: string;
  heroSubtitle: string;
  intro: string;
  summary: string;
  sections: ExampleSectionItem[];
  faqTitle: string;
  faqItems: ExampleFaqItem[];
};

const CANONICAL_SLUGS = ['sora', 'veo', 'wan', 'kling', 'seedance', 'ltx-2', 'pika', 'hailuo'] as const;
type CanonicalSlug = (typeof CANONICAL_SLUGS)[number];

const MODEL_LABELS: Record<AppLocale, Record<CanonicalSlug, string>> = {
  en: {
    sora: 'Sora',
    veo: 'Veo',
    wan: 'Wan',
    kling: 'Kling',
    seedance: 'Seedance',
    'ltx-2': 'LTX-2',
    pika: 'Pika',
    hailuo: 'Hailuo',
  },
  fr: {
    sora: 'Sora',
    veo: 'Veo',
    wan: 'Wan',
    kling: 'Kling',
    seedance: 'Seedance',
    'ltx-2': 'LTX-2',
    pika: 'Pika',
    hailuo: 'Hailuo',
  },
  es: {
    sora: 'Sora',
    veo: 'Veo',
    wan: 'Wan',
    kling: 'Kling',
    seedance: 'Seedance',
    'ltx-2': 'LTX-2',
    pika: 'Pika',
    hailuo: 'Hailuo',
  },
};

const MODEL_VARIANTS_BY_SLUG: Record<CanonicalSlug, string[]> = {
  sora: ['OpenAI Sora 2 Pro', 'OpenAI Sora 2'],
  veo: ['Google Veo 3.1', 'Google Veo 3.1 Fast', 'Google Veo 3.1 First/Last'],
  wan: ['Wan 2.6 Text & Image to Video', 'Wan 2.5 Text & Image to Video'],
  kling: ['Kling 3 Pro', 'Kling 3 Standard', 'Kling 2.6 Pro', 'Kling 2.5 Turbo'],
  seedance: ['Seedance 1.5 Pro'],
  'ltx-2': ['LTX Video 2.0 Pro', 'LTX Video 2.0 Fast'],
  pika: ['Pika 2.2 Text & Image to Video'],
  hailuo: ['MiniMax Hailuo 02 Standard'],
};

type LocalizedModelDescriptor = {
  subtitle: string;
  intro: string;
  promptPatterns: string;
  strengthsLimits: string;
  pricingNotes: string;
  faq: ExampleFaqItem[];
};

const EN_MODEL_DATA: Record<CanonicalSlug, LocalizedModelDescriptor> = {
  sora: {
    subtitle: 'Cinematic examples, reusable prompts, and shot-level settings for Sora workflows.',
    intro:
      'Use this page to review real Sora examples before you run new renders. You can inspect prompt style, duration, and framing patterns that usually perform well on cinematic scenes, product storytelling, and social cuts. The goal is to help you recreate outputs consistently without mixing unrelated model behavior.',
    promptPatterns:
      'Start with scene intent, camera movement, and a clear subject anchor. Sora examples perform best when prompts separate composition, motion, and lighting constraints in short blocks.',
    strengthsLimits:
      'Sora generally excels in cinematic coherence and polished motion. Limits vary by mode and queue conditions, so keep test runs short before scaling to longer variants.',
    pricingNotes:
      'Pricing depends on duration, resolution, and add-ons. Use the visible per-clip pricing to compare Sora runs against other engines before batch generation.',
    faq: [
      {
        question: 'What prompts work best for Sora examples?',
        answer: 'Structured prompts with clear subject, camera, and motion constraints are the most reliable baseline.',
      },
      {
        question: 'Are these Sora examples reusable in the workspace?',
        answer: 'Yes. You can clone examples and adapt duration, resolution, and style details to your own brief.',
      },
      {
        question: 'How should I budget Sora test runs?',
        answer: 'Start with short test clips, validate motion and composition, then upscale winning variants.',
      },
    ],
  },
  veo: {
    subtitle: 'Reference-friendly Veo examples with prompts, format choices, and practical settings.',
    intro:
      'This Veo examples page focuses on motion consistency, framing control, and practical prompt templates. It is built for teams that need predictable behavior across ad variations, branded shots, and short narrative sequences. Use these examples as operational baselines, not as one-off inspiration only.',
    promptPatterns:
      'Veo examples usually improve when prompts specify shot objective first, then movement and lighting. Keep reference cues explicit when using image-led workflows.',
    strengthsLimits:
      'Veo is strong on controllable framing and consistent movement in short runs. Capability details still vary by mode, so verify available options before large jobs.',
    pricingNotes:
      'Per-clip price changes with duration, resolution, and audio behavior. Keep a stable preset to compare Veo outputs across multiple briefs.',
    faq: [
      {
        question: 'Can I use these Veo examples for image-led workflows?',
        answer: 'Yes. Many examples are designed for text-plus-reference usage and can be adapted to your source assets.',
      },
      {
        question: 'How do I keep Veo outputs consistent?',
        answer: 'Reuse a stable prompt structure, keep camera language explicit, and iterate from one validated baseline.',
      },
      {
        question: 'Where can I compare Veo pricing quickly?',
        answer: 'Open the pricing surface from this page and compare equivalent durations and resolutions side by side.',
      },
    ],
  },
  wan: {
    subtitle: 'Wan examples for structured prompts, transitions, and reference-driven consistency.',
    intro:
      'These Wan examples are curated for multi-beat shots, smooth transitions, and reference-aware sequences. They are useful when you need controlled pacing rather than random variation. Review the examples here before cloning so your first run starts with realistic expectations on motion and continuity.',
    promptPatterns:
      'Wan prompts work best with concise beat structure: setup, action, and close. Explicit transition language helps keep cuts and pacing cleaner.',
    strengthsLimits:
      'Wan is often reliable for short structured sequences and reference-guided continuity. Keep prompts focused to reduce drift across longer action chains.',
    pricingNotes:
      'Price varies by mode and clip settings. Validate cost on a short baseline run, then expand successful shots into multi-variant batches.',
    faq: [
      {
        question: 'Are Wan examples optimized for multi-shot prompts?',
        answer: 'Yes. Most examples are built around short structured beats with explicit transitions.',
      },
      {
        question: 'Can I adapt Wan examples to vertical formats?',
        answer: 'Yes. Keep the core motion brief and update framing, ratio, and pacing for vertical output.',
      },
      {
        question: 'What is the safest way to test Wan pricing?',
        answer: 'Run one short clip at your target format, then scale once output quality is validated.',
      },
    ],
  },
  kling: {
    subtitle: 'Kling examples focused on motion clarity, stylization control, and reusable prompt layouts.',
    intro:
      'This page groups practical Kling examples for teams that need fast iteration with controlled style and movement. Use it to benchmark what prompt patterns and settings lead to stable outputs for social creatives, product visuals, and cinematic edits. The page is intentionally model-specific to avoid overlap with general hub guidance.',
    promptPatterns:
      'Use direct action verbs, short scene constraints, and one camera instruction at a time. Kling examples usually degrade when prompts bundle too many style goals.',
    strengthsLimits:
      'Kling can deliver strong stylized motion and quick iterations. Keep constraints clear to prevent composition drift across multiple variants.',
    pricingNotes:
      'Use fixed duration/resolution presets when comparing Kling outputs with other engines to keep pricing comparisons meaningful.',
    faq: [
      {
        question: 'What kind of prompts are most reliable for Kling?',
        answer: 'Short prompts with one visual objective and clear camera motion usually produce the most stable results.',
      },
      {
        question: 'Can I reuse Kling examples for ad creatives?',
        answer: 'Yes. Start from these templates and adapt subject, copy, and pacing to your campaign needs.',
      },
      {
        question: 'How should I compare Kling cost against alternatives?',
        answer: 'Keep identical duration and resolution, then compare per-clip pricing and output quality.',
      },
    ],
  },
  seedance: {
    subtitle: 'Seedance examples for controlled motion, camera intent, and practical prompt reuse.',
    intro:
      'Seedance examples here are meant for teams that prioritize camera consistency and predictable scene behavior. They provide a concrete starting point for ad shots, product reveals, and short branded narratives. Each example is structured to be cloned quickly without mixing unrelated model assumptions.',
    promptPatterns:
      'Lead with one core action, then define camera and environment constraints. Seedance runs respond best when the prompt sequence stays compact.',
    strengthsLimits:
      'Seedance tends to work well for controlled movement and steady framing. Keep scene complexity moderate to maintain consistency across variants.',
    pricingNotes:
      'Evaluate Seedance on equivalent presets before scaling. The clearest cost signal comes from matching duration, resolution, and audio conditions.',
    faq: [
      {
        question: 'Are these Seedance examples tuned for stable camera motion?',
        answer: 'Yes. Most examples prioritize camera clarity and low-drift movement patterns.',
      },
      {
        question: 'Can I use Seedance examples as production baselines?',
        answer: 'Yes. They are designed to be cloned and iterated with minimal setup changes.',
      },
      {
        question: 'What settings affect Seedance pricing most?',
        answer: 'Duration and resolution are the primary price drivers, followed by optional mode-specific add-ons.',
      },
    ],
  },
  'ltx-2': {
    subtitle: 'LTX-2 examples for fast iteration loops and repeatable prompt-to-video execution.',
    intro:
      'Use this page to explore LTX-2 examples that prioritize speed, repeatability, and consistent output framing. The intent is to help teams validate ideas quickly before committing to longer or higher-cost runs. Every section is model-specific so the guidance stays operational.',
    promptPatterns:
      'Use concise prompts with explicit subject and one camera action. LTX-2 examples perform better when constraints are concrete and short.',
    strengthsLimits:
      'LTX-2 is useful for high-velocity ideation and variant testing. For complex narratives, validate transitions in short segments before chaining.',
    pricingNotes:
      'Keep a fixed baseline preset for pricing checks. This helps isolate model differences from setting-related cost changes.',
    faq: [
      {
        question: 'When should I use LTX-2 examples first?',
        answer: 'Use them when you need rapid creative testing before committing to heavier final-quality runs.',
      },
      {
        question: 'How do I improve consistency in LTX-2 outputs?',
        answer: 'Reuse one validated prompt template and adjust only one variable per iteration.',
      },
      {
        question: 'Can I compare LTX-2 pricing with other engines from here?',
        answer: 'Yes. Use matching duration and resolution settings to keep comparisons accurate.',
      },
    ],
  },
  pika: {
    subtitle: 'Pika examples for short-form creative loops, stylized edits, and social-ready motion.',
    intro:
      'This Pika examples page is built for short-form, stylized output patterns. It helps creators and growth teams quickly clone proven motions, update prompt details, and publish social-ready variants without rebuilding settings from scratch. The content is intentionally focused on Pika behavior only.',
    promptPatterns:
      'Use style-first prompts with one clear action and concise camera direction. Pika examples usually improve when scene scope stays narrow.',
    strengthsLimits:
      'Pika is often effective for fast loops and stylized social visuals. Keep prompt structure simple to avoid unstable transitions.',
    pricingNotes:
      'Pricing is easiest to control with short durations and fixed output settings. Validate one successful template, then duplicate.',
    faq: [
      {
        question: 'What is the best way to reuse Pika examples?',
        answer: 'Clone a relevant example, keep the motion template, and swap only subject/style elements first.',
      },
      {
        question: 'Are Pika examples suitable for social ad variants?',
        answer: 'Yes. They are optimized for short, stylized, and iteration-friendly outputs.',
      },
      {
        question: 'How do I keep Pika costs predictable?',
        answer: 'Lock duration and resolution presets before running multiple variants.',
      },
    ],
  },
  hailuo: {
    subtitle: 'Hailuo examples for budget-friendly drafts, motion tests, and reference-based iteration.',
    intro:
      'This Hailuo examples page focuses on draft quality, motion validation, and practical prompt iteration. It is useful when you want low-cost exploration before rebuilding winners in premium engines. The guidance remains specific to Hailuo behavior to prevent hub-level duplication.',
    promptPatterns:
      'Use short prompts that define subject motion and camera intent first. Hailuo examples are more stable when prompts avoid overloaded style instructions.',
    strengthsLimits:
      'Hailuo is typically strong for early-stage motion tests and inexpensive concept passes. Validate complex shots in small steps for better consistency.',
    pricingNotes:
      'Treat Hailuo as a draft baseline: test cheaply, keep winners, then upscale or reroute as needed.',
    faq: [
      {
        question: 'Why use Hailuo examples before premium engines?',
        answer: 'They help validate motion ideas at lower cost before committing budget to higher-tier generation.',
      },
      {
        question: 'How should I structure Hailuo prompts?',
        answer: 'Keep prompts short and action-focused, with one clear camera directive.',
      },
      {
        question: 'What is the best pricing workflow for Hailuo?',
        answer: 'Run short draft tests first, then expand only the variants that meet your quality bar.',
      },
    ],
  },
};

const FR_MODEL_DATA: Record<CanonicalSlug, LocalizedModelDescriptor> = {
  sora: {
    subtitle: 'Exemples Sora orientés rendu cinématique, prompts réutilisables et réglages concrets.',
    intro:
      'Cette page rassemble des exemples Sora utilisables en production, avec prompts, durée et format déjà observés dans des rendus réels. L’objectif est de vous aider à reproduire des sorties cohérentes sans mélanger des comportements d’autres moteurs.',
    promptPatterns:
      'Commencez par l’intention du plan, puis précisez caméra, mouvement et lumière. Les prompts courts et structurés restent les plus fiables.',
    strengthsLimits:
      'Sora est souvent performant sur les plans cinématiques et la cohérence visuelle. Les limites dépendent du mode et du contexte de rendu.',
    pricingNotes:
      'Le coût varie selon durée, résolution et options. Vérifiez le prix par clip avant de lancer des lots.',
    faq: [
      {
        question: 'Quels prompts fonctionnent le mieux avec Sora ?',
        answer: 'Des prompts structurés, avec sujet, caméra et mouvement clairement séparés.',
      },
      {
        question: 'Peut-on cloner ces exemples Sora dans le workspace ?',
        answer: 'Oui. Les exemples sont conçus pour être réutilisés puis ajustés rapidement.',
      },
      {
        question: 'Comment contrôler le budget Sora ?',
        answer: 'Testez d’abord des clips courts, puis augmentez sur les variantes gagnantes.',
      },
    ],
  },
  veo: {
    subtitle: 'Exemples Veo orientés contrôle du cadrage, mouvement et workflows avec références.',
    intro:
      'Cette page Veo se concentre sur des patterns de prompts et de réglages utiles pour des rendus réguliers. Elle sert de base opérationnelle pour des variations pub, des plans de marque et des séquences courtes.',
    promptPatterns:
      'Décrivez d’abord l’objectif du plan, puis la caméra et l’ambiance. En mode référence, gardez les contraintes explicites.',
    strengthsLimits:
      'Veo apporte généralement un bon contrôle de cadrage et de mouvement sur des clips courts. Les capacités varient selon le mode actif.',
    pricingNotes:
      'Comparez les coûts avec des presets identiques (durée/résolution) pour isoler la différence moteur.',
    faq: [
      {
        question: 'Ces exemples Veo sont-ils adaptés aux workflows image ?',
        answer: 'Oui, plusieurs exemples sont pensés pour un usage texte + référence.',
      },
      {
        question: 'Comment garder des sorties Veo cohérentes ?',
        answer: 'Réutilisez une structure de prompt stable et modifiez une variable à la fois.',
      },
      {
        question: 'Où comparer rapidement les coûts Veo ?',
        answer: 'Depuis cette page, ouvrez le pricing avec les mêmes presets de durée et résolution.',
      },
    ],
  },
  wan: {
    subtitle: 'Exemples Wan pour séquences structurées, transitions propres et itération guidée.',
    intro:
      'Les exemples Wan de cette page sont pensés pour des séquences courtes à beats clairs et transitions maîtrisées. Ils servent de point de départ concret avant clonage en production.',
    promptPatterns:
      'Utilisez des prompts en 2 à 3 beats: setup, action, conclusion. La formulation explicite des transitions améliore la stabilité.',
    strengthsLimits:
      'Wan fonctionne bien sur des plans structurés et des variations de continuité courtes. Gardez des scènes simples pour limiter la dérive.',
    pricingNotes:
      'Commencez par un test court à paramètres cibles, puis élargissez aux variantes validées.',
    faq: [
      {
        question: 'Les exemples Wan sont-ils adaptés aux prompts multi-beats ?',
        answer: 'Oui, ils sont structurés pour des séquences courtes avec transitions explicites.',
      },
      {
        question: 'Peut-on adapter Wan aux formats verticaux ?',
        answer: 'Oui, en conservant la logique motion puis en ajustant le cadrage.',
      },
      {
        question: 'Quelle méthode de test prix pour Wan ?',
        answer: 'Validez un clip court en preset final avant de lancer des lots.',
      },
    ],
  },
  kling: {
    subtitle: 'Exemples Kling pour motion stylisé, itération rapide et prompts réutilisables.',
    intro:
      'Cette page Kling regroupe des exemples concrets pour produire des variantes social, produit et cinématiques avec un cadre de prompts stable. Elle reste volontairement spécifique au moteur.',
    promptPatterns:
      'Privilégiez des verbes d’action directs, une scène simple et une instruction caméra unique.',
    strengthsLimits:
      'Kling est efficace pour des rendus stylisés et des itérations rapides. Trop d’objectifs visuels dans un prompt peut dégrader la stabilité.',
    pricingNotes:
      'Pour comparer Kling correctement, conservez exactement la même durée et résolution entre moteurs.',
    faq: [
      {
        question: 'Quel style de prompt est le plus fiable avec Kling ?',
        answer: 'Des prompts courts avec un objectif visuel principal et une caméra explicite.',
      },
      {
        question: 'Ces exemples Kling conviennent-ils aux creatives ads ?',
        answer: 'Oui, ils sont conçus pour être clonés puis adaptés à vos variantes.',
      },
      {
        question: 'Comment comparer le coût Kling ?',
        answer: 'Fixez les mêmes presets et comparez prix + qualité de sortie.',
      },
    ],
  },
  seedance: {
    subtitle: 'Exemples Seedance orientés mouvement contrôlé et cadrage prévisible.',
    intro:
      'Les exemples Seedance ci-dessous servent de base pour des plans publicitaires, reveals produit et séquences de marque avec caméra stable. Le but est de faciliter la réutilisation rapide.',
    promptPatterns:
      'Un objectif de plan clair, puis contraintes caméra/environnement. Les prompts compacts donnent les résultats les plus réguliers.',
    strengthsLimits:
      'Seedance est utile quand vous cherchez une caméra stable et un mouvement lisible. Limitez la complexité de scène.',
    pricingNotes:
      'Comparez Seedance sur des presets identiques pour obtenir un signal coût fiable.',
    faq: [
      {
        question: 'Ces exemples Seedance sont-ils optimisés pour la stabilité caméra ?',
        answer: 'Oui, la plupart des exemples privilégient des mouvements lisibles et peu de dérive.',
      },
      {
        question: 'Peut-on utiliser ces exemples en base production ?',
        answer: 'Oui, ils sont conçus pour être clonés et ajustés rapidement.',
      },
      {
        question: 'Quels réglages impactent le plus le prix Seedance ?',
        answer: 'Principalement la durée, puis la résolution et les options de mode.',
      },
    ],
  },
  'ltx-2': {
    subtitle: 'Exemples LTX-2 pour itération rapide et exécution prompt-to-video reproductible.',
    intro:
      'Cette page LTX-2 est conçue pour valider des idées rapidement avec des sorties cohérentes. Elle aide à tester des variantes avant de pousser des rendus plus coûteux.',
    promptPatterns:
      'Utilisez des prompts concis avec sujet clair et un mouvement caméra unique.',
    strengthsLimits:
      'LTX-2 convient bien aux cycles d’itération rapides. Pour des récits complexes, validez par segments courts.',
    pricingNotes:
      'Conservez un preset de référence fixe pour comparer proprement les coûts.',
    faq: [
      {
        question: 'Quand utiliser d’abord des exemples LTX-2 ?',
        answer: 'Quand vous devez explorer rapidement des directions créatives.',
      },
      {
        question: 'Comment améliorer la cohérence LTX-2 ?',
        answer: 'Gardez une structure de prompt stable et modifiez une variable par test.',
      },
      {
        question: 'Peut-on comparer LTX-2 depuis cette page ?',
        answer: 'Oui, en gardant durée/résolution identiques entre moteurs.',
      },
    ],
  },
  pika: {
    subtitle: 'Exemples Pika pour boucles courtes, style social et montage rapide.',
    intro:
      'Cette page Pika cible les formats courts stylisés. Elle permet de cloner des patterns motion efficaces puis d’ajuster sujet et style sans refaire tout le setup.',
    promptPatterns:
      'Style d’abord, action principale ensuite, puis instruction caméra concise.',
    strengthsLimits:
      'Pika est souvent performant pour des boucles sociales rapides. Évitez les prompts surchargés pour réduire l’instabilité.',
    pricingNotes:
      'Le coût reste plus prévisible avec des durées courtes et des presets constants.',
    faq: [
      {
        question: 'Comment réutiliser efficacement un exemple Pika ?',
        answer: 'Clonez le pattern motion, puis ajustez seulement sujet et direction artistique.',
      },
      {
        question: 'Ces exemples Pika conviennent-ils aux variantes social ads ?',
        answer: 'Oui, ils sont pensés pour des déclinaisons rapides.',
      },
      {
        question: 'Comment garder des coûts Pika stables ?',
        answer: 'Fixez durée et résolution avant de lancer plusieurs variantes.',
      },
    ],
  },
  hailuo: {
    subtitle: 'Exemples Hailuo pour drafts économiques, tests motion et itération progressive.',
    intro:
      'Cette page Hailuo est orientée exploration à faible coût avant passage sur des moteurs premium. Elle sert à valider des idées de mouvement et de composition rapidement.',
    promptPatterns:
      'Privilégiez des prompts courts orientés action + intention caméra.',
    strengthsLimits:
      'Hailuo est utile pour des passes conceptuelles et tests motion. Pour des scènes complexes, avancez par étapes courtes.',
    pricingNotes:
      'Utilisez Hailuo comme baseline de draft, puis upscale/reroutez les variantes gagnantes.',
    faq: [
      {
        question: 'Pourquoi utiliser Hailuo avant un moteur premium ?',
        answer: 'Pour valider des directions visuelles avec un coût initial plus bas.',
      },
      {
        question: 'Comment structurer un prompt Hailuo ?',
        answer: 'Un prompt court, une action principale, une caméra claire.',
      },
      {
        question: 'Quelle stratégie budget avec Hailuo ?',
        answer: 'Tester court, sélectionner les meilleures sorties, puis monter en qualité.',
      },
    ],
  },
};

const ES_MODEL_DATA: Record<CanonicalSlug, LocalizedModelDescriptor> = {
  sora: {
    subtitle: 'Ejemplos de Sora con enfoque cinematográfico, prompts reutilizables y ajustes claros.',
    intro:
      'Esta página reúne ejemplos reales de Sora para clonar y ajustar en producción. El objetivo es ayudarte a repetir resultados con más consistencia usando prompts, duración y formato ya probados.',
    promptPatterns:
      'Define primero la intención del plano, luego cámara, movimiento e iluminación. Los prompts cortos y estructurados suelen funcionar mejor.',
    strengthsLimits:
      'Sora suele destacar en coherencia cinematográfica y movimiento pulido. Los límites dependen del modo y del contexto de render.',
    pricingNotes:
      'El precio cambia por duración, resolución y opciones activas. Revisa el coste por clip antes de escalar.',
    faq: [
      {
        question: '¿Qué prompts funcionan mejor en Sora?',
        answer: 'Prompts estructurados con sujeto, cámara y movimiento claramente separados.',
      },
      {
        question: '¿Puedo clonar estos ejemplos de Sora en el workspace?',
        answer: 'Sí, están diseñados para reutilizarse y adaptarse rápidamente.',
      },
      {
        question: '¿Cómo controlo el presupuesto en Sora?',
        answer: 'Empieza con clips cortos y escala solo las variantes ganadoras.',
      },
    ],
  },
  veo: {
    subtitle: 'Ejemplos de Veo orientados a control de encuadre, movimiento y referencias.',
    intro:
      'Esta página de Veo se centra en patrones de prompt y ajustes prácticos para conseguir resultados más estables. Es una base operativa para variantes de anuncios, tomas de marca y secuencias cortas.',
    promptPatterns:
      'Empieza por el objetivo del plano y luego concreta cámara y ambiente. En workflows con referencia, mantén las restricciones explícitas.',
    strengthsLimits:
      'Veo suele ofrecer buen control de encuadre y movimiento en clips cortos. Las capacidades varían según el modo activo.',
    pricingNotes:
      'Compara costes con presets iguales de duración y resolución para obtener señales limpias.',
    faq: [
      {
        question: '¿Estos ejemplos de Veo sirven para workflows con imagen?',
        answer: 'Sí, varios ejemplos están pensados para uso texto + referencia.',
      },
      {
        question: '¿Cómo mantengo consistencia en Veo?',
        answer: 'Reutiliza una estructura de prompt estable y cambia una variable por iteración.',
      },
      {
        question: '¿Dónde comparo rápido los costes de Veo?',
        answer: 'Abre pricing desde esta página usando presets equivalentes.',
      },
    ],
  },
  wan: {
    subtitle: 'Ejemplos de Wan para secuencias estructuradas, transiciones limpias y consistencia.',
    intro:
      'Los ejemplos de Wan de esta página están diseñados para secuencias cortas con beats claros y transiciones controladas. Son un punto de partida operativo antes de clonar en producción.',
    promptPatterns:
      'Usa prompts en 2-3 beats: inicio, acción y cierre. Las transiciones explícitas mejoran la estabilidad.',
    strengthsLimits:
      'Wan funciona bien en secuencias cortas estructuradas y continuidad guiada por referencia. Mantén escenas simples para reducir deriva.',
    pricingNotes:
      'Valida primero un clip corto con el preset objetivo y luego amplía a variantes.',
    faq: [
      {
        question: '¿Estos ejemplos de Wan están pensados para prompts multi-beat?',
        answer: 'Sí, están estructurados para secuencias cortas con transiciones claras.',
      },
      {
        question: '¿Puedo adaptar Wan a formatos verticales?',
        answer: 'Sí, conserva la lógica de movimiento y ajusta encuadre y ritmo.',
      },
      {
        question: '¿Cuál es la mejor forma de probar precio en Wan?',
        answer: 'Haz una prueba corta en preset final antes de lanzar lotes.',
      },
    ],
  },
  kling: {
    subtitle: 'Ejemplos de Kling para movimiento estilizado, iteración rápida y prompts reutilizables.',
    intro:
      'Esta página de Kling agrupa ejemplos prácticos para producir variantes sociales, de producto y creativas con un marco de prompt estable. Se mantiene específica del motor para evitar solapamiento con el hub.',
    promptPatterns:
      'Prioriza verbos de acción directos, una escena simple y una instrucción de cámara por toma.',
    strengthsLimits:
      'Kling suele rendir bien en motion estilizado y ciclos rápidos. Demasiados objetivos visuales en un prompt reducen estabilidad.',
    pricingNotes:
      'Para comparar Kling de forma justa, usa duración y resolución idénticas entre motores.',
    faq: [
      {
        question: '¿Qué estilo de prompt es más fiable en Kling?',
        answer: 'Prompts cortos con un objetivo visual principal y cámara explícita.',
      },
      {
        question: '¿Estos ejemplos de Kling sirven para creatividades de anuncios?',
        answer: 'Sí, están pensados para clonarse y adaptarse rápidamente.',
      },
      {
        question: '¿Cómo comparo coste en Kling?',
        answer: 'Mantén los mismos presets y compara precio junto con calidad de salida.',
      },
    ],
  },
  seedance: {
    subtitle: 'Ejemplos de Seedance para movimiento controlado y encuadre predecible.',
    intro:
      'Los ejemplos de Seedance en esta página sirven como base para tomas de anuncios, reveals de producto y secuencias de marca con cámara estable. El objetivo es acelerar la reutilización.',
    promptPatterns:
      'Define una acción central y luego restricciones de cámara y entorno. Los prompts compactos suelen dar resultados más estables.',
    strengthsLimits:
      'Seedance es útil cuando priorizas movimiento legible y cámara estable. Limita la complejidad de escena.',
    pricingNotes:
      'Compara Seedance con presets equivalentes para obtener una lectura de coste fiable.',
    faq: [
      {
        question: '¿Estos ejemplos de Seedance están optimizados para estabilidad de cámara?',
        answer: 'Sí, la mayoría prioriza movimiento claro y baja deriva.',
      },
      {
        question: '¿Puedo usar estos ejemplos como base de producción?',
        answer: 'Sí, están diseñados para clonar y ajustar con cambios mínimos.',
      },
      {
        question: '¿Qué ajustes impactan más el precio en Seedance?',
        answer: 'Principalmente duración y resolución, luego opciones específicas del modo.',
      },
    ],
  },
  'ltx-2': {
    subtitle: 'Ejemplos de LTX-2 para iteración rápida y ejecución prompt-to-video repetible.',
    intro:
      'Esta página de LTX-2 está diseñada para validar ideas rápido con salidas consistentes. Ayuda a probar variantes antes de pasar a renders más costosos.',
    promptPatterns:
      'Usa prompts concisos con sujeto claro y un movimiento de cámara principal.',
    strengthsLimits:
      'LTX-2 encaja bien en ciclos de iteración veloces. Para narrativas complejas, valida por segmentos cortos.',
    pricingNotes:
      'Mantén un preset base fijo para comparar costes de forma limpia.',
    faq: [
      {
        question: '¿Cuándo conviene empezar por ejemplos de LTX-2?',
        answer: 'Cuando necesitas explorar direcciones creativas con mucha velocidad.',
      },
      {
        question: '¿Cómo mejoro consistencia en LTX-2?',
        answer: 'Reutiliza una estructura estable y cambia una variable por prueba.',
      },
      {
        question: '¿Puedo comparar LTX-2 desde esta página?',
        answer: 'Sí, usando duración y resolución equivalentes entre motores.',
      },
    ],
  },
  pika: {
    subtitle: 'Ejemplos de Pika para loops cortos, estilo social y edición ágil.',
    intro:
      'Esta página de Pika se centra en formatos cortos y estilizados. Permite clonar patrones de motion probados y ajustar sujeto/estilo sin rehacer toda la configuración.',
    promptPatterns:
      'Empieza por el estilo, define la acción principal y añade una instrucción breve de cámara.',
    strengthsLimits:
      'Pika suele funcionar bien para loops sociales rápidos. Evita prompts sobrecargados para reducir inestabilidad.',
    pricingNotes:
      'El coste es más predecible con duraciones cortas y presets constantes.',
    faq: [
      {
        question: '¿Cómo reutilizo bien un ejemplo de Pika?',
        answer: 'Clona el patrón de movimiento y cambia primero sujeto y estilo.',
      },
      {
        question: '¿Estos ejemplos de Pika sirven para variantes de social ads?',
        answer: 'Sí, están pensados para iteraciones rápidas.',
      },
      {
        question: '¿Cómo mantengo costes estables en Pika?',
        answer: 'Fija duración y resolución antes de lanzar múltiples variantes.',
      },
    ],
  },
  hailuo: {
    subtitle: 'Ejemplos de Hailuo para borradores económicos, test de movimiento e iteración progresiva.',
    intro:
      'Esta página de Hailuo está orientada a exploración de bajo coste antes de pasar a motores premium. Sirve para validar ideas de movimiento y composición con rapidez.',
    promptPatterns:
      'Prioriza prompts cortos centrados en acción y dirección de cámara.',
    strengthsLimits:
      'Hailuo es útil para pases conceptuales y tests de motion. En escenas complejas, trabaja por pasos cortos.',
    pricingNotes:
      'Úsalo como baseline de borrador y escala solo las variantes que funcionen.',
    faq: [
      {
        question: '¿Por qué usar Hailuo antes de un motor premium?',
        answer: 'Porque permite validar dirección visual con un coste inicial más bajo.',
      },
      {
        question: '¿Cómo estructuro un prompt de Hailuo?',
        answer: 'Prompt corto, una acción principal y una cámara clara.',
      },
      {
        question: '¿Qué estrategia de presupuesto conviene en Hailuo?',
        answer: 'Probar corto, seleccionar mejores salidas y luego subir calidad.',
      },
    ],
  },
};

const HUB_FAQ_BY_LOCALE: Record<AppLocale, { title: string; items: ExampleFaqItem[] }> = {
  en: {
    title: 'Examples FAQ',
    items: [
      {
        question: 'Can I clone these examples directly?',
        answer: 'Yes. Open an example and reuse its prompt and settings as a starting point in your workspace.',
      },
      {
        question: 'Do examples include text-to-video and image-to-video?',
        answer: 'Yes. The gallery includes multiple input styles depending on what each model supports.',
      },
      {
        question: 'Is pricing shown for each example?',
        answer: 'Pricing is shown per clip so you can compare cost before running similar renders.',
      },
      {
        question: 'Why can two runs differ with the same prompt?',
        answer: 'Model behavior can vary by mode, settings, and queue context, even with the same prompt.',
      },
      {
        question: 'Where can I compare model specs and limits?',
        answer: 'Use the models pages for specs/limits and the engine hub for use-case decision workflows.',
      },
      {
        question: 'How do I pick the right engine for this shot?',
        answer: 'Start from example quality and cost, then validate with a short test run on your target format.',
      },
    ],
  },
  fr: {
    title: 'FAQ Exemples',
    items: [
      {
        question: 'Puis-je cloner ces exemples directement ?',
        answer: 'Oui. Ouvrez un exemple et réutilisez son prompt et ses réglages dans votre workspace.',
      },
      {
        question: 'Les exemples couvrent-ils texte-vers-vidéo et image-vers-vidéo ?',
        answer: 'Oui. La galerie regroupe plusieurs types d’entrées selon les capacités de chaque modèle.',
      },
      {
        question: 'Le prix est-il affiché pour chaque exemple ?',
        answer: 'Oui, un prix par clip est affiché pour comparer le coût avant de relancer.',
      },
      {
        question: 'Pourquoi deux runs diffèrent avec le même prompt ?',
        answer: 'Le comportement varie selon le mode, les réglages et le contexte de rendu.',
      },
      {
        question: 'Où comparer les specs et limites des modèles ?',
        answer: 'Utilisez les pages modèles pour les specs/limites et le hub moteurs pour la décision par use case.',
      },
      {
        question: 'Comment choisir le bon moteur pour ce plan ?',
        answer: 'Partir du niveau qualité/coût vu en exemples puis valider via un test court au format cible.',
      },
    ],
  },
  es: {
    title: 'FAQ de ejemplos',
    items: [
      {
        question: '¿Puedo clonar estos ejemplos directamente?',
        answer: 'Sí. Abre un ejemplo y reutiliza su prompt y ajustes en tu workspace.',
      },
      {
        question: '¿Los ejemplos incluyen texto a video e imagen a video?',
        answer: 'Sí. La galería incluye varios tipos de entrada según lo que soporte cada modelo.',
      },
      {
        question: '¿Se muestra el precio por ejemplo?',
        answer: 'Sí, el precio por clip se muestra para comparar coste antes de generar.',
      },
      {
        question: '¿Por qué dos ejecuciones cambian con el mismo prompt?',
        answer: 'El comportamiento varía por modo, ajustes y contexto de cola incluso con el mismo prompt.',
      },
      {
        question: '¿Dónde comparo specs y límites por modelo?',
        answer: 'Usa las páginas de modelos para specs/límites y el hub de motores para decisiones por caso de uso.',
      },
      {
        question: '¿Cómo elijo el motor correcto para esta toma?',
        answer: 'Compara calidad y coste en ejemplos y valida con una prueba corta en tu formato objetivo.',
      },
    ],
  },
};

export function getHubExamplesFaq(locale: AppLocale): { title: string; items: ExampleFaqItem[] } {
  return HUB_FAQ_BY_LOCALE[locale] ?? HUB_FAQ_BY_LOCALE.en;
}

export function getCanonicalExampleModelSlugs(): CanonicalSlug[] {
  return [...CANONICAL_SLUGS];
}

export function getExampleModelLabel(locale: AppLocale, slug: string): string | null {
  const normalized = slug.trim().toLowerCase() as CanonicalSlug;
  if (!CANONICAL_SLUGS.includes(normalized)) return null;
  return (MODEL_LABELS[locale] ?? MODEL_LABELS.en)[normalized];
}

function getLocalizedModelData(locale: AppLocale): Record<CanonicalSlug, LocalizedModelDescriptor> {
  if (locale === 'fr') return FR_MODEL_DATA;
  if (locale === 'es') return ES_MODEL_DATA;
  return EN_MODEL_DATA;
}

function formatLocalizedList(locale: AppLocale, items: string[]): string {
  if (!items.length) return '';
  if (items.length === 1) return items[0];
  const conjunction = locale === 'fr' ? 'et' : locale === 'es' ? 'y' : 'and';
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, ${conjunction} ${items[items.length - 1]}`;
}

export function getExampleModelLanding(locale: AppLocale, slug: string): ExampleModelLanding | null {
  const normalized = slug.trim().toLowerCase() as CanonicalSlug;
  if (!CANONICAL_SLUGS.includes(normalized)) return null;

  const label = (MODEL_LABELS[locale] ?? MODEL_LABELS.en)[normalized];
  const localized = getLocalizedModelData(locale)[normalized];
  const variants = MODEL_VARIANTS_BY_SLUG[normalized] ?? [];
  const variantsList = formatLocalizedList(locale, variants);
  const variantsSentence =
    variantsList.length > 0
      ? locale === 'fr'
        ? `Cette page regroupe ${variantsList}.`
        : locale === 'es'
          ? `Esta página reúne ${variantsList}.`
          : `This page includes ${variantsList}.`
      : locale === 'fr'
        ? `Cette page regroupe plusieurs modèles ${label}.`
        : locale === 'es'
          ? `Esta página reúne varios modelos de ${label}.`
          : `This page includes multiple ${label} models.`;
  const metaTitle =
    locale === 'fr'
      ? `Exemples vidéo IA ${label} (prompts + réglages) | MaxVideoAI`
      : locale === 'es'
        ? `Ejemplos de video con IA de ${label} (prompts + ajustes) | MaxVideoAI`
        : `${label} AI Video Examples (Prompts + Settings) | MaxVideoAI`;
  const sectionPromptTitle =
    locale === 'fr'
      ? `Prompts sur les modèles ${label}`
      : locale === 'es'
        ? `Patrones de prompt en modelos de ${label}`
        : `Prompt patterns across ${label} models`;
  const sectionLimitsTitle =
    locale === 'fr'
      ? 'Forces et limites par modèle'
      : locale === 'es'
        ? 'Fortalezas y límites por modelo'
        : 'Strengths and limits by model';
  const sectionPricingTitle =
    locale === 'fr'
      ? 'Notes de prix (selon le modèle)'
      : locale === 'es'
        ? 'Notas de precio (según el modelo)'
        : 'Pricing notes (varies by model)';

  return {
    slug: normalized,
    label,
    metaTitle,
    metaDescription:
      locale === 'fr'
        ? `Exemples vidéo IA ${label} avec prompts, réglages et prix par clip. ${variantsSentence}`
        : locale === 'es'
          ? `Ejemplos de video con IA de ${label} con prompts, ajustes y precio por clip. ${variantsSentence}`
          : `${label} examples with prompts, settings, and price per clip. ${variantsSentence}`,
    heroTitle:
      locale === 'fr' ? `Exemples ${label}` : locale === 'es' ? `Ejemplos de ${label}` : `${label} Examples`,
    heroSubtitle: localized.subtitle,
    intro: `${localized.intro} ${variantsSentence}`,
    summary:
      locale === 'fr'
        ? `${variantsSentence} Consultez les prompts, les réglages et le prix par clip avant de lancer un nouveau rendu.`
        : locale === 'es'
          ? `${variantsSentence} Revisa prompts, ajustes y precio por clip antes de lanzar un nuevo render.`
          : `${variantsSentence} Review prompts, settings, and price per clip before running a new render.`,
    sections: [
      {
        title: sectionPromptTitle,
        body: localized.promptPatterns,
      },
      {
        title: sectionLimitsTitle,
        body: localized.strengthsLimits,
      },
      {
        title: sectionPricingTitle,
        body: localized.pricingNotes,
      },
    ],
    faqTitle:
      locale === 'fr'
        ? `FAQ modèles ${label}`
        : locale === 'es'
          ? `FAQ de modelos ${label}`
          : `${label} models FAQ`,
    faqItems: localized.faq,
  };
}
