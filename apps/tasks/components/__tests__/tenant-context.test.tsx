import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantProvider, useTenantContext } from "@/components/tenant-context";

const createContext = (overrides?: {
  activeTenantId?: string;
  activeTenantSource?: string;
  tenants?: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    membersCount: number;
    productsCount: number;
  }>;
  notifications?: Array<{ id: string; type: string; message: string }>;
}) => ({
  user: {
    id: "user-1",
    email: "user@example.com",
    fullName: "User One",
    status: "ACTIVE"
  },
  activeTenant: {
    tenantId: overrides?.activeTenantId ?? "tenant-1",
    tenantName: overrides?.activeTenantId === "tenant-2" ? "Tenant Two" : "Tenant One",
    entitlementId: overrides?.activeTenantId === "tenant-2" ? "ent-2" : "ent-1",
    roles: ["ADMIN"],
    source: overrides?.activeTenantSource ?? "membership"
  },
  tenants:
    overrides?.tenants ??
    [
      {
        id: "tenant-1",
        name: "Tenant One",
        slug: "tenant-one",
        description: null,
        membersCount: 5,
        productsCount: 2
      },
      {
        id: "tenant-2",
        name: "Tenant Two",
        slug: "tenant-two",
        description: null,
        membersCount: 3,
        productsCount: 1
      }
    ],
  notifications: overrides?.notifications ?? []
});

const buildContextResponse = (context: ReturnType<typeof createContext>, init?: ResponseInit) =>
  new Response(JSON.stringify({ context }), {
    status: init?.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

const TestConsumer = () => {
  const { activeTenantId, loading, error, notifications, switchTenant, refresh, context } =
    useTenantContext();
  return (
    <div>
      <span data-testid="loading">{loading ? "true" : "false"}</span>
      <span data-testid="active-tenant">{activeTenantId ?? "none"}</span>
      <span data-testid="error">{error ?? "none"}</span>
      <span data-testid="notification-count">{notifications.length}</span>
      <span data-testid="context-source">{context?.activeTenant?.source ?? "none"}</span>
      <button type="button" onClick={() => switchTenant("tenant-2")}>
        Switch Tenant
      </button>
      <button type="button" onClick={() => refresh()}>
        Refresh
      </button>
    </div>
  );
};

describe("TenantProvider", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const renderProvider = () =>
    render(
      <TenantProvider>
        <TestConsumer />
      </TenantProvider>
    );

  it("loads tenant context on mount", async () => {
    const context = createContext();
    fetchMock.mockResolvedValueOnce(buildContextResponse(context));

    renderProvider();

    expect(screen.getByTestId("loading").textContent).toBe("true");

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/context", {
      headers: { "Cache-Control": "no-store" }
    });
    expect(screen.getByTestId("active-tenant").textContent).toBe("tenant-1");
    expect(screen.getByTestId("notification-count").textContent).toBe("0");
    expect(screen.getByTestId("error").textContent).toBe("none");
  });

  it("switches tenants and reloads context for the selected tenant", async () => {
    const initialContext = createContext();
    const switchedContext = createContext({ activeTenantId: "tenant-2", activeTenantSource: "switch" });

    fetchMock
      .mockResolvedValueOnce(buildContextResponse(initialContext))
      .mockResolvedValueOnce(buildContextResponse(switchedContext));

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("active-tenant").textContent).toBe("tenant-1");
    });

    fireEvent.click(screen.getByText("Switch Tenant"));

    await waitFor(() => {
      expect(screen.getByTestId("active-tenant").textContent).toBe("tenant-2");
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/context?tenantId=tenant-2");
    expect(screen.getByTestId("context-source").textContent).toBe("switch");
  });

  it("formats rate limit errors from the API", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "rate_limit" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "42"
        }
      })
    );

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    expect(screen.getByTestId("error").textContent).toBe(
      "We are throttling tenant context requests. Try again in about 42 seconds."
    );
    expect(screen.getByTestId("active-tenant").textContent).toBe("none");
  });
});
