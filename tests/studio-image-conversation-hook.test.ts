import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { useImageConversation } from "../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_hooks/useImageConversation";

async function mount(
  turns: unknown[] = [],
  initialRead?: () => Promise<{ ok: boolean; payload: unknown }>,
  restorePending = false,
  locale?: "en" | "fr",
) {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/" });
  const old = new Map<string, PropertyDescriptor | undefined>();
  const input = {
    requestId: "a2899f64-2203-4771-9836-ec6abb8f9bdd",
    message: "Une image bleue",
    references: [],
  };
  if (restorePending)
    dom.window.sessionStorage.setItem(
      "studio-image-pending:owner:project-a",
      JSON.stringify(input),
    );
  let props = { projectId: "project-a", accountKey: "owner", name: "Test", locale };
  const requests: { url: string; method: string; body?: string }[] = [];
  const queuedReads: (() => Promise<{ ok: boolean; payload: unknown }>)[] = [];
  const queuedPosts: (() => Promise<{ ok: boolean; payload: unknown }>)[] = [];
  if (initialRead) queuedReads.push(initialRead);
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    sessionStorage: dom.window.sessionStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (url: string, options?: RequestInit) => {
      requests.push({
        url,
        method: options?.method ?? "GET",
        body: options?.body as string | undefined,
      });
      if (options?.method === "POST") {
        const queued = queuedPosts.shift();
        if (queued) {
          const response = await queued();
          return { ok: response.ok, json: async () => response.payload };
        }
      } else {
        const queued = queuedReads.shift();
        if (queued) {
          const response = await queued();
          return { ok: response.ok, json: async () => response.payload };
        }
      }
      return {
        ok: true,
        json: async () => ({
          ok: true,
          result:
            options?.method === "POST"
              ? {
                  ...input,
                  state: "ready",
                  reply: "OK",
                  quote: null,
                  generation: null,
                  createdAt: new Date().toISOString(),
                }
              : { projectId: props.projectId, projectName: props.name, turns },
        }),
      };
    },
  })) {
    old.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      value,
      writable: true,
      configurable: true,
    });
  }
  let state!: ReturnType<typeof useImageConversation>;
  const renders: ReturnType<typeof useImageConversation>[] = [];
  function Fixture() {
    state = useImageConversation(props.projectId, props.accountKey, props.name, props.locale);
    renders.push(state);
    return null;
  }
  const root = createRoot(dom.window.document.getElementById("root")!);
  await act(async () =>
    root.render(
      React.createElement(React.StrictMode, null, React.createElement(Fixture)),
    ),
  );
  return {
    get state() {
      return state;
    },
    input,
    requests,
    renders,
    storage: dom.window.sessionStorage,
    async rerender(next: Partial<typeof props>) {
      props = { ...props, ...next };
      await act(async () => root.render(
        React.createElement(React.StrictMode, null, React.createElement(Fixture)),
      ));
    },
    queueRead(
      response:
        | { ok?: boolean; payload: unknown }
        | (() => Promise<{ ok: boolean; payload: unknown }>),
    ) {
      queuedReads.push(
        typeof response === "function"
          ? response
          : () => Promise.resolve({ ok: response.ok ?? true, payload: response.payload }),
      );
    },
    queuePost(response: { ok: boolean; payload: unknown } | (() => Promise<{ ok: boolean; payload: unknown }>)) {
      queuedPosts.push(typeof response === "function" ? response : () => Promise.resolve(response));
    },
    async close() {
      await act(async () => root.unmount());
      dom.window.close();
      for (const [key, value] of old) {
        if (value) Object.defineProperty(globalThis, key, value);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

test("manual refresh failures stay recoverable and a later successful refresh clears them", async () => {
  const originalTurn = {
    requestId: "a2899f64-2203-4771-9836-ec6abb8f9bdd",
    message: "Une image bleue",
    references: [],
    reply: "La direction est prête.",
    state: "ready",
    retryable: false,
    quote: null,
    generation: null,
    createdAt: "2026-10-01T10:00:00.000Z",
  };
  for (const failure of [
    () => Promise.reject(new Error("Connexion interrompue")),
    () =>
      Promise.resolve({
        ok: false,
        payload: { ok: false, message: "Session expirée" },
      }),
  ]) {
    const view = await mount([originalTurn]);
    try {
      assert.equal(view.state.error, null);
      assert.deepEqual(view.state.conversation.turns, [originalTurn]);
      view.queueRead(failure);
      await assert.doesNotReject(async () => {
        await act(async () => view.state.refresh());
      });
      assert.ok(
        view.state.error,
        "failed refresh should be visible to the customer",
      );
      assert.deepEqual(view.state.conversation.turns, [originalTurn]);

      const refreshedTurn = { ...originalTurn, message: "Nouvelle direction" };
      view.queueRead({
        payload: {
          ok: true,
          result: {
            projectId: "project-a",
            projectName: "Test",
            turns: [refreshedTurn],
          },
        },
      });
      await act(async () => view.state.refresh());
      assert.equal(view.state.error, null);
      assert.deepEqual(
        view.state.conversation.turns,
        [refreshedTurn],
      );
    } finally {
      await view.close();
    }
  }
});

test("an initial conversation read failure is cleared by successful manual recovery", async () => {
  const staleTurn = {
    requestId: "a2899f64-2203-4771-9836-ec6abb8f9bdd",
    message: "Ancienne direction",
    references: [],
    reply: "La direction est prête.",
    state: "ready",
    retryable: false,
    quote: null,
    generation: null,
    createdAt: "2026-10-01T10:00:00.000Z",
  };
  const recoveredTurn = { ...staleTurn, message: "Direction récupérée" };
  const view = await mount([staleTurn], () =>
    Promise.resolve({
      ok: false,
      payload: { ok: false, message: "Service temporairement indisponible" },
    }),
  );
  try {
    assert.equal(
      view.state.error,
      "The conversation is temporarily unavailable. Refresh to try again.",
    );
    view.queueRead({
      payload: {
        ok: true,
        result: {
          projectId: "project-a",
          projectName: "Test",
          turns: [recoveredTurn],
        },
      },
    });
    await act(async () => view.state.refresh());
    assert.equal(view.state.error, null);
    assert.deepEqual(view.state.conversation.turns, [recoveredTurn]);
  } finally {
    await view.close();
  }
});

test("a successful new POST clears an earlier manual read error", async () => {
  const view = await mount();
  try {
    view.queueRead(() => Promise.reject(new Error("Connexion interrompue")));
    await act(async () => view.state.refresh());
    assert.match(view.state.error ?? "", /conversation.*unavailable/i);
    view.queueRead({
      payload: {
        ok: true,
        result: {
          projectId: "project-a",
          projectName: "Test",
          turns: [
            {
              ...view.input,
              reply: "La direction est prête.",
              state: "ready",
              retryable: false,
              quote: null,
              generation: null,
              createdAt: "2026-10-01T10:00:00.000Z",
            },
          ],
        },
      },
    });
    await act(async () => view.state.submit(view.input));
    assert.equal(view.state.error, null);
    assert.equal(view.state.pending, null);
  } finally {
    await view.close();
  }
});

test("the background read after a failed confirmation does not clear its visible error", async () => {
  const view = await mount();
  try {
    view.queuePost({
      ok: false,
      payload: {
        ok: false,
        message: "The confirmation could not be verified.",
      },
    });
    view.queueRead({
      payload: {
        ok: true,
        result: { projectId: "project-a", projectName: "Test", turns: [] },
      },
    });
    await act(async () => view.state.confirm("request-id", "quote-id"));
    assert.equal(
      view.state.error,
      "The confirmation could not be verified. Refresh to check its status before trying again.",
    );
  } finally {
    await view.close();
  }
});

test("an insufficient wallet explains the refusal in French instead of exposing the backend message", async () => {
  const view = await mount([], undefined, false, "fr");
  try {
    view.queuePost({
      ok: false,
      payload: { ok: false, error: "INSUFFICIENT_FUNDS", message: "Add funds before confirming this generation." },
    });
    await act(async () => view.state.confirm("request-id", "quote-id"));
    assert.match(view.state.error ?? "", /solde.*insuffisant/i);
    assert.doesNotMatch(view.state.error ?? "", /Add funds/);
  } finally {
    await view.close();
  }
});

test("only an explicit refresh with sufficient current funds clears a wallet refusal", async () => {
  const quotedTurn = {
    requestId: "request-id", state: "ready", quote: {
      quoteId: "quote-id", state: "prepared", expiresAt: new Date(Date.now() + 60000).toISOString(),
      price: { amountCents: 6, currency: "USD" }, wallet: { amountCents: 6, currency: "USD" },
    },
  };
  const view = await mount([quotedTurn], undefined, false, "fr");
  try {
    view.queuePost({ ok: false, payload: { ok: false, error: "INSUFFICIENT_FUNDS" } });
    await act(async () => view.state.confirm("request-id", "quote-id"));
    assert.match(view.state.error ?? "", /solde.*insuffisant/i, "automatic read must preserve the refusal");
    view.queueRead({ payload: { ok: true, result: { projectId: "project-a", projectName: "Test", turns: [{ ...quotedTurn, quote: { ...quotedTurn.quote, wallet: { amountCents: 0, currency: "USD" } } }] } } });
    await act(async () => view.state.refresh());
    assert.match(view.state.error ?? "", /solde.*insuffisant/i);
    view.queueRead({ payload: { ok: true, result: { projectId: "project-a", projectName: "Test", turns: [quotedTurn] } } });
    await act(async () => view.state.refresh());
    assert.equal(view.state.error, null);
    assert.equal(view.requests.filter((r) => r.method === "POST").length, 1, "refresh must never repeat confirmation");
  } finally { await view.close(); }
});

test("a wallet refresh queued behind another read waits for its own fresh balance", async () => {
  const quotedTurn = { requestId: "request-id", state: "ready", quote: {
    quoteId: "quote-id", state: "prepared", expiresAt: new Date(Date.now() + 60000).toISOString(),
    price: { amountCents: 6, currency: "USD" }, wallet: { amountCents: 0, currency: "USD" },
  }};
  const view = await mount([quotedTurn]);
  try {
    view.queuePost({ ok: false, payload: { ok: false, error: "INSUFFICIENT_FUNDS" } });
    await act(async () => view.state.confirm("request-id", "quote-id"));
    let release!: (value: {ok: boolean; payload: unknown}) => void;
    view.queueRead(() => new Promise((resolve) => { release = resolve; }));
    view.queueRead({ payload: { ok: true, result: { projectId: "project-a", projectName: "Test", turns: [{...quotedTurn, quote: {...quotedTurn.quote, wallet: {amountCents: 6, currency: "USD"}}}] } } });
    await act(async () => {
      const first = view.state.refresh();
      const queued = view.state.refresh();
      release({ok: true, payload: {ok: true, result: {projectId: "project-a", projectName: "Test", turns: [quotedTurn]}}});
      await Promise.all([first, queued]);
    });
    assert.equal(view.state.error, null);
    assert.equal(view.requests.filter((r) => r.method === "POST").length, 1);
  } finally { await view.close(); }
});

test("reload of a POST never committed exposes recovery and retries the same immutable input", async () => {
  const view = await mount([], undefined, true);
  try {
    assert.equal(view.state.busy, false);
    assert.equal(view.state.error, null);
    assert.deepEqual(view.state.pending, view.input);
    assert.equal(view.state.canResumePending, true);
    await act(async () => view.state.submit(view.state.pending!));
    assert.deepEqual(
      JSON.parse(view.requests.find((r) => r.method === "POST")!.body!),
      view.input,
    );
    assert.equal(view.state.pending, null);
  } finally {
    await view.close();
  }
});
test("an active saved turn waits while a failed turn exposes recovery", async () => {
  const input = {
    requestId: "a2899f64-2203-4771-9836-ec6abb8f9bdd",
    message: "Une image bleue",
    references: [],
  };
  const active = await mount([{ ...input, state: "thinking" }], undefined, true);
  try {
    assert.equal(active.state.canResumePending, false);
  } finally {
    await active.close();
  }
  const failed = await mount([{ ...input, state: "failed" }], undefined, true);
  try {
    assert.equal(failed.state.canResumePending, true);
    await act(async () => failed.state.discardPending());
    assert.equal(failed.state.pending, null);
  } finally {
    await failed.close();
  }
});

function deferredResponse() {
  let resolve!: (response: { ok: boolean; payload: unknown }) => void;
  const promise = new Promise<{ ok: boolean; payload: unknown }>((done) => { resolve = done; });
  return { promise, resolve };
}
function conversationResponse(projectId: string, turns: unknown[] = []) {
  return { ok: true, payload: { ok: true, result: { projectId, projectName: projectId, turns } } };
}
function readyTurn(input: { requestId: string; message: string; references: string[] }) {
  return { ...input, state: "ready", reply: "Your direction is ready.", retryable: false, quote: null, generation: null, createdAt: "2026-10-03T10:00:00.000Z" };
}

test("rapid submissions and confirmations share one synchronous mutation lock", async () => {
  for (const firstAction of ["submit", "confirm"] as const) {
    const view = await mount();
    try {
      const response = deferredResponse();
      view.queuePost(() => response.promise);
      let accepted!: Promise<void>;
      await act(async () => {
        accepted = firstAction === "submit"
          ? view.state.submit(view.input)
          : view.state.confirm("request-id", "quote-id");
        await view.state.submit({ ...view.input, requestId: "820a3e8f-d7a3-4917-bb55-606f0e028cc0" });
        await view.state.confirm("request-id", "quote-id");
      });
      assert.equal(view.requests.filter((request) => request.method === "POST").length, 1);
      assert.equal(view.state.busy, true);
      await act(async () => {
        response.resolve({ ok: true, payload: { ok: true, result: readyTurn(view.input) } });
        await accepted;
      });
      assert.equal(view.state.busy, false);
      await act(async () => view.state.submit(view.input));
      assert.equal(view.requests.filter((request) => request.method === "POST").length, 2, "the lock is released after settlement");
    } finally { await view.close(); }
  }
});

test("initial loading covers storage recovery until the current conversation arrives", async () => {
  const response = deferredResponse();
  const view = await mount([], () => response.promise, true);
  try {
    assert.equal(view.renders[0].loading, true, "the first render must not show an empty conversation");
    assert.equal(view.state.loading, true);
    assert.equal(view.state.canResumePending, false, "a saved request must be reconciled before offering a retry");
    assert.equal(view.requests.length, 1, "Strict Mode and pending hydration do not duplicate the initial read");
    await act(async () => response.resolve(conversationResponse("project-a", [readyTurn(view.input)])));
    assert.equal(view.state.loading, false);
    assert.equal(view.state.pending, null);
    assert.equal(view.storage.getItem("studio-image-pending:owner:project-a"), null);
    assert.equal(view.requests.length, 1);
  } finally { await view.close(); }
});

test("initial loading settles after a read failure and refresh can recover", async () => {
  const response = deferredResponse();
  const view = await mount([], () => response.promise);
  try {
    await act(async () => response.resolve({ ok: false, payload: { ok: false, error: "ACCESS_CHECK_FAILED", message: "Internal account lookup failed" } }));
    assert.equal(view.state.loading, false);
    assert.match(view.state.error ?? "", /conversation.*unavailable/i);
    assert.equal(view.state.errorCode, "ACCESS_CHECK_FAILED");
    await act(async () => view.state.refresh());
    assert.equal(view.state.error, null);
    assert.equal(view.state.errorCode, null);
  } finally { await view.close(); }
});

test("locale changes translate stable errors without another request", async () => {
  const view = await mount();
  try {
    view.queuePost({ ok: false, payload: { ok: false, error: "INTERNAL_ERROR", message: "Échec SQL / private diagnostic" } });
    await act(async () => view.state.submit(view.input));
    assert.match(view.state.error ?? "", /Studio.*request/i);
    assert.doesNotMatch(view.state.error ?? "", /SQL|diagnostic/);
    assert.equal(view.state.errorCode, "INTERNAL_ERROR");
    assert.deepEqual(view.state.pending, view.input);
    const count = view.requests.length;
    await view.rerender({ locale: "fr" });
    assert.match(view.state.error ?? "", /Studio.*demande/);
    assert.equal(view.state.errorCode, "INTERNAL_ERROR");
    assert.equal(view.requests.length, count);
    assert.equal(view.state.canResumePending, true);
  } finally { await view.close(); }
});

test("read and confirmation failures use localized guidance and retain actionable codes", async () => {
  for (const locale of ["en", "fr"] as const) {
    const view = await mount([], undefined, false, locale);
    try {
      view.queueRead({ ok: false, payload: { ok: false, error: "UNAUTHORIZED", message: "Session expired at private timestamp" } });
      await act(async () => view.state.refresh());
      assert.match(view.state.error ?? "", locale === "fr" ? /session.*expiré/i : /session.*expired/i);
      assert.doesNotMatch(view.state.error ?? "", /timestamp/);
      assert.equal(view.state.errorCode, "UNAUTHORIZED");
      view.queuePost({ ok: false, payload: { ok: false, error: "INSUFFICIENT_FUNDS", message: "A private wallet diagnostic" } });
      await act(async () => view.state.confirm("request-id", "quote-id"));
      assert.match(view.state.error ?? "", locale === "fr" ? /solde.*insuffisant/i : /balance.*insufficient/i);
      assert.equal(view.state.errorCode, "INSUFFICIENT_FUNDS");
      assert.equal(view.state.needsFunds, true);
      view.queuePost({ ok: false, payload: { ok: false, error: "QUOTE_EXPIRED", message: "Raw backend expiry" } });
      await act(async () => view.state.confirm("request-id", "quote-id"));
      assert.match(view.state.error ?? "", locale === "fr" ? /devis.*expiré/i : /quote.*expired/i);
      assert.equal(view.state.errorCode, "QUOTE_EXPIRED");
      assert.equal(view.state.needsFunds, false);
      assert.equal(view.requests.filter((request) => request.method === "POST").length, 2);
    } finally { await view.close(); }
  }
});

test("a failed acknowledgement keeps its immutable retry input until a ready read arrives", async () => {
  const view = await mount();
  try {
    view.queuePost(() => Promise.reject(new TypeError("Failed to fetch private endpoint")));
    await act(async () => view.state.submit(view.input));
    assert.equal(view.state.busy, false);
    assert.equal(view.state.canResumePending, true);
    assert.deepEqual(JSON.parse(view.storage.getItem("studio-image-pending:owner:project-a")!), view.input);
    assert.doesNotMatch(view.state.error ?? "", /private endpoint/);
    view.queueRead(conversationResponse("project-a", [readyTurn(view.input)]));
    await act(async () => view.state.refresh());
    assert.equal(view.state.pending, null);
    assert.equal(view.storage.getItem("studio-image-pending:owner:project-a"), null);
    assert.equal(view.requests.filter((request) => request.method === "POST").length, 1);
  } finally { await view.close(); }
});

test("a project change starts its own read and ignores an older queued response", async () => {
  const firstResponse = deferredResponse();
  const view = await mount([], () => firstResponse.promise, true);
  try {
    let queued!: Promise<void>;
    await act(async () => { queued = view.state.refresh(); });
    const newResponse = deferredResponse();
    view.queueRead(() => newResponse.promise);
    const before = view.renders.length;
    await view.rerender({ projectId: "project-b", name: "Project B" });
    assert.equal(view.requests.at(-1)?.url, "/api/studio/projects/project-b/image-conversation");
    assert.equal(view.state.conversation.projectId, "project-b");
    assert.equal(view.state.pending, null);
    assert.equal(view.state.loading, true);
    assert.ok(view.renders.slice(before).every((render) => render.conversation.projectId === "project-b"));
    await act(async () => {
      firstResponse.resolve(conversationResponse("project-a", [readyTurn(view.input)]));
      await queued;
    });
    assert.equal(view.state.conversation.projectId, "project-b");
    assert.equal(view.state.loading, true, "an old scope cannot end this scope's loading state");
    assert.equal(view.requests.filter((request) => request.url.includes("project-a")).length, 1, "queued reads from an inactive project are discarded");
    await act(async () => newResponse.resolve(conversationResponse("project-b")));
    assert.equal(view.state.loading, false);
    assert.ok(view.storage.getItem("studio-image-pending:owner:project-a"), "another project's recovery remains available");
  } finally { await view.close(); }
});

test("account changes hide saved conversation and pending input before effects", async () => {
  const view = await mount([], undefined, true);
  try {
    const turn = readyTurn(view.input);
    view.queueRead(conversationResponse("project-a", [turn]));
    await act(async () => view.state.refresh());
    const response = deferredResponse();
    view.queuePost(() => response.promise);
    let submitted!: Promise<void>;
    await act(async () => { submitted = view.state.submit(view.input); });
    const nextRead = deferredResponse();
    view.queueRead(() => nextRead.promise);
    const before = view.renders.length;
    await view.rerender({ accountKey: "another-owner" });
    for (const render of view.renders.slice(before)) {
      assert.deepEqual(render.conversation.turns, []);
      assert.equal(render.pending, null);
      assert.equal(render.busy, false);
      assert.equal(render.error, null);
    }
    assert.equal(view.state.loading, true);
    await act(async () => {
      response.resolve({ ok: true, payload: { ok: true, result: turn } });
      await submitted;
      nextRead.resolve(conversationResponse("project-a"));
    });
    assert.equal(view.state.loading, false);
    assert.deepEqual(view.state.conversation.turns, []);
    assert.ok(view.storage.getItem("studio-image-pending:owner:project-a"));
  } finally { await view.close(); }
});

test("a stale read failure cannot replace an acknowledged new reply with an error", async () => {
  const initialRead = deferredResponse();
  const view = await mount([], () => initialRead.promise);
  try {
    let submitted!: Promise<void>;
    const turn = readyTurn(view.input);
    const refreshed = deferredResponse();
    view.queueRead(() => refreshed.promise);
    await act(async () => { submitted = view.state.submit(view.input); });
    await act(async () => {
      initialRead.resolve({ ok: false, payload: { ok: false, error: "INTERNAL_ERROR" } });
    });
    assert.equal(view.state.error, null, "an obsolete read must not obscure the acknowledged reply while refresh is pending");
    await act(async () => {
      refreshed.resolve(conversationResponse("project-a", [turn]));
      await submitted;
    });
    assert.equal(view.state.error, null);
    assert.equal(view.state.pending, null);
    assert.deepEqual(view.state.conversation.turns, [turn]);
  } finally { await view.close(); }
});

test("a read failure after a successful submission is presented as a refresh problem", async () => {
  const view = await mount();
  try {
    view.queueRead(() => Promise.reject(new TypeError("Lost connection")));
    await act(async () => view.state.submit(view.input));
    assert.equal(view.state.pending, null);
    assert.equal(view.state.canResumePending, false);
    assert.equal(view.state.conversation.turns.length, 1);
    assert.match(view.state.error ?? "", /conversation.*unavailable/i);
    assert.equal(view.requests.filter((request) => request.method === "POST").length, 1);
  } finally { await view.close(); }
});

test("returning to a project does not accept a response from its previous visit", async () => {
  const initialRead = deferredResponse();
  const view = await mount([], () => initialRead.promise);
  try {
    await view.rerender({ projectId: "project-b" });
    const currentRead = deferredResponse();
    view.queueRead(() => currentRead.promise);
    await view.rerender({ projectId: "project-a" });
    await act(async () => initialRead.resolve(conversationResponse("project-a", [readyTurn(view.input)])));
    assert.deepEqual(view.state.conversation.turns, []);
    assert.equal(view.state.loading, true);
    await act(async () => currentRead.resolve(conversationResponse("project-a")));
    assert.equal(view.state.loading, false);
    assert.deepEqual(view.state.conversation.turns, []);
  } finally { await view.close(); }
});

test("thinking and failed submission acknowledgements preserve the immutable recovery request", async () => {
  for (const state of ["thinking", "failed"] as const) {
    const view = await mount();
    try {
      const turn = { ...readyTurn(view.input), state, reply: null, retryable: state === "failed" };
      view.queuePost({ ok: true, payload: { ok: true, result: turn } });
      view.queueRead(conversationResponse("project-a", [turn]));
      await act(async () => view.state.submit(view.input));
      assert.deepEqual(view.state.pending, view.input);
      assert.equal(view.state.canResumePending, state === "failed");
      assert.deepEqual(JSON.parse(view.storage.getItem("studio-image-pending:owner:project-a")!), view.input);
      view.queueRead(conversationResponse("project-a", [readyTurn(view.input)]));
      await act(async () => view.state.refresh());
      assert.equal(view.state.pending, null);
      assert.equal(view.requests.filter((request) => request.method === "POST").length, 1);
    } finally { await view.close(); }
  }
});

test("quote and rate-limit codes provide a safe localized next step", async () => {
  const view = await mount();
  try {
    for (const [code, expected] of [
      ["PRICING_REFRESH_REQUIRED", /refresh.*review.*quote/i],
      ["QUOTE_ALREADY_CLAIMED", /already.*processed.*refresh/i],
      ["RATE_LIMITED", /wait.*try again/i],
    ] as const) {
      view.queuePost({ ok: false, payload: { ok: false, error: code, message: "Unstable backend diagnostic" } });
      await act(async () => view.state.confirm("request-id", "quote-id"));
      assert.match(view.state.error ?? "", expected);
      assert.equal(view.state.errorCode, code);
      assert.doesNotMatch(view.state.error ?? "", /diagnostic/);
    }
    assert.equal(view.requests.filter((request) => request.method === "POST").length, 3, "guidance never repeats a confirmation automatically");
  } finally { await view.close(); }
});
