import type { Metadata } from "next";
import type { Session } from "@supabase/supabase-js";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { PortalHeader } from "@/components/portal-header";
import { getSupabaseServerComponentClient } from "@/lib/supabase/server";
import { fetchPortalLauncher } from "@/lib/identity";
import { resolvePortalPermissions, hasPortalPermission } from "@/lib/portal-permissions";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GrowNext Portal",
  description: "Unified entry point for authentication, tenant management, and product access"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = getSupabaseServerComponentClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-slate-950 text-slate-100`}>
        {session ? (
          <AuthenticatedLayout session={session} supabaseAccessToken={session.access_token}>
            {children}
          </AuthenticatedLayout>
        ) : (
          <UnauthenticatedLayout>{children}</UnauthenticatedLayout>
        )}
      </body>
    </html>
  );
}

const UnauthenticatedLayout = ({ children }: { children: React.ReactNode }) => (
  <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-10">
    <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl">
      {children}
    </div>
  </main>
);

const AuthenticatedLayout = async ({
  session,
  supabaseAccessToken,
  children
}: {
  session: Session;
  supabaseAccessToken: string;
  children: React.ReactNode;
}) => {
  let launcherData: Awaited<ReturnType<typeof fetchPortalLauncher>> | null = null;

  try {
    launcherData = await fetchPortalLauncher(supabaseAccessToken);
  } catch (error) {
    console.error("Failed to load portal launcher data", error);
  }

  const permissions = resolvePortalPermissions(
    launcherData?.user.organizationRole ?? null,
    launcherData?.rolePermissions
  );

  return (
    <>
      <PortalHeader
        user={{
          email: launcherData?.user.email ?? session.user.email ?? "",
          fullName: launcherData?.user.fullName ?? session.user.user_metadata?.full_name ?? "",
          organization: launcherData?.user.organizationName ?? ""
        }}
        permissions={permissions}
      />
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 shadow-xl">{children}</div>
        <footer className="mt-10 flex items-center justify-between text-sm text-slate-500">
          <span>&copy; {new Date().getFullYear()} GrowNext Platform</span>
          <nav className="flex gap-4">
            {hasPortalPermission(permissions, "tenant:view") ? (
              <Link className="hover:text-slate-200" href="/tenants">
                Tenants
              </Link>
            ) : null}
            <Link className="hover:text-slate-200" href="/profile">
              Profile
            </Link>
            <Link className="hover:text-slate-200" href="/docs">
              Docs
            </Link>
          </nav>
        </footer>
      </main>
    </>
  );
};
