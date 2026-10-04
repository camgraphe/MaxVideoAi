import assert from 'node:assert/strict';
import test from 'node:test';
import {imageDraftSchema} from '../frontend/src/lib/studio/image-conversation-contract';
import {actionFromTool} from '../frontend/lib/studio/conversation-action-contract';
import {createStudioConversationDirector} from '../frontend/src/server/studio/conversation-director';

const project = {name: 'Film', revision: 0, memory: {revision: 0, brief: 'Cheap, elegant, no neon', decisions: []}};
const actions = [
  {action: 'video.prepare', reply: 'A gentle camera move. Review the quote.', prompt: 'A slow push in, warm window light', aspectRatio: '16:9', source: null},
  {action: 'voice.prepare', reply: 'A calm English narration. Review the quote.', script: 'Your film starts with a conversation.', language: 'english'},
  {action: 'music.prepare', reply: 'Quiet piano underneath. Review the quote.', prompt: 'Instrumental piano, warm and spare, no vocals', mood: 'dreamy'},
] as const;

test('saved media intent is explicit and cannot masquerade as an image or payment authority', () => {
  for (const action of actions) {
    const parsed = imageDraftSchema.parse({reply: action.reply, image: null, media: action});
    assert.deepEqual(parsed.media, action);
    assert.equal(imageDraftSchema.safeParse({...parsed, image: {prompt: 'x', aspectRatio: '16:9'}}).success, false);
    assert.equal(imageDraftSchema.safeParse({...parsed, media: {...action, confirmed: true}}).success, false);
  }
  assert.deepEqual(imageDraftSchema.parse({reply: 'Hi', image: null}), {reply: 'Hi', image: null});
});

test('each media tool ends with an exact quote and is absent when the media gate is closed', async () => {
  for (const action of actions) {
    const name = action.action.replace('.', '_');
    const {action: _, ...args} = action;
    assert.deepEqual(actionFromTool(name, args), action);
    let observed: any;
    const response = async (params: any) => {
      observed = params;
      return {id: 'resp', model: 'gpt-6.1-sol', status: 'completed' as const, service_tier: 'default' as const, usage: null, output_text: '',
        output: [{type: 'function_call' as const, name, call_id: 'call', arguments: JSON.stringify(args)}]};
    };
    const context = {message: 'You choose, keep it cheap.', references: [], history: [], project,
      checkpoint: async (_: number, create: () => Promise<any>) => create(),
      execute: async (_: string, request: any) => ({ok: true as const, action: request.action, data: {quoteId: 'quote', confirmationRequired: true}} as never)};
    const draft = await createStudioConversationDirector({mediaEnabled: true, createResponse: response})(context);
    assert.deepEqual(draft.media, action);
    assert.ok(observed.tools.some((tool: any) => tool.name === name));
    assert.ok(!observed.tools.some((tool: any) => /confirm|shell/.test(tool.name)));
    await assert.rejects(createStudioConversationDirector({createResponse: response})(context), {code: 'ENGINE_UNAVAILABLE'});
    assert.ok(!observed.tools.some((tool: any) => tool.name === name));
  }
});

test('video and audio attachments are metadata, never invalid image inputs', async () => {
  let observed: any;
  const director = createStudioConversationDirector({mediaEnabled: true, createResponse: async params => {
    observed = params;
    return {id: 'resp', model: 'gpt-6.1-sol', status: 'completed', service_tier: 'default', usage: null, output_text: '{"reply":"I can use these in the edit."}', output: []};
  }});
  await director({message: 'Use my interview', project, history: [],
    references: [{assetId: 'ma_' + '1'.repeat(32), mediaKind: 'video', role: 'reference', storageUrl: 'https://cdn.example.com/interview.mp4', width: 1920, height: 1080, durationSec: 60, mimeType: 'video/mp4'}],
    execute: async () => {throw new Error('No tool expected');}, checkpoint: async (_: number, create: () => Promise<any>) => create()});
  const input = JSON.stringify(observed.input);
  assert.ok(!input.includes('input_image'));
  assert.match(input, /video/);
  assert.match(input, /60/);
  assert.ok(!input.includes('https://cdn.example.com/interview.mp4'));
});

test('quote presentation describes the actual video/audio settings rather than image defaults', async () => {
  const module = await import('../frontend/src/lib/studio/conversation-quote-presentation').catch(() => null);
  assert.ok(module?.conversationQuotePresentation);
  const describe = module.conversationQuotePresentation;
  const video = describe({surface: 'video', prompt: 'Slow push in', settings: {durationSec: 5, resolution: '480p', aspectRatio: '16:9', audio: false}} as never, 'en');
  assert.match(video.title, /Video/);
  assert.match(video.settings, /5 s/);
  assert.match(video.settings, /480p/);
  assert.match(video.settings, /silent/i);
  assert.ok(!video.settings.includes('PNG'));
  const voice = describe({surface: 'audio', mode: 'voice_only', prompt: '', settings: {script: 'Your film starts here.', language: 'english', voiceModel: 'seed', seedAudioOutputFormat: 'mp3'}} as never, 'en');
  assert.equal(voice.direction, 'Your film starts here.');
  assert.match(voice.title, /Voice/);
  assert.match(voice.settings, /english/);
  const music = describe({surface: 'audio', mode: 'music_only', prompt: 'Soft piano', settings: {durationSec: 30, musicModel: 'clip', mood: 'dreamy'}} as never, 'fr');
  assert.match(music.title, /Musique/);
  assert.match(music.settings, /30 s/);
});
