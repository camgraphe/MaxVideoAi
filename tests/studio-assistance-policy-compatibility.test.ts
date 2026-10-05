import assert from 'node:assert/strict';
import test from 'node:test';
import {studioAssistancePolicy} from '../frontend/src/server/studio/assistance-policy';
import {createStudioConversationDirector,type StudioResponseCreator} from '../frontend/src/server/studio/conversation-director';

const legacyVersion='studio-beta-2026-10-03-v1',creditVersion='studio-credits-2026-10-05-v2';
test('production v1 remains enabled without credits while production v2 requires its own approval',()=>{
  const env={NODE_ENV:'production',STUDIO_ASSISTANCE_ENABLED:'true'};
  const legacy=studioAssistancePolicy({...env,STUDIO_ASSISTANCE_APPROVED_POLICY:legacyVersion});
  assert.equal(legacy.enabled,true);assert.equal(legacy.credits,false);assert.equal(legacy.version,legacyVersion);
  const credits=studioAssistancePolicy({...env,STUDIO_ASSISTANCE_APPROVED_POLICY:creditVersion});
  assert.equal(credits.enabled,true);assert.equal(credits.credits,true);assert.equal(credits.version,creditVersion);
  const local=studioAssistancePolicy({STUDIO_ASSISTANCE_ENABLED:'true'});
  assert.equal(local.enabled,true);assert.equal(local.credits,true);assert.equal(local.version,creditVersion);
  for(const approved of [undefined,'not-approved'])assert.equal(studioAssistancePolicy({...env,STUDIO_ASSISTANCE_APPROVED_POLICY:approved}).enabled,false);
  for(const approved of [legacyVersion,creditVersion]){
    assert.equal(studioAssistancePolicy({...env,STUDIO_ASSISTANCE_APPROVED_POLICY:approved,OPENAI_BASE_URL:'https://eu.api.openai.com/v1'}).enabled,false);
    assert.equal(studioAssistancePolicy({...env,STUDIO_ASSISTANCE_APPROVED_POLICY:approved,STUDIO_ASSISTANCE_ENABLED:'false'}).enabled,false);
  }
});

test('the actual director explains the selected assistance regime with bounded guidance and identical tool authority',async()=>{
  let expectedNames:string[]|undefined;
  for(const credits of [undefined,false,true]){
    const options={assistanceCreditsEnabled:credits,mediaEnabled:true,editingEnabled:true,exportsEnabled:true,createResponse:async(params:Parameters<StudioResponseCreator>[0])=>{
      const instructions=String(params.instructions);
      assert.ok(instructions.length<8500,'Permanent guidance must remain bounded.');
      assert.match(instructions,/creative partner|MaxVideoAI.*quote/i);
      assert.match(instructions,/Never silently replace|never silently replace/);
      if(credits===true){assert.match(instructions,/monthly free credits.*before purchased/);assert.match(instructions,/purchase debits.*once/);assert.match(instructions,/Luna.*no monthly quota/);}
      else {assert.match(instructions,/one-time.*allowance|allowance.*one-time/);assert.match(instructions,/spending limit/);assert.match(instructions,/Luna.*limited allowance|limited.*Luna/);assert.doesNotMatch(instructions,/monthly free credits|cumulative Sol packs|no monthly quota/);}
      const names=params.tools?.filter(tool=>tool.type==='function').map(tool=>tool.name)??[];
      if(expectedNames)assert.deepEqual(names,expectedNames);else expectedNames=names;
      assert.ok(!names.some(name=>/purchase|confirm|recharge/.test(name)));
      return {id:'regime-'+String(credits),model:'gpt-6.1-sol',status:'completed' as const,service_tier:'default' as const,usage:undefined,output_text:JSON.stringify({reply:'Review Studio assistance for your current terms.'}),output:[]};
    }};
    await createStudioConversationDirector(options)({message:'How does assistance work?',references:[],history:[],project:{name:'Film',revision:0,memory:{revision:0,brief:'',decisions:[]}},execute:async()=>{throw new Error('Help must not purchase anything.');},checkpoint:async(_,create)=>create()});
  }
});
