import assert from 'node:assert/strict';
import test from 'node:test';

process.env.S3_BUCKET='mcp-media-link-fixture';
process.env.S3_REGION='eu-central-1';
process.env.S3_PUBLIC_BASE_URL='https://mcp-media-link-fixture.s3.eu-central-1.amazonaws.com';
process.env.S3_ACCESS_KEY_ID='offline-key';
process.env.S3_SECRET_ACCESS_KEY='offline-storage-secret';
process.env.MCP_ACQUISITION_SIGNING_SECRET='offline-mcp-secret-with-more-than-32-bytes';
const base=process.env.S3_PUBLIC_BASE_URL;
const api=import('../frontend/src/server/mcp/media-link');
const delivery=import('../frontend/src/server/mcp/media-link-delivery');
const origin='https://openai-review.maxvideoai.com';
const now=Date.parse('2026-11-12T12:00:00Z');
const principal={userId:'owner',clientId:'client-a',authMethod:'oauth' as const,emailVerified:true};
const source={type:'asset' as const,assetId:'ma_11111111111111111111111111111111',kind:'video' as const};
const original=`${base}/renders/owner/video.mp4`;
const input={principal,origin,source,url:original};
async function link() {
  const url=(await api).createMcpMediaLink(input,now);
  assert.ok(url);
  return url;
}

test('host-added UTM never enters the S3 canonical query; GET and HEAD retain native delivery',async()=>{
  const {deliverMcpMediaLink}=await delivery;
  const url=await link();
  for(const method of ['GET','HEAD']) {
    const response=await deliverMcpMediaLink(new Request(`${url}&utm_source=chatgpt.com&utm_medium=referral`,{method,headers:{Range:'bytes=0-99'}}),{
      now:()=>now,readSource:async claims=>{
        assert.equal(claims.userId,'owner');assert.equal(claims.clientId,'client-a');
        assert.deepEqual(claims.source,source);return original;
      },
    });
    assert.equal(response.status,307);
    assert.equal(response.headers.get('Cache-Control'),'private, no-store');
    assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');
    const target=new URL(response.headers.get('Location')!);
    assert.equal(target.origin,base);
    assert.equal(target.pathname,'/renders/owner/video.mp4');
    assert.equal(target.searchParams.get('X-Amz-Expires'),'300');
    assert.equal(target.searchParams.get('X-Amz-Date'),'20261112T120000Z');
    assert.ok(target.searchParams.get('X-Amz-Signature'));
    assert.equal(target.searchParams.has('utm_source'),false);
    assert.equal(target.searchParams.has('token'),false);
  }
});

test('tampered owner, client, source, hash, expiry or signature fails before any media read',async()=>{
  const {deliverMcpMediaLink}=await delivery;
  const url=new URL(await link());
  const [payload,mac]=url.searchParams.get('token')!.split('.');
  const claims=JSON.parse(Buffer.from(payload,'base64url').toString());
  const changes=[{userId:'foreign'},{clientId:'client-b'},{source:{...source,assetId:'foreign'}},{mediaHash:'0'.repeat(64)},{exp:claims.exp+1}];
  for(const change of changes) {
    const changed=new URL(url);
    changed.searchParams.set('token',`${Buffer.from(JSON.stringify({...claims,...change})).toString('base64url')}.${mac}`);
    const response=await deliverMcpMediaLink(new Request(changed),{now:()=>now,readSource:async()=>{assert.fail('Tampered token reached media lookup');}});
    assert.equal(response.status,404);
  }
  url.searchParams.set('token',`${payload}.${mac[0]==='A'?'B':'A'}${mac.slice(1)}`);
  assert.equal((await deliverMcpMediaLink(new Request(url),{now:()=>now,readSource:async()=>{assert.fail('Bad MAC reached lookup');}})).status,404);
});

test('expired grants, foreign host, duplicate token and arbitrary URL parameters are refused',async()=>{
  const {deliverMcpMediaLink}=await delivery;
  const url=await link();
  const cases=[{url,time:now+300000},{url:url.replace(origin,'https://maxvideoai.com'),time:now},
    {url:`${url}&token=other`,time:now},{url:`${url}&url=https://attacker.invalid/video.mp4`,time:now}];
  for(const item of cases)assert.equal((await deliverMcpMediaLink(new Request(item.url),{
    now:()=>item.time,readSource:async()=>{assert.fail('Invalid request reached lookup');},
  })).status,404);
});

test('a removed, replaced or foreign-owned source cannot be redeemed with an old capability',async()=>{
  const {deliverMcpMediaLink}=await delivery;
  const url=await link();
  for(const result of [null,`${base}/renders/owner/replacement.mp4`,`${base}/renders/foreign/video.mp4`,'https://attacker.invalid/video.mp4']) {
    const response=await deliverMcpMediaLink(new Request(url),{now:()=>now,readSource:async()=>result,
      sign:async()=>{assert.fail('Unavailable media reached storage signer');},
    });
    assert.equal(response.status,404);
  }
  const {createMcpMediaLink}=await api;
  assert.equal(createMcpMediaLink({...input,url:`${base}/renders/foreign/video.mp4`},now),null);
});

test('handoff and redirected grants never extend a shorter existing signature or expiry',async()=>{
  const {createMcpMediaLink,verifyMcpMediaToken}=await api;
  const url=createMcpMediaLink({...input,url:`${original}?X-Amz-Date=20261112T120000Z&X-Amz-Expires=60&X-Amz-Signature=offline`},now)!;
  const claims=verifyMcpMediaToken(new URL(url).searchParams.get('token')!,origin,now)!;
  assert.equal(claims.exp,Math.floor(now/1000)+60);
  const {deliverMcpMediaLink}=await delivery;
  const response=await deliverMcpMediaLink(new Request(url),{now:()=>now+30000,readSource:async()=>original});
  assert.equal(new URL(response.headers.get('Location')!).searchParams.get('X-Amz-Expires'),'30');
  assert.equal(new URL(response.headers.get('Location')!).searchParams.get('X-Amz-Date'),'20261112T120030Z');
  let clock=now;
  assert.equal((await deliverMcpMediaLink(new Request(url),{now:()=>clock,readSource:async()=>{clock=now+60000;return original;}})).status,404);
  assert.equal(createMcpMediaLink({...input,expiresAt:new Date(now-1000).toISOString()},now),null);
});

test('missing signing configuration never invents a link or grants access',async()=>{
  const saved=process.env.MCP_ACQUISITION_SIGNING_SECRET;
  const url=await link();
  try {
    delete process.env.MCP_ACQUISITION_SIGNING_SECRET;
    assert.equal((await api).createMcpMediaLink(input,now),null);
    assert.equal((await (await delivery).deliverMcpMediaLink(new Request(url),{now:()=>now})).status,404);
  } finally {process.env.MCP_ACQUISITION_SIGNING_SECRET=saved;}
});
