import type { StrategistKnowledgeToolResult } from './types';

type EcosystemSurface = {
  label: string;
  href: string;
  purpose: string;
  bestFor: readonly string[];
};

export const MAXVIDEOAI_ECOSYSTEM_SURFACES: readonly EcosystemSurface[] = [
  {
    label: 'Generate Video',
    href: '/app',
    purpose: 'Create AI videos, choose engines, compare settings, prepare prompts, use reference assets, and review the quote before rendering.',
    bestFor: ['text-to-video', 'image-to-video', 'video-to-video', 'video prompt application'],
  },
  {
    label: 'Generate Image',
    href: '/app/image',
    purpose: 'Create or edit images before using them as standalone assets or starting frames for video.',
    bestFor: ['text-to-image', 'image editing', 'character or product starting images', 'visual exploration before animation'],
  },
  {
    label: 'Generate Audio',
    href: '/app/audio',
    purpose: 'Create audio assets that can support video concepts, voice, music, ambience, or sound-design exploration.',
    bestFor: ['sound design', 'music or ambience exploration', 'audio assets for campaigns'],
  },
  {
    label: 'Library',
    href: '/app/library',
    purpose: 'Find saved media, review recent renders, reuse assets, download outputs, or save generated media for later workflows.',
    bestFor: ['saved assets', 'recent renders', 'history review', 'reuse in future prompts'],
  },
  {
    label: 'Models',
    href: '/models',
    purpose: 'Inspect model pages, strengths, settings, examples, prompt guidance, and workflow fit.',
    bestFor: ['model research', 'engine capabilities', 'model prompt guidance'],
  },
  {
    label: 'Compare',
    href: '/compare',
    purpose: 'Compare engines side by side before selecting the right quality, cost, speed, and workflow tradeoff.',
    bestFor: ['model selection', 'side-by-side decisions', 'quality versus cost tradeoffs'],
  },
  {
    label: 'Examples',
    href: '/examples',
    purpose: 'Inspect real outputs, prompts, settings, model behavior, and reusable ideas before spending credits.',
    bestFor: ['proof before purchase', 'prompt inspiration', 'model output examples'],
  },
  {
    label: 'Tools',
    href: '/app/tools',
    purpose: 'Use helper tools such as upscale, angle exploration, and character-building workflows where available.',
    bestFor: ['asset preparation', 'upscaling', 'character setup', 'visual utility workflows'],
  },
  {
    label: 'Pricing',
    href: '/pricing',
    purpose: 'Understand plans, credits, and cost expectations before rendering.',
    bestFor: ['budget planning', 'credit questions', 'price comparisons'],
  },
  {
    label: 'Workflows',
    href: '/workflows',
    purpose: 'Understand which creation path fits the user asset: text-to-video, image-to-video, text-to-image then video, or video-to-video.',
    bestFor: ['choosing a workflow', 'asset-based routing', 'first-time users'],
  },
];

export function answerCapabilityQuestion(input: { rawUserMessage: string }): StrategistKnowledgeToolResult {
  const text = normalizeSearchText(input.rawUserMessage);
  const isFrench = isFrenchText(input.rawUserMessage);
  const greetingAnswer = buildGreetingCapabilityAnswer(text, isFrench);
  return {
    toolName: 'capability_help',
    answer: greetingAnswer ?? (isFrench
      ? [
          'Oui. Je peux t’aider à choisir le bon modèle MaxVideoAI, comprendre le workflow, améliorer un prompt, ou t’orienter dans l’écosystème du site.',
          'Je peux aussi comparer les modèles, estimer coût/durée/résolution, expliquer les limites, et orienter vers Generate Video, Generate Image, Generate Audio, Library, Examples, Compare, Models, Tools et Pricing.',
          'Si l’utilisateur vient avec une idée vague, je clarifie. S’il vient avec un prompt, je l’améliore. S’il pose une question site/prix/modèle, je réponds directement avec la bonne source structurée.',
        ].join('\n')
      : [
          'I can help choose the right MaxVideoAI model, understand the workflow, improve prompts, or guide users around the site ecosystem.',
          'I can help you create a video from a rough idea, compare models, estimate cost/duration/resolution, explain limits, and point users to Generate Video, Generate Image, Generate Audio, Library, Examples, Compare, Models, Tools, and Pricing.',
          'If the user has a vague idea, I clarify. If they paste a prompt, I improve it. If they ask about the site, pricing, models, or workflows, I answer directly from structured MaxVideoAI knowledge.',
        ].join('\n')),
    sources: [ecosystemSource()],
    confidence: 0.9,
    limitations: [
      'This is structured product guidance. Private project search and RAG are not connected yet.',
      'The assistant previews actions only unless a later production integration explicitly applies them.',
    ],
    warnings: [],
    uiActions: [],
  };
}

