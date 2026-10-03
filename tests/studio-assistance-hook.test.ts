import assert from 'node:assert/strict';
import test from 'node:test';
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {STUDIO_ASSISTANCE_TARIFF, type StudioAssistanceStatus} from '../frontend/src/lib/studio/assistance-contract';
import {useStudioAssistance} from '../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_hooks/useStudioAssistance';

const initialStatus: StudioAssistanceStatus = {
  enabled: true, policyVersion: 'test', revision: 3, selectedModel: 'gpt-6.1-sol', mode: 'included_sol',
  tariff: STUDIO_ASSISTANCE_TARIFF,
  includedSol: {remainingPercent: 0, renewal: 'one_time'},
  sponsoredLuna: {remainingPercent: 100, renewal: 'one_time'},
  paid: {authorizedCents: 0, spentCents: 0, reservedCents: 0, remainingCents: 0, maxAdditionalBudgetCents: 2000},
  unresolvedCalls: 0, canContinue: false, blockedReason: 'included_exhausted',
};
const paidStatus: StudioAssistanceStatus = {
  ...initialStatus, revision: 4, mode: 'paid_sol', canContinue: true, blockedReason: null,
  paid: {...initialStatus.paid, authorizedCents: 500, remainingCents: 500, maxAdditionalBudgetCents: 1500},
};
const choice = {action: 'authorize_paid', budgetCents: 500, tariffVersion: STUDIO_ASSISTANCE_TARIFF.version, expectedRevision: 3} as const;
type Request = {url: string; init: RequestInit; resolve: (response: Response) => void; reject: (error: Error) => void};

