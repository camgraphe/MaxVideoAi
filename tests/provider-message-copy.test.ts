import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('Seedance runtime user messages do not expose provider names', () => {
  const generateRoute = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/api/generate/route.ts'),
    'utf8'
  );
  const byteplusPoll = fs.readFileSync(
    path.join(process.cwd(), 'frontend/server/byteplus-poll.ts'),
    'utf8'
  );
  const providerSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/src/server/video-providers/byteplus-modelark.ts'),
    'utf8'
  );

  const forbiddenUserCopy = [
    'BytePlus render submitted.',
    'BytePlus render is in progress.',
    'BytePlus reported this render as failed.',
    'BytePlus completed this render but returned no video URL.',
    'BytePlus polling exceeded the expected render window.',
    'BytePlus output video could not be copied',
    'BytePlus rejected one of the input images.',
    'BytePlus could not start this render.',
    'BytePlus V1a duration',
    'BytePlus does not support',
  ];

  const runtimeCopy = [generateRoute, byteplusPoll, providerSource].join('\n');
  forbiddenUserCopy.forEach((copy) => {
    assert.doesNotMatch(runtimeCopy, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });

  assert.match(runtimeCopy, /Render submitted\./);
  assert.match(runtimeCopy, /Render is in progress\./);
  assert.match(runtimeCopy, /The render service reported this render as failed\./);
});