function buildGreetingCapabilityAnswer(text: string, isFrench: boolean): string | null {
  if (/^(?:bonjour|salut)(?:\s+(?:a toi|à toi|encore))?[.!? ]*$/.test(text)) {
    return [
      'Bonjour. Oui, je peux t’aider.',
      'Dis-moi si tu veux créer une vidéo, améliorer un prompt, comparer des modèles, vérifier un prix, ou trouver où faire une action dans MaxVideoAI.',
    ].join('\n');
  }

  if (/^(?:hi|hello|hey)(?:\s+(?:there|again))?[.!? ]*$/.test(text)) {
    return [
      'Hi. Yes, I can help.',
      'Send a rough idea, paste a prompt to improve, ask me to compare models, estimate cost, or find the right place in MaxVideoAI.',
    ].join('\n');
  }

  if (isFrench && containsAny(text, ['tu peux m aider', 'j ai une question', 'je peux te poser une question'])) {
    return [
      'Oui. Je peux t’aider à créer une vidéo, améliorer un prompt, comparer des modèles, estimer un prix, ou trouver la bonne page MaxVideoAI.',
      'Dis-moi simplement ce que tu veux faire.',
    ].join('\n');
  }

  return null;
}

export function answerSiteOverviewQuestion(input: { rawUserMessage: string }): StrategistKnowledgeToolResult {
  const isFrench = isFrenchText(input.rawUserMessage);
  const coreSurfaces = MAXVIDEOAI_ECOSYSTEM_SURFACES.slice(0, 8);
  return {
    toolName: 'site_overview',
    answer: isFrench
      ? [
          'MaxVideoAI est organisé autour de plusieurs surfaces: générer, comparer, apprendre, gérer les assets, puis lancer seulement quand le devis est clair.',
          ...coreSurfaces.map((surface) => `${surface.label}: ${surface.href} - ${surface.purpose}`),
          'Dans le video generator, l’utilisateur peut comparer les modèles, préparer son prompt, puis vérifier le prix affiché avant la génération.',
          'Le bon parcours dépend du besoin: idée brute, prompt à améliorer, image de référence, vidéo source, question de prix, ou recherche d’exemples.',
        ].join('\n')
      : [
          'MaxVideoAI is organized around a few surfaces: create, compare, learn, manage assets, and launch only after the quote is clear.',
          ...coreSurfaces.map((surface) => `${surface.label}: ${surface.href} - ${surface.purpose}`),
          'In the video generator, users can compare models, prepare the prompt, and review the price shown before generation.',
          'The right path depends on the user need: rough idea, prompt improvement, reference image, source video, pricing question, or examples research.',
        ].join('\n'),
    sources: [ecosystemSource()],
    confidence: 0.9,
    limitations: ['This overview uses the local structured ecosystem map. It does not inspect private user projects.'],
    warnings: [],
    uiActions: [],
  };
}

export function selectEcosystemSurfaces(rawUserMessage: string): readonly EcosystemSurface[] {
  const text = normalizeSearchText(rawUserMessage);
  const matches = MAXVIDEOAI_ECOSYSTEM_SURFACES.filter((surface) => {
    const haystack = normalizeSearchText([surface.label, surface.href, surface.purpose, ...surface.bestFor].join(' '));
    return haystack.split(' ').some((token) => token.length > 3 && text.includes(token));
  });
  return matches.length ? matches : MAXVIDEOAI_ECOSYSTEM_SURFACES.slice(0, 4);
}

function ecosystemSource() {
  return {
    id: 'maxvideoai_ecosystem_map' as const,
    label: 'MaxVideoAI ecosystem map',
    path: 'frontend/lib/ai-strategist/knowledge/ecosystem-knowledge.ts',
  };
}

function isFrenchText(value: string): boolean {
  const text = normalizeSearchText(value);
  const frenchHits = [
    'tu',
    'peux',
    'bonjour',
    'salut',
    'quoi',
    'comment',
    'fonctionne',
    'marche',
    'aider',
    'prix',
    'modele',
    'modèle',
    'generer',
    'générer',
  ].filter((needle) => text.includes(needle)).length;
  const englishHits = ['how', 'what', 'can', 'you', 'site', 'app', 'work', 'ecosystem', 'platform', 'help'].filter((needle) =>
    text.includes(needle)
  ).length;
  return frenchHits > 0 && !(englishHits >= 2 && frenchHits <= 1);
}

function containsAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9:/.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
