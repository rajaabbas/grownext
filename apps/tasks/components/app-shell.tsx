"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTenantContext } from "@/components/tenant-context";

const userInitials = "AM";

const navigation: Array<{ name: string; href: string }> = [
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { tenants, activeTenantId, loading: tenantLoading, switchTenant, context, error: tenantError } =
    useTenantContext();

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
          <Link
            key={item.href}
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
        );
      }),
    [pathname]
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur">
        <div className="flex w-full items-center justify-between px-4 py-4 md:px-8">
          <div className="flex flex-1 items-center">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-md border border-fuchsia-500/40 bg-slate-900 px-3 py-1 text-sm font-semibold text-fuchsia-200 shadow-sm transition hover:border-fuchsia-400/70 hover:text-white"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-fuchsia-600 text-xs font-bold text-white">
                GN
              </span>
              TASKS
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-end gap-3">
            <div className="flex min-w-[12rem] items-center justify-end">
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
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-sm font-semibold text-fuchsia-100 transition hover:border-fuchsia-500 hover:text-white"
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
                    className="flex w-full px-4 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800 hover:text-fuchsia-100"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <div className="flex flex-1">
        <aside className="hidden w-64 flex-shrink-0 border-r border-slate-800 bg-slate-900/40 px-4 py-6 md:flex md:flex-col md:gap-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Navigation</div>
          <nav className="flex flex-col gap-1">{sidebarLinks}</nav>
        </aside>
        <main className="flex-1 overflow-y-auto px-4 py-8 md:px-8 md:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
