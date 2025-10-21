"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { PortalPermission } from "@/lib/portal-permissions";

interface NavLink {
  href: string;
  label: string;
  permission?: PortalPermission;
}

const links: NavLink[] = [
  { href: "/", label: "Dashboard" },
  { href: "/tenants", label: "Tenants", permission: "tenant:view" },
  { href: "/members", label: "Members", permission: "members:view" },
  { href: "/profile", label: "Profile" },
  { href: "/permissions", label: "Permissions", permission: "permissions:view" },
  { href: "/organization/settings", label: "Settings", permission: "organization:view" },
  { href: "/status", label: "Status" }
];

interface PortalHeaderProps {
  user: {
    email: string;
    fullName?: string;
    organization?: string;
  };
  permissions: Set<PortalPermission>;
  billingEnabled?: boolean;
}

export function PortalHeader({ user, permissions, billingEnabled }: PortalHeaderProps) {
  const pathname = usePathname();
  const supabase = getSupabaseClient();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const navLinks: NavLink[] = billingEnabled
    ? [
        ...links.slice(0, 3),
        { href: "/billing", label: "Billing", permission: "organization:billing" },
        ...links.slice(3)
      ]
    : links;

  return (
    <header className="border-b border-slate-800 bg-slate-950/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-white">
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-fuchsia-600 text-sm font-bold text-white">
            GN
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium">
          {navLinks
            .filter((link) => !link.permission || permissions.has(link.permission))
            .map((link) => {
              const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={isActive ? "text-fuchsia-300" : "text-slate-400 transition hover:text-slate-200"}
                >
                  {link.label}
                </Link>
              );
            })}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <div className="text-right">
            <div className="font-semibold text-slate-200">{user.email}</div>
            <div className="text-xs text-slate-500">
              Org: {user.organization && user.organization.length > 0 ? user.organization : "Unknown"}
            </div>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-red-500 hover:text-red-300 disabled:opacity-50"
            type="button"
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>
    </header>
  );
}
