import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { buildStatusNoticeState } from '../frontend/app/(localized)/[locale]/(marketing)/status/_lib/status-page-state';

const root = process.cwd();
const pageSource = readFileSync(
  join(root, 'frontend/app/(localized)/[locale]/(marketing)/status/page.tsx'),
  'utf8'
);

function readMessages(locale: 'en' | 'fr' | 'es') {
  return JSON.parse(readFileSync(join(root, `frontend/messages/${locale}.json`), 'utf8')) as {
    status: {
      hero: { title: string; subtitle: string };
      currentNotice: { title: string; activeLabel: string; clearLabel: string; clearBody: string };
      affected: { title: string; body: string };
      support: { title: string; prefix: string; suffix: string };
    };
  };
}

test('active administrator notice is preserved verbatim', () => {
  const state = buildStatusNoticeState(
    { enabled: true, message: '  Seedance jobs are delayed.  ' },
    { activeLabel: 'Active service notice', clearLabel: 'No active service notice', clearBody: 'No notice.' }
  );

  assert.deepEqual(state, {
    isActive: true,
    label: 'Active service notice',
    message: 'Seedance jobs are delayed.',
  });
});

test('disabled or blank notices produce the neutral localized state', () => {
  const copy = {
    activeLabel: 'Active service notice',
    clearLabel: 'No active service notice',
    clearBody: 'There is no administrator-published service notice at this time.',
  };

  assert.deepEqual(buildStatusNoticeState({ enabled: false, message: 'Old incident' }, copy), {
    isActive: false,
    label: copy.clearLabel,
    message: copy.clearBody,
  });
  assert.deepEqual(buildStatusNoticeState({ enabled: true, message: '   ' }, copy), {
    isActive: false,
    label: copy.clearLabel,
    message: copy.clearBody,
  });
});

test('status route uses the shared service notice without fictional telemetry', () => {
  assert.match(pageSource, /getServiceNoticeSetting/);
  assert.match(pageSource, /buildStatusNoticeState/);
  assert.match(pageSource, /hreflangGroup: 'status'/);
  assert.doesNotMatch(pageSource, /content\.systems|content\.incidents|STATUS_BADGE_CLASSES/);

  for (const claim of [
    'Pika provider latency',
    'Callbacks & webhooks',
    'refresh continuously',
    'automatically shifts traffic',
    'RSS feed',
    'email digest',
    'every 60 seconds',
  ]) {
    assert.doesNotMatch(pageSource, new RegExp(claim, 'i'));
  }
});

test('English, French and Spanish expose equivalent honest status sections', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const status = readMessages(locale).status;
    assert.ok(status.hero.title);
    assert.ok(status.hero.subtitle);
    assert.ok(status.currentNotice.title);
    assert.ok(status.currentNotice.activeLabel);
    assert.ok(status.currentNotice.clearLabel);
    assert.ok(status.currentNotice.clearBody);
    assert.ok(status.affected.title);
    assert.ok(status.affected.body);
    assert.ok(status.support.title);
    assert.ok(status.support.prefix);
    assert.ok(status.support.suffix);
    assert.equal('systems' in status, false);
    assert.equal('incidents' in status, false);
    assert.equal('overview' in status, false);
  }
});
