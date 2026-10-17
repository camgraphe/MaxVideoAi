import assert from 'node:assert/strict';
import test from 'node:test';
import { listAudioCapabilities } from '../frontend/src/server/agent-api/audio-capabilities';
import { normalizeAudioGenerationRequest } from '../frontend/src/server/agent-api/audio-normalization';
import { studioAudioCapabilityDetails } from '../frontend/src/server/studio/conversation-capabilities';
import { projectStudioQuoteSettings } from '../frontend/src/server/studio/conversation-quote-facts';
import { prepareAudioGenerationInputSchema } from '../frontend/src/server/mcp/tools/prepare-audio-generation';
import { resolveElevenVoicePreview } from '../frontend/src/server/audio/eleven-voice-preview';
import { GET as previewRoute } from '../frontend/app/api/audio/voices/[voiceId]/preview/route';

const roger = 'CwhRBWXzGAHq8TQ4Fs17';
test('MCP and Studio discover named voice choices, previews and v4 controls from the same contract', () => {
  const catalog = listAudioCapabilities({ FAL_KEY: 'fixture-only' });
  assert.equal(catalog.defaults.voiceModel, 'eleven-v4');
  assert.equal(catalog.options.elevenVoices.length, 18);
  const voice = catalog.options.elevenVoices.find(voice => voice.id === roger)!;
  assert.equal(voice.name, 'Roger');
  assert.equal(voice.accent, 'american');
  assert.equal(voice.previewUrl, `https://maxvideoai.com/api/audio/voices/${roger}/preview`);
  const details = studioAudioCapabilityDetails(catalog, 'audio-voice-only');
  assert.ok(details?.surface === 'audio');
  assert.equal(details.options.elevenVoices.length, 18);
  const variant = details.modes[0].variants.find(variant => variant.settings.voiceModel === 'eleven-v4')!;
  assert.ok(variant.parameters.some(parameter => parameter.key === 'script' && parameter.required));
  assert.equal(variant.parameters.find(parameter => parameter.key === 'elevenVoiceId')?.values?.includes(roger), true);
  assert.equal(variant.parameters.some(parameter => parameter.key === 'seedAudioSpeed'), false);
  assert.equal(variant.voiceSample, 'unsupported');
  assert.deepEqual(variant.fixedOutput, { format: 'mp3', sampleRate: 44100 });
});

test('the published MCP schema accepts v4 and preserves its exact settings through canonical normalization and quote facts', () => {
  const settings = { voiceModel: 'eleven-v4', script: 'Hello', elevenVoiceId: roger, elevenStability: 0, elevenSimilarityBoost: 0.8 };
  const request = prepareAudioGenerationInputSchema.parse({ surface: 'audio', engineId: 'audio-voice-only', mode: 'voice_only', prompt: '', settings });
  assert.deepEqual(normalizeAudioGenerationRequest({ schemaVersion: 1, references: [], outputCount: 1, ...request }).settings, settings);
  assert.deepEqual(projectStudioQuoteSettings(settings), { voiceModel: 'eleven-v4', elevenVoiceId: roger, elevenStability: 0, elevenSimilarityBoost: 0.8 });
  assert.throws(() => prepareAudioGenerationInputSchema.parse({ ...request, settings: { ...settings, elevenVoiceId: 'unverified' } }));
});

test('voice samples resolve current official previews without accepting arbitrary voice IDs or redirect hosts', async () => {
  let reads = 0;
  const fetcher = async (url: string | URL | Request) => {
    reads++;
    assert.equal(url, 'https://api.elevenlabs.io/v1/voices');
    return new Response(JSON.stringify({ voices: [{ voice_id: roger, preview_url: `https://api.us.elevenlabs.io/v1/voices/${roger}/previews/audio?payload=current` }] }));
  };
  assert.equal(await resolveElevenVoicePreview('not-a-stock-voice', fetcher), null);
  assert.equal(reads, 0);
  assert.equal(await resolveElevenVoicePreview(roger, fetcher), `https://api.us.elevenlabs.io/v1/voices/${roger}/previews/audio?payload=current`);
  assert.equal(reads, 1);
  assert.equal(await resolveElevenVoicePreview(roger, async () => new Response(JSON.stringify({ voices: [{ voice_id: roger, preview_url: 'https://untrusted.example/audio.mp3' }] }))), null);
});

test('the public sample route resolves an official redirect without exposing generation or cacheable signed URLs', async () => {
  const previous = globalThis.fetch;
  let reads = 0;
  globalThis.fetch = async () => { reads++; return new Response(JSON.stringify({ voices: [{ voice_id: roger,
    preview_url: `https://api.us.elevenlabs.io/v1/voices/${roger}/previews/audio?payload=fresh` }] })); };
  try {
    const unknown = await previewRoute(new Request('http://localhost'), { params: Promise.resolve({ voiceId: 'unknown' }) });
    assert.equal(unknown.status, 404);
    assert.equal(reads, 0);
    const sample = await previewRoute(new Request('http://localhost'), { params: Promise.resolve({ voiceId: roger }) });
    assert.equal(sample.status, 307);
    assert.equal(sample.headers.get('location'), `https://api.us.elevenlabs.io/v1/voices/${roger}/previews/audio?payload=fresh`);
    assert.equal(sample.headers.get('cache-control'), 'no-store');
    assert.equal(reads, 1);
  } finally { globalThis.fetch = previous; }
});
