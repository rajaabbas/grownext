import { beforeEach, describe, expect, it } from "vitest";

const originalEnv = { ...process.env };

describe("env", () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "test",
      APP_VERSION: "0.0.1",
      APP_BASE_URL: "http://localhost:3000",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/postgres",
      REDIS_URL: "redis://localhost:6379"
    };
  });

  it("parses environment variables", async () => {
    const { getEnv, resetEnvCache } = await import("./env.js");
    resetEnvCache();
    const env = getEnv();

    expect(env.NODE_ENV).toBe("test");
    expect(env.REDIS_URL).toBe("redis://localhost:6379");
    expect(env.APP_BASE_URL).toBe("http://localhost:3000");
  });
});
