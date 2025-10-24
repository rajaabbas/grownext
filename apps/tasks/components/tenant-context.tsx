"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type {
  TasksContextResponse,
  TasksTenantSummary,
  TasksUserStatus,
  TasksNotification
} from "@ma/contracts";
import { formatRateLimitMessage } from "@/lib/rate-limit";

interface TenantContextValue {
  context: TasksContextResponse | null;
  loading: boolean;
  error: string | null;
  activeTenantId: string | null;
  tenants: TasksTenantSummary[];
  userStatus: TasksUserStatus;
  isReadOnly: boolean;
  notifications: TasksNotification[];
  switchTenant: (tenantId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

const fetchContextFromApi = async (tenantId?: string): Promise<TasksContextResponse> => {
  const url = tenantId ? `/api/context?tenantId=${encodeURIComponent(tenantId)}` : "/api/context";
  const response = await fetch(url, { headers: { "Cache-Control": "no-store" } });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    if (response.status === 429) {
      throw new Error(formatRateLimitMessage("tenant context", response.headers.get("retry-after")));
    }
    const detail = (payload?.message as string | undefined) ?? (payload?.error as string | undefined) ?? null;
    throw new Error(detail ?? "Failed to load tenant context");
  }
  const json = (await response.json()) as { context: TasksContextResponse };
  return json.context;
};

export const TenantProvider = ({ children }: { children: React.ReactNode }) => {
  const [context, setContext] = useState<TasksContextResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadContext = useCallback(async (tenantId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchContextFromApi(tenantId);
      setContext(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const switchTenant = useCallback(
    async (tenantId: string) => {
      if (!tenantId) return;
      if (tenantId === context?.activeTenant?.tenantId) {
        return;
      }
      await loadContext(tenantId);
    },
    [context?.activeTenant?.tenantId, loadContext]
  );

  const refresh = useCallback(async () => {
    const currentTenant = context?.activeTenant?.tenantId;
    await loadContext(currentTenant);
  }, [context?.activeTenant?.tenantId, loadContext]);

  const value = useMemo<TenantContextValue>(() => {
    const activeTenantId = context?.activeTenant?.tenantId ?? null;
    const userStatus = context?.user.status ?? "ACTIVE";
    const notifications = context?.notifications ?? [];
    return {
      context,
      loading,
      error,
      activeTenantId,
      tenants: context?.tenants ?? [],
      userStatus: userStatus as TasksUserStatus,
      isReadOnly: userStatus !== "ACTIVE",
      notifications,
      switchTenant,
      refresh
    };
  }, [context, error, loading, refresh, switchTenant]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

export const useTenantContext = (): TenantContextValue => {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error("useTenantContext must be used within a TenantProvider");
  }
  return ctx;
};
