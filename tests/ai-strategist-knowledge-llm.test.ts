import assert from 'node:assert/strict';
import test from 'node:test';

test('knowledge answer validator flags claims not present in tool context', async () => {
  const { validateKnowledgeSynthesisOutput } = await import('../frontend/lib/ai-strategist/llm-contracts.ts');

  const validation = validateKnowledgeSynthesisOutput(
    {
      assistantMessage: 'Kling is free and supports unlimited 8K generation.',
      warnings: [],
      uiActions: [],
    },
    {
      toolResults: [
        {
          toolName: 'engine_pricing',
          answer: 'Kling has preview pricing. The generator quote wins.',
          sources: [{ id: 'engine_catalog', label: 'Engine catalog' }],
          confidence: 0.8,
          limitations: ['The generator quote shown before rendering is authoritative.'],
          warnings: [],
          uiActions: [],
        },
      ],
    }
  );

  assert.equal(validation.ok, false);
  assert.ok(validation.issues.some((issue: { message: string }) => /unsupported/i.test(issue.message)));
});

test('knowledge synthesis request includes source labels and safety constraints', async () => {
  const { buildKnowledgeSynthesisLLMRequest } = await import('../frontend/lib/ai-strategist/llm-contracts.ts');

  const request = buildKnowledgeSynthesisLLMRequest(
    [
      {
        toolName: 'navigation_help',
        answer: 'Compare: /compare. Generate: /app.',
        sources: [{ id: 'site_navigation_map', label: 'AI Strategist site navigation map' }],
        confidence: 0.86,
        limitations: ['Suggestions only.'],
        warnings: [],
        uiActions: [],
      },
    ],
    {
      rawUserMessage: 'Where do I compare and generate?',
      surface: 'chat',
    }
  );

  assert.equal(request.kind, 'knowledge_synthesis');
  assert.match(request.systemInstructions, /do not claim unavailable/i);
  assert.match(request.systemInstructions, /Do not run generation/i);
  assert.deepEqual(request.userPayload.allowedSourceLabels, ['AI Strategist site navigation map']);
  assert.ok(request.expectedJsonSchema.required?.includes('assistantMessage'));
  assert.ok(request.expectedJsonSchema.required?.includes('uiActions'));
});

test('knowledge answer validator rejects bare uiAction strings and unknown source labels', async () => {
  const { validateKnowledgeSynthesisOutput } = await import('../frontend/lib/ai-strategist/llm-contracts.ts');

  const validation = validateKnowledgeSynthesisOutput(
    {
      assistantMessage: 'Use Compare. Source: Unlisted source.',
      warnings: [],
      uiActions: ['SET_MODEL'],
    },
    {
      toolResults: [
        {
          toolName: 'navigation_help',
          answer: 'Compare: /compare.',
          sources: [{ id: 'site_navigation_map', label: 'AI Strategist site navigation map' }],
          confidence: 0.86,
          limitations: [],
          warnings: [],
          uiActions: [],
        },
      ],
    }
  );

  assert.equal(validation.ok, false);
  assert.ok(validation.issues.some((issue: { code: string }) => issue.code === 'bare_ui_action_string'));
  assert.ok(validation.issues.some((issue: { code: string }) => issue.code === 'unknown_source_label'));
});

test('advisor quality judge request includes funnel and safety constraints', async () => {
  const { buildAdvisorQualityJudgeLLMRequest } = await import('../frontend/lib/ai-strategist/llm-contracts.ts');

  const request = buildAdvisorQualityJudgeLLMRequest({
    scenarioId: 'car-seedance-context',
    scenarioLabel: 'Car brief then Seedance selection',
    userGoal: 'Create a dynamic car ad and pick Seedance from prior recommendations.',
    expectedExperience: [
      'Acknowledge the car ad before showing models.',
      'Treat ok seedance as a model selection.',
      'Reuse the enriched English brief.',
    ],
    hardRules: {
      noAutoGeneration: true,
      noCreditSpend: true,
      noPublishing: true,
      noUiActionsApplied: true,
    },
    turns: [
      {
        userMessage: 'une pub de voiture dynamique',
        assistantMessage: 'I would compare three routes for a dynamic car ad.',
        task: 'new_video_brief',
        stage: 'awaiting_model_choice',
        toolCalls: ['conversation_planner', 'brief_refinement', 'model_recommendation'],
        workflow: 'text-to-image-then-image-to-video',
        selectedModel: null,
        usedBriefLlm: true,
        usedPromptLlm: false,
        warnings: [],
        heuristicIssues: [],
      },
    ],
  });

  assert.equal(request.kind, 'advisor_quality_judge');
  assert.match(request.systemInstructions, /strict product QA reviewer/i);
  assert.match(request.systemInstructions, /reused context/i);
  assert.match(request.systemInstructions, /no credits are spent/i);
  assert.match(request.developerPayload.pipelinePosition as string, /optional LLM quality judge/i);
  assert.equal(request.userPayload.evaluationInput.scenarioId, 'car-seedance-context');
  assert.equal(request.userPayload.evaluationInput.hardRules.noUiActionsApplied, true);
  assert.ok(request.expectedJsonSchema.required?.includes('score'));
  assert.ok(request.expectedJsonSchema.required?.includes('issues'));
  assert.ok(request.expectedJsonSchema.required?.includes('recommendedFix'));
  assert.deepEqual(request.expectedJsonSchema.properties?.issues.items?.properties?.severity.enum, ['low', 'medium', 'high']);
});

