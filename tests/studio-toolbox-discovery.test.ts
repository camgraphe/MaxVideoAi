import assert from 'node:assert/strict';
import test from 'node:test';
import { actionFromTool } from '../frontend/lib/studio/conversation-action-contract';
import { createStudioActionExecutor } from '../frontend/src/server/studio/conversation-actions';
import { createStudioConversationDirector } from '../frontend/src/server/studio/conversation-director';

const actor = { authMethod: 'studio-session' as const, userId: 'owner', projectId: 'film', clientId: null };
const project = { name: 'Film', revision: 0, memory: { revision: 0, brief: '', decisions: [] } };

function fixture() {
  const effects: string[] = [];
  const dependencies = { enabled: true, accountUrl: 'https://review.example.test/account/connections',
    generation: {} as never,
    readProject: async (current: typeof actor) => {
      effects.push('read-project');
      if (current.userId !== 'owner' || current.projectId !== 'film') throw new Error('STUDIO_PROJECT_NOT_FOUND');
      return project;
    },
    prepareImage: async () => { effects.push('prepare'); throw new Error('Discovery must not prepare generation.'); },
  };
  return { effects, dependencies, execute: createStudioActionExecutor(actor, dependencies) };
}

test('Milo tool discovery reads owned project context and returns navigation without paid execution', async () => {
  const { effects, execute } = fixture();
  const request = actionFromTool('creator_tools_read', {});
  assert.deepEqual(request, { action: 'tools.read' });
  const result = await execute(request);
  assert.equal(result.ok, true);
  if (!result.ok || result.action !== 'tools.read') throw new Error('Expected creator discovery');
  assert.equal(result.data.executionSurface, 'studio');
  assert.equal(result.data.directExecutionEnabled, false);
  assert.equal(result.data.tools.length, 5);
  assert.ok(result.data.tools.every(tool => tool.profiles.every(profile => profile.deploymentGateOpen === false)));
  assert.equal(result.data.tools[0].web.url, 'https://review.example.test/app/tools/subtitles');
  assert.equal(result.data.webHandoff.startsOperation, false);
  assert.equal(result.data.webHandoff.transfersMedia, false);
  assert.deepEqual(effects, ['read-project']);
});

test('Milo tool discovery rejects caller scope and cannot prepare or confirm a creator operation', async () => {
  for (const args of [{ userId: 'foreign' }, { projectId: 'other' }, { accountUrl: 'https://foreign.test' }, { confirmed: true }]) {
    assert.throws(() => actionFromTool('creator_tools_read', args));
  }
  assert.throws(() => actionFromTool('confirm_creator_tool', { confirmed: true }));
  const { dependencies, effects } = fixture();
  const request = actionFromTool('creator_tools_read', {});
  const foreign = await createStudioActionExecutor({ ...actor, userId: 'foreign' }, dependencies)(request);
  assert.equal(foreign.ok, false);
  const closed = await createStudioActionExecutor(actor, { ...dependencies, enabled: false })(request);
  assert.equal(closed.ok, false);
  assert.deepEqual(effects, ['read-project']);
});

test('the real Milo director can discover and return web handoff facts without a confirmation tool', async () => {
  const { execute, effects } = fixture();
  let calls = 0;
  const director = createStudioConversationDirector({ createResponse: async params => {
    calls++;
    const names = params.tools?.filter(tool => tool.type === 'function').map(tool => tool.name) ?? [];
    assert.ok(names.includes('creator_tools_read'));
    assert.ok(!names.includes('confirm_creator_tool'));
    if (calls === 1) return { id: 'tools-1', model: 'gpt-6.1-sol', status: 'completed', service_tier: 'default', usage: null,
      output_text: '', output: [{ type: 'function_call', name: 'creator_tools_read', call_id: 'tools-read', arguments: '{}' }] };
    const item = (params.input as Array<{type?: string; output?: string}>).find(value => value.type === 'function_call_output');
    const facts = JSON.parse(item?.output ?? '{}');
    assert.equal(facts.data.tools[0].web.url, 'https://review.example.test/app/tools/subtitles');
    assert.equal(facts.data.webHandoff.transfersMedia, false);
    return { id: 'tools-2', model: 'gpt-6.1-sol', status: 'completed', service_tier: 'default', usage: null,
      output_text: JSON.stringify({ reply: 'Open [Subtitles](https://review.example.test/app/tools/subtitles) to select a source and review its quote.' }), output: [] };
  } });
  const result = await director({ message: 'Which editing tools can I open?', references: [], history: [], project,
    checkpoint: async (_, create) => create(), execute: async (_, action) => execute(action) });
  assert.match(result.reply, /\[Subtitles\]\(https:\/\/review.example.test/);
  assert.equal(calls, 2);
  assert.deepEqual(effects, ['read-project']);
});
