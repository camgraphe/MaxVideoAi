import { runAiStrategistPlaygroundPipeline } from '../frontend/lib/ai-strategist/playground-pipeline.ts';
import type { AiStrategistModelId, AiStrategistWorkflowId } from '../frontend/lib/ai-strategist/types.ts';

type ConversationTurn = {
  label: string;
  userMessage: string;
  mode?: 'recommend' | 'build_prompt' | 'improve_prompt' | 'product_help';
  currentPrompt?: string;
  pickTier?: 'best' | 'medium' | 'value';
  selectedModel?: AiStrategistModelId;
  selectedWorkflow?: AiStrategistWorkflowId;
  uploadedAsset?: {
    type?: string;
    hasPerson?: boolean;
    hasProduct?: boolean;
    hasLogo?: boolean;
    hasText?: boolean;
    isReferenceImage?: boolean;
  };
  expect: (result: AnyResult, previous?: AnyResult) => string[];
};

type ConversationScenario = {
  label: string;
  turns: ConversationTurn[];
};

type AnyResult = Awaited<ReturnType<typeof runAiStrategistPlaygroundPipeline>>;

const scenarios: ConversationScenario[] = [
  {
    label: 'Pricing help: cheapest model on the site',
    turns: [
      {
        label: 'asks for cheapest model',
        userMessage: 'quelle est le model le moins cher sur le site ?',
        expect: (result) => [
          expectEqual(result.orchestrationPlan.task, 'pricing_help', 'routes to pricing_help'),
          expectEqual(result.mode, 'product_help', 'stays in product_help'),
          expectMissing(result.recommendations, 'does not show recommendation cards'),
          expectIncludes(result.assistantMessage, /moins cher|cheapest/i, 'answers the cheapest-model question'),
          expectIncludes(result.assistantMessage, /\$0\.04|4 cents/i, 'uses catalog price basis'),
        ].filter(Boolean),
      },
    ],
  },
  {
    label: 'Capabilities help in French',
    turns: [
      {
        label: 'asks what the assistant can do',
        userMessage: 'tu peux faire quoi exactement ?',
        expect: (result) => [
          expectEqual(result.orchestrationPlan.task, 'capability_help', 'routes to capability help'),
          expectMissing(result.recommendations, 'does not show model cards'),
          expectIncludes(result.assistantMessage, /mod[eè]le|prompt|prix|workflow/i, 'explains strategist capabilities'),
          expectIncludes(result.assistantMessage, /ne lance|cr[eé]dits/i, 'keeps safety clear'),
        ].filter(Boolean),
      },
    ],
  },
  {
    label: 'General product help',
    turns: [
      {
        label: 'asks how MaxVideoAI works',
        userMessage: 'comment fonctionne MaxVideoAI ?',
        expect: (result) => [
          expectEqual(result.orchestrationPlan.task, 'site_overview_help', 'routes to site overview'),
          expectEqual(result.mode, 'product_help', 'stays in product_help'),
          expectMissing(result.recommendations, 'does not show model cards'),
          expectIncludes(result.assistantMessage, /g[eé]n[eé]rateur|workflow|prix/i, 'explains product flow'),
        ].filter(Boolean),
      },
    ],
  },
  {
    label: 'Named model pricing',
    turns: [
      {
        label: 'asks Veo Lite price',
        userMessage: 'combien coute Veo 3.1 Lite pour 10 secondes ?',
        expect: (result) => [
          expectEqual(result.orchestrationPlan.task, 'pricing_help', 'routes to pricing help'),
          expectMissing(result.recommendations, 'does not show model cards'),
          expectIncludes(result.assistantMessage, /Veo 3\.1 Lite|Google Veo 3\.1 Lite/i, 'answers for named model'),
          expectIncludes(result.assistantMessage, /10 seconds|10 secondes/i, 'keeps requested duration'),
          expectIncludes(result.assistantMessage, /\$0\.50|\$1\.20|Estimated price|pricing/i, 'includes a price estimate'),
        ].filter(Boolean),
      },
    ],
  },
  {
    label: 'Model knowledge answer',
    turns: [
      {
        label: 'asks what Seedance can do',
        userMessage: 'Seedance 2 ça sert à quoi ?',
        expect: (result) => [
          expectEqual(result.orchestrationPlan.task, 'model_info_help', 'routes to model info'),
          expectMissing(result.recommendations, 'does not show model cards'),
          expectIncludes(result.assistantMessage, /Seedance 2\.0/i, 'answers about Seedance'),
          expectIncludes(result.assistantMessage, /social|motion|audio|workflow|video/i, 'gives useful model traits'),
        ].filter(Boolean),
      },
    ],
  },
  {
    label: 'Engine settings answer',
    turns: [
      {
        label: 'asks Kling 4K settings',
        userMessage: 'quelles settings supporte Kling 3 4K ?',
        expect: (result) => [
          expectEqual(result.orchestrationPlan.task, 'model_info_help', 'routes settings through model info'),
          expectMissing(result.recommendations, 'does not show model cards'),
          expectIncludes(result.assistantMessage, /Kling 3 4K/i, 'answers for Kling 3 4K'),
          expectIncludes(result.assistantMessage, /Duration|Resolutions|Aspect ratios|Audio/i, 'shows settings fields'),
        ].filter(Boolean),
      },
    ],
  },
  {
    label: 'Workflow guidance',
    turns: [
      {
        label: 'asks image-to-video explanation',
        userMessage: 'explique moi image-to-video',
        expect: (result) => [
          expectEqual(result.orchestrationPlan.task, 'workflow_help', 'routes to workflow help'),
          expectMissing(result.recommendations, 'does not show model cards'),
          expectIncludes(result.assistantMessage, /reference image|motion prompt|image-to-video/i, 'explains reference-image workflow'),
        ].filter(Boolean),
      },
    ],
  },
  {
    label: 'Examples navigation',
    turns: [
      {
        label: 'asks for Kling examples',
        userMessage: 'montre moi des exemples Kling',
        expect: (result) => [
          expectEqual(result.orchestrationPlan.task, 'examples_help', 'routes to examples help'),
          expectMissing(result.recommendations, 'does not show model cards'),
          expectIncludes(result.assistantMessage, /Kling examples|\/examples\/kling/i, 'points to Kling examples'),
        ].filter(Boolean),
      },
    ],
  },
  {
    label: 'Compare and generate navigation',
    turns: [
      {
        label: 'asks where to compare models',
        userMessage: 'où comparer les modèles avant de générer ?',
        expect: (result) => [
          expectEqual(result.orchestrationPlan.task, 'navigation_help', 'routes to navigation help'),
          expectMissing(result.recommendations, 'does not show model cards'),
          expectIncludes(result.assistantMessage, /Compare|\/compare|Generate|\/app/i, 'points to compare/generate destinations'),
        ].filter(Boolean),
      },
    ],
  },
  {
    label: 'French car brief then Seedance selection',
    turns: [
      {
        label: 'new car brief',
        userMessage: 'une pub de voiture dynamique',
        expect: (result) => [
          expectEqual(result.conversationStage, 'awaiting_model_choice', 'waits for model choice'),
          expectPresent(result.recommendations, 'shows recommendations'),
        ].filter(Boolean),
      },
      {
        label: 'selects Seedance by alias',
        userMessage: 'ok seedance',
        expect: (result) => [
          expectEqual(result.selectedModel, 'seedance-2-0', 'selects Seedance 2.0'),
          expectNotIncludes(result.assistantMessage, /Subject:\s*une pub de voiture dynamique/i, 'does not paste raw French as subject'),
          expectNotEqual(result.conversationStage, 'awaiting_model_choice', 'does not restart model choice'),
        ].filter(Boolean),
      },
    ],
  },
  {
    label: 'Clear perfume brief',
    turns: [
      {
        label: 'gives detailed premium product brief',
        userMessage: 'Luxury perfume ad on black marble, 9:16, premium look, slow camera push-in, soft gold reflections',
        expect: (result) => [
          expectEqual(result.conversationStage, 'awaiting_model_choice', 'recommends models instead of generic clarification'),
          expectPresent(result.recommendations, 'shows recommendations'),
          expectIncludes(result.warnings.join('\n'), /Exact labels, logos, legal copy/i, 'keeps product text/logo warning'),
          expectNotIncludes(result.assistantMessage, /What video are you trying to create/i, 'does not ask generic clarification'),
        ].filter(Boolean),
      },
    ],
  },
  {
    label: 'Fast social sneaker voiceover',
    turns: [
      {
        label: 'asks fast path with assumptions',
        userMessage: 'Make assumptions and create a TikTok sneaker ad with voiceover',
        expect: (result) => [
          expectEqual(result.normalizedBrief.hasVoiceover, true, 'detects voiceover'),
          expectEqual(result.normalizedBrief.hasVisibleSpeaker, false, 'does not invent visible speaker'),
          expectPresent(result.recommendations, 'shows recommendations'),
          expectNotIncludes(result.assistantMessage, /What video are you trying to create/i, 'does not ask generic clarification'),
        ].filter(Boolean),
      },
      {
        label: 'chooses best and reaches confirmation',
        userMessage: 'Choose best',
        pickTier: 'best',
        expect: (result) => [
          expectEqual(result.conversationStage, 'awaiting_confirmation', 'uses assumptions and confirms'),
          expectIncludes(result.assistantMessage, /off-camera voiceover/i, 'keeps voiceover off-camera'),
          expectIncludes(result.assistantMessage, /Duration:/i, 'includes duration'),
          expectIncludes(result.assistantMessage, /Estimated price:/i, 'includes price'),
        ].filter(Boolean),
      },
    ],
  },
  {
    label: 'Vague stylized fight brief',
    turns: [
      {
        label: 'gives trademarked vague inspiration',
        userMessage: 'I want a Street Fighter style fight',
        expect: (result) => [
          expectEqual(result.conversationStage, 'awaiting_model_choice', 'starts with model recommendations'),
          expectPresent(result.recommendations, 'shows recommendations'),
        ].filter(Boolean),
      },
      {
        label: 'chooses best and gets useful missing-field questions',
        userMessage: 'Choose best',
        pickTier: 'best',
        expect: (result) => [
          expectEqual(result.conversationStage, 'collecting_missing_fields', 'asks targeted missing questions'),
          expectIncludes(result.assistantMessage, /one fighter|two fighters|arcade|stylized|setting/i, 'asks useful creative questions'),
          expectNotIncludes(result.assistantMessage, /Street Fighter/i, 'sanitizes trademark wording'),
        ].filter(Boolean),
      },
      {
        label: 'accepts assumptions',
        userMessage: 'make assumptions',
        expect: (result) => [
          expectEqual(result.conversationStage, 'awaiting_confirmation', 'moves to confirmation'),
          expectIncludes(result.assistantMessage, /arcade fighting|stylized combat/i, 'uses descriptive alternative'),
          expectNotIncludes(result.assistantMessage, /Street Fighter/i, 'keeps trademark out of summary'),
        ].filter(Boolean),
      },
      {
        label: 'generates prompt after confirmation',
        userMessage: 'Generate prompt',
        expect: (result) => [
          expectEqual(result.conversationStage, 'prompt_ready', 'generates only after confirmation'),
          expectIncludes(result.sanitizedFinalOutput?.finalPrompt ?? '', /arcade fighting|stylized combat/i, 'final prompt uses sanitized description'),
          expectNotIncludes(result.sanitizedFinalOutput?.finalPrompt ?? '', /Street Fighter/i, 'final prompt avoids trademark style requirement'),
        ].filter(Boolean),
      },
    ],
  },
  {
    label: 'Prompt edit intake remains conversational',
    turns: [
      {
        label: 'asks to share a Seedance prompt',
        userMessage: 'je veux editer un prompt pour seedance 2, je peux te le partager ?',
        expect: (result) => [
          expectEqual(result.conversationPlan.action, 'await_prompt_paste', 'asks user to paste the prompt'),
          expectEqual(result.selectedModel, 'seedance-2-0', 'keeps Seedance selected'),
          expectIncludes(result.assistantMessage, /colle ton prompt|paste/i, 'invites prompt paste'),
          expectMissing(result.recommendations, 'does not recommend models'),
        ].filter(Boolean),
      },
    ],
  },
  {
    label: 'Prompt paste after intake',
    turns: [
      {
        label: 'asks to share a prompt',
        userMessage: 'je veux editer un prompt pour seedance 2, je peux te le partager ?',
        expect: (result) => [
          expectEqual(result.conversationStage, 'awaiting_prompt_paste', 'waits for prompt paste'),
          expectEqual(result.selectedModel, 'seedance-2-0', 'keeps Seedance selected'),
        ].filter(Boolean),
      },
      {
        label: 'pastes prompt',
        userMessage: 'A sneaker spins on a concrete floor with a quick camera move and neon light',
        expect: (result) => [
          expectEqual(result.conversationPlan.action, 'improve_prompt', 'treats pasted text as prompt to improve'),
          expectNotEqual(result.conversationStage, 'awaiting_model_choice', 'does not restart recommendations'),
          expectPresent(result.currentPrompt ?? result.promptGenerationContext?.currentPrompt, 'stores pasted prompt context'),
        ].filter(Boolean),
      },
    ],
  },
  {
    label: 'Current prompt improvement',
    turns: [
      {
        label: 'improves existing perfume prompt',
        userMessage: 'make it more premium',
        currentPrompt: 'Perfume bottle on marble, cinematic',
        mode: 'recommend',
        selectedModel: 'kling-3-pro',
        expect: (result) => [
          expectEqual(result.conversationPlan.action, 'improve_prompt', 'routes to prompt improvement'),
          expectEqual(result.workflow, 'text-to-image-then-image-to-video', 'prefers controlled product workflow'),
          expectNotEqual(result.conversationStage, 'awaiting_model_choice', 'does not show model cards'),
          expectIncludes(result.assistantMessage, /Generate the prompt|Here.s what I.ll build|Starting image/i, 'continues improvement flow'),
        ].filter(Boolean),
      },
    ],
  },
  {
    label: 'Duration edit during confirmation',
    turns: [
      {
        label: 'spokesperson product reference brief',
        userMessage: 'j aimerai un spokesperson avec mon produit dans les mains, j ai juste une image',
        expect: (result) => [
          expectEqual(result.conversationStage, 'awaiting_model_choice', 'waits for model choice'),
          expectPresent(result.recommendations, 'shows model cards'),
        ].filter(Boolean),
      },
      {
        label: 'chooses best card',
        userMessage: 'Choose best',
        pickTier: 'best',
        expect: (result) => [
          expectNotEqual(result.conversationStage, 'awaiting_model_choice', 'continues after model selection'),
          expectPresent(result.selectedModel, 'keeps selected model'),
        ].filter(Boolean),
      },
      {
        label: 'adds product and TikTok dialogue details',
        userMessage: 'un casque audio, je veux qu ils disent que c est beau et que le son est top, pour TikTok en mode influencer en anglais',
        expect: (result) => [
          expectEqual(result.conversationStage, 'awaiting_confirmation', 'shows confirmation summary'),
          expectIncludes(result.assistantMessage, /Duration:/i, 'includes duration'),
          expectIncludes(result.assistantMessage, /Estimated price:/i, 'includes price estimate'),
        ].filter(Boolean),
      },
      {
        label: 'changes duration only',
        userMessage: 'je veux que ca dure 15 secondes',
        expect: (result, previous) => [
          expectEqual(result.conversationPlan.action, 'build_prompt', 'treats duration as brief revision'),
          expectNotEqual(result.conversationStage, 'awaiting_model_choice', 'does not restart model choice'),
          expectEqual(result.selectedModel, previous?.selectedModel, 'preserves selected model'),
          expectIncludes(result.assistantMessage, /Duration: 15 seconds/i, 'updates duration in summary'),
        ].filter(Boolean),
      },
    ],
  },
  {
    label: 'Format change during confirmation',
    turns: [
      {
        label: 'starts clear perfume brief',
        userMessage: 'Luxury perfume ad on black marble, premium look, slow camera push-in',
        expect: (result) => [
          expectEqual(result.conversationStage, 'awaiting_model_choice', 'waits for model choice'),
          expectPresent(result.recommendations, 'shows model cards'),
        ].filter(Boolean),
      },
      {
        label: 'chooses medium',
        userMessage: 'Choose medium',
        pickTier: 'medium',
        expect: (result) => [
          expectNotEqual(result.conversationStage, 'awaiting_model_choice', 'continues after tier choice'),
          expectPresent(result.selectedModel, 'keeps selected model'),
        ].filter(Boolean),
      },
      {
        label: 'changes format to vertical',
        userMessage: 'mets le format en 9:16',
        expect: (result, previous) => [
          expectEqual(result.conversationPlan.action, 'build_prompt', 'treats format as contextual revision'),
          expectEqual(result.selectedModel, previous?.selectedModel, 'preserves model'),
          expectNotEqual(result.conversationStage, 'awaiting_model_choice', 'does not restart model choice'),
          expectIncludes(result.assistantMessage, /9:16|vertical/i, 'updates format'),
        ].filter(Boolean),
      },
    ],
  },
  {
    label: 'Model switch during confirmation',
    turns: [
      {
        label: 'starts car brief',
        userMessage: 'cinematic car commercial at night, premium reflections',
        expect: (result) => [
          expectEqual(result.conversationStage, 'awaiting_model_choice', 'waits for model choice'),
          expectPresent(result.recommendations, 'shows recommendations'),
        ].filter(Boolean),
      },
      {
        label: 'chooses best',
        userMessage: 'Choose best',
        pickTier: 'best',
        expect: (result) => [
          expectNotEqual(result.conversationStage, 'awaiting_model_choice', 'continues after model choice'),
          expectPresent(result.selectedModel, 'has selected model'),
        ].filter(Boolean),
      },
      {
        label: 'switches model explicitly',
        userMessage: 'change model to seedance',
        expect: (result) => [
          expectEqual(result.conversationPlan.action, 'select_model', 'treats explicit model switch as model selection'),
          expectEqual(result.selectedModel, 'seedance-2-0', 'switches to Seedance'),
          expectNotEqual(result.conversationStage, 'awaiting_model_choice', 'does not restart recommendations'),
        ].filter(Boolean),
      },
    ],
  },
  {
    label: 'Uploaded person image speaking',
    turns: [
      {
        label: 'asks to animate person reference speaking',
        userMessage: 'Animate this person image speaking to camera',
        uploadedAsset: { type: 'image', hasPerson: true, isReferenceImage: true },
        expect: (result) => [
          expectEqual(result.normalizedBrief.intent, 'person_reference_i2v', 'hard context sets person_reference_i2v'),
          expectEqual(result.workflow, 'image-to-video', 'uses image-to-video'),
          expectPresent(result.recommendations, 'shows compatible recommendations'),
          expectIncludes(result.warnings.join('\n'), /person|character|reference|Kling|LTX/i, 'includes person-reference warning'),
        ].filter(Boolean),
      },
    ],
  },
  {
    label: 'Product reference with text risk',
    turns: [
      {
        label: 'asks product photo animation with label',
        userMessage: 'Animate this skincare bottle product photo, preserve label and packaging, 9:16',
        uploadedAsset: { type: 'image', hasProduct: true, hasLogo: true, hasText: true, isReferenceImage: true },
        expect: (result) => [
          expectEqual(result.workflow, 'image-to-video', 'uses image-to-video for uploaded product reference'),
          expectPresent(result.recommendations, 'shows product-reference recommendations'),
          expectIncludes(result.warnings.join('\n'), /Exact labels, logos, legal copy|tiny text/i, 'keeps text/logo warning'),
          expectNotIncludes(result.warnings.join('\n'), /Person\/character reference/i, 'does not apply person warning to product reference'),
        ].filter(Boolean),
      },
    ],
  },
  {
    label: 'Video-to-video restyle',
    turns: [
      {
        label: 'asks to restyle uploaded video',
        userMessage: 'I have a short video, restyle it as a premium cinematic ad',
        selectedWorkflow: 'video-to-video',
        expect: (result) => [
          expectEqual(result.workflow, 'video-to-video', 'preserves selected video-to-video workflow'),
          expectPresent(result.recommendations, 'shows recommendations'),
          expectNotIncludes(result.assistantMessage, /What video are you trying to create/i, 'does not ask generic clarification'),
        ].filter(Boolean),
      },
    ],
  },
  {
    label: 'Ambiguous prompt improvement',
    turns: [
      {
        label: 'asks make it better without context',
        userMessage: 'make it better',
        expect: (result) => [
          expectEqual(result.conversationPlan.action, 'ask_clarification', 'asks for clarification'),
          expectMissing(result.recommendations, 'does not show recommendations'),
          expectIncludes(result.assistantMessage, /What prompt do you want me to improve|What video/i, 'asks short clarification'),
        ].filter(Boolean),
      },
    ],
  },
  {
    label: 'Navigation help: image upload',
    turns: [
      {
        label: 'asks where to upload image',
        userMessage: 'where do I upload an image?',
        expect: (result) => [
          expectEqual(result.orchestrationPlan.task, 'asset_reference_help', 'routes to asset reference help'),
          expectEqual(result.mode, 'product_help', 'stays in help mode'),
          expectMissing(result.recommendations, 'does not show model cards'),
          expectIncludes(result.assistantMessage, /image-to-video|reference image/i, 'answers upload workflow'),
        ].filter(Boolean),
      },
    ],
  },
];

