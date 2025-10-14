"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

const links = [
  { href: "/", label: "Launcher" },
  { href: "/tenants", label: "Tenants" },
  { href: "/profile", label: "Profile" }
];

const statusStyles: Record<string, string> = {
  healthy: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
  degraded: "border-amber-400/40 bg-amber-500/10 text-amber-200",
  down: "border-red-400/40 bg-red-500/10 text-red-200"
};

interface PortalHeaderProps {
  user: {
    email: string;
    fullName?: string;
    organization?: string;
  };
  identityStatus: "healthy" | "degraded" | "down";
}

export function PortalHeader({ user, identityStatus }: PortalHeaderProps) {
  const pathname = usePathname();
  const supabase = getSupabaseClient();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const statusClass = statusStyles[identityStatus] ?? statusStyles.degraded;

  return (
    <header className="border-b border-slate-800 bg-slate-950/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-white">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-fuchsia-600 text-sm font-bold text-white">
            GN
          </span>
          GrowNext Portal
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                pathname === link.href
                  ? "text-fuchsia-300"
                  : "text-slate-400 transition hover:text-slate-200"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className={`rounded-full border px-3 py-1 ${statusClass}`}>
            identity: {identityStatus}
          </span>
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
