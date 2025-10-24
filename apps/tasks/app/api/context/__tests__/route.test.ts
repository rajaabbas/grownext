import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";
import { IdentityHttpError } from "@ma/identity-client";

const fetchTasksContextMock = vi.hoisted(() => vi.fn());
const IdentityHttpErrorMock = vi.hoisted(
  () =>
    class IdentityHttpError extends Error {
      readonly status: number;
      readonly code?: string;
      readonly retryAfter?: number;

      constructor(
        message: string,
        options: { status: number; code?: string; retryAfter?: number }
      ) {
        super(message);
        this.name = "IdentityHttpError";
        this.status = options.status;
        this.code = options.code;
        this.retryAfter = options.retryAfter;
      }
    }
);

vi.mock("@ma/identity-client", () => ({
  fetchTasksContext: fetchTasksContextMock,
  IdentityHttpError: IdentityHttpErrorMock
}));

const getSupabaseSessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseRouteHandlerClient: () => ({
    auth: {
      getSession: getSupabaseSessionMock
    }
  })
}));

describe("GET /api/context", () => {
  const sampleContext = {
    user: {
      id: "user-1",
      email: "user@example.com",
      fullName: "User One",
      status: "ACTIVE"
    },
    activeTenant: {
      tenantId: "tenant-1",
      tenantName: "Tenant One",
      entitlementId: "ent-1",
      roles: ["ADMIN"],
      source: "membership"
    },
    tenants: [],
    notifications: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseSessionMock.mockResolvedValue({
      data: { session: { access_token: "access-token-1" } }
    });
    fetchTasksContextMock.mockResolvedValue(sampleContext);
  });

  const buildRequest = (url: string, init?: RequestInit) => new Request(url, init);

  it("returns 401 when session is missing", async () => {
    getSupabaseSessionMock.mockResolvedValue({ data: { session: null } });

    const response = await GET(buildRequest("http://localhost/api/context"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(fetchTasksContextMock).not.toHaveBeenCalled();
  });

  it("returns 401 when access token is absent", async () => {
    getSupabaseSessionMock.mockResolvedValue({
      data: { session: { access_token: null } }
    });

    const response = await GET(buildRequest("http://localhost/api/context"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(fetchTasksContextMock).not.toHaveBeenCalled();
  });

  it("fetches context for authenticated requests", async () => {
    const response = await GET(buildRequest("http://localhost/api/context?tenantId=tenant-1"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetchTasksContextMock).toHaveBeenCalledWith("access-token-1", {
      productSlug: "tasks",
      tenantId: "tenant-1"
    });
    expect(await response.json()).toEqual({ context: sampleContext });
  });

  it("prefers tenant id from headers over query parameters", async () => {
    const response = await GET(
      buildRequest("http://localhost/api/context?tenantId=query-tenant", {
        headers: {
          "x-tenant-id": "header-tenant"
        }
      })
    );

    expect(response.status).toBe(200);
    expect(fetchTasksContextMock).toHaveBeenCalledWith("access-token-1", {
      productSlug: "tasks",
      tenantId: "header-tenant"
    });
  });

  it("maps identity errors using the shared helper", async () => {
    const error = new IdentityHttpError("rate limited", { status: 429, code: "rate_limit", retryAfter: 30 });
    fetchTasksContextMock.mockRejectedValue(error);

    const response = await GET(buildRequest("http://localhost/api/context"));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(await response.json()).toEqual({ error: "rate_limit", message: "rate limited" });
  });

  it("returns 400 when context fetching fails", async () => {
    fetchTasksContextMock.mockRejectedValue(new Error("unexpected failure"));

    const response = await GET(buildRequest("http://localhost/api/context"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "unexpected failure" });
  });
});
