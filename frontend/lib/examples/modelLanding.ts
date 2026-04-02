import type { AppLocale } from '@/i18n/locales';
import { getModelFamilyDefinition, type ModelFamilyId } from '@/config/model-families';
import { getExampleFamilyIds, getExampleFamilyVariantLabels } from '@/lib/model-families';

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

type CanonicalSlug = ModelFamilyId;

type LocalizedModelDescriptor = {
  metaTitle?: string;
  metaDescription?: string;
  subtitle: string;
  intro: string;
  promptPatterns: string;
  strengthsLimits: string;
  pricingNotes: string;
  faq: ExampleFaqItem[];
};

const EN_MODEL_DATA: Partial<Record<CanonicalSlug, LocalizedModelDescriptor>> = {
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
  luma: {
    metaTitle: 'Luma Ray 2 and Ray 2 Flash Examples (Prompts + Settings) | MaxVideoAI',
    metaDescription:
      'Browse Luma Ray 2 and Ray 2 Flash examples with reusable prompts, modify and reframe patterns, and price-per-clip guidance before choosing the premium or fast tier in MaxVideoAI.',
    subtitle: 'Luma Ray examples across Ray 2 and Ray 2 Flash, with reusable prompts, modify/reframe patterns, and pricing signals.',
    intro:
      'This page is the family view for Luma Ray inside MaxVideoAI. Use it to compare Ray 2 and Ray 2 Flash examples side by side before deciding whether the job belongs on the premium tier or the faster draft tier. The model pages handle detailed specs; this gallery is for prompt patterns, workflow examples, and cost tradeoffs across the two public Luma models.',
    promptPatterns:
      'Luma examples work best when prompts stay shot-level and workflow-specific: net-new generate, still-led animation, source-video modify, or reframe for delivery. Keep the brief compact and describe what must stay versus what can change.',
    strengthsLimits:
      'Ray 2 is the stronger fit for premium cinematic finals and higher-confidence polish. Ray 2 Flash is the cheaper throughput layer for concept validation, faster modify passes, and square or vertical delivery prep. Neither model generates native audio, so judge them on motion, framing, and source-video control rather than lip sync.',
    pricingNotes:
      'Use matching durations and resolutions when comparing the two Luma tiers. Ray 2 usually earns the higher spend on final-quality shots, while Ray 2 Flash is the better baseline for draft exploration, source-video experimentation, and lower-cost delivery variants.',
    faq: [
      {
        question: 'When should I start from the Luma examples page?',
        answer: 'Start here when you want to compare Ray 2 and Ray 2 Flash quickly before choosing the premium or fast tier for a real job.',
      },
      {
        question: 'What is the clearest difference between Ray 2 and Ray 2 Flash in examples?',
        answer: 'Ray 2 is the premium finaling tier, while Ray 2 Flash is the faster draft tier. The workflows stay aligned, but the role in production is different.',
      },
      {
        question: 'Can I compare modify and reframe use cases from this page?',
        answer: 'Yes. The gallery is meant to surface both net-new generation and source-video edit patterns before you open the model pages for full workflow controls.',
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
  ltx: {
    subtitle: 'LTX examples across the full family, from legacy fast drafts to LTX 2.3 Pro workflows with audio, Extend, and Retake.',
    intro:
      'Use this page to review the whole LTX family in one place. It brings together LTX 2.3 Pro, LTX 2.3 Fast, LTX 2.0 Pro, and LTX 2.0 Fast so you can compare speed, prompt patterns, framing behavior, and workflow breadth before choosing the right starting point.',
    promptPatterns:
      'Use concise prompts with a clear subject, one main action, and one camera instruction. LTX examples are easiest to compare when the brief stays stable and only the model variant changes.',
    strengthsLimits:
      'The LTX family is strong for fast iteration and repeatable framing. LTX 2.3 Pro adds audio-driven generation plus Extend and Retake, while LTX 2.0 still matters as a ranked legacy entry with historical example depth.',
    pricingNotes:
      'Keep one reference preset for cost comparison, then compare variants at the same duration and resolution. This makes it easier to see when the newer 2.3 workflows justify the higher spend versus legacy LTX 2 runs.',
    faq: [
      {
        question: 'When should I start from LTX examples?',
        answer: 'Use them when you want to compare the full LTX family, from legacy fast drafts to LTX 2.3 Pro workflows with audio, Extend, and Retake.',
      },
      {
        question: 'How do I improve consistency across LTX variants?',
        answer: 'Reuse one validated prompt template and change only one variable at a time so model differences stay readable.',
      },
      {
        question: 'Can I compare LTX family pricing from here?',
        answer: 'Yes. Use matching duration and resolution settings so the price difference reflects the model tier rather than the setup.',
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

const FR_MODEL_DATA: Partial<Record<CanonicalSlug, LocalizedModelDescriptor>> = {
  sora: {
    subtitle: 'Exemples Sora pensés pour un rendu cinématique, des prompts réutilisables et des réglages directement exploitables.',
    intro:
      'Cette page rassemble des exemples Sora réellement exploitables en production, avec prompts, durées et formats observés sur des rendus concrets. L’objectif est de vous aider à reproduire des résultats cohérents sans mélanger les logiques propres aux autres moteurs.',
    promptPatterns:
      'Commencez par l’intention du plan, puis précisez la caméra, le mouvement et la lumière. Les prompts courts, structurés et bien hiérarchisés restent les plus fiables.',
    strengthsLimits:
      'Sora est souvent très solide sur les plans cinématiques et la cohérence visuelle. Les limites dépendent ensuite du mode utilisé et du contexte de rendu.',
    pricingNotes:
      'Le coût varie selon la durée, la résolution et les options activées. Vérifiez le prix par clip avant de lancer plusieurs variantes.',
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
    subtitle: 'Exemples Veo pensés pour le contrôle du cadrage, du mouvement et des usages avec référence.',
    intro:
      'Cette page Veo se concentre sur des structures de prompts et des réglages utiles pour obtenir des rendus plus réguliers. Elle sert de base opérationnelle pour des variations publicitaires, des plans de marque et des séquences courtes où le cadrage doit rester maîtrisé.',
    promptPatterns:
      'Décrivez d’abord l’objectif du plan, puis la caméra et l’ambiance. En usage avec référence, gardez des contraintes explicites et faciles à relire.',
    strengthsLimits:
      'Veo offre généralement un bon niveau de contrôle sur le cadrage et le mouvement sur des clips courts. Les capacités varient selon le mode actif et le type d’entrée.',
    pricingNotes:
      'Comparez les coûts avec des presets identiques en durée et résolution pour isoler la vraie différence entre moteurs.',
    faq: [
      {
        question: 'Ces exemples Veo sont-ils adaptés aux usages avec image de référence ?',
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
  luma: {
    metaTitle: 'Exemples Luma Ray 2 et Ray 2 Flash (prompts + reglages) | MaxVideoAI',
    metaDescription:
      'Parcourez des exemples Luma Ray 2 et Ray 2 Flash avec prompts reutilisables, cas modify/reframe et reperes de prix par clip avant de choisir le tier premium ou rapide dans MaxVideoAI.',
    subtitle: 'Exemples Luma Ray sur Ray 2 et Ray 2 Flash, avec prompts reutilisables, cas modify/reframe et signaux de prix.',
    intro:
      'Cette page est la vue famille de Luma Ray dans MaxVideoAI. Utilisez-la pour comparer rapidement les exemples Ray 2 et Ray 2 Flash avant de decider si le job doit partir sur le tier premium ou sur le tier draft plus rapide. Les pages modele portent les specs detaillees; cette galerie sert a lire les patterns de prompt, les workflows et les arbitrages de cout entre les deux modeles Luma publics.',
    promptPatterns:
      'Les exemples Luma sont plus utiles quand le prompt reste au niveau du plan et du workflow: generate net-new, animation depuis still, modify sur video source, ou reframe pour la livraison. Gardez une consigne compacte et dites clairement ce qui doit rester versus ce qui peut changer.',
    strengthsLimits:
      'Ray 2 est le meilleur choix pour des finals cinematographiques premium et un niveau de confiance plus eleve. Ray 2 Flash est la couche de throughput la moins couteuse pour valider des concepts, tester des passes modify plus rapides et preparer des declinaisons carre ou verticales. Aucun des deux modeles ne genere d audio natif, donc jugez-les sur le mouvement, le cadrage et le controle sur video source plutot que sur le lip sync.',
    pricingNotes:
      'Gardez des durees et resolutions identiques pour comparer proprement les deux tiers Luma. Ray 2 justifie plus souvent le cout sur des shots finals, alors que Ray 2 Flash est la meilleure base pour l exploration, les edits sur video source et les variantes de livraison moins couteuses.',
    faq: [
      {
        question: 'Quand faut-il commencer par la page d exemples Luma ?',
        answer: 'Commencez ici quand vous voulez comparer rapidement Ray 2 et Ray 2 Flash avant de choisir le tier premium ou rapide pour un vrai job.',
      },
      {
        question: 'Quelle difference saute le plus aux yeux entre Ray 2 et Ray 2 Flash dans les exemples ?',
        answer: 'Ray 2 reste le tier premium pour les finals, tandis que Ray 2 Flash reste le tier rapide pour les drafts. Les workflows sont alignes, mais leur role en production est different.',
      },
      {
        question: 'Peut-on comparer ici les usages modify et reframe ?',
        answer: 'Oui. La galerie est justement faite pour montrer a la fois la generation nette et les cas d edition video source avant d ouvrir les pages modele pour les controles complets.',
      },
    ],
  },
  wan: {
    subtitle: 'Exemples Wan pensés pour des séquences structurées, des transitions propres et une continuité guidée.',
    intro:
      'Les exemples Wan de cette page sont pensés pour des séquences courtes à temps forts lisibles et transitions maîtrisées. Ils servent de point de départ concret avant clonage en production, surtout quand le rythme compte autant que le rendu final.',
    promptPatterns:
      'Utilisez des prompts en 2 ou 3 temps: mise en place, action, conclusion. Une formulation explicite des transitions améliore souvent la stabilité.',
    strengthsLimits:
      'Wan fonctionne bien sur des plans structurés et des variations courtes avec continuité. Gardez des scènes simples pour limiter la dérive.',
    pricingNotes:
      'Commencez par un test court à paramètres cibles, puis élargissez aux variantes validées.',
    faq: [
      {
        question: 'Les exemples Wan sont-ils adaptés aux prompts multi-beats ?',
        answer: 'Oui, ils sont structurés pour des séquences courtes avec transitions explicites.',
      },
      {
        question: 'Peut-on adapter Wan aux formats verticaux ?',
        answer: 'Oui, en conservant la logique de mouvement puis en ajustant le cadrage.',
      },
      {
        question: 'Quelle méthode de test prix pour Wan ?',
        answer: 'Validez un clip court en preset final avant de lancer des lots.',
      },
    ],
  },
  kling: {
    subtitle: 'Exemples Kling pensés pour un mouvement stylisé, une itération rapide et des prompts réutilisables.',
    intro:
      'Cette page Kling regroupe des exemples concrets pour produire des variantes réseaux sociaux, produit et cinématiques à partir d’une structure de prompt stable. Elle reste volontairement centrée sur le moteur lui-même pour éviter de brouiller la lecture avec des logiques trop génériques.',
    promptPatterns:
      'Privilégiez des verbes d’action directs, une scène simple et une seule consigne caméra par plan.',
    strengthsLimits:
      'Kling est efficace pour des rendus stylisés et des itérations rapides. Trop d’objectifs visuels empilés dans un même prompt peuvent nuire à la stabilité.',
    pricingNotes:
      'Pour comparer Kling correctement, conservez exactement la même durée et résolution entre moteurs.',
    faq: [
      {
        question: 'Quel style de prompt est le plus fiable avec Kling ?',
        answer: 'Des prompts courts avec un objectif visuel principal et une caméra explicite.',
      },
      {
        question: 'Ces exemples Kling conviennent-ils à des créas publicitaires ?',
        answer: 'Oui, ils sont pensés pour servir de base à des créas publicitaires puis être adaptés à vos variantes.',
      },
      {
        question: 'Comment comparer le coût Kling ?',
        answer: 'Fixez les mêmes presets et comparez prix + qualité de sortie.',
      },
    ],
  },
  seedance: {
    subtitle: 'Exemples Seedance pensés pour un mouvement contrôlé et un cadrage prévisible.',
    intro:
      'Les exemples Seedance ci-dessous servent de base pour des plans publicitaires, des reveals produit et des séquences de marque avec caméra stable. Le but est d’accélérer la réutilisation sans repartir de zéro.',
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
  ltx: {
    subtitle: 'Exemples LTX sur toute la famille, des brouillons rapides hérités jusqu’aux flux LTX 2.3 Pro avec audio, Extend et Retake.',
    intro:
      'Cette page réunit toute la famille LTX au même endroit. Elle regroupe LTX 2.3 Pro, LTX 2.3 Fast, LTX 2.0 Pro et LTX 2.0 Fast pour comparer la vitesse, la structure de prompt, le cadrage et la richesse du flux de travail avant de choisir la bonne base.',
    promptPatterns:
      'Utilisez des prompts concis avec un sujet clair, une action principale et une seule instruction caméra. Les exemples LTX se comparent mieux quand la consigne reste stable et que seule la variante de modèle change.',
    strengthsLimits:
      'La famille LTX fonctionne bien pour l’itération rapide et des cadrages reproductibles. LTX 2.3 Pro ajoute l’audio piloté, Extend et Retake, tandis que LTX 2.0 reste une base historique utile avec un volume d’exemples déjà bien référencé.',
    pricingNotes:
      'Gardez un preset de référence fixe pour comparer les coûts, puis comparez les variantes à durée et résolution identiques. Cela aide à voir quand les flux 2.3 justifient réellement un coût supérieur à LTX 2.',
    faq: [
      {
        question: 'Quand faut-il commencer par la page d’exemples LTX ?',
        answer: 'Quand vous voulez comparer toute la famille LTX, depuis les brouillons rapides hérités jusqu’aux flux LTX 2.3 Pro avec audio, Extend et Retake.',
      },
      {
        question: 'Comment améliorer la cohérence entre variantes LTX ?',
        answer: 'Gardez une structure de prompt stable et ne modifiez qu’une variable à la fois pour mieux isoler les différences entre modèles.',
      },
      {
        question: 'Peut-on comparer les prix de la famille LTX depuis cette page ?',
        answer: 'Oui, à condition de garder durée et résolution identiques pour obtenir une comparaison propre.',
      },
    ],
  },
  pika: {
    subtitle: 'Exemples Pika pensés pour des boucles courtes, un style social affirmé et un montage rapide.',
    intro:
      'Cette page Pika cible les formats courts et stylisés. Elle permet de cloner des schémas de mouvement efficaces puis d’ajuster le sujet et le style sans refaire tout le setup.',
    promptPatterns:
      'Commencez par le style, ajoutez ensuite l’action principale, puis une consigne de caméra concise.',
    strengthsLimits:
      'Pika est souvent performant pour des boucles sociales rapides et des visuels très stylisés. Évitez les prompts surchargés pour réduire l’instabilité.',
    pricingNotes:
      'Le coût reste plus prévisible avec des durées courtes et des presets constants.',
    faq: [
      {
        question: 'Comment réutiliser efficacement un exemple Pika ?',
        answer: 'Clonez le schéma de mouvement, puis ajustez seulement le sujet et la direction artistique.',
      },
      {
        question: 'Ces exemples Pika conviennent-ils aux variantes pour réseaux sociaux ?',
        answer: 'Oui, ils sont pensés pour des déclinaisons rapides.',
      },
      {
        question: 'Comment garder des coûts Pika stables ?',
        answer: 'Fixez durée et résolution avant de lancer plusieurs variantes.',
      },
    ],
  },
  hailuo: {
    subtitle: 'Exemples Hailuo pensés pour des brouillons économiques, des tests de mouvement et une itération progressive.',
    intro:
      'Cette page Hailuo est pensée pour une phase d’exploration à faible coût avant passage sur des moteurs premium. Elle sert à valider rapidement des idées de mouvement et de composition sans immobiliser trop de budget.',
    promptPatterns:
      'Privilégiez des prompts courts centrés sur l’action et l’intention caméra.',
    strengthsLimits:
      'Hailuo est utile pour des passes conceptuelles et des tests de mouvement. Pour des scènes complexes, avancez par étapes courtes afin de garder le contrôle.',
    pricingNotes:
      'Utilisez Hailuo comme base de brouillon, puis montez en qualité ou redirigez les variantes gagnantes vers un moteur premium.',
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

const ES_MODEL_DATA: Partial<Record<CanonicalSlug, LocalizedModelDescriptor>> = {
  sora: {
    subtitle: 'Ejemplos de Sora pensados para un acabado cinematográfico, prompts reutilizables y ajustes realmente útiles.',
    intro:
      'Esta página reúne ejemplos reales de Sora para clonar y ajustar en producción. La idea es ayudarte a repetir resultados con más consistencia usando prompts, duraciones y formatos que ya demostraron funcionar.',
    promptPatterns:
      'Define primero la intención de la toma, luego la cámara, el movimiento y la iluminación. Los prompts cortos, estructurados y bien jerarquizados suelen responder mejor.',
    strengthsLimits:
      'Sora suele destacar por su coherencia cinematográfica y por un movimiento más pulido. Los límites dependen del modo y del contexto de render.',
    pricingNotes:
      'El precio cambia según la duración, la resolución y las opciones activas. Revisa el costo por clip antes de escalar.',
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
    subtitle: 'Ejemplos de Veo pensados para controlar el encuadre, el movimiento y los trabajos con referencia.',
    intro:
      'Esta página de Veo se centra en patrones de prompt y ajustes prácticos para conseguir resultados más estables. Sirve como base operativa para variantes publicitarias, tomas de marca y secuencias cortas donde el encuadre debe mantenerse bajo control.',
    promptPatterns:
      'Empieza por el objetivo de la toma y luego concreta la cámara y el ambiente. En trabajos con referencia, conviene dejar las restricciones bien explícitas y fáciles de revisar.',
    strengthsLimits:
      'Veo suele ofrecer buen control de encuadre y movimiento en clips cortos. Las capacidades varían según el modo activo y el tipo de entrada.',
    pricingNotes:
      'Compara costos con presets iguales en duración y resolución para obtener una lectura más limpia.',
    faq: [
      {
        question: '¿Estos ejemplos de Veo sirven para flujos con imagen de referencia?',
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
  luma: {
    metaTitle: 'Ejemplos de Luma Ray 2 y Ray 2 Flash (prompts + ajustes) | MaxVideoAI',
    metaDescription:
      'Revisa ejemplos de Luma Ray 2 y Ray 2 Flash con prompts reutilizables, patrones de modify y reframe, y referencias de precio por clip antes de elegir el tier premium o rapido en MaxVideoAI.',
    subtitle: 'Ejemplos de Luma Ray en Ray 2 y Ray 2 Flash, con prompts reutilizables, patrones de modify/reframe y senales de precio.',
    intro:
      'Esta pagina es la vista de familia de Luma Ray dentro de MaxVideoAI. Sirve para comparar rapidamente ejemplos de Ray 2 y Ray 2 Flash antes de decidir si el trabajo pertenece al tier premium o al tier draft mas rapido. Las paginas de modelo cubren las specs detalladas; esta galeria esta pensada para leer patrones de prompt, workflows y tradeoffs de coste entre los dos modelos Luma publicos.',
    promptPatterns:
      'Los ejemplos de Luma funcionan mejor cuando el prompt se mantiene a nivel de toma y de workflow: generate net-new, animacion desde still, modify sobre video fuente o reframe para entrega. Mantén la consigna compacta y deja claro que debe quedarse y que puede cambiar.',
    strengthsLimits:
      'Ray 2 encaja mejor en finales cinematicos premium y en pases con mayor confianza. Ray 2 Flash es la capa de throughput mas barata para validar conceptos, probar pases modify mas rapidos y preparar entregas cuadradas o verticales. Ninguno de los dos modelos genera audio nativo, asi que conviene evaluarlos por movimiento, encuadre y control sobre video fuente, no por lip sync.',
    pricingNotes:
      'Usa duraciones y resoluciones equivalentes para comparar bien los dos tiers Luma. Ray 2 suele justificar mejor el gasto en tomas finales, mientras que Ray 2 Flash es la mejor base para exploracion, iteracion sobre video fuente y variantes de entrega con menor coste.',
    faq: [
      {
        question: '¿Cuándo conviene empezar por la página de ejemplos de Luma?',
        answer: 'Empieza aquí cuando quieras comparar Ray 2 y Ray 2 Flash rapidamente antes de elegir el tier premium o rapido para un trabajo real.',
      },
      {
        question: '¿Cuál es la diferencia mas clara entre Ray 2 y Ray 2 Flash en ejemplos?',
        answer: 'Ray 2 sigue siendo el tier premium para finales, mientras que Ray 2 Flash sigue siendo el tier rapido para drafts. Los workflows estan alineados, pero su papel en produccion es distinto.',
      },
      {
        question: '¿Puedo comparar aquí casos de modify y reframe?',
        answer: 'Sí. La galería está pensada para mostrar tanto generación nueva como patrones de edición sobre video fuente antes de abrir las páginas de modelo con todos los controles.',
      },
    ],
  },
  wan: {
    subtitle: 'Ejemplos de Wan pensados para secuencias estructuradas, transiciones limpias y continuidad guiada.',
    intro:
      'Los ejemplos de Wan de esta página están pensados para secuencias cortas con beats claros y transiciones controladas. Funcionan como punto de partida operativo antes de clonar en producción, sobre todo cuando el ritmo importa tanto como el acabado final.',
    promptPatterns:
      'Usa prompts en 2 o 3 beats: arranque, acción y cierre. Las transiciones explícitas suelen mejorar la estabilidad.',
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
    subtitle: 'Ejemplos de Kling pensados para movimiento estilizado, iteración rápida y prompts realmente reutilizables.',
    intro:
      'Esta página de Kling agrupa ejemplos prácticos para producir variantes de redes sociales, producto y piezas cinematográficas con una estructura de prompt estable. Se mantiene específica del motor para no mezclar señales con la página general.',
    promptPatterns:
      'Prioriza verbos de acción directos, una escena simple y una sola instrucción de cámara por toma.',
    strengthsLimits:
      'Kling suele responder bien en movimiento estilizado y ciclos rápidos de iteración. Demasiados objetivos visuales en un solo prompt reducen la estabilidad.',
    pricingNotes:
      'Para comparar Kling de forma justa, usa duración y resolución idénticas entre motores.',
    faq: [
      {
        question: '¿Qué estilo de prompt es más fiable en Kling?',
        answer: 'Prompts cortos con un objetivo visual principal y cámara explícita.',
      },
      {
        question: '¿Estos ejemplos de Kling sirven para piezas publicitarias?',
        answer: 'Sí, están pensados para clonarse rápido y adaptarse a distintas variantes de campaña.',
      },
      {
        question: '¿Cómo comparo coste en Kling?',
        answer: 'Mantén los mismos presets y compara precio junto con calidad de salida.',
      },
    ],
  },
  seedance: {
    subtitle: 'Ejemplos de Seedance pensados para movimiento controlado y un encuadre predecible.',
    intro:
      'Los ejemplos de Seedance en esta página sirven como base para tomas publicitarias, reveals de producto y secuencias de marca con cámara estable. El objetivo es acelerar la reutilización sin volver a empezar cada vez.',
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
  ltx: {
    subtitle: 'Ejemplos de toda la familia LTX, desde borradores heredados rápidos hasta flujos LTX 2.3 Pro con audio, Extend y Retake.',
    intro:
      'Esta página reúne toda la familia LTX en un solo lugar. Agrupa LTX 2.3 Pro, LTX 2.3 Fast, LTX 2.0 Pro y LTX 2.0 Fast para comparar velocidad, estructura de prompt, encuadre y amplitud del flujo de trabajo antes de elegir la mejor base.',
    promptPatterns:
      'Usa prompts concisos con un sujeto claro, una acción principal y una sola instrucción de cámara. Los ejemplos LTX se comparan mejor cuando la consigna se mantiene estable y solo cambia la variante del modelo.',
    strengthsLimits:
      'La familia LTX funciona bien para iteración rápida y encuadres repetibles. LTX 2.3 Pro suma generación guiada por audio, Extend y Retake, mientras que LTX 2.0 sigue siendo una base histórica útil con un volumen de ejemplos ya bien posicionado.',
    pricingNotes:
      'Mantén un preset base fijo y compara variantes con la misma duración y resolución. Así se ve mejor cuándo los flujos 2.3 justifican un mayor costo frente a LTX 2.',
    faq: [
      {
        question: '¿Cuándo conviene empezar por la página de ejemplos LTX?',
        answer: 'Cuando quieres comparar toda la familia LTX, desde borradores heredados rápidos hasta flujos LTX 2.3 Pro con audio, Extend y Retake.',
      },
      {
        question: '¿Cómo mejoro consistencia entre variantes LTX?',
        answer: 'Reutiliza una estructura estable y cambia una sola variable por prueba para aislar mejor las diferencias entre modelos.',
      },
      {
        question: '¿Puedo comparar precios de la familia LTX desde esta página?',
        answer: 'Sí, usando duración y resolución equivalentes para que la comparación siga siendo limpia.',
      },
    ],
  },
  pika: {
    subtitle: 'Ejemplos de Pika pensados para loops cortos, un estilo social marcado y una edición ágil.',
    intro:
      'Esta página de Pika se centra en formatos cortos y estilizados. Permite clonar patrones de movimiento ya probados y ajustar sujeto y estilo sin rehacer toda la configuración.',
    promptPatterns:
      'Empieza por el estilo, suma la acción principal y cierra con una instrucción breve de cámara.',
    strengthsLimits:
      'Pika suele funcionar bien para loops rápidos y piezas muy pensadas para redes. Evita prompts sobrecargados para reducir la inestabilidad.',
    pricingNotes:
      'El coste es más predecible con duraciones cortas y presets constantes.',
    faq: [
      {
        question: '¿Cómo reutilizo bien un ejemplo de Pika?',
        answer: 'Clona el patrón de movimiento y cambia primero sujeto y estilo.',
      },
      {
        question: '¿Estos ejemplos de Pika sirven para variantes de anuncios en redes sociales?',
        answer: 'Sí, están pensados para iteraciones rápidas.',
      },
      {
        question: '¿Cómo mantengo costes estables en Pika?',
        answer: 'Fija duración y resolución antes de lanzar múltiples variantes.',
      },
    ],
  },
  hailuo: {
    subtitle: 'Ejemplos de Hailuo pensados para borradores económicos, pruebas de movimiento e iteración progresiva.',
    intro:
      'Esta página de Hailuo está pensada para una etapa de exploración de bajo costo antes de pasar a motores premium. Sirve para validar ideas de movimiento y composición con rapidez sin comprometer demasiado presupuesto.',
    promptPatterns:
      'Prioriza prompts cortos centrados en la acción y la dirección de cámara.',
    strengthsLimits:
      'Hailuo es útil para pases conceptuales y pruebas de movimiento. En escenas complejas, conviene trabajar por pasos cortos.',
    pricingNotes:
      'Úsalo como base de borrador y escala solo las variantes que de verdad funcionen.',
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
        answer: 'Utilisez les pages modèles pour les caractéristiques et limites, et la page moteurs pour choisir selon le cas d’usage.',
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
        answer: 'Usa las páginas de modelos para ver características y límites, y la página de motores para decidir según el caso de uso.',
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
  return getExampleFamilyIds();
}

export function getExampleModelLabel(_locale: AppLocale, slug: string): string | null {
  const normalized = slug.trim().toLowerCase() as CanonicalSlug;
  return getModelFamilyDefinition(normalized)?.label ?? null;
}

function getLocalizedModelData(locale: AppLocale): Partial<Record<CanonicalSlug, LocalizedModelDescriptor>> {
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

function buildGenericLocalizedModelData(
  locale: AppLocale,
  label: string,
  variantsSentence: string
): LocalizedModelDescriptor {
  if (locale === 'fr') {
    return {
      subtitle: `Exemples ${label} sur toute la famille, avec prompts réutilisables, réglages et repères de prix.`,
      intro: `Utilisez cette page pour relire des exemples ${label} avant de lancer de nouveaux rendus. ${variantsSentence} Comparez mouvement, cadrage, durée et prix par clip, puis ouvrez les pages modèles liées pour les specs et limites propres à chaque mode.`,
      promptPatterns: `Les exemples ${label} sont plus fiables quand le prompt sépare sujet, mouvement caméra, environnement et durée. Commencez par un clip court, puis itérez sur le cadrage et le mouvement.`,
      strengthsLimits: `Cette galerie sert à comparer comment la famille ${label} gère le mouvement, la composition et la cohérence. Les capacités changent encore selon le modèle et le mode, donc validez le workflow exact sur la page modèle avant de passer en production.`,
      pricingNotes: `Le prix par clip varie selon le modèle, la durée, la résolution et le mode. Gardez le même brief pour comparer correctement coût et qualité dans la famille ${label}.`,
      faq: [
        {
          question: `Quand utiliser la page d’exemples ${label} ?`,
          answer: `Quand vous voulez comparer rapidement plusieurs variantes ${label} avant de choisir la meilleure page modèle pour produire.`,
        },
        {
          question: `Est-ce que tous les modèles ${label} se comportent pareil ?`,
          answer: `Non. La famille partage une logique commune, mais les durées, modes, résolutions et coûts restent spécifiques à chaque modèle.`,
        },
        {
          question: `Comment choisir le bon modèle ${label} ?`,
          answer: `Commencez par les exemples pour voir le rendu, puis ouvrez les pages modèles liées pour confirmer les specs, limites et prix.`,
        },
      ],
    };
  }

  if (locale === 'es') {
    return {
      subtitle: `Ejemplos de ${label} en toda la familia, con prompts reutilizables, ajustes y referencias de precio.`,
      intro: `Usa esta página para revisar ejemplos de ${label} antes de lanzar nuevos renders. ${variantsSentence} Compara movimiento, encuadre, duración y precio por clip, y luego abre las páginas de modelo relacionadas para ver límites y especificaciones por modo.`,
      promptPatterns: `Los ejemplos de ${label} funcionan mejor cuando el prompt separa sujeto, movimiento de cámara, entorno y duración. Empieza con clips cortos y luego ajusta encuadre y movimiento.`,
      strengthsLimits: `La galería te ayuda a comparar cómo la familia ${label} maneja movimiento, composición y consistencia. Las capacidades siguen variando por modelo y modo, así que valida el flujo exacto en la página del modelo antes de escalar producción.`,
      pricingNotes: `El precio por clip cambia según modelo, duración, resolución y modo. Mantén el mismo brief para comparar bien coste y calidad dentro de la familia ${label}.`,
      faq: [
        {
          question: `¿Cuándo usar la página de ejemplos de ${label}?`,
          answer: `Úsala cuando quieras comparar rápidamente varias variantes de ${label} antes de elegir la mejor página de modelo para producir.`,
        },
        {
          question: `¿Todos los modelos de ${label} se comportan igual?`,
          answer: `No. La familia comparte una lógica común, pero duración, modos, resolución y coste siguen dependiendo de cada modelo.`,
        },
        {
          question: `¿Cómo elijo el modelo correcto de ${label}?`,
          answer: `Empieza por los ejemplos para ver el resultado y luego abre las páginas de modelo relacionadas para validar límites, especificaciones y precio.`,
        },
      ],
    };
  }

  return {
    subtitle: `${label} examples across the full family, with reusable prompts, settings, and pricing signals.`,
    intro: `Use this page to review ${label} examples before launching new renders. ${variantsSentence} Compare motion, framing, duration, and price per clip, then open the related model pages for mode-specific specs and limits.`,
    promptPatterns: `${label} examples usually work best when prompts separate subject, camera movement, environment, and timing. Start with short clips, then iterate on framing and motion once the baseline looks right.`,
    strengthsLimits: `This gallery helps you compare how the ${label} family handles motion, composition, and consistency. Capabilities still vary by model and mode, so confirm the exact workflow on the related model pages before scaling production.`,
    pricingNotes: `Per-clip pricing changes by model, duration, resolution, and mode. Keep a stable brief so you can compare cost and quality across the ${label} family.`,
    faq: [
      {
        question: `When should I use the ${label} examples page?`,
        answer: `Use it when you want to compare multiple ${label} variants quickly before choosing the best model page for production.`,
      },
      {
        question: `Do all ${label} models behave the same way?`,
        answer: `No. They share a family baseline, but duration, modes, resolution, and cost still vary by model.`,
      },
      {
        question: `How do I choose the right ${label} model?`,
        answer: `Start with examples to judge output quality, then open the related model pages to confirm specs, limits, and pricing.`,
      },
    ],
  };
}

export function getExampleModelLanding(locale: AppLocale, slug: string): ExampleModelLanding | null {
  const normalized = slug.trim().toLowerCase() as CanonicalSlug;
  const family = getModelFamilyDefinition(normalized);
  if (!family) return null;

  const label = family.label;
  const variants = getExampleFamilyVariantLabels(normalized);
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
  const localized = getLocalizedModelData(locale)[normalized] ?? buildGenericLocalizedModelData(locale, label, variantsSentence);
  const metaTitle =
    localized.metaTitle ??
    (locale === 'fr'
      ? `Exemples vidéo IA ${label} (prompts + réglages) | MaxVideoAI`
      : locale === 'es'
        ? `Ejemplos de video con IA de ${label} (prompts + ajustes) | MaxVideoAI`
        : `${label} AI Video Examples (Prompts + Settings) | MaxVideoAI`);
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
      localized.metaDescription ??
      (locale === 'fr'
        ? `Exemples vidéo IA ${label} avec prompts, réglages et prix par clip. ${variantsSentence}`
        : locale === 'es'
          ? `Ejemplos de video con IA de ${label} con prompts, ajustes y precio por clip. ${variantsSentence}`
          : `${label} examples with prompts, settings, and price per clip. ${variantsSentence}`),
    heroTitle:
      locale === 'fr' ? `Exemples ${label}` : locale === 'es' ? `Ejemplos de ${label}` : `${label} Examples`,
    heroSubtitle: `${localized.subtitle} ${variantsSentence}`,
    intro: localized.intro,
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
