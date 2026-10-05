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

const quote: NonNullable<ImageConversationTurn["quote"]> = {
  quoteId: "quote-1",
  state: "prepared" as const,
  expiresAt: "2099-01-01T00:00:00.000Z",
  requestHash: "request-hash",
  summary: {
    schemaVersion: 1,
    surface: "image",
    engineId: "gpt-image-1",
    mode: "t2i",
    prompt: "Un paysage au crépuscule",
    settings: {
      aspectRatio: "1:1",
      resolution: "1024x1024",
      outputFormat: "png",
    },
    references: [],
    outputCount: 1,
  },
  price: { amountCents: 600, currency: "USD" },
  fundingMode: "wallet" as const,
  confirmationRequired: true as const,
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
  locale = "fr",
}: {
  turn?: ImageConversationTurn;
  localQa?: boolean;
  busy?: boolean;
  locale?: "en" | "fr";
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
        locale,
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

test("a failed accepted attempt displays its confirmed wallet refund without reusing the quote", async () => {
  const turn = makeTurn({ state: "accepted" });
  turn.generation = {
    jobId: "failed-job", surface: "video", status: "failed", progress: null,
    message: "https://provider.invalid/private-input?secret=hidden",
    priceCents: 600, currency: "USD", paymentStatus: "refunded_wallet",
    result: null, retryAfterSeconds: null,
  };
  const view = await mountCard({ turn, locale: "en", busy: true });
  try {
    const doc = view.dom.window.document;
    assert.match(doc.body.textContent ?? "", /Creation failed/);
    assert.match(doc.body.textContent ?? "", /refunded to your wallet/);
    assert.match(doc.body.textContent ?? "", /new quote/);
    assert.doesNotMatch(doc.body.textContent ?? "", /provider\.invalid|secret=hidden/);
    assert.equal(buttonMatching(doc, /Create|Renew|Retry/i), null);
    assert.equal(view.confirms, 0);
    assert.equal(view.renewals, 0);
  } finally { await view.close(); }
});

test("a completed creation stays ready while Studio answers another message", async () => {
  const turn = makeTurn({ state: "accepted" });
  turn.generation = {
    jobId: "completed-job", surface: "image", status: "completed", progress: 100,
    message: null, priceCents: 600, currency: "USD", paymentStatus: "paid",
    result: null, retryAfterSeconds: null,
  };
  const view = await mountCard({ turn, locale: "en", busy: true });
  try {
    const text = view.dom.window.document.body.textContent ?? "";
    assert.match(text, /Creation ready/);
    assert.doesNotMatch(text, /Studio is working/);
    assert.equal(buttonMatching(view.dom.window.document, /Create|Renew|Retry/i), null);
  } finally { await view.close(); }
});

test("a reference selected by Studio shows its exact role from the canonical quote", async () => {
  const view = await mountCard({
    locale: "en",
    turn: makeTurn({ summary: { ...quote.summary, references: [
      { kind: "asset", assetId: "ma_0123456789abcdef0123456789abcdef", role: "first_frame" },
    ] } }),
  });
  try {
    const text = view.dom.window.document.body.textContent ?? "";
    assert.match(text, /start frame/);
    assert.doesNotMatch(text, /Original creation/);
  } finally { await view.close(); }
});

test("an inherited video duration displays the priced receipt instead of the request placeholder", async () => {
  const view = await mountCard({
    locale: "en",
    turn: makeTurn({ outputDurationSec: 7.75, summary: {
      schemaVersion: 1, surface: "video", engineId: "gemini-omni-flash", mode: "v2v",
      prompt: "Keep the watch movement and change only the lighting.",
      settings: { durationSec: 3, resolution: "720p", aspectRatio: "16:9", audio: false },
      references: [{ kind: "asset", assetId: "ma_0123456789abcdef0123456789abcdef", role: "source" }],
      outputCount: 1,
    } }),
  });
  try {
    const text = view.dom.window.document.body.textContent ?? "";
    assert.match(text, /7\.75 s/);
    assert.doesNotMatch(text, /\b3 s\b/);
    assert.match(text, /source clip/);
    assert.equal(view.confirms, 0);
  } finally { await view.close(); }
});

test("a failed attempt with an unknown payment status does not promise a refund", async () => {
  const turn = makeTurn({ state: "accepted" });
  turn.generation = {
    jobId: "failed-job", surface: "video", status: "failed", progress: null,
    message: null, priceCents: 600, currency: "USD", paymentStatus: null,
    result: null, retryAfterSeconds: null,
  };
  const view = await mountCard({ turn, locale: "en" });
  try {
    const text = view.dom.window.document.body.textContent ?? "";
    assert.match(text, /Creation failed/);
    assert.doesNotMatch(text, /refunded/);
  } finally { await view.close(); }
});

test("confirmed wallet refunds have French copy", async () => {
  const turn = makeTurn({ state: "accepted" });
  turn.generation = {
    jobId: "failed-job", surface: "image", status: "failed", progress: null,
    message: null, priceCents: 600, currency: "USD", paymentStatus: "refunded_wallet",
    result: null, retryAfterSeconds: null,
  };
  const view = await mountCard({ turn, locale: "fr" });
  try {
    const text = view.dom.window.document.body.textContent ?? "";
    assert.match(text, /remboursé sur votre wallet/);
    assert.match(text, /nouveau devis/);
  } finally { await view.close(); }
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
