import type { AiStrategistNormalizedBrief } from './brief-normalization';
import type { AiStrategistPromptGenerationContext } from './prompt-structures';
import type { AiStrategistModelId, AiStrategistTierPosition, AiStrategistWorkflowId } from './types';

export type StrategistBriefCompletionStatus = 'needs_info' | 'ready_for_confirmation';

export type StrategistBriefMissingField = {
  label: string;
  question: string;
};

export type StrategistBriefCompletionResult = {
  status: StrategistBriefCompletionStatus;
  resolvedBrief: string;
  selectedModel: AiStrategistModelId;
  selectedTier?: AiStrategistTierPosition;
  selectedWorkflow: AiStrategistWorkflowId;
  requiredFields: readonly string[];
  missingFields: readonly StrategistBriefMissingField[];
  assumptions: readonly string[];
  confirmationSummary: readonly string[];
  assistantMessage: string;
};

export function assessStrategistBriefCompletion(input: {
  resolvedBrief: string;
  normalizedBrief: AiStrategistNormalizedBrief;
  promptGenerationContext: AiStrategistPromptGenerationContext;
  selectedTier?: AiStrategistTierPosition;
  allowAssumptions?: boolean;
}): StrategistBriefCompletionResult {
  const text = normalizeText(input.resolvedBrief);
  const safeBrief = sanitizeProtectedStyleReferences(input.resolvedBrief);
  const requiredFields = input.promptGenerationContext.workflowPromptStructure.blocks.flatMap((block) =>
    block.fields.map((field) => field.label)
  );
  const missingFields = input.allowAssumptions || shouldUseProactiveProductReferenceDefaults(input)
    ? []
    : selectMissingFields({
        text,
        normalizedBrief: input.normalizedBrief,
        workflow: input.promptGenerationContext.selectedWorkflow,
        requiredFields,
      }).slice(0, 4);
  const assumptions = missingFields.length
    ? []
    : buildAssumptions({
        text,
        normalizedBrief: input.normalizedBrief,
        workflow: input.promptGenerationContext.selectedWorkflow,
        requiredFields,
      });
  const confirmationSummary = buildConfirmationSummary({
    resolvedBrief: safeBrief,
    normalizedBrief: input.normalizedBrief,
    context: input.promptGenerationContext,
    assumptions,
    selectedTier: input.selectedTier,
  });

  return {
    status: missingFields.length ? 'needs_info' : 'ready_for_confirmation',
    resolvedBrief: safeBrief,
    selectedModel: input.promptGenerationContext.selectedModel.id,
    ...(input.selectedTier ? { selectedTier: input.selectedTier } : {}),
    selectedWorkflow: input.promptGenerationContext.selectedWorkflow,
    requiredFields,
    missingFields,
    assumptions,
    confirmationSummary,
    assistantMessage: missingFields.length
      ? buildMissingFieldsMessage(missingFields)
      : buildConfirmationMessage(confirmationSummary),
  };
}

function selectMissingFields(input: {
  text: string;
  normalizedBrief: AiStrategistNormalizedBrief;
  workflow: AiStrategistWorkflowId;
  requiredFields: readonly string[];
}): StrategistBriefMissingField[] {
  if (isCombatBrief(input.text)) {
    return [
      { label: 'Subject', question: 'Do you want one fighter, two fighters, or a group moment?' },
      { label: 'Style', question: 'Should it feel realistic/cinematic or more arcade/stylized?' },
      { label: 'Location', question: 'Any setting: street, arena, rooftop, dojo, or something else?' },
    ];
  }

  const missing: StrategistBriefMissingField[] = [];
  if (input.workflow === 'image-to-video') {
    if (!input.normalizedBrief.hasUploadedReference) {
      missing.push({ label: 'Reference', question: 'What reference image should anchor the video?' });
    }
    if (!hasMotion(input.text)) missing.push({ label: 'Motion', question: 'What is the main movement or action?' });
    if (!hasCamera(input.text)) missing.push({ label: 'Camera', question: 'What framing or camera move should I use?' });
    if (!hasStyle(input.text)) missing.push({ label: 'Atmosphere', question: 'What mood, lighting, or environment should it have?' });
    return missing;
  }

  if (input.workflow === 'text-to-image-then-image-to-video') {
    if (!hasConcreteSubject(input.text, input.normalizedBrief)) {
      missing.push({ label: 'Product/subject', question: 'What exact product or subject should appear in the starting image?' });
    }
    if (!hasStyle(input.text)) {
      missing.push({ label: 'Lighting', question: 'What visual style or lighting should guide the starting image?' });
    }
    if (!hasMotion(input.text)) {
      missing.push({ label: 'Motion', question: 'How should the still image animate?' });
    }
    if (!hasCamera(input.text)) {
      missing.push({ label: 'Camera', question: 'What format and camera movement should I assume?' });
    }
    return missing;
  }

  if (!hasConcreteSubject(input.text, input.normalizedBrief)) {
    missing.push({ label: 'Subject', question: 'Who or what should be on screen?' });
  }
  if (!hasMotion(input.text)) {
    missing.push({ label: 'Action', question: 'What should the subject do in the clip?' });
  }
  if (!hasCamera(input.text)) {
    missing.push({ label: 'Camera', question: 'What format or camera move should I use?' });
  }
  if (!hasStyle(input.text)) {
    missing.push({ label: 'Style', question: 'Should the look be realistic, cinematic, stylized, playful, or something else?' });
  }

  return missing;
}

