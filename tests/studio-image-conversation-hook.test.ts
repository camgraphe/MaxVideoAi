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
  const requests: { method: string; body?: string }[] = [];
  const queuedReads: (() => Promise<{ ok: boolean; payload: unknown }>)[] = [];
  const queuedPosts: (() => Promise<{ ok: boolean; payload: unknown }>)[] = [];
  if (initialRead) queuedReads.push(initialRead);
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    sessionStorage: dom.window.sessionStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (_url: string, options?: RequestInit) => {
      requests.push({
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
              : { projectId: "project-a", projectName: "Test", turns },
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
  function Fixture() {
    state = useImageConversation("project-a", "owner", "Test");
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
    queuePost(response: { ok: boolean; payload: unknown }) {
      queuedPosts.push(() => Promise.resolve(response));
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
      "La conversation est momentanément indisponible.",
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
    assert.equal(view.state.error, "Connexion interrompue");
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
      "The confirmation could not be verified.",
    );
  } finally {
    await view.close();
  }
});

test("an insufficient wallet explains the refusal instead of exposing the English backend message", async () => {
  const view = await mount();
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
  const view = await mount([quotedTurn]);
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
