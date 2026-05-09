import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const facadePath = join(root, 'frontend/src/server/audio/providers.ts');
const modulesDir = join(root, 'frontend/src/server/audio/providers');
const modules = [
  'error.ts',
  'fal-runner.ts',
  'music.ts',
  'prompts.ts',
  'response.ts',
  'roster.ts',
  'sound-design.ts',
  'types.ts',
  'voice-tracks.ts',
  'voice-utils.ts',
];

const facadeSource = readFileSync(facadePath, 'utf8');

test('audio providers public module stays a thin facade', () => {
  assert.match(facadeSource, /from '\.\/providers\/fal-runner'/);
  assert.match(facadeSource, /from '\.\/providers\/music'/);
  assert.match(facadeSource, /from '\.\/providers\/roster'/);
  assert.match(facadeSource, /from '\.\/providers\/sound-design'/);
  assert.match(facadeSource, /from '\.\/providers\/voice-tracks'/);
  assert.match(facadeSource, /export type \{/);

  const lineCount = facadeSource.split('\n').length;
  assert.ok(lineCount <= 40, `providers.ts should stay below 40 lines, got ${lineCount}`);
});

test('audio provider responsibilities live in focused modules', () => {
  for (const moduleName of modules) {
    const modulePath = join(modulesDir, moduleName);
    assert.ok(existsSync(modulePath), `${moduleName} should exist under audio/providers`);
    const lineCount = readFileSync(modulePath, 'utf8').split('\n').length;
    assert.ok(lineCount <= 220, `${moduleName} should stay below 220 lines, got ${lineCount}`);
  }
});

test('audio providers facade does not regain roster, prompt, response, or runner ownership', () => {
  for (const pattern of [
    /const AUDIO_PROVIDER_ROSTER/,
    /function findFileUrl\(/,
    /function findCustomVoiceId\(/,
    /function subscribeFalModel\(/,
    /function subscribeWithTimeout\(/,
    /function buildSoundDesignPrompt\(/,
    /function buildMusicPrompt\(/,
    /function resolveGeminiVoice\(/,
    /function buildVoiceSetting\(/,
    /function buildVoiceModify\(/,
  ]) {
    assert.doesNotMatch(facadeSource, pattern);
  }
});

test('audio provider focused modules expose the expected contracts', () => {
  const rosterSource = readFileSync(join(modulesDir, 'roster.ts'), 'utf8');
  const runnerSource = readFileSync(join(modulesDir, 'fal-runner.ts'), 'utf8');
  const responseSource = readFileSync(join(modulesDir, 'response.ts'), 'utf8');
  const promptsSource = readFileSync(join(modulesDir, 'prompts.ts'), 'utf8');
  const voiceSource = readFileSync(join(modulesDir, 'voice-tracks.ts'), 'utf8');

  assert.match(rosterSource, /export const AUDIO_PROVIDER_ROSTER/);
  assert.match(rosterSource, /export function getAudioProviderRoster/);
  assert.match(runnerSource, /export async function runAudioRoleWithFallback/);
  assert.match(responseSource, /export function findFileUrl/);
  assert.match(responseSource, /export function findCustomVoiceId/);
  assert.match(promptsSource, /export function buildSoundDesignPrompt/);
  assert.match(promptsSource, /export function buildMusicPrompt/);
  assert.match(voiceSource, /export async function generateStandardVoiceTrack/);
  assert.match(voiceSource, /export async function generateClonedVoiceTrack/);
});
