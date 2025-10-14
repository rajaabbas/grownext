import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { PortalHeader } from "@/components/portal-header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GrowNext Portal",
  description: "Unified entry point for authentication, tenant management, and product access"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-slate-950 text-slate-100`}>
        <PortalHeader />
        <main className="mx-auto w-full max-w-6xl px-6 py-10">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 shadow-xl">
            {children}
          </div>
          <footer className="mt-10 flex items-center justify-between text-sm text-slate-500">
            <span>&copy; {new Date().getFullYear()} GrowNext Platform</span>
            <nav className="flex gap-4">
              <Link className="hover:text-slate-200" href="/tenants">
                Tenants
              </Link>
              <Link className="hover:text-slate-200" href="/profile">
                Profile
              </Link>
              <Link className="hover:text-slate-200" href="/docs">
                Docs
              </Link>
            </nav>
          </footer>
        </main>
      </body>
    </html>
  );
}
