import assert from 'node:assert/strict';
import test from 'node:test';
import { bundleClientFlow, createClientFlowDom } from './helpers/client-flow-dom';

const bundle = bundleClientFlow(
  `
  import React,{act} from 'react';import {createRoot} from 'react-dom/client';
  import {CharacterStudioRecastSubmit} from './src/components/tools/character-builder/_components/CharacterStudioRecastSubmit.client';
  import {getCharacterStudioCopy} from './src/components/tools/character-builder/_lib/character-studio-copy';
  const root=createRoot(document.getElementById('root'));window.IS_REACT_ACT_ENVIRONMENT=true;
  window.labels=getCharacterStudioCopy('fr');window.fx={act,unmount:()=>root.unmount(),render:()=>root.render(
    <CharacterStudioRecastSubmit copy={window.labels} setup={{portrait:{jobId:'portrait',url:'https://example.invalid/p.png'},
      direction:'Dance',dialogue:'',seconds:8,resolution:'1080p',aspectRatio:'9:16'}}
      cache={new WeakMap()} onLock={v=>window.locked=v}/>) };
`,
  {
    '@/lib/authFetch': 'export const authFetch=(...args)=>fetch(...args);',
    'next/link': 'export default function Link(props){return <a {...props}/>;}',
  },
);

async function mount() {
  const dom = createClientFlowDom('/app/tools/character-builder');
  const w = dom.window as any;
  const requests: Array<{
    url: string;
    body: any;
    reply: (data: object, status?: number) => void;
    reject: () => void;
  }> = [];
  w.fetch = (url: string, options: any = {}) =>
    url.includes('prepare?')
      ? Promise.resolve(Response.json({ ok: true }))
      : new Promise<Response>((resolve, reject) =>
          requests.push({
            url,
            body: JSON.parse(options.body),
            reply: (data, status = 200) => resolve(Response.json(data, { status })),
            reject: () => reject(new Error('network lost')),
          }),
        );
  w.eval(await bundle);
  await w.fx.act(async () => w.fx.render());
  const act = (fn: () => unknown) => w.fx.act(fn);
  const button = () => w.document.querySelector('[data-recast-submit]');
  const quote = {
    ok: true,
    kind: 'wallet',
    quoteId: '11111111-1111-4111-8111-111111111111',
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    amountCents: 565,
    currency: 'USD',
    topupRequired: false,
    sourceSeconds: 7.5,
    audioSeconds: 5.25,
  };
  return {
    w,
    requests,
    act,
    button,
    quote,
    click: () => act(async () => button()?.click()),
    async prepare(extra = {}) {
      await act(async () => button().click());
      await act(async () => requests.at(-1)!.reply({ ...quote, ...extra }));
    },
    async dispose() {
      await act(async () => w.fx.unmount());
      dom.window.close();
    },
  };
}

test('a rejected output setting names the duration, resolution and format and allows a new quote', async () => {
  const f = await mount();
  try {
    await f.click();
    await f.act(async () => f.requests.at(-1)!.reply({ ok: false, error: { code: 'PARAMETER_INVALID' } }, 422));
    const alert = f.w.document.querySelector('[role="alert"]');
    assert.match(alert.textContent, /durée, la résolution et le format/);
    assert.notEqual(alert.textContent.trim(), f.w.labels.invalidPassage);
    assert.equal(f.button().disabled, false);
    await f.click();
    assert.ok(f.requests.at(-1)!.url.endsWith('/prepare'));
    assert.ok(!f.requests.some(r => r.url.endsWith('/confirm')));
  } finally { await f.dispose(); }
});

test('reviewed price is the only approved amount; double clicks send one confirmation', async () => {
  const f = await mount();
  try {
    await f.prepare();
    assert.match(f.button().textContent, /5,65/);
    await f.act(async () => {
      f.button().click();
      f.button().click();
    });
    const confirmations = f.requests.filter((r) => r.url.endsWith('/confirm'));
    assert.equal(confirmations.length, 1);
    assert.deepEqual(confirmations[0].body, {
      quoteId: f.quote.quoteId,
      confirmed: true,
      amountCents: 565,
      currency: 'USD',
    });
    await f.act(async () => confirmations[0].reply({ ok: true, jobId: 'job-1', status: 'accepted' }));
    assert.match(f.w.document.querySelector('a').href, /job=job-1/);
  } finally {
    await f.dispose();
  }
});