async function main() {
  const selected = filterScenarios(scenarios);
  let failed = 0;

  console.log('AI Strategist Conversation QA');
  console.log('Live LLM: disabled for deterministic regression pass');
  console.log('Auto-generation/credit spend/publish: no');
  console.log('');

  for (const scenario of selected) {
    const scenarioFailures = await runScenario(scenario);
    failed += scenarioFailures;
  }

  console.log(failed === 0 ? 'Overall: PASS' : `Overall: FAIL (${failed} issue${failed === 1 ? '' : 's'})`);
  if (failed > 0) process.exitCode = 1;
}

async function runScenario(scenario: ConversationScenario): Promise<number> {
  console.log(`Scenario: ${scenario.label}`);
  let state: ReturnType<typeof conversationStateFrom> | undefined;
  let previous: AnyResult | undefined;
  let failures = 0;

  for (const turn of scenario.turns) {
    const selectedTier = turn.pickTier;
    const selectedModel = selectedTier ? previous?.recommendations?.[selectedTier]?.model.id : undefined;
    const result = await runAiStrategistPlaygroundPipeline(
      {
        userMessage: turn.userMessage,
        mode: turn.mode ?? 'recommend',
        surface: 'chat',
        currentPrompt: turn.currentPrompt,
        uploadedAsset: turn.uploadedAsset,
        selectedTier,
        selectedModel,
        conversationState: state,
      },
      { env: {} }
    );

    const issues = turn.expect(result, previous);
    failures += issues.length;
    console.log(`  ${issues.length === 0 ? 'PASS' : 'FAIL'} ${turn.label}`);
    console.log(`    stage=${result.conversationStage}; action=${result.conversationPlan.action}; task=${result.orchestrationPlan.task}`);
    console.log(`    message=${oneLine(result.assistantMessage)}`);
    for (const issue of issues) console.log(`    - ${issue}`);

    previous = result;
    state = conversationStateFrom(result);
  }

  console.log('');
  return failures;
}