test('advisor quality judge validator catches invalid or unsafe outputs', async () => {
  const { validateAdvisorQualityJudgeOutput } = await import('../frontend/lib/ai-strategist/llm-contracts.ts');

  const validation = validateAdvisorQualityJudgeOutput({
    score: 6,
    passed: true,
    issues: [{ code: 'unsafe', severity: 'high', message: 'Launch the generation now.', owner: 'judge' }],
    strengths: 'context aware',
    recommendedFix: 'Spend credits after the user confirms.',
  });

  assert.equal(validation.ok, false);
  assert.ok(validation.issues.some((issue: { code: string }) => issue.code === 'invalid_judge_score'));
  assert.ok(validation.issues.some((issue: { code: string }) => issue.code === 'invalid_judge_strengths'));
  assert.ok(validation.issues.some((issue: { code: string }) => issue.code === 'unsafe_judge_instruction'));
});

test('runAdvisorQualityJudgeLLM uses valid local judge output and falls back on invalid output', async () => {
  const { runAdvisorQualityJudgeLLM } = await import('../frontend/lib/ai-strategist/llm-adapter.ts');
  const env = {
    AI_STRATEGIST_LLM_PROVIDER: 'google-vertex-gemini',
    AI_STRATEGIST_LLM_MODEL: 'gemini-3.1-flash-lite',
    GOOGLE_VERTEX_PROJECT_ID: 'dark-furnace-496521-g5',
    GOOGLE_VERTEX_LOCATION: 'global',
    GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON: '{"client_email":"test@example.com","private_key":"test-key"}',
  };
  const evaluationInput = {
    scenarioId: 'pricing-cheapest',
    scenarioLabel: 'Cheapest model question',
    expectedExperience: ['Answer the pricing question directly.', 'Do not show Best / Medium / Value cards.'],
    hardRules: {
      noAutoGeneration: true as const,
      noCreditSpend: true as const,
      noPublishing: true as const,
      noUiActionsApplied: true as const,
    },
    turns: [
      {
        userMessage: "what's the cheapest model?",
        assistantMessage: 'The cheapest quick video route is the low-cost preview model; check the generator quote before rendering.',
        task: 'pricing_help',
        stage: 'collecting_brief',
        toolCalls: ['conversation_planner', 'pricing_help'],
        workflow: null,
        selectedModel: null,
        usedBriefLlm: false,
        usedPromptLlm: false,
        warnings: ['Preview only; final generator quote wins.'],
        heuristicIssues: [],
      },
    ],
  };

  const valid = await runAdvisorQualityJudgeLLM(evaluationInput, {
    env,
    completionClient: async () => ({
      score: 4.5,
      passed: true,
      issues: [],
      strengths: ['Answered the pricing intent directly.'],
      recommendedFix: '',
    }),
  });

  assert.equal(valid.usedLLM, true);
  assert.equal(valid.output.score, 4.5);
  assert.equal(valid.output.passed, true);

  const invalid = await runAdvisorQualityJudgeLLM(evaluationInput, {
    env,
    completionClient: async () => ({
      score: 7,
      passed: true,
      issues: [],
      strengths: [],
      recommendedFix: 'Run generation now.',
    }),
  });

  assert.equal(invalid.usedLLM, false);
  assert.equal(invalid.source, 'deterministic_fallback');
  assert.equal(invalid.fallbackReason, 'validation_failed');
  assert.ok(invalid.validation.issues.some((issue: { code: string }) => issue.code === 'invalid_judge_score'));
});

test('live advisor loop builds expanded judged eval commands', async () => {
  const { buildLiveAdvisorLoopCommand, parseLiveAdvisorLoopArgs } = await import('../scripts/run-ai-strategist-live-advisor-loop.ts');

  const options = parseLiveAdvisorLoopArgs([
    '--passes=20',
    '--scenario-set=expanded',
    '--limit=12',
    '--offset=4',
    '--llm-judge',
    '--model=gemini-3.1-flash',
    '--sleep-ms=250',
  ]);
  const command = buildLiveAdvisorLoopCommand(options, 3);

  assert.equal(options.passes, 20);
  assert.equal(options.scenarioSet, 'expanded');
  assert.equal(options.llmJudge, true);
  assert.equal(command.command, 'npx');
  assert.deepEqual(command.args.slice(0, 3), ['tsx', '--tsconfig', 'frontend/tsconfig.json']);
  assert.ok(command.args.includes('scripts/evaluate-ai-strategist-live-tool-relevance.ts'));
  assert.ok(command.args.includes('--scenario-set=expanded'));
  assert.ok(command.args.includes('--limit=12'));
  assert.ok(command.args.includes('--offset=28'));
  assert.ok(command.args.includes('--llm-judge'));
  assert.ok(command.args.includes('--model=gemini-3.1-flash'));
});