function buildMissingFieldsMessage(missingFields: readonly StrategistBriefMissingField[]): string {
  return [
    'Great. Quick direction check:',
    '',
    ...missingFields.map((field, index) => `${index + 1}. ${field.question}`),
    'I can also make smart assumptions if you want to go fast.',
  ].join('\n');
}

function buildConfirmationMessage(summary: readonly string[]): string {
  return ['Here’s what I’ll build:', '', ...summary.map((item) => `* ${item}`), '', 'Generate the prompt?'].join('\n');
}

function buildConfirmationSummary(input: {
  resolvedBrief: string;
  normalizedBrief: AiStrategistNormalizedBrief;
  context: AiStrategistPromptGenerationContext;
  assumptions: readonly string[];
  selectedTier?: AiStrategistTierPosition;
}): string[] {
  const summary = [
    `Concept: ${sanitizeProtectedStyleReferences(input.resolvedBrief)}`,
    ...(input.selectedTier ? [`Tier: ${formatTier(input.selectedTier)}`] : []),
    `Model: ${input.context.selectedModel.label}`,
    `Workflow: ${input.context.selectedWorkflow}`,
    `Format: ${input.normalizedBrief.aspectRatioHint ?? inferFormat(input.resolvedBrief)}`,
    `Duration: ${input.context.durationGuidance.label} - ${input.context.durationGuidance.reason}`,
    `${input.context.priceEstimate.label} - preview only; final generator quote wins`,
    `Style: ${summarizeStyle(input.resolvedBrief, input.normalizedBrief)}`,
    `Audio: ${summarizeAudio(input.resolvedBrief, input.normalizedBrief)}`,
  ];
  if (input.assumptions.length) summary.push(`Assumptions: ${input.assumptions.join('; ')}`);
  return summary;
}

function formatTier(tier: AiStrategistTierPosition): string {
  if (tier === 'best') return 'Best - strongest fit for the current brief';
  if (tier === 'medium') return 'Medium - balanced quality, speed, and cost';
  return 'Value - faster/lower-cost route for testing or budget control';
}

function buildAssumptions(input: {
  text: string;
  normalizedBrief: AiStrategistNormalizedBrief;
  workflow: AiStrategistWorkflowId;
  requiredFields: readonly string[];
}): string[] {
  const assumptions: string[] = [];
  if (!hasCamera(input.text)) assumptions.push(`camera: ${input.normalizedBrief.aspectRatioHint ?? '16:9'} with one readable cinematic move`);
  if (!hasStyle(input.text)) assumptions.push('style: cinematic, polished, and visually clear');
  if (!hasAudio(input.text)) assumptions.push('audio: ambience and light SFX, no voice required for the first pass');
  if (input.workflow === 'text-to-image-then-image-to-video' && !hasMotion(input.text)) {
    assumptions.push('motion: one controlled reveal from the starting image');
  }
  return assumptions;
}

function shouldUseProactiveProductReferenceDefaults(input: {
  resolvedBrief: string;
  normalizedBrief: AiStrategistNormalizedBrief;
  promptGenerationContext: AiStrategistPromptGenerationContext;
}): boolean {
  return (
    input.promptGenerationContext.selectedWorkflow === 'image-to-video' &&
    input.normalizedBrief.hasUploadedReference &&
    input.normalizedBrief.hasProduct &&
    input.normalizedBrief.hasLogoOrTextRisk
  );
}

