import { afterAll, describe, expect, it } from "vitest";
import { buildServer } from "./server";

process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.APP_VERSION = process.env.APP_VERSION ?? "0.0.1-test";
process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "service-role-key";
process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "anon-key";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://user:pass@localhost:5432/postgres";
process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

describe("API server", () => {
  const server = buildServer();

  afterAll(async () => {
    await server.close();
  });

  it("returns health status", async () => {
    const response = await server.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.status).toBe("ok");
  });

  it("returns version", async () => {
    const response = await server.inject({ method: "GET", url: "/version" });
    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.version).toBe(process.env.APP_VERSION);
  });
});
