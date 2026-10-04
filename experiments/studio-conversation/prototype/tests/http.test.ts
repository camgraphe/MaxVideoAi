import test from "node:test";
import assert from "node:assert/strict";
import { acceptsLocalRequest } from "../server/http";
test("loopback gateway rejects malformed and foreign origins without crashing", () => {
  assert.equal(
    acceptsLocalRequest({ headers: { host: "127.0.0.1:4318" } }, 4318),
    true,
  );
  for (const origin of [
    "not a URL",
    "null",
    "https://evil.example",
    "http://localhost:4319",
    "https://localhost:4318",
  ])
    assert.equal(
      acceptsLocalRequest(
        { headers: { host: "127.0.0.1:4318", origin } },
        4318,
      ),
      false,
    );
  assert.equal(
    acceptsLocalRequest({ headers: { host: "evil.example" } }, 4318),
    false,
  );
  assert.equal(
    acceptsLocalRequest(
      { headers: { host: "localhost:4318", origin: "http://localhost:4318" } },
      4318,
    ),
    true,
  );
});
