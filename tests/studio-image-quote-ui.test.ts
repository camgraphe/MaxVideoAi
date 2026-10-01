import assert from "node:assert/strict";
import test from "node:test";
import {
  canConfirmImageQuote,
  imageConfirmationPayload,
  acceptsImageConversationResponse,
} from "../frontend/src/lib/studio/image-quote-ui";
test("only a current prepared quote enables the explicit human confirmation", () => {
  const quote = {
    quoteId: "quoted",
    state: "prepared",
    expiresAt: "2026-10-01T12:45:00Z",
    price: { amountCents: 6, currency: "USD" },
    wallet: { amountCents: 25, currency: "USD" },
  };
  assert.equal(
    canConfirmImageQuote(
      quote as never,
      Date.parse("2026-10-01T12:30:00Z"),
      false,
    ),
    true,
  );
  assert.equal(
    canConfirmImageQuote(
      quote as never,
      Date.parse("2026-10-01T12:46:00Z"),
      false,
    ),
    false,
  );
  assert.equal(
    canConfirmImageQuote({ ...quote, state: "claimed" } as never, 0, false),
    false,
  );
  assert.equal(canConfirmImageQuote(quote as never, 0, true), false);
  assert.deepEqual(imageConfirmationPayload("request", "quoted"), {
    requestId: "request",
    quoteId: "quoted",
    confirmed: true,
  });
});
test("confirmation waits for a known wallet in the quote currency with enough funds", () => {
  const quote = {
    quoteId: "quoted",
    state: "prepared",
    expiresAt: "2026-10-01T12:45:00Z",
    price: { amountCents: 6, currency: "USD" },
  };
  for (const wallet of [
    null,
    { amountCents: 0, currency: "USD" },
    { amountCents: 5, currency: "USD" },
    { amountCents: 100, currency: "EUR" },
    { amountCents: -1, currency: "USD" },
    { amountCents: NaN, currency: "USD" },
  ]) {
    assert.equal(canConfirmImageQuote({ ...quote, wallet } as never, 0, false), false);
  }
  assert.equal(
    canConfirmImageQuote({ ...quote, wallet: { amountCents: 6, currency: "USD" } } as never, 0, false),
    true,
  );
});
test("late conversation responses cannot populate a different project/account lifetime", () => {
  assert.equal(
    acceptsImageConversationResponse("owner:a", "owner:b", "b", "a"),
    false,
  );
  assert.equal(
    acceptsImageConversationResponse("owner:a", "foreign:a", "a", "a"),
    false,
  );
  assert.equal(
    acceptsImageConversationResponse("owner:a", "owner:a", "a", "a"),
    true,
  );
});
