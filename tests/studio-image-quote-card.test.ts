import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import type { ImageConversationTurn } from "../frontend/src/lib/studio/image-conversation-contract";

function buttonMatching(
  doc: Document,
  pattern: RegExp,
): HTMLButtonElement | null {
  return (
    [...doc.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
      pattern.test(button.textContent ?? ""),
    ) ?? null
  );
}

const quote = {
  quoteId: "quote-1",
  state: "prepared" as const,
  expiresAt: "2099-01-01T00:00:00.000Z",
  requestHash: "request-hash",
  summary: {
    prompt: "Un paysage au crépuscule",
    model: "gpt-image-1",
    settings: {
      aspectRatio: "1:1",
      resolution: "1024x1024",
      outputFormat: "png",
    },
    references: [],
    outputCount: 1,
  },
  price: { amountCents: 600, currency: "USD" },
  balance: { beforeCents: 2_500, afterCents: 1_900 },
  fundingMode: "wallet" as const,
  confirmationRequired: true as const,
  topupRequired: false,
  modelLabel: "GPT Image",
  wallet: { amountCents: 2_500, currency: "USD" },
};

function makeTurn(
  overrides: Partial<NonNullable<ImageConversationTurn["quote"]>> = {},
): ImageConversationTurn {
  return {
    requestId: "request-1",
    message: "Une image au crépuscule",
    references: [],
    reply: "Voici une proposition.",
    state: "ready",
    retryable: false,
    quote: { ...quote, ...overrides },
    generation: null,
    createdAt: "2026-10-01T12:00:00.000Z",
  };
}

async function mountCard({
  turn = makeTurn(),
  localQa = false,
  busy = false,
}: {
  turn?: ImageConversationTurn;
  localQa?: boolean;
  busy?: boolean;
} = {}) {
  const require = createRequire(import.meta.url);
  const previousCssLoader = require.extensions[".css"];
  require.extensions[".css"] = (module) => {
    module.exports = {
      quote: "quote",
      quoteTop: "quoteTop",
      muted: "muted",
      primary: "primary",
    };
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
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }

  const root = createRoot(dom.window.document.getElementById("root")!);
  const { ImageQuoteCard } = await import(
    "../frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/_components/ImageQuoteCard.client"
  );
  let confirms = 0;
  let renewals = 0;
  let refreshes = 0;
  await act(async () =>
    root.render(
      React.createElement(ImageQuoteCard, {
        turn,
        busy,
        localQa,
        onConfirm: () => confirms++,
        onRenew: () => renewals++,
        onRefresh: () => refreshes++,
      }),
    ),
  );

  return {
    dom,
    get confirms() {
      return confirms;
    },
    get renewals() {
      return renewals;
    },
    get refreshes() {
      return refreshes;
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

test("a sufficient wallet shows an explicit create action", async () => {
  const view = await mountCard();
  try {
    const create = buttonMatching(view.dom.window.document, /Créer l’image/i);
    assert.ok(create, "the quote should expose an explicit create action");
    assert.match(create.textContent ?? "", /Créer l’image/i);
    await act(async () => create.click());
    assert.equal(view.confirms, 1);
  } finally {
    await view.close();
  }
});

test("an insufficient wallet offers the native billing page and refreshes this quote", async () => {
  const view = await mountCard({
    turn: makeTurn({ wallet: { amountCents: 599, currency: "USD" } }),
  });
  try {
    const doc = view.dom.window.document;
    assert.equal(buttonMatching(doc, /Créer l’image/i), null);
    assert.equal(doc.querySelector("a[href='/billing']")?.getAttribute("href"), "/billing");
    const refresh = buttonMatching(doc, /Actualiser/i);
    assert.ok(refresh, "an insufficient balance should allow refreshing the same quote");
    await act(async () => refresh.click());
    assert.equal(view.refreshes, 1);
    assert.equal(view.confirms, 0);
  } finally {
    await view.close();
  }
});

test("an unknown wallet blocks creation and still allows refreshing the quote", async () => {
  const view = await mountCard({ turn: makeTurn({ wallet: null }) });
  try {
    const doc = view.dom.window.document;
    assert.equal(buttonMatching(doc, /Créer l’image/i), null);
    const refresh = buttonMatching(doc, /Actualiser/i);
    assert.ok(refresh, "an unavailable wallet should allow refreshing the quote");
    await act(async () => refresh.click());
    assert.equal(view.refreshes, 1);
    assert.equal(view.confirms, 0);
  } finally {
    await view.close();
  }
});

test("an expired quote can be renewed", async () => {
  const view = await mountCard({ turn: makeTurn({ state: "expired" }) });
  try {
    const renew = buttonMatching(view.dom.window.document, /Redemander un devis/i);
    assert.ok(renew);
    await act(async () => renew.click());
    assert.equal(view.renewals, 1);
    assert.equal(view.confirms, 0);
  } finally {
    await view.close();
  }
});

test("local QA identifies its test balance and links separately to the real wallet", async () => {
  const view = await mountCard({
    localQa: true,
    turn: makeTurn({ wallet: { amountCents: 599, currency: "USD" } }),
  });
  try {
    const doc = view.dom.window.document;
    const text = doc.body.textContent ?? "";
    assert.match(text, /QA local|solde de test|wallet de test/i);
    assert.match(text, /solde.*test|test.*solde/i);
    const realWallet = doc.querySelector<HTMLAnchorElement>(
      'a[href="https://maxvideoai.com/billing"]',
    );
    assert.ok(realWallet, "local QA should link to the real account wallet");
    assert.match(realWallet.textContent ?? "", /vrai wallet|wallet réel|compte réel/i);
    assert.match(text, /recharge du compte réel n’alimente pas ce test/i);
  } finally {
    await view.close();
  }
});

test("local QA with sufficient test funds labels the balance without implying a top-up", async () => {
  const view = await mountCard({ localQa: true });
  try {
    const doc = view.dom.window.document;
    assert.match(doc.body.textContent ?? "", /Solde de test/i);
    assert.equal(
      doc.querySelector('a[href="https://maxvideoai.com/billing"]'),
      null,
      "a real-wallet top-up link is only relevant when test funds are insufficient",
    );
    assert.doesNotMatch(doc.body.textContent ?? "", /recharger|recharge/i);
  } finally {
    await view.close();
  }
});
