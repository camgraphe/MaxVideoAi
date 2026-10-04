import assert from 'node:assert/strict';
import test from 'node:test';
import {createStudioConversationDirector} from '../frontend/src/server/studio/conversation-director';

test('actual Studio tool schemas prevent positional image labels from becoming unsupported canonical slots',async()=>{
  let checked=0;
  const director=createStudioConversationDirector({mediaEnabled:true,createResponse:async params=>{
    for(const name of ['image_prepare','video_prepare','pricing_read']){
      const tool=params.tools?.find(tool=>tool.type==='function'&&tool.name===name);
      assert.ok(tool&&tool.type==='function');
      const schema=tool.parameters as {properties:{references:{items:{properties:{slot:{type:string}}}}}};
      assert.equal(schema.properties.references.items.properties.slot.type,'null',name);
      checked++;
    }
    return {id:'schema-response',model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:undefined,output_text:JSON.stringify({reply:'Describe your idea.'}),output:[]};
  }});
  await director({message:'Help with an image.',references:[],history:[],project:{name:'Fixture',revision:0,memory:{revision:0,brief:'',decisions:[]}},checkpoint:async(_index,create)=>create(),execute:async()=>{throw new Error('Schema inspection must not execute an action');}});
  assert.equal(checked,3);
});
