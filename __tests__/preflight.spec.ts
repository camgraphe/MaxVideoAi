import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

const DUMMY_DATABASE_URL = "postgres://example:example@localhost:5432/example";
const DUMMY_SUPABASE_URL = "https://example.supabase.co";
const DUMMY_SUPABASE_ANON_KEY = "public-anon-key";

function mockInfrastructure() {
  vi.doMock("@/db/client", () => ({
    getDb: () => ({
      execute: vi.fn().mockResolvedValue(undefined),
    }),
  }));

  class MockClient {
    async connect() {}
    async query() {
      return { rows: [{ one: 1 }] };
    }
    async end() {}
  }

  vi.doMock("pg", () => ({ Client: MockClient }));
}

describe("preflight API smoke test", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.CI = "true";
    process.env.DATABASE_URL = DUMMY_DATABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = DUMMY_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = DUMMY_SUPABASE_ANON_KEY;
    mockInfrastructure();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("responds with HTTP 200", async () => {
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({ ok: true });
  });
});