function hasConcreteSubject(text: string, normalizedBrief: AiStrategistNormalizedBrief): boolean {
  if (normalizedBrief.hasProduct || normalizedBrief.hasPerson || normalizedBrief.hasCharacter) return true;
  if (isCombatBrief(text)) return true;
  return /\b(car|voiture|perfume|bottle|sneaker|shoe|watch|jewelry|avatar|spokesperson|fighter|character|person|product|scene|drink|beverage|can|makeup|cosmetic)\b/.test(text);
}

function hasMotion(text: string): boolean {
  return /\b(fight|combat|run|jump|drive|drift|reveal|spin|walk|talk|speak|transform|animate|push|pull|zoom|attack|punch|kick|move|motion|dynamic|dynamique)\b/.test(text);
}

function hasCamera(text: string): boolean {
  return /\b(9:16|16:9|1:1|vertical|landscape|portrait|close-up|close up|wide|macro|camera|shot|push-in|push in|tracking|handheld|orbit|dolly)\b/.test(text);
}

function hasStyle(text: string): boolean {
  return /\b(cinematic|realistic|stylized|arcade|anime|premium|luxury|dark|bright|moody|studio|neon|gritty|polished|street fighter)\b/.test(text);
}

function hasAudio(text: string): boolean {
  return /\b(audio|sound|sfx|music|voiceover|dialogue|spoken|lip-sync|impact|ambience|silent)\b/.test(text);
}

function isCombatBrief(text: string): boolean {
  return /\b(street fighter|fighter|fight|combat|battle|duel|martial arts|karate|boxing)\b/.test(text);
}

function inferFormat(brief: string): string {
  const match = brief.match(/\b(?:9:16|16:9|1:1|4:3|3:4)\b/);
  if (match) return match[0];
  if (/\b(vertical|tiktok|reels|shorts)\b/i.test(brief)) return '9:16';
  return '16:9';
}

function summarizeStyle(brief: string, normalizedBrief: AiStrategistNormalizedBrief): string {
  if (isCombatBrief(normalizeText(brief))) return 'arcade fighting / stylized combat inspiration, cinematic action, high-energy camera';
  if (normalizedBrief.styleHints.length) return sanitizeProtectedStyleReferences(normalizedBrief.styleHints.join(', '));
  if (isCombatBrief(normalizeText(brief))) return 'cinematic, stylized combat, high-energy camera';
  if (/\bpremium|luxury|commercial\b/i.test(brief)) return 'premium commercial polish';
  return 'clear cinematic direction with one coherent visual style';
}

function summarizeAudio(brief: string, normalizedBrief: AiStrategistNormalizedBrief): string {
  if (normalizedBrief.hasVoiceover) return 'off-camera voiceover with light SFX';
  if (normalizedBrief.hasDialogue || normalizedBrief.hasLipSyncIntent) return 'short dialogue using a compatible audio/lip-sync workflow';
  if (isCombatBrief(normalizeText(brief))) return 'impact SFX and urban ambience';
  return 'ambience and subtle SFX, or off for first approval pass';
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeProtectedStyleReferences(value: string): string {
  return value
    .replace(/\bstreet[-\s]?fighter\b/gi, 'arcade combat')
    .replace(/\bStreet Fighter\s+style\s+fight\b/gi, 'arcade fighting / stylized combat scene')
    .replace(/\bStreet Fighter\s+(?:style|aesthetic|inspiration)\b/gi, 'arcade fighting / stylized combat inspiration')
    .replace(/\binspired by\s+Street Fighter\b/gi, 'inspired by arcade fighting games and stylized combat')
    .replace(/\bStreet Fighter\b/gi, 'arcade fighting / stylized combat')
    .replace(/\bMortal Kombat\b/gi, 'dark arcade fighting game inspiration')
    .replace(/\bGrand Theft Auto\b|\bGTA\b/gi, 'open-world urban crime-drama inspiration')
    .replace(/\bFortnite\b/gi, 'colorful stylized battle-game inspiration')
    .replace(/\bMinecraft\b/gi, 'blocky voxel-world inspiration')
    .replace(/\bPok[eé]mon\b/gi, 'creature-collector adventure inspiration')
    .replace(/\bMarvel\b/gi, 'superhero comic-book inspiration')
    .replace(/\bDisney\b/gi, 'family-friendly animated film inspiration')
    .replace(/\bStar Wars\b/gi, 'space-opera sci-fi inspiration');
}
