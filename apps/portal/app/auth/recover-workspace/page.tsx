"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import { withRequestedWithHeader } from "@/lib/request-headers";

const resolveMetadataValue = (meta: unknown, key: string): string | null => {
  if (!meta || typeof meta !== "object") {
    return null;
  }

  const value = (meta as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

export default function RecoverWorkspacePage() {
  const supabase = getSupabaseClient();
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  const redirectToLogin = useCallback(
    async (path: string) => {
      await supabase.auth.signOut().catch(() => undefined);
      if (typeof window !== "undefined") {
        window.location.assign(path);
        return;
      }
      router.replace(path);
    },
    [router, supabase]
  );

  useEffect(() => {
    let cancelled = false;

    const ensureAuthenticatedUser = async () => {
      const { data, error: userError } = await supabase.auth.getUser();

      if (cancelled) {
        return;
      }

      if (userError || !data.user) {
        await redirectToLogin("/login");
        return;
      }

      const user = data.user;
      const organizationId =
        resolveMetadataValue(user.app_metadata, "organization_id") ??
        resolveMetadataValue(user.user_metadata, "organization_id");
      const tenantId =
        resolveMetadataValue(user.app_metadata, "tenant_id") ??
        resolveMetadataValue(user.user_metadata, "tenant_id");

      if (organizationId && tenantId) {
        const organizationResponse = await fetch("/api/organization", {
          method: "GET",
          headers: { "Cache-Control": "no-store" }
        }).catch(() => null);

        if (cancelled) {
          return;
        }

        if (!organizationResponse) {
          setError("Unable to verify your organization. Please try again.");
          setInitializing(false);
          return;
        }

        if (organizationResponse.ok) {
          await redirectToLogin("/login?reason=organization-activated");
          return;
        }

        if (organizationResponse.status === 404 || organizationResponse.status === 400) {
          await supabase.auth.refreshSession().catch(() => undefined);
          await supabase.auth
            .updateUser({
              data: {
                organization_id: null,
                organization_name: null,
                organization_role: null,
                tenant_id: null,
                tenant_name: null,
                tenant_roles: null
              }
            })
            .catch(() => undefined);
          setInitializing(false);
          return;
        }

        if (organizationResponse.status === 401) {
          await redirectToLogin("/login?reason=expired");
          return;
        }

        const detail = await organizationResponse.json().catch(() => null);
        setError(
          typeof detail?.message === "string"
            ? detail.message
            : typeof detail?.error === "string"
              ? detail.error
              : "We ran into an issue while verifying your organization. Please try again."
        );
        setInitializing(false);
        return;
      }

      setInitializing(false);
    };

    void ensureAuthenticatedUser();

    return () => {
      cancelled = true;
    };
  }, [redirectToLogin, supabase]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/onboarding/organization",
        withRequestedWithHeader({
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ name: organizationName, defaultTenantName: organizationName })
        })
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to create organization");
      }

      const payload = (await response.json()) as {
        organization: { id: string; name: string };
        defaultTenant: { id: string; name: string };
      };

      await supabase.auth.updateUser({
        data: {
          organization_id: payload.organization.id,
          organization_name: payload.organization.name,
          tenant_id: payload.defaultTenant.id
        }
      });

      setInitializing(true);

      let ready = false;

      const extractMetaValue = (meta: unknown, key: string): string | undefined => {
        if (typeof meta === "object" && meta !== null && key in meta) {
          const value = (meta as Record<string, unknown>)[key];
          return typeof value === "string" ? value : undefined;
        }
        return undefined;
      };

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.error("Failed to refresh Supabase session", refreshError);
        }

        const { data: refreshedUser, error: refreshedUserError } = await supabase.auth.getUser();
        if (refreshedUserError) {
          console.error("Failed to load authenticated user", refreshedUserError);
          continue;
        }

        const sessionUser = refreshedUser.user;
        const organizationId =
          extractMetaValue(sessionUser?.app_metadata, "organization_id") ??
          extractMetaValue(sessionUser?.user_metadata, "organization_id");
        const tenantId =
          extractMetaValue(sessionUser?.app_metadata, "tenant_id") ??
          extractMetaValue(sessionUser?.user_metadata, "tenant_id");

        if (typeof organizationId === "string" && organizationId && typeof tenantId === "string" && tenantId) {
          const readinessResponse = await fetch("/api/organization", {
            method: "GET",
            headers: { "Cache-Control": "no-store" }
          });

          if (readinessResponse.ok) {
            ready = true;
            break;
          }

          if (readinessResponse.status === 401) {
            break;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }

      if (ready) {
        await redirectToLogin("/login?reason=organization-activated");
        return;
      }

      await redirectToLogin("/login?reason=expired");
    } catch (err) {
      setError((err as Error).message);
      setInitializing(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await redirectToLogin("/login");
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 text-slate-100">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Create a new organization</h1>
        <p className="text-sm text-slate-400">
          We noticed your account no longer has an organization. Define a new one below to get back
          into the portal. We&apos;ll name the default workspace after your organization.
        </p>
      </header>
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-6"
      >
        {initializing ? (
          <p className="text-sm text-slate-400">Checking your session…</p>
        ) : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <label className="block text-sm">
          <span className="text-slate-400">Organization name</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
            placeholder="Reach First Inc"
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            disabled={loading || initializing}
            required
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          disabled={loading || initializing}
        >
          {loading ? "Creating organization..." : "Create organization"}
        </button>
      </form>
      <p className="text-xs text-slate-500">
        Need to switch accounts?{" "}
        <button
          type="button"
          onClick={handleSignOut}
          className="text-fuchsia-300 hover:underline"
        >
          Sign out
        </button>{" "}
        or <Link href="/login" className="text-fuchsia-300 hover:underline">return to login</Link>.
      </p>
    </div>
  );
}
