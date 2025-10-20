"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTenantContext } from "@/components/tenant-context";
import { getSupabaseClient } from "@/lib/supabase/client";


const deriveInitials = (name?: string | null, email?: string | null) => {
  if (name) {
    const parts = name
      .split(/\s+/)
      .filter((part) => part.length > 0)
      .slice(0, 2);
    if (parts.length > 0) {
      return parts.map((part) => part[0]!.toUpperCase()).join("");
    }
  }
  if (email) {
    return email[0]?.toUpperCase() ?? "U";
  }
  return "U";
};

const navigation: Array<{ name: string; href: string; dividerAfter?: boolean }> = [
  { name: "My Tasks", href: "/my-tasks", dividerAfter: true },
  { name: "Projects", href: "/projects" },
  { name: "Tasks", href: "/" },
  { name: "Settings", href: "/settings" }
];

const isActivePath = (pathname: string, target: string) => {
  if (target === "/") {
    return pathname === "/";
  }
  return pathname === target || pathname.startsWith(`${target}/`);
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { tenants, activeTenantId, loading: tenantLoading, switchTenant, context, error: tenantError } =
    useTenantContext();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) return;
      setMenuOpen(false);
    };

    if (menuOpen) {
      document.addEventListener("mousedown", handleClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const sidebarLinks = useMemo(
    () =>
      navigation.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <div key={item.href} className="flex flex-col gap-1">
            <Link
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-fuchsia-600/20 text-fuchsia-200 ring-1 ring-inset ring-fuchsia-500/60"
                  : "text-slate-300 hover:bg-slate-800/70 hover:text-fuchsia-100"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {item.name}
            </Link>
            {item.dividerAfter ? <div className="my-2 border-b border-slate-800" /> : null}
          </div>
        );
      }),
    [pathname]
  );

  const userInitials = useMemo(
    () => deriveInitials(context?.user?.fullName, context?.user?.email ?? context?.user?.id),
    [context?.user?.email, context?.user?.fullName, context?.user?.id]
  );

  const handleLogout = useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      setMenuOpen(false);
      router.replace("/");
      router.refresh();
    } catch (error) {
      console.error("Failed to sign out", error);
      setLogoutError((error as Error).message);
    } finally {
      setLoggingOut(false);
    }
  }, [loggingOut, router, supabase]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur">
      <div className="flex w-full items-center justify-between p-4 md:px-8">
          <div className="flex flex-1 items-center">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-md border border-fuchsia-500/40 bg-slate-900 px-3 py-1 text-sm font-semibold text-fuchsia-200 shadow-sm transition hover:border-fuchsia-400/70 hover:text-white"
            >
              <span className="flex size-8 items-center justify-center rounded-md bg-fuchsia-600 text-xs font-bold text-white">
                GN
              </span>
              TASKS
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-end gap-3">
            <div className="flex min-w-48 items-center justify-end">
              {tenantError ? (
                <span className="rounded-md border border-red-600 bg-red-900/30 px-3 py-1 text-xs text-red-200">
                  {tenantError}
                </span>
              ) : (
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition focus:border-fuchsia-500 focus:outline-none disabled:opacity-60"
                  value={activeTenantId ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value) {
                      void switchTenant(value);
                    }
                  }}
                  disabled={tenantLoading || tenants.length === 0}
                >
                  {activeTenantId == null && <option value="">Select a tenant</option>}
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name ?? tenant.slug ?? tenant.id}
                    </option>
                  ))}
                  {tenants.length === 0 && activeTenantId && (
                    <option value={activeTenantId}>{context?.activeTenant?.tenantName ?? activeTenantId}</option>
                  )}
                </select>
              )}
            </div>
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="flex size-10 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-sm font-semibold text-fuchsia-100 transition hover:border-fuchsia-500 hover:text-white"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="User menu"
              >
                {userInitials}
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  aria-label="User options"
                  className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-slate-800 bg-slate-900 shadow-xl"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full px-4 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800 hover:text-fuchsia-100 disabled:opacity-60"
                    disabled={loggingOut}
                  >
                    {loggingOut ? "Signing out..." : "Logout"}
                  </button>
                  {logoutError ? (
                    <div className="px-4 pb-3 text-xs text-red-300">{logoutError}</div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <div className="flex flex-1">
        <aside className="hidden w-64 shrink-0 border-r border-slate-800 bg-slate-900/40 px-4 py-8 md:flex md:flex-col">
          <nav className="flex flex-col gap-1">{sidebarLinks}</nav>
        </aside>
        <main className="flex-1 overflow-y-auto px-4 py-8 md:px-8 md:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
