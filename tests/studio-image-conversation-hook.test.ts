import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { useImageConversation } from "../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_hooks/useImageConversation";

async function mount(turns: unknown[] = []) {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost/" });
  const old = new Map<string, PropertyDescriptor | undefined>();
  const input = {
    requestId: "a2899f64-2203-4771-9836-ec6abb8f9bdd",
    message: "Une image bleue",
    references: [],
  };
  dom.window.sessionStorage.setItem(
    "studio-image-pending:owner:project-a",
    JSON.stringify(input),
  );
  const requests: { method: string; body?: string }[] = [];
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
test("reload of a POST never committed exposes recovery and retries the same immutable input", async () => {
  const view = await mount();
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
  const active = await mount([{ ...input, state: "thinking" }]);
  try {
    assert.equal(active.state.canResumePending, false);
  } finally {
    await active.close();
  }
  const failed = await mount([{ ...input, state: "failed" }]);
  try {
    assert.equal(failed.state.canResumePending, true);
    await act(async () => failed.state.discardPending());
    assert.equal(failed.state.pending, null);
  } finally {
    await failed.close();
  }
});
