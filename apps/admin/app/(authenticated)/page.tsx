import { ArrowRightIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { redirect } from "next/navigation";

import type { AdminRole } from "@/lib/roles";
import { extractAdminRoles } from "@/lib/roles";
import { getSupabaseServerComponentClient } from "@/lib/supabase/server";

interface QuickLink {
  title: string;
  description: string;
  href: string;
  roles: readonly AdminRole[];
}

const QUICK_LINKS: QuickLink[] = [
  {
    title: "Manage Users",
    description: "Search, filter, and review user access across products.",
    href: "/users",
    roles: ["super-admin", "support"]
  },
  {
    title: "Audit Activity",
    description: "Inspect privileged actions and export audit trails.",
    href: "/audit",
    roles: ["super-admin", "support", "auditor"]
  },
  {
    title: "Operational Runbooks",
    description: "Review SOPs for impersonation, bulk actions, and compliance workflows.",
    href: "/docs/plan",
    roles: ["super-admin", "support", "auditor"]
  },
  {
    title: "Bulk Operations",
    description: "Queue high-volume jobs and track background progress.",
    href: "/users/bulk",
    roles: ["super-admin"]
  },
  {
    title: "Admin Settings",
    description: "Tune feature flags, guardrails, and observability targets.",
    href: "/settings",
    roles: ["super-admin"]
  }
];

const buildRoleMessage = (roles: Set<AdminRole>) => {
  if (roles.has("super-admin")) {
    return "Centralize user management, role assignments, impersonation, and audit oversight for every GrowNext app.";
  }

  if (roles.has("support") && roles.has("auditor")) {
    return "Review cross-application access, investigate support escalations, and monitor audit activity.";
  }

  if (roles.has("support")) {
    return "Review access across applications, investigate support escalations, and partner with Super Admins for changes.";
  }

  if (roles.has("auditor")) {
    return "Audit privileged activity, validate compliance controls, and export evidence for reviews.";
  }

  return "Explore the Super Admin console for centralized oversight.";
};

export default async function HomePage() {
  const supabase = getSupabaseServerComponentClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/signin");
  }

  const roles = extractAdminRoles(session);
  if (roles.size === 0) {
    redirect("/signin");
  }

  const filteredLinks = QUICK_LINKS.filter((link) => link.roles.some((role) => roles.has(role)));

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Welcome to the Super Admin console</h2>
        <p className="text-sm text-muted-foreground">{buildRoleMessage(roles)}</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group relative rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">{link.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{link.description}</p>
              </div>
              <ArrowRightIcon className="h-5 w-5 text-muted-foreground transition group-hover:text-primary" />
            </div>
          </Link>
        ))}
      </section>

      <section className="rounded-xl border border-dashed border-border bg-muted/30 p-6">
        <p className="text-sm text-muted-foreground">
          Need a refresher on scope and rollout steps? Visit the{" "}
          <Link href="/docs/plan" className="font-medium text-primary underline">
            delivery plan
          </Link>{" "}
          for milestones, guardrails, and next actions across teams.
        </p>
      </section>
    </div>
  );
}
