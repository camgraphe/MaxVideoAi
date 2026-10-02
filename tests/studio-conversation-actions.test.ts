import assert from 'node:assert/strict';
import test from 'node:test';

test('the director reads real capabilities and writes its own image request without a payment tool', async () => {
  const module = await import('../frontend/src/server/studio/conversation-director').catch(() => null);
  assert.ok(module?.createStudioConversationDirector, 'Studio needs a tool-using Sol director');
  const requests: unknown[] = [];
  const events: string[] = [];
  let calls = 0;
  const director = module.createStudioConversationDirector({
    createResponse: async (params) => {
      requests.push(params);
      calls++;
      return {id: 'resp-' + calls, model: 'gpt-6.1-sol', status: 'completed', service_tier: 'default', usage: null,
        output_text: '', output: [{type: 'function_call', name: calls === 1 ? 'catalog_read' : 'image_prepare', call_id: 'call-' + calls, arguments: calls === 1 ? '{}' : JSON.stringify({reply: 'I chose a quiet cinematic direction. Review the image quote below.', prompt: 'A cream paper card on a walnut desk in warm cinematic light', aspectRatio: '16:9'})}]};
    },
  });
  const result = await director({message: "I'm new. Make a nice short film cheaply. You choose.", references: [], history: [],
    project: {name: 'Film', revision: 0, memory: {revision: 0, brief: '', decisions: []}},
    execute: async (callId, action) => {
      events.push('action:' + action.action);
      return action.action === 'catalog.read' ? {ok: true, action: 'catalog.read', data: [{modelId: 'gpt-image-2-5-flare', modes: ['t2i'], formats: ['16:9']}]}
        : {ok: true, action: 'image.prepare', data: {quoteId: 'quote', confirmationRequired: true}} as never;
    },
    checkpoint: async (index, create) => {events.push('model-start:' + index); const response = await create(); events.push('model-saved:' + index); return response;},
  });
  assert.equal(calls, 2);
  assert.match(result.reply, /Review the image quote/);
  assert.equal(result.image?.prompt, 'A cream paper card on a walnut desk in warm cinematic light');
  assert.deepEqual(events, ['model-start:0', 'model-saved:0', 'action:catalog.read', 'model-start:1', 'model-saved:1', 'action:image.prepare']);
  const serialized = JSON.stringify(requests);
  assert.match(serialized, /gpt-6.1-sol/);
  assert.match(serialized, /confirmation/);
  const toolNames = (requests[0] as {tools: {name: string}[]}).tools.map(tool => tool.name);
  assert.ok(!toolNames.includes('generation_confirm'));
  assert.ok(!toolNames.includes('shell'));
  assert.match(JSON.stringify(requests[1]), /gpt-image-2-5-flare/);
});

test('unknown or malformed model actions cannot execute, and bounded loops retain failure', async () => {
  const module = await import('../frontend/src/server/studio/conversation-director').catch(() => null);
  assert.ok(module?.createStudioConversationDirector);
  let executed = 0;
  const context = {message: 'Hi', references: [], history: [], project: {name: 'Film', revision: 0, memory: {revision: 0, brief: 'No neon, cheap landscape film', decisions: []}},
    execute: async () => {executed++; return {ok: true} as never;}, checkpoint: async (_: number, create: () => Promise<any>) => create()};
  const director = module.createStudioConversationDirector({createResponse: async () => ({id: 'resp', model: 'gpt-6.1-sol', status: 'completed', service_tier: 'default', usage: null, output_text: '', output: [{type: 'function_call', name: 'generation_confirm', call_id: 'call', arguments: '{}'}]})});
  await assert.rejects(director(context), {code: 'PARAMETER_INVALID'});
  assert.equal(executed, 0);
  const loop = module.createStudioConversationDirector({createResponse: async () => ({id: 'resp', model: 'gpt-6.1-sol', status: 'completed', service_tier: 'default', usage: null, output_text: '', output: [{type: 'function_call', name: 'catalog_read', call_id: 'call-' + executed, arguments: '{}'}]})});
  await assert.rejects(loop(context), {code: 'PARAMETER_INVALID'});
  assert.equal(executed, 3,'The final slot cannot continue a nonterminal tool loop.');
});

test('project, catalog and memory reads leave the fourth response available for a terminal quote', async () => {
  const {createStudioConversationDirector}=await import('../frontend/src/server/studio/conversation-director');
  const actions: string[]=[];
  let calls=0;
  const sequence=[['project_read',{}],['catalog_read',{}],['project_remember',{revision:0,brief:'A cheap Studio film',decisions:['Start with one concept image.']}],['image_prepare',{reply:'A playful paper spark. Review the quote before creation.',prompt:'A tiny glowing spark unfolding into sculptural coloured paper on charcoal',aspectRatio:'16:9'}]] as const;
  const director=createStudioConversationDirector({createResponse:async params=>{
    const index=calls++;
    if(index===3){
      assert.equal(params.tool_choice,'auto','An exact quote must remain possible in the bounded final response.');
      const names=params.tools?.filter(tool=>tool.type==='function').map(tool=>tool.name);
      assert.deepEqual(names,['image_prepare'],'The final slot may only finish with a quote or a reply.');
    }
    const [name,args]=sequence[index];
    return {id:'bounded-'+index,model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:null,output_text:'',output:[{type:'function_call',name,call_id:'bounded-'+index,arguments:JSON.stringify(args)}]};
  }});
  const result=await director({message:'Yes, surprise me. Keep it cheap.',references:[],history:[],project:{name:'Film',revision:0,memory:{revision:0,brief:'',decisions:[]}},
    checkpoint:async(_,create)=>create(),execute:async(_,action)=>{actions.push(action.action);return {ok:true,action:action.action,data:{quoteId:'bounded-quote',confirmationRequired:true}} as never;}});
  assert.equal(calls,4);
  assert.deepEqual(actions,['project.read','catalog.read','project.remember','image.prepare']);
  assert.match(result.reply,/Review the quote/);
  assert.ok(result.image?.prompt);
});

test('action contracts reject foreign identities, unsupported media and confirmation requests', async () => {
  const module = await import('../frontend/lib/studio/conversation-action-contract').catch(() => null);
  assert.ok(module?.studioActionRequestSchema);
  const schema = module.studioActionRequestSchema;
  assert.ok(schema.safeParse({action: 'project.read'}).success);
  for (const request of [{action: 'generation.confirm', quoteId: 'x'}, {action: 'project.read', userId: 'foreign'}, {action: 'video.prepare', prompt: 'x'}, {action: 'image.prepare', prompt: 'x', reply: 'x', aspectRatio: '21:9'}])
    assert.equal(schema.safeParse(request).success, false);
});
