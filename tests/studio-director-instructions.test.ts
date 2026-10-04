import assert from 'node:assert/strict';
import test from 'node:test';
import {createStudioConversationDirector} from '../frontend/src/server/studio/conversation-director';

// These are the request-envelope contracts, not a claim to test artistic judgment.
test('director sends creative purpose, current help and live quote rules with its gated tools', async () => {
  for (const enabled of [false,true]) {
    let calls=0;
    const director=createStudioConversationDirector({mediaEnabled: enabled,editingEnabled: enabled,exportsEnabled: enabled,createResponse: async params=> {
      calls++;
      const instructions=String(params.instructions);
      assert.match(instructions,/creative partner/i);
      assert.match(instructions,/prompt.*single asset.*edit/i);
      assert.match(instructions,/editorialGuidance/);
      assert.match(instructions,/reviewStatus/);
      assert.match(instructions,/MaxVideoAI.*quote/i);
      assert.match(instructions,/competitor|provider prices/i);
      assert.match(instructions,/Projects opens/);
      assert.doesNotMatch(instructions,/My projects/);
      assert.match(instructions,/GPT-6\.1 Sol.*GPT-6 Luna.*Studio assistance/);
      assert.match(instructions,/monthly free credits.*before purchased/);
      assert.match(instructions,/purchase debits.*once.*usage consumes.*credits/);
      assert.match(instructions,/Luna.*no monthly quota.*one active message/);
      assert.match(instructions,/cannot read current credits.*wallet.*tariff/);
      assert.match(instructions,/assistance.*separate.*generation/i);
      assert.match(instructions,/Studio help/);
      assert.match(instructions,/Open library/);
      assert.ok(instructions.length<8500,'Keep permanent guidance bounded; exact model facts belong in tools.');
      assert.doesNotMatch(instructions,/seedance|kling|wan-3|pika|\$\d|€\d/i);
      const names=params.tools?.filter(tool=>tool.type==='function').map(tool=>tool.name) ?? [];
      assert.equal(names.includes('video_prepare'),enabled);
      assert.equal(names.includes('timeline_read'),enabled);
      assert.equal(names.includes('export_prepare'),enabled);
      if (enabled) assert.match(instructions,/Timeline.*collapse/i);
      else assert.match(instructions,/Timeline editing is unavailable/i);
      assert.ok(!names.some(name=>/confirm|purchase|shell/.test(name)));
      return {id:'creative-reply',model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:null,output_text:JSON.stringify({reply:'A paper city unfolds in morning light.'}),output:[]};
    }});
    const result=await director({message:'Help shape a prompt. No generation.',references:[],history:[],project:{name:'Creative work',revision:0,memory:{revision:0,brief:'',decisions:[]}},checkpoint:async(_,create)=>create(),execute:async()=>{throw new Error('A reply cannot prepare or spend.');}});
    assert.equal(result.image,null);
    assert.equal(calls,1);
  }
});

test('the final response knows its remaining budget without losing executable tools',async()=>{
  let calls=0;
  const director=createStudioConversationDirector({createResponse:async params=>{
    calls++;
    assert.equal(String(params.instructions).includes('This is the last Response'),calls===4);
    assert.equal(params.tools?.some(tool=>tool.type==='function' && tool.name==='project_remember'),calls<4);
    assert.ok(params.tools?.some(tool=>tool.type==='function' && tool.name==='image_prepare'));
    return {id:'r'+calls,model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:null,
      output_text:calls===4?JSON.stringify({reply:'Here is the price and a useful next step.'}):'',
      output:calls===4?[]:[{type:'function_call' as const,name:'project_read',arguments:'{}',call_id:'call'+calls}]};
  }});
  const project={name:'Budget study',revision:0,memory:{revision:0,brief:'',decisions:[]}};
  const result=await director({message:'What can I make within my budget?',references:[],history:[],project,
    checkpoint:async(_,create)=>create(),execute:async()=>({ok:true,action:'project.read',data:project})});
  assert.equal(calls,4);
  assert.equal(result.reply,'Here is the price and a useful next step.');
});
