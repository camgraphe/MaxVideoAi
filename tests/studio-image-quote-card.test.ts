import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import type { ImageConversationTurn } from "../frontend/src/lib/studio/image-conversation-contract";
import {mapGenerationStatusRecordToAgent} from '../frontend/src/server/generations/agent-generation-policy';
import type {GenerationStatusRecord} from '../frontend/src/server/generations/generation-status';

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
  locale?: "en" | "fr" | "es";
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

const googleFailure = 'Google blocked this request during safety checks. Review the prompt and reference media before preparing a new request.';
function failedTurn(message = googleFailure, paymentStatus: NonNullable<ImageConversationTurn['generation']>['paymentStatus'] = 'refunded_wallet') {
  const turn = makeTurn({ state: 'accepted' });
  turn.generation = {
    jobId: 'fixture-failed-job', surface: 'video', status: 'failed', progress: null,
    message, priceCents: 45, currency: 'USD', paymentStatus,
    result: null, retryAfterSeconds: null,
  };
  return turn;
}

for (const [locale, label, meaning, examples, uncertainty] of [
  ['en', 'Safety check: what to review', /words.*meaning.*context.*reference images/i, /explicit sexual.*graphic violence.*hate.*minors/i, /does not always identify.*may still be refused/i],
  ['fr', 'Contrôle de sécurité : que vérifier ?', /mots.*sens.*contexte.*images/i, /sexuel explicite.*violence graphique.*haine.*mineurs/i, /ne précise pas forcément.*peut encore entraîner un refus/i],
  ['es', 'Control de seguridad: ¿qué revisar?', /palabras.*significado.*contexto.*imágenes/i, /sexual explícito.*violencia gráfica.*odio.*menores/i, /no siempre identifica.*puede seguir provocando un rechazo/i],
] as const) {
  test(`Google moderation help explains content checks without guessing the trigger (${locale})`, async () => {
    const view = await mountCard({ turn: failedTurn(), locale });
    try {
      const help = [...view.dom.window.document.querySelectorAll('details')].find(details => details.querySelector('summary')?.textContent === label);
      assert.ok(help, 'a click/tap disclosure accompanies the Google refusal');
      assert.equal(help.open, false, 'long help stays collapsed initially');
      assert.match(help.textContent ?? '', meaning);
      assert.match(help.textContent ?? '', examples);
      assert.match(help.textContent ?? '', uncertainty);
      const policy = help.querySelector('a');
      assert.equal(new URL(policy?.href ?? '').hostname, 'policies.google.com');
      assert.doesNotMatch(help.textContent ?? '', /fixture-failed-job|sensitive words|refund|rembours|reembols/i);
      assert.equal(view.confirms + view.renewals + view.refreshes, 0);
    } finally { await view.close(); }
  });
}

test('unknown, technical and other-provider failures never acquire Google moderation guidance', async () => {
  for (const message of [
    'MaxVideoAI could not complete this render.',
    'This request was blocked by safety checks.',
    'The reference image is too small.',
    '{"message":"Google blocked this request during safety checks."}',
    'https://provider.invalid/Google blocked this request during safety checks.',
  ]) {
    const view = await mountCard({ turn: failedTurn(message), locale: 'en' });
    try { assert.equal(view.dom.window.document.querySelector('[data-safety-guidance]'), null); }
    finally { await view.close(); }
  }
});

for (const [locale, moderation, revise, nextQuote, refunded] of [
  ['en', /Google.*safety checks/, /Review the prompt/, /new quote/, /refunded to your wallet/],
  ['fr', /Google.*modération/, /Vérifiez le prompt/, /nouveau devis/, /remboursé sur votre wallet/],
  ['es', /Google.*moderación/, /Revisa el prompt/, /nuevo presupuesto/, /reembolsado.*monedero/],
] as const) {
  test(`a failed creation retains the available moderation explanation after reopening (${locale})`, async () => {
    const stored = JSON.stringify(failedTurn());
    for (let opening = 0; opening < 2; opening++) {
      const view = await mountCard({ turn: JSON.parse(stored), locale, busy: true });
      try {
        const status = view.dom.window.document.querySelector('[role="status"]');
        assert.ok(status, 'the terminal explanation must be announced');
        const text = status.textContent ?? '';
        assert.match(text, moderation);
        assert.match(text, revise);
        assert.match(text, nextQuote);
        assert.match(text, refunded);
        assert.doesNotMatch(text, /sensitive words|Responsible AI|fixture-failed-job|started|working|commencé|trabajando/i);
        assert.equal(buttonMatching(view.dom.window.document, /Create|Renew|Retry|Créer|Redemander|Crear|Renovar/i), null);
      } finally { await view.close(); }
    }
  });
  test(`a refusal does not infer a wallet refund from its text (${locale})`, async () => {
    for (const paymentStatus of ['paid_wallet', 'refunded', 'included_mcp_trial', null] as const) {
      const view = await mountCard({ turn: failedTurn(googleFailure + ' Your payment was refunded to your wallet.', paymentStatus), locale });
      try {
        const text = view.dom.window.document.body.textContent ?? '';
        assert.match(text, moderation);
        assert.match(text, nextQuote);
        assert.doesNotMatch(text, refunded);
      } finally { await view.close(); }
    }
  });
}

test('a terminal failure takes priority over a stale prepared or expired quote', async () => {
  for (const state of ['prepared', 'expired'] as const) {
    const turn = failedTurn();
    turn.quote = { ...turn.quote!, state };
    const view = await mountCard({ turn, locale: 'en' });
    try {
      assert.match(view.dom.window.document.querySelector('[role="status"]')?.textContent ?? '', /Google.*safety/);
      assert.equal(buttonMatching(view.dom.window.document, /Create|Renew|Retry/i), null);
      assert.equal(view.confirms, 0);
      assert.equal(view.renewals, 0);
    } finally { await view.close(); }
  }
});

