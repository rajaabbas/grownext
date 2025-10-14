"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Launcher" },
  { href: "/tenants", label: "Tenants" },
  { href: "/profile", label: "Profile" }
];

export function PortalHeader() {
  const pathname = usePathname();

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
          <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-emerald-300">
            identity: healthy
          </span>
          <div className="text-right">
            <div className="font-semibold text-slate-200">demo@tenant.io</div>
            <div className="text-xs text-slate-500">Org: Seeded Organization</div>
          </div>
        </div>
      </div>
    </header>
  );
}
