import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { JSDOM } from "jsdom";

async function mountComposer(options: {blocked?: boolean; locale?: "en" | "fr"} = {locale: "fr"}) {
  const require = createRequire(import.meta.url);
  const previousCssLoader = require.extensions[".css"];
  require.extensions[".css"] = (module) => {
    module.exports = { composer: "composer", send: "send" };
  };
  const dom = new JSDOM('<div id="root"></div>', {
    url: "http://localhost/app/studio/conversation/project-a",
    pretendToBeVisual: true,
  });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    React,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const previousGlobals = new Map(
    Object.keys(globals).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });

  const root = createRoot(dom.window.document.getElementById("root")!);
  const { ImageConversationComposer } = await import(
    "../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/ImageConversationComposer.client"
  );
  let sends = 0;
  let libraryOpens = 0;
  let libraryTrigger!: React.RefObject<HTMLButtonElement>;
  function Harness() {
    const [text, setText] = React.useState("");
    libraryTrigger = React.useRef<HTMLButtonElement>(null);
    return React.createElement(ImageConversationComposer, {
      text,
      onTextChange: setText,
      onSend: () => sends++,
      blocked: options.blocked ?? false,
      locale: options.locale,
      onOpenLibrary: () => libraryOpens++,
      libraryTrigger,
    });
  }

  await act(async () => root.render(React.createElement(Harness)));
  return {
    dom,
    get sends() {
      return sends;
    },
    get libraryOpens() {
      return libraryOpens;
    },
    get libraryTrigger() {
      return libraryTrigger.current;
    },
    textarea: dom.window.document.querySelector("textarea")!,
    async changeText(value: string) {
      const textarea = dom.window.document.querySelector("textarea")!;
      const setter = Object.getOwnPropertyDescriptor(
        dom.window.HTMLTextAreaElement.prototype,
        "value",
      )!.set!;
      await act(async () => {
        setter.call(textarea, value);
        Simulate.change(textarea);
      });
    },
    async close() {
      await act(async () => root.unmount());
      dom.window.close();
      for (const [key, descriptor] of previousGlobals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
      if (previousCssLoader) require.extensions[".css"] = previousCssLoader;
      else delete require.extensions[".css"];
    },
  };
}

test("composer sends on Enter, preserves Shift+Enter and IME composition, and opens the library", async () => {
  const view = await mountComposer();
  try {
    const textarea = view.textarea;
    const library = view.dom.window.document.querySelector<HTMLButtonElement>(
      '[aria-label="Ouvrir la bibliothèque"]',
    )!;
    const send = view.dom.window.document.querySelector<HTMLButtonElement>(
      '[aria-label="Envoyer à Studio"]',
    )!;
    assert.equal(textarea.getAttribute("aria-label"), "Message à Studio");
    assert.equal(textarea.placeholder, "Décrivez votre idée…");
    assert.equal(textarea.maxLength, 4000);
    assert.equal(send.disabled, true);
    assert.equal(view.libraryTrigger, library);

    await view.changeText("Une image au crépuscule");
    Object.assign(textarea, { attachEvent() {}, detachEvent() {} });
    textarea.focus();
    assert.equal(send.disabled, false);
    const enter = new view.dom.window.KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    await act(async () => textarea.dispatchEvent(enter));
    assert.equal(view.sends, 1);
    assert.equal(enter.defaultPrevented, true);

    const newline = new view.dom.window.KeyboardEvent("keydown", {
      key: "Enter",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => textarea.dispatchEvent(newline));
    assert.equal(view.sends, 1);
    assert.equal(newline.defaultPrevented, false);

    const composing = new view.dom.window.KeyboardEvent("keydown", {
      key: "Enter",
      isComposing: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => textarea.dispatchEvent(composing));
    assert.equal(view.sends, 1);
    assert.equal(composing.defaultPrevented, false);

    await act(async () => send.click());
    assert.equal(view.sends, 2);
    await act(async () => library.click());
    assert.equal(view.libraryOpens, 1);
  } finally {
    await view.close();
  }
});

test("composer grows with content, remeasures on viewport resize, and shrinks when cleared", async () => {
  const view = await mountComposer();
  try {
    const textarea = view.textarea;
    let measuredHeight = 72;
    Object.defineProperty(textarea, "scrollHeight", {
      configurable: true,
      get: () => measuredHeight,
    });
    assert.equal(textarea.style.height, "45px");

    measuredHeight = 112;
    await view.changeText("Une phrase assez longue pour grandir");
    assert.equal(textarea.style.height, "112px");

    measuredHeight = 148;
    view.dom.window.innerWidth = 390;
    view.dom.window.innerHeight = 568;
    await act(async () => view.dom.window.dispatchEvent(new view.dom.window.Event("resize")));
    assert.equal(textarea.style.height, "124.96px");

    measuredHeight = 45;
    await view.changeText("");
    assert.equal(textarea.style.height, "45px");
  } finally {
    await view.close();
  }
});


test("composer prevents keyboard and form submissions while busy or blank, and defaults to English", async () => {
  const view = await mountComposer({blocked: true});
  try {
    assert.equal(view.textarea.getAttribute("aria-label"), "Message Studio");
    await view.changeText("Keep this draft while the current work finishes");
    const event = new view.dom.window.KeyboardEvent("keydown", {key:"Enter",bubbles:true,cancelable:true});
    await act(async () => view.textarea.dispatchEvent(event));
    await act(async () => view.dom.window.document.querySelector("form")!.dispatchEvent(new view.dom.window.Event("submit",{bubbles:true,cancelable:true})));
    assert.equal(view.sends,0);
    assert.equal(view.textarea.value,"Keep this draft while the current work finishes");
    assert.equal(view.textarea.disabled,false);
  } finally { await view.close(); }
  const empty = await mountComposer({});
  try {
    await act(async () => empty.dom.window.document.querySelector("form")!.dispatchEvent(new empty.dom.window.Event("submit",{bubbles:true,cancelable:true})));
    assert.equal(empty.sends,0);
  } finally {await empty.close();}
});