test('an unavailable historical reason remains explicit and never becomes a moderation claim', async () => {
  for (const message of ['MaxVideoAI could not complete this render.', 'https://provider.invalid/private-input?secret=hidden', '{"message":"moderation","prompt":"PRIVATE_FIXTURE"}']) {
    const view = await mountCard({ turn: failedTurn(message), locale: 'en' });
    try {
      const text = view.dom.window.document.querySelector('[role="status"]')?.textContent ?? '';
      assert.match(text, /Creation failed/);
      assert.match(text, /precise reason.*not available/i);
      assert.match(text, /Review.*request/);
      assert.match(text, /new quote/);
      assert.doesNotMatch(text, /Google|moderation|safety|provider\.invalid|secret|PRIVATE_FIXTURE/);
    } finally { await view.close(); }
  }
});

test('other known reference failures keep their actionable public explanation', async () => {
  const view = await mountCard({ turn: failedTurn('The reference image is too small. Use an image with each side at least 256 pixels before trying again.'), locale: 'fr' });
  try {
    const text = view.dom.window.document.querySelector('[role="status"]')?.textContent ?? '';
    assert.match(text, /image.*trop petite/);
    assert.match(text, /256/);
    assert.match(text, /nouveau devis/);
    assert.doesNotMatch(text, /Google|modération|safety/);
  } finally { await view.close(); }
});

test('a recognized persisted failure code remains useful when its message is unavailable', async () => {
  const turn = failedTurn();
  turn.generation = { ...turn.generation!, message: null, failureCode: 'seedance_output_copyright_restricted' };
  const view = await mountCard({ turn, locale: 'en' });
  try {
    const text = view.dom.window.document.querySelector('[role="status"]')?.textContent ?? '';
    assert.match(text, /copyright/i);
    assert.doesNotMatch(text, /precise reason.*not available/i);
  } finally { await view.close(); }
});

test('the Spanish creation card retains Spanish labels around its failure explanation', async () => {
  const view = await mountCard({ turn: failedTurn(), locale: 'es' });
  try {
    const doc = view.dom.window.document;
    assert.ok(doc.querySelector('[aria-label="Presupuesto de creación"]'));
    assert.match(doc.querySelector('summary')?.textContent ?? '', /Ver.*ajustes/);
    assert.doesNotMatch(doc.body.textContent ?? '', /Creation quote|View direction|Original creation/);
  } finally { await view.close(); }
});

for(const [locale,expected] of [
  ['en',[/selected inputs/,/could not read.*reference media/,/processing window/,/queue.*busy/,/prepare.*download/,/without a usable output/,/manual review/]],
  ['fr',[/entrées sélectionnées/,/média.*référence.*lu/,/délai.*traitement/,/file.*saturée/,/préparer.*téléchargement/,/sans résultat exploitable/,/vérification manuelle/]],
  ['es',[/entradas seleccionadas/,/leer.*referencia/,/plazo.*procesamiento/,/cola.*saturada/,/preparar.*descarga/,/sin.*resultado utilizable/,/revisión manual/]],
] as const){
  test(`available public journal reasons reach the actual card (${locale})`,async()=>{
    const inputs=['Unsupported input setting.','Reference media could not be read.','The request timed out.','The queue is temporarily busy.','The output video could not be copied to storage.','The render returned no usable output.','This render needs manual review.'];
    for(let index=0;index<inputs.length;index++){
      const generation=mapGenerationStatusRecordToAgent({
        id:1,job_id:'fixture-known-failure',user_id:'fixture-user',status:index===6?'provider_polling_stalled':'failed',
        progress:0,provider:'fixture',provider_job_id:null,surface:'video',engine_id:'gemini-omni-flash',
        engine_label:'Gemini Omni Flash 1.1',duration_sec:10,prompt:'Safe fixture request.',created_at:'2026-10-26T00:00:00Z',
        message:inputs[index],payment_status:'paid_wallet',final_price_cents:45,currency:'USD',settings_snapshot:{surface:'video'},render_ids:[],pricing_snapshot:null,
      } as GenerationStatusRecord);
      const turn=failedTurn();turn.generation=generation;
      const view=await mountCard({turn,locale});
      try{
        const text=view.dom.window.document.querySelector('[role="status"]')?.textContent??'';
        assert.match(text,expected[index]);
        assert.doesNotMatch(text,/precise reason.*not available|motif précis.*pas disponible|motivo preciso.*no está disponible|Google|modération|moderación|safety/);
      }finally{await view.close();}
    }
  });
}

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
    assert.doesNotMatch(text, /Milo is working/);
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

for (const mode of ['v2v', 'extend'] as const) for (const locale of ['fr', 'en'] as const) {
  test(`Seedance ${mode} quote shows a localized advisory without blocking confirmation (${locale})`, async () => {
    const turn = makeTurn({ modelLabel: 'Seedance 2.5', summary: {
      ...quote.summary, surface: 'video', engineId: 'seedance-2-5', mode,
      settings: { durationSec: 6, resolution: '720p', aspectRatio: '9:16' },
    } });
    const view = await mountCard({ turn, locale });
    try {
      const doc = view.dom.window.document;
      assert.match(doc.querySelector('[role="note"]')?.textContent ?? '',
        locale === 'fr' ? /personne reconnaissable/ : /recognizable person/);
      const create = buttonMatching(doc, /Créer la vidéo|Create video|Prolonger le clip|Extend clip/i);
      assert.ok(create);
      assert.equal(create.disabled, false);
      await act(async () => create.click());
      assert.equal(view.confirms, 1);
    } finally { await view.close(); }
  });
}
