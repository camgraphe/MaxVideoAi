import assert from 'node:assert/strict';
import test from 'node:test';
import {STUDIO_CONVERSATION_REPLY_MAX_CHARS} from '../frontend/src/lib/studio/conversation-reply';
import {MILO_LEVELS} from '../frontend/src/lib/studio/assistance-contract';
import {createStudioConversationDirector} from '../frontend/src/server/studio/conversation-director';
import {buildStudioDirectorInstructions} from '../frontend/src/server/studio/conversation-director-instructions';
import {MILO_SCOPE_INSTRUCTIONS} from '../frontend/src/server/studio/milo-scope';

test('legacy assistance explains its introductory allowance while export help follows the session capability', () => {
  const instructions = buildStudioDirectorInstructions({mediaEnabled:true,editingEnabled:true,exportsEnabled:false,assistanceCreditsEnabled:false});
  assert.match(instructions, /limited one-time introductory allowance/);
  assert.doesNotMatch(instructions, /preview allowance/);
  assert.match(instructions, /authorize an assistance spending limit/);
  assert.match(instructions, /Lite.*limited allowance/);
  assert.match(instructions, /Export tools are unavailable in this session/);
  assert.doesNotMatch(instructions, /export_prepare may prepare/);
});

test('mobile Studio guides people to the phone workspaces and identifies web Studio actions', () => {
  const instructions = buildStudioDirectorInstructions({clientSurface:'mobile'});
  assert.match(instructions, /Video, Image or Audio/);
  assert.match(instructions, /Video > Modify uses a phone clip/);
  assert.match(instructions, /confirm the displayed price with the generation button if shown/);
  assert.match(instructions, /otherwise open the same project in web Studio/);
  assert.match(instructions, /Specialized recipes, timeline editing and export use web Studio/);
  assert.doesNotMatch(instructions, /drag to Message Milo/);
});

