import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SupabaseProvider } from "@/components/supabase-provider";
import { SupabaseListener } from "@/components/supabase-listener";
import { SiteHeader } from "@/components/site-header";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Monorepo Boilerplate",
  description: "Domain-neutral SaaS starter with Supabase Auth and TypeScript."
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;

  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-background`}>
        <SupabaseProvider session={session}>
          <SupabaseListener accessToken={session?.access_token} />
          <SiteHeader isAuthenticated={!!user} />
          <main className="mx-auto w-full max-w-5xl px-4 py-10">{children}</main>
        </SupabaseProvider>
      </body>
    </html>
  );
}
