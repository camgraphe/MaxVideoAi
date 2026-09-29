import assert from 'node:assert/strict';
import test from 'node:test';
import { tariffEditorSelection } from '../frontend/app/(core)/admin/pricing/_lib/tariff-editor-selection';

test('editing preserves every encoded option of the compared scenario and passes explicit total cents', () => {
  const selected = tariffEditorSelection({ engineId: 'seedance-2-0-mini',
    scenarioId: 'engineId=seedance-2-0-mini|mode=t2v|resolution=720p|durationSec=5|aspectRatio=16%3A9|audio=false' }, 75);
  assert.equal(selected?.modelId, 'seedance-2-0-mini');
  assert.deepEqual(selected?.selector, { engineId: 'seedance-2-0-mini', mode: 't2v', resolution: '720p',
    durationSec: '5', aspectRatio: '16:9', audio: 'false' });
  assert.equal(selected?.customerCents, 75);
});

test('an unknown scenario identity or invalid simulation amount cannot select a different tariff', () => {
  for (const scenarioId of ['audit:mini', 'engineId=other|mode=t2v',
    'engineId=mini|mode=t2v|mode=i2v|resolution=720p|durationSec=5|aspectRatio=default']) {
    assert.equal(tariffEditorSelection({ engineId: 'mini', scenarioId }, 75), null);
  }
  assert.equal(tariffEditorSelection({ engineId: 'mini',
    scenarioId: 'engineId=mini|mode=t2v|resolution=720p|durationSec=5|aspectRatio=default' }, -1), null);
});