function conversationStateFrom(result: AnyResult) {
  return {
    lastNormalizedBrief: result.normalizedBrief,
    lastRecommendations: result.recommendations,
    lastSelectedWorkflow: result.workflow ?? undefined,
    lastSelectedModel: result.selectedModel ?? undefined,
    lastSelectedTier: result.selectedTier,
    stage: result.conversationStage,
    lastBriefCompletion: result.briefCompletion,
    lastFinalPrompt: result.sanitizedFinalOutput?.finalPrompt,
  };
}

function filterScenarios(allScenarios: ConversationScenario[]): ConversationScenario[] {
  const filters = process.argv
    .slice(2)
    .flatMap((arg, index, args) => {
      if (arg === '--case') return args[index + 1] ? [args[index + 1]] : [];
      if (arg.startsWith('--case=')) return [arg.slice('--case='.length)];
      return [];
    })
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (filters.length === 0) return allScenarios;
  return allScenarios.filter((scenario) => filters.some((filter) => scenario.label.toLowerCase().includes(filter)));
}

function expectEqual(actual: unknown, expected: unknown, label: string): string | undefined {
  return actual === expected ? undefined : `${label}: expected ${String(expected)}, got ${String(actual)}`;
}

function expectNotEqual(actual: unknown, unexpected: unknown, label: string): string | undefined {
  return actual !== unexpected ? undefined : `${label}: got ${String(actual)}`;
}

function expectPresent(value: unknown, label: string): string | undefined {
  return value ? undefined : `${label}: missing`;
}

function expectMissing(value: unknown, label: string): string | undefined {
  return value ? `${label}: present` : undefined;
}

function expectIncludes(value: string, pattern: RegExp, label: string): string | undefined {
  return pattern.test(value) ? undefined : `${label}: pattern ${pattern} not found`;
}

function expectNotIncludes(value: string, pattern: RegExp, label: string): string | undefined {
  return pattern.test(value) ? `${label}: pattern ${pattern} was found` : undefined;
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 220);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
