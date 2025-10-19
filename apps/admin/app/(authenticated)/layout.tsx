import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { ReactNode } from "react";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/sign-out-button";
import { TelemetryProvider } from "@/components/providers/telemetry-provider";
import { PRIMARY_NAVIGATION, type NavigationItem } from "@/lib/navigation";
import { extractAdminRoles, hasRequiredAdminRole, type AdminRole } from "@/lib/roles";
import { getSupabaseServerComponentClient } from "@/lib/supabase/server";

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

const AUTHORIZED_ROLES: AdminRole[] = ["super-admin", "support", "auditor"];

export default async function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const supabase = getSupabaseServerComponentClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/signin");
  }

  const roles = extractAdminRoles(session);
  const hasAccess = hasRequiredAdminRole(roles, AUTHORIZED_ROLES);

  if (!hasAccess) {
    return <AccessDeniedLayout roles={roles} email={session.user.email ?? undefined} />;
  }

  const navigation = PRIMARY_NAVIGATION.filter((item) =>
    item.roles.some((role) => roles.has(role))
  );

  return (
    <AuthorizedShell session={session} roles={roles} navigation={navigation}>
      {children}
    </AuthorizedShell>
  );
}

const AuthorizedShell = ({
  session,
  roles,
  navigation,
  children
}: {
  session: Session;
  roles: Set<AdminRole>;
  navigation: readonly NavigationItem[];
  children: ReactNode;
}) => {
  const roleBadges = Array.from(roles.values());
  const userFullName =
    (session.user.user_metadata?.full_name as string | undefined) ??
    (session.user.app_metadata?.full_name as string | undefined) ??
    session.user.email ??
    "Super Admin";

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-border bg-card px-6 py-4 md:flex md:h-auto md:w-72 md:flex-col md:border-b-0 md:border-r">
        <div className="flex flex-col gap-2">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-primary/80">GrowNext</p>
            <h1 className="text-lg font-semibold tracking-tight text-primary">Super Admin</h1>
          </div>
          <div className="hidden rounded-md border border-border bg-background/80 p-3 text-xs text-muted-foreground md:block">
            <p className="font-medium text-foreground">{userFullName}</p>
            <p>{session.user.email}</p>
            {roleBadges.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1 text-[0.65rem] uppercase tracking-wide text-primary">
                {roleBadges.map((role) => (
                  <span key={role} className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5">
                    {role}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <nav className="mt-6 hidden flex-1 flex-col space-y-1 text-sm font-medium text-muted-foreground md:flex">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 transition hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <footer className="mt-6 hidden md:block">
          <SignOutButton />
          <p className="mt-3 text-xs text-muted-foreground">Internal access only · {new Date().getFullYear()}</p>
        </footer>
      </aside>
      <main className="flex-1 bg-background">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">GrowNext</p>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Super Admin</h1>
          </div>
          <SignOutButton />
        </div>
        <TelemetryProvider>
          <section className="px-6 py-8">{children}</section>
        </TelemetryProvider>
      </main>
    </div>
  );
};

const AccessDeniedLayout = ({ roles, email }: { roles: Set<AdminRole>; email?: string }) => (
  <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-6 py-10">
    <div className="w-full space-y-5 rounded-xl border border-border bg-card p-8 text-sm shadow-lg">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Access restricted</h2>
        <p className="text-muted-foreground">
          {email ? (
            <>
              The account <span className="font-medium text-foreground">{email}</span> is signed in but does not have
              Super Admin privileges.
            </>
          ) : (
            "Your account is signed in but does not have Super Admin privileges."
          )}
        </p>
      </header>
      <p className="text-muted-foreground">
        Current roles: {Array.from(roles.values()).length === 0 ? "None assigned" : Array.from(roles.values()).join(", ")}
      </p>
      <div className="space-y-3 text-muted-foreground">
        <p>If you believe this is an error, contact the platform team to request elevated access.</p>
        <p>Otherwise, sign out and switch to an account with the appropriate permissions.</p>
      </div>
      <div className="flex items-center justify-between">
        <Link href="/signin" className="text-sm font-medium text-primary underline">
          Switch account
        </Link>
        <SignOutButton />
      </div>
    </div>
  </main>
);
