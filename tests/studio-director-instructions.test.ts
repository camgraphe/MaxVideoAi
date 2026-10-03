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
      assert.match(instructions,/My projects/);
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