async function withHook(run: (harness: {
  state: () => ReturnType<typeof useStudioAssistance>;
  requests: Request[];
  renders: ReturnType<typeof useStudioAssistance>[];
  render: (accountKey?: string, conversationBusy?: boolean) => Promise<void>;
  reply: (request: Request, payload: unknown, httpStatus?: number) => Promise<void>;
}) => Promise<void>) {
  const dom = new JSDOM('<div id="root"></div>', {url: 'http://localhost/app/studio'});
  const requests: Request[] = [];
  const globals = {
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true,
    // Deliberately allow late responses after abort: isolation must not depend on cancellation winning a race.
    fetch: (url: unknown, init: RequestInit = {}) => new Promise<Response>((resolve, reject) => requests.push({url: String(url), init, resolve, reject})),
  };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, {configurable: true, writable: true, value});
  const root = createRoot(dom.window.document.getElementById('root')!);
  let state!: ReturnType<typeof useStudioAssistance>;
  const renders: ReturnType<typeof useStudioAssistance>[] = [];
  function Probe({accountKey, conversationBusy}: {accountKey: string; conversationBusy: boolean}) {
    state = useStudioAssistance(accountKey, conversationBusy);
    renders.push(state);
    return null;
  }
  const render = async (accountKey = 'account-a', conversationBusy = false) => {
    await act(async () => {root.render(React.createElement(Probe, {accountKey, conversationBusy}));});
  };
  const reply = async (request: Request, payload: unknown, httpStatus = 200) => {
    await act(async () => {request.resolve(new Response(JSON.stringify(payload), {status: httpStatus, headers: {'content-type': 'application/json'}}));});
  };
  try {
    await render();
    await run({state: () => state, requests, renders, render, reply});
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, value] of previous) {
      if (value) Object.defineProperty(globalThis, key, value);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

test('an older allowance read cannot replace the accepted authorization result', async () => {
  await withHook(async ({state, requests, reply}) => {
    await reply(requests[0], {ok: true, result: initialStatus});
    let refresh!: Promise<void>;
    await act(async () => {refresh = state().refresh();});
    let selection!: Promise<boolean>;
    await act(async () => {selection = state().choose(choice);});
    assert.equal(requests[1].init.signal?.aborted, true);
    await reply(requests[2], {ok: true, result: paidStatus});
    assert.equal(await selection, true);
    await reply(requests[1], {ok: true, result: initialStatus});
    await refresh;
    assert.equal(state().status?.revision, paidStatus.revision);
    assert.equal(state().status?.paid.remainingCents, 500);
  });
});

test('two immediate authorization clicks produce one POST and retain the reviewed revision and tariff', async () => {
  await withHook(async ({state, requests, reply}) => {
    await reply(requests[0], {ok: true, result: initialStatus});
    let first!: Promise<boolean>, second!: Promise<boolean>;
    await act(async () => {first = state().choose(choice); second = state().choose(choice);});
    assert.equal(await second, false);
    assert.equal(state().busy, true);
    assert.equal(requests.filter(request => request.init.method === 'POST').length, 1);
    assert.deepEqual(JSON.parse(String(requests[1].init.body)), choice);
    await reply(requests[1], {ok: true, result: paidStatus});
    assert.equal(await first, true);
    assert.equal(state().busy, false);
  });
});

test('unknown or malformed authorization outcomes require recovery without retrying or claiming success', async () => {
  for (const payload of [null, {ok: true}, {ok: true, result: {...paidStatus, paid: {...paidStatus.paid, remainingCents: -1}}}]) {
    await withHook(async ({state, requests, reply}) => {
      await reply(requests[0], {ok: true, result: initialStatus});
      let selection!: Promise<boolean>;
      await act(async () => {selection = state().choose(choice);});
      await reply(requests[1], payload);
      assert.equal(await selection, false);
      assert.equal(state().error, 'UNAVAILABLE');
      assert.equal(state().busy, false);
      assert.equal(state().status?.revision, initialStatus.revision);
      assert.equal(requests.length, 2, 'unknown outcome must not cause an automatic write or retry');
      let refresh!: Promise<void>;
      await act(async () => {refresh = state().refresh();});
      await reply(requests[2], {ok: true, result: paidStatus});
      await refresh;
      assert.equal(state().error, null);
      assert.equal(state().status?.revision, paidStatus.revision);
    });
  }
});

test('revision conflicts keep the previous allowance and require refreshed confirmation', async () => {
  await withHook(async ({state, requests, reply}) => {
    await reply(requests[0], {ok: true, result: initialStatus});
    let selection!: Promise<boolean>;
    await act(async () => {selection = state().choose(choice);});
    await reply(requests[1], {ok: false, error: 'CONFIRMATION_REQUIRED'}, 409);
    assert.equal(await selection, false);
    assert.equal(state().error, 'STALE');
    assert.equal(state().status?.revision, initialStatus.revision);
    assert.equal(requests.length, 2);
  });
});

test('an account switch during a read ignores the previous account response', async () => {
  await withHook(async ({state, requests, render, reply}) => {
    await render('account-b');
    assert.equal(requests.length, 2);
    assert.equal(state().status, null);
    await reply(requests[1], {ok: true, result: {...initialStatus, revision: 8}});
    await reply(requests[0], {ok: true, result: paidStatus});
    assert.equal(state().status?.revision, 8);
    assert.equal(state().busy, false);
  });
});

test('switching accounts during authorization initializes the new allowance without inheriting the old mutation', async () => {
  await withHook(async ({state, requests, renders, render, reply}) => {
    await reply(requests[0], {ok: true, result: initialStatus});
    let previousSelection!: Promise<boolean>;
    await act(async () => {previousSelection = state().choose(choice);});
    const beforeSwitch = renders.length;
    await render('account-b');
    for (const render of renders.slice(beforeSwitch)) {
      assert.equal(render.status, null, 'old account allowance must be hidden before effects run');
      assert.equal(render.busy, false, 'old account lock must be hidden before effects run');
      assert.equal(render.error, null);
    }
    assert.equal(requests[1].init.signal?.aborted, true);
    assert.equal(state().status, null);
    assert.equal(state().busy, false, 'the new account must not inherit an old account authorization lock');
    assert.equal(requests.length, 3, 'the new account must load its own allowance despite the old POST');
    await reply(requests[2], {ok: true, result: {...initialStatus, revision: 9}});
    await reply(requests[1], {ok: true, result: paidStatus});
    assert.equal(await previousSelection, false);
    assert.equal(state().status?.revision, 9);
    assert.equal(state().busy, false);
  });
});

test('callbacks retained from another account cannot authorize against the new session', async () => {
  await withHook(async ({state, requests, render, reply}) => {
    await reply(requests[0], {ok: true, result: initialStatus});
    const previousChoose = state().choose;
    await render('account-b');
    await reply(requests[1], {ok: true, result: {...initialStatus, revision: 9}});
    let selection!: Promise<boolean>;
    await act(async () => {selection = previousChoose(choice);});
    assert.equal(requests.length, 2, 'a stale callback must be rejected before issuing a financial choice');
    assert.equal(await selection, false);
    assert.equal(state().status?.revision, 9);
  });
});


test('a lost authorization acknowledgement preserves the known allowance until a read verifies the result', async () => {
  await withHook(async ({state, requests, reply}) => {
    await reply(requests[0], {ok: true, result: initialStatus});
    let selection!: Promise<boolean>;
    await act(async () => {selection = state().choose(choice);});
    await act(async () => {requests[1].reject(new TypeError('Connection closed before acknowledgement'));});
    assert.equal(await selection, false);
    assert.equal(state().error, 'UNAVAILABLE');
    assert.equal(state().busy, false);
    assert.equal(state().status?.revision, initialStatus.revision);
    assert.equal(requests.length, 2);
    let refresh!: Promise<void>;
    await act(async () => {refresh = state().refresh();});
    await reply(requests[2], {ok: true, result: paidStatus});
    await refresh;
    assert.equal(state().status?.revision, paidStatus.revision);
    assert.equal(state().error, null);
    assert.equal(requests.filter(request => request.init.method === 'POST').length, 1);
    assert.ok(requests.every(request => request.url === '/api/studio/assistance'), 'choosing a budget never submits or repeats a conversation message');
  });
});

test('a malformed refresh cannot replace a known allowance with invalid amounts or leave no recovery signal', async () => {
  await withHook(async ({state, requests, reply}) => {
    await reply(requests[0], {ok: true, result: initialStatus});
    let refresh!: Promise<void>;
    await act(async () => {refresh = state().refresh();});
    await reply(requests[1], {ok: true, result: {...paidStatus, paid: null}});
    await refresh;
    assert.equal(state().status?.revision, initialStatus.revision);
    assert.equal(state().error, 'UNAVAILABLE');
    assert.equal(requests.filter(request => request.init.method === 'POST').length, 0);
  });
});