for (const code of ['QUOTE_EXPIRED', 'PRICING_REFRESH_REQUIRED'])
  test(`${code} requires a fresh reviewed quote`, async () => {
    const f = await mount();
    try {
      await f.prepare();
      await f.click();
      await f.act(async () => f.requests.at(-1)!.reply({ ok: false, error: { code } }, 409));
      assert.equal(f.button().textContent, f.w.labels.reviewPrice);
      assert.match(f.w.document.body.textContent, /nouveau devis/);
      await f.click();
      assert.ok(f.requests.at(-1)!.url.endsWith('/prepare'));
    } finally {
      await f.dispose();
    }
  });

test('insufficient funds after review offers an actionable billing link', async () => {
  const f = await mount();
  try {
    await f.prepare();
    await f.click();
    await f.act(async () =>
      f.requests.at(-1)!.reply({ ok: false, error: { code: 'INSUFFICIENT_FUNDS' } }, 402),
    );
    assert.ok(f.w.document.querySelector('a[href="/billing"]'));
    assert.match(f.w.document.body.textContent, /Recharge/);
  } finally {
    await f.dispose();
  }
});

test('lost confirmation response keeps the same quote recoverable after its expiry', async () => {
  const f = await mount();
  try {
    await f.prepare({ expiresAt: new Date(Date.now() + 500).toISOString() });
    await f.click();
    await f.act(async () => f.requests.at(-1)!.reject());
    assert.equal(f.w.locked, true, 'uncertain acceptance must retain the original setup');
    await f.act(async () => new Promise((resolve) => setTimeout(resolve, 550)));
    await f.click();
    assert.ok(f.requests.at(-1)!.url.endsWith('/confirm'));
    assert.equal(f.requests.at(-1)!.body.quoteId, f.quote.quoteId);
    assert.equal(f.requests.filter((r) => r.url.endsWith('/prepare')).length, 1);
    await f.act(async () => f.requests.at(-1)!.reply({ ok: true, jobId: 'recovered', status: 'accepted' }));
    assert.match(f.w.document.querySelector('a').href, /job=recovered/);
    assert.equal(f.w.locked, false);
  } finally {
    await f.dispose();
  }
});

test('an unconfirmed expired quote cannot be confirmed', async () => {
  const f = await mount();
  try {
    await f.prepare({ expiresAt: new Date(Date.now() + 30).toISOString() });
    await f.act(async () => new Promise((resolve) => setTimeout(resolve, 60)));
    assert.equal(f.button().textContent, f.w.labels.reviewPrice);
    assert.equal(f.requests.filter((r) => r.url.endsWith('/confirm')).length, 0);
  } finally {
    await f.dispose();
  }
});

test('a quoted topup opens billing separately and allows confirmation after the balance is replenished', async () => {
  const f = await mount();
  try {
    await f.prepare({ topupRequired: true });
    assert.equal(f.w.document.querySelector('a[href="/billing"]').target, '_blank');
    assert.equal(f.button().disabled, false);
    await f.click();
    await f.act(async () => f.requests.at(-1)!.reply({ ok: true, jobId: 'after-topup', status: 'accepted' }));
    assert.match(f.w.document.querySelector('a').href, /job=after-topup/);
  } finally {
    await f.dispose();
  }
});

test('terminal failure opens the existing job instead of offering a second purchase', async () => {
  const f = await mount();
  try {
    await f.prepare();
    await f.click();
    await f.act(async () => f.requests.at(-1)!.reply({ ok: true, jobId: 'failed-job', status: 'failed' }));
    assert.equal(f.button(), null);
    assert.match(f.w.document.querySelector('a').href, /job=failed-job/);
    assert.equal(f.w.document.querySelector('a').textContent, f.w.labels.failedJob);
  } finally {
    await f.dispose();
  }
});
