import { vi } from "vitest";

process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "service";
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "anon";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/postgres";
process.env.TASKS_DATABASE_URL =
  process.env.TASKS_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/tasks";
process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
process.env.APP_VERSION = process.env.APP_VERSION ?? "0.0.1-test";

vi.mock("@/queues/demo-queue", () => {
  const demoQueue = {
    add: vi.fn(),
    close: vi.fn()
  };

  return {
    demoQueue,
    closeDemoQueue: vi.fn()
  };
});