// These are the request-envelope contracts, not a claim to test artistic judgment.
test('director sends creative purpose, current help and live quote rules with its gated tools', async () => {
  for (const enabled of [false,true]) {
    let calls=0;
    const director=createStudioConversationDirector({assistanceCreditsEnabled:true,mediaEnabled: enabled,editingEnabled: enabled,exportsEnabled: enabled,createResponse: async params=> {
      calls++;
      const instructions=String(params.instructions);
      assert.match(instructions,/creative partner/i);
      assert.match(instructions,/prompt.*asset.*edit/i);
      assert.match(instructions,/check.*explain.*only.*read-only/i);
      assert.match(instructions,/never.*timeline_edit.*test.*support/i);
      assert.match(instructions,/editorialGuidance/);
      assert.match(instructions,/reviewStatus/);
      assert.match(instructions,/Vary.*shot.*subject.*continuity/);
      assert.match(instructions,/MaxVideoAI.*quote/i);
      assert.match(instructions,/competitor|provider prices/i);
      assert.match(instructions,/Projects opens/);
      assert.doesNotMatch(instructions,/My projects/);
      assert.match(instructions,/Milo modes.*Lite: GPT-6 Luna\/high.*Standard: GPT-6\.1 Terra\/high.*Max: GPT-6\.1 Sol\/xhigh.*Studio assistance/);
      assert.match(instructions,/monthly free credits.*before purchased/);
      assert.match(instructions,/purchase debits.*once.*usage consumes.*credits/);
      assert.match(instructions,/Lite.*no monthly quota.*one active message/);
      assert.match(instructions,/cannot read current credits.*wallet.*tariff/);
      assert.match(instructions,/assistance.*separate.*generation/i);
      assert.match(instructions,/Studio help/);
      assert.match(instructions,/account.*billing.*wallet transfer/i);
      assert.match(instructions,/\[Support\]\(https:\/\/maxvideoai\.com\/contact\)/);
      assert.match(instructions,/Open library/);
      assert.ok(instructions.replace(MILO_SCOPE_INSTRUCTIONS,'').length<8500,`Keep creative guidance within its existing budget; received ${instructions.replace(MILO_SCOPE_INSTRUCTIONS,'').length} characters, exact model facts belong in tools.`);
      assert.ok(MILO_SCOPE_INSTRUCTIONS.length<800,'The shared product boundary has its own bounded budget.');
      assert.ok(instructions.length<9300,'Keep the combined permanent guidance bounded.');
      assert.doesNotMatch(instructions,/seedance|kling|wan-3|pika|\$\d|€\d/i);
      const names=params.tools?.filter(tool=>tool.type==='function').map(tool=>tool.name) ?? [];
      assert.equal(names.includes('video_prepare'),enabled);
      assert.equal(names.includes('timeline_read'),enabled);
      assert.equal(names.includes('export_prepare'),enabled);
      if (enabled) {
        assert.match(instructions,/Timeline.*collapse/i);
        assert.match(instructions,/extension.*edits/i);
        assert.match(instructions,/voice cloning.*owned sample/i);
        assert.match(instructions,/songs.*effects.*ambience.*soundtracks/i);
        assert.match(instructions,/attached saved media.*exact kinds.*roles/i);
        assert.match(instructions,/sound-only.*source video.*soundtrack.*preserv/i);
        assert.match(instructions,/missing.*audio.*framing.*model_details/i);
        assert.match(instructions,/always_generated.*sound/i);
        assert.match(instructions,/formattedAmount/);
        assert.match(instructions,/explain.*model.*chang/i);
      }
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
    assert.equal(params.tools?.some(tool=>tool.type==='function' && tool.name==='project_remember'),calls<3);
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

test('all Milo levels receive the scoped creative offer rule and the conversation on web and mobile', async () => {
  const titles = {message:'Give the three shots short titles text only', reply:'Cold Sparks · Blue Ice · First Light'};
  const offer = {message:'Give the first shot a darker look', reply:'Keep the ice in shadow. Shall I prepare a quote for Cold Sparks?'};
  const project = {name:'Fireflies', revision:1, memory:{revision:0, brief:'', decisions:[]}};
  const pendingQuote = {quoteId:'first-firefly-quote', surface:'video', quoteState:'prepared', jobId:null, status:null};
  for (const {model} of Object.values(MILO_LEVELS)) {
    for (const clientSurface of [undefined, 'mobile'] as const) {
      for (const {message, history, generations = []} of [
        {message:offer.message, history:[]},
        {message:offer.message, history:[titles]},
        {message:'Yes, please.', history:[titles, offer]},
        {message:'Yes, please.', history:[{message:'Help with the audio.', reply:'Shall I write a voiceover for the opening shot?'}]},
        {message:'Yes, please.', history:[{message:'Change the mood.', reply:'Shall I explore a warmer version of the scene?'}]},
        {message:'No quote, thanks.', history:[offer]},
        {message:offer.message, history:[{message:'Keep this whole project text only.', reply:'Understood.'}]},
        {message:'Remind me of the direction for the quoted shot.', history:[offer], generations:[pendingQuote]},
      ]) {
        let checked = false;
        const director = createStudioConversationDirector({model, clientSurface, mediaEnabled:true, createResponse:async params => {
          assert.equal(params.model, model);
          const rules = String(params.instructions);
          assert.match(rules, /answer first, then ask one natural next-step question tied to this project/);
          assert.match(rules, /explore, write, develop visuals or help produce/);
          assert.match(rules, /Quote only when pricing or production fits the client's intent/);
          assert.match(rules, /Respect text-only, refusals, closing remarks and existing quotes/);
          assert.match(rules, /Generation needs separate client confirmation/);
          assert.equal(params.text?.format?.type, 'json_schema');
          if (params.text?.format?.type === 'json_schema')
            assert.deepEqual(params.text.format.schema.required, ['reply', 'nextStepOffer']);
          const input = params.input as Array<{role?:string;content?:unknown}>;
          const facts = input.find(item => item.role === 'developer' && typeof item.content === 'string' && item.content.startsWith('Current project facts'));
          assert.ok(facts && typeof facts.content === 'string');
          assert.deepEqual(JSON.parse(facts.content.slice(facts.content.indexOf('{'))).generations, generations);
          if (history.length) {
            assert.equal(input.at(-2)?.role, 'developer');
            assert.match(String(input.at(-2)?.content), /Earlier text-only requests for particular deliverables are fulfilled/);
            assert.match(String(input.at(-2)?.content), /give the new direction and ask a small creative follow-up/);
            assert.match(String(input.at(-2)?.content), /write the offered text, explore the offered variation, or prepare the offered quote/);
            assert.match(String(input.at(-2)?.content), /After delivering an accepted suggestion, let the result stand/);
          }
          const previousTurns = input.slice(0, -1).filter(item => item.role === 'user' || item.role === 'assistant');
          assert.deepEqual(previousTurns, history.flatMap(turn => [
            {role:'user', content:turn.message}, {role:'assistant', content:turn.reply},
          ]));
          assert.deepEqual(input.at(-1), {role:'user', content:[{type:'input_text', text:message}]});
          const tools = params.tools?.flatMap(tool => tool.type === 'function' ? [tool.name] : []) ?? [];
          assert.ok(tools.includes('video_prepare'));
          assert.ok(!tools.some(name => /confirm|purchase/.test(name)));
          checked = true;
          return {id:'creative-turn', model, status:'completed', service_tier:'default', usage:null, output:[], output_text:'{"reply":"Fixture reply."}'};
        }});
        await director({message, history, project:{...project, generations}, references:[], checkpoint:async (_, create) => create(),
          execute:async () => { throw new Error('No tool call in this envelope fixture.'); }});
        assert.ok(checked);
      }
    }
  }
});

test('Studio delivers the offer in conversation text, preserves legacy replies and keeps a complete answer at the limit', async () => {
  const direction = 'Frame the opening shot at ice level.';
  const question = 'Should I price that opening shot?';
  const full = 'x'.repeat(STUDIO_CONVERSATION_REPLY_MAX_CHARS);
  for (const [envelope, expected] of [
    [{reply:direction, nextStepOffer:question}, direction + '\n\n' + question],
    [{reply:direction, nextStepOffer:null}, direction],
    [{reply:direction}, direction],
    [{reply:full, nextStepOffer:question}, full],
  ] as const) {
    const director = createStudioConversationDirector({createResponse:async () => ({
      id:'result', model:'gpt-6.1-sol', status:'completed', service_tier:'default', usage:null, output:[], output_text:JSON.stringify(envelope),
    })});
    const result = await director({message:'Give the opening shot a darker look.', history:[], references:[],
      project:{name:'Ice', revision:1, memory:{revision:0, brief:'', decisions:[]}},
      checkpoint:async (_, create) => create(), execute:async () => { throw Error('Unexpected action'); }});
    assert.deepEqual(result, {reply:expected, image:null});
  }
});
