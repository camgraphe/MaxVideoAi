import assert from 'node:assert/strict';
import test from 'node:test';
import { projectStudioQuoteSettings } from '../frontend/src/server/studio/conversation-quote-facts';
import { conversationQuotePresentation } from '../frontend/src/lib/studio/conversation-quote-presentation';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';

test('Studio preserves exact Max keyframe positions, reasoning and zero seed in recorded quote facts', () => {
  const settings = { durationSec: 16, resolution: '720p', keyframeIndexes: '0, 192, 384', reasoningLevel: 'low', seed: 0 };
  assert.deepEqual(projectStudioQuoteSettings(settings), settings);
  assert.deepEqual(projectStudioQuoteSettings({ keyframeIndexes: '0,<script>', reasoningLevel: 'medium', seed: 0.5 }), {});
});

test('Max quote review exposes selected keyframe times and generation controls before confirmation', () => {
  const request = normalizeGenerationRequest({ surface: 'video', engineId: 'flux-3-max', mode: 'ref2v', prompt: 'Travel between the scenes.',
    settings: { durationSec: 16, resolution: '720p', aspectRatio: '16:9', audio: false, keyframeIndexes: '0,192,384', reasoningLevel: 'low', seed: 0 },
    references: [] });
  const en = conversationQuotePresentation(request, 'en');
  const fr = conversationQuotePresentation(request, 'fr');
  assert.match(en.settings, /keyframes.*0 s.*8 s.*16 s/i);
  assert.match(fr.settings, /images clés.*0 s.*8 s.*16 s/i);
  assert.match(en.settings, /reasoning.*low/i);
  assert.match(en.settings, /seed 0/i);
});
