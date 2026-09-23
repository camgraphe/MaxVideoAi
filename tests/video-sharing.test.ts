import assert from 'node:assert/strict';
import test from 'node:test';
import { createOrGetVideoShareLink, getSharedVideo, publicExampleDownloadSource, revokeVideoShareLink } from '../frontend/server/video-shares';
import { buildVideoShareIntent, buildXVideoPostIntent } from '../frontend/components/library/video-share-intents';

type QueryFn = NonNullable<Parameters<typeof createOrGetVideoShareLink>[1]>;
function fakeQuery(resolve: (sql: string, params: ReadonlyArray<unknown>) => unknown[]): QueryFn {
  return (async <T>(sql: string, params: ReadonlyArray<unknown> = []) => resolve(sql, params) as T[]) as QueryFn;
}

test('a video link is minted only for a matching video owned by the user', async () => {
  const url = 'https://cdn.maxvideoai.com/render.mp4';
  let inserts = 0;
  const db = fakeQuery((sql, params) => {
    if (sql.includes('FROM job_outputs o')) {
      assert.match(sql, /j\.user_id = \$2/);
      return params[1] === 'owner' ? [{ id: 'output-1', url, thumb_url: null }] : [];
    }
    if (sql.includes('INSERT INTO video_share_links')) {
      inserts++;
      assert.deepEqual(params.slice(1), ['owner', 'job_output', 'output-1']);
      return [{ token: params[0] }];
    }
    throw new Error('unexpected query');
  });

  const token = await createOrGetVideoShareLink({ userId: 'owner', sourceOutputId: 'output-1', url }, db);
  assert.match(token ?? '', /^[a-zA-Z0-9_-]{32}$/);
  assert.equal(inserts, 1);
  assert.equal(await createOrGetVideoShareLink({ userId: 'stranger', sourceOutputId: 'output-1', url }, db), null);
  assert.equal(inserts, 1);
});

test('a private result gallery can share its exact owned job video without an output id', async () => {
  const url = 'https://media.maxvideoai.com/renders/job/video.mp4';
  const db = fakeQuery((sql, params) => {
    if (sql.includes('FROM media_assets') || sql.includes('FROM user_assets')) return [];
    if (sql.includes('FROM job_outputs o')) {
      assert.match(sql, /o\.job_id = \$1 AND j\.user_id = \$2/);
      return params[0] === 'job-1' && params[1] === 'owner' && params[2] === url
        ? [{ id: 'job-1:video:0', url, thumb_url: null }] : [];
    }
    if (sql.includes('INSERT INTO video_share_links')) {
      assert.deepEqual(params.slice(1), ['owner', 'job_output', 'job-1:video:0']);
      return [{ token: params[0] }];
    }
    if (sql.includes('FROM app_jobs')) return [];
    throw new Error('unexpected query');
  });
  assert.match(await createOrGetVideoShareLink({ userId: 'owner', assetId: 'gallery-member', jobId: 'job-1', url }, db) ?? '', /^[a-zA-Z0-9_-]{32}$/);
  assert.equal(await createOrGetVideoShareLink({ userId: 'stranger', assetId: 'gallery-member', jobId: 'job-1', url }, db), null);
  assert.equal(await createOrGetVideoShareLink({ userId: 'owner', assetId: 'gallery-member', jobId: 'job-1', url: `${url}?other` }, db), null);
});

test('signed or temporary originals cannot acquire a persistent share page', async () => {
  const url = 'https://cdn.example/video.mp4?X-Amz-Signature=secret';
  let inserts = 0;
  const db = fakeQuery(sql => {
    if (sql.includes('FROM job_outputs o')) return [{ id: 'output-1', url, thumb_url: null }];
    inserts++;
    return [];
  });
  assert.equal(await createOrGetVideoShareLink({ userId: 'owner', sourceOutputId: 'output-1', url }, db), null);
  assert.equal(inserts, 0);
});

