import { runAiStrategistPlaygroundPipeline } from '../frontend/lib/ai-strategist/playground-pipeline.ts';

type ConversationTurn = {
  label: string;
  userMessage: string;
  mode?: 'recommend' | 'build_prompt' | 'improve_prompt' | 'product_help';
  currentPrompt?: string;
  pickTier?: 'best' | 'medium' | 'value';
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
