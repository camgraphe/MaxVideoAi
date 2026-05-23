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