test('a share page resolves the current source and hides revoked or removed videos', async () => {
  const token = 'a'.repeat(32);
  let sourceExists = true;
  let linkExists = true;
  const db = fakeQuery(sql => {
    if (sql.includes('FROM video_share_links')) return linkExists ? [{ token, user_id: 'owner', source_type: 'media_asset', source_id: 'asset-1' }] : [];
    if (sql.includes('FROM media_assets')) return sourceExists ? [{ id: 'asset-1', url: 'https://cdn.maxvideoai.com/video.mp4', thumb_url: 'https://cdn.maxvideoai.com/poster.jpg' }] : [];
    throw new Error('unexpected query');
  });
  assert.deepEqual(await getSharedVideo(token, db), { url: 'https://cdn.maxvideoai.com/video.mp4', thumbUrl: 'https://cdn.maxvideoai.com/poster.jpg' });
  sourceExists = false;
  assert.equal(await getSharedVideo(token, db), null);
  linkExists = false;
  assert.equal(await getSharedVideo(token, db), null);
  assert.equal(await getSharedVideo('invalid', db), null);
});

test('only the owner can revoke a link', async () => {
  const token = 'b'.repeat(32);
  const db = fakeQuery((sql, params) => {
    assert.match(sql, /user_id = \$2/);
    return params[1] === 'owner' ? [{ token }] : [];
  });
  assert.equal(await revokeVideoShareLink(token, 'stranger', db), false);
  assert.equal(await revokeVideoShareLink(token, 'owner', db), true);
});

test('destinations receive only the message fields they can prefill', () => {
  const url = 'https://maxvideoai.com/s/' + 'a'.repeat(32);
  const signature = 'Vidéo créée avec MaxVideoAI';
  const email = new URL(buildVideoShareIntent('email', url, signature, 'fr'));
  assert.equal(email.protocol, 'mailto:');
  assert.match(email.searchParams.get('body') ?? '', /Vidéo créée avec MaxVideoAI/);
  const x = new URL(buildVideoShareIntent('x', url, signature, 'fr'));
  assert.equal(x.searchParams.get('url'), url);
  assert.equal(x.searchParams.get('text'), signature);
  const hashtagPost = new URL(buildVideoShareIntent('x', url, '#MaxVideoAI', 'fr'));
  assert.equal(hashtagPost.searchParams.get('text'), '#MaxVideoAI');
  const nativeXPost = new URL(buildXVideoPostIntent('#MaxVideoAI', url));
  assert.equal(nativeXPost.searchParams.get('text'), `#MaxVideoAI\n\n${url}`);
  assert.equal(new URL(buildXVideoPostIntent('', null)).searchParams.get('text'), '');
  const whatsapp = new URL(buildVideoShareIntent('whatsapp', url, signature, 'fr'));
  assert.match(whatsapp.searchParams.get('text') ?? '', /Vidéo créée avec MaxVideoAI/);
  const linkedin = new URL(buildVideoShareIntent('linkedin', url, signature, 'fr'));
  assert.equal(linkedin.searchParams.get('url'), url);
  assert.equal(linkedin.searchParams.has('text'), false);
  const facebook = new URL(buildVideoShareIntent('facebook', url, signature, 'fr'));
  assert.equal(facebook.searchParams.has('text'), false);
});

test('public example file proxy accepts only durable media CDN originals', () => {
  assert.equal(publicExampleDownloadSource('https://media.maxvideoai.com/renders/video.mp4')?.pathname, '/renders/video.mp4');
  for (const url of [
    'http://media.maxvideoai.com/renders/video.mp4',
    'https://media.maxvideoai.com.evil.test/video.mp4',
    'https://media.maxvideoai.com:8443/video.mp4',
    'https://media.maxvideoai.com/video.mp4?X-Amz-Signature=secret',
    'https://127.0.0.1/video.mp4',
  ]) assert.equal(publicExampleDownloadSource(url), null);
});
